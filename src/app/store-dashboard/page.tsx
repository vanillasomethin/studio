'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  IndianRupee, CheckCircle2, Clock, Wifi, BarChart3, Phone,
  MapPin, Star, ArrowRight, MessageCircle, Bell, ChevronRight,
  TrendingUp, Calendar, Shield,
} from 'lucide-react';
import { Logo } from '@/components/icons/logo';

// ─── Animation ──────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

// ─── Status timeline ────────────────────────────────────────────────────────

const TIMELINE = [
  { label: 'Registration Received',  desc: 'Your details are saved.',                              done: true  },
  { label: 'Team Verification',      desc: 'Our team will call you within 24 hours.',               done: false },
  { label: 'Site Visit & Install',   desc: 'Screen installed at your store (free of cost).',        done: false },
  { label: 'Screen Goes Live',       desc: 'Ads start running — you start earning!',                done: false },
];

// ─── Earnings estimator ─────────────────────────────────────────────────────

const EARNING_TABLE = [
  { screens: 1, monthly: 2500,  annual: 30000  },
  { screens: 2, monthly: 5000,  annual: 60000  },
  { screens: 3, monthly: 8000,  annual: 96000  },
];

// ─── Types ──────────────────────────────────────────────────────────────────

type StoreInfo = {
  storeName: string;
  ownerName: string;
  whatsapp:  string;
  locality:  string;
  city:      string;
  pincode:   string;
  phone?:    string;
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function StoreDashboard() {
  const [store,    setStore]    = useState<StoreInfo | null>(null);
  const [screens,  setScreens]  = useState(1);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('alive_store');
      if (raw) setStore(JSON.parse(raw) as StoreInfo);
    } catch {}
  }, []);

  const displayName = store?.ownerName?.split(' ')[0] ?? 'Partner';
  const earning     = EARNING_TABLE.find((r) => r.screens === screens) ?? EARNING_TABLE[0];

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="opacity-80 hover:opacity-100 transition-opacity">
            <Logo />
          </a>
          <div className="flex items-center gap-3">
            <button className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {displayName[0]?.toUpperCase() ?? 'S'}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">

        {/* Welcome banner */}
        <motion.div
          variants={stagger} initial="hidden" animate="show"
          className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1a0505 0%, #2d0a0a 50%, #1a0505 100%)' }}
        >
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <motion.div variants={fadeUp} className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/70">Store Partner Dashboard</p>
              <h1 className="text-2xl font-bold text-white">
                Welcome, {displayName}! 👋
              </h1>
              {store && (
                <p className="text-sm text-white/50 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary/70" />
                  {store.storeName} · {store.locality}, {store.city}
                </p>
              )}
            </motion.div>
            <motion.div variants={fadeUp} className="flex items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p className="text-lg font-bold text-white">₹0</p>
                <p className="text-[10px] text-white/40 mt-0.5">Earned so far</p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-center">
                <p className="text-lg font-bold text-primary">48h</p>
                <p className="text-[10px] text-primary/60 mt-0.5">To go live</p>
              </div>
            </motion.div>
          </div>

          {/* Status bar */}
          <div className="border-t border-white/10 px-6 sm:px-8 py-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
            <p className="text-xs text-white/50">
              <span className="text-white/80 font-semibold">Registration received</span> — our team will call {store?.phone ?? store?.whatsapp ? `+91 ${store?.whatsapp}` : 'you'} within 24 hours to confirm.
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Installation timeline */}
            <motion.div
              variants={stagger} initial="hidden" animate="show"
              className="rounded-2xl border border-border bg-card p-6"
            >
              <motion.div variants={fadeUp} className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold text-foreground">What happens next</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Step 1 of 4</span>
              </motion.div>

              <div className="space-y-0">
                {TIMELINE.map((item, i) => (
                  <motion.div key={item.label} variants={fadeUp} className="flex gap-4">
                    {/* Connector */}
                    <div className="flex flex-col items-center">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        item.done
                          ? 'bg-primary text-primary-foreground'
                          : i === 1
                          ? 'border-2 border-primary bg-primary/10 text-primary'
                          : 'border-2 border-border bg-background text-muted-foreground'
                      }`}>
                        {item.done ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : i === 1 ? (
                          <Clock className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-bold">{i + 1}</span>
                        )}
                      </div>
                      {i < TIMELINE.length - 1 && (
                        <div className={`w-px flex-1 min-h-[28px] mt-1 mb-1 ${item.done ? 'bg-primary/30' : 'bg-border'}`} />
                      )}
                    </div>
                    {/* Content */}
                    <div className="pb-5">
                      <p className={`text-sm font-semibold ${item.done ? 'text-foreground' : i === 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Earnings estimator */}
            <motion.div
              variants={stagger} initial="hidden" animate="show"
              className="rounded-2xl border border-border bg-card p-6"
            >
              <motion.div variants={fadeUp} className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-base font-bold text-foreground">Your earnings potential</h2>
              </motion.div>
              <motion.p variants={fadeUp} className="text-xs text-muted-foreground mb-5">
                Estimated based on typical campaign fill rates in Mangaluru.
              </motion.p>

              {/* Screen selector */}
              <motion.div variants={fadeUp} className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Number of screens</p>
                <div className="flex gap-2">
                  {EARNING_TABLE.map((r) => (
                    <button
                      key={r.screens}
                      onClick={() => setScreens(r.screens)}
                      className={`flex-1 rounded-xl border py-3 text-sm font-bold transition-all ${
                        screens === r.screens
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      }`}
                    >
                      {r.screens}
                    </button>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary/50 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Monthly income</p>
                  <p className="text-2xl font-bold text-foreground">₹{earning.monthly.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-primary mt-1">per month</p>
                </div>
                <div className="rounded-xl bg-secondary/50 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Annual income</p>
                  <p className="text-2xl font-bold text-foreground">₹{earning.annual.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-muted-foreground mt-1">per year</p>
                </div>
              </motion.div>

              <motion.p variants={fadeUp} className="text-xs text-muted-foreground/60 mt-3 italic">
                Actual earnings depend on campaign bookings and screen uptime. Minimum guaranteed payout applies once live.
              </motion.p>
            </motion.div>
          </div>

          {/* ── Right column ── */}
          <div className="space-y-4">

            {/* Store card */}
            {store && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-border bg-card p-5 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg">
                    {store.storeName[0]?.toUpperCase() ?? 'S'}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{store.storeName}</p>
                    <p className="text-xs text-muted-foreground">{store.ownerName}</p>
                  </div>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                    <span>{store.locality}, {store.city} — {store.pincode}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-primary/60" />
                    <span>+91 {store.whatsapp}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-xs font-semibold text-yellow-600">Pending verification</span>
                </div>
              </motion.div>
            )}

            {/* Quick actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-border bg-card p-5 space-y-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick actions</h3>
              {[
                {
                  icon: MessageCircle,
                  label: 'WhatsApp support',
                  desc: 'Chat with our team',
                  href: 'https://wa.me/919876543210?text=Hi+Alive+team,+I+just+registered+my+store.',
                  color: 'text-[#25D366]',
                },
                {
                  icon: Calendar,
                  label: 'Schedule a call',
                  desc: 'Talk to a partner manager',
                  href: 'mailto:stores@alivemedia.in?subject=Schedule a call - Store Partner',
                  color: 'text-blue-500',
                },
                {
                  icon: Shield,
                  label: 'Partnership agreement',
                  desc: 'Read the store terms',
                  href: '/terms',
                  color: 'text-muted-foreground',
                },
              ].map((a) => (
                <a
                  key={a.label}
                  href={a.href}
                  target={a.href.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer"
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
            </motion.div>

            {/* Benefits recap */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-border bg-card p-5 space-y-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your benefits</h3>
              {[
                { icon: IndianRupee, text: 'Monthly revenue share' },
                { icon: Wifi,        text: 'Free screen + installation' },
                { icon: BarChart3,   text: 'Store performance reports' },
                { icon: Star,        text: 'Premium partner badge' },
              ].map((b) => (
                <div key={b.text} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <b.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  {b.text}
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* FAQ strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="text-base font-bold text-foreground mb-4">Common questions</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { q: 'When will my screen be installed?',       a: 'Our team will visit within 48–72 hours of verification. Installation takes about 2 hours.' },
              { q: 'When do I start receiving payments?',      a: 'Payouts are processed monthly, 7 days after the end of each billing cycle via UPI/bank transfer.' },
              { q: 'What if the screen has a problem?',        a: 'We monitor screens 24/7 remotely. For hardware issues, our team visits within 24 hours.' },
              { q: 'Can I host multiple screens?',             a: 'Yes! More screens means more income. Tell your relationship manager when they call.' },
            ].map((faq) => (
              <div key={faq.q} className="space-y-1">
                <p className="text-xs font-semibold text-foreground">{faq.q}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      <footer className="border-t border-border/30 py-6 text-center mt-10">
        <p className="text-xs text-muted-foreground/40">
          © 2025 ALIVE Advertising Pvt. Ltd. · Mangaluru, Karnataka, India
        </p>
      </footer>
    </div>
  );
}
