// Admin play-event query.
// GET /api/events?deviceId=&campaignId=&tag=&from=&to=&limit=&cursor=
// Auth: admin-password header
// Returns: { events: PlayEvent[], nextCursor }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOrCreateCorrelationId, hashStack, recordError } from '@/lib/telemetry';

function adminGuard(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  const correlationId = getOrCreateCorrelationId(req.headers.get('x-correlation-id'));
  const route = '/api/events';
  if (!adminGuard(req)) return NextResponse.json({ error: 'Unauthorized', correlationId }, { status: 401 });

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

    return NextResponse.json({ events: page, nextCursor });
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
    return NextResponse.json({ error: error.message, correlationId }, { status: 500 });
  }
}
