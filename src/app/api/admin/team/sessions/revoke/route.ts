// POST /api/admin/team/sessions/revoke — end someone's session immediately.
// Body: { sid }
//
// Auth: a NAMED admin. Like inviting, this is a privileged act on another
// person's access, and one performed via the shared password would be
// unattributable — "who logged Arya out?" must have an answer.
//
// This is the payoff for the AdminSession table. A JWT cannot be withdrawn:
// it stays valid until it expires no matter what the database says. Marking the
// row revoked makes requireAdmin() refuse the very next request that presents
// that token, which is the difference between real revocation and a UI that only
// looks like it did something.
//
// NOTE — a live gap worth knowing: the middleware credential bridge runs at the
// edge and cannot reach Prisma, so it still injects the shared admin-password
// header for a revoked-but-signed ADMIN/OPS token. Revocation therefore does not
// yet cover the routes still authenticating by that header. Migrating them to
// requireAdmin() closes it; until then, revoking is fully effective only on
// routes that already use the guard.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';
import { revokeAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  if (actor.kind !== 'user') {
    return NextResponse.json(
      { error: 'Revoking a session requires a named admin account, not the shared password.' },
      { status: 403 },
    );
  }

  const { sid } = (await req.json().catch(() => ({}))) as { sid?: string };
  if (!sid) return NextResponse.json({ error: 'sid is required' }, { status: 400 });

  // Read the owner before revoking, so the audit entry says whose session ended
  // even though the row itself only carries a user id.
  const session = await db.adminSession.findUnique({
    where:  { id: sid },
    select: { userId: true, user: { select: { email: true } } },
  });
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const revoked = await revokeAdminSession(sid, actor.userId);

  await logAdminAction({
    actor,
    action: 'admin.session_revoked',
    target: session.user?.email ?? session.userId,
    meta:   { sid, alreadyEnded: !revoked, self: session.userId === actor.userId },
    req,
  });

  return NextResponse.json({
    ok: true,
    // false when the session had already ended — reported rather than treated as
    // an error, since the caller's intent ("this session must not work") holds
    // either way.
    revoked,
    self: session.userId === actor.userId,
  });
}
