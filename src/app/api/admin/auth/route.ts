import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { isAdminPassword } from '@/lib/admin-auth';
import { notifyAdminWA } from '@/lib/notify';

// ─── POST — verify admin password ─────────────────────────────────────────────
//
// This is the console's login gate: it turns a password into the credential the
// browser then sends on every admin API call. Two properties matter here.
//
// 1. FAIL CLOSED. This route used to answer `{ ok: true }` whenever
//    ADMIN_PASSWORD was unset ("dev mode"), which meant a single missing env var
//    in production handed the entire console to anyone who opened /admin.
//    isAdminPassword() authorizes nobody without a configured secret, and
//    compares in constant time.
//
// 2. THROTTLED. Unlike the data routes, this endpoint is a pure password oracle:
//    it tells the caller whether a guess is right. Without a limiter it is an
//    offline-speed brute force against a single shared secret. We cap attempts
//    per IP; if Redis is unavailable we fail CLOSED for this route, because a
//    login gate with no rate limit is exactly the thing being defended.

// Never throws. `new Redis()` validates the URL eagerly and throws on a
// malformed one — and because this call sat outside the try/catch below, a bad
// UPSTASH_REDIS_REST_URL turned the *login route itself* into a 500. That is a
// self-inflicted lockout: the operator cannot reach the console precisely when
// they may need it to pull hostile content off a screen. Config problems must
// degrade throttling, never authentication.
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  } catch {
    return null;
  }
}

const MAX_ATTEMPTS = 10;
const WINDOW = 900; // 15 minutes

// Per-IP alone is defeated by rotating source addresses, which is cheap. The
// global counter bounds total guesses against the single shared secret no matter
// how the attempts are spread.
//
// Deliberately generous, because a global cap is a double-edged tool: an
// attacker who can trip it can lock the real operator out. 200/15min is far
// below what a credential-stuffing run needs but far above any plausible day of
// honest use by a small team. The alert matters more than the block — a
// distributed attempt is something you want to *know* about, since the correct
// response is rotating the secret, not waiting out a window.
const GLOBAL_MAX = 200;
const GLOBAL_KEY = 'admin:auth:global';

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  const kv = getRedis();
  if (kv) {
    try {
      const key = `admin:auth:${ip}`;
      const attempts = await kv.incr(key);
      if (attempts === 1) await kv.expire(key, WINDOW);

      // Global ceiling across every source address.
      const total = await kv.incr(GLOBAL_KEY);
      if (total === 1) await kv.expire(GLOBAL_KEY, WINDOW);
      if (total === GLOBAL_MAX) {
        // Fire once, on the crossing tick only, so a sustained attack doesn't
        // turn into a WhatsApp flood. Non-blocking; alerting must never delay
        // or fail the auth decision.
        notifyAdminWA(
          `ALIVE security: ${GLOBAL_MAX} failed admin login attempts in ${WINDOW / 60}m ` +
          `across multiple IPs (latest ${ip}). If this isn't you, rotate ADMIN_PASSWORD now.`,
        ).catch(() => {});
      }
      if (total > GLOBAL_MAX) {
        return NextResponse.json(
          { ok: false, error: 'Too many attempts. Try again later.' },
          { status: 429 },
        );
      }

      if (attempts > MAX_ATTEMPTS) {
        return NextResponse.json(
          { ok: false, error: 'Too many attempts. Try again later.' },
          { status: 429 },
        );
      }
    } catch {
      // Redis unreachable — fall through. The constant-time check below still
      // applies; we accept the un-throttled request rather than locking the
      // operator out of their own console during a cache outage.
    }
  }

  try {
    const { password } = await req.json() as { password?: string };
    if (isAdminPassword(password)) {
      // Successful login clears the counter so normal use never trips the limit.
      if (kv) await kv.del(`admin:auth:${ip}`).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
