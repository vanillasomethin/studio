// Who did this? — reads the identity middleware put on the request and records
// it against AuditLog, so admin actions name a person rather than "the admin
// password". Node-only (touches Prisma); middleware/edge should use
// admin-session.ts instead.

import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  ADMIN_ID_HEADER, ADMIN_NAME_HEADER, ADMIN_EMAIL_HEADER, ADMIN_TEAM_HEADER,
  type AdminIdentity,
} from '@/lib/admin-session';

/** The signed-in admin, or null when the request came in on the shared secret. */
export function adminActor(req: NextRequest | Request): AdminIdentity | null {
  const h = req.headers;
  const id = h.get(ADMIN_ID_HEADER);
  if (!id) return null;
  return {
    id,
    name:  h.get(ADMIN_NAME_HEADER)  ?? '',
    email: h.get(ADMIN_EMAIL_HEADER) ?? '',
    team:  h.get(ADMIN_TEAM_HEADER)  ?? '',
  };
}

/** Short label for UI/logs — "Arya (operations)", or a clear fallback. */
export function adminActorLabel(actor: AdminIdentity | null): string {
  if (!actor) return 'Shared admin login';
  return actor.team ? `${actor.name} (${actor.team})` : actor.name;
}

/**
 * Append an audit entry. Never throws — an audit failure must not take down the
 * action it was recording.
 */
export async function recordAdminAction(
  req: NextRequest | Request,
  action: string,
  target?: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  const actor = adminActor(req);
  try {
    await db.auditLog.create({
      data: {
        actorId:   actor?.id ?? null,
        action,
        target:    target ?? null,
        meta:      { ...(meta ?? {}), actorName: actor?.name ?? null, actorEmail: actor?.email ?? null, actorTeam: actor?.team ?? null },
        ip:        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: req.headers.get('user-agent') ?? null,
      },
    });
  } catch {
    /* non-fatal */
  }
}
