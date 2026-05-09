'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  IndianRupee, Zap, Shield, CheckCircle2, AlertCircle, MapPin,
  Phone, ChevronRight, Check, ArrowLeft, Loader2, Clock, Star,
} from 'lucide-react';
import { Logo } from '@/components/icons/logo';
import MapPicker from '@/components/map-picker';

// ─── Form type ────────────────────────────────────────────────────────────────

type Form = {
  storeName: string; ownerName: string; whatsapp: string; password: string;
  address: string; locality: string; city: string; pincode: string;
  lat: string; lng: string;
};
const INIT: Form = { storeName: '', ownerName: '', whatsapp: '', password: '', address: '', locality: '', city: '', pincode: '', lat: '', lng: '' };

function Field({ label, value, onChange, type = 'text', placeholder, prefix }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; prefix?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</label>
      <div className="flex">
        {prefix && (
          <span className="flex items-center px-3 rounded-l-xl text-sm font-bold border-y border-l border-white/20 bg-white/10" style={{ color: 'rgba(255,255,255,0.7)' }}>{prefix}</span>
        )}
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full px-3 py-2.5 text-sm rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/25 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/25 transition-all ${prefix ? 'rounded-l-none' : ''}`}
        />
      </div>
    </div>
  );
}

// ─── Step 2 — Agreement ───────────────────────────────────────────────────────

function AgreementStep({ form, agreed, setAgreed, onBack, onSubmit, busy, err }: {
  form: Form; agreed: boolean; setAgreed: (v: boolean) => void;
  onBack: () => void; onSubmit: () => void; busy: boolean; err: string;
}) {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28 }} className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400 mb-0.5">Step 2 of 2 — Review agreement</p>
        <h3 className="text-lg font-black text-white">Store Partner Agreement</h3>
      </div>

      {/* Autofilled party */}
      <div className="rounded-xl border border-white/10 p-3.5 space-y-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <p className="text-sm font-black text-white">{form.storeName || '—'}</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {form.ownerName} · +91 {form.whatsapp}
          {form.city ? ` · ${[form.locality, form.city, form.pincode].filter(Boolean).join(', ')}` : ''}
        </p>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          VS Collective LLP (ALIVE) · effective {today}
        </p>
      </div>

      {/* Key terms */}
      <div className="rounded-xl border border-white/10 divide-y divide-white/8 overflow-hidden text-xs">
        {[
          { term: 'Monthly remuneration', detail: '₹500/month per screen, fixed. Paid within 10 working days of month end via UPI/NEFT.' },
          { term: 'Electricity',          detail: 'ALIVE reimburses electricity based on screen rated power and actual hours run at prevailing tariff.' },
          { term: 'Equipment',           detail: 'Screen is installed free and remains ALIVE\'s property at all times.' },
          { term: 'Termination',         detail: 'Either party may exit with 30 days\' written notice. ALIVE removes the screen at its own cost.' },
        ].map(({ term, detail }) => (
          <div key={term} className="px-3.5 py-3">
            <p className="font-bold text-white mb-0.5">{term}</p>
            <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{detail}</p>
          </div>
        ))}
        <div className="px-3.5 py-2.5">
          <a href="/store-agreement" target="_blank" rel="noreferrer" className="text-red-400 hover:text-red-300 font-semibold underline underline-offset-2">
            Read full agreement →
          </a>
        </div>
      </div>

      {/* Confirm */}
      <label className="flex items-start gap-2.5 cursor-pointer">
        <div className="relative mt-0.5 shrink-0">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="sr-only" />
          <div className={`h-5 w-5 rounded-md border-2 transition-all flex items-center justify-center ${agreed ? 'border-red-400 bg-red-500' : 'border-white/30 bg-white/10'}`}>
            {agreed && <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
        </div>
        <span className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
          I, <strong className="text-white">{form.ownerName || 'the store owner'}</strong>, agree to the Store Partner Agreement between <strong className="text-white">{form.storeName || 'my store'}</strong> and VS Collective LLP (ALIVE), effective {today}.
        </span>
      </label>

      {err && (
        <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
          <p className="text-xs text-red-300">{err}</p>
        </div>
      )}

      <button
        type="button" onClick={onSubmit} disabled={busy || !agreed}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: agreed ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : '#dc2626', boxShadow: agreed ? '0 8px 24px -6px rgba(220,38,38,0.5)' : 'none' }}
      >
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Registering…</> : <><CheckCircle2 className="h-4 w-4" /> I agree — Register my store</>}
      </button>
    </motion.div>
  );
}

// ─── Registration form ────────────────────────────────────────────────────────

function RegistrationForm() {
  const router   = useRouter();
  const [form,   setForm]   = useState<Form>(INIT);
  const [step,   setStep]   = useState<1 | 2>(1);
  const [agreed, setAgreed] = useState(false);
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState('');
  const [done,   setDone]   = useState(false);

  const set = (k: keyof Form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleLocation = (lat: string, lng: string, locality: string, pincode: string, city: string) => {
    setForm((p) => ({ ...p, lat, lng, locality: locality || p.locality, pincode: pincode || p.pincode, city: city || p.city }));
  };

  const validStep1 = !!(form.storeName && form.ownerName && form.whatsapp.length === 10 && form.password.length >= 6 && form.city && form.pincode.length === 6);

  const submit = async () => {
    setBusy(true); setErr('');
    const session = { ...form, phone: `+91${form.whatsapp}` };
    try {
      await fetch('/api/stores/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session) });
      localStorage.setItem('alive_store_session', JSON.stringify(session));
      setDone(true);
      setTimeout(() => router.push('/store-dashboard'), 1500);
    } catch (e) {
      setErr((e as Error).message ?? 'Something went wrong.');
    } finally { setBusy(false); }
  };

  if (done) return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-3 py-6">
      <div className="flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 ring-8 ring-green-500/10">
          <CheckCircle2 className="h-7 w-7 text-green-400" />
        </div>
      </div>
      <p className="text-lg font-bold text-white">Registration received!</p>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Taking you to your dashboard…</p>
    </motion.div>
  );

  if (step === 2) return (
    <AgreementStep form={form} agreed={agreed} setAgreed={setAgreed} onBack={() => setStep(1)} onSubmit={submit} busy={busy} err={err} />
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (validStep1) setStep(2); }} className="space-y-3.5">

      {/* Step pill */}
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black">1</span>
        <div className="flex-1 h-px bg-white/10" />
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-white/30 text-[10px] font-black">2</span>
        <span className="text-[10px] text-white/25 font-medium">Agreement</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Store name" value={form.storeName} onChange={(v) => set('storeName', v)} placeholder="Sharma Store" />
        <Field label="Owner name" value={form.ownerName} onChange={(v) => set('ownerName', v)} placeholder="Ramesh Sharma" />
      </div>

      {/* WhatsApp */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>WhatsApp number</label>
          <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>Your username</span>
        </div>
        <div className="flex">
          <span className="flex items-center px-3 rounded-l-xl text-sm font-bold border-y border-l border-white/20 bg-white/10" style={{ color: 'rgba(255,255,255,0.7)' }}>+91</span>
          <input type="tel" inputMode="numeric" maxLength={10} value={form.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="98765 43210"
            className="w-full px-3 py-2.5 text-sm rounded-r-xl border border-white/20 bg-white/10 text-white placeholder-white/25 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/25 transition-all"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>Password</label>
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Min. 6 characters</span>
        </div>
        <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Set a login password"
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/25 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/25 transition-all"
        />
      </div>

      {/* Map */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>Pin your shop on the map</label>
        <MapPicker lat={form.lat} lng={form.lng} onLocation={handleLocation} />
      </div>

      {/* Address */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Locality" value={form.locality} onChange={(v) => set('locality', v)} placeholder="Kankanady" />
        <Field label="Pincode" value={form.pincode} onChange={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))} placeholder="575002" />
      </div>
      <Field label="City" value={form.city} onChange={(v) => set('city', v)} placeholder="Mangaluru" />

      <div className="space-y-1">
        <label className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Door no. &amp; street <span className="normal-case font-normal opacity-50">(optional)</span>
        </label>
        <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Door no., street, landmark…"
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/25 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/25 transition-all resize-none"
        />
      </div>

      <button type="submit" disabled={!validStep1}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: validStep1 ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : '#dc2626', boxShadow: validStep1 ? '0 8px 24px -6px rgba(220,38,38,0.5)' : 'none' }}
      >
        Continue to Agreement <ChevronRight className="h-4 w-4" />
      </button>

      <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Already registered?{' '}
        <a href="/store-dashboard" className="text-red-400 hover:text-red-300 underline-offset-2 hover:underline">Sign in →</a>
      </p>
    </form>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StorePage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #0a0000 0%, #1c0404 50%, #0a0000 100%)' }}>

      {/* Header */}
      <header className="border-b border-white/8 bg-black/30 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/"><Logo /></a>
          <a href="/store-dashboard" className="text-xs font-semibold text-white/40 hover:text-white/70 transition-colors">
            Partner login →
          </a>
        </div>
      </header>

      {/* Main — two columns on desktop */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-16 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

        {/* ── Left: pitch ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="lg:sticky lg:top-24 space-y-7">

          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[11px] font-bold text-red-300 tracking-wider uppercase">Kirana Partners · Mangaluru</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-[1.08] tracking-tight">
              Extra income.<br />
              <span style={{ color: '#ef4444' }}>Zero effort.</span>
            </h1>
            <p className="text-base text-white/55 leading-relaxed">
              Alive installs a free digital screen in your store. Brands pay to advertise on it.
              You earn <span className="text-white font-semibold">₹500 + electricity every month</span> — without lifting a finger.
            </p>
          </div>

          {/* Key benefits */}
          <div className="space-y-3">
            {[
              { icon: IndianRupee, label: '₹500 + electricity/month', sub: 'Fixed. Paid every month via UPI.',          color: '#22c55e' },
              { icon: Zap,         label: 'Zero upfront cost',        sub: 'Screen installed free. We own it.',          color: '#eab308' },
              { icon: Shield,      label: 'We manage everything',     sub: 'Content, tech, support — all on us.',        color: '#3b82f6' },
              { icon: Clock,       label: 'Live in 48 hours',         sub: 'Our team visits and installs within 2 days.', color: '#f97316' },
              { icon: Star,        label: 'Exclusive per locality',   sub: 'Only 1–2 stores selected per area.',         color: '#ef4444' },
            ].map(({ icon: Icon, label, sub, color }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}18` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{label}</p>
                  <p className="text-xs text-white/40">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Process */}
          <div className="rounded-2xl border border-white/10 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">How it works</p>
            {[
              { n: '1', t: 'Register below',       d: 'Takes 2 minutes.' },
              { n: '2', t: 'We visit & install',   d: 'Free screen within 48 h.' },
              { n: '3', t: 'Earn every month',     d: '₹500 + electricity to your account.' },
            ].map(({ n, t, d }) => (
              <div key={n} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-[10px] font-black mt-0.5">{n}</span>
                <div>
                  <p className="text-xs font-bold text-white">{t}</p>
                  <p className="text-[11px] text-white/35">{d}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust chips */}
          <div className="flex flex-wrap gap-2">
            {['₹0 installation', '₹500 + electricity/month', 'UPI payout', '24/7 support'].map((t) => (
              <span key={t} className="flex items-center gap-1 text-[11px] text-white/35 font-medium">
                <Check className="h-3 w-3 text-red-500" /> {t}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ── Right: form ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}
          className="rounded-3xl border border-white/10 p-5 sm:p-7"
          style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}
        >
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400 mb-0.5">Join the network</p>
            <h2 className="text-xl font-black text-white">Register your store</h2>
          </div>
          <RegistrationForm />
        </motion.div>
      </div>

      <footer className="border-t border-white/5 py-5 text-center mt-4">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
          © 2025 ALIVE Advertising Pvt. Ltd. · Mangaluru ·{' '}
          <a href="mailto:hello@wearealive.in" className="hover:text-white/30 transition-colors">hello@wearealive.in</a>
        </p>
      </footer>
    </div>
  );
}
