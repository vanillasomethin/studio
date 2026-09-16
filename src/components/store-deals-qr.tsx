'use client';

// A store's own QR code — scan it (or click through from the homepage) and a
// shopper lands on /deals/[storeId]: this store's offers, plus what ALIVE is.
// Deterministic from the store id (no per-store "generate" step), so every
// store — existing or freshly onboarded — already has a working one.
//
// Same render-as-SVG-then-rasterise-on-demand pattern as Admin -> QR codes'
// QrCodeBlock, so a print shop gets a crisp code at any size either way.

import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';

export function dealsUrl(storeId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://wearealive.in';
  return `${origin}/deals/${storeId}`;
}

export function StoreDealsQr({ storeId, storeName, size = 120 }: { storeId: string; storeName: string; size?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const url = dealsUrl(storeId);

  const downloadPng = () => {
    const svg = wrapRef.current?.querySelector('svg');
    if (!svg) return;
    setBusy(true);

    const SIZE = 1024;
    const xml  = new XMLSerializer().serializeToString(svg);
    const img  = new window.Image();
    img.src = `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(xml)))}`;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { setBusy(false); return; }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `alive-deals-qr-${storeName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      a.click();
      setBusy(false);
    };
    img.onerror = () => setBusy(false);
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div ref={wrapRef} className="rounded-lg border border-border bg-white p-2">
        <QRCodeSVG value={url} size={size} level="M" marginSize={0} />
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
