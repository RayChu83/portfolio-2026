import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

/** One database backs every route, so keys (not connections) keep environments apart. */
export const redis = Redis.fromEnv();

/**
 * Whether this code is running in the live Vercel deployment. `VERCEL_ENV`
 * separates preview from production where `NODE_ENV` cannot, since a preview
 * build still reports `NODE_ENV=production`. Off Vercel (`next dev`) it falls
 * back to `NODE_ENV`.
 */
export const isProduction =
  process.env.VERCEL_ENV === "production" ||
  (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production");

/** Read per call so a late-set variable is picked up and a missing one fails loudly. */
export function requireSalt() {
  const salt = process.env.VISITOR_SALT;
  if (!salt) throw new Error("VISITOR_SALT is not set");
  return salt;
}

/**
 * Whether a browser says another site initiated this request. Absent means a
 * non-browser client or an old browser, which this check cannot judge.
 */
export function isCrossSite(h: Headers) {
  const site = h.get("sec-fetch-site");
  return site !== null && site !== "same-origin";
}

/**
 * The address a client cannot cheaply rotate within: an IPv6 host usually
 * owns a whole /64, so it is keyed by that prefix. IPv4 passes through.
 */
function clientNetwork(ip: string) {
  if (!ip.includes(":")) return ip;
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1];
  const [head, tail] = lower.split("::");
  const groups = head ? head.split(":") : [];
  if (tail !== undefined) {
    const rest = tail ? tail.split(":") : [];
    const zeros = Math.max(0, 8 - groups.length - rest.length);
    groups.push(...Array(zeros).fill("0"), ...rest);
  }
  const prefix = groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16));
  return `${prefix.join(":")}::/64`;
}

/** Salted digest of the client's network, so Redis never holds a raw address. */
export function hashedClientIp(h: Headers) {
  // First hop only: later `x-forwarded-for` entries are proxies, not the visitor.
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return createHash("sha256")
    .update([requireSalt(), clientNetwork(ip)].join("|"))
    .digest("base64url")
    .slice(0, 22);
}
