import { Redis } from "@upstash/redis";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
 * Reports the site's visitor count, incrementing it the first time a given
 * browser is seen and simply reading it back on every visit after.
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

  const count = alreadyCounted
    ? ((await redis.get<number>(VISITOR_COUNT_KEY)) ?? 0)
    : await redis.incr(VISITOR_COUNT_KEY);

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
