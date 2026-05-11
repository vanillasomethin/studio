'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Store, Calendar, CreditCard } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type BillData = {
  id:          string;
  billRef:     string;
  storeName:   string;
  totalAmount: number;
  payMethod:   string;
  status:      string;
  customerId:  string | null;
  createdAt:   string;
};

type BillItem = {
  id:    string;
  name:  string;
  qty:   number;
  unit:  string;
  price: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
}

const PAY_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card', khata: 'Khata',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillReceiptPage({
  params,
}: {
  params: Promise<{ billRef: string }>;
}) {
  const [billRef, setBillRef] = useState('');
  const [bill,    setBill]    = useState<BillData | null>(null);
  const [items,   setItems]   = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Claim form
  const [name,      setName]      = useState('');
  const [phone,     setPhone]     = useState('');
  const [claiming,  setClaiming]  = useState(false);
  const [claimed,   setClaimed]   = useState(false);
  const [claimErr,  setClaimErr]  = useState<string | null>(null);

  useEffect(() => {
    params.then(({ billRef: ref }) => {
      setBillRef(ref);
      fetch(`/api/bills/${ref}`)
        .then((r) => {
          if (r.status === 404) { setNotFound(true); return null; }
          return r.json() as Promise<{ bill: BillData; items: BillItem[] }>;
        })
        .then((data) => {
          if (data) { setBill(data.bill); setItems(data.items); }
        })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false));
    });
  }, [params]);

  // Check if already claimed via localStorage
  useEffect(() => {
    if (!bill) return;
    try {
      const saved = localStorage.getItem('alive_customer');
      if (saved) {
        const c = JSON.parse(saved) as { phone: string };
        // Mark claimed state if this customer already claimed any bill
        if (bill.customerId) setClaimed(true);
        setPhone(c.phone);
      }
    } catch {}
  }, [bill]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.length !== 10) return;
    setClaiming(true);
    setClaimErr(null);
    try {
      const res = await fetch(`/api/bills/${billRef}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `+91${phone}`, name }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Failed to save');
      }
      const data = await res.json() as { token: string; name: string; phone: string };
      localStorage.setItem('alive_customer', JSON.stringify({ phone: data.phone, name: data.name, token: data.token }));
      setClaimed(true);
    } catch (err) {
      setClaimErr((err as Error).message);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (notFound || !bill) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center gap-3">
        <p className="text-2xl font-bold text-gray-800">Bill not found</p>
        <p className="text-sm text-gray-500">This receipt link may have expired or the bill was not saved yet.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-sm space-y-4">

        {/* Store header */}
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-200">
              <Store className="h-6 w-6 text-red-500" />
            </div>
          </div>
          <h1 className="text-xl font-black text-gray-900">{bill.storeName}</h1>
          <p className="text-xs font-mono font-bold text-gray-400 tracking-widest">{bill.billRef}</p>
        </div>

        {/* Receipt card */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">

          {/* Meta */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              {fmtDate(bill.createdAt)}
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-600">
              <CreditCard className="h-3 w-3" />
              {PAY_LABELS[bill.payMethod] ?? bill.payMethod}
            </span>
          </div>

          {/* Items */}
          <div className="divide-y divide-gray-50">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-2 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.qty} × {item.unit} @ {fmtINR(item.price)}</p>
                </div>
                <p className="text-sm font-bold text-gray-800 shrink-0">{fmtINR(item.qty * item.price)}</p>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="border-t border-dashed border-gray-200 px-5 py-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">Total ({items.length} item{items.length !== 1 ? 's' : ''})</span>
            <span className="text-xl font-black text-gray-900">{fmtINR(bill.totalAmount)}</span>
          </div>

          {/* ALIVE footer */}
          <div className="border-t border-gray-100 px-5 py-2.5 flex justify-center">
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-300">Powered by ALIVE</span>
          </div>
        </div>

        {/* Save to account section */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 space-y-4">
          {claimed ? (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="text-sm font-bold text-gray-800">Saved to your ALIVE account!</p>
              <a
                href="/customer-dashboard"
                className="text-xs font-semibold text-green-600 hover:underline underline-offset-2"
              >
                View your purchases →
              </a>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-sm font-bold text-gray-800">Save to my ALIVE account</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enter your phone number to save this bill and view your purchase history.
                </p>
              </div>

              <form onSubmit={handleClaim} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Your name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">WhatsApp / phone</label>
                  <div className="flex items-stretch rounded-xl border border-gray-200 overflow-hidden focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100 transition-all bg-gray-50">
                    <span className="flex items-center px-3 text-sm font-semibold text-gray-500 border-r border-gray-200 bg-gray-100 shrink-0">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98765 43210"
                      required
                      className="flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                </div>

                {claimErr && (
                  <p className="text-xs text-red-600 rounded-lg border border-red-200 bg-red-50 px-3 py-2">{claimErr}</p>
                )}

                <button
                  type="submit"
                  disabled={claiming || !name.trim() || phone.length !== 10}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-700 py-3 text-sm font-bold text-white hover:from-red-600 hover:to-red-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save this bill'}
                </button>
              </form>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
