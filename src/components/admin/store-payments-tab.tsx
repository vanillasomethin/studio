'use client';
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Clock, XCircle, ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';

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
      const [storesRes, paymentsRes] = await Promise.all([
        fetch('/api/stores/save', { headers }),
        fetch('/api/admin/store-payments', { headers }),
      ]);
      const storesEnv = await storesRes.json() as { data?: StoreSummary[] } | StoreSummary[];
      const storeData = (storesEnv as { data?: StoreSummary[] }).data ?? storesEnv;
      setStores(Array.isArray(storeData) ? storeData : []);
      const payData = await paymentsRes.json() as StorePayment[] | unknown;
      setPayments(Array.isArray(payData) ? payData as StorePayment[] : []);
    } finally {
      setLoading(false);
    }
  }, [adminPassword]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const openUpiModal = (store: StoreSummary, month: string) => {
    setUpiModal({ store, month });
    setUtrInput('');
    setNoteInput('');
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
    !search || s.storeName.toLowerCase().includes(search.toLowerCase()) ||
    (s.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
    s.ownerName.toLowerCase().includes(search.toLowerCase())
  );

  // Count summary stats
  const allMonths = stores.flatMap(s => monthsFrom(s.liveAt, s.agreedAt).map(m => ({ storeId: s.id, month: m })));
  const paidCount = payments.filter(p => p.status === 'paid').length;
  const pendingCount = allMonths.filter(({ storeId, month }) => {
    const found = payments.find(p => p.storeId === storeId && p.month === month);
    return !found || found.status === 'pending';
  }).length;
  const totalDue = pendingCount * 500;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Paid months', value: paidCount, color: 'text-green-600' },
          { label: 'Pending months', value: pendingCount, color: 'text-amber-600' },
          { label: 'Total due', value: `₹${totalDue.toLocaleString('en-IN')}`, color: 'text-primary' },
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

                {/* Expanded month list */}
                {isExpanded && months.length > 0 && (
                  <div className="border-t border-border divide-y divide-border/50">
                    {/* Payout info */}
                    <div className="px-4 py-2 bg-muted/20 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>Payout: {store.payoutMethod ?? 'not set'}</span>
                      {store.upiId && <span>UPI: {store.upiId}</span>}
                      <span>+91 {store.whatsapp}</span>
                    </div>
                    {months.map(month => {
                      const payment = storePayments.find(p => p.month === month);
                      const status = payment?.status ?? 'pending';
                      return (
                        <div key={month} className="flex items-center gap-3 px-4 py-2.5">
                          {/* Status icon */}
                          {status === 'paid' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                          {status === 'pending' && <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          {status === 'skipped' && <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          {/* Month */}
                          <span className="text-xs font-medium text-foreground flex-1">{fmtMonth(month)}</span>
                          {/* Amount */}
                          <span className="text-xs text-muted-foreground">₹{((payment?.amountPaise ?? 50000) / 100).toLocaleString('en-IN')}</span>
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
                                onClick={() => openUpiModal(store, month)}
                                disabled={paying === `${store.id}-${month}`}
                                className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-semibold flex items-center gap-1 disabled:opacity-60"
                              >
                                {paying === `${store.id}-${month}`
                                  ? <><Loader2 className="h-2.5 w-2.5 animate-spin" />Paying…</>
                                  : `Pay ₹${Math.round((payment?.amountPaise ?? 50000) / 100).toLocaleString('en-IN')}`
                                }
                              </button>
                            )}
                            {status !== 'paid' && (
                              <button
                                onClick={() => {
                                  setMarkModal({ storeId: store.id, month, storeName: store.storeName });
                                  setMarkForm({ payRef: '', note: '', paidAt: new Date().toISOString().slice(0, 10) });
                                }}
                                className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors font-semibold"
                              >Mark paid</button>
                            )}
                            {status !== 'skipped' && (
                              <button
                                onClick={() => void markStatus(store.id, month, 'skipped')}
                                className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                              >Skip</button>
                            )}
                            {status === 'skipped' && (
                              <button
                                onClick={() => void markStatus(store.id, month, 'pending')}
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
        const { store, month } = upiModal;
        const hasUpi = !!store.upiId;
        const upiLink = hasUpi
          ? `upi://pay?pa=${encodeURIComponent(store.upiId!)}&pn=${encodeURIComponent(store.ownerName)}&am=500&tn=${encodeURIComponent('ALIVE ' + fmtMonth(month))}&cu=INR`
          : '';
        const qrUrl = hasUpi
          ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiLink)}`
          : '';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-card rounded-2xl border border-border w-full max-w-md mx-auto shadow-xl">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-border">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Pay ₹500 to {store.storeName}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {fmtMonth(month)}
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrUrl}
                        alt="UPI QR code"
                        width={160}
                        height={160}
                        className="rounded-lg border border-border"
                      />
                      <p className="text-[10px] text-muted-foreground">Scan to pay</p>
                      <a
                        href={upiLink}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full text-center rounded-lg bg-primary/10 text-primary px-2 py-1.5 text-[10px] font-semibold hover:bg-primary/20 transition-colors"
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
                        { label: 'Amount', value: '₹500' },
                        { label: 'Note', value: `ALIVE ${fmtMonth(month)}` },
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
                    disabled={confirming}
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
