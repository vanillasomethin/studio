import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { resolveStoreId } from '@/lib/store-partner-auth';
import { requireAdmin } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { db } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Flyer = {
  id:          string;
  storeId?:    string;
  storeName:   string;
  title:       string;
  description: string;
  validUntil:  string;
  imageBase64: string;
  createdAt:   string;
};

// ─── Redis ───────────────────────────────────────────────────────────────────

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const INDEX_KEY = 'flyers:index'; // string[] of IDs — no images, stays tiny

// ─── POST — save a flyer ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<Flyer, 'id' | 'createdAt'>;

    // Two callers: an admin uploading on a store's behalf (requireAdmin — named
    // session or the legacy admin-password header), and the store partner app
    // (storeId — no session, same as every other store-partner route, see
    // resolveStoreId). A store partner's own session is not an admin actor, so
    // it falls through to resolveStoreId exactly as before.
    const actor   = await requireAdmin(req);
    const storeId = actor ? null : await resolveStoreId(body.storeId);
    // Neither credential — kept as a literal 401 rather than adminUnauthorized()
    // because this covers the store-partner path too. Same body, same status.
    if (!actor && !storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const kv = getRedis();
    if (!kv) return NextResponse.json({ success: true, id: 'demo', note: 'Redis not configured' });

    const flyer: Flyer = {
      ...body,
      storeId:   storeId ?? body.storeId,
      id:        `flyer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    // Store each flyer under its own key — avoids hitting value-size limits
    await kv.set(`flyer:${flyer.id}`, flyer);

    // Prepend ID to the index list (index holds no images — stays small)
    const index = (await kv.get<string[]>(INDEX_KEY)) ?? [];
    await kv.set(INDEX_KEY, [flyer.id, ...index]);

    // An admin publishing an offer under a store's name is content going out to
    // shoppers on that store's behalf, so record who did it. The store-partner
    // path has no admin actor to attribute and is left unlogged here. The image
    // itself (base64, large) is deliberately not in meta.
    if (actor) {
      await logAdminAction({
        actor, req,
        action: 'flyer.create',
        target: flyer.id,
        meta: {
          storeId:    flyer.storeId ?? null,
          storeName:  flyer.storeName,
          title:      flyer.title,
          validUntil: flyer.validUntil,
        },
      });
    }

    return NextResponse.json({ success: true, id: flyer.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Failed to save flyer' }, { status: 500 });
  }
}

// ─── GET — list all flyers ────────────────────────────────────────────────────

// Store names drift (admin renames, stray whitespace), so name matching is a
// fallback, not the primary key — compare trimmed/case-folded on both sides.
const normName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export async function GET(req: NextRequest) {
  const kv = getRedis();
  if (!kv) return NextResponse.json([]);

  try {
    const index = (await kv.get<string[]>(INDEX_KEY)) ?? [];
    if (!index.length) return NextResponse.json([]);

    // Fetch all flyers in one mget call
    const keys    = index.map((id) => `flyer:${id}`);
    const results = await kv.mget<Flyer[]>(...keys);
    let   flyers  = (results as (Flyer | null)[]).filter((f): f is Flyer => f !== null);

    // ?storeId= narrows to one store's flyers, matched by id with a
    // normalized-name fallback for legacy records saved before flyers carried
    // a storeId. Same ownership proof as writes (resolveStoreId) — a bare
    // storeId is not a credential.
    const requestedStoreId = req.nextUrl.searchParams.get('storeId');
    if (requestedStoreId) {
      const storeId = await resolveStoreId(requestedStoreId);
      if (!storeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const store = await db.store.findUnique({ where: { id: storeId }, select: { storeName: true } });
      const name  = normName(store?.storeName ?? '');
      flyers = flyers.filter((f) =>
        f.storeId ? f.storeId === storeId : name !== '' && normName(f.storeName) === name
      );
    }

    // Strip storeId: this endpoint is public (deals page + dashboards filter by
    // storeName). Store ids are no longer API credentials (writes require a
    // signed x-store-token — see resolveStoreId), but internal ids still don't
    // belong in a public payload.
    return NextResponse.json(flyers.map(({ storeId: _storeId, ...pub }) => pub));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? 'Failed to fetch flyers' }, { status: 500 });
  }
}
