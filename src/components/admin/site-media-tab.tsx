'use client';
import { useState, useEffect, useRef } from 'react';
import { Upload, RotateCcw, Link } from 'lucide-react';

const MEDIA_SLOTS = [
  { key: 'hero-brand',      label: 'Hero — Brands',              hint: '/for-brands.jpg' },
  { key: 'hero-kirana',     label: 'Hero — Kiranas',             hint: '/kirana-best-practice.jpg' },
  { key: 'hero-consumer',   label: 'Hero — Consumers',           hint: '/india-street.jpg' },
  { key: 'product-shot',    label: 'Product shot',                hint: '/alive-product-shot.png' },
  { key: 'kirana-shop',     label: 'Audience card — Kiranas',     hint: '/kirana-shop.jpg' },
  { key: 'vessel-brand',    label: 'Audience card — Brands',      hint: '/for-brands.jpg' },
  { key: 'vessel-consumer', label: 'Audience card — Consumers',   hint: '/india-street.jpg' },
  { key: 'testimonial-kirana', label: 'Testimonial — Kirana Owner', hint: '/kirana-best-practice.jpg' },
  { key: 'store-shelf',     label: 'Testimonial — Brand Manager', hint: '/store-shelf.jpg' },
  { key: 'store-aisle',     label: 'Testimonial — Shopper',       hint: '/store-aisle.jpg' },
  { key: 'alive-after',     label: 'Testimonial — Field Lead',    hint: '/alive-after.png' },
];

export default function SiteMediaTab({ adminPassword }: { adminPassword: string }) {
  const headers = { 'admin-password': adminPassword };
  const [media, setMedia] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlSlot, setUrlSlot] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotRef = useRef<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/site-media', { headers }).then(r => r.json()).then(setMedia).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPassword]);

  const saveUrl = async (slot: string, url: string) => {
    await fetch('/api/admin/site-media', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot, url }),
    });
    setMedia(m => ({ ...m, [slot]: url }));
  };

  // Server-side proxy upload — avoids CORS on direct R2 PUT
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const slot = activeSlotRef.current;
    if (!file || !slot) return;
    e.target.value = '';
    setError(null);
    setUploading(slot);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const key = `site-media/${slot}.${ext}`;

      const form = new FormData();
      form.append('file', file);
      form.append('key', key);

      const res = await fetch('/api/admin/r2-upload', {
        method: 'POST',
        headers: { 'admin-password': adminPassword },
        body: form,
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `Upload failed (${res.status})`);
      }

      const { publicUrl: cdnUrl } = await res.json() as { publicUrl: string };
      await saveUrl(slot, cdnUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(null);
      activeSlotRef.current = null;
    }
  };

  const handlePasteUrl = async () => {
    if (!urlSlot || !urlInput.trim()) return;
    await saveUrl(urlSlot, urlInput.trim());
    setUrlSlot(null);
    setUrlInput('');
  };

  const resetSlot = async (slot: string) => {
    await fetch('/api/admin/site-media', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot, url: '' }),
    });
    setMedia(m => { const n = { ...m }; delete n[slot]; return n; });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Upload a replacement image, GIF, or MP4 for each homepage slot. Files are uploaded server-side to Cloudflare R2. Changes reflect on the live homepage within 60 seconds. You can also paste a direct CDN/URL.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive flex justify-between items-start gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 font-bold">×</button>
        </div>
      )}

      {/* Paste URL panel */}
      {urlSlot && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold">Paste URL for: {MEDIA_SLOTS.find(s => s.key === urlSlot)?.label}</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://..."
              className="flex-1 rounded-lg border border-border px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button onClick={() => void handlePasteUrl()} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white">Set</button>
            <button onClick={() => { setUrlSlot(null); setUrlInput(''); }} className="rounded-lg border border-border px-3 py-2 text-xs">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {MEDIA_SLOTS.map(slot => {
          const currentUrl = media[slot.key];
          const isUploading = uploading === slot.key;
          const isVideo = currentUrl?.match(/\.mp4(\?|$)/);
          const isGif   = currentUrl?.match(/\.gif(\?|$)/);

          return (
            <div key={slot.key} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Thumbnail */}
              <div className="relative aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
                {currentUrl ? (
                  isVideo ? (
                    <video src={currentUrl} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUrl} alt={slot.label} className="w-full h-full object-cover" />
                  )
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slot.hint} alt={slot.label} className="w-full h-full object-cover" />
                )}
                <span className={`absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold ${
                  currentUrl ? 'bg-green-600 text-white' : 'bg-black/40 text-white/80'
                }`}>
                  {currentUrl ? 'custom' : 'default'}
                </span>
                {isUploading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <div className="text-xs text-muted-foreground animate-pulse">Uploading…</div>
                  </div>
                )}
                {(isGif || isVideo) && (
                  <span className="absolute top-2 right-2 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded font-mono uppercase">
                    {isVideo ? 'mp4' : 'gif'}
                  </span>
                )}
              </div>

              {/* Label + actions */}
              <div className="p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">{slot.label}</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => { activeSlotRef.current = slot.key; fileInputRef.current?.click(); }}
                    disabled={isUploading}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                  >
                    <Upload className="h-3 w-3" />
                    {currentUrl ? 'Replace' : 'Upload'}
                  </button>
                  <button
                    onClick={() => { setUrlSlot(slot.key); setUrlInput(''); }}
                    title="Paste URL"
                    className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Link className="h-3 w-3" />
                  </button>
                  {currentUrl && (
                    <button
                      onClick={() => resetSlot(slot.key)}
                      className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors"
                      title="Reset to default"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/mp4,.gif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
