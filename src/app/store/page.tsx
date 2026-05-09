'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  IndianRupee, Zap, Shield, CheckCircle2, AlertCircle, MapPin,
  ChevronRight, Check, ArrowLeft, Loader2, Clock, Star, Gift, Copy,
} from 'lucide-react';
import { Logo } from '@/components/icons/logo';
import MapPicker from '@/components/map-picker';

// ─── Types ───────────────────────────────────────────────────────────────────

type Form = {
  storeName: string; ownerName: string; whatsapp: string; password: string;
  address: string; locality: string; city: string; pincode: string;
  lat: string; lng: string; referredBy: string;
};
const INIT: Form = {
  storeName: '', ownerName: '', whatsapp: '', password: '',
  address: '', locality: '', city: '', pincode: '', lat: '', lng: '', referredBy: '',
};

type FieldErrors = Partial<Record<keyof Form, string>>;

function validate(form: Form): FieldErrors {
  const e: FieldErrors = {};
  if (!form.storeName.trim())        e.storeName = 'Store name is required';
  if (!form.ownerName.trim())        e.ownerName = 'Owner name is required';
  if (form.whatsapp.length !== 10)   e.whatsapp  = 'Enter a valid 10-digit WhatsApp number';
  if (form.password.length < 6)      e.password  = 'Password must be at least 6 characters';
  if (!form.city.trim())             e.city      = 'City is required';
  if (form.pincode.length !== 6)     e.pincode   = 'Enter a valid 6-digit pincode';
  return e;
}

function makeReferralCode(storeName: string, ownerName: string): string {
  const s = storeName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const o = ownerName.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${s}${o}${r}`;
}

// ─── Reusable field ───────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = 'text', placeholder, prefix, error, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; prefix?: string; error?: string; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</label>
      <div className="flex">
        {prefix && (
          <span className={`flex items-center px-3 rounded-l-xl text-sm font-bold border-y border-l bg-white/10 ${error ? 'border-red-500/60' : 'border-white/20'}`} style={{ color: 'rgba(255,255,255,0.7)' }}>{prefix}</span>
        )}
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-white/10 text-white placeholder-white/25 focus:outline-none focus:ring-1 transition-all
            ${prefix ? 'rounded-l-none' : ''}
            ${error ? 'border-red-500/60 focus:border-red-400 focus:ring-red-400/25' : 'border-white/20 focus:border-red-400 focus:ring-red-400/25'}`}
        />
      </div>
      {hint && !error && <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{hint}</p>}
      {error && (
        <p className="text-[11px] text-red-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

// ─── Agreement step ───────────────────────────────────────────────────────────

function AgreementStep({ form, agreed, setAgreed, onBack, onSubmit, busy, err }: {
  form: Form; agreed: boolean; setAgreed: (v: boolean) => void;
  onBack: () => void; onSubmit: () => void; busy: boolean; err: string;
}) {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="space-y-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
        <ArrowLeft className="h-3 w-3" /> Back to form
      </button>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">Step 2 of 2 — Agreement</p>
        <h3 className="text-base font-black text-white mt-0.5">Store Partner Agreement</h3>
      </div>

      {/* Prefilled parties — prominent */}
      <div className="rounded-xl border border-white/15 p-3" style={{ background: 'rgba(239,68,68,0.06)' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-black text-white truncate">{form.storeName}</p>
            <p className="text-xs text-white/50 mt-0.5">{form.ownerName} · +91 {form.whatsapp}</p>
            {form.city && <p className="text-[10px] text-white/35 mt-0.5">{[form.locality, form.city, form.pincode].filter(Boolean).join(', ')}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] text-white/30">VS Collective LLP</p>
            <p className="text-[10px] text-white/25">(ALIVE) · {today}</p>
          </div>
        </div>
      </div>

      {/* Terms — compact */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {[
          { t: 'Remuneration', d: '₹500/month per screen, fixed. Paid within 10 working days of month end.' },
          { t: 'Electricity',  d: 'ALIVE reimburses at screen rated power × actual hours × prevailing tariff.' },
          { t: 'Equipment',    d: 'Screen installed free. Remains ALIVE property at all times.' },
          { t: 'Exit',         d: '30 days written notice by either party. ALIVE removes screen at its cost.' },
        ].map(({ t, d }, i) => (
          <div key={t} className={`px-3 py-2 flex gap-2 text-xs ${i > 0 ? 'border-t border-white/8' : ''}`}>
            <span className="font-bold text-white/80 shrink-0 w-20">{t}</span>
            <span style={{ color: 'rgba(255,255,255,0.38)' }}>{d}</span>
          </div>
        ))}
        <div className="border-t border-white/8 px-3 py-2">
          <a href="/store-agreement" target="_blank" rel="noreferrer" className="text-[11px] text-red-400 hover:text-red-300 font-semibold underline underline-offset-2">
            Read full agreement →
          </a>
        </div>
      </div>

      {/* Confirm checkbox */}
      <label className="flex items-start gap-2 cursor-pointer pt-1">
        <div className="relative mt-0.5 shrink-0">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="sr-only" />
          <div className={`h-4.5 w-4.5 h-[18px] w-[18px] rounded border-2 transition-all flex items-center justify-center ${agreed ? 'border-red-400 bg-red-500' : 'border-white/30 bg-white/8'}`}>
            {agreed && <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
        </div>
        <span className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
          I, <strong className="text-white">{form.ownerName}</strong>, agree to the Store Partner Agreement between <strong className="text-white">{form.storeName}</strong> and VS Collective LLP (ALIVE), effective {today}.
        </span>
      </label>

      {err && (
        <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/8 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" />
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
  const [form,   setForm]    = useState<Form>(INIT);
  const [step,   setStep]    = useState<1 | 2>(1);
  const [agreed, setAgreed]  = useState(false);
  const [busy,   setBusy]    = useState(false);
  const [err,    setErr]     = useState('');
  const [done,   setDone]    = useState(false);
  const [touched, setTouched] = useState(false);
  const [refCode, setRefCode] = useState('');
  const [copied,  setCopied]  = useState(false);

  const set = (k: keyof Form, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const errors = useMemo(() => validate(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;

  const handleLocation = (lat: string, lng: string, locality: string, pincode: string, city: string) => {
    setForm((p) => ({ ...p, lat, lng, locality: locality || p.locality, pincode: pincode || p.pincode, city: city || p.city }));
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors) { setTouched(true); return; }
    setStep(2);
  };

  const submit = async () => {
    setBusy(true); setErr('');
    const code = makeReferralCode(form.storeName, form.ownerName);
    setRefCode(code);
    const session = { ...form, phone: `+91${form.whatsapp}`, referralCode: code, screens: 1 };
    try {
      await fetch('/api/stores/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session) });
      localStorage.setItem('alive_store_session', JSON.stringify(session));
      setDone(true);
    } catch (e) {
      setErr((e as Error).message ?? 'Something went wrong.');
    } finally { setBusy(false); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(refCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  if (done) return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4 py-4">
      <div className="flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 ring-8 ring-red-500/8">
          <CheckCircle2 className="h-7 w-7 text-red-400" />
        </div>
      </div>
      <div>
        <p className="text-lg font-bold text-white">Registration received!</p>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Your store partner account is being set up.</p>
      </div>
      {/* Show referral code */}
      <div className="rounded-xl border border-white/15 p-4" style={{ background: 'rgba(239,68,68,0.08)' }}>
        <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1">Your referral code</p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl font-black tracking-widest text-white">{refCode}</span>
          <button onClick={copyCode} className="text-white/40 hover:text-white transition-colors">
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Share this code with other store owners. Earn ₹500 for every new partner who joins using your code.
        </p>
      </div>
      <button
        onClick={() => router.push('/store-dashboard')}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white"
        style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}
      >
        Go to my dashboard <ChevronRight className="h-4 w-4" />
      </button>
    </motion.div>
  );

  if (step === 2) return (
    <AgreementStep form={form} agreed={agreed} setAgreed={setAgreed} onBack={() => setStep(1)} onSubmit={submit} busy={busy} err={err} />
  );

  const fe = (k: keyof Form) => touched && errors[k] ? errors[k] : undefined;

  return (
    <form onSubmit={handleContinue} className="space-y-3">

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-1">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black">1</span>
        <div className="flex-1 h-px bg-white/10" />
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 text-white/30 text-[10px] font-black">2</span>
        <span className="text-[10px] text-white/25">Agreement</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Store name" value={form.storeName} onChange={(v) => set('storeName', v)} placeholder="Sharma Store" error={fe('storeName')} />
        <Field label="Owner name" value={form.ownerName} onChange={(v) => set('ownerName', v)} placeholder="Ramesh Sharma" error={fe('ownerName')} />
      </div>

      {/* WhatsApp */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>WhatsApp number</label>
          <span className="text-[10px] font-semibold rounded-full px-2 py-0.5" style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>Your username</span>
        </div>
        <div className="flex">
          <span className={`flex items-center px-3 rounded-l-xl text-sm font-bold border-y border-l bg-white/10 ${touched && errors.whatsapp ? 'border-red-500/60' : 'border-white/20'}`} style={{ color: 'rgba(255,255,255,0.7)' }}>+91</span>
          <input type="tel" inputMode="numeric" maxLength={10} value={form.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="98765 43210"
            className={`w-full px-3 py-2.5 text-sm rounded-r-xl border bg-white/10 text-white placeholder-white/25 focus:outline-none focus:ring-1 transition-all
              ${touched && errors.whatsapp ? 'border-red-500/60 focus:border-red-400 focus:ring-red-400/25' : 'border-white/20 focus:border-red-400 focus:ring-red-400/25'}`}
          />
        </div>
        {touched && errors.whatsapp && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.whatsapp}</p>}
      </div>

      {/* Password */}
      <div className="space-y-1">
        <label className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>Password</label>
        <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min. 6 characters"
          className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-white/10 text-white placeholder-white/25 focus:outline-none focus:ring-1 transition-all
            ${touched && errors.password ? 'border-red-500/60 focus:border-red-400 focus:ring-red-400/25' : 'border-white/20 focus:border-red-400 focus:ring-red-400/25'}`}
        />
        {touched && errors.password
          ? <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.password}</p>
          : <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Use this password to sign in to your dashboard.</p>
        }
      </div>

      {/* Map */}
      <div className="space-y-1">
        <label className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>Pin your shop on the map</label>
        <MapPicker lat={form.lat} lng={form.lng} onLocation={handleLocation} />
      </div>

      {/* Address */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Locality" value={form.locality} onChange={(v) => set('locality', v)} placeholder="Kankanady" />
        <Field label="Pincode" value={form.pincode} onChange={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))} placeholder="575002" error={fe('pincode')} />
      </div>
      <Field label="City" value={form.city} onChange={(v) => set('city', v)} placeholder="Mangaluru" error={fe('city')} />

      <div className="space-y-1">
        <label className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Door no. &amp; street <span className="normal-case font-normal opacity-50">(optional)</span>
        </label>
        <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Door no., street, landmark…"
          className="w-full px-3 py-2.5 text-sm rounded-xl border border-white/20 bg-white/10 text-white placeholder-white/25 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/25 transition-all resize-none"
        />
      </div>

      {/* Referral code */}
      <div className="space-y-1">
        <label className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Referral code <span className="normal-case font-normal opacity-50">(optional)</span>
        </label>
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 shrink-0 text-red-500/60" />
          <input type="text" value={form.referredBy} onChange={(e) => set('referredBy', e.target.value.toUpperCase())} placeholder="e.g. SHAR123"
            className="flex-1 px-3 py-2.5 text-sm rounded-xl border border-white/15 bg-white/5 text-white placeholder-white/20 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/25 transition-all tracking-widest font-mono"
          />
        </div>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Got a code from another store partner? Enter it to help them earn ₹500.</p>
      </div>

      {/* Submit */}
      <button type="submit"
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all"
        style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)', boxShadow: '0 8px 24px -6px rgba(220,38,38,0.4)' }}
      >
        Continue to Agreement <ChevronRight className="h-4 w-4" />
      </button>

      {touched && hasErrors && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-center text-xs text-red-400">
          Please fix the highlighted fields above to continue.
        </motion.p>
      )}

      <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
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
      <header className="border-b border-white/8 bg-black/30 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/"><Logo /></a>
          <a href="/store-dashboard" className="text-xs font-semibold text-white/40 hover:text-white/70 transition-colors">Partner login →</a>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-16 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

        {/* Left: pitch */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="lg:sticky lg:top-24 space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[11px] font-bold text-red-300 tracking-wider uppercase">Kirana Partners · Mangaluru</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-[1.08] tracking-tight">
              Extra income.<br /><span style={{ color: '#ef4444' }}>Zero effort.</span>
            </h1>
            <p className="text-base text-white/55 leading-relaxed">
              Alive installs a free digital screen in your store. Brands pay to advertise on it.
              You earn <span className="text-white font-semibold">₹500 + electricity every month</span> — without lifting a finger.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: IndianRupee, label: '₹500 + electricity/month', sub: 'Fixed. Paid every month via UPI.' },
              { icon: Zap,         label: 'Zero upfront cost',        sub: 'Screen installed free. We own it.' },
              { icon: Shield,      label: 'We manage everything',     sub: 'Content, tech, support — all on us.' },
              { icon: Clock,       label: 'Live in 48 hours',         sub: 'Our team visits and installs within 2 days.' },
              { icon: Star,        label: 'Exclusive per locality',   sub: 'Only 1–2 stores selected per area.' },
              { icon: Gift,        label: 'Referral rewards',         sub: 'Earn ₹500 for every new partner you refer.' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <div>
                  <p className="text-sm font-bold text-white">{label}</p>
                  <p className="text-xs text-white/40">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/8 pt-5 space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">How it works</p>
            {[
              { n: '01', t: 'Register below',     d: 'Takes 2 minutes.' },
              { n: '02', t: 'We visit & install', d: 'Free screen within 48 h.' },
              { n: '03', t: 'Earn every month',   d: '₹500 + electricity to your account.' },
            ].map(({ n, t, d }) => (
              <div key={n} className="flex items-start gap-3">
                <span className="text-[11px] font-black text-red-500/70 mt-0.5 w-5 shrink-0">{n}</span>
                <div>
                  <p className="text-xs font-bold text-white">{t}</p>
                  <p className="text-[11px] text-white/35">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}
          className="rounded-3xl border border-white/10 p-5 sm:p-7"
          style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}
        >
          <div className="mb-4">
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
