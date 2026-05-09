'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  IndianRupee, Zap, Shield, TrendingUp, Clock, Star,
  Navigation, Loader2, CheckCircle2, AlertCircle, MapPin,
  ArrowDown, Phone, ChevronRight, Wifi, Monitor, Check,
} from 'lucide-react';
import { Logo } from '@/components/icons/logo';

// ─── Animation ──────────────────────────────────────────────────────────────

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay } },
});

// ─── Data ────────────────────────────────────────────────────────────────────

const BENEFITS = [
  { icon: IndianRupee, title: '₹2,500 – ₹8,000/month', body: 'Guaranteed passive income deposited directly to your bank, every month. No sales, no effort.', color: '#22c55e' },
  { icon: Zap,         title: 'Zero upfront cost',      body: 'We supply, install and maintain the screen at absolutely no cost to you. We own the equipment.', color: '#eab308' },
  { icon: Shield,      title: 'We run everything',      body: 'Content, updates, tech support — all handled remotely by our team. Your job is to keep the store open.', color: '#3b82f6' },
  { icon: TrendingUp,  title: 'Modern store feel',      body: 'A bright digital screen makes your store stand out and draws more foot traffic from the street.', color: '#a855f7' },
  { icon: Clock,       title: 'Zero disruption',        body: 'The screen goes on your wall. Your store runs exactly as before. No changes to your routine.', color: '#f97316' },
  { icon: Star,        title: 'Exclusive territory',    body: 'We take only 1–2 stores per locality. Register now before your nearest competitor beats you to it.', color: '#ef4444' },
];

const HOW = [
  { n: '01', title: 'Register below',         body: 'Fill in your store details. Takes 2 minutes.' },
  { n: '02', title: 'We visit & install',      body: 'Our team installs a free screen within 48 hours.' },
  { n: '03', title: 'Earn every month',        body: 'Ads run 24/7. Revenue share lands in your account.' },
];

const EARNINGS = [
  { screens: 1, monthly: 2500,  annual: 30000  },
  { screens: 2, monthly: 5000,  annual: 60000  },
  { screens: 3, monthly: 8000,  annual: 96000  },
];

// ─── Geolocation ─────────────────────────────────────────────────────────────

type GeoState = 'idle' | 'loading' | 'done' | 'error';

async function reverseGeocode(lat: number, lng: number) {
  const res  = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    { headers: { 'Accept-Language': 'en' } },
  );
  const data = await res.json();
  const a    = data.address ?? {};
  return {
    locality: a.suburb || a.neighbourhood || a.village || a.county || '',
    pincode:  (a.postcode ?? '').replace(/\D/g, '').slice(0, 6),
    city:     a.city || a.town || a.municipality || a.state_district || '',
  };
}

// ─── Registration form ────────────────────────────────────────────────────────

type Form = {
  storeName: string;
  ownerName: string;
  whatsapp:  string;
  address:   string;
  locality:  string;
  city:      string;
  pincode:   string;
  lat:       string;
  lng:       string;
};

const INIT: Form = { storeName: '', ownerName: '', whatsapp: '', address: '', locality: '', city: '', pincode: '', lat: '', lng: '' };

function Field({
  label, value, onChange, type = 'text', placeholder, prefix, readOnly,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; prefix?: string; readOnly?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </label>
      <div className="flex">
        {prefix && (
          <span className="flex items-center px-3 rounded-l-xl text-sm font-bold border-y border-l border-white/20 bg-white/10" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-4 py-3 text-sm rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/30 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/25 transition-all ${prefix ? 'rounded-l-none' : ''} ${readOnly ? 'opacity-60 cursor-default' : ''}`}
        />
      </div>
    </div>
  );
}

function RegistrationForm() {
  const router    = useRouter();
  const [form, setForm] = useState<Form>(INIT);
  const [geo,  setGeo]  = useState<GeoState>('idle');
  const [geoErr, setGeoErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');
  const [done, setDone] = useState(false);

  const set = (k: keyof Form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const locate = () => {
    if (!navigator.geolocation) { setGeoErr('Geolocation not supported.'); return; }
    setGeo('loading'); setGeoErr('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        set('lat', String(lat)); set('lng', String(lng));
        try {
          const { locality, pincode, city } = await reverseGeocode(lat, lng);
          set('locality', locality); set('pincode', pincode); set('city', city);
        } catch {}
        setGeo('done');
      },
      (e) => {
        setGeoErr(e.code === 1 ? 'Location access denied. Allow location and try again.' : 'Could not get location. Fill address manually.');
        setGeo('error');
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const valid = form.storeName && form.ownerName && form.whatsapp.length === 10 && form.city && form.pincode.length === 6;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/stores/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, phone: `+91${form.whatsapp}` }),
      });
      if (!res.ok) throw new Error('Submission failed. Please try again.');
      sessionStorage.setItem('alive_store', JSON.stringify({ ...form, phone: `+91${form.whatsapp}` }));
      setDone(true);
      setTimeout(() => router.push('/store-dashboard'), 1800);
    } catch (e) {
      setErr((e as Error).message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4 py-8"
      >
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 ring-8 ring-green-500/10">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
          </div>
        </div>
        <div>
          <p className="text-xl font-bold text-white">Registration received!</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Taking you to your dashboard…</p>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Store name" value={form.storeName} onChange={(v) => set('storeName', v)} placeholder="Sharma General Store" />
        <Field label="Owner name" value={form.ownerName} onChange={(v) => set('ownerName', v)} placeholder="Ramesh Sharma" />
      </div>

      <Field
        label="WhatsApp number"
        type="tel"
        prefix="+91"
        value={form.whatsapp}
        onChange={(v) => set('whatsapp', v.replace(/\D/g, '').slice(0, 10))}
        placeholder="98765 43210"
      />

      {/* GPS locator */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Shop location
        </label>
        <button
          type="button"
          onClick={locate}
          disabled={geo === 'loading'}
          className={`w-full flex items-center justify-center gap-2.5 rounded-xl border-2 py-3.5 text-sm font-bold transition-all ${
            geo === 'done'
              ? 'border-green-400 bg-green-400/15 text-green-300'
              : geo === 'error'
              ? 'border-red-400/60 bg-red-400/10 text-red-300'
              : 'border-white/25 bg-white/8 text-white hover:border-white/50 hover:bg-white/15'
          }`}
        >
          {geo === 'loading' ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Detecting location…</>
          ) : geo === 'done' ? (
            <><Check className="h-4 w-4" /> Location detected — tap to update</>
          ) : (
            <><Navigation className="h-4 w-4" /> Use my current location (GPS)</>
          )}
        </button>
        {geoErr && (
          <p className="text-xs text-red-300 flex items-start gap-1.5 mt-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{geoErr}
          </p>
        )}
      </div>

      {/* Address details */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Locality / area" value={form.locality} onChange={(v) => set('locality', v)} placeholder="Kankanady" />
        <Field label="Pincode" value={form.pincode} onChange={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))} placeholder="575002" />
      </div>
      <Field label="City" value={form.city} onChange={(v) => set('city', v)} placeholder="Mangaluru" />
      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Door no. &amp; street <span className="normal-case font-normal opacity-50">(optional)</span>
        </label>
        <textarea
          rows={2}
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
          placeholder="Door no., street name, landmark…"
          className="w-full px-4 py-3 text-sm rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/30 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/25 transition-all resize-none"
        />
      </div>

      {err && (
        <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
          <p className="text-xs text-red-300">{err}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !valid}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-4 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: busy || !valid ? '#dc2626' : 'linear-gradient(135deg,#ef4444,#b91c1c)', boxShadow: valid ? '0 8px 24px -6px rgba(220,38,38,0.5)' : 'none' }}
      >
        {busy
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Registering…</>
          : <><CheckCircle2 className="h-4 w-4" /> Register my store — it&apos;s free</>
        }
      </button>

      <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Already registered?{' '}
        <a href="/store-dashboard" className="text-red-400 hover:text-red-300 underline-offset-2 hover:underline">
          Sign in to your dashboard →
        </a>
      </p>
    </form>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StorePage() {
  const [screens, setScreens] = useState(1);
  const earning = EARNINGS.find((r) => r.screens === screens) ?? EARNINGS[0];

  return (
    <div className="min-h-screen bg-white dark:bg-background">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-gray-100 dark:border-border bg-white/90 dark:bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/"><Logo /></a>
          <div className="flex items-center gap-4">
            <a href="/store-dashboard" className="text-xs font-semibold text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors">
              Partner login →
            </a>
            <a
              href="#register"
              className="rounded-xl px-4 py-2 text-xs font-black text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}
            >
              Register free
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0a0000 0%, #1c0404 40%, #0f0000 100%)' }}
      >
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div style={{ position: 'absolute', top: '-20%', left: '30%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(220,38,38,0.18) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: '-10%', right: '10%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(220,38,38,0.1) 0%, transparent 70%)' }} />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
          <motion.div variants={fadeUp(0)} initial="hidden" animate="show" className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 mb-6">
              <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-xs font-bold text-red-300 tracking-wider uppercase">Kirana Store Partners · Mangaluru</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
              Your wall.<br />
              <span style={{ color: '#ef4444' }}>Their ads.</span><br />
              Your income.
            </h1>
            <p className="text-lg sm:text-xl text-white/60 leading-relaxed max-w-2xl mb-8">
              Alive installs a free digital screen in your store. Top brands pay to show ads on it.
              You earn <span className="text-white font-semibold">₹2,500–₹8,000 every month</span> without lifting a finger.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#register"
                className="inline-flex items-center gap-2 rounded-xl px-7 py-4 text-sm font-black text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)', boxShadow: '0 8px 32px -8px rgba(220,38,38,0.6)' }}
              >
                Register my store <ChevronRight className="h-4 w-4" />
              </a>
              <a
                href="/store-dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-7 py-4 text-sm font-bold text-white/80 hover:border-white/40 hover:text-white transition-all"
              >
                <Phone className="h-4 w-4" /> Partner login
              </a>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div variants={fadeUp(0.15)} initial="hidden" animate="show" className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl">
            {[
              { value: '₹0',   label: 'Upfront cost'   },
              { value: '48h',  label: 'To go live'      },
              { value: '100+', label: 'Active stores'   },
              { value: '24/7', label: 'Screen uptime'   },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center">
                <p className="text-2xl font-black text-white">{s.value}</p>
                <p className="text-xs text-white/40 mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <div className="flex justify-center pb-8">
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}>
            <ArrowDown className="h-5 w-5 text-white/30" />
          </motion.div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 sm:py-28 bg-white dark:bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-500 mb-3">Simple process</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-foreground">
              Go live in 3 steps
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {HOW.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }} viewport={{ once: true }}
                className="relative"
              >
                {/* Connector line */}
                {i < HOW.length - 1 && (
                  <div className="hidden sm:block absolute top-7 left-[calc(100%-0px)] w-full h-px bg-gradient-to-r from-red-200 to-transparent dark:from-red-900/40 z-0" style={{ width: '60%', left: '70%' }} />
                )}
                <div className="relative z-10">
                  <div
                    className="text-4xl font-black mb-4 inline-block"
                    style={{ WebkitTextStroke: '2px #ef4444', color: 'transparent' }}
                  >
                    {step.n}
                  </div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-muted-foreground leading-relaxed">{step.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits grid ── */}
      <section className="py-20 sm:py-28" style={{ background: '#fafafa' }} data-dark="bg-secondary/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-500 mb-3">Why partners choose Alive</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-foreground">
              Built for kirana store owners
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b, i) => {
              const Icon = b.icon;
              return (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }} viewport={{ once: true }}
                  className="rounded-2xl border border-gray-100 dark:border-border bg-white dark:bg-card p-6 hover:shadow-lg transition-shadow"
                >
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ background: `${b.color}18` }}
                  >
                    <Icon className="h-6 w-6" style={{ color: b.color }} />
                  </div>
                  <h3 className="text-base font-black text-gray-900 dark:text-foreground mb-2">{b.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-muted-foreground leading-relaxed">{b.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Earnings calculator ── */}
      <section className="py-20 sm:py-28 bg-white dark:bg-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} viewport={{ once: true }}
            className="rounded-3xl overflow-hidden border border-gray-100 dark:border-border"
          >
            <div className="p-8 sm:p-10" style={{ background: 'linear-gradient(135deg,#0a0000,#1c0404)' }}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400 mb-2">Earnings calculator</p>
              <h2 className="text-3xl font-black text-white mb-1">How much will you earn?</h2>
              <p className="text-sm text-white/50 mb-8">Based on typical campaign fill rates in Mangaluru.</p>

              {/* Screen toggle */}
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">Number of screens in your store</p>
                <div className="flex gap-3">
                  {EARNINGS.map((r) => (
                    <button
                      key={r.screens}
                      type="button"
                      onClick={() => setScreens(r.screens)}
                      className={`flex-1 rounded-xl border py-3.5 text-sm font-black transition-all ${
                        screens === r.screens
                          ? 'border-red-400 bg-red-500 text-white'
                          : 'border-white/20 bg-white/8 text-white/60 hover:border-white/40 hover:text-white'
                      }`}
                    >
                      {r.screens} screen{r.screens > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Numbers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white/8 border border-white/10 p-6">
                  <p className="text-xs text-white/40 font-medium mb-2">Monthly income</p>
                  <p className="text-4xl font-black text-white">₹{earning.monthly.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-red-400 font-semibold mt-1">per month</p>
                </div>
                <div className="rounded-2xl bg-white/8 border border-white/10 p-6">
                  <p className="text-xs text-white/40 font-medium mb-2">Annual income</p>
                  <p className="text-4xl font-black text-white">₹{earning.annual.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-white/40 font-medium mt-1">per year</p>
                </div>
              </div>

              <p className="mt-4 text-xs text-white/25 italic">
                Actual earnings depend on campaign bookings and screen uptime. Minimum guaranteed payout applies once live.
              </p>
            </div>

            {/* Bottom CTA */}
            <div className="px-8 sm:px-10 py-6 bg-gray-50 dark:bg-card flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-gray-900 dark:text-foreground">Ready to start earning?</p>
                <p className="text-xs text-gray-500 dark:text-muted-foreground">Takes 2 minutes. Zero risk. Zero cost.</p>
              </div>
              <a
                href="#register"
                className="shrink-0 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)', boxShadow: '0 4px 16px -4px rgba(220,38,38,0.5)' }}
              >
                Register free <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Registration form ── */}
      <section
        id="register"
        className="py-20 sm:py-28"
        style={{ background: 'linear-gradient(160deg, #0a0000 0%, #1c0404 50%, #0a0000 100%)' }}
      >
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} viewport={{ once: true }}
            className="text-center mb-10"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400 mb-2">Join the network</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">Register your store</h2>
            <p className="text-sm text-white/50">Free installation · No contract · Cancel anytime</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} viewport={{ once: true }}
            className="rounded-3xl border border-white/10 p-6 sm:p-8"
            style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}
          >
            <RegistrationForm />
          </motion.div>

          {/* Trust signals */}
          <motion.div
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }} viewport={{ once: true }}
            className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-xs text-white/30"
          >
            {['₹0 installation cost', 'No long-term contract', 'Monthly UPI payout', '24/7 tech support'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-red-500" /> {t}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-6 text-center" style={{ background: '#050000' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          © 2025 ALIVE Advertising Pvt. Ltd. · Mangaluru, Karnataka ·{' '}
          <a href="mailto:hello@wearealive.in" className="hover:text-white/40 transition-colors">hello@wearealive.in</a>
        </p>
      </footer>
    </div>
  );
}
