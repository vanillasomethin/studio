// Admin play-event query.
// GET /api/events?deviceId=&campaignId=&tag=&from=&to=&limit=&cursor=
// Auth: admin-password header
// Returns: { events: PlayEvent[], nextCursor }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOrCreateCorrelationId, hashStack, recordError } from '@/lib/telemetry';
import { respond } from '@/lib/api-envelope';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  const startedAtMs = Date.now();
  const correlationId = getOrCreateCorrelationId(req.headers.get('x-correlation-id'));
  const route = '/api/events';
  if (!adminGuard(req)) {
    const envelope = await respond({ error: 'Unauthorized', correlationId }, { route, request: { correlationId }, outcome: 'unauthorized', policyFlags: ['admin_guard'], errorCategory: 'auth', startedAtMs });
    return NextResponse.json(envelope, { status: 401 });
  }

  const p          = req.nextUrl.searchParams;
  const deviceId   = p.get('deviceId')   ?? undefined;
  const campaignId = p.get('campaignId') ?? undefined;
  const tag        = p.get('tag')        ?? undefined;
  const from       = p.get('from')       ? new Date(p.get('from')!) : undefined;
  const to         = p.get('to')         ? new Date(p.get('to')!)   : undefined;
  const limit      = Math.min(Number(p.get('limit') ?? 500), 2000);
  const cursor     = p.get('cursor')     ?? undefined;

  try {
    const events = await db.playEvent.findMany({
      where: {
        ...(deviceId   ? { deviceId }   : {}),
        ...(campaignId ? { campaignId } : {}),
        ...(tag        ? { tag }        : {}),
        ...(from || to ? { startedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take:    limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        device: { select: { name: true, groupName: true } },
      },
    });

    const hasMore    = events.length > limit;
    const page       = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    const envelope = await respond({ events: page, nextCursor }, { route, request: { correlationId, deviceId, campaignId, tag, hasFrom: !!from, hasTo: !!to, limit }, outcome: 'success', startedAtMs });
    return NextResponse.json(envelope);
  } catch (e) {
    const error = e as Error;
    await recordError({
      route,
      errorClass: error.name,
      message: error.message,
      stackHash: hashStack(error.stack),
      requestMeta: { correlationId, method: req.method },
      actorType: 'admin',
      correlationId,
    });
    const envelope = await respond({ error: error.message, correlationId }, { route, request: { correlationId }, outcome: 'server_error', policyFlags: ['exception'], errorCategory: 'runtime', startedAtMs });
    return NextResponse.json(envelope, { status: 500 });
  }
}
