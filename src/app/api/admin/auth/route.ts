// POST /api/admin/auth — RETIRED.
//
// This was the shared-password login gate: it turned the single ADMIN_PASSWORD
// into a credential the browser then replayed on every admin call. That whole
// model is gone. The console is now reached only through a named account
// (email + password + TOTP), which is revocable, attributable and audited —
// none of which a shared secret can be.
//
// The endpoint is kept as an explicit 410 rather than deleted so that a stale
// browser tab still holding the old login form gets a clear answer instead of a
// 404 that reads like an outage. It is also, deliberately, no longer a password
// oracle: it performs no comparison, so there is nothing here left to brute.

import { NextResponse } from 'next/server';

const GONE = {
  ok: false,
  error: 'The shared admin password has been retired. Sign in with your @wearealive.in account.',
};

export function POST() {
  return NextResponse.json(GONE, { status: 410 });
}

// Some old clients probed this with GET to decide whether to show the gate.
export function GET() {
  return NextResponse.json(GONE, { status: 410 });
}
