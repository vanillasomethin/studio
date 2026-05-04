'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { useAuth } from '@clerk/nextjs';
import { useSignIn, useSignUp } from '@clerk/nextjs/legacy';
import { Logo } from '@/components/icons/logo';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ArrowRight, ArrowLeft, Check, CheckCircle2, Loader2, AlertCircle,
  TrendingUp, Eye, Monitor, Mail, FileVideo, FileImage, Clock, CalendarDays, Phone,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type OnboardingFormData = {
  brandName: string;
  contactName: string;
  email: string;
  phone: string;
  gstin: string;
  screens: number;
  months: number;
  startDate: string;
  agreementSigned: boolean;
};

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id:   string;
  razorpay_signature:  string;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const SCREEN_TIERS = [
  { screens: 1,  pricePerScreen: 799,  playsPerDay: 144,  monthlyViews: 4320  },
  { screens: 3,  pricePerScreen: 699,  playsPerDay: 432,  monthlyViews: 12960, popular: true },
  { screens: 10, pricePerScreen: 599,  playsPerDay: 1440, monthlyViews: 43200 },
  { screens: 20, pricePerScreen: 549,  playsPerDay: 2880, monthlyViews: 86400 },
] as const;

const DURATION_OPTIONS = [
  { months: 1, label: '1 mo'  },
  { months: 2, label: '2 mo'  },
  { months: 3, label: '3 mo'  },
  { months: 6, label: '6 mo'  },
];

const STEPS = ['Details', 'Campaign', 'Account', 'Agreement', 'Payment'];

// ─── Utilities ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function getScreenPrice(n: number): number {
  if (n >= 20) return 549;
  if (n >= 10) return 599;
  if (n >= 3)  return 699;
  return 799;
}

const playsPerScreen   = 144;
const viewsPerScreenMo = 4320;

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof (window as Window & { Razorpay?: unknown }).Razorpay !== 'undefined') {
      resolve(); return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error('Razorpay failed to load'));
    document.head.appendChild(s);
  });
}

// ─── Animation variants ────────────────────────────────────────────────────────

const stepVariants = {
  enter:  { opacity: 0,  y: 28,  scale: 0.984 },
  center: { opacity: 1,  y: 0,   scale: 1,    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit:   { opacity: 0,  y: -18, scale: 0.984, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Floating Label Input ──────────────────────────────────────────────────────

function FloatingInput({
  id, label, type = 'text', value, onChange, autoComplete,
}: {
  id: string; label: string; type?: string;
  value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete ?? 'off'}
        placeholder=" "
        className="peer w-full h-14 rounded-xl border border-border bg-card px-4 pb-1.5 pt-5 text-sm text-foreground transition-all duration-200 placeholder-transparent focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
  );
}

// ─── Date Picker ───────────────────────────────────────────────────────────────

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value + 'T00:00:00') : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`relative w-full h-14 rounded-xl border bg-card px-4 pb-1.5 pt-5 text-left transition-all duration-200 ${
            open
              ? 'border-primary ring-2 ring-primary/20'
              : 'border-border hover:border-primary/40'
          }`}
        >
          <span className="absolute left-4 top-[0.55rem] text-[10px] font-bold uppercase tracking-widest text-primary">
            Campaign start date
          </span>
          <span className={`text-sm ${selected ? 'text-foreground' : 'text-muted-foreground'}`}>
            {selected ? format(selected, 'd MMMM yyyy') : 'Pick a date'}
          </span>
          <CalendarDays className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-border" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) { onChange(format(date, 'yyyy-MM-dd')); setOpen(false); }
          }}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Razorpay Logo ─────────────────────────────────────────────────────────────

function RazorpayMark() {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1L2 5v8l7 4 7-4V5L9 1z" fill="#3395FF" />
        <path d="M8.2 5.4h3.1l-1.4 3h2.6L7.8 13.2l1.6-4H6.9l1.3-3.8z" fill="white" />
      </svg>
      <span className="text-xs font-black tracking-tight" style={{ color: '#3395FF' }}>
        razorpay
      </span>
    </span>
  );
}

// ─── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => {
        const n      = i + 1;
        const done   = current > n;
        const active = current === n;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={done ? { scale: 1 } : active ? { scale: 1.1 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  done   ? 'bg-primary text-primary-foreground' :
                  active ? 'bg-primary text-primary-foreground ring-[3px] ring-primary/25' :
                           'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </motion.div>
              <span className={`hidden sm:block text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                active ? 'text-foreground' : 'text-muted-foreground/50'
              }`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <motion.div
                animate={{ backgroundColor: done ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}
                transition={{ duration: 0.4 }}
                className="h-px mx-2 sm:mx-3 mb-5 w-8 sm:w-12"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Steps ─────────────────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-12 py-10">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-xl">
        <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Brand Onboarding
        </motion.p>
        <motion.h1 variants={fadeUp} className="text-[42px] sm:text-[56px] font-bold tracking-tight leading-[1.08] text-foreground">
          Your brand.<br />
          <span className="text-primary">Every kirana. Every day.</span>
        </motion.h1>
        <motion.p variants={fadeUp} className="text-base text-muted-foreground leading-relaxed">
          Alive places your ads on digital screens inside kirana stores across
          the city — reaching millions of daily shoppers at the exact moment
          they make purchase decisions.
        </motion.p>
      </motion.div>

      <motion.div
        variants={stagger} initial="hidden" animate="show"
        className="grid grid-cols-3 gap-3 w-full max-w-lg"
      >
        {[
          { n: '01', title: 'Configure',  sub: 'Screens & duration'  },
          { n: '02', title: 'Sign',        sub: 'Digital agreement'   },
          { n: '03', title: 'Launch',      sub: 'Pay & go live'       },
        ].map(({ n, title, sub }) => (
          <motion.div key={n} variants={fadeUp} className="rounded-xl border border-border bg-card p-5 text-left space-y-3">
            <span className="text-[10px] font-black tracking-[0.2em] text-primary/60 uppercase">{n}</span>
            <div>
              <p className="text-sm font-bold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-4"
      >
        <motion.button
          type="button"
          onClick={onNext}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2.5 rounded-xl bg-primary px-10 py-3.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Begin onboarding <ArrowRight className="h-4 w-4" />
        </motion.button>
        <p className="text-xs text-muted-foreground/40 tracking-wide">
          Takes less than 5 minutes · 2025 · Alive Media Pvt. Ltd.
        </p>
      </motion.div>
    </div>
  );
}

function StepDetails({
  data, onChange, onNext, onBack,
}: {
  data: OnboardingFormData;
  onChange: (k: keyof OnboardingFormData, v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const valid = data.brandName && data.contactName && data.email;

  const fields = [
    { id: 'brandName',   label: 'Brand / company name', type: 'text',  ac: 'organization' },
    { id: 'contactName', label: 'Your full name',        type: 'text',  ac: 'name'         },
    { id: 'email',       label: 'Work email',            type: 'email', ac: 'email'        },
    { id: 'phone',       label: 'Phone / WhatsApp',      type: 'tel',   ac: 'tel'          },
    { id: 'gstin',       label: 'GSTIN (optional)',      type: 'text',  ac: 'off'          },
  ];

  return (
    <div className="space-y-8">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-1">
        <motion.h2 variants={fadeUp} className="text-2xl font-bold tracking-tight text-foreground">
          Brand details
        </motion.h2>
        <motion.p variants={fadeUp} className="text-sm text-muted-foreground">
          Basic information to set up your advertiser account.
        </motion.p>
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ id, label, type, ac }) => (
          <motion.div key={id} variants={fadeUp} className={id === 'gstin' ? 'sm:col-span-2' : ''}>
            <FloatingInput
              id={id}
              label={label}
              type={type}
              value={(data as unknown as Record<string, string>)[id]}
              onChange={(v) => onChange(id as keyof OnboardingFormData, v)}
              autoComplete={ac}
            />
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.3 }}
        className="flex gap-3 pt-2"
      >
        <Button variant="outline" onClick={onBack} className="gap-1.5 h-11">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!valid} className="gap-1.5 h-11 px-7">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}

function StepCampaign({
  data, onChange, onNext, onBack,
}: {
  data: OnboardingFormData;
  onChange: (k: keyof OnboardingFormData, v: number | string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const pricePerScreen = getScreenPrice(data.screens);
  const total          = pricePerScreen * data.screens * data.months;
  const valid          = data.screens > 0 && data.months > 0 && data.startDate;

  const adjustScreens = (delta: number) => {
    onChange('screens', Math.max(1, data.screens + delta));
  };

  return (
    <div className="space-y-8">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-1">
        <motion.h2 variants={fadeUp} className="text-2xl font-bold tracking-tight text-foreground">
          Campaign setup
        </motion.h2>
        <motion.p variants={fadeUp} className="text-sm text-muted-foreground">
          Choose your screen count, start date, and duration.
        </motion.p>
      </motion.div>

      {/* Screen tiers */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
        <motion.p variants={fadeUp} className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Screen plan
        </motion.p>
        <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 sm:grid-cols-4 mt-3">
          {SCREEN_TIERS.map((t) => {
            const active   = data.screens === t.screens;
            const popular  = 'popular' in t && t.popular;
            return (
              <motion.button
                key={t.screens}
                type="button"
                onClick={() => onChange('screens', t.screens)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className={`relative rounded-xl border border-border bg-card text-left ${popular ? 'pt-7 pb-4 px-4' : 'p-4'}`}
              >
                {popular && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground whitespace-nowrap">
                    Best value
                  </span>
                )}
                {active && (
                  <motion.div
                    layoutId="tier-ring"
                    className="absolute inset-0 rounded-xl border-2 border-primary bg-primary/5"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <div className="relative space-y-3">
                  <div>
                    <p className="text-2xl font-black text-foreground leading-none">{t.screens}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.screens === 1 ? 'screen' : 'screens'}</p>
                  </div>
                  <div className="border-t border-border pt-3 space-y-0.5">
                    <p className="text-sm font-bold text-foreground">{fmt(t.pricePerScreen)}</p>
                    <p className="text-[10px] text-muted-foreground leading-none">per screen / month</p>
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3 shrink-0" />
                      ~{(playsPerScreen * t.screens).toLocaleString('en-IN')}/day
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3 shrink-0" />
                      {(viewsPerScreenMo * t.screens).toLocaleString('en-IN')}/mo
                    </div>
                  </div>
                </div>
                {active && (
                  <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />
                )}
              </motion.button>
            );
          })}
        </motion.div>

        {/* Custom stepper */}
        <motion.div
          variants={fadeUp}
          className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">Custom count</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmt(pricePerScreen)} per screen · {fmt(pricePerScreen * data.screens)}/month
            </p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              onClick={() => adjustScreens(-1)}
              disabled={data.screens <= 1}
              whileTap={{ scale: 0.9 }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-lg font-bold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:opacity-30"
            >
              −
            </motion.button>
            <input
              type="number"
              min={1}
              value={data.screens}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1) onChange('screens', v);
              }}
              className="h-9 w-16 rounded-lg border border-border bg-background text-center text-base font-black text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <motion.button
              type="button"
              onClick={() => adjustScreens(1)}
              whileTap={{ scale: 0.9 }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-lg font-bold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
            >
              +
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Duration + Date */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-5 sm:grid-cols-2">
        <motion.div variants={fadeUp} className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Duration</p>
          <div className="grid grid-cols-4 gap-2">
            {DURATION_OPTIONS.map(({ months, label }) => (
              <motion.button
                key={months}
                type="button"
                onClick={() => onChange('months', months)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className={`relative rounded-lg border py-2.5 text-sm font-semibold overflow-hidden transition-colors ${
                  data.months === months
                    ? 'border-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {data.months === months && (
                  <motion.div
                    layoutId="duration-fill"
                    className="absolute inset-0 bg-primary"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative">{label}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <DatePicker value={data.startDate} onChange={(v) => onChange('startDate', v)} />
        </motion.div>
      </motion.div>

      {/* Live total */}
      <AnimatePresence>
        {data.screens > 0 && data.months > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Campaign total</p>
                <p className="text-sm text-muted-foreground">
                  {fmt(pricePerScreen)} × {data.screens} {data.screens === 1 ? 'screen' : 'screens'} × {data.months} {data.months === 1 ? 'month' : 'months'}
                </p>
              </div>
              <div className="text-right">
                <motion.p
                  key={total}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1,    opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="text-3xl font-black text-foreground tracking-tight"
                >
                  {fmt(total)}
                </motion.p>
                <p className="text-xs text-muted-foreground mt-0.5">GST invoice on payment</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-center">
              {[
                { Icon: Monitor,    label: 'Screens',     value: data.screens.toString() },
                { Icon: TrendingUp, label: 'Daily plays', value: `~${(playsPerScreen * data.screens).toLocaleString('en-IN')}` },
                { Icon: Eye,        label: 'Total views', value: `~${(viewsPerScreenMo * data.screens * data.months).toLocaleString('en-IN')}` },
              ].map(({ Icon, label, value }) => (
                <div key={label}>
                  <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm font-bold text-foreground">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="flex gap-3 pt-2"
      >
        <Button variant="outline" onClick={onBack} className="gap-1.5 h-11">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!valid} className="gap-1.5 h-11 px-7">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Google icon ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Step Auth ─────────────────────────────────────────────────────────────────

function StepAuth({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();

  const [phase,   setPhase]   = useState<'options' | 'otp'>('options');
  const [phone,   setPhone]   = useState('');
  const [otp,     setOtp]     = useState<string[]>(Array(6).fill(''));
  const [flow,    setFlow]    = useState<'signIn' | 'signUp'>('signIn');
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null));

  useEffect(() => {
    if (isLoaded && isSignedIn) onNext();
  }, [isLoaded, isSignedIn, onNext]);

  const handleGoogle = async () => {
    if (!isReady) return;
    setBusy(true);
    try {
      await signIn!.authenticateWithRedirect({
        strategy:            'oauth_google',
        redirectUrl:         '/sso-callback',
        redirectUrlComplete: '/brand-onboarding',
      });
    } catch {
      setError('Could not start Google sign-in. Try phone instead.');
      setBusy(false);
    }
  };

  const handleSendOtp = async () => {
    if (!isReady) return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setError('Enter a valid 10-digit number.'); return; }
    setBusy(true); setError(null);
    const fullPhone = '+91' + digits;
    try {
      await signIn!.create({ strategy: 'phone_code', identifier: fullPhone });
      setFlow('signIn'); setPhase('otp');
    } catch (e: unknown) {
      const ce = e as { errors?: Array<{ code: string }> };
      const ec = ce?.errors?.[0]?.code ?? '';
      if (ec === 'form_identifier_not_found') {
        try {
          await signUp!.create({ phoneNumber: fullPhone });
          await signUp!.preparePhoneNumberVerification({ strategy: 'phone_code' });
          setFlow('signUp'); setPhase('otp');
        } catch (err: unknown) {
          const se = err as { errors?: Array<{ code: string }> };
          const sc = se?.errors?.[0]?.code ?? '';
          if (sc === 'phone_number_not_allowed_country' || sc.includes('not_supported') || sc.includes('country')) {
            setError('SMS to India isn\'t enabled yet — use Google sign-in above.');
          } else {
            setError((err as Error).message ?? 'Could not send OTP.');
          }
        }
      } else if (ec === 'phone_number_not_allowed_country' || ec.includes('not_supported') || ec.includes('country')) {
        setError('SMS to India isn\'t enabled yet — use Google sign-in above.');
      } else {
        setError((e as Error).message ?? 'Could not send OTP.');
      }
    } finally { setBusy(false); }
  };

  const handleVerifyOtp = async (code: string) => {
    if (!isReady) return;
    setBusy(true); setError(null);
    try {
      if (flow === 'signIn') {
        const r = await signIn!.attemptFirstFactor({ strategy: 'phone_code', code });
        if (r.status === 'complete') onNext();
      } else {
        const r = await signUp!.attemptPhoneNumberVerification({ code });
        if (r.status === 'complete') onNext();
      }
    } catch {
      setError('Incorrect code. Please try again.');
      setOtp(Array(6).fill('')); inputRefs.current[0]?.focus();
    } finally { setBusy(false); }
  };

  const handleOtpChange = (i: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[i] = char; setOtp(next);
    if (char && i < 5) inputRefs.current[i + 1]?.focus();
    const code = next.join('');
    if (code.length === 6) handleVerifyOtp(code);
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return; e.preventDefault();
    const next = Array(6).fill('');
    text.split('').forEach((c, i) => { next[i] = c; });
    setOtp(next); inputRefs.current[Math.min(text.length - 1, 5)]?.focus();
    if (text.length === 6) handleVerifyOtp(text);
  };

  const isReady = isLoaded && signInLoaded && signUpLoaded;

  return (
    <div className="space-y-8">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-1">
        <motion.h2 variants={fadeUp} className="text-2xl font-bold tracking-tight text-foreground">
          Create your account
        </motion.h2>
        <motion.p variants={fadeUp} className="text-sm text-muted-foreground">
          Sign in to save your campaign and access your dashboard after payment.
        </motion.p>
      </motion.div>

      <AnimatePresence mode="wait">
        {phase === 'options' ? (
          <motion.div
            key="options"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            {/* Google */}
            <motion.button
              type="button"
              onClick={handleGoogle}
              disabled={busy || !isReady}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </motion.button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground/50 font-medium">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Phone */}
            <div className="flex gap-2">
              <div className="flex h-14 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground shrink-0">
                <span>🇮🇳</span>
                <span className="font-semibold text-foreground">+91</span>
              </div>
              <div className="relative flex-1">
                <input
                  type="tel" inputMode="numeric" maxLength={10}
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp(); }}
                  placeholder=" "
                  className="peer w-full h-14 rounded-xl border border-border bg-card px-4 pb-1.5 pt-5 text-sm text-foreground placeholder-transparent transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <label className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground transition-all duration-200 peer-focus:-translate-y-[1.2rem] peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-primary peer-[:not(:placeholder-shown)]:-translate-y-[1.2rem] peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-widest peer-[:not(:placeholder-shown)]:text-muted-foreground">
                  Phone number
                </label>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive overflow-hidden">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              onClick={handleSendOtp}
              disabled={busy || !isReady || phone.replace(/\D/g, '').length !== 10}
              className="w-full gap-2 h-11"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              {busy ? 'Sending…' : 'Send OTP'}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="otp"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            <p className="text-sm text-muted-foreground">
              Code sent to <span className="font-semibold text-foreground">+91 {phone}</span>
            </p>

            <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={1}
                  value={digit} autoFocus={i === 0} disabled={busy}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="h-14 w-full rounded-xl border border-border bg-card text-center text-xl font-black text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
                />
              ))}
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive overflow-hidden">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            {busy && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
              </div>
            )}

            <button type="button" onClick={() => { setPhase('options'); setOtp(Array(6).fill('')); setError(null); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Wrong number?
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5 h-11">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    </div>
  );
}

function StepAgreement({
  data, onChange, onNext, onBack,
}: {
  data: OnboardingFormData;
  onChange: (k: keyof OnboardingFormData, v: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const pricePerScreen = getScreenPrice(data.screens);
  const monthlyFee     = fmt(pricePerScreen * data.screens);
  const effectiveDate  = format(new Date(), 'd MMMM yyyy');

  const clauses = useMemo(() => [
            {
              n: '1', title: 'What we provide',
              items: [
                'We display your advertisements on digital screens installed inside kirana stores and retail outlets across your selected locations.',
                'You get a dedicated Account Manager who handles scheduling, creative formatting, and campaign reporting.',
                'We provide screen uptime reports and campaign performance summaries.',
              ],
            },
            {
              n: '2', title: 'Your campaign',
              items: [
                <>This campaign runs for <strong className="text-foreground">{data.months} {data.months === 1 ? 'month' : 'months'}</strong> across <strong className="text-foreground">{data.screens} {data.screens === 1 ? 'screen' : 'screens'}</strong>.</>,
                <>The monthly fee is <strong className="text-foreground">{monthlyFee}</strong> plus applicable GST.</>,
                'Campaign dates are confirmed after payment and creative submission.',
              ],
            },
            {
              n: '3', title: 'Payment',
              items: [
                'Payment is collected upfront via Razorpay before your campaign is activated.',
                'A GST invoice will be sent to your registered email within 2 business days of payment.',
                'Fees for completed campaign months are non-refundable. If we cancel your campaign for reasons within our control, we will issue a prorated refund.',
                'Late or disputed payments attract interest of 2% per month.',
              ],
            },
            {
              n: '4', title: 'Your content',
              items: [
                'You are solely responsible for ensuring your ad content is accurate, lawful, and complies with applicable advertising regulations.',
                'We may reject or remove content that violates any law, is misleading, or conflicts with our content policies — without liability to you.',
                'Send your ad creative and logo to your Account Manager after payment. Specifications: MP4 or JPEG/PNG, 1920 × 1080 px, max 100 MB.',
              ],
            },
            {
              n: '5', title: 'Intellectual property',
              items: [
                'You retain full ownership of your ad content and brand assets.',
                'You grant us a non-exclusive licence to display your content on our screens for the campaign duration.',
                'We retain ownership of our platform, scheduling software, and reporting tools.',
              ],
            },
            {
              n: '6', title: 'Limitation of liability',
              items: [
                'Our total liability to you for any claim arising from these Terms is limited to the fees you paid for the affected campaign period.',
                'We are not liable for indirect, incidental, or consequential losses, including lost revenue or reputational damage.',
                'We are not liable for screen downtime caused by third-party store closures, power outages, or force majeure events. We will notify you and extend your campaign where reasonably possible.',
              ],
            },
            {
              n: '7', title: 'Ending this agreement',
              items: [
                'Either party may end this agreement with 30 days written notice.',
                'We may suspend or terminate immediately if you breach a material term, including non-payment or submission of unlawful content.',
                'On termination, outstanding fees become immediately due.',
              ],
            },
            {
              n: '8', title: 'Privacy',
              items: [
                'We collect your business details (name, email, phone, GSTIN) to manage your campaign and issue invoices.',
                'We do not sell your information to third parties.',
                'Payment processing is handled by Razorpay, subject to their privacy policy.',
              ],
            },
            {
              n: '9', title: 'Governing law',
              items: [
                'These Terms are governed by the laws of India.',
                'Any disputes will first be addressed through good-faith discussions. If unresolved within 30 days, disputes will be referred to arbitration in Mangaluru, Karnataka, under the Arbitration and Conciliation Act, 1996.',
                'Courts in Mangaluru, Karnataka have exclusive jurisdiction for any proceedings.',
              ],
            },
            {
              n: '10', title: 'Changes to these terms',
              items: [
                'We may update these Terms from time to time. We will notify you of material changes by email.',
                'Continued use of our services after changes take effect means you accept the revised Terms.',
              ],
            },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [data.months, data.screens, monthlyFee]);

  return (
    <div className="space-y-6">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-1">
        <motion.h2 variants={fadeUp} className="text-2xl font-bold tracking-tight text-foreground">
          Terms of Service
        </motion.h2>
        <motion.p variants={fadeUp} className="text-sm text-muted-foreground">
          Read the terms below and accept to continue.
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-xl border border-border bg-card h-[420px] overflow-y-auto scroll-smooth"
      >
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm px-6 py-4">
          <p className="text-base font-bold text-foreground">Alive Advertising — Terms of Service</p>
          <p className="text-xs text-muted-foreground mt-0.5">Effective date: {effectiveDate}</p>
        </div>

        <div className="px-6 py-6 space-y-7 text-sm text-muted-foreground leading-relaxed">
          <p>
            These Terms of Service ("Terms") govern your use of Alive Advertising Solutions'
            digital out-of-home advertising platform. By accepting these Terms, you
            ({data.brandName ? <strong className="text-foreground">{data.brandName}</strong> : 'you, the Brand'})
            {' '}agree to a binding contract with <strong className="text-foreground">VS Collective</strong>,
            trading as <strong className="text-foreground">Alive Advertising Solutions</strong>.
          </p>

          {clauses.map(({ n, title, items }) => (
            <div key={n} className="space-y-2.5">
              <p className="font-semibold text-foreground text-[13px]">
                <span className="text-primary mr-1.5">{n}.</span>{title}
              </p>
              <ul className="space-y-1.5 pl-4">
                {items.map((item, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-[7px] h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="pt-4 border-t border-border space-y-3 text-xs text-muted-foreground/70">
            <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Service Provider</p>
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">VS Collective</p>
              <p>Trading as Alive Advertising Solutions</p>
              <p>Door no.16-6-391/3, Flat No.13/14, Highland Manor,</p>
              <p>Mother Teresa Road, Unity College of Nursing, Kankanady,</p>
              <p>Mangaluru, Dakshina Kannada, Karnataka — 575002</p>
              <p className="pt-1">GSTIN: <span className="font-mono">29AAXFV2589C1ZE</span></p>
              <p>Email: <a href="mailto:legal@wearealive.in" className="text-primary hover:underline">legal@wearealive.in</a></p>
            </div>
            {data.gstin && (
              <div className="pt-2 space-y-0.5">
                <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Advertiser</p>
                <p className="font-semibold text-foreground">{data.brandName}</p>
                <p>GSTIN: <span className="font-mono">{data.gstin}</span></p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Checkbox */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
      >
        <Checkbox
          id="agree"
          checked={data.agreementSigned}
          onCheckedChange={(v) => onChange('agreementSigned', !!v)}
          className="mt-0.5 shrink-0"
        />
        <label htmlFor="agree" className="text-sm text-muted-foreground leading-relaxed cursor-pointer select-none">
          I have read and agree to the Alive Advertising Terms of Service. I confirm I am
          authorised to enter into this agreement on behalf of{' '}
          <strong className="text-foreground">{data.brandName || 'my organisation'}</strong>.
        </label>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="flex gap-3"
      >
        <Button variant="outline" onClick={onBack} className="gap-1.5 h-11">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!data.agreementSigned} className="gap-1.5 h-11 px-7">
          Proceed to payment <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}

function StepPayment({
  data, onSuccess, onBack,
}: {
  data: OnboardingFormData;
  onSuccess: (paymentId: string, orderId: string) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const pricePerScreen = getScreenPrice(data.screens);
  const total          = pricePerScreen * data.screens * data.months;

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadRazorpayScript();
      const res  = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:  total,
          receipt: `alive_${Date.now()}`,
          notes:   { brand: data.brandName, email: data.email, screens: data.screens, months: data.months },
        }),
      });
      const body = await res.json() as { id?: string; amount?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Could not create payment order');

      type RzpI = { open: () => void; on: (e: string, cb: (r: { error: { description: string } }) => void) => void };
      type RzpC = new (o: Record<string, unknown>) => RzpI;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: body.amount, currency: 'INR', name: 'Alive Media',
        description: `${data.screens} screen${data.screens > 1 ? 's' : ''} · ${data.months} month${data.months > 1 ? 's' : ''}`,
        order_id: body.id,
        handler: async (response: RazorpayResponse) => {
          const verify = await fetch('/api/razorpay/verify-payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(response),
          });
          const result = await verify.json() as { success: boolean };
          if (result.success) { onSuccess(response.razorpay_payment_id, response.razorpay_order_id); }
          else { setError('Payment verification failed. Please contact hello@alive.agency.'); setLoading(false); }
        },
        prefill: { name: data.contactName, email: data.email, contact: data.phone },
        theme: { color: '#dc2626' },
        modal: { ondismiss: () => setLoading(false) },
      };
      const rzp = new ((window as unknown as { Razorpay: RzpC }).Razorpay)(options as Record<string, unknown>);
      rzp.on('payment.failed', (r) => { setError(r.error.description ?? 'Payment failed.'); setLoading(false); });
      rzp.open();
    } catch (e) {
      setError((e as Error).message ?? 'Something went wrong.'); setLoading(false);
    }
  };

  const rows: [string, string][] = [
    ['Brand',                    data.brandName],
    ['Screens',                  `${data.screens} screen${data.screens > 1 ? 's' : ''}`],
    ['Duration',                 `${data.months} month${data.months > 1 ? 's' : ''}`],
    ['Price per screen / month', fmt(pricePerScreen)],
    ['Start date',               data.startDate ? format(new Date(data.startDate + 'T00:00:00'), 'd MMMM yyyy') : '—'],
    ['Daily plays (est.)',        `~${(playsPerScreen * data.screens).toLocaleString('en-IN')}`],
    ['Total views (est.)',        `~${(viewsPerScreenMo * data.screens * data.months).toLocaleString('en-IN')}`],
  ];

  return (
    <div className="space-y-8">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-1">
        <motion.h2 variants={fadeUp} className="text-2xl font-bold tracking-tight text-foreground">Payment</motion.h2>
        <motion.p variants={fadeUp} className="text-sm text-muted-foreground">Review your order and pay securely via Razorpay.</motion.p>
      </motion.div>

      <motion.div
        variants={stagger} initial="hidden" animate="show"
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Order summary</p>
        </div>
        <div className="px-6 py-5 space-y-3 text-sm">
          {rows.map(([label, value], i) => (
            <motion.div key={label} variants={fadeUp} custom={i} className="flex items-center justify-between">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold text-foreground">{value}</span>
            </motion.div>
          ))}
        </div>
        <motion.div variants={fadeUp} className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground uppercase tracking-wide">Total due</span>
          <span className="text-2xl font-black text-foreground">{fmt(total)}</span>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive overflow-hidden"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-3"
      >
        <button
          type="button"
          onClick={handlePay}
          disabled={loading}
          className="relative w-full overflow-hidden rounded-xl bg-primary px-6 py-4 font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]"
        >
          {!loading && (
            <span className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          )}
          <span className="relative flex items-center justify-between">
            <span className="flex items-center gap-2.5 text-sm">
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening Razorpay…</>
                : <><ArrowRight className="h-4 w-4" /> Pay {fmt(total)}</>}
            </span>
            {!loading && (
              <span className="flex items-center gap-2 border-l border-white/20 pl-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">powered by</span>
                <RazorpayMark />
              </span>
            )}
          </span>
        </button>
        <p className="text-center text-xs text-muted-foreground/50">
          Secured by Razorpay · 256-bit SSL · PCI DSS compliant
        </p>

        {/* Demo mode — remove before launch */}
        {process.env.NODE_ENV === 'development' && (
          <button
            type="button"
            onClick={() => onSuccess(`demo_${Date.now()}`, `order_demo_${Date.now()}`)}
            className="w-full rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
          >
            ⚡ Demo — skip payment (dev only)
          </button>
        )}
      </motion.div>

      <Button variant="ghost" onClick={onBack} className="gap-1.5 w-full">
        <ArrowLeft className="h-4 w-4" /> Back to agreement
      </Button>
    </div>
  );
}

function StepDone({ data, paymentId }: { data: OnboardingFormData; paymentId: string }) {
  const total = getScreenPrice(data.screens) * data.screens * data.months;

  const checklist = [
    { label: 'Payment confirmed',   value: paymentId,                              done: true  },
    { label: 'Screens booked',       value: `${data.screens} screen${data.screens > 1 ? 's' : ''}`, done: true },
    { label: 'Duration',             value: `${data.months} month${data.months > 1 ? 's' : ''}`,    done: true },
    { label: 'Creatives',            value: 'Email to your AM',                     done: false },
    { label: 'Campaign goes live',   value: data.startDate ? format(new Date(data.startDate + 'T00:00:00'), 'd MMM') : 'Per schedule', done: false },
    { label: 'Campaign report',      value: 'Mid + end of campaign',                done: false },
  ];

  return (
    <motion.div
      variants={stagger} initial="hidden" animate="show"
      className="flex flex-col items-center text-center gap-10 py-8"
    >
      <motion.div
        variants={fadeUp}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 ring-8 ring-green-500/5"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 20 }}
        >
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </motion.div>
      </motion.div>

      <motion.div variants={fadeUp} className="space-y-3">
        <h2 className="text-3xl font-black tracking-tight text-foreground">Campaign confirmed.</h2>
        <p className="max-w-md mx-auto text-muted-foreground leading-relaxed">
          Welcome to Alive, <strong className="text-foreground">{data.brandName}</strong>. Your
          payment of <strong className="text-foreground">{fmt(total)}</strong> is confirmed. A GST
          invoice will be sent to <strong className="text-foreground">{data.email}</strong> within 2
          business days.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="w-full max-w-md rounded-xl border border-primary/30 bg-primary/5 p-6 text-left space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary shrink-0" />
          <p className="font-bold text-foreground">One thing left — send us your creatives</p>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Email your ad file and logo to your Account Manager and we handle the rest.
        </p>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-sm">
          {[
            { Icon: FileVideo, title: 'Ad creative', spec: 'MP4 or JPEG/PNG · 1920 × 1080 px · Max 100 MB' },
            { Icon: FileImage, title: 'Brand logo',  spec: 'PNG transparent background · Min 500 px wide' },
          ].map(({ Icon, title, spec }) => (
            <div key={title} className="flex items-start gap-3">
              <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{spec}</p>
              </div>
            </div>
          ))}
        </div>
        <a
          href={`mailto:hello@alive.agency?subject=Campaign%20creatives%20—%20${encodeURIComponent(data.brandName)}`}
          className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Mail className="h-4 w-4" /> Email creatives to your AM
        </a>
      </motion.div>

      <motion.div variants={stagger} className="w-full max-w-md space-y-2 text-left">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Booking summary</p>
        {checklist.map(({ label, value, done }, i) => (
          <motion.div
            key={label}
            variants={fadeUp}
            custom={i}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className={`flex h-5 w-5 items-center justify-center rounded-full ${done ? 'bg-green-500/15' : 'bg-muted'}`}>
                {done
                  ? <Check className="h-3 w-3 text-green-500" />
                  : <Clock className="h-3 w-3 text-muted-foreground/50" />}
              </div>
              <span className="text-muted-foreground">{label}</span>
            </div>
            <span className="font-semibold text-foreground font-mono text-xs truncate max-w-[140px]">{value}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Login CTA */}
      <motion.div variants={fadeUp} className="w-full max-w-md rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-3 text-left">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Track your campaign</p>
        <p className="text-sm font-bold text-foreground">View your dashboard</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Log in with your phone to see live campaign stats, payment history, and ad performance.
        </p>
        <a
          href="/login?return=dashboard"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Phone className="h-4 w-4" /> Sign in with phone
        </a>
      </motion.div>

      <motion.a
        variants={fadeUp}
        href="/"
        className="text-xs text-muted-foreground/40 hover:text-muted-foreground underline underline-offset-2 transition-colors"
      >
        Return to alive.agency
      </motion.a>
    </motion.div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

const INITIAL: OnboardingFormData = {
  brandName: '', contactName: '', email: '', phone: '', gstin: '',
  screens: 3, months: 1, startDate: '', agreementSigned: false,
};

export default function BrandOnboardingPage() {
  const [step,      setStep]      = useState(1);
  const [form,      setForm]      = useState<OnboardingFormData>(INITIAL);
  const [paymentId, setPaymentId] = useState('');
  const [orderId,   setOrderId]   = useState('');

  const update = (key: keyof OnboardingFormData, value: OnboardingFormData[keyof OnboardingFormData]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);
  const showIndicator = step >= 2 && step <= 6;

  const handlePaymentSuccess = async (pid: string, oid: string) => {
    setPaymentId(pid);
    setOrderId(oid);
    const pricePerScreen = getScreenPrice(form.screens);
    // Save campaign to Vercel KV via API route — non-blocking
    fetch('/api/campaigns/save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandName:      form.brandName,
        contactName:    form.contactName,
        email:          form.email,
        phone:          form.phone,
        gstin:          form.gstin,
        screens:        form.screens,
        months:         form.months,
        startDate:      form.startDate,
        pricePerScreen,
        totalAmount:    pricePerScreen * form.screens * form.months,
        paymentId:      pid,
        orderId:        oid,
        status:         'upcoming' as const,
      }),
    }).catch(() => {}); // fire-and-forget — payment already confirmed
    next();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity">
            <Logo />
          </a>
          {showIndicator && <StepIndicator current={step - 1} />}
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">
            Confidential
          </span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {step === 1 && <StepWelcome onNext={next} />}
            {step === 2 && (
              <StepDetails data={form} onChange={(k, v) => update(k, v as string)} onNext={next} onBack={back} />
            )}
            {step === 3 && (
              <StepCampaign data={form} onChange={(k, v) => update(k, v as number | string)} onNext={next} onBack={back} />
            )}
            {step === 4 && <StepAuth onNext={next} onBack={back} />}
            {step === 5 && (
              <StepAgreement data={form} onChange={(k, v) => update(k, v as boolean)} onNext={next} onBack={back} />
            )}
            {step === 6 && (
              <StepPayment data={form} onSuccess={handlePaymentSuccess} onBack={back} />
            )}
            {step === 7 && <StepDone data={form} paymentId={paymentId} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-border/30 py-5 text-center">
        <p className="text-xs text-muted-foreground/40 tracking-wide">
          © 2025 Alive Advertising Solutions Pvt. Ltd. ·{' '}
          <a href="mailto:hello@alive.agency" className="hover:text-muted-foreground transition-colors">
            hello@alive.agency
          </a>
        </p>
      </footer>
    </div>
  );
}
