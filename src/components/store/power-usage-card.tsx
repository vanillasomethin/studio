'use client';

// Electricity usage card on the partner store dashboard. Renders nothing until
// the admin has linked an Aziot smart plug to this store — partners without a
// metered plug never see an empty shell. Data is the partner-safe summary from
// /api/stores/power (no cloud device ids, no admin fields).

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { storeFetch } from '@/lib/store-fetch';

type PowerSummary = {
  linked: boolean;
  online?: boolean | null;
  powerW?: number | null;
  todayKwh?: number;
  monthKwh?: number;
  estMonthCostPaise?: number;
  lastPolledAt?: string | null;
};

export default function PowerUsageCard({ storeId }: { storeId?: string }) {
  const [data, setData] = useState<PowerSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qs = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
    storeFetch(`/api/stores/power${qs}`)
      .then(async (r) => (r.ok ? (await r.json()) as PowerSummary : null))
      .then((body) => { if (!cancelled && body?.linked) setData(body); })
      .catch(() => { /* card simply doesn't render */ });
    return () => { cancelled = true; };
  }, [storeId]);

  if (!data) return null;

  const updatedMins = data.lastPolledAt
    ? Math.max(0, Math.round((Date.now() - new Date(data.lastPolledAt).getTime()) / 60000))
    : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Zap className="h-4 w-4 text-primary" /> Electricity usage
        </h2>
        <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${data.online ? 'text-green-700' : 'text-muted-foreground'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${data.online ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
          {data.online ? 'Screen plug is on' : 'Plug offline'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center">
          <p className="text-base font-bold text-foreground">
            {data.online && data.powerW != null ? Math.round(data.powerW) : '—'}
            <span className="text-[10px] font-semibold text-muted-foreground"> W</span>
          </p>
          <p className="text-[10px] text-muted-foreground">Right now</p>
        </div>
        <div className="rounded-xl bg-muted/40 px-3 py-2.5 text-center">
          <p className="text-base font-bold text-foreground">{(data.todayKwh ?? 0).toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">Units today</p>
        </div>
        <div className="rounded-xl bg-green-50 px-3 py-2.5 text-center">
          <p className="text-base font-bold text-green-700">{(data.monthKwh ?? 0).toFixed(2)}</p>
          <p className="text-[10px] text-green-700/70">Units this month</p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Your ALIVE screen has used <span className="font-semibold text-foreground">{(data.monthKwh ?? 0).toFixed(2)} units
        (≈ ₹{Math.round((data.estMonthCostPaise ?? 0) / 100).toLocaleString('en-IN')})</span> this month.
        Electricity is reimbursed separately from your ₹500 remuneration.
        {updatedMins != null && <span className="text-muted-foreground/60"> Updated {updatedMins < 1 ? 'just now' : `${updatedMins} min ago`}.</span>}
      </p>
    </div>
  );
}
