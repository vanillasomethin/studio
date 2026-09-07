import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  const kv = getRedis();
  const media = kv ? ((await kv.get<Record<string, string>>('site:media')) ?? {}) : {};
  return NextResponse.json(media);
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { slot, url } = await req.json() as { slot: string; url: string };
  if (!slot || url === undefined) return NextResponse.json({ error: 'slot and url required' }, { status: 400 });
  const kv = getRedis();
  if (kv) {
    const existing = (await kv.get<Record<string, string>>('site:media')) ?? {};
    if (url === '') {
      const updated = { ...existing };
      delete updated[slot];
      await kv.set('site:media', updated);
    } else {
      await kv.set('site:media', { ...existing, [slot]: url });
    }
    // Logged inside the kv branch: with no Redis configured this route reports
    // ok without changing anything, and an audit row there would claim a swap
    // that never happened. Slot swaps change what the public site shows, so
    // record which slot moved and to what.
    await logAdminAction({
      actor, req,
      action: url === '' ? 'site_media.delete' : 'site_media.update',
      target: slot,
      meta:   { slot, url },
    });
  }
  return NextResponse.json({ ok: true });
}
