import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Redis } from '@upstash/redis';
import { db } from '@/lib/db';
import { mintStoreToken } from '@/lib/store-partner-auth';

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
}

const LIMIT = 10;
const WINDOW_SEC = 60;

// In-process backstop for when Redis is unavailable.
//
// Failing fully open on a cache outage turns a credential-stuffing brake into a
// no-op precisely when nobody is watching, but failing closed would lock every
// partner out of their dashboard over an infrastructure blip. So the shared
// limiter stays authoritative, and this bounded per-instance map catches the
// outage case. It is not global — serverless runs many instances — but it costs
// an attacker an order of magnitude and keeps a single source from running
// unbounded against one instance.
const memHits = new Map<string, { n: number; resetAt: number }>();
const MEM_MAX_KEYS = 10_000;

function memoryAllow(ip: string): boolean {
  const now = Date.now();
  const hit = memHits.get(ip);
  if (!hit || now > hit.resetAt) {
    // Bound the map so this can't be turned into a memory-exhaustion vector.
    if (memHits.size > MEM_MAX_KEYS) memHits.clear();
    memHits.set(ip, { n: 1, resetAt: now + WINDOW_SEC * 1000 });
    return true;
  }
  hit.n += 1;
  return hit.n <= LIMIT;
}

// Sliding-window rate limit: max 10 login attempts per IP per 60 seconds.
async function checkRateLimit(ip: string): Promise<boolean> {
  try {
    const kv = getRedis();
    if (!kv) return memoryAllow(ip); // no cache configured — use the backstop

    const key = `rl:login:${ip}`;
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, WINDOW_SEC);
    return count <= LIMIT;
  } catch {
    return memoryAllow(ip); // cache outage — degrade, don't disappear
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many login attempts. Please wait a minute.' }, { status: 429 });
  }

  try {
    const { phone, password } = await req.json() as { phone: string; password: string };
    if (!phone || !password) return NextResponse.json({ store: null });

    const normalized = `+91${phone.replace(/\D/g, '').slice(-10)}`;

    const user = await db.user.findUnique({
      where:  { phone: normalized },
      select: { id: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      // Compare against a dummy hash before answering. Returning immediately
      // skips bcrypt entirely, so an unregistered number replies in a fraction
      // of the time a registered one does — a timing oracle that lets an
      // attacker enumerate which phone numbers are ALIVE partners without ever
      // guessing a password.
      await bcrypt.compare(password, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');
      return NextResponse.json({ store: null, error: 'Incorrect number or password.' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ store: null, error: 'Incorrect number or password.' }, { status: 401 });
    }

    // Fetch store via raw query to avoid schema drift on missing columns
    const rows = await db.$queryRaw<Array<{
      id: string; userId: string; storeName: string; ownerName: string; whatsapp: string;
      address: string | null; locality: string | null; city: string | null; pincode: string | null;
      lat: number | null; lng: number | null; gstin: string | null;
      referralCode: string; referredBy: string | null; agreedAt: Date | null;
      createdAt: Date; updatedAt: Date;
    }>>`
      SELECT id, "userId", "storeName", "ownerName", whatsapp,
             address, locality, city, pincode, lat, lng, gstin,
             "referralCode", "referredBy", "agreedAt", "createdAt", "updatedAt"
      FROM "Store"
      WHERE "userId" = ${user.id}
      LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.json({ store: null, error: 'Store not found.' }, { status: 404 });
    }

    const s = rows[0];
    // Signed token proves ownership of this storeId on later API calls —
    // the mobile app persists it in SecureStore with the rest of the session.
    const token = mintStoreToken(s.id);
    return NextResponse.json({
      store: {
        ...s,
        ...(token ? { token } : {}),
        agreedAt:  s.agreedAt  instanceof Date ? s.agreedAt.toISOString()  : (s.agreedAt ?? null),
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
        updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
