// GET  /api/admin/alerts/comments?alertId=…   — comment thread for one alert
// POST /api/admin/alerts/comments { alertId, author?, body }
// Auth: named admin session (requireAdmin).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';


export async function GET(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const alertId = req.nextUrl.searchParams.get('alertId') ?? '';
  if (!alertId) return NextResponse.json({ error: 'alertId required' }, { status: 400 });

  const comments = await db.alertComment.findMany({
    where: { alertId }, orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({
    comments: comments.map((c) => ({ id: c.id, author: c.author, body: c.body, createdAt: c.createdAt.toISOString() })),
  });
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const body = await req.json().catch(() => null) as { alertId?: string; author?: string; body?: string } | null;
  const alertId = body?.alertId?.trim();
  const text = body?.body?.trim();
  if (!alertId || !text) return NextResponse.json({ error: 'alertId and body required' }, { status: 400 });

  const comment = await db.alertComment.create({
    data: { alertId, author: body?.author?.trim() || null, body: text.slice(0, 2000) },
  });
  return NextResponse.json({
    id: comment.id, author: comment.author, body: comment.body, createdAt: comment.createdAt.toISOString(),
  });
}
