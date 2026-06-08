'use client';

import { useState, useEffect, useCallback } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IndianRupee, CheckCircle2, Clock, BarChart3, Phone,
  MapPin, MessageCircle, ChevronRight,
  TrendingUp, Calendar, Shield, Loader2, ArrowRight,
  Mail, AlertCircle, X, FileImage, Download, Gift, Copy, Check, ShoppingCart,
} from 'lucide-react';
import { Logo } from '@/components/icons/logo';
import VoiceBillTab from '@/components/store/voice-bill-tab';

// ─── Animations ─────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

// ─── Types ──────────────────────────────────────────────────────────────────

type StoreInfo = {
  id?:           string;
  storeName:     string;
  ownerName:     string;
  whatsapp:      string;
  phone?:        string;
  password?:     string;
  locality?:     string;
  city?:         string;
  pincode?:      string;
  address?:      string;
  gstin?:        string;
  email?:        string;
  referralCode?: string;
  referredBy?:   string;
  agreedAt?:     string;
};

type Flyer = {
  id:          string;
  storeName:   string;
  title:       string;
  description: string;
  validUntil:  string;
  imageBase64: string;
  createdAt:   string;
};

function fmt(n: number) { return `₹${n.toLocaleString('en-IN')}`; }
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
function resolveImage(raw: string) {
  if (!raw) return '';
  return raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`;
}

// ─── Phone + password login ───────────────────────────────────────────────────

function PhoneLogin() {
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) { setError('Enter a valid 10-digit WhatsApp number.'); return; }
    if (!password)            { setError('Enter your password.'); return; }
    setBusy(true); setError(null);

    try {
      const result = await signIn('phone-password', {
        phone:    `+91${phone}`,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError('Incorrect number or password. Please try again.');
      }
      // On success, useSession in the parent will update and render MainDashboard
    } catch {
      setError('Could not connect. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/30 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-4 sm:px-6">
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity"><Logo /></a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
            <motion.div variants={fadeUp} className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Store Partner Portal</p>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Sign in</h1>
              <p className="text-sm text-muted-foreground">
                Use your registered WhatsApp number and password.
              </p>
            </motion.div>

            <motion.form variants={fadeUp} onSubmit={submit} className="space-y-3">
              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">WhatsApp number (username)</label>
                <div className="flex items-stretch rounded-xl border border-border overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all bg-card">
                  <span className="flex items-center px-4 text-sm font-semibold text-muted-foreground border-r border-border bg-muted shrink-0">+91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    autoFocus
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    className="flex-1 bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your login password"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                  <p className="text-xs text-destructive leading-relaxed">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || phone.length !== 10 || !password}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-700 px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_16px_-4px_rgba(220,38,38,0.4)] transition-all hover:from-red-600 hover:to-red-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowRight className="h-4 w-4" /> Sign in</>}
              </button>
            </motion.form>

            <motion.div variants={fadeUp} className="text-center">
              <p className="text-xs text-muted-foreground">
                New to Alive?{' '}
                <a href="/store" className="text-primary font-semibold hover:underline">Register your store — it&apos;s free →</a>
              </p>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// ─── Add email banner ────────────────────────────────────────────────────────

function EmailBanner({ store, onSave }: { store: StoreInfo; onSave: (email: string) => void }) {
  const [open,  setOpen]  = useState(!store.email);
  const [email, setEmail] = useState(store.email ?? '');
  const [busy,  setBusy]  = useState(false);
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  const save = async () => {
    if (!email.includes('@')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/stores/update', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Failed');
      onSave(email);
      setSaved(true);
      setTimeout(() => setOpen(false), 1500);
    } catch {
      // silently ignore — user can retry
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
      <Mail className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
      <div className="flex-1 min-w-0">
        {saved ? (
          <p className="text-sm font-semibold text-green-600">Email saved ✓</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">Add your email</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">Get invoices, updates and payout notifications by email.</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button
                onClick={save}
                disabled={busy || !email.includes('@')}
                className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-bold text-white hover:bg-blue-600 transition-colors disabled:opacity-40 flex items-center gap-1"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
      {!saved && (
        <button onClick={() => setOpen(false)} className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ─── Flyer image modal ────────────────────────────────────────────────────────

function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Flyer" className="max-h-[90vh] max-w-full rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="h-5 w-5" /></button>
    </div>
  );
}

// ─── Deals carousel (store-specific flyers) ──────────────────────────────────

function StoreFlyers({ storeName }: { storeName: string }) {
  const [flyers,  setFlyers]  = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/flyers/save')
      .then((r) => r.json() as Promise<Flyer[]>)
      .then((all) => setFlyers(all.filter((f) => f.storeName.toLowerCase() === storeName.toLowerCase())))
      .catch(() => setFlyers([]))
      .finally(() => setLoading(false));
  }, [storeName]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      {modal && <ImageModal src={modal} onClose={() => setModal(null)} />}
      {flyers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <FileImage className="h-8 w-8 mx-auto mb-2 opacity-30" />
          No active flyers for your store yet.
          <p className="text-xs mt-1 text-muted-foreground/50">Contact your Alive manager to publish offers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {flyers.map((f) => {
            const img = resolveImage(f.imageBase64);
            return (
              <div key={f.id} className="rounded-xl border border-border bg-card overflow-hidden cursor-pointer group" onClick={() => img && setModal(img)}>
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={f.title} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full aspect-video bg-muted flex items-center justify-center"><FileImage className="h-6 w-6 text-muted-foreground/30" /></div>
                )}
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-foreground line-clamp-1">{f.title}</p>
                  <p className="text-[10px] text-muted-foreground/60">Until {fmtDate(f.validUntil)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── 12-month payment timeline ───────────────────────────────────────────────

function PaymentTimeline({ onClaim }: { onClaim: () => void }) {
  const now = new Date();

  const months = Array.from({ length: 12 }, (_, i) => {
    const start   = new Date(now.getFullYear(), now.getMonth() - 4 + i, 1);
    const end     = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const isPast  = start < new Date(now.getFullYear(), now.getMonth(), 1);
    const isCur   = start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();
    const isFuture = !isPast && !isCur;

    const mo  = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const yr  = start.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    return { label: yr, range: `${mo(start)} – ${mo(end)}`, isPast, isCur, isFuture, amount: '₹500' };
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-foreground">Payment timeline</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">₹500 + electricity per month · paid by 10th of following month</p>
        </div>
        <Calendar className="h-4 w-4 text-muted-foreground/40" />
      </div>

      <div className="space-y-2">
        {months.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
              m.isCur    ? 'border border-primary/30 bg-primary/5'  :
              m.isPast   ? 'border border-border bg-muted/20'       :
                           'border border-border/40 bg-transparent opacity-50'
            }`}
          >
            {/* Status dot */}
            <div className={`h-2 w-2 rounded-full shrink-0 ${
              m.isCur  ? 'bg-primary animate-pulse' :
              m.isPast ? 'bg-green-500'             :
                         'bg-muted-foreground/20'
            }`} />

            {/* Month + range */}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${m.isCur ? 'text-primary' : m.isPast ? 'text-foreground' : 'text-muted-foreground'}`}>
                {m.label}
              </p>
              <p className="text-[10px] text-muted-foreground/60">{m.range}</p>
            </div>

            {/* Amount + status */}
            <div className="text-right shrink-0">
              {m.isPast ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-green-600">{m.amount}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                </div>
              ) : m.isCur ? (
                <button
                  onClick={onClaim}
                  className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[10px] font-bold text-white hover:opacity-90 transition-opacity"
                >
                  <Download className="h-2.5 w-2.5" /> Claim
                </button>
              ) : (
                <span className="text-[10px] text-muted-foreground/40 font-medium">Upcoming</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Referral card ────────────────────────────────────────────────────────────

function ReferralCard({ store }: { store: StoreInfo }) {
  const [copied, setCopied] = useState(false);
  const code = store.referralCode ?? '—';

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Gift className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
        <div>
          <h2 className="text-sm font-bold text-foreground">Your referral code</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Earn ₹500 for every new store partner who joins using your code.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-4 py-3">
        <span className="flex-1 text-xl font-black tracking-[0.2em] text-foreground font-mono">{code}</span>
        <button onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
          {copied ? <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
        </button>
      </div>

      <div className="text-[10px] text-muted-foreground/50 leading-relaxed">
        Share on WhatsApp · Referral bonus credited once the referred store goes live · No limit on referrals
      </div>
    </div>
  );
}

// ─── Claim payout modal ───────────────────────────────────────────────────────

function ClaimModal({ store, onClose }: { store: StoreInfo; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const month = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 space-y-5"
      >
        {sent ? (
          <div className="text-center space-y-3 py-2">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 ring-8 ring-green-500/8">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
            </div>
            <div>
              <p className="text-base font-bold text-foreground">Claim submitted!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Our team will process your payout for {month} within 3–5 business days via UPI to +91 {store.whatsapp}.
              </p>
            </div>
            <button onClick={onClose} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Claim monthly reward</h3>
              <p className="text-xs text-muted-foreground">Request your payout for {month}.</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Period</span>
                <span className="font-semibold text-foreground">{month}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-green-600">₹500 + electricity</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">UPI / WhatsApp</span>
                <span className="font-semibold text-foreground">+91 {store.whatsapp}</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
              Actual payout is calculated based on verified screen uptime and campaign bookings for the month. Final amount may vary.
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                onClick={() => setSent(true)}
                className="flex-1 rounded-xl bg-gradient-to-br from-red-500 to-red-700 py-3 text-xs font-bold text-white hover:opacity-90 transition-opacity"
              >
                Submit claim
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ─── Agreement card (dashboard) ───────────────────────────────────────────────

function AgreementCard({ store }: { store: StoreInfo }) {
  const agreedAt = store.agreedAt;
  const date = agreedAt
    ? new Date(agreedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-border">
        <div>
          <h2 className="text-sm font-bold text-foreground">Your Store Partner Agreement</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Signed on {date}</p>
        </div>
        <Shield className="h-4 w-4 text-muted-foreground/40" />
      </div>

      {/* Prefilled parties */}
      <div className="px-5 py-3 border-b border-border bg-muted/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black text-foreground">{store.storeName}</p>
            <p className="text-[11px] text-muted-foreground">{store.ownerName} · +91 {store.whatsapp}</p>
            {store.city && <p className="text-[10px] text-muted-foreground/60">{[store.locality, store.city, store.pincode].filter(Boolean).join(', ')}</p>}
            {store.gstin
              ? <p className="text-[10px] text-muted-foreground/60 font-mono">GSTIN: {store.gstin}</p>
              : <p className="text-[10px] text-muted-foreground/40">GSTIN: —</p>
            }
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] font-semibold text-foreground">VS Collective LLP</p>
            <p className="text-[10px] text-muted-foreground">ALIVE · {date}</p>
          </div>
        </div>
      </div>

      {/* Key terms compact */}
      <div className="divide-y divide-border">
        {[
          { t: 'Remuneration', d: '₹500/month per screen, fixed. Paid within 10 working days of month end via UPI/NEFT.' },
          { t: 'Electricity',  d: 'Reimbursed at screen rated power × actual hours × prevailing tariff.' },
          { t: 'Equipment',    d: 'Screen installed free. Remains ALIVE property at all times.' },
          { t: 'Exit',         d: '30 days written notice by either party. ALIVE removes screen at its cost.' },
        ].map(({ t, d }) => (
          <div key={t} className="px-5 py-2.5 flex gap-3 text-xs">
            <span className="font-bold text-foreground/80 shrink-0 w-24">{t}</span>
            <span className="text-muted-foreground">{d}</span>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 border-t border-border flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground/50">Agreement accepted · {date}</p>
        <a href="/store-agreement" target="_blank" rel="noreferrer"
          className="text-[11px] font-semibold text-primary hover:underline underline-offset-2">
          Full agreement →
        </a>
      </div>
    </div>
  );
}

// ─── Earnings estimator ──────────────────────────────────────────────────────

const EARNING_TABLE = [
  { screens: 1, monthly: 500,  annual: 6000  },
  { screens: 2, monthly: 1000, annual: 12000 },
  { screens: 3, monthly: 1500, annual: 18000 },
];

const TIMELINE = [
  { label: 'Registration received',   desc: 'Your details are saved successfully.',               done: true  },
  { label: 'Team verification',       desc: 'Our team will call you within 24 hours.',             active: true  },
  { label: 'Site visit & install',    desc: 'Free screen installed at your store.',               done: false },
  { label: 'Screen goes live',        desc: 'Ads start running — you start earning!',             done: false },
];

// ─── Main Dashboard ──────────────────────────────────────────────────────────

type DashTab = 'overview' | 'earnings' | 'flyers' | 'voicebill';

const DASH_TABS: { id: DashTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',  icon: BarChart3    },
  { id: 'earnings',  label: 'Earnings',  icon: IndianRupee  },
  { id: 'flyers',    label: 'My flyers', icon: FileImage    },
  { id: 'voicebill', label: 'VoiceBill', icon: ShoppingCart },
];

function MainDashboard({ store, onLogout }: { store: StoreInfo; onLogout: () => void }) {
  const [tab,       setTab]      = useState<DashTab>('overview');
  const [storeData, setStoreData] = useState<StoreInfo>(store);
  const [claimOpen, setClaimOpen] = useState(false);

  const displayName = storeData.ownerName?.split(' ')[0] ?? 'Partner';
  const earning     = EARNING_TABLE[0]; // 1 screen per store

  const saveEmail = (email: string) => {
    setStoreData((prev) => ({ ...prev, email }));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="opacity-80 hover:opacity-100 transition-opacity"><Logo /></a>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
              {displayName[0]?.toUpperCase()}
            </div>
            <button onClick={onLogout} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-5">

        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1a0505 0%, #2d0a0a 50%, #1a0505 100%)' }}
        >
          <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">Store Partner</p>
              <h1 className="text-xl font-bold text-white">Welcome back, {displayName}!</h1>
              {storeData.locality && (
                <p className="text-xs text-white/50 flex items-center gap-1.5 mt-1">
                  <MapPin className="h-3 w-3 text-primary/70" />
                  {storeData.storeName} · {storeData.locality}{storeData.city ? `, ${storeData.city}` : ''}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center">
                <p className="text-base font-bold text-white">₹500</p>
                <p className="text-[9px] text-white/40">/month</p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-center">
                <p className="text-base font-bold text-primary">48h</p>
                <p className="text-[9px] text-primary/60">To live</p>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 px-5 sm:px-6 py-2.5 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
            <p className="text-xs text-white/50">
              <span className="text-white/80 font-semibold">Registration received</span> — our team will call +91 {storeData.whatsapp} within 24 hours.
            </p>
          </div>
        </motion.div>

        {/* Email banner */}
        {!storeData.email && <EmailBanner store={storeData} onSave={saveEmail} />}

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
          {DASH_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                  tab === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">

          {tab === 'overview' && (
            <motion.div key="ov" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="space-y-4">

              {/* Timeline */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-bold text-foreground">What happens next</h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">Step 1 of 4</span>
                </div>
                <div className="space-y-0">
                  {TIMELINE.map((item, i) => (
                    <div key={item.label} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          item.done   ? 'bg-primary text-white' :
                          item.active ? 'border-2 border-primary bg-primary/10 text-primary' :
                                        'border-2 border-border bg-background text-muted-foreground'
                        }`}>
                          {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.active ? <Clock className="h-3.5 w-3.5" /> : <span>{i+1}</span>}
                        </div>
                        {i < TIMELINE.length - 1 && <div className={`w-px flex-1 min-h-[24px] mt-1 mb-1 ${item.done ? 'bg-primary/30' : 'bg-border'}`} />}
                      </div>
                      <div className="pb-4">
                        <p className={`text-sm font-semibold ${item.done ? 'text-foreground' : item.active ? 'text-primary' : 'text-muted-foreground'}`}>{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Referral */}
              <ReferralCard store={storeData} />

              {/* Agreement */}
              <AgreementCard store={storeData} />

              {/* Quick actions */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick actions</h2>
                {[
                  { icon: MessageCircle, label: 'WhatsApp support', desc: 'Chat with our team', href: 'https://wa.me/919741324448?text=Hi+Alive+team,+I+am+a+registered+store+partner.', color: 'text-[#25D366]' },
                  { icon: Phone,         label: 'Call us',           desc: '+91 74113 24448',   href: 'tel:+919741324448', color: 'text-blue-500' },
                ].map((a) => (
                  <a key={a.label} href={a.href} target={a.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-border p-3 hover:border-primary/30 hover:bg-muted/30 transition-all group"
                  >
                    <a.icon className={`h-4 w-4 shrink-0 ${a.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{a.label}</p>
                      <p className="text-xs text-muted-foreground/60">{a.desc}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </a>
                ))}
              </div>

              {/* FAQ */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Common questions</h2>
                {[
                  { q: 'When will my screen be installed?',  a: 'Our team will visit within 48–72 hours of verification. Installation takes ~2 hours.' },
                  { q: 'When do I receive my first payout?', a: 'Payouts are processed monthly, 7 days after the end of each billing cycle via UPI/NEFT.' },
                  { q: 'What if the screen has a problem?',  a: 'We monitor screens 24/7 remotely. Hardware issues are resolved within 24 hours.' },
                  { q: 'Can I host more than one screen?',   a: 'Yes! Tell your relationship manager when they call — more screens means more income.' },
                ].map((faq) => (
                  <div key={faq.q} className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">{faq.q}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {tab === 'earnings' && (
            <motion.div key="earn" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="space-y-4">

              {/* Single-line stats */}
              <div className="rounded-2xl border border-border bg-card px-5 py-3 flex items-center divide-x divide-border">
                {[
                  { label: 'Total earned', value: '₹0',   accent: false },
                  { label: 'This month',   value: '₹500', accent: true  },
                  { label: 'Per referral', value: '₹500', accent: false },
                ].map((s) => (
                  <div key={s.label} className="flex-1 text-center px-3 py-1">
                    <p className={`text-base font-black ${s.accent ? 'text-primary' : 'text-foreground'}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* 12-month timeline */}
              <PaymentTimeline onClaim={() => setClaimOpen(true)} />

            </motion.div>
          )}

          {tab === 'flyers' && (
            <motion.div key="fly" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-foreground">Active flyers</h2>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full">Published by Alive team</span>
                </div>
                <StoreFlyers storeName={storeData.storeName} />
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
                <h2 className="text-sm font-bold text-foreground">Want to run a flyer?</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Contact your Alive relationship manager to publish weekly offers, discounts or promotions for your store.
                  Our design team can help create the flyer too.
                </p>
                <a
                  href="https://wa.me/919741324448?text=Hi+Alive,+I+want+to+publish+a+flyer+for+my+store."
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#25D366]/30 bg-[#25D366]/8 px-4 py-2.5 text-xs font-semibold text-[#25D366] hover:bg-[#25D366]/15 transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Request a flyer on WhatsApp
                </a>
              </div>
            </motion.div>
          )}

          {tab === 'voicebill' && (
            <motion.div key="vb" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <VoiceBillTab storeId={storeData.id} storeName={storeData.storeName} />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <footer className="border-t border-border/30 py-5 text-center mt-6">
        <p className="text-xs text-muted-foreground/30">© 2025 ALIVE Advertising Pvt. Ltd. · Mangaluru</p>
      </footer>

      <AnimatePresence>
        {claimOpen && <ClaimModal store={storeData} onClose={() => setClaimOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StoreDashboardPage() {
  const { data: session, status } = useSession();
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);

  const fetchStore = useCallback(async () => {
    setStoreLoading(true);
    try {
      const res = await fetch('/api/stores/me');
      if (res.ok) setStoreInfo(await res.json() as StoreInfo);
    } finally {
      setStoreLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && !storeInfo) fetchStore();
  }, [status, storeInfo, fetchStore]);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    setStoreInfo(null);
  };

  if (status === 'loading' || storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) return <PhoneLogin />;

  if (!storeInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return <MainDashboard store={storeInfo} onLogout={handleLogout} />;
}
