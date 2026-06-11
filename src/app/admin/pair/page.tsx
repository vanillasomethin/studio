'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle, Tv2 } from 'lucide-react';
import { Logo } from '@/components/icons/logo';

const SS_AUTH = 'alive_admin';
const SS_PW   = 'alive_admin_pw';

function PairInner() {
  const params = useSearchParams();
  const code   = (params.get('code') ?? '').trim().toUpperCase();

  const [authed,  setAuthed]  = useState(false);
  const [pw,      setPw]      = useState('');
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [status, setStatus] = useState<'idle' | 'pairing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ name: string } | null>(null);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(SS_AUTH) === '1') setAuthed(true);
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true); setAuthErr(null);
    try {
      const res  = await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      const body = await res.json() as { ok: boolean };
      if (body.ok) {
        sessionStorage.setItem(SS_AUTH, '1');
        sessionStorage.setItem(SS_PW, pw);
        setAuthed(true);
      } else {
        setAuthErr('Incorrect password.');
      }
    } catch {
      setAuthErr('Failed to verify.');
    } finally {
      setAuthBusy(false);
    }
  };

  useEffect(() => {
    if (!authed || !code || status !== 'idle') return;
    if (code.length !== 6) { setStatus('error'); setError('Invalid pairing code in QR link.'); return; }

    setStatus('pairing');
    const apiPw = sessionStorage.getItem(SS_PW) ?? '';
    fetch('/api/admin/confirm-pairing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'admin-password': apiPw },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        const body = await res.json() as { device?: { id: string; name: string }; error?: string };
        if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
        setResult({ name: body.device!.name });
        setStatus('done');
      })
      .catch((e: Error) => { setError(e.message); setStatus('error'); });
  }, [authed, code, status]);

  if (!authed) {
    return (
      <div className="w-full max-w-sm space-y-6">
        <div>
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity inline-block mb-8"><Logo /></a>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-1">Admin</p>
          <h1 className="text-3xl font-bold text-foreground">Connect this screen</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to pair the screen you just scanned.</p>
        </div>
        <form onSubmit={login} className="space-y-3">
          <input type="password" required autoFocus value={pw} onChange={(e) => setPw(e.target.value)}
            placeholder="Admin password"
            className="w-full h-12 rounded-xl border border-border bg-card px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
          {authErr && <p className="text-xs text-red-500">{authErr}</p>}
          <button type="submit" disabled={authBusy}
            className="w-full h-12 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {authBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
          </button>
        </form>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="w-full max-w-sm space-y-4 text-center">
        <Tv2 className="h-10 w-10 text-muted-foreground mx-auto" />
        <h1 className="text-xl font-bold text-foreground">No pairing code found</h1>
        <p className="text-sm text-muted-foreground">This link is missing a screen code. Scan the QR shown on the TV again, or enter the code manually from the Screens tab.</p>
        <a href="/admin?tab=screens" className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors">Go to Screens</a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      {status === 'pairing' && (
        <>
          <Loader2 className="h-10 w-10 text-primary mx-auto animate-spin" />
          <h1 className="text-xl font-bold text-foreground">Connecting screen…</h1>
          <p className="text-sm text-muted-foreground">Code <span className="font-mono font-bold text-foreground">{code}</span></p>
        </>
      )}
      {status === 'done' && result && (
        <>
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">{result.name} added to fleet</h1>
          <p className="text-sm text-muted-foreground">The screen is now connected. Assign a store and schedule to go live.</p>
          <a href="/admin?tab=screens" className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors">Go to Screens</a>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Couldn&apos;t connect this screen</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a href="/admin?tab=screens" className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90 transition-colors">Go to Screens</a>
        </>
      )}
    </div>
  );
}

export default function PairScreenPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Suspense fallback={<Loader2 className="h-6 w-6 text-primary animate-spin" />}>
        <PairInner />
      </Suspense>
    </div>
  );
}
