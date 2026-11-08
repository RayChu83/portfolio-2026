import { Ratelimit } from "@upstash/ratelimit";
import { hashedClientIp, isProduction, redis } from "./network";

const PER_IP_PER_MINUTE = 5;
const PER_IP_PER_DAY = 25;
const GLOBAL_PER_DAY = 250;

const prefix = isProduction ? "ratelimit:ask" : "ratelimit_dev:ask";

const perMinute = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(PER_IP_PER_MINUTE, "1 m"),
  prefix: `${prefix}:minute`,
});
const perDay = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(PER_IP_PER_DAY, "1 d"),
  prefix: `${prefix}:day`,
});
const globalPerDay = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(GLOBAL_PER_DAY, "1 d"),
  prefix: `${prefix}:global`,
});

/**
 * Whether this request may spend embedding and generation budget.
 *
 * The per-IP limits run first and short-circuit, so a throttled client never
 * consumes the global budget and cannot exhaust it alone.
 */
export async function allowAsk(headers: Headers): Promise<boolean> {
  const id = hashedClientIp(headers);
  for (const limiter of [perMinute, perDay]) {
    if (!(await limiter.limit(id)).success) return false;
  }
  return (await globalPerDay.limit("all")).success;
}
