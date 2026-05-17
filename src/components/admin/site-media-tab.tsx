'use client';
import { useState, useEffect, useRef } from 'react';
import { Upload, RotateCcw } from 'lucide-react';

const MEDIA_SLOTS = [
  { key: 'hero-brand',    label: 'Hero — Brands',     hint: '/for-brands.jpg' },
  { key: 'hero-kirana',   label: 'Hero — Kiranas',    hint: '/kirana-best-practice.jpg' },
  { key: 'hero-consumer', label: 'Hero — Consumers',  hint: '/india-street.jpg' },
  { key: 'product-shot',  label: 'Product shot',       hint: '/alive-product-shot.png' },
  { key: 'kirana-shop',   label: 'Kirana shop',        hint: '/kirana-shop.jpg' },
  { key: 'india-shop',    label: 'India shop',         hint: '/india-shop.jpg' },
  { key: 'store-shelf',   label: 'Store shelf',        hint: '/store-shelf.jpg' },
  { key: 'store-aisle',   label: 'Store aisle',        hint: '/store-aisle.jpg' },
  { key: 'alive-after',   label: 'After — Alive',      hint: '/alive-after.png' },
];

export default function SiteMediaTab({ adminPassword }: { adminPassword: string }) {
  const headers = { 'admin-password': adminPassword };
  const [media, setMedia] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotRef = useRef<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/site-media', { headers }).then(r => r.json()).then(setMedia).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPassword]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const slot = activeSlotRef.current;
    if (!file || !slot) return;
    e.target.value = '';
    setError(null);
    setUploading(slot);

    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const key = `site-media/${slot}.${ext}`;
      const signRes = await fetch(
        `/api/admin/r2-upload?key=${encodeURIComponent(key)}&type=${encodeURIComponent(file.type)}`,
        { headers },
      );
      if (!signRes.ok) throw new Error('Could not get upload URL');
      const { uploadUrl, publicUrl: cdnUrl } = await signRes.json() as { uploadUrl: string; publicUrl: string };

      const putRes = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);

      await fetch('/api/admin/site-media', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot, url: cdnUrl }),
      });

      setMedia(m => ({ ...m, [slot]: cdnUrl }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(null);
      activeSlotRef.current = null;
    }
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
          Upload a replacement image, GIF, or MP4 for each homepage slot. Files go to Cloudflare R2 and are served via CDN. Changes are reflected on the live homepage within 60 seconds.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">{error}</div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {MEDIA_SLOTS.map(slot => {
          const currentUrl = media[slot.key];
          const isUploading = uploading === slot.key;
          const isVideo = currentUrl?.endsWith('.mp4') || currentUrl?.includes('.mp4?');
          const isGif = currentUrl?.endsWith('.gif') || currentUrl?.includes('.gif?');

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
                  // Show the current default image from /public/
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slot.hint} alt={slot.label} className="w-full h-full object-cover" />
                )}
                {/* Status badge */}
                <span className={`absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded font-mono uppercase font-semibold ${
                  currentUrl ? 'bg-green-600 text-white' : 'bg-black/40 text-white/80'
                }`}>
                  {currentUrl ? 'custom' : 'default'}
                </span>
                {isUploading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <div className="text-xs text-muted-foreground">Uploading…</div>
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
        accept="image/*,video/mp4"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
