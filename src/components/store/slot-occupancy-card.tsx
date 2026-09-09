'use client';

// Store-partner view of today's ad loop: every position, what is playing in it and
// why, a per-brand rollup, and which brands run elsewhere in the network but not
// here yet — so the partner can ask their Account Manager to bring them over.

import { useEffect, useState } from 'react';
import { Tv2, Sparkles, Film, ImageIcon } from 'lucide-react';

type LoopEntry = {
  position:    number;
  spanSlots:   number;
  source:      'sold' | 'bonus' | 'filler';
  campaignId:  string;
  brandName:   string | null;
  contentName: string | null;
  contentUrl:  string | null;
  contentType: 'image' | 'video' | null;
};

type OccupancyResponse = {
  slotMode: boolean;
  loopSlotCount?: number;
  filledCount?: number;
  openSlots?: number;
  houseSlots?: number;
  loop?: LoopEntry[];
  onScreen?: { campaignId: string; brandName: string; slots: number; guaranteed: number }[];
  missingBrands?: { campaignId: string; brandName: string; storeCount: number }[];
};

// Why a position is playing what it is. Sold is the paid, guaranteed case; bonus is
// a position nobody bought, replayed for a paying brand; house is ALIVE's own reel.
const SOURCE = {
  sold:   { label: 'Booked', pill: 'bg-primary/15 border-primary/40' },
  bonus:  { label: 'Bonus',  pill: 'bg-amber-500/15 border-amber-500/40' },
  filler: { label: 'House',  pill: 'bg-muted border-border' },
} as const;

export default function SlotOccupancyCard({ storeId, token }: { storeId: string; token?: string }) {
  const [data, setData] = useState<OccupancyResponse | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/stores/slot-occupancy?storeId=${storeId}`, {
      headers: token ? { 'x-store-token': token } : undefined,
    })
      .then((r) => r.ok ? r.json() as Promise<OccupancyResponse> : null)
      .then((d) => { if (live && d) setData(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [storeId, token]);

  if (!data?.slotMode) return null;

  const { loopSlotCount = 0, filledCount = 0, houseSlots = 0 } = data;
  const loop     = Array.isArray(data.loop) ? data.loop : [];
  const onScreen = Array.isArray(data.onScreen) ? data.onScreen : [];
  const missing  = Array.isArray(data.missingBrands) ? data.missingBrands : [];
  const pct = loopSlotCount > 0 ? Math.round((filledCount / loopSlotCount) * 100) : 0;

  // Expand spans across the positions they cover, so the strip is one cell per
  // 10s position and a 30s ad reads as the three slots it actually occupies.
  const cells: (LoopEntry | null)[] = Array.from({ length: loopSlotCount }, () => null);
  for (const e of loop) {
    for (let i = 0; i < e.spanSlots; i++) {
      if (e.position + i < loopSlotCount) cells[e.position + i] = e;
    }
  }

  const sel = selected == null ? null : cells[selected];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <Tv2 className="h-4 w-4 text-muted-foreground" /> Your ad loop
        </p>
        <span className="text-sm font-black text-foreground">{filledCount}<span className="text-muted-foreground font-normal">/{loopSlotCount}</span></span>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {filledCount} of {loopSlotCount} slots booked{filledCount < loopSlotCount ? ` — ${loopSlotCount - filledCount} open` : ' — fully booked'}
        {houseSlots > 0 ? `, ${houseSlots} playing ALIVE house content` : ''}.
      </p>

      {/* The loop itself — one cell per 10s position, in play order. */}
      {cells.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {cells.map((e, pos) => (
              <button
                key={pos}
                onClick={() => setSelected(selected === pos ? null : pos)}
                title={e ? `#${pos + 1} · ${e.brandName ?? 'ALIVE house'} — ${SOURCE[e.source].label}` : `#${pos + 1} · nothing playing`}
                aria-label={`Slot ${pos + 1}, ${e ? `${e.brandName ?? 'ALIVE house'}, ${SOURCE[e.source].label}` : 'empty'}`}
                className={`h-6 w-6 rounded border text-[9px] font-bold tabular-nums text-foreground/70 transition-transform hover:-translate-y-0.5 ${
                  e ? SOURCE[e.source].pill : 'bg-transparent border-dashed border-border'
                } ${selected === pos ? 'ring-2 ring-foreground ring-offset-1 ring-offset-card' : ''}`}
              >
                {pos + 1}
              </button>
            ))}
          </div>

          {sel ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                {sel.contentType === 'image' && sel.contentUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={sel.contentUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                  : sel.contentType === 'video'
                    ? <Film className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-foreground">{sel.brandName ?? 'ALIVE house content'}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  Slot #{sel.position + 1}{sel.spanSlots > 1 ? `–#${sel.position + sel.spanSlots}` : ''} · {sel.contentName ?? 'no creative'}
                </span>
              </span>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {SOURCE[sel.source].label}
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/70">Tap a slot to see what plays there.</p>
          )}
        </div>
      )}

      {/* Per-brand rollup — the thing a partner actually reads. */}
      {onScreen.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">On your screen today</p>
          <div className="space-y-1.5">
            {onScreen.map((b) => (
              <div key={b.campaignId} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-medium text-foreground">{b.brandName}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {b.slots} slot{b.slots === 1 ? '' : 's'}
                  {b.guaranteed < b.slots ? ` · ${b.slots - b.guaranteed} bonus` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Brands not on your screen yet
          </p>
          <div className="space-y-1.5">
            {missing.slice(0, 5).map((b) => (
              <div key={b.campaignId} className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-foreground">{b.brandName}</span>
                <span className="text-muted-foreground">at {b.storeCount} other store{b.storeCount === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Ask your Account Manager to bring these brands to your screen.</p>
        </div>
      )}
    </div>
  );
}
