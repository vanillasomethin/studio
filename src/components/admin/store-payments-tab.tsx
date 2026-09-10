'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle2, Clock, XCircle, ChevronDown, ChevronRight, Loader2, X, Zap, Gauge } from 'lucide-react';

type StorePayment = {
  id: string; storeId: string; month: string; amountPaise: number;
  status: string; paidAt: string | null; paidBy: string | null; payRef: string | null; note: string | null;
  store: { storeName: string; ownerName: string; whatsapp: string; city: string | null; upiId: string | null; payoutMethod: string | null; liveAt: string | null };
};

type StoreSummary = {
  id: string; storeName: string; ownerName: string; whatsapp: string; city: string | null;
  liveAt: string | null; agreedAt: string | null; payoutStatus: string;
  upiId: string | null; payoutMethod: string | null;
};

// Mirrors PayoutBreakdown in src/lib/store-payout.ts — the server is the only
// thing that computes money here; this tab renders what it is told.
type PayoutBreakdown = {
  month: string; storeId: string; mode: 'slot' | 'flat'; tier: string;
  daysInMonth: number; liveDays: number;
  basePaise: number; brandsPlayed: number; filledSlotDays: number; avgFilledSlots: number;
  incentivePaise: number;
  kwh: number; kwhSource: 'metered' | 'estimated'; usingDefaultWatts: boolean;
  paisePerKwh: number; electricityPaise: number; totalPaise: number;
};

type PreviewStore = {
  id: string; loopSlotCount: number | null;
  breakdown: PayoutBreakdown | null; settled: boolean;
};

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

/** Current IST month as YYYY-MM. */
function istMonthNow(): string {
  return new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 7);
}

/** The last `n` months, newest first, ending at the current IST month. */
function recentMonths(n: number): string[] {
  const [y, m] = istMonthNow().split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const total = y * 12 + (m - 1) - i;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
}

function monthsFrom(liveAt: string | null, agreedAt: string | null): string[] {
  const startStr = liveAt ?? agreedAt;
  if (!startStr) return [];
  const start = new Date(startStr);
  const result: string[] = [];
  const now = new Date();
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cur <= end) {
    result.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return result;
}

function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export default function StorePaymentsTab({ adminPassword }: { adminPassword: string }) {
  const headers = { 'Content-Type': 'application/json', 'admin-password': adminPassword };
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [payments, setPayments] = useState<StorePayment[]>([]);
  const [month, setMonth] = useState(istMonthNow());
  const [preview, setPreview] = useState<PreviewStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [markModal, setMarkModal] = useState<{ storeId: string; month: string; storeName: string } | null>(null);
  const [markForm, setMarkForm] = useState({ payRef: '', note: '', paidAt: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState<string | null>(null); // `${storeId}-${month}` while payout in flight
  const [upiModal, setUpiModal] = useState<{ store: StoreSummary; month: string } | null>(null);
  const [utrInput, setUtrInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [liveAtModal, setLiveAtModal] = useState<{ storeId: string; storeName: string; current: string | null } | null>(null);
  const [liveAtDate, setLiveAtDate] = useState('');
  const [savingLiveAt, setSavingLiveAt] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [storesRes, paymentsRes, previewRes] = await Promise.all([
        fetch('/api/stores/save', { headers }),
        fetch('/api/admin/store-payments', { headers }),
        fetch(`/api/admin/store-payments/preview?month=${month}`, { headers }),
      ]);
      const storesEnv = await storesRes.json() as { data?: StoreSummary[] } | StoreSummary[];
      const storeData = (storesEnv as { data?: StoreSummary[] }).data ?? storesEnv;
      setStores(Array.isArray(storeData) ? storeData : []);
      const payData = await paymentsRes.json() as StorePayment[] | unknown;
      setPayments(Array.isArray(payData) ? payData as StorePayment[] : []);
      const prevData = await previewRes.json() as { stores?: PreviewStore[] };
      setPreview(Array.isArray(prevData?.stores) ? prevData.stores : []);
    } finally {
      setLoading(false);
    }
  }, [adminPassword, month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const markPaid = async () => {
    if (!markModal) return;
    setSaving(true);
    try {
      await fetch('/api/admin/store-payments', {
        method: 'POST',
        headers,
        body: JSON.stringify({ storeId: markModal.storeId, month: markModal.month, status: 'paid', payRef: markForm.payRef, note: markForm.note, paidAt: markForm.paidAt }),
      });
      setMarkModal(null);
      await load();
    } finally { setSaving(false); }
  };

  const markStatus = async (storeId: string, month: string, status: 'pending' | 'skipped') => {
    await fetch('/api/admin/store-payments', {
      method: 'POST', headers,
      body: JSON.stringify({ storeId, month, status }),
    });
    await load();
  };

  const saveLiveAt = async () => {
    if (!liveAtModal) return;
    setSavingLiveAt(true);
    try {
      await fetch(`/api/admin/stores/${liveAtModal.storeId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ liveAt: liveAtDate || null }),
      });
      setLiveAtModal(null);
      await load();
    } finally { setSavingLiveAt(false); }
  };

  // The amount the pay dialog will request. Resolved when the dialog opens:
  // a settled month uses what was paid, the selected month is already in
  // `preview`, and any OTHER month has to be fetched — without this the QR
  // carried ₹0 for every month except the one on screen.
  const [modalPaise, setModalPaise] = useState<number | null>(null);

  const openUpiModal = async (store: StoreSummary, mo: string) => {
    setUpiModal({ store, month: mo });
    setUtrInput('');
    setNoteInput('');

    const settledAmt = payments.find(p => p.storeId === store.id && p.month === mo)?.amountPaise;
    if (settledAmt != null) { setModalPaise(settledAmt); return; }
    const known = mo === month ? byStore.get(store.id)?.breakdown?.totalPaise : undefined;
    if (known != null) { setModalPaise(known); return; }

    setModalPaise(null); // dialog shows "working out the amount…" until this lands
    try {
      const res = await fetch(`/api/admin/store-payments/preview?month=${mo}&storeId=${store.id}`, { headers });
      const data = await res.json() as { stores?: PreviewStore[] };
      setModalPaise(data.stores?.[0]?.breakdown?.totalPaise ?? 0);
    } catch {
      setModalPaise(0);
    }
  };

  const confirmPayment = async () => {
    if (!upiModal) return;
    setConfirming(true);
    const key = `${upiModal.store.id}-${upiModal.month}`;
    setPaying(key);
    try {
      const res = await fetch('/api/admin/payout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          storeId: upiModal.store.id,
          month: upiModal.month,
          mode: 'upi',
          payRef: utrInput || undefined,
          note: noteInput || undefined,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        alert(`Payout failed: ${data.error ?? 'Unknown error'}`);
        return;
      }
      setUpiModal(null);
      await load();
    } finally {
      setConfirming(false);
      setPaying(null);
    }
  };

  const filtered = stores.filter(s =>
    !search || (s.storeName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.ownerName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const byStore = useMemo(() => new Map(preview.map(p => [p.id, p])), [preview]);

  // Stats are scoped to the SELECTED month — "total due" is the sum of what each
  // unpaid store is actually owed, not a count times a flat ₹500 (which was
  // wrong for every tier store, every premium store, and ignored electricity).
  const monthPayments = payments.filter(p => p.month === month);
  const paidCount = monthPayments.filter(p => p.status === 'paid').length;
  const unpaid = preview.filter(p => {
    const row = monthPayments.find(mp => mp.storeId === p.id);
    return !row || row.status === 'pending';
  });
  const pendingCount = unpaid.length;
  const totalDuePaise = unpaid.reduce((sum, p) => sum + (p.breakdown?.totalPaise ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Month scope — everything below is this month */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {recentMonths(12).map(m => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              m === month
                ? 'bg-primary text-white'
                : 'border border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {fmtMonth(m)}
          </button>
        ))}
      </div>

      {/* Summary stats — for the selected month */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: `Paid · ${fmtMonth(month)}`, value: paidCount, color: 'text-green-600' },
          { label: 'Awaiting payment', value: pendingCount, color: 'text-amber-600' },
          { label: 'Total due', value: rupees(totalDuePaise), color: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className={`text-base font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search stores…"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(store => {
            const months = monthsFrom(store.liveAt, store.agreedAt);
            const isExpanded = expanded === store.id;
            const storePayments = payments.filter(p => p.storeId === store.id);
            const pendingMonths = months.filter(m => {
              const p = storePayments.find(sp => sp.month === m);
              return !p || p.status === 'pending';
            });
            const paidMonths = storePayments.filter(p => p.status === 'paid').length;
            const bd = byStore.get(store.id)?.breakdown ?? null;
            const monthRow = storePayments.find(p => p.month === month);
            const monthPaid = monthRow?.status === 'paid';
            // What was actually paid wins over any recomputation. Rows written
            // before the breakdown existed carry only an amount, so the strip
            // would otherwise show today's computed figure next to a "paid"
            // badge for a month that was settled at a different number.
            const shownPaise = monthRow?.amountPaise ?? bd?.totalPaise ?? 0;

            return (
              <div key={store.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Store header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : store.id)}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{store.storeName}</p>
                    <p className="text-[10px] text-muted-foreground">{store.ownerName} · {store.city ?? '—'}</p>
                  </div>
                  {/* Live date button */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setLiveAtModal({ storeId: store.id, storeName: store.storeName, current: store.liveAt });
                      setLiveAtDate(store.liveAt ? store.liveAt.slice(0, 10) : '');
                    }}
                    className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted/50 transition-colors shrink-0"
                  >
                    {store.liveAt ? `Live: ${new Date(store.liveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}` : 'Set live date'}
                  </button>
                  {/* Summary badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {paidMonths > 0 && <span className="text-[10px] bg-green-500/10 text-green-600 rounded px-1.5 py-0.5">{paidMonths} paid</span>}
                    {pendingMonths.length > 0 && <span className="text-[10px] bg-amber-500/10 text-amber-600 rounded px-1.5 py-0.5">{pendingMonths.length} pending</span>}
                    {months.length === 0 && <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">no live date</span>}
                  </div>
                </div>

                {/* What this shop is owed for the selected month, and why.
                    The total is the server's — nothing here recomputes money. */}
                {bd && (
                  <div className="border-t border-border px-4 py-3 flex items-center gap-4 flex-wrap">
                    <div className="shrink-0">
                      <p className="text-lg font-black text-foreground leading-none">{rupees(shownPaise)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {monthPaid ? 'paid' : 'due'} · {fmtMonth(month)}
                        {bd.liveDays < bd.daysInMonth && ` · ${bd.liveDays}/${bd.daysInMonth} days live`}
                      </p>
                    </div>

                    {/* The three terms, so an operator never has to ask where the number came from */}
                    <div className="flex items-center gap-3 text-[10px]">
                      {[
                        { label: bd.mode === 'slot' ? `${bd.tier} base` : 'monthly', value: bd.basePaise ?? 0 },
                        { label: 'ad incentive', value: bd.incentivePaise ?? 0 },
                        { label: 'electricity', value: bd.electricityPaise ?? 0 },
                      ].map(t => (
                        <div key={t.label}>
                          <p className="font-bold text-foreground">{rupees(t.value)}</p>
                          <p className="text-muted-foreground">{t.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Occupancy as shape, not a number: how full this loop ran */}
                    {bd.mode === 'slot' && (
                      <div className="flex items-center gap-1.5">
                        <div className="flex gap-[2px]">
                          {Array.from({ length: Math.min(byStore.get(store.id)?.loopSlotCount ?? 30, 30) }, (_, i) => (
                            <span
                              key={i}
                              className={`h-3 w-[3px] rounded-full ${
                                i < Math.round(bd.avgFilledSlots) ? 'bg-primary' : 'bg-muted'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {bd.brandsPlayed} brand{bd.brandsPlayed === 1 ? '' : 's'}
                        </span>
                      </div>
                    )}

                    {/* Measured beats estimated — one is evidence, the other a guess */}
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        bd.kwhSource === 'metered'
                          ? 'bg-green-500/10 text-green-700'
                          : 'bg-muted text-muted-foreground'
                      }`}
                      title={bd.kwhSource === 'metered'
                        ? 'Measured by this store’s smart plug'
                        : 'Estimated from screen wattage × playback hours — no plug linked'}
                    >
                      {bd.kwhSource === 'metered' ? <Zap className="h-2.5 w-2.5" /> : <Gauge className="h-2.5 w-2.5" />}
                      {(bd.kwh ?? 0).toFixed(1)} kWh {bd.kwhSource}
                    </span>

                    {/* Pay this one shop — the shop-wise action */}
                    <div className="ml-auto shrink-0">
                      {monthPaid ? (
                        <span className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-600 font-semibold">Paid ✓</span>
                      ) : !store.upiId && !store.payoutMethod ? (
                        <span className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground italic">Add payout details</span>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); void openUpiModal(store, month); }}
                          disabled={paying === `${store.id}-${month}`}
                          className="text-[11px] px-3 py-1.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1"
                        >
                          {paying === `${store.id}-${month}`
                            ? <><Loader2 className="h-3 w-3 animate-spin" />Paying…</>
                            : `Pay ${rupees(shownPaise)}`}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Expanded month list */}
                {isExpanded && months.length > 0 && (
                  <div className="border-t border-border divide-y divide-border/50">
                    {/* Payout info */}
                    <div className="px-4 py-2 bg-muted/20 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>Payout: {store.payoutMethod ?? 'not set'}</span>
                      {store.upiId && <span>UPI: {store.upiId}</span>}
                      <span>+91 {store.whatsapp}</span>
                    </div>
                    {/* `mo` deliberately, not `month` — the outer state holds the
                        selected month and shadowing it here silently paid the
                        wrong month. */}
                    {months.map(mo => {
                      const payment = storePayments.find(p => p.month === mo);
                      const status = payment?.status ?? 'pending';
                      const isSelected = mo === month;
                      return (
                        <div key={mo} className={`flex items-center gap-3 px-4 py-2.5 ${isSelected ? 'bg-primary/5' : ''}`}>
                          {/* Status icon */}
                          {status === 'paid' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                          {status === 'pending' && <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          {status === 'skipped' && <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          {/* Month */}
                          <span className="text-xs font-medium text-foreground flex-1">{fmtMonth(mo)}</span>
                          {/* A settled row shows what was PAID; the selected open
                              month shows the computed figure. Other open months
                              are not computed here — one preview fetch, one month. */}
                          <span className="text-xs text-muted-foreground">
                            {payment ? rupees(payment.amountPaise ?? 0)
                              : isSelected && bd ? rupees(bd.totalPaise ?? 0)
                              : '—'}
                          </span>
                          {/* Payment details */}
                          {status === 'paid' && payment?.paidAt && (
                            <span className="text-[10px] text-green-600">
                              {new Date(payment.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              {payment.payRef && ` · ${payment.payRef}`}
                            </span>
                          )}
                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Pay Now button */}
                            {status === 'paid' ? (
                              <span className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-600 font-semibold">Paid ✓</span>
                            ) : !store.upiId && !store.payoutMethod ? (
                              <span className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground italic">Setup payout details first</span>
                            ) : (
                              <button
                                onClick={() => void openUpiModal(store, mo)}
                                disabled={paying === `${store.id}-${mo}`}
                                className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-semibold flex items-center gap-1 disabled:opacity-60"
                              >
                                {paying === `${store.id}-${mo}`
                                  ? <><Loader2 className="h-2.5 w-2.5 animate-spin" />Paying…</>
                                  : isSelected && bd ? `Pay ${rupees(bd.totalPaise ?? 0)}` : 'Pay'
                                }
                              </button>
                            )}
                            {status !== 'paid' && (
                              <button
                                onClick={() => {
                                  setMarkModal({ storeId: store.id, month: mo, storeName: store.storeName });
                                  setMarkForm({ payRef: '', note: '', paidAt: new Date().toISOString().slice(0, 10) });
                                }}
                                className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors font-semibold"
                              >Mark paid</button>
                            )}
                            {status !== 'skipped' && (
                              <button
                                onClick={() => void markStatus(store.id, mo, 'skipped')}
                                className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                              >Skip</button>
                            )}
                            {status === 'skipped' && (
                              <button
                                onClick={() => void markStatus(store.id, mo, 'pending')}
                                className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                              >Unmark</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {isExpanded && months.length === 0 && (
                  <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                    Set a live date to start tracking payments for this store.
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-8">No stores found.</p>
          )}
        </div>
      )}

      {/* UPI Payment Modal */}
      {upiModal && (() => {
        const { store, month: payMonth } = upiModal;
        const hasUpi = !!store.upiId;
        // The QR must carry the real amount. `am=500` sent every partner a ₹500
        // request regardless of tier, incentive or electricity — the operator
        // scanned it and underpaid without ever seeing a wrong number.
        const owedPaise = modalPaise ?? 0;
        const resolving = modalPaise == null;
        const amountRupees = (owedPaise / 100).toFixed(2);
        const upiLink = hasUpi && !resolving
          ? `upi://pay?pa=${encodeURIComponent(store.upiId!)}&pn=${encodeURIComponent(store.ownerName)}&am=${amountRupees}&tn=${encodeURIComponent('ALIVE ' + fmtMonth(payMonth))}&cu=INR`
          : '';
        // Only once the amount is known — a QR built on an empty deep link
        // would scan into a blank or ₹0 request.
        const qrUrl = upiLink
          ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiLink)}`
          : '';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-card rounded-2xl border border-border w-full max-w-md mx-auto shadow-xl">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-border">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {resolving ? `Pay ${store.storeName}` : `Pay ${rupees(owedPaise)} to ${store.storeName}`}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {fmtMonth(payMonth)}
                    {store.upiId ? ` · UPI to ${store.upiId}` : ' · No UPI on file'}
                  </p>
                </div>
                <button
                  onClick={() => setUpiModal(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted/60 transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                {hasUpi ? (
                  /* QR + bank transfer side by side */
                  <div className="grid grid-cols-2 gap-3">
                    {/* QR column */}
                    <div className="rounded-xl border border-border bg-background p-3 flex flex-col items-center gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">UPI QR Code</p>
                      {resolving ? (
                        <div className="h-[160px] w-[160px] rounded-lg border border-border flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={qrUrl}
                          alt="UPI QR code"
                          width={160}
                          height={160}
                          className="rounded-lg border border-border"
                        />
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {resolving ? 'Working out the amount…' : 'Scan to pay'}
                      </p>
                      <a
                        href={upiLink}
                        target="_blank"
                        rel="noreferrer"
                        aria-disabled={resolving}
                        className={`w-full text-center rounded-lg bg-primary/10 text-primary px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                          resolving ? 'pointer-events-none opacity-50' : 'hover:bg-primary/20'
                        }`}
                      >
                        Open UPI App ↗
                      </a>
                    </div>

                    {/* Bank transfer info column */}
                    <div className="rounded-xl border border-border bg-background p-3 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Bank Transfer</p>
                      {[
                        { label: 'Name', value: store.ownerName },
                        { label: 'UPI', value: store.upiId! },
                        { label: 'Amount', value: resolving ? 'working it out…' : `₹${amountRupees}` },
                        { label: 'Note', value: `ALIVE ${fmtMonth(payMonth)}` },
                      ].map(r => (
                        <div key={r.label}>
                          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-widest">{r.label}</p>
                          <p className="text-xs text-foreground font-medium break-all">{r.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* No UPI fallback */
                  <div className="rounded-xl border border-border bg-amber-50 p-4 text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">No UPI ID on file</p>
                    <p className="text-amber-700">Ask {store.ownerName} to add their UPI ID in the store dashboard for faster payments.</p>
                    {store.payoutMethod && <p className="text-amber-700/80">Configured method: {store.payoutMethod}</p>}
                  </div>
                )}

                {/* UTR input */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">After paying, enter reference</p>
                  <input
                    value={utrInput}
                    onChange={e => setUtrInput(e.target.value)}
                    placeholder="UTR / Transaction ID"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <input
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder="Note (optional)"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setUpiModal(null)}
                    className="flex-1 rounded-xl border border-border py-2.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void confirmPayment()}
                    disabled={confirming || resolving}
                    className="flex-1 rounded-xl bg-green-600 text-white py-2.5 text-xs font-bold hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                  >
                    {confirming ? (
                      <><Loader2 className="h-3 w-3 animate-spin" />Confirming…</>
                    ) : (
                      <><CheckCircle2 className="h-3.5 w-3.5" />Confirm Payment</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Mark Paid Modal */}
      {markModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm mx-4 space-y-4">
            <h3 className="text-sm font-bold">Mark payment as paid</h3>
            <p className="text-xs text-muted-foreground">{markModal.storeName} · {fmtMonth(markModal.month)}</p>
            <div className="space-y-2">
              <input value={markForm.paidAt} onChange={e => setMarkForm(f => ({ ...f, paidAt: e.target.value }))} type="date" className="w-full rounded-lg border border-border px-3 py-2 text-xs" placeholder="Payment date" />
              <input value={markForm.payRef} onChange={e => setMarkForm(f => ({ ...f, payRef: e.target.value }))} className="w-full rounded-lg border border-border px-3 py-2 text-xs" placeholder="UPI ref / transaction ID (optional)" />
              <input value={markForm.note} onChange={e => setMarkForm(f => ({ ...f, note: e.target.value }))} className="w-full rounded-lg border border-border px-3 py-2 text-xs" placeholder="Note (optional)" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMarkModal(null)} className="flex-1 rounded-xl border border-border py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
              <button onClick={() => void markPaid()} disabled={saving} className="flex-1 rounded-xl bg-green-600 text-white py-2 text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
                {saving ? 'Saving…' : 'Confirm paid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Live Date Modal */}
      {liveAtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm mx-4 space-y-4">
            <h3 className="text-sm font-bold">Set live date</h3>
            <p className="text-xs text-muted-foreground">{liveAtModal.storeName}</p>
            <p className="text-xs text-muted-foreground">This is the date the store went live. Payment tracking starts from this month.</p>
            <input value={liveAtDate} onChange={e => setLiveAtDate(e.target.value)} type="date" className="w-full rounded-lg border border-border px-3 py-2 text-xs" />
            <div className="flex gap-2">
              <button onClick={() => setLiveAtModal(null)} className="flex-1 rounded-xl border border-border py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
              <button onClick={() => void saveLiveAt()} disabled={savingLiveAt} className="flex-1 rounded-xl bg-primary text-white py-2 text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                {savingLiveAt ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
