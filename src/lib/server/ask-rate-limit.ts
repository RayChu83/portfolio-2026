import { Ratelimit } from "@upstash/ratelimit";
import { hashedClientIp, isProduction, redis } from "./network";

const PER_IP_PER_MINUTE = 5;
const PER_IP_PER_DAY = 25;
const GLOBAL_PER_DAY = 250;

const prefix = isProduction ? "ratelimit:ask" : "ratelimit_dev:ask";

// The library defaults to a 5s timeout that resolves as success, so a slow
// Redis would let every request through. 0 disables it and the call throws.
const ratelimit = (
  keyPrefix: string,
  algorithm: ReturnType<typeof Ratelimit.fixedWindow>,
) => new Ratelimit({ redis, limiter: algorithm, prefix: keyPrefix, timeout: 0 });

const perMinute = ratelimit(
  `${prefix}:minute`,
  Ratelimit.slidingWindow(PER_IP_PER_MINUTE, "1 m"),
);
const perDay = ratelimit(
  `${prefix}:day`,
  Ratelimit.fixedWindow(PER_IP_PER_DAY, "1 d"),
);
// Shared by every environment: it caps real spend, which previews also incur.
const globalPerDay = ratelimit(
  "ratelimit:ask:global",
  Ratelimit.fixedWindow(GLOBAL_PER_DAY, "1 d"),
);

/**
 * Whether this request may spend embedding and generation budget.
 *
 * The per-IP limits run first and short-circuit, so a throttled client never
 * consumes the global budget. One client can take at most `PER_IP_PER_DAY`
 * of it per environment.
 */
export async function allowAsk(headers: Headers): Promise<boolean> {
  const id = hashedClientIp(headers);
  for (const limiter of [perMinute, perDay]) {
    if (!(await limiter.limit(id)).success) return false;
  }
  return (await globalPerDay.limit("all")).success;
}
