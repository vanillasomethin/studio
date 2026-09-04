'use client';

// Store-partner view of the ALIVE screen we installed: what it is, and what it costs
// to run this month.
//
// Two data sources, one card. When an Aziot smart plug is linked to the store
// the figures are METERED at the socket (live watts, summed units) and badged
// so. Otherwise the card falls back to the proof-of-play ESTIMATE: on-hours
// come from the player's own play records, but the wattage and the tariff are
// assumptions (see lib/power.ts), so the card shows both inputs and the survey
// photos — the partner can check the figure against the label on their own TV
// and against their own bill.

import { useEffect, useState } from 'react';
import { Tv2, Zap, Camera, Info } from 'lucide-react';

type PowerResponse = {
  estimate: {
    onHours: number; units: number; costPaise: number;
    watts: number; paisePerKwh: number; usingDefaultWatts: boolean;
  };
  screen: {
    model: string | null; watts: number | null;
    platePhotoUrl: string | null; ratingPhotoUrl: string | null;
  };
  plug?: {
    linked: boolean;
    online?: boolean | null;
    powerW?: number | null;
    todayKwh?: number;
    monthKwh?: number;
    estMonthCostPaise?: number;
    lastPolledAt?: string | null;
  };
};

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function ScreenPowerCard({ storeId, token }: { storeId: string; token?: string }) {
  const [data, setData] = useState<PowerResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    // The signed token is required whenever there's no next-auth cookie —
    // right after registration, and in admin open-as-partner. Without it
    // resolveStoreId() rejects the explicit storeId and the card vanishes.
    fetch(`/api/stores/power?storeId=${storeId}`, {
      headers: token ? { 'x-store-token': token } : undefined,
    })
      .then((r) => r.ok ? r.json() as Promise<PowerResponse> : null)
      .then((d) => { if (live) { if (d) setData(d); else setFailed(true); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [storeId, token]);

  if (failed || !data) return null;

  const { estimate: e, screen } = data;
  const metered = data.plug?.linked ? data.plug : null;
  const photos = [
    { url: screen.platePhotoUrl,  label: 'TV model' },
    { url: screen.ratingPhotoUrl, label: 'Power rating' },
  ].filter((p) => p.url);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Tv2 className="h-4 w-4 text-muted-foreground" /> Your ALIVE screen
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {screen.model ?? 'Model not recorded yet'}
            {screen.watts ? ` · ${screen.watts}W` : ''}
          </p>
        </div>
        {metered ? (
          <span className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700 shrink-0">
            <span className={`h-1.5 w-1.5 rounded-full ${metered.online ? 'bg-green-500 animate-pulse' : 'bg-green-700/30'}`} />
            Metered
          </span>
        ) : (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
            Estimated
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {(metered
          ? [
              { label: 'Drawing now', value: metered.online && metered.powerW != null ? `${Math.round(metered.powerW)} W` : '—' },
              { label: 'Units used', value: (metered.monthKwh ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 1 }) },
              { label: 'Electricity', value: rupees(metered.estMonthCostPaise ?? 0), accent: true },
            ]
          : [
              { label: 'Hours run', value: e.onHours.toLocaleString('en-IN', { maximumFractionDigits: 0 }) },
              { label: 'Units used', value: e.units.toLocaleString('en-IN', { maximumFractionDigits: 1 }) },
              { label: 'Electricity', value: rupees(e.costPaise), accent: true },
            ]
        ).map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/30 p-2.5">
            <p className={`text-base font-black ${s.accent ? 'text-primary' : 'text-foreground'}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <p className="flex gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
        <Info className="h-3 w-3 shrink-0 mt-0.5" />
        {metered ? (
          <span>
            Measured this month by the smart plug at your screen&apos;s socket
            ({(metered.todayKwh ?? 0).toFixed(2)} units today), at ₹{(e.paisePerKwh / 100).toFixed(2)} per unit.
            Electricity is reimbursed separately, as per your agreement.
          </span>
        ) : (
          <span>
            This month so far, from the screen&apos;s own play records: {e.onHours.toFixed(0)} hours
            × {e.watts}W at ₹{(e.paisePerKwh / 100).toFixed(2)} per unit.
            {e.usingDefaultWatts
              ? ' The wattage is a typical figure — we will update it when we record your TV’s rating.'
              : ' The wattage is from the rating label on your TV.'}
            {' '}Electricity is reimbursed separately, as per your agreement.
          </span>
        )}
      </p>

      {photos.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
            <Camera className="h-3 w-3" /> Recorded at install
          </p>
          <div className="flex gap-2">
            {photos.map((p) => (
              <a key={p.label} href={p.url!} target="_blank" rel="noopener noreferrer" className="group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url!} alt={p.label} className="h-16 w-24 rounded-lg border border-border object-cover" />
                <span className="mt-1 block text-[9px] text-muted-foreground group-hover:text-foreground">{p.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* The wattage-assumption warning only matters while the figure is an
          estimate — a metered card doesn't use the rated watts at all. */}
      {!screen.watts && !metered && (
        <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-700">
          <Zap className="h-3 w-3 shrink-0" />
          We haven&apos;t recorded your TV&apos;s power rating yet, so this uses a typical value.
        </p>
      )}
    </div>
  );
}
