'use client';

// /admin/setup?token=… — where an invited colleague sets their own password.
//
// The token is validated on load so an expired or already-used link says so
// immediately, rather than after the person has picked a password and typed it
// twice. On success we do NOT sign them in: they go through the normal admin
// door, which forces 2FA enrolment.

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Mirrors MIN_PASSWORD_LENGTH in src/lib/admin-invite.ts (server-enforced there;
// this copy exists only for instant feedback — a client component cannot import
// that module because it pulls in Prisma). Keep the two in step.
const MIN_LEN = 8;

type Check =
  | { state: 'loading' }
  | { state: 'ok';      email: string; role: string }
  | { state: 'bad';     reason: 'invalid' | 'expired' | 'used' };

const BAD_COPY: Record<'invalid' | 'expired' | 'used', string> = {
  invalid: 'This invitation link isn’t valid. It may have been mistyped or replaced by a newer invitation.',
  expired: 'This invitation has expired. Invitations last 48 hours — ask for a fresh one.',
  used:    'This invitation has already been used. If that wasn’t you, tell hello@wearealive.in straight away.',
};

function SetupForm() {
  const token = useSearchParams().get('token') ?? '';

  const [check,   setCheck]   = useState<Check>({ state: 'loading' });
  const [pw,      setPw]      = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [done,    setDone]    = useState(false);

  useEffect(() => {
    if (!token) { setCheck({ state: 'bad', reason: 'invalid' }); return; }
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch(`/api/invite/accept?token=${encodeURIComponent(token)}`);
        const data = await res.json() as
          | { ok: true; email: string; role: string }
          | { ok: false; reason: 'invalid' | 'expired' | 'used' };
        if (cancelled) return;
        setCheck(data.ok
          ? { state: 'ok',  email: data.email, role: data.role }
          : { state: 'bad', reason: data.reason });
      } catch {
        if (!cancelled) setCheck({ state: 'bad', reason: 'invalid' });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Checked here purely for a fast, friendly message — the server enforces
    // the same rules and is the thing that actually decides.
    if (pw.length < MIN_LEN)  { setError(`Password must be at least ${MIN_LEN} characters.`); return; }
    if (pw !== confirm)       { setError('The two passwords don’t match.'); return; }

    setSaving(true);
    try {
      const res  = await fetch('/api/invite/accept', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password: pw }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not set your password.');
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [token, pw, confirm]);

  if (check.state === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your invitation…
      </div>
    );
  }

  if (check.state === 'bad') {
    return (
      <div className="rounded-lg border border-border bg-white p-6">
        <div className="mb-3 flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
          <h1 className="text-lg font-black tracking-tight">Invitation unavailable</h1>
        </div>
        <p className="text-sm leading-relaxed text-gray-700">{BAD_COPY[check.reason]}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-white p-6">
        <div className="mb-3 flex items-center gap-2 text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          <h1 className="text-lg font-black tracking-tight">Password set</h1>
        </div>
        <p className="mb-5 text-sm leading-relaxed text-gray-700">
          Your account <strong>{check.email}</strong> is ready. Sign in next — you’ll be
          asked to set up two-factor authentication, which is required before you can
          use the console.
        </p>
        <a
          href="/admin"
          className="inline-block rounded-md bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800"
        >
          Go to sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-white p-6">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-red-700" />
        <h1 className="text-lg font-black tracking-tight">Set your password</h1>
      </div>
      <p className="mb-5 text-sm text-gray-600">
        For <strong>{check.email}</strong> · {check.role}
      </p>

      <label className="mb-1 block text-sm font-medium text-gray-800" htmlFor="pw">
        New password
      </label>
      <input
        id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)}
        autoComplete="new-password" autoFocus
        className="mb-1 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-red-700"
      />
      <p className="mb-4 text-xs text-gray-500">
        At least {MIN_LEN} characters. This account can control every screen on the
        network, so use something you don’t use anywhere else — a password manager
        is strongly preferred.
      </p>

      <label className="mb-1 block text-sm font-medium text-gray-800" htmlFor="confirm">
        Confirm password
      </label>
      <input
        id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        className="mb-4 w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-red-700"
      />

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit" disabled={saving}
        className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {saving ? 'Setting password…' : 'Set password'}
      </button>
    </form>
  );
}

export default function AdminSetupPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto w-full max-w-md">
        <p className="mb-6 text-sm font-semibold tracking-tight text-gray-500">ALIVE admin</p>
        {/* useSearchParams needs a Suspense boundary in the App Router. */}
        <Suspense fallback={<div className="text-sm text-gray-600">Loading…</div>}>
          <SetupForm />
        </Suspense>
      </div>
    </main>
  );
}
