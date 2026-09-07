'use client';

// The partner's monthly statement: what ALIVE owes them this month, and why.
//
// Three terms, in the order a shopkeeper cares about them — the rupee total
// first, the derivation underneath:
//   • a guaranteed monthly base for hosting the screen
//   • an incentive for the brands that ran on it
//   • the electricity the screen actually drew, reimbursed
//
// The figures come from /api/stores/payout-statement, which is the SAME
// computation the admin pays from. That is the point: the number here and the
// number ops transfers are one number. The dashboard used to compute its own
// rupee figure locally while the payment row said something else.

import { useEffect, useState } from 'react';
import { Zap, Gauge, IndianRupee, Store } from 'lucide-react';

type Breakdown = {
  month: string;
  mode: 'slot' | 'flat';
  tier: string;
  daysInMonth: number;
  liveDays: number;
  basePaise: number;
  brandsPlayed: number;
  avgFilledSlots: number;
  incentivePaise: number;
  kwh: number;
  kwhSource: 'metered' | 'estimated';
  usingDefaultWatts: boolean;
  paisePerKwh: number;
  electricityPaise: number;
  totalPaise: number;
};

type StatementResponse = {
  month: string;
  settled: boolean;
  breakdown: Breakdown;
  payment: { status: string; amountPaise: number; paidAt: string | null; payRef: string | null } | null;
};

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export default function PayoutStatementCard({ storeId, token }: { storeId: string; token?: string }) {
  const [data, setData] = useState<StatementResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    // The signed token is required whenever there's no next-auth cookie — right
    // after registration, and in admin open-as-partner.
    fetch(`/api/stores/payout-statement?storeId=${storeId}`, {
      headers: token ? { 'x-store-token': token } : undefined,
    })
      .then((r) => (r.ok ? (r.json() as Promise<StatementResponse>) : null))
      .then((d) => { if (live) { if (d) setData(d); else setFailed(true); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [storeId, token]);

  if (failed || !data?.breakdown) return null;

  const b = data.breakdown;
  const paid = data.payment?.status === 'paid';
  const partial = b.liveDays > 0 && b.liveDays < b.daysInMonth;

  const terms = [
    {
      label: b.mode === 'slot' ? 'Screen hosting' : 'Monthly amount',
      value: b.basePaise,
      hint: partial ? `${b.liveDays} of ${b.daysInMonth} days` : 'guaranteed every month',
    },
    {
      label: 'Brands on your screen',
      value: b.incentivePaise,
      // Brand COUNT only — never the per-slot average. shared/agreement-terms.ts
      // states the incentive formula is deliberately withheld from partners
      // ("not the network's per-slot economics"), and printing an avg-slots
      // figure next to the rupee amount hands them the rate by division.
      hint: b.brandsPlayed === 0
        ? 'no ads booked yet'
        : `${b.brandsPlayed} brand${b.brandsPlayed === 1 ? '' : 's'} ran this month`,
    },
    {
      label: 'Electricity',
      value: b.electricityPaise,
      hint: `${b.kwh.toFixed(1)} units @ ₹${(b.paisePerKwh / 100).toFixed(2)}`,
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <IndianRupee className="h-3.5 w-3.5 text-primary" />
            {monthLabel(b.month)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {paid
              ? `Paid${data.payment?.paidAt ? ` on ${new Date(data.payment.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}`
              : 'Running total — final once the month closes'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-black text-foreground leading-none">
            {rupees(paid && data.payment ? data.payment.amountPaise : b.totalPaise)}
          </p>
          <span
            className={`inline-block mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              paid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {paid ? 'Paid' : 'Estimate'}
          </span>
        </div>
      </div>

      {/* The derivation */}
      <div className="divide-y divide-border/60 border-t border-border pt-1">
        {terms.map((t) => (
          <div key={t.label} className="flex items-baseline justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">{t.label}</p>
              <p className="text-[10px] text-muted-foreground">{t.hint}</p>
            </div>
            <p className="text-sm font-bold text-foreground shrink-0">{rupees(t.value)}</p>
          </div>
        ))}
      </div>

      {/* Where the electricity number came from. A metered figure is evidence
          from the socket; an estimate is arithmetic on assumptions, and the
          partner is entitled to know which one they are being paid on. */}
      <div
        className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[10px] ${
          b.kwhSource === 'metered' ? 'bg-green-50 text-green-800' : 'bg-muted text-muted-foreground'
        }`}
      >
        {b.kwhSource === 'metered'
          ? <Zap className="h-3 w-3 mt-px shrink-0" />
          : <Gauge className="h-3 w-3 mt-px shrink-0" />}
        <p>
          {b.kwhSource === 'metered'
            ? 'Electricity measured at your smart plug — this is your screen’s real consumption.'
            : b.usingDefaultWatts
              ? 'Electricity estimated from typical screen wattage × hours played. Once we fit a smart plug, you’re paid on the meter.'
              : 'Electricity estimated from your screen’s rated wattage × hours played. Once we fit a smart plug, you’re paid on the meter.'}
        </p>
      </div>

      {b.mode === 'slot' && b.brandsPlayed > 0 && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <Store className="h-3 w-3" />
          The more brands book your screen, the more you earn.
        </p>
      )}
    </div>
  );
}
