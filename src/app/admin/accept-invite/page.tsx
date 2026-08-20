'use client';

// Where an invited admin sets their first password. The invite token in the URL
// is the only credential — the API consumes it and signs the person straight in.

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/icons/logo';

const MIN_PASSWORD = 10;

function AcceptInvite() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  const [who,     setWho]     = useState<{ name: string; email: string; team: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pw,      setPw]      = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setErr('This link is missing its invite token.'); setLoading(false); return; }
    fetch(`/api/admin/accept-invite?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error ?? 'This invite link is no longer valid.');
        setWho(b);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== confirm) { setErr('Passwords do not match.'); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/admin/accept-invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error ?? 'Could not set your password.');
      sessionStorage.setItem('alive_admin', '1');
      router.push('/admin');
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <a href="/" className="mb-8 inline-block hover:opacity-80 transition-opacity"><Logo /></a>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">Admin invite</p>
          {loading ? (
            <h1 className="text-3xl font-bold text-foreground">Checking your link…</h1>
          ) : who ? (
            <>
              <h1 className="text-3xl font-bold text-foreground">Welcome, {who.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Set a password for {who.email}.</p>
            </>
          ) : (
            <h1 className="text-3xl font-bold text-foreground">Link not valid</h1>
          )}
        </div>

        {err && !who && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{err}</p>
        )}

        {who && (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password" required autoFocus value={pw} onChange={(e) => setPw(e.target.value)}
              placeholder={`New password (min ${MIN_PASSWORD} characters)`} autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password" autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-border bg-card px-4 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {err && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{err}</p>}
            <button
              type="submit" disabled={busy || pw.length < MIN_PASSWORD}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set password and sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvite />
    </Suspense>
  );
}
