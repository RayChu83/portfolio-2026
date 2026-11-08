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

/** Salted digest of the client IP, so Redis never holds a raw address. */
export function hashedClientIp(h: Headers) {
  // First hop only: later `x-forwarded-for` entries are proxies, not the visitor.
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return createHash("sha256")
    .update([requireSalt(), ip].join("|"))
    .digest("base64url")
    .slice(0, 22);
}
