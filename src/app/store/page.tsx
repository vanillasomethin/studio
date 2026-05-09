'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, ArrowLeft, Check, Loader2, MapPin, Navigation,
  IndianRupee, Shield, Zap, TrendingUp, Star, Clock, Wifi,
  PhoneCall, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Logo } from '@/components/icons/logo';

// ─── Animation variants ─────────────────────────────────────────────────────

const stepVariants = {
  enter:  (dir: number) => ({ opacity: 0, y: dir >= 0 ? 24 : -16, scale: 0.986 }),
  center: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } },
  exit:   (dir: number) => ({ opacity: 0, y: dir >= 0 ? -16 : 24, scale: 0.986, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }),
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

// ─── Benefit cards ──────────────────────────────────────────────────────────

const BENEFITS = [
  {
    icon: IndianRupee,
    title: '₹2,500 – ₹8,000/month',
    subtitle: 'Passive income, every month',
    desc: 'Earn guaranteed revenue just by hosting our digital screen. No sales, no effort.',
    color: 'from-emerald-500/20 to-emerald-600/10',
    iconColor: 'text-emerald-400',
  },
  {
    icon: Zap,
    title: 'Zero Upfront Cost',
    subtitle: 'We install everything free',
    desc: 'Screen, hardware, wiring — fully installed at no cost to you. We own the equipment.',
    color: 'from-yellow-500/20 to-yellow-600/10',
    iconColor: 'text-yellow-400',
  },
  {
    icon: Shield,
    title: 'We Handle Everything',
    subtitle: 'Tech, content & maintenance',
    desc: 'Our team manages all content and operations remotely. Zero workload for you.',
    color: 'from-blue-500/20 to-blue-600/10',
    iconColor: 'text-blue-400',
  },
  {
    icon: TrendingUp,
    title: 'Attract More Customers',
    subtitle: 'A modern, vibrant store',
    desc: 'Bright digital screens draw attention and make your store stand out on the street.',
    color: 'from-violet-500/20 to-violet-600/10',
    iconColor: 'text-violet-400',
  },
  {
    icon: Clock,
    title: 'No Disruption',
    subtitle: 'Keep running as usual',
    desc: 'Screen goes on your wall. Your store keeps running exactly as before — we promise.',
    color: 'from-orange-500/20 to-orange-600/10',
    iconColor: 'text-orange-400',
  },
  {
    icon: Star,
    title: 'First-Mover Advantage',
    subtitle: 'Limited spots per area',
    desc: 'We take only 1–2 stores per locality. Register now before your competitor does.',
    color: 'from-red-500/20 to-red-600/10',
    iconColor: 'text-red-400',
  },
  {
    icon: Wifi,
    title: 'Remote Monitoring',
    subtitle: '24/7 uptime guarantee',
    desc: 'Our systems monitor your screen around the clock. Any issue, we fix it remotely.',
    color: 'from-cyan-500/20 to-cyan-600/10',
    iconColor: 'text-cyan-400',
  },
  {
    icon: PhoneCall,
    title: 'Dedicated Support',
    subtitle: 'WhatsApp, call, or visit',
    desc: 'A dedicated relationship manager handles all your queries and concerns personally.',
    color: 'from-pink-500/20 to-pink-600/10',
    iconColor: 'text-pink-400',
  },
];

// ─── Scrolling benefit panel ────────────────────────────────────────────────

function BenefitPanel() {
  const col1 = BENEFITS.slice(0, 4);
  const col2 = BENEFITS.slice(4);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)' }}>
      <div className="flex gap-3 h-full">
        {/* Column 1 — scroll up */}
        <div className="flex flex-col gap-3 animate-scroll-up flex-1">
          {[...col1, ...col1].map((b, i) => (
            <BenefitCard key={i} b={b} />
          ))}
        </div>
        {/* Column 2 — scroll down */}
        <div className="flex flex-col gap-3 animate-scroll-down flex-1 mt-[-60px]">
          {[...col2, ...col2].map((b, i) => (
            <BenefitCard key={i} b={b} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BenefitCard({ b }: { b: typeof BENEFITS[0] }) {
  const Icon = b.icon;
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${b.color} p-4 shrink-0 backdrop-blur-sm`}>
      <div className={`mb-2 w-fit rounded-xl bg-white/10 p-2`}>
        <Icon className={`h-5 w-5 ${b.iconColor}`} />
      </div>
      <p className="text-sm font-bold text-white leading-tight">{b.title}</p>
      <p className={`text-xs font-semibold mt-0.5 ${b.iconColor}`}>{b.subtitle}</p>
      <p className="text-xs text-white/60 mt-1.5 leading-relaxed">{b.desc}</p>
    </div>
  );
}

// ─── Floating Label Input ───────────────────────────────────────────────────

function FloatingInput({
  id, label, type = 'text', value, onChange, prefix, readOnly, autoComplete,
}: {
  id: string; label: string; type?: string;
  value: string; onChange: (v: string) => void;
  prefix?: string; readOnly?: boolean; autoComplete?: string;
}) {
  return (
    <div className="relative flex items-stretch">
      {prefix && (
        <span className="flex items-center px-3 rounded-l-xl border border-r-0 border-border bg-muted text-sm font-semibold text-muted-foreground">
          {prefix}
        </span>
      )}
      <div className="relative flex-1">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          autoComplete={autoComplete ?? 'off'}
          placeholder=" "
          className={`peer w-full h-14 ${prefix ? 'rounded-r-xl' : 'rounded-xl'} border border-border bg-card px-4 pb-1.5 pt-5 text-sm text-foreground transition-all placeholder-transparent focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${readOnly ? 'bg-muted/40 cursor-default' : ''}`}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground transition-all duration-200
            peer-focus:-translate-y-[1.2rem] peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-primary
            peer-[:not(:placeholder-shown)]:-translate-y-[1.2rem] peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-widest peer-[:not(:placeholder-shown)]:text-muted-foreground"
        >
          {label}
        </label>
      </div>
    </div>
  );
}

// ─── Step indicator ─────────────────────────────────────────────────────────

const STEPS = ['Store', 'Contact', 'Location'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const n      = i + 1;
        const done   = current > n;
        const active = current === n;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                done   ? 'bg-primary text-white' :
                active ? 'bg-primary text-white ring-[3px] ring-primary/25' :
                         'bg-muted text-muted-foreground'
              }`}>
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${
                active ? 'text-foreground' : 'text-muted-foreground/40'
              }`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-8 sm:w-12 mb-4 mx-1.5 transition-all duration-500 ${done ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

type FormData = {
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

const INITIAL: FormData = {
  storeName: '',
  ownerName: '',
  whatsapp:  '',
  address:   '',
  locality:  '',
  city:      '',
  pincode:   '',
  lat:       '',
  lng:       '',
};

// ─── Steps ──────────────────────────────────────────────────────────────────

function StepStore({ form, set }: { form: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <motion.div key="store" variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={fadeUp} className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Step 1 of 3</p>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Tell us about your store</h2>
        <p className="text-sm text-muted-foreground">Your kirana, your name — let's get started.</p>
      </motion.div>
      <motion.div variants={fadeUp} className="space-y-4">
        <FloatingInput
          id="storeName"
          label="Store name"
          value={form.storeName}
          onChange={(v) => set('storeName', v)}
          autoComplete="organization"
        />
        <FloatingInput
          id="ownerName"
          label="Owner / your name"
          value={form.ownerName}
          onChange={(v) => set('ownerName', v)}
          autoComplete="name"
        />
      </motion.div>
    </motion.div>
  );
}

function StepContact({ form, set }: { form: FormData; set: (k: keyof FormData, v: string) => void }) {
  return (
    <motion.div key="contact" variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={fadeUp} className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Step 2 of 3</p>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Your WhatsApp number</h2>
        <p className="text-sm text-muted-foreground">We'll use this to verify your identity and keep you updated.</p>
      </motion.div>
      <motion.div variants={fadeUp} className="space-y-4">
        <FloatingInput
          id="whatsapp"
          label="WhatsApp number"
          type="tel"
          prefix="+91"
          value={form.whatsapp}
          onChange={(v) => set('whatsapp', v.replace(/\D/g, '').slice(0, 10))}
          autoComplete="tel"
        />
        <div className="flex items-start gap-3 rounded-xl bg-[#25D366]/8 border border-[#25D366]/20 px-4 py-3">
          {/* WhatsApp icon */}
          <svg viewBox="0 0 24 24" className="h-4 w-4 mt-0.5 shrink-0 fill-[#25D366]">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We'll send you a WhatsApp message to confirm your registration and schedule installation.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

type GeoStatus = 'idle' | 'loading' | 'done' | 'error';

function StepLocation({ form, set }: { form: FormData; set: (k: keyof FormData, v: string) => void }) {
  const [geoStatus, setGeoStatus] = useState<GeoStatus>(form.lat ? 'done' : 'idle');
  const [geoError,  setGeoError]  = useState<string | null>(null);

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoStatus('loading');
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        set('lat', String(lat));
        set('lng', String(lng));

        try {
          // OpenStreetMap Nominatim — no API key needed
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } },
          );
          const data = await res.json();
          const addr = data.address ?? {};

          const locality =
            addr.suburb || addr.neighbourhood || addr.village ||
            addr.county || addr.state_district || '';
          const pincode  = addr.postcode ?? '';
          const city     =
            addr.city || addr.town || addr.municipality || addr.state_district || '';

          set('locality', locality);
          set('pincode',  pincode.replace(/\D/g, '').slice(0, 6));
          set('city',     city);
          setGeoStatus('done');
        } catch {
          setGeoStatus('done'); // coords saved, just address lookup failed
        }
      },
      (err) => {
        setGeoError(
          err.code === 1
            ? 'Location access denied. Please allow location in your browser and try again.'
            : 'Could not get your location. Please fill the address manually.',
        );
        setGeoStatus('error');
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  return (
    <motion.div key="location" variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={fadeUp} className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Step 3 of 3</p>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Locate your shop</h2>
        <p className="text-sm text-muted-foreground">We use your GPS location to find the exact area and pincode.</p>
      </motion.div>

      <motion.div variants={fadeUp} className="space-y-4">
        {/* Locate button */}
        <button
          type="button"
          onClick={locate}
          disabled={geoStatus === 'loading'}
          className={`w-full flex items-center justify-center gap-2.5 rounded-xl border-2 py-4 text-sm font-bold transition-all ${
            geoStatus === 'done'
              ? 'border-green-500 bg-green-500/8 text-green-600'
              : geoStatus === 'error'
              ? 'border-destructive bg-destructive/5 text-destructive'
              : 'border-primary bg-primary/5 text-primary hover:bg-primary/10'
          }`}
        >
          {geoStatus === 'loading' ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Detecting location…</>
          ) : geoStatus === 'done' ? (
            <><CheckCircle2 className="h-4 w-4" /> Location detected — tap to update</>
          ) : (
            <><Navigation className="h-4 w-4" /> Use my current location</>
          )}
        </button>

        {geoError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            <p className="text-xs text-destructive leading-relaxed">{geoError}</p>
          </div>
        )}

        {/* Auto-filled fields */}
        <div className="grid grid-cols-2 gap-3">
          <FloatingInput
            id="locality"
            label="Locality / area"
            value={form.locality}
            onChange={(v) => set('locality', v)}
          />
          <FloatingInput
            id="pincode"
            label="Pincode"
            value={form.pincode}
            onChange={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))}
          />
        </div>
        <FloatingInput
          id="city"
          label="City"
          value={form.city}
          onChange={(v) => set('city', v)}
        />

        {/* Address (door no. / landmark) */}
        <div className="relative">
          <textarea
            id="address"
            rows={3}
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder=" "
            className="peer w-full rounded-xl border border-border bg-card px-4 pb-2 pt-6 text-sm text-foreground transition-all placeholder-transparent focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <label
            htmlFor="address"
            className="pointer-events-none absolute left-4 top-4 text-sm text-muted-foreground transition-all duration-200
              peer-focus:top-2 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-primary
              peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-widest peer-[:not(:placeholder-shown)]:text-muted-foreground"
          >
            Door no., street & landmark
          </label>
        </div>

        {geoStatus === 'done' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>Coordinates saved · {parseFloat(form.lat).toFixed(4)}°N, {parseFloat(form.lng).toFixed(4)}°E</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function StorePage() {
  const router = useRouter();
  const [step,      setStep]      = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [form,      setForm]      = useState<FormData>(INITIAL);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const set = (k: keyof FormData, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const next = () => { setDirection(1);  setStep((s) => Math.min(s + 1, STEPS.length)); };
  const back = () => { setDirection(-1); setStep((s) => Math.max(s - 1, 1)); };

  const step1Valid = form.storeName.trim() && form.ownerName.trim();
  const step2Valid = form.whatsapp.length === 10;
  const step3Valid = form.locality.trim() && form.city.trim() && form.pincode.length === 6;

  const canNext = step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid;

  const handleSubmit = async () => {
    if (!canNext) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stores/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, phone: `+91${form.whatsapp}` }),
      });
      if (!res.ok) throw new Error('Submission failed. Please try again.');
      // Store info in sessionStorage for the dashboard to read
      sessionStorage.setItem('alive_store', JSON.stringify({ ...form, phone: `+91${form.whatsapp}` }));
      router.push('/store-dashboard');
    } catch (e) {
      setError((e as Error).message ?? 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">

      {/* ── Left panel ─── */}
      <div
        className="hidden md:flex md:w-[42%] lg:w-[38%] flex-col p-8 lg:p-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0f0f0f 0%, #1a0a0a 60%, #0f0f0f 100%)' }}
      >
        {/* Logo */}
        <a href="/" className="shrink-0 opacity-80 hover:opacity-100 transition-opacity">
          <Logo />
        </a>

        {/* Heading */}
        <div className="mt-10 mb-6 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80">Store Partners</p>
          <h1 className="text-3xl font-bold text-white leading-tight">
            Your wall.<br />
            <span className="text-primary">Your income.</span>
          </h1>
          <p className="text-sm text-white/50 leading-relaxed">
            Join 100+ kirana stores across Mangaluru earning passive income with Alive.
          </p>
        </div>

        {/* Scrolling benefit cards */}
        <div className="flex-1 min-h-0">
          <BenefitPanel />
        </div>

        {/* Bottom stat bar */}
        <div className="mt-6 grid grid-cols-3 gap-3 shrink-0">
          {[
            { value: '100+', label: 'Active stores' },
            { value: '₹0',   label: 'Upfront cost' },
            { value: '48h',  label: 'To go live' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center">
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col min-h-screen md:min-h-0">

        {/* Mobile header */}
        <header className="md:hidden border-b border-border/30 bg-background/90 backdrop-blur-md shrink-0">
          <div className="flex h-14 items-center justify-between px-4">
            <a href="/" className="opacity-70 hover:opacity-100 transition-opacity"><Logo /></a>
          </div>
        </header>

        <div className="flex-1 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16 max-w-lg mx-auto w-full">

          {/* Step indicator */}
          <div className="mb-8">
            <StepIndicator current={step} />
          </div>

          {/* Step content */}
          <div className="relative overflow-hidden" style={{ minHeight: 340 }}>
            <AnimatePresence custom={direction} mode="wait">
              <motion.div
                key={step}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                {step === 1 && <StepStore    form={form} set={set} />}
                {step === 2 && <StepContact  form={form} set={set} />}
                {step === 3 && <StepLocation form={form} set={set} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={back}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}

            {step < STEPS.length ? (
              <button
                onClick={next}
                disabled={!canNext}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-700 px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_16px_-4px_rgba(220,38,38,0.5)] transition-all hover:from-red-600 hover:to-red-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={busy || !canNext}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-700 px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_16px_-4px_rgba(220,38,38,0.5)] transition-all hover:from-red-600 hover:to-red-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Registering…</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Register my store</>
                )}
              </button>
            )}
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground/50">
            Already a partner?{' '}
            <a href="/store-dashboard" className="text-primary hover:underline">
              Go to dashboard →
            </a>
          </p>
        </div>
      </div>

      {/* Global scroll animation styles */}
      <style jsx global>{`
        @keyframes scrollUp {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes scrollDown {
          0%   { transform: translateY(-50%); }
          100% { transform: translateY(0); }
        }
        .animate-scroll-up {
          animation: scrollUp 28s linear infinite;
        }
        .animate-scroll-down {
          animation: scrollDown 28s linear infinite;
        }
        .animate-scroll-up:hover,
        .animate-scroll-down:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
