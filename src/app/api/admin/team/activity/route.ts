// GET /api/admin/team/activity — the "who changed what" feed.
//
// Reads AuditLog, which carries both console actions (schedule.create,
// content.delete, …) and sign-in events (admin.login), so history is one
// chronological story rather than two lists the reader has to interleave.
//
// Query: ?limit= &cursor= &actorId= &action=
//   cursor  — id of the last row seen; keyset pagination, so a busy log doesn't
//             shift rows under the reader the way OFFSET does.
//   actorId — one person's trail. 'legacy' selects actions taken with the shared
//             password, which have no actor at all.
//   action  — prefix match, e.g. 'schedule' or 'admin.login'.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import type { Prisma } from '@prisma/client';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 200;

export async function GET(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const sp      = req.nextUrl.searchParams;
  const limit   = Math.min(Math.max(Number(sp.get('limit')) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursor  = sp.get('cursor');
  const actorId = sp.get('actorId');
  const action  = sp.get('action');

  const where: Prisma.AuditLogWhereInput = {};
  // 'legacy' is not a user id — it is the absence of one. Selecting it shows
  // exactly what the shared password has been used for, which is the clearest
  // possible argument for finishing the migration to named accounts.
  if (actorId === 'legacy')  where.actorId = null;
  else if (actorId)          where.actorId = actorId;
  if (action)                where.action  = { startsWith: action };

  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take:    limit + 1,               // one extra row = "is there another page?"
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select:  {
      id: true, actorId: true, action: true, target: true,
      meta: true, ip: true, createdAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const page    = hasMore ? rows.slice(0, limit) : rows;

  // Resolve actor ids to emails in one query rather than per row.
  const ids   = [...new Set(page.map((r) => r.actorId).filter((v): v is string => !!v))];
  const users = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, name: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    entries: page.map((r) => {
      const u = r.actorId ? byId.get(r.actorId) : null;
      const meta = (r.meta ?? {}) as Record<string, unknown>;
      return {
        id:        r.id,
        action:    r.action,
        target:    r.target,
        ip:        r.ip,
        createdAt: r.createdAt,
        actorId:   r.actorId,
        // Prefer the live user record; fall back to the label captured at write
        // time so entries stay readable after an account is renamed or removed.
        actor:     u?.email ?? u?.name ?? (meta.actor as string | undefined) ?? null,
        // Actions taken with the shared password have no subject. Surfaced
        // explicitly rather than shown as a blank so the gap is visible.
        attributable: r.actorId !== null,
        meta,
      };
    }),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  });
}
