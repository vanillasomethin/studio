// Tracked admin sessions — the layer that makes a stateless JWT revocable.
//
// Auth.js v5 only supports `strategy: 'jwt'` alongside Credentials providers,
// which is what this app uses for every login. The consequence is easy to miss:
// the adapter's `Session` table is never written, so there is no server-side
// record of who is signed in, and a signed JWT keeps working until it expires no
// matter what the database says. Deleting an account does not log that person
// out.
//
// So each admin sign-in writes an AdminSession row and embeds its id in the JWT
// as `sid`. requireAdmin() then checks that row on every admin request:
//
//   row missing or revoked  →  request denied, regardless of a valid signature
//
// That single lookup is what turns "the token is signed" into "the session is
// still allowed", and it is why force-logout works at all.
//
// The cost is one indexed read per admin request. The write is throttled (see
// TOUCH_INTERVAL_MS) so an active console doesn't turn lastSeenAt into the
// busiest write in the database.

import { db } from './db';

/// Don't rewrite lastSeenAt more often than this. "Active now" is a
/// coarse-grained question; a per-request write to answer it is not worth it.
const TOUCH_INTERVAL_MS = 60_000;

/// A session counts as "currently active" if it was seen within this window.
/// Deliberately longer than TOUCH_INTERVAL_MS so a session can't flicker between
/// active and idle purely because of the throttle above.
export const ACTIVE_WINDOW_MS = 15 * 60_000;

/** Record a new sign-in. Returns the id to embed in the JWT as `sid`. */
export async function createAdminSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<string | null> {
  try {
    const row = await db.adminSession.create({
      data: {
        userId,
        ip:        meta.ip?.slice(0, 100) ?? null,
        userAgent: meta.userAgent?.slice(0, 400) ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    // Never block a legitimate login because session bookkeeping failed. The
    // caller treats a null sid as "unverifiable", which requireAdmin denies —
    // so this degrades to "cannot use the console", never to "unrestricted".
    return null;
  }
}

/**
 * Is this session still allowed to act? Also refreshes lastSeenAt, throttled.
 *
 * FAIL-CLOSED, including for a token that carries no `sid` at all. Such tokens
 * were minted before this shipped and cannot be tied to a revocable row, so
 * there is no honest way to verify them — they are refused and the operator
 * signs in again. That is a one-time re-login, not an outage.
 */
export async function isAdminSessionLive(sid: string | null | undefined): Promise<boolean> {
  if (!sid) return false;

  let row: { id: string; revokedAt: Date | null; lastSeenAt: Date } | null = null;
  try {
    row = await db.adminSession.findUnique({
      where:  { id: sid },
      select: { id: true, revokedAt: true, lastSeenAt: true },
    });
  } catch {
    // A database blip must not silently hand out admin access.
    return false;
  }

  if (!row || row.revokedAt) return false;

  if (Date.now() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    // updateMany, not update: a row revoked between the read above and this
    // write must not be resurrected by the touch. The `revokedAt: null` guard
    // makes the write a no-op in that race.
    void db.adminSession
      .updateMany({ where: { id: sid, revokedAt: null }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  return true;
}

/**
 * End a session. Idempotent, and safe to call on an already-revoked row.
 *
 * `revokedBy` is null when someone signs themselves out, and set to the acting
 * admin's id when one operator force-logs-out another — the audit trail needs to
 * tell those two apart.
 */
export async function revokeAdminSession(sid: string, revokedBy: string | null): Promise<boolean> {
  const res = await db.adminSession.updateMany({
    where: { id: sid, revokedAt: null },
    data:  { revokedAt: new Date(), revokedBy },
  });
  return res.count > 0;
}

/** Revoke every live session for one person (leaver, lost laptop). */
export async function revokeAllForUser(userId: string, revokedBy: string | null): Promise<number> {
  const res = await db.adminSession.updateMany({
    where: { userId, revokedAt: null },
    data:  { revokedAt: new Date(), revokedBy },
  });
  return res.count;
}
