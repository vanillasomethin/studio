'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IndianRupee, CheckCircle2, Clock, Wifi, BarChart3, Phone,
  MapPin, Star, MessageCircle, Bell, ChevronRight,
  TrendingUp, Calendar, Shield, Loader2, ArrowRight,
  Mail, AlertCircle, X, FileImage,
} from 'lucide-react';
import { Logo } from '@/components/icons/logo';

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
  id?:       string;
  storeName: string;
  ownerName: string;
  whatsapp:  string;
  phone?:    string;
  password?: string;
  locality?: string;
  city?:     string;
  pincode?:  string;
  email?:    string;
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

const LS_KEY = 'alive_store_session';

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

function PhoneLogin({ onLogin }: { onLogin: (s: StoreInfo) => void }) {
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 10) { setError('Enter a valid 10-digit WhatsApp number.'); return; }
    if (!password)            { setError('Enter your password.'); return; }
    setBusy(true); setError(null);

    // ① Check localStorage first — works immediately after registration
    //   even when Redis isn't configured in this environment.
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as StoreInfo & { password?: string };
        const storedPhone = (stored.whatsapp ?? stored.phone ?? '').replace(/\D/g, '').slice(-10);
        if (storedPhone === phone) {
          if (stored.password && stored.password !== password) {
            setError('Incorrect password. Please try again.');
            setBusy(false);
            return;
          }
          onLogin(stored);
          return;
        }
      }
    } catch {}

    // ② Fallback: look up in Redis via API
    try {
      const res  = await fetch('/api/stores/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone, password }),
      });
      const data = await res.json() as { store: (StoreInfo & { password?: string }) | null };
      if (data.store) {
        if (data.store.password && data.store.password !== password) {
          setError('Incorrect password. Please try again.');
          return;
        }
        localStorage.setItem(LS_KEY, JSON.stringify(data.store));
        onLogin(data.store);
      } else {
        setError('No account found with this number. Please register first, or check the number you entered.');
      }
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
    // Fire-and-forget email update (we'd persist this properly with an API call)
    await new Promise((r) => setTimeout(r, 600));
    onSave(email);
    setSaved(true);
    setTimeout(() => setOpen(false), 1500);
    setBusy(false);
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

// ─── Earnings estimator ──────────────────────────────────────────────────────

const EARNING_TABLE = [
  { screens: 1, monthly: 2500,  annual: 30000  },
  { screens: 2, monthly: 5000,  annual: 60000  },
  { screens: 3, monthly: 8000,  annual: 96000  },
];

const TIMELINE = [
  { label: 'Registration received',   desc: 'Your details are saved successfully.',               done: true  },
  { label: 'Team verification',       desc: 'Our team will call you within 24 hours.',             active: true  },
  { label: 'Site visit & install',    desc: 'Free screen installed at your store.',               done: false },
  { label: 'Screen goes live',        desc: 'Ads start running — you start earning!',             done: false },
];

// ─── Main Dashboard ──────────────────────────────────────────────────────────

type DashTab = 'overview' | 'earnings' | 'flyers';

const DASH_TABS: { id: DashTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview',  icon: BarChart3    },
  { id: 'earnings', label: 'Earnings',  icon: IndianRupee  },
  { id: 'flyers',   label: 'My flyers', icon: FileImage    },
];

function MainDashboard({ store, onLogout }: { store: StoreInfo; onLogout: () => void }) {
  const [tab,      setTab]      = useState<DashTab>('overview');
  const [screens,  setScreens]  = useState(1);
  const [storeData, setStoreData] = useState<StoreInfo>(store);

  const displayName = storeData.ownerName?.split(' ')[0] ?? 'Partner';
  const earning     = EARNING_TABLE.find((r) => r.screens === screens) ?? EARNING_TABLE[0];

  const saveEmail = (email: string) => {
    const updated = { ...storeData, email };
    setStoreData(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
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
                <p className="text-base font-bold text-white">₹0</p>
                <p className="text-[9px] text-white/40">Earned</p>
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

              {/* Quick actions */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick actions</h2>
                {[
                  { icon: MessageCircle, label: 'WhatsApp support', desc: 'Chat with our team', href: 'https://wa.me/919741324448?text=Hi+Alive+team,+I+am+a+registered+store+partner.', color: 'text-[#25D366]' },
                  { icon: Phone,         label: 'Call us',           desc: '+91 74113 24448',   href: 'tel:+919741324448',                                                              color: 'text-blue-500' },
                  { icon: Shield,        label: 'Partnership terms', desc: 'Read store agreement', href: '/terms',                                                                      color: 'text-muted-foreground' },
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

              {/* Current earnings */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold text-foreground mb-4">Your earnings</h2>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'This month', value: '₹0', note: 'Screen not yet live' },
                    { label: 'Total',      value: '₹0', note: 'All time'            },
                    { label: 'Pending',    value: '₹0', note: 'Next payout'         },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-muted/40 p-3 text-center">
                      <p className="text-lg font-bold text-foreground">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5">{s.note}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-yellow-500/8 border border-yellow-500/20 px-3 py-2.5">
                  <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
                  <p className="text-xs text-muted-foreground">Earnings begin once your screen is installed and goes live.</p>
                </div>
              </div>

              {/* Potential earnings */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold text-foreground">Earnings potential</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Based on typical campaign fill rates in Mangaluru.</p>

                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Screens hosted</p>
                  <div className="flex gap-2">
                    {EARNING_TABLE.map((r) => (
                      <button
                        key={r.screens}
                        onClick={() => setScreens(r.screens)}
                        className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all ${
                          screens === r.screens ? 'border-primary bg-primary text-white' : 'border-border bg-background text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {r.screens}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-secondary/50 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Monthly income</p>
                    <p className="text-2xl font-bold text-foreground">{fmt(earning.monthly)}</p>
                    <p className="text-xs text-primary mt-1">per month</p>
                  </div>
                  <div className="rounded-xl bg-secondary/50 p-4">
                    <p className="text-xs text-muted-foreground mb-1">Annual income</p>
                    <p className="text-2xl font-bold text-foreground">{fmt(earning.annual)}</p>
                    <p className="text-xs text-muted-foreground mt-1">per year</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-3 italic">
                  Actual earnings depend on bookings and uptime. A minimum guaranteed payout applies once live.
                </p>
              </div>

              {/* Payout history placeholder */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-bold text-foreground mb-3">Payout history</h2>
                <div className="text-center py-8 text-muted-foreground">
                  <IndianRupee className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No payouts yet. History will appear here once your screen goes live.</p>
                </div>
              </div>
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

        </AnimatePresence>
      </main>

      <footer className="border-t border-border/30 py-5 text-center mt-6">
        <p className="text-xs text-muted-foreground/30">© 2025 ALIVE Advertising Pvt. Ltd. · Mangaluru</p>
      </footer>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StoreDashboardPage() {
  const [store, setStore] = useState<StoreInfo | null | 'loading'>('loading');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      setStore(raw ? (JSON.parse(raw) as StoreInfo) : null);
    } catch {
      setStore(null);
    }
  }, []);

  const handleLogin = (s: StoreInfo) => setStore(s);

  const handleLogout = () => {
    localStorage.removeItem(LS_KEY);
    setStore(null);
  };

  if (store === 'loading') return null;
  if (!store) return <PhoneLogin onLogin={handleLogin} />;
  return <MainDashboard store={store} onLogout={handleLogout} />;
}
