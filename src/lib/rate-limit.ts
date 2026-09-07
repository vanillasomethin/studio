// Shared attempt limiter (Upstash Redis).
//
// Exists because a TOTP code is only six digits — about a million combinations,
// and the ±1 step tolerance means roughly three codes are live at any moment.
// Unlimited guesses would reduce a second factor to a speed bump, so the limit
// is not optional decoration: it is what makes 2FA worth enrolling in.
//
// AVAILABILITY POLICY: if Redis is unreachable this returns `false` (allow), so
// a cache outage cannot lock an operator out of their own console. That is the
// same trade-off /api/admin/auth already makes, kept deliberately consistent —
// but it is a real trade-off, so callers get `degraded: true` and can alert on
// it. A silent loss of throttling is far worse than a noisy one.
//
// Redis construction is wrapped: `new Redis()` validates the URL eagerly and
// throws on a malformed one, which previously turned a config typo into a 500
// on the login route itself.

import { Redis } from '@upstash/redis';

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    return new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch {
    return null;
  }
}

export type LimitResult = {
  /** True when the caller has exceeded `max` within the window. */
  limited:  boolean;
  /** True when no limiter was available, so `limited` is a guess, not a fact. */
  degraded: boolean;
  attempts: number;
};

/** Count one attempt against `key`. Never throws. */
export async function hitLimit(key: string, max: number, windowSec: number): Promise<LimitResult> {
  const kv = getRedis();
  if (!kv) return { limited: false, degraded: true, attempts: 0 };
  try {
    const attempts = await kv.incr(key);
    if (attempts === 1) await kv.expire(key, windowSec);
    return { limited: attempts > max, degraded: false, attempts };
  } catch {
    return { limited: false, degraded: true, attempts: 0 };
  }
}

/** Clear a counter after a legitimate success, so normal use never trips it. */
export async function clearLimit(key: string): Promise<void> {
  const kv = getRedis();
  if (!kv) return;
  try {
    await kv.del(key);
  } catch {
    /* non-fatal */
  }
}
