'use client';

import { useState, useEffect } from 'react';
import { Loader2, Receipt, Tag, LogOut, ChevronRight, Store, Calendar } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type CustomerSession = { phone: string; name: string; token: string };

type Bill = {
  id:          string;
  billRef:     string;
  storeName:   string;
  totalAmount: number;
  payMethod:   string;
  status:      string;
  createdAt:   string;
  itemCount:   number;
};

type Flyer = {
  id:          string;
  storeName:   string;
  title:       string;
  description: string;
  validUntil:  string;
  imageBase64: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtINR(n: number) { return '₹' + n.toLocaleString('en-IN'); }

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function resolveImage(raw: string) {
  if (!raw) return '';
  return raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`;
}

const PAY_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card', khata: 'Khata',
};

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginPrompt({ onSession }: { onSession: (s: CustomerSession) => void }) {
  const [phone, setPhone] = useState('');
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) { setError('Enter a valid 10-digit number.'); return; }

    setBusy(true);
    setError(null);

    // Try token from localStorage if it exists for this phone
    try {
      const saved = localStorage.getItem('alive_customer');
      if (saved) {
        const c = JSON.parse(saved) as CustomerSession;
        if (c.phone === `+91${phone}` || c.phone === phone) {
          onSession(c);
          return;
        }
      }
    } catch {}

    setError('No ALIVE account found for this number. Scan a bill QR code to register.');
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 border border-green-200">
              <Receipt className="h-7 w-7 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-gray-900">My Purchases</h1>
          <p className="text-sm text-gray-500">View your bill history from ALIVE partner stores.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Your WhatsApp / phone number</label>
            <div className="flex items-stretch rounded-xl border border-gray-200 overflow-hidden focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-100 transition-all bg-white">
              <span className="flex items-center px-3 text-sm font-semibold text-gray-500 border-r border-gray-200 bg-gray-50 shrink-0">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                autoFocus
                className="flex-1 bg-transparent px-3 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 leading-relaxed">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || phone.length !== 10}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-green-500 to-green-700 py-3.5 text-sm font-bold text-white hover:from-green-600 hover:to-green-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'View my purchases'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          No account yet?{' '}
          <span className="font-semibold text-gray-600">Scan a bill QR code at a kirana store to register.</span>
        </p>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

type Tab = 'purchases' | 'offers';

function Dashboard({ session, onLogout }: { session: CustomerSession; onLogout: () => void }) {
  const [tab,     setTab]     = useState<Tab>('purchases');
  const [bills,   setBills]   = useState<Bill[]>([]);
  const [flyers,  setFlyers]  = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);

  const firstName = session.name?.split(' ')[0] ?? 'there';

  useEffect(() => {
    const phone = session.phone.startsWith('+91') ? session.phone.slice(3) : session.phone;
    fetch(`/api/customer/bills?phone=${encodeURIComponent(session.phone)}&token=${encodeURIComponent(session.token)}`)
      .then((r) => r.json() as Promise<{ bills: Bill[] }>)
      .then((d) => setBills(d.bills ?? []))
      .catch(() => setBills([]))
      .finally(() => setLoading(false));
    void phone;
  }, [session]);

  useEffect(() => {
    if (tab !== 'offers') return;
    fetch('/api/flyers/save')
      .then((r) => r.json() as Promise<Flyer[]>)
      .then((d) => setFlyers(Array.isArray(d) ? d : []))
      .catch(() => setFlyers([]));
  }, [tab]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <div>
            <p className="text-sm font-bold text-gray-900">Hi, {firstName}! 👋</p>
            <p className="text-[10px] text-gray-400">{session.phone}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-all"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-5 space-y-4">

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1">
          {([
            { id: 'purchases', label: 'My Purchases', icon: Receipt },
            { id: 'offers',    label: 'Offers',       icon: Tag     },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                  tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Purchases */}
        {tab === 'purchases' && (
          loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
            </div>
          ) : bills.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center space-y-2">
              <Receipt className="h-8 w-8 mx-auto text-gray-200" />
              <p className="text-sm font-semibold text-gray-500">No bills yet</p>
              <p className="text-xs text-gray-400">Your receipts from ALIVE partner stores will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => (
                <a
                  key={bill.id}
                  href={`/bill/${bill.billRef}`}
                  className="flex items-center gap-3 rounded-2xl bg-white border border-gray-200 p-4 hover:border-green-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 border border-green-100">
                    <Store className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{bill.storeName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Calendar className="h-3 w-3" />{fmtDate(bill.createdAt)}
                      </span>
                      <span className="text-[10px] text-gray-400">·</span>
                      <span className="text-[10px] text-gray-400">{bill.itemCount} item{bill.itemCount !== 1 ? 's' : ''}</span>
                      <span className="text-[10px] text-gray-400">·</span>
                      <span className="text-[10px] text-gray-500 font-semibold">{PAY_LABELS[bill.payMethod] ?? bill.payMethod}</span>
                    </div>
                    <p className="text-[10px] font-mono text-gray-300 mt-0.5">{bill.billRef}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-black text-gray-900">{fmtINR(bill.totalAmount)}</p>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                      bill.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                    }`}>{bill.status}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-green-400 transition-colors shrink-0" />
                </a>
              ))}
            </div>
          )
        )}

        {/* Offers */}
        {tab === 'offers' && (
          flyers.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-200 p-8 text-center space-y-2">
              <Tag className="h-8 w-8 mx-auto text-gray-200" />
              <p className="text-sm font-semibold text-gray-500">No offers right now</p>
              <p className="text-xs text-gray-400">Store deals from your neighbourhood will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {flyers.map((f) => {
                const img = resolveImage(f.imageBase64);
                return (
                  <div key={f.id} className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={f.title} className="w-full aspect-video object-cover" />
                    ) : (
                      <div className="w-full aspect-video bg-gray-100 flex items-center justify-center">
                        <Tag className="h-5 w-5 text-gray-300" />
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-xs font-bold text-gray-800 line-clamp-1">{f.title}</p>
                      <p className="text-[10px] text-gray-400">{f.storeName}</p>
                      <p className="text-[10px] text-gray-400">Until {fmtDate(f.validUntil)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

      </main>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerDashboardPage() {
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('alive_customer');
      if (saved) setSession(JSON.parse(saved) as CustomerSession);
    } catch {}
    setChecked(true);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('alive_customer');
    setSession(null);
  };

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
      </div>
    );
  }

  if (!session) return <LoginPrompt onSession={(s) => { setSession(s); localStorage.setItem('alive_customer', JSON.stringify(s)); }} />;

  return <Dashboard session={session} onLogout={handleLogout} />;
}
