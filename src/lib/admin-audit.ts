// Admin audit trail.
//
// The AuditLog model has existed since the T2 schema but nothing ever wrote to
// it, which meant the platform could not answer the one question that actually
// matters after an incident: *who changed what, and when*. For an ad network
// selling screen time to brands that is not only a security gap but a
// contractual one — "someone scheduled content we didn't book" needs an answer
// with a name and a timestamp attached.
//
// Two deliberate choices:
//
// 1. BEST-EFFORT, NEVER BLOCKING. A failed audit write must not fail the admin
//    action that triggered it — a Postgres hiccup should not stop an operator
//    pulling bad content off a screen. The trade-off is real and worth naming:
//    a determined attacker who can break the DB write can act unlogged. The
//    mitigation is that the write shares the same database as the mutation
//    itself, so an attacker who can suppress the log has almost certainly
//    already lost the ability to make the change they wanted to hide.
//
// 2. SECRETS ARE SCRUBBED. `meta` is caller-supplied and admin routes handle
//    passwords, tokens and KYC fields. Anything whose key looks credential-like
//    is redacted before it reaches the row, so the audit trail can never become
//    the place the shared password leaks into plaintext storage.

import { db } from './db';
import type { AdminActor } from './admin-guard';

const SECRET_KEY = /pass|secret|token|key|auth|otp|aadhaar|pan|hash/i;

/** Redact credential-shaped values so the audit trail never stores a secret. */
function scrub(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SECRET_KEY.test(k)) {
      out[k] = '[redacted]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = scrub(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

type HeaderBag = { headers: { get(name: string): string | null } };

export async function logAdminAction(opts: {
  actor:   AdminActor;
  /** Dotted verb, e.g. 'schedule.create', 'content.delete', 'device.power'. */
  action:  string;
  /** The thing acted on — usually an id. */
  target?: string | null;
  meta?:   Record<string, unknown>;
  req?:    HeaderBag;
}): Promise<void> {
  try {
    const { actor, action, target, meta, req } = opts;
    await db.auditLog.create({
      data: {
        // Null for the shared password — an unattributable action, recorded as
        // such rather than silently credited to nobody in particular.
        actorId:   actor.userId,
        action,
        target:    target ?? null,
        meta: {
          actor: actor.label,
          via:   actor.kind === 'legacy' ? 'shared-password' : 'session',
          ...(meta ? scrub(meta) : {}),
        },
        ip:
          req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          req?.headers.get('x-real-ip') ??
          null,
        userAgent: req?.headers.get('user-agent') ?? null,
      },
    });
  } catch {
    // Never let auditing break the action it is recording. See note 1 above.
  }
}
