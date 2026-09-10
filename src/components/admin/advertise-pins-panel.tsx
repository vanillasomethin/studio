'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, MapPin, RefreshCw } from 'lucide-react';
import { adminGetObject } from '@/lib/admin-fetch';

type PinStatus = 'matched' | 'no-store' | 'no-pin' | 'bad-pin' | 'rejected';

type PinRow = {
  id: string;
  name: string;
  tier: string;
  status: PinStatus;
  storeName: string | null;
};

// Each gap gets the sentence that tells ops what to actually do about it —
// "unmatched" on its own would just move the puzzle somewhere else.
const GAP: Record<Exclude<PinStatus, 'matched'>, { label: string; fix: string }> = {
  'no-store': {
    label: 'Not registered',
    fix: 'No partner registered under this name. Register the shop, or rename the existing row to match.',
  },
  'no-pin': {
    label: 'No map pin',
    fix: 'Registered, but nobody has dropped a pin. Set it in Edit → Map pin below.',
  },
  'bad-pin': {
    label: 'Pin is invalid',
    fix: 'The stored coordinate is 0,0 or out of range. Re-drop the pin in Edit → Map pin below.',
  },
  rejected: {
    label: 'Store rejected',
    fix: 'The only matching partner was rejected — this shop probably should not be on sale.',
  },
};

export default function AdvertisePinsPanel() {
  const [rows, setRows] = useState<PinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const body = await adminGetObject<{ stores: PinRow[] }>('/api/admin/advertise-pins');
      setRows(Array.isArray(body?.stores) ? body.stores : []);
    } catch (e) {
      if ((e as Error).name !== 'AdminAuthError') setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Nothing to say yet, and a spinner above the store list would just be noise.
  if (loading || failed || rows.length === 0) return null;

  const gaps = rows.filter(r => r.status !== 'matched');
  const matched = rows.length - gaps.length;
  const allReal = gaps.length === 0;

  return (
    <div
      className="rounded-2xl border bg-card"
      style={{ borderColor: allReal ? 'hsl(var(--border))' : 'rgb(253 230 138)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        disabled={allReal}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors enabled:hover:bg-neutral-50 disabled:cursor-default"
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            allReal ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {allReal ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">
            {allReal
              ? `All ${rows.length} advertiser map pins are real`
              : `${gaps.length} of ${rows.length} advertiser map pins are approximate`}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {allReal
              ? 'Every store on /advertise is drawn at its surveyed location.'
              : `${matched} drawn at their surveyed location. The rest sit on a rough fallback until a real pin exists.`}
          </span>
        </span>

        {!allReal && (
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform${open ? ' rotate-180' : ''}`} />
        )}
      </button>

      {open && !allReal && (
        <ul className="border-t border-border">
          {gaps.map(row => {
            const meta = GAP[row.status as Exclude<PinStatus, 'matched'>];
            return (
              <li key={row.id} className="flex items-start gap-3 border-b border-border p-4 last:border-b-0">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">
                    {row.name}
                    <span className="ml-2 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                      {meta?.label}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{meta?.fix}</p>
                  {row.storeName && row.storeName !== row.name && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Matched partner row: <span className="font-semibold text-foreground">{row.storeName}</span>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
          <li className="flex items-center justify-between gap-3 p-3">
            <span className="text-xs text-muted-foreground">
              Pins are matched to /advertise by shop name, ignoring case and punctuation.
            </span>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Re-check
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
