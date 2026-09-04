'use client';

import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, RefreshCw, Check, AlertCircle, RotateCcw } from 'lucide-react';

// Scan a QR on the admin panel to install the latest ALIVE Store (Expo) build.
//
// The URL is resolved in this order:
//   1. The newest finished Android build on EAS, fetched from
//      /api/admin/store-app-build. This is the point — the card used to show
//      whatever link someone last pasted, so it went stale the moment a new
//      build shipped and nobody noticed.
//   2. NEXT_PUBLIC_EXPO_PREVIEW_URL, when EAS can't be reached or isn't
//      configured. A stale-but-working QR beats an empty card.
//   3. A per-reviewer override typed below, for a live `expo start` tunnel URL
//      that changes every session. Kept because those URLs can't come from EAS.
//
// The override wins while it is set, and says so, so nobody is left wondering
// why the card is not showing the build they just made.

const LS_KEY = 'alive_expo_preview_url';

type StoreAppBuild = {
  url: string | null;
  source: 'eas' | 'env' | 'none';
  version: string | null;
  buildNumber: string | null;
  profile: string | null;
  completedAt: string | null;
  error: string | null;
};

const timeSince = (iso: string | null) => {
  if (!iso) return null;
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600)  return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function AppPreviewCard() {
  const [build,    setBuild]    = useState<StoreAppBuild | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [override, setOverride] = useState('');
  const [draft,    setDraft]    = useState('');
  const [saved,    setSaved]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/store-app-build');
      setBuild(res.ok ? await res.json() as StoreAppBuild : null);
    } catch {
      setBuild(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY) ?? '';
    setOverride(stored);
    setDraft(stored);
    void load();
  }, [load]);

  const apply = () => {
    const next = draft.trim();
    setOverride(next);
    if (next) localStorage.setItem(LS_KEY, next);
    else localStorage.removeItem(LS_KEY);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const clearOverride = () => {
    localStorage.removeItem(LS_KEY);
    setOverride('');
    setDraft('');
  };

  const url = override || build?.url || '';

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-foreground">
          <Smartphone className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-none">Store app preview</p>
          <p className="text-[11px] text-muted-foreground mt-1">Scan to install the latest ALIVE Store build on your phone</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          title="Check EAS for a newer build"
          className="ml-auto flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3${loading ? ' animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-5">
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-xl border border-border bg-white p-3">
            {url ? (
              <QRCodeSVG value={url} size={148} level="M" />
            ) : (
              <div className="flex h-[148px] w-[148px] items-center justify-center text-center text-[11px] text-muted-foreground px-3">
                {loading ? 'Looking for the latest build…' : 'No build found — paste a URL below'}
              </div>
            )}
          </div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="text-[11px] font-mono text-muted-foreground hover:text-primary truncate max-w-[160px]" title={url}>
              {url}
            </a>
          )}
        </div>

        <div className="flex-1 space-y-3">
          {/* What is actually on screen, and where it came from. */}
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            {override ? (
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-foreground">Your pasted URL</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Overriding the latest build. Only you see this — it is stored in this browser.
                  </p>
                </div>
                <button
                  onClick={clearOverride}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <RotateCcw className="h-3 w-3" /> Use latest
                </button>
              </div>
            ) : build?.source === 'eas' ? (
              <>
                <p className="text-[11px] font-bold text-foreground">
                  Latest EAS build
                  {build.version && <span className="ml-1 font-mono font-normal">v{build.version}</span>}
                  {build.buildNumber && <span className="ml-1 font-mono font-normal text-muted-foreground">({build.buildNumber})</span>}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {build.profile && <span className="font-mono">{build.profile}</span>}
                  {build.profile && build.completedAt && ' · '}
                  {timeSince(build.completedAt) && `built ${timeSince(build.completedAt)}`}
                </p>
              </>
            ) : (
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-foreground">
                    {build?.source === 'env' ? 'Showing the configured URL' : 'No build available'}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {build?.error ?? 'Could not reach EAS.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Override URL</label>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Only needed for a live <code className="font-mono">expo start</code> tunnel, which changes each session — released
              builds arrive here on their own.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') apply(); }}
              placeholder="exp://… or https://expo.dev/…"
              className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button onClick={apply}
              className="h-9 px-3 rounded-lg bg-primary text-xs font-bold text-white transition-all hover:bg-primary/90 flex items-center gap-1.5 shrink-0">
              {saved ? <Check className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {saved ? 'Saved' : 'Apply'}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Needs the <span className="font-semibold">Expo Go</span> app for dev URLs; an EAS install link opens in a browser.
            Set <code className="font-mono">EXPO_TOKEN</code> in Vercel to let this card read builds from EAS directly.
          </p>
        </div>
      </div>
    </div>
  );
}
