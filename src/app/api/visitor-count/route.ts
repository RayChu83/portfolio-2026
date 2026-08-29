import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { DEVICE_HINT_HEADER } from "@/lib/device-hint";

const redis = Redis.fromEnv();

/**
 * Whether this request is running in the real, live deployment.
 *
 * `VERCEL_ENV` is what actually distinguishes the three contexts Vercel runs
 * code in — `"development"`, `"preview"`, `"production"` — where `NODE_ENV`
 * alone cannot: a PR preview deployment still runs `next build`, so its
 * `NODE_ENV` is `"production"` too. Falling back to `NODE_ENV` only when
 * `VERCEL_ENV` is unset covers everywhere else code runs without going
 * through Vercel at all — `next dev` on a laptop, most notably.
 */
const isProduction =
  process.env.VERCEL_ENV === "production" ||
  (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production");

/**
 * Redis is key-value, not tables — there is nothing to migrate or seed ahead
 * of time. `INCR` on a key that has never been set treats it as 0 and returns
 * 1 in one atomic step, which is the entire act of "starting the counter at
 * zero": the first visitor's request creates the key, whichever environment
 * (dev, preview, prod) that request happens to land on.
 *
 * One database backs every environment, so the key itself is what keeps them
 * apart — local runs and PR previews increment `visitor_count_dev` and can
 * never touch the real count.
 */
const VISITOR_COUNT_KEY = isProduction ? "visitor_count" : "visitor_count_dev";

/**
 * Marks a browser as already counted. A year rather than a session: the
 * question this number answers is "how many people have landed here", and a
 * cookie that expired on tab close would recount the same person every visit.
 */
const COUNTED_COOKIE = "visitor-counted";
const COUNTED_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The device key's TTL. Deliberately much shorter than the cookie's: this key
 * exists only to catch the visitor who clears cookies (or switches browsers)
 * *within* the same day, not to be a second, cookie-less identity that lasts a
 * year. Past a day it expires on its own and Redis simply forgets it — a
 * returning visitor next week is counted fresh, same as anyone else who
 * arrives with no cookie, which is the correct answer for "how many distinct
 * people landed here" once "within the same sitting" is no longer true.
 */
const DEVICE_KEY_TTL = 60 * 60 * 24;

/**
 * Namespaced apart from `VISITOR_COUNT_KEY` by environment for the same
 * reason that key is: a dev server pounding this route with reloads must not
 * poison the real day's dedup set.
 */
const networkKeyPrefix = isProduction
  ? "visitor_devices:"
  : "visitor_devices_dev:";

/**
 * How many distinct devices one network may contribute in a day.
 *
 * This exists because part of the device identity now comes from the client
 * (see `deviceDigest`), and anything the client supplies it can also forge —
 * a script sending a fresh random hint on every request would otherwise walk
 * the counter up as fast as it could issue them. Capping the set per network
 * bounds that to `MAX_DEVICES_PER_NETWORK` no matter how many hints arrive,
 * and bounds the memory a single IP can occupy in Redis at the same time.
 *
 * Ten is chosen for the honest case rather than the hostile one: a household
 * or a small office, which is as many real devices as one address plausibly
 * brings to a personal site in a day. A genuinely larger shared network — a
 * university, a big office — undercounts past ten, and that is the right way
 * round: the failure is a number slightly too low rather than a number
 * anybody with a terminal can set to whatever they like.
 */
const MAX_DEVICES_PER_NETWORK = 10;

/**
 * How much of the client's hint is read before it is hashed.
 *
 * The hint this route actually sends itself is well under this; the cap is
 * for everyone else, since an unbounded header is otherwise an invitation to
 * post a megabyte of it and make the server hash it.
 */
const MAX_HINT_LENGTH = 128;

/**
 * The hashing salt, or a loud failure.
 *
 * Read per call rather than captured at module load so a deployment that sets
 * the variable late still picks it up, and so the error names the actual
 * problem instead of surfacing as a hash of the string `"undefined"`.
 */
function requireSalt() {
  const salt = process.env.VISITOR_SALT;
  if (!salt) throw new Error("VISITOR_SALT is not set");
  return salt;
}

/**
 * The platform tokens out of a User-Agent string — the parenthesised segment,
 * with everything browser-specific taken back out of it.
 *
 * This is the one part of a UA that describes the *machine* rather than the
 * program: every browser on one computer reports the same operating system in
 * the same place, so it survives a browser switch, while a different computer
 * on the same network reports something different the moment its OS, its
 * version or its form factor differs.
 *
 * Three normalisations, each covering a way two browsers on one device word
 * the same fact differently:
 *
 * - Digits go, because the same OS is written `10_15_7` by Chrome and Safari
 *   and `10.15` by Firefox. Stripping them leaves `Intel Mac OS X` either way,
 *   and it also means an OS point release does not mint a new device.
 * - `rv:` segments go: that is Gecko's engine version, sitting inside the same
 *   parentheses as the platform tokens, and only Firefox emits it.
 * - Case is flattened, since the tokens are only ever compared, never read.
 *
 * Deliberately *not* used: `Sec-CH-UA-Platform` and the high-entropy client
 * hints, which describe the device more precisely and would be the obvious
 * upgrade — except that only Chromium sends them. Folding one in would give
 * Chrome and Safari on one Mac two different keys, which is the exact failure
 * this function exists to avoid.
 */
function platformFamily(userAgent: string) {
  return (userAgent.match(/\(([^)]*)\)/)?.[1] ?? "")
    .split(";")
    .map((token) => token.trim())
    .filter((token) => token && !token.startsWith("rv:"))
    .map((token) => token.replace(/[\d._]+/g, ""))
    .join(";")
    .toLowerCase();
}

/**
 * Which *network* the request came from — the key of the set that holds every
 * device seen on it today.
 *
 * Hashed with a server-only salt so what Redis holds is a digest, never a raw
 * and reversible IP address.
 *
 * `VISITOR_SALT` is required, not defaulted: a missing salt would either crash
 * confusingly deep inside `createHash` or, worse, silently hash with the
 * literal string `"undefined"` — a fixed, guessable salt that defeats the
 * point of salting at all. Failing loudly here is the honest version of that
 * check.
 */
function networkKey(h: Headers) {
  const salt = requireSalt();

  // The first hop only — `x-forwarded-for` is a client-appended chain, and
  // every entry after the first is whichever proxies the request transited,
  // not the visitor.
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();

  const digest = createHash("sha256")
    .update([salt, ip].join("|"))
    .digest("base64url")
    .slice(0, 22);

  return `${networkKeyPrefix}${digest}`;
}

/**
 * Which *device* on that network — one member of the set `networkKey` names.
 *
 * Two halves, and the split is deliberate. The platform family comes from the
 * User-Agent and is free but coarse: it separates a phone from a laptop and
 * stops there, so two MacBooks on one WiFi look identical to it. The hint
 * comes from the client and carries what only the client can see — the
 * display, the CPU, the input hardware, the OS clock — which is what actually
 * tells those two MacBooks apart. Neither half names the browser, so every
 * browser on one device still lands on the same digest.
 *
 * The hint being client-supplied is exactly why `MAX_DEVICES_PER_NETWORK`
 * exists; nothing here trusts it, it is only ever one input to a hash whose
 * blast radius is capped elsewhere.
 *
 * The remaining limit, and it is a real one: two *identical* devices on one
 * network — same model, same OS, same screen, same timezone — measure
 * identically and count as one. Separating them would take a per-device
 * identifier the browsers on that device could all read, and no such thing
 * exists: storage is sandboxed per browser precisely so that one cannot see
 * another's. Identical hardware is the floor of what passive signals can do.
 */
function deviceDigest(h: Headers) {
  const salt = requireSalt();

  const platform = platformFamily(h.get("user-agent") ?? "");
  // Sliced before hashing, and stripped of anything that is not printable
  // ASCII — the hint is arbitrary client input, and while hashing it makes
  // its shape irrelevant to Redis, bounding it first keeps this route from
  // doing unbounded work on request.
  const hint = (h.get(DEVICE_HINT_HEADER) ?? "")
    .slice(0, MAX_HINT_LENGTH)
    .replaceAll(/[^\x20-\x7E]/g, "");

  return createHash("sha256")
    .update([salt, platform, hint].join("|"))
    .digest("base64url")
    .slice(0, 22);
}

/**
 * Reports the site's visitor count, incrementing it the first time a given
 * visitor is seen and simply reading it back on every visit after.
 *
 * Two independent signals decide "seen before", checked cheapest first:
 *
 * 1. The cookie. Free — no Redis call at all — and correct for the common
 *    case of the same browser coming back.
 * 2. Membership of this network's device set, which holds one digest per
 *    device seen on this IP today. This is what catches a visitor who cleared
 *    cookies or opened a second browser *within the same day* — the case the
 *    cookie alone cannot see, and the reason the set exists at all.
 *
 * A set rather than a key per device, because the question is no longer just
 * "has this device been seen" but "how many devices has this network claimed"
 * — see `MAX_DEVICES_PER_NETWORK`. Both answers come off the one structure.
 *
 * Whichever one already fired, this route also (re)plants the cookie. Without
 * that, a visitor who arrives with no cookie but an already-claimed device
 * would be charged a fresh round trip to Redis on every single request for
 * the rest of the day, instead of the cookie taking over after the first.
 *
 * Only a visitor who matches neither is new: that request increments the
 * counter and joins the set, so a second tab or a cleared cookie later the
 * same day lands on branch 2 instead of incrementing again.
 *
 * `GET` rather than `POST`: nothing about this call is a command the client is
 * issuing, it is a client asking what the number is, and the increment is a
 * side effect of *who is asking* rather than of the request itself. Calling
 * `cookies()` also opts the route out of static caching automatically — see
 * the Route Handlers docs — which is required here regardless of verb, since a
 * cached response would hand every visitor the first visitor's count.
 */
export async function GET() {
  const cookieStore = await cookies();
  const alreadyCounted = cookieStore.has(COUNTED_COOKIE);

  const readCount = async () =>
    (await redis.get<number>(VISITOR_COUNT_KEY)) ?? 0;

  let count: number;
  if (alreadyCounted) {
    count = await readCount();
  } else {
    const requestHeaders = await headers();
    const key = networkKey(requestHeaders);
    const device = deviceDigest(requestHeaders);

    // One round trip for both writes. `SADD` reports whether this device is
    // new to the network — atomically, so two near-simultaneous requests from
    // the same device cannot both read "not seen" and both increment — and
    // `EXPIRE ... NX` starts the day's clock without restarting it, so the
    // window runs from when the network was first seen rather than sliding
    // forward on every visit and never closing.
    const [added] = await redis
      .pipeline()
      .sadd(key, device)
      .expire(key, DEVICE_KEY_TTL, "NX")
      .exec<[number, 0 | 1]>();

    if (added !== 1) {
      // Already in the set: this device has been counted today, by an earlier
      // request from this browser or by a different browser on the same
      // machine — which is the whole point of the set.
      count = await readCount();
    } else {
      const devices = await redis.scard(key);

      if (devices <= MAX_DEVICES_PER_NETWORK) {
        count = await redis.incr(VISITOR_COUNT_KEY);
      } else {
        // Over the cap. Take the digest back out rather than leaving it: kept,
        // an endless stream of forged hints would grow this set without bound
        // even though none of them can move the counter. Removed, the set
        // stays at its ceiling and each such request simply reads.
        count =
          (
            await redis
              .pipeline()
              .srem(key, device)
              .get<number>(VISITOR_COUNT_KEY)
              .exec<[number, number | null]>()
          )[1] ?? 0;
      }
    }
  }

  const response = NextResponse.json({ count });

  if (!alreadyCounted) {
    response.cookies.set(COUNTED_COOKIE, "1", {
      maxAge: COUNTED_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      // Whether the connection is HTTPS, not whether this is the production
      // counter — every Vercel deployment (preview included) serves over
      // HTTPS, so this is `isProduction`'s sibling question, not the same one.
      // `VERCEL_ENV` is set in every Vercel context and unset only when running
      // locally via plain `next dev`, which is exactly the HTTP case.
      secure: Boolean(process.env.VERCEL_ENV),
    });
  }

  return response;
}
