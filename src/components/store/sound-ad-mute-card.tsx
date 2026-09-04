'use client';

// Store-partner mute override for the Sound Ad add-on: at most one campaign's slot
// plays with audio once/hour (never looped, base ads always stay silent). Muting
// here forces it silent too — the brand isn't refunded, but the store owner always
// has the last word on what makes noise in their shop.

import { useEffect, useState } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';

export default function SoundAdMuteCard({ storeId, token }: { storeId: string; token?: string }) {
  const [muted, setMuted] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/stores/sound-ad-mute?storeId=${storeId}`, {
      headers: token ? { 'x-store-token': token } : undefined,
    })
      .then((r) => r.ok ? r.json() as Promise<{ muted: boolean }> : null)
      .then((d) => { if (live && d) setMuted(d.muted); })
      .catch(() => {});
    return () => { live = false; };
  }, [storeId, token]);

  if (muted === null) return null;

  async function toggle() {
    const next = !muted;
    setSaving(true);
    try {
      const res = await fetch('/api/stores/sound-ad-mute', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-store-token': token } : {}) },
        body: JSON.stringify({ storeId, muted: next }),
      });
      if (res.ok) setMuted(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
            {muted ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4 text-muted-foreground" />}
            Sound Ad
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            If a brand has a Sound Ad on your screen, it plays with audio once an hour — never looped.
          </p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className={`w-full rounded-lg border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
          muted ? 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
        }`}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : muted ? 'Unmute Sound Ad' : 'Mute Sound Ad'}
      </button>
      {muted && (
        <p className="text-[10px] text-muted-foreground">Muted — your screen stays silent, same as all your other ads. This doesn&apos;t affect any brand&apos;s billing.</p>
      )}
    </div>
  );
}
