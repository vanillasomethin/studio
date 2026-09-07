// GET /api/admin/team — everyone with console access, their live sessions, and
// any invitations still outstanding.
//
// Auth: any admin (named session or, during the migration, the shared password),
// because this is read-only. Creating invites and revoking sessions require a
// NAMED account — those are in their own routes.
//
// Nothing secret leaves this route. passwordHash is read only to derive a
// boolean and is never placed on the response; mfaSecret and mfaBackupCodes are
// never selected at all. The rule is that this payload lands in a browser, so it
// contains only what a person is allowed to see about their colleagues.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { ACTIVE_WINDOW_MS } from '@/lib/admin-session';

export async function GET(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const users = await db.user.findMany({
    where:   { role: { in: ['ADMIN', 'OPS'] } },
    select:  {
      id: true, email: true, name: true, role: true,
      mfaEnabledAt: true, mfaBackupCodesAt: true, createdAt: true,
      // Read to derive `status` below. Deliberately dropped before responding.
      passwordHash: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Last successful sign-in per person, from the same AuditLog the activity feed
  // reads — one source of truth rather than a second "lastLoginAt" column that
  // could drift out of agreement with the history shown next to it.
  const lastLogins = await db.auditLog.groupBy({
    by:    ['actorId'],
    where: { action: 'admin.login', actorId: { in: users.map((u) => u.id) } },
    _max:  { createdAt: true },
  });
  const lastLoginBy = new Map(lastLogins.map((r) => [r.actorId, r._max.createdAt]));

  const sessions = await db.adminSession.findMany({
    where:   { revokedAt: null },
    select:  { id: true, userId: true, createdAt: true, lastSeenAt: true, ip: true, userAgent: true },
    orderBy: { lastSeenAt: 'desc' },
    take:    100,
  });

  const invites = await db.adminInvite.findMany({
    where:   { acceptedAt: null, expiresAt: { gt: new Date() } },
    select:  { id: true, email: true, role: true, expiresAt: true, createdAt: true, invitedBy: true },
    orderBy: { createdAt: 'desc' },
  });

  const emailById = new Map(users.map((u) => [u.id, u.email]));
  const activeSince = Date.now() - ACTIVE_WINDOW_MS;

  return NextResponse.json({
    // Who the caller is, so the UI can mark "this is you" and avoid offering to
    // log yourself out by accident.
    you: { userId: actor.userId, label: actor.label, kind: actor.kind },

    members: users.map((u) => ({
      id:        u.id,
      email:     u.email,
      name:      u.name,
      role:      u.role,
      // 'invited'  — account exists but no password set yet (invite outstanding)
      // 'setup'    — password set but 2FA not enrolled; cannot use the console
      // 'active'   — password + 2FA, fully operational
      status:    !u.passwordHash ? 'invited' : (u.mfaEnabledAt ? 'active' : 'setup'),
      mfaEnrolled:      !!u.mfaEnabledAt,
      hasBackupCodes:   !!u.mfaBackupCodesAt,
      createdAt: u.createdAt,
      lastLogin: lastLoginBy.get(u.id) ?? null,
      liveSessions: sessions.filter((s) => s.userId === u.id).length,
    })),

    sessions: sessions.map((s) => ({
      id:         s.id,
      userId:     s.userId,
      email:      emailById.get(s.userId) ?? null,
      createdAt:  s.createdAt,
      lastSeenAt: s.lastSeenAt,
      // "Active" is a window, not a heartbeat: lastSeenAt is only refreshed once
      // a minute (see admin-session.ts), so a stricter test would flicker.
      active:     s.lastSeenAt.getTime() >= activeSince,
      ip:         s.ip,
      userAgent:  s.userAgent,
      isYou:      actor.kind === 'user' && s.userId === actor.userId,
    })),

    invites,
  });
}
