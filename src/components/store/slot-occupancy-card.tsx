'use client';

// Store-partner view of today's ad loop: how many slots are filled, and which brands
// are currently running elsewhere in the network but not yet on this screen — so the
// partner can ask their Account Manager to bring them here.

import { useEffect, useState } from 'react';
import { Tv2, Sparkles } from 'lucide-react';

type OccupancyResponse = {
  slotMode: boolean;
  loopSlotCount?: number;
  filledCount?: number;
  openSlots?: number;
  missingBrands?: { campaignId: string; brandName: string; storeCount: number }[];
};

export default function SlotOccupancyCard({ storeId, token }: { storeId: string; token?: string }) {
  const [data, setData] = useState<OccupancyResponse | null>(null);

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

  const { loopSlotCount = 0, filledCount = 0, missingBrands = [] } = data;
  const pct = loopSlotCount > 0 ? Math.round((filledCount / loopSlotCount) * 100) : 0;

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
      <p className="text-[11px] text-muted-foreground">{filledCount} of {loopSlotCount} slots filled today{filledCount < loopSlotCount ? ` — ${loopSlotCount - filledCount} open` : ' — fully booked'}.</p>

      {missingBrands.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Brands not on your screen yet
          </p>
          <div className="space-y-1.5">
            {missingBrands.slice(0, 5).map((b) => (
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
