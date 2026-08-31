'use client';

// Trackable QR codes: where each printed code points, and how often it is scanned.
//
// A scan is a person standing in a shop with their phone out, so the numbers here
// are the closest thing the network has to a direct footfall signal. Per the house
// UI rule, the daily series is a chart you can read at a glance rather than a
// column of numbers — a dead code and a busy one should be distinguishable without
// reading a single figure.

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AlertCircle, QrCode, Copy, CheckCircle2, ExternalLink, Download } from 'lucide-react';
import { adminGetObject } from '@/lib/admin-fetch';
import { Skeleton } from '@/components/ui/skeleton';

type QrDestinationStats = {
  id: string; slug: string; targetUrl: string; label: string | null;
  createdAt: string; totalScans: number; windowScans: number;
  lastScanAt: string | null;
  daily: { date: string; scans: number }[];
};

type QrResponse = {
  days: number;
  dates: string[];
  totals: { destinations: number; scans: number; windowScans: number };
  destinations: QrDestinationStats[];
};

const WINDOWS = [7, 30, 90];

const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]}`;
};

const timeSince = (iso: string | null) => {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)     return 'just now';
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/** Daily scans as bars — the shape of the week matters more than the digits. */
function ScanSparkline({ daily }: { daily: { date: string; scans: number }[] }) {
  const peak = Math.max(1, ...daily.map((d) => d.scans));
  return (
    <div className="flex h-12 items-end gap-[2px]" role="img"
      aria-label={`Daily scans, peak ${peak} on a single day`}>
      {daily.map((d) => (
        <div
          key={d.date}
          title={`${dayLabel(d.date)} · ${d.scans} scan${d.scans === 1 ? '' : 's'}`}
          className={`flex-1 rounded-t-sm transition-colors ${d.scans > 0 ? 'bg-primary/70 hover:bg-primary' : 'bg-muted'}`}
          style={{ height: d.scans > 0 ? `${Math.max(8, (d.scans / peak) * 100)}%` : '2px' }}
        />
      ))}
    </div>
  );
}

/**
 * The scannable code, plus a PNG export for whoever is doing the printing.
 *
 * Rendered as SVG so it stays crisp at any print size, then rasterised on demand
 * at a fixed 1024px — big enough for a poster, and produced in the browser so no
 * third-party QR service ever sees our URLs.
 */
function QrCodeBlock({ url, slug }: { url: string; slug: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const downloadPng = () => {
    const svg = wrapRef.current?.querySelector('svg');
    if (!svg) return;
    setBusy(true);

    const SIZE = 1024;
    const xml  = new XMLSerializer().serializeToString(svg);
    const img  = new window.Image();
    // Inline the SVG as a data URI: a blob: URL would taint the canvas in some
    // browsers and make toDataURL throw.
    img.src = `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(xml)))}`;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setBusy(false); return; }
      ctx.fillStyle = '#ffffff';               // quiet zone must be opaque for scanners
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `alive-qr-${slug}.png`;
      a.click();
      setBusy(false);
    };
    img.onerror = () => setBusy(false);
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div ref={wrapRef} className="rounded-lg border border-border bg-white p-2">
        {/* level M tolerates a bit of print smudging without needing a bigger code */}
        <QRCodeSVG value={url} size={104} level="M" marginSize={0} />
      </div>
      <button
        onClick={downloadPng}
        disabled={busy}
        className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
      >
        <Download className="h-3 w-3" /> {busy ? 'Saving…' : 'PNG'}
      </button>
    </div>
  );
}

export default function QrTab() {
  const [data,    setData]    = useState<QrResponse | null>(null);
  const [days,    setDays]    = useState(30);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminGetObject<QrResponse>(`/api/admin/qr?days=${days}`)
      .then((d) => { setData(d); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const scanUrl = (slug: string) =>
    `${typeof window !== 'undefined' ? window.location.origin : 'https://wearealive.in'}/r/${slug}`;

  const copy = (slug: string) => {
    navigator.clipboard.writeText(scanUrl(slug))
      .then(() => { setCopied(slug); setTimeout(() => setCopied(null), 2000); })
      .catch(() => {});
  };

  if (loading && !data) {
    return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>;
  }

  if (error) {
    return (
      <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-semibold text-foreground">Could not load QR scans</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const d = data!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">QR codes</p>
          <p className="text-[11px] text-muted-foreground">
            Every printed code points at <code className="font-mono">/r/&lt;slug&gt;</code>, so the destination can be
            changed after printing and each scan is counted.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                days === w
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Scans, all time', value: d.totals.scans },
          { label: `Scans, last ${d.days}d`, value: d.totals.windowScans },
          { label: 'QR codes', value: d.totals.destinations },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-3">
            <p className="text-lg font-bold text-foreground">{t.value.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>

      {d.destinations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 py-12 text-center">
          <QrCode className="mx-auto h-6 w-6 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No QR destinations yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {d.destinations.map((dest) => (
            <div key={dest.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <QrCodeBlock url={scanUrl(dest.slug)} slug={dest.slug} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">{dest.label || dest.slug}</p>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">/r/{dest.slug}</code>
                  </div>
                  <a
                    href={dest.targetUrl} target="_blank" rel="noreferrer"
                    className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate">{dest.targetUrl}</span>
                  </a>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{dest.totalScans.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-muted-foreground">all time · last {timeSince(dest.lastScanAt)}</p>
                  </div>
                  <button
                    onClick={() => copy(dest.slug)}
                    title="Copy the scan URL to encode in a QR"
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {copied === dest.slug ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                    {copied === dest.slug ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-baseline justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Daily scans</p>
                  <p className="text-[10px] text-muted-foreground">
                    {dest.windowScans.toLocaleString('en-IN')} in {d.days} days
                  </p>
                </div>
                <ScanSparkline daily={dest.daily} />
                <div className="mt-1 flex justify-between text-[9px] text-muted-foreground/60">
                  <span>{dayLabel(d.dates[0])}</span>
                  <span>{dayLabel(d.dates[d.dates.length - 1])}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
