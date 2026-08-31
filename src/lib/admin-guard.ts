// Unified admin authorization + actor identity.
//
// Every admin route asks the same question — "is this caller allowed?" — and 77
// route files currently answer it with their own hand-rolled copy of
//     !!process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD
// Those copies are all fail-closed today, but duplication is exactly how the
// original fail-open bug got in (see the note at the top of admin-auth.ts): one
// edit to one copy, and a route silently opens. Seventy-seven chances to get it
// wrong is the actual vulnerability, not any single line of it.
//
// There is also a second question none of those copies can answer: *who* is this?
// A shared password has no subject, so no admin action can be attributed to a
// person, and revoking one leaver means rotating a secret for everyone.
//
// requireAdmin() answers both, and accepts either credential:
//
//   1. A next-auth session whose user.role is ADMIN or OPS — a *named* operator.
//      Preferred. Revoking one person becomes a role change rather than a
//      fleet-wide secret rotation, and every action carries their user id.
//
//   2. The legacy shared ADMIN_PASSWORD header — kept working during the
//      migration so the console and any operator scripts don't break. It yields
//      an actor of kind 'legacy', which the audit trail deliberately records as
//      unattributable: that is the visible, ongoing cost of a shared secret, and
//      it is what makes the migration's progress measurable.
//
// Fail-closed on both paths: no valid session and no configured secret
// authorizes nobody. The password comparison stays constant-time by delegating
// to isAdminPassword().

import { NextResponse } from 'next/server';
import { isAdminPassword } from './admin-auth';
import { isAdminSessionLive } from './admin-session';

/** Who is performing an admin action. `legacy` = shared password, no subject. */
export type AdminActor =
  | { kind: 'user';   userId: string; label: string; role: 'ADMIN' | 'OPS' }
  | { kind: 'legacy'; userId: null;   label: 'shared-password'; role: 'ADMIN' };

type HeaderBag = { headers: { get(name: string): string | null } };

/**
 * Resolve the admin actor for a request, or null if the caller is not an admin.
 *
 * Tries the named session first so that once an operator has a real account,
 * their actions are attributed even if their browser still holds the old shared
 * password in sessionStorage.
 */
export async function requireAdmin(
  req: HeaderBag,
  { allowMfaPending = false }: { allowMfaPending?: boolean } = {},
): Promise<AdminActor | null> {
  // 1. Named operator via next-auth session.
  //
  // auth() is imported lazily: this module is pulled into every admin route, and
  // a static import would drag the Prisma adapter + bcrypt into any route that
  // only ever needs the header check. The try/catch covers auth() throwing
  // outside a request scope — that is a "no session" answer, never an "allow".
  try {
    const { auth } = await import('./auth');
    const session = await auth();
    const user = session?.user;
    if (user && (user.role === 'ADMIN' || user.role === 'OPS')) {
      // With the auth.ts signIn choke point, an ADMIN/OPS session can only come
      // from the admin-mfa provider, so user.mfa === false means "authenticated
      // but not yet enrolled" — allowed ONLY on the enrolment route, which passes
      // allowMfaPending. Every other admin route requires a completed 2FA login.
      if (!user.mfa && !allowMfaPending) return null;

      // The signature being valid is not enough: a JWT keeps verifying after the
      // person has been logged out, because nothing about revocation is carried
      // in the token. This checks the tracked row the sid points at, which is
      // what makes force-logout take effect on the very next request instead of
      // whenever the token happens to expire. Fail-closed, including for older
      // tokens that carry no sid at all.
      if (!(await isAdminSessionLive(user.sid))) return null;

      return {
        kind:   'user',
        userId: user.id,
        label:  user.email ?? user.name ?? user.id,
        role:   user.role,
      };
    }
  } catch {
    // No session available — fall through to the shared secret. Never authorizes.
  }

  // 2. Legacy shared secret. Fail-closed + constant-time inside isAdminPassword().
  if (isAdminPassword(req.headers.get('admin-password'))) {
    return { kind: 'legacy', userId: null, label: 'shared-password', role: 'ADMIN' };
  }

  return null;
}

/** The single 401 shape every admin route returns, so clients see one contract. */
export function adminUnauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
