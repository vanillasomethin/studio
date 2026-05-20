'use client';

import { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, AlertCircle, Clock, CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react';

// Digio SDK types — loaded via <script> tag
declare global {
  interface Window {
    Digio: new (options: {
      environment: 'sandbox' | 'production';
      callback: (r: { digio_doc_id?: string; error_code?: string; message?: string }) => void;
      logo?: string;
      is_iframe?: boolean;
      theme?: { primaryColor?: string };
    }) => {
      init: () => void;
      submit: (requestId: string, identifier: string, tokenId?: string) => void;
    };
  }
}

type KycSession = {
  kycId: string;
  customerIdentifier: string;
  tokenId: string | null;
  env: 'sandbox' | 'production';
};

const STATUS_COPY: Record<string, { label: string; color: string; desc: string }> = {
  not_started:    { label: 'Not started',     color: 'text-muted-foreground', desc: 'Complete Aadhaar eKYC to unlock payouts.' },
  pending:        { label: 'In progress',     color: 'text-amber-600',        desc: 'KYC session started. Continue below.' },
  review_pending: { label: 'Under review',    color: 'text-blue-600',         desc: 'Our team is reviewing your documents.' },
  approved:       { label: 'Verified ✓',      color: 'text-green-600',        desc: 'Your identity has been verified.' },
  failed:         { label: 'Failed — retry',  color: 'text-destructive',      desc: 'Verification failed. Please try again.' },
};

export default function KycTab() {
  const [status,     setStatus]     = useState<string>('not_started');
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [session,    setSession]    = useState<KycSession | null>(null);
  const [preparing,  setPreparing]  = useState(false);
  const [sdkLoaded,  setSdkLoaded]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [cbStatus,   setCbStatus]   = useState<'idle' | 'success' | 'error'>('idle');

  // Load current KYC status
  useEffect(() => {
    fetch('/api/stores/kyc')
      .then(r => r.ok ? r.json() : null)
      .then((d: { status: string; verifiedAt: string | null; configured: boolean } | null) => {
        if (d) { setStatus(d.status); setVerifiedAt(d.verifiedAt); setConfigured(d.configured); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load Digio SDK script when component mounts
  useEffect(() => {
    if (typeof window === 'undefined' || window.Digio) { setSdkLoaded(true); return; }
    const script = document.createElement('script');
    script.src    = 'https://ext-app.digio.in/sdk/v10/digio.js'; // sandbox; swap for production
    script.async  = true;
    script.onload = () => setSdkLoaded(true);
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch { /* already removed */ } };
  }, []);

  const prepareSession = async () => {
    setPreparing(true); setError(null); setSession(null); setCbStatus('idle');
    try {
      const res = await fetch('/api/stores/kyc', { method: 'POST' });
      const d   = await res.json() as { kycId?: string; customerIdentifier?: string; tokenId?: string | null; env?: string; error?: string };
      if (!res.ok) throw new Error(d.error ?? 'Failed to start KYC session');
      setSession({
        kycId:               d.kycId!,
        customerIdentifier:  d.customerIdentifier!,
        tokenId:             d.tokenId ?? null,
        env:                 (d.env === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
      });
      setStatus('pending');
    } catch (e) { setError((e as Error).message); }
    finally { setPreparing(false); }
  };

  // Must be called synchronously from button onClick — no await before new window.Digio(...)
  const launchDigio = () => {
    if (!session || !window.Digio) return;
    const digio = new window.Digio({
      environment: session.env,
      is_iframe:   false,
      logo:        '/favicon.ico',
      theme:       { primaryColor: '#ef4444' },
      callback:    (response) => {
        if (response.error_code) {
          setCbStatus('error');
          setError(`KYC failed: ${response.message ?? response.error_code}`);
        } else {
          setCbStatus('success');
          // Do not trust SDK alone — webhook will update DB. Show pending.
          setStatus('review_pending');
        }
        setSession(null);
      },
    });
    digio.init();
    digio.submit(session.kycId, session.customerIdentifier, session.tokenId ?? undefined);
  };

  const meta = STATUS_COPY[status] ?? STATUS_COPY.not_started;
  const canRetry = status === 'not_started' || status === 'failed';

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">

      {/* Status card */}
      <div className={`rounded-2xl border bg-card p-5 space-y-3 ${status === 'approved' ? 'border-green-300' : 'border-border'}`}>
        <div className="flex items-start gap-3">
          {status === 'approved'
            ? <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            : status === 'review_pending' || status === 'pending'
              ? <Clock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              : status === 'failed'
                ? <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                : <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          }
          <div>
            <p className={`text-sm font-bold ${meta.color}`}>{meta.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
            {verifiedAt && (
              <p className="text-[10px] text-green-600/70 mt-1">
                Verified on {new Date(verifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {!configured && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">eKYC is not configured on this server. Contact your ALIVE relationship manager.</p>
          </div>
        )}
      </div>

      {/* What is eKYC */}
      {status !== 'approved' && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-bold text-foreground">Why complete eKYC?</h2>
          <div className="space-y-2">
            {[
              "Verify your identity as required under ALIVE's partner agreement",
              'Unlock monthly payouts (ALIVE cannot transfer ₹500 without KYC)',
              'Aadhaar-based — takes less than 5 minutes on your phone',
              'Your data is encrypted and processed by Digio, an RBI-regulated entity',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      {configured && status !== 'approved' && (
        <div className="space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
              <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {cbStatus === 'success' && (
            <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50/60 px-3 py-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
              <p className="text-xs text-green-700">KYC submitted! Our team will verify and update your status shortly.</p>
            </div>
          )}

          {/* Step 1 — prepare session */}
          {!session && (canRetry || status === 'pending') && (
            <button
              onClick={prepareSession}
              disabled={preparing || !sdkLoaded}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-700 py-3.5 text-sm font-bold text-white shadow-[0_4px_16px_-4px_rgba(220,38,38,0.4)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {preparing
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing session…</>
                : !sdkLoaded
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
                  : <><ShieldCheck className="h-4 w-4" /> {status === 'pending' ? 'Resume Aadhaar eKYC' : 'Start Aadhaar eKYC'}</>
              }
            </button>
          )}

          {/* Step 2 — launch Digio widget (synchronous click required) */}
          {session && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <p className="text-xs text-foreground font-semibold">Session ready. Tap below to open the Aadhaar verification window.</p>
              <p className="text-[10px] text-muted-foreground/70">A popup will open — please allow popups for this site if prompted.</p>
              <button
                onClick={launchDigio}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
              >
                <ExternalLink className="h-4 w-4" /> Open verification window
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSession(null)}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Cancel
              </button>
            </div>
          )}

          <p className="text-[10px] text-center text-muted-foreground/50 leading-relaxed">
            Powered by Digio · Your Aadhaar data is processed securely and not stored by ALIVE.
          </p>
        </div>
      )}

    </div>
  );
}
