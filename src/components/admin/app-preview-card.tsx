'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, RefreshCw, Check } from 'lucide-react';

// Lets staff scan a QR on the admin panel to open the latest ALIVE Store
// (Expo) app preview on their phone for periodic review.
//
// The QR target is configurable so it stays useful across every Expo preview
// mode:
//   • Deployment-wide default — NEXT_PUBLIC_EXPO_PREVIEW_URL (set this to the
//     EAS internal-distribution build link for stable, review-at-intervals use)
//   • Per-reviewer override — pasted in the input below, persisted to
//     localStorage, for live `expo start` tunnel URLs that change each session.
const LS_KEY = 'alive_expo_preview_url';
const ENV_DEFAULT = process.env.NEXT_PUBLIC_EXPO_PREVIEW_URL ?? '';

export default function AppPreviewCard() {
  const [url, setUrl]       = useState(ENV_DEFAULT);
  const [draft, setDraft]   = useState('');
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    const initial = stored || ENV_DEFAULT;
    setUrl(initial);
    setDraft(initial);
  }, []);

  const apply = () => {
    const next = draft.trim();
    setUrl(next);
    if (next) localStorage.setItem(LS_KEY, next);
    else localStorage.removeItem(LS_KEY);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100 text-foreground">
          <Smartphone className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-bold text-foreground leading-none">Store app preview</p>
          <p className="text-[11px] text-muted-foreground mt-1">Scan to open the latest ALIVE Store build on your phone</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-5">
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-xl border border-border bg-white p-3">
            {url ? (
              <QRCodeSVG value={url} size={148} level="M" />
            ) : (
              <div className="flex h-[148px] w-[148px] items-center justify-center text-center text-[11px] text-muted-foreground px-3">
                Set a preview URL to generate the QR
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
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Preview URL</label>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              EAS build link (stable) or an <code className="font-mono">exp://</code> dev URL. Paste below to override the deployment default.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') apply(); }}
              placeholder="https://expo.dev/… or exp://…"
              className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button onClick={apply}
              className="h-9 px-3 rounded-lg bg-primary text-xs font-bold text-white transition-all hover:bg-primary/90 flex items-center gap-1.5 shrink-0">
              {saved ? <Check className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {saved ? 'Saved' : 'Update'}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Needs the <span className="font-semibold">Expo Go</span> app (dev URLs) or just a browser (EAS install links). Tip: set
            <code className="font-mono"> NEXT_PUBLIC_EXPO_PREVIEW_URL</code> in Vercel for a shared default across all admins.
          </p>
        </div>
      </div>
    </div>
  );
}
