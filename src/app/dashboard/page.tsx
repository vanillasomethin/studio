'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMonths, parseISO, eachDayOfInterval } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/icons/logo';
import {
  Monitor, TrendingUp, Eye, IndianRupee, LogOut, Mail,
  CalendarDays, CheckCircle2, Clock, AlertCircle, ArrowRight,
  CreditCard, X, Loader2, Plus, Check,
} from 'lucide-react';

type Campaign = {
  id: string; name?: string; brandName?: string; contactName?: string | null;
  email?: string | null; phone?: string | null; gstin?: string | null;
  screens: number; months: number;
  startDate: string; pricePerScreen: number; totalAmount: number;
  paymentId?: string | null; orderId?: string | null; status: string; createdAt: string;
};

// ─── Animations ────────────────────────────────────────────────────────────────

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } } };

// ─── Utilities ─────────────────────────────────────────────────────────────────

const fmt   = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const PLAYS = 144;
const VIEWS = 4320;

const CHART_COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))',
  'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
];

const STATUS_STYLES: Record<string, string> = {
  upcoming:        'bg-blue-500/15 text-blue-400 border-blue-500/20',
  active:          'bg-green-500/15 text-green-400 border-green-500/20',
  completed:       'bg-muted text-muted-foreground border-border',
  pending_payment: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  upcoming:        <Clock        className="h-3 w-3" />,
  active:          <CheckCircle2 className="h-3 w-3" />,
  completed:       <AlertCircle  className="h-3 w-3" />,
  pending_payment: <CreditCard   className="h-3 w-3" />,
};

function deriveCampaignStatus(c: Campaign): Campaign['status'] {
  if (!c.startDate) return 'upcoming';
  const start = parseISO(c.startDate);
  const end   = addMonths(start, c.months);
  const now   = new Date();
  if (now < start) return 'upcoming';
  if (now > end)   return 'completed';
  return 'active';
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 space-y-6 max-w-5xl mx-auto">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-10 w-64 rounded-lg" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <motion.div variants={fadeUp} className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className="text-muted-foreground/50">{icon}</div>
      </div>
      <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}

// ─── Campaign Card ─────────────────────────────────────────────────────────────

function CampaignCard({ c }: { c: Campaign }) {
  const status         = deriveCampaignStatus(c);
  const startFormatted = c.startDate ? format(parseISO(c.startDate), 'd MMM yyyy') : '—';
  const endFormatted   = c.startDate ? format(addMonths(parseISO(c.startDate), c.months), 'd MMM yyyy') : '—';

  return (
    <motion.div variants={fadeUp} className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-foreground">{c.brandName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{startFormatted} → {endFormatted}</p>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shrink-0 ${STATUS_STYLES[status]}`}>
          {STATUS_ICONS[status]} {status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { icon: <Monitor    className="h-3.5 w-3.5" />, label: 'Screens',   value: c.screens.toString() },
          { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Plays/day', value: `~${(PLAYS * c.screens).toLocaleString('en-IN')}` },
          { icon: <Eye        className="h-3.5 w-3.5" />, label: 'Views/mo',  value: `~${(VIEWS * c.screens).toLocaleString('en-IN')}` },
        ].map(({ icon, label, value }) => (
          <div key={label} className="rounded-lg bg-muted/30 p-2.5 space-y-1">
            <div className="flex justify-center text-muted-foreground">{icon}</div>
            <p className="text-sm font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
        <div>
          <p className="text-muted-foreground">Total paid</p>
          <p className="font-black text-foreground text-base mt-0.5">{fmt(c.totalAmount)}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Payment ID</p>
          <p className="font-mono text-[10px] text-foreground mt-0.5 truncate max-w-[130px]">{c.paymentId}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Performance Charts ────────────────────────────────────────────────────────

function PerformanceCharts({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) return (
    <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground text-sm">
      No campaign data to display yet.
    </div>
  );

  const barData = campaigns.map((c) => ({
    name:            (c.brandName ?? c.name ?? '').slice(0, 14),
    'Monthly views': VIEWS * c.screens,
    'Daily plays':   PLAYS * c.screens,
  }));

  const allDates      = new Set<string>();
  const campaignDayMap: Record<string, Record<string, number>> = {};

  campaigns.forEach((c) => {
    if (!c.startDate) return;
    const start = parseISO(c.startDate);
    const end   = addMonths(start, c.months);
    const label = (c.brandName ?? c.name ?? '').slice(0, 14);
    campaignDayMap[label] = {};
    eachDayOfInterval({ start, end }).slice(0, 60).forEach((d) => {
      const key = format(d, 'dd MMM');
      allDates.add(key);
      campaignDayMap[label][key] = PLAYS * c.screens;
    });
  });

  const areaData = [...allDates].map((date) => {
    const row: Record<string, string | number> = { date };
    Object.entries(campaignDayMap).forEach(([label, days]) => { row[label] = days[date] ?? 0; });
    return row;
  });

  const labels     = Object.keys(campaignDayMap);
  const axisStyle  = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Daily plays timeline</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={areaData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={axisStyle} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString('en-IN')} />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'hsl(var(--foreground))' }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {labels.map((l, i) => (
              <Area key={l} type="monotone" dataKey={l} stroke={CHART_COLORS[i % 5]} fill={CHART_COLORS[i % 5]} fillOpacity={0.15} strokeWidth={2} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Estimated reach per campaign</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={axisStyle} tickLine={false} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString('en-IN')} />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'hsl(var(--foreground))' }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="Monthly views" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Daily plays"   fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Account Tab ──────────────────────────────────────────────────────────────

function AccountTab({ campaigns }: { campaigns: Campaign[] }) {
  const { data: session } = useSession();
  const latest            = campaigns[0];

  const fields: [string, string][] = [
    ['Brand / company', latest?.brandName   || '—'],
    ['Contact name',    latest?.contactName || '—'],
    ['Email',           latest?.email       || session?.user?.email || '—'],
    ['Phone',           latest?.phone       || '—'],
    ['GSTIN',           latest?.gstin       || '—'],
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-lg">
      <motion.div variants={fadeUp} className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Account details</p>
        </div>
        <div className="divide-y divide-border">
          {fields.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-5 py-3.5 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.a
        variants={fadeUp}
        href={`mailto:hello@wearealive.in?subject=Campaign%20support%20—%20${encodeURIComponent(latest?.brandName || '')}`}
        className="flex items-center justify-center gap-2.5 w-full rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-all"
      >
        <Mail className="h-4 w-4" /> Contact your Account Manager
      </motion.a>
    </motion.div>
  );
}

// ─── Network Tab ──────────────────────────────────────────────────────────────

function NetworkTab() {
  const stats = [
    { label: 'Stores in network', value: '47', sub: 'growing' },
    { label: 'Cities',            value: '3',  sub: 'Mangaluru · Udupi · Hassan' },
    { label: 'Screens deployed',  value: '12', sub: 'active screens' },
    { label: 'Daily impressions', value: '~1.7L', sub: 'shoppers/day' },
    { label: 'Avg uptime',        value: '94%', sub: 'screen availability' },
    { label: 'Kirana partners',   value: '47', sub: 'store partners' },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, sub }) => (
          <motion.div key={label} variants={fadeUp} className="rounded-xl border border-border bg-card p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </motion.div>
        ))}
      </div>

      {/* How ads reach shoppers */}
      <motion.div variants={fadeUp} className="rounded-xl border border-border bg-card p-6 space-y-5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">How your ads reach shoppers</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              step: '01',
              title: 'Screen',
              desc: 'Your ad plays on ALIVE digital screens inside kirana stores — full HD, looped throughout the day.',
            },
            {
              step: '02',
              title: 'Store',
              desc: 'Each screen is placed at eye level near the checkout counter — maximum dwell time and visibility.',
            },
            {
              step: '03',
              title: 'Shopper',
              desc: 'Local shoppers see your brand every time they visit — building recall and driving purchase decisions.',
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
              <span className="text-[10px] font-black tracking-[0.2em] text-primary/60 uppercase">{step}</span>
              <p className="text-sm font-bold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Contact Account Manager */}
      <motion.div variants={fadeUp} className="rounded-xl border border-border bg-card p-6 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contact your Account Manager</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="mailto:hello@wearealive.in"
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-all"
          >
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            hello@wearealive.in
          </a>
          <a
            href="https://wa.me/917411324448?text=Hi%2C%20I%20have%20a%20question%20about%20my%20ALIVE%20campaign"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-all"
          >
            <svg className="h-4 w-4 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
            </svg>
            +91 74113 24448
          </a>
        </div>

        {/* Submit creative section */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Submit your creative</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Send your ad file and logo to your Account Manager at{' '}
            <a href="mailto:hello@wearealive.in" className="font-semibold text-primary hover:underline">hello@wearealive.in</a>.
            Accepted formats: MP4 or JPEG/PNG · 1920 × 1080 px · Max 100 MB.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Pending Payment ──────────────────────────────────────────────────────────

const PENDING_KEY = 'alive_pending_campaign';

type PendingForm = {
  brandName: string; contactName: string; email: string; phone: string;
  gstin: string; screens: number; months: number; startDate: string;
};

function getScreenPrice(n: number) {
  if (n >= 20) return 549; if (n >= 10) return 599; if (n >= 3) return 699; return 799;
}

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof (window as Window & { Razorpay?: unknown }).Razorpay !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Razorpay failed to load'));
    document.head.appendChild(s);
  });
}

function PendingPaymentCard({
  pending, onDismiss, onPaid,
}: {
  pending: PendingForm;
  onDismiss: () => void;
  onPaid: (campaign: Campaign) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const pricePerScreen = getScreenPrice(pending.screens);
  const total          = pricePerScreen * pending.screens * pending.months;
  const fmtLocal       = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  const handlePay = async () => {
    setLoading(true); setError(null);
    try {
      await loadRazorpay();
      const res  = await fetch('/api/razorpay/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total, receipt: `alive_${Date.now()}`, notes: { brand: pending.brandName } }),
      });
      const body = await res.json() as { id?: string; amount?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Could not create order');

      type RzpC = new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: { error: { description: string } }) => void) => void };
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: body.amount, currency: 'INR', name: 'Alive Media',
        description: `${pending.screens} screen${pending.screens > 1 ? 's' : ''} · ${pending.months} month${pending.months > 1 ? 's' : ''}`,
        order_id: body.id,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verify = await fetch('/api/razorpay/verify-payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...response,
              campaign: { ...pending, pricePerScreen, totalAmount: total },
            }),
          });
          const result = await verify.json() as { success: boolean };
          if (!result.success) { setError('Payment verification failed. Contact hello@wearealive.in.'); setLoading(false); return; }
          localStorage.removeItem(PENDING_KEY);
          const newCampaign: Campaign = {
            id: `campaign_${Date.now()}`, ...pending, brandName: pending.brandName,
            pricePerScreen, totalAmount: total,
            paymentId: response.razorpay_payment_id,
            orderId:   response.razorpay_order_id,
            status:    'active',
            createdAt: new Date().toISOString(),
          };
          onPaid(newCampaign);
        },
        prefill: { name: pending.contactName, email: pending.email, contact: pending.phone },
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

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15">
            <CreditCard className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Payment pending — {pending.brandName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your campaign is configured and ready. Complete payment to go live.</p>
          </div>
        </div>
        <button onClick={onDismiss} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
        {[
          ['Screens',  `${pending.screens}`],
          ['Duration', `${pending.months} mo`],
          ['Rate',     fmtLocal(pricePerScreen) + '/screen'],
          ['Start',    pending.startDate ? format(parseISO(pending.startDate), 'd MMM') : '—'],
          ['Total',    fmtLocal(total)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-card border border-border px-3 py-2 space-y-0.5">
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</p>
            <p className="font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}

      <button
        onClick={handlePay} disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all"
      >
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening Razorpay…</>
          : <><CreditCard className="h-4 w-4" /> Complete payment — {fmtLocal(total)}</>
        }
      </button>
    </motion.div>
  );
}

// ─── New Campaign Modal ────────────────────────────────────────────────────────

type ModalFormData = {
  screens: number;
  months: number;
  startDate: string;
  agreed: boolean;
};

type ModalStep = 1 | 2 | 3;

const SCREEN_TIERS_MODAL = [
  { screens: 1,  pricePerScreen: 799 },
  { screens: 3,  pricePerScreen: 699, popular: true },
  { screens: 10, pricePerScreen: 599 },
  { screens: 20, pricePerScreen: 549 },
] as const;

const DURATION_OPTS = [
  { months: 1,  label: '1 mo'  },
  { months: 2,  label: '2 mo'  },
  { months: 3,  label: '3 mo'  },
  { months: 6,  label: '6 mo'  },
  { months: 12, label: '12 mo' },
];

function todayPlusDays(d: number): string {
  return format(new Date(Date.now() + d * 86400000), 'yyyy-MM-dd');
}

function NewCampaignModal({
  onClose,
  onBooked,
  prefill,
}: {
  onClose: () => void;
  onBooked: (c: Campaign) => void;
  prefill: { brandName: string; contactName: string; email: string; phone: string; gstin: string };
}) {
  const [modalStep,  setModalStep]  = useState<ModalStep>(1);
  const [modalForm,  setModalForm]  = useState<ModalFormData>({
    screens: 3, months: 1, startDate: todayPlusDays(7), agreed: false,
  });
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [succeeded,  setSucceeded]  = useState(false);

  const pricePerScreen = getScreenPrice(modalForm.screens);
  const subtotal       = pricePerScreen * modalForm.screens * modalForm.months;
  const gstAmount      = Math.round(subtotal * 0.18);
  const total          = subtotal + gstAmount;

  const todayStr = todayPlusDays(7);

  const effectiveDate = format(new Date(), 'd MMMM yyyy');

  const modalClauses = [
    { n: '1', title: 'What we provide', items: ['We display your advertisements on digital screens inside kirana stores and retail outlets.', 'You get a dedicated Account Manager who handles scheduling, creative formatting, and campaign reporting.'] },
    { n: '2', title: 'Your campaign', items: [`This campaign runs for ${modalForm.months} ${modalForm.months === 1 ? 'month' : 'months'} across ${modalForm.screens} ${modalForm.screens === 1 ? 'screen' : 'screens'}.`, `The monthly fee is ${fmt(pricePerScreen * modalForm.screens)} plus applicable GST.`, 'Campaign dates are confirmed after payment and creative submission.'] },
    { n: '3', title: 'Payment', items: ['Payment is collected upfront via Razorpay before your campaign is activated.', 'A GST invoice will be sent to your registered email within 2 business days.', 'Fees for completed campaign months are non-refundable.'] },
    { n: '4', title: 'Your content', items: ['You are solely responsible for ensuring your ad content is accurate, lawful, and compliant.', 'We may reject content that violates any law or conflicts with our policies.', 'Specifications: MP4 or JPEG/PNG, 1920 × 1080 px, max 100 MB.'] },
    { n: '5', title: 'Intellectual property', items: ['You retain full ownership of your ad content and brand assets.', 'You grant us a non-exclusive licence to display your content for the campaign duration.'] },
    { n: '6', title: 'Limitation of liability', items: ['Our total liability is limited to the fees you paid for the affected campaign period.', 'We are not liable for screen downtime caused by third-party store closures or force majeure.'] },
    { n: '7', title: 'Ending this agreement', items: ['Either party may end this agreement with 30 days written notice.', 'On termination, outstanding fees become immediately due.'] },
    { n: '8', title: 'Privacy', items: ['We collect your business details to manage your campaign and issue invoices.', 'Payment processing is handled by Razorpay, subject to their privacy policy.'] },
    { n: '9', title: 'Governing law', items: ['These Terms are governed by the laws of India.', 'Disputes will be referred to arbitration in Mangaluru, Karnataka.'] },
    { n: '10', title: 'Changes', items: ['We may update these Terms from time to time. We will notify you of material changes by email.'] },
  ];

  const handlePay = async () => {
    setLoading(true); setError(null);
    try {
      await loadRazorpay();
      const res  = await fetch('/api/razorpay/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:  total,
          receipt: `alive_${Date.now()}`,
          notes:   { brand: prefill.brandName, email: prefill.email, screens: modalForm.screens, months: modalForm.months },
        }),
      });
      const body = await res.json() as { id?: string; amount?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Could not create payment order');

      type RzpC = new (o: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: { error: { description: string } }) => void) => void };

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: body.amount, currency: 'INR', name: 'Alive Media',
        description: `${modalForm.screens} screen${modalForm.screens > 1 ? 's' : ''} · ${modalForm.months} month${modalForm.months > 1 ? 's' : ''}`,
        order_id: body.id,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const verify = await fetch('/api/razorpay/verify-payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...response,
              campaign: {
                brandName:      prefill.brandName,
                contactName:    prefill.contactName,
                email:          prefill.email,
                phone:          prefill.phone,
                gstin:          prefill.gstin,
                screens:        modalForm.screens,
                months:         modalForm.months,
                startDate:      modalForm.startDate,
                pricePerScreen,
                totalAmount:    total,
              },
            }),
          });
          const result = await verify.json() as { success: boolean };
          if (!result.success) { setError('Payment verification failed. Contact hello@wearealive.in.'); setLoading(false); return; }
          const newCampaign: Campaign = {
            id:            `campaign_${Date.now()}`,
            brandName:     prefill.brandName,
            contactName:   prefill.contactName,
            email:         prefill.email,
            phone:         prefill.phone,
            gstin:         prefill.gstin,
            screens:       modalForm.screens,
            months:        modalForm.months,
            startDate:     modalForm.startDate,
            pricePerScreen,
            totalAmount:   total,
            paymentId:     response.razorpay_payment_id,
            orderId:       response.razorpay_order_id,
            status:        'active',
            createdAt:     new Date().toISOString(),
          };
          onBooked(newCampaign);
          setSucceeded(true);
          setLoading(false);
        },
        prefill: { name: prefill.contactName, email: prefill.email, contact: prefill.phone },
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

  const handlePayLater = async () => {
    setLoading(true); setError(null);
    try {
      await fetch('/api/campaigns/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName:      prefill.brandName,
          contactName:    prefill.contactName,
          email:          prefill.email,
          phone:          prefill.phone,
          gstin:          prefill.gstin,
          screens:        modalForm.screens,
          months:         modalForm.months,
          startDate:      modalForm.startDate,
          pricePerScreen,
          totalAmount:    total,
          paymentId:      '',
          orderId:        '',
          status:         'pending_payment',
        }),
      });
      setSucceeded(true);
    } catch (e) {
      setError((e as Error).message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {succeeded ? (
          /* Success state */
          <div className="flex flex-col items-center text-center gap-6 p-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 ring-8 ring-green-500/5">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-foreground">Campaign booked!</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Your campaign is confirmed. Send your creative to{' '}
                <a href="mailto:hello@wearealive.in" className="font-semibold text-primary hover:underline">hello@wearealive.in</a>.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Header + step indicator */}
            <div className="space-y-4 pr-8">
              <h2 className="text-xl font-black tracking-tight text-foreground">Start New Campaign</h2>
              <div className="flex items-center gap-2">
                {(['Configure', 'Agreement', 'Payment'] as const).map((label, i) => {
                  const n = i + 1;
                  const done   = modalStep > n;
                  const active = modalStep === n;
                  return (
                    <div key={label} className="flex items-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary text-primary-foreground ring-2 ring-primary/25' : 'bg-muted text-muted-foreground'}`}>
                          {done ? <Check className="h-3 w-3" /> : n}
                        </div>
                        <span className={`text-[9px] font-semibold uppercase tracking-wider ${active ? 'text-foreground' : 'text-muted-foreground/50'}`}>{label}</span>
                      </div>
                      {i < 2 && <div className={`h-px w-8 mx-2 mb-4 ${done ? 'bg-primary' : 'bg-border'}`} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 1 — Configure */}
            {modalStep === 1 && (
              <div className="space-y-6">
                {/* Screen plan */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Screen plan</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {SCREEN_TIERS_MODAL.map((t) => {
                      const active  = modalForm.screens === t.screens;
                      const popular = 'popular' in t && t.popular;
                      return (
                        <button
                          key={t.screens}
                          type="button"
                          onClick={() => setModalForm((f) => ({ ...f, screens: t.screens }))}
                          className={`relative rounded-xl border text-left transition-all ${popular ? 'pt-7 pb-3 px-3' : 'p-3'} ${active ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
                        >
                          {popular && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground whitespace-nowrap">
                              Popular
                            </span>
                          )}
                          {active && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />}
                          <p className="text-xl font-black text-foreground">{t.screens}</p>
                          <p className="text-[10px] text-muted-foreground">{t.screens === 1 ? 'screen' : 'screens'}</p>
                          <p className="text-xs font-bold text-foreground mt-1">{fmt(t.pricePerScreen)}</p>
                          <p className="text-[10px] text-muted-foreground">per screen/mo</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom count */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Custom count</p>
                    <p className="text-xs text-muted-foreground">{fmt(pricePerScreen)}/screen · {fmt(pricePerScreen * modalForm.screens)}/month</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setModalForm((f) => ({ ...f, screens: Math.max(1, f.screens - 1) }))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-foreground hover:border-primary/50 disabled:opacity-30" disabled={modalForm.screens <= 1}>−</button>
                    <input
                      type="number" min={1} value={modalForm.screens}
                      onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setModalForm((f) => ({ ...f, screens: v })); }}
                      className="h-8 w-14 rounded-lg border border-border bg-background text-center text-sm font-black text-foreground focus:border-primary focus:outline-none"
                    />
                    <button type="button" onClick={() => setModalForm((f) => ({ ...f, screens: f.screens + 1 }))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-foreground hover:border-primary/50">+</button>
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Duration</p>
                  <div className="grid grid-cols-5 gap-2">
                    {DURATION_OPTS.map(({ months, label }) => (
                      <button
                        key={months}
                        type="button"
                        onClick={() => setModalForm((f) => ({ ...f, months }))}
                        className={`rounded-lg border py-2 text-xs font-semibold transition-colors ${modalForm.months === months ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/40'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start date */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Start date</p>
                  <input
                    type="date"
                    min={todayStr}
                    value={modalForm.startDate}
                    onChange={(e) => setModalForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {modalForm.startDate && (
                    <p className="text-xs text-muted-foreground">
                      Goes live <span className="font-semibold text-foreground">{format(new Date(modalForm.startDate + 'T00:00:00'), 'EEEE, d MMMM yyyy')}</span>
                    </p>
                  )}
                </div>

                {/* Total preview */}
                <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{fmt(pricePerScreen)} × {modalForm.screens} screens × {modalForm.months} mo</p>
                    <p className="text-xs text-muted-foreground">+ GST 18%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total incl. GST</p>
                    <p className="text-2xl font-black text-foreground">{fmt(total)}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setModalStep(2)}
                  disabled={!modalForm.startDate}
                  className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Step 2 — Agreement */}
            {modalStep === 2 && (
              <div className="space-y-5">
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="border-b border-border px-5 py-3.5">
                    <p className="text-sm font-bold text-foreground">Alive Advertising — Terms of Service</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Effective date: {effectiveDate}</p>
                  </div>
                  <div className="max-h-72 overflow-y-auto px-5 py-4 space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <p>
                      These Terms of Service govern your use of ALIVE&apos;s digital out-of-home advertising platform.
                      By accepting, <strong className="text-foreground">{prefill.brandName || 'your organisation'}</strong> enters into a legally binding Campaign Agreement with VS Collective LLP (&quot;ALIVE&quot;).
                    </p>
                    {/* Parties */}
                    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 text-xs">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Parties to the Agreement</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Party A — Service Provider</p>
                          <p className="font-semibold text-foreground">VS Collective LLP</p>
                          <p>LLP IN-KA43598411418020V</p>
                          <p>#13, First Floor, Highland Manor, Falnir, Mangaluru 575002</p>
                          <p>GSTIN: 29AAXFV2589C1ZE</p>
                        </div>
                        <div className="space-y-0.5 sm:border-l sm:border-border sm:pl-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Party B — Advertiser</p>
                          <p className="font-semibold text-foreground">{prefill.brandName || '—'}</p>
                          {prefill.contactName && <p>{prefill.contactName}</p>}
                          {prefill.email       && <p>{prefill.email}</p>}
                          {prefill.phone       && <p>+91 {prefill.phone}</p>}
                          {prefill.gstin       && <p>GSTIN: {prefill.gstin}</p>}
                          <p>Campaign: {modalForm.screens} screen{modalForm.screens !== 1 ? 's' : ''} · {modalForm.months} month{modalForm.months !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </div>
                    {modalClauses.map(({ n, title, items }) => (
                      <div key={n} className="space-y-1.5">
                        <p className="font-semibold text-foreground text-[13px]"><span className="text-primary mr-1">{n}.</span>{title}</p>
                        <ul className="space-y-1 pl-3">
                          {items.map((item, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="mt-2 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {/* Digital acceptance */}
                    <div className="pt-3 border-t border-border space-y-2 text-xs">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Digital Acceptance</p>
                      <p className="text-muted-foreground/70 leading-relaxed">
                        This agreement is executed electronically under the Information Technology Act, 2000.
                        Electronic acceptance via the ALIVE platform constitutes valid execution without physical signatures.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Party A</p>
                          <p className="font-semibold text-foreground">VS Collective LLP</p>
                          <p className="text-muted-foreground">Authorised by: ALIVE Platform</p>
                          <p className="text-muted-foreground">Date: {effectiveDate}</p>
                        </div>
                        <div className="space-y-0.5 border-l border-border pl-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Party B</p>
                          <p className="font-semibold text-foreground">{prefill.brandName || '—'}</p>
                          <p className="text-muted-foreground">Date of acceptance: {effectiveDate}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modalForm.agreed}
                    onChange={(e) => setModalForm((f) => ({ ...f, agreed: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary shrink-0"
                  />
                  <span className="text-sm text-muted-foreground leading-relaxed select-none">
                    I have read and agree to the Alive Advertising Terms of Service. I confirm I am
                    authorised to enter into this agreement on behalf of{' '}
                    <strong className="text-foreground">{prefill.brandName || 'my organisation'}</strong>.
                  </span>
                </label>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalStep(1)}
                    className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalStep(3)}
                    disabled={!modalForm.agreed}
                    className="flex-1 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    Accept &amp; continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Payment */}
            {modalStep === 3 && (
              <div className="space-y-5">
                {/* Order summary */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-border">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Order summary</p>
                  </div>
                  <div className="px-5 py-4 space-y-2.5 text-sm">
                    {[
                      ['Brand',              prefill.brandName || '—'],
                      ['Screens',            `${modalForm.screens} screen${modalForm.screens > 1 ? 's' : ''}`],
                      ['Duration',           `${modalForm.months} month${modalForm.months > 1 ? 's' : ''}`],
                      ['Price/screen/month', fmt(pricePerScreen)],
                      ['Start date',         modalForm.startDate ? format(new Date(modalForm.startDate + 'T00:00:00'), 'd MMMM yyyy') : '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-semibold text-foreground">{value}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2.5 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-semibold text-foreground">{fmt(subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">GST (18%)</span>
                        <span className="font-semibold text-foreground">+{fmt(gstAmount)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground uppercase tracking-wide">Total (incl. GST)</span>
                    <span className="text-2xl font-black text-foreground">{fmt(total)}</span>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                  </div>
                )}

                {/* Pay now */}
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={loading}
                  className="w-full rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening Razorpay…</>
                    : <><ArrowRight className="h-4 w-4" /> Pay {fmt(total)} now</>
                  }
                </button>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
                  <div className="flex-1 h-px bg-border" />
                  <span>or confirm and pay later</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Pay later */}
                <button
                  type="button"
                  onClick={handlePayLater}
                  disabled={loading}
                  className="w-full rounded-xl border border-border bg-card px-6 py-3 text-sm font-bold text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" /> Confirm &amp; pay later
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalStep(2)}
                    className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router                  = useRouter();
  const { data: session, status } = useSession();

  const [campaigns,       setCampaigns]       = useState<Campaign[]>([]);
  const [fetching,        setFetching]        = useState(true);
  const [pending,         setPending]         = useState<PendingForm | null>(null);
  const [showNewCampaign, setShowNewCampaign] = useState(false);

  // Load pending campaign from localStorage (saved if user left during payment)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PENDING_KEY);
      if (saved) setPending((JSON.parse(saved) as { form: PendingForm }).form);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || !session) { router.replace('/login'); return; }

    fetch('/api/campaigns/list')
      .then((r) => {
        if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) {
          return { campaigns: [] };
        }
        return r.json();
      })
      .then((d: { campaigns?: Campaign[] }) => setCampaigns(d.campaigns ?? []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [session, status, router]);

  if (status === 'loading' || fetching) return <LoadingSkeleton />;
  if (!session) return null;

  const brandName      = campaigns[0]?.brandName || session.user?.name || 'Brand';
  const totalInvested  = campaigns.reduce((s, c) => s + c.totalAmount, 0);
  const activeScreens  = campaigns.filter((c) => deriveCampaignStatus(c) === 'active').reduce((s, c) => s + c.screens, 0);
  const estimatedViews = campaigns.reduce((s, c) => s + VIEWS * c.screens * c.months, 0);

  const modalPrefill = {
    brandName:   campaigns[0]?.brandName   || session.user?.name  || '',
    contactName: campaigns[0]?.contactName || session.user?.name  || '',
    email:       campaigns[0]?.email       || session.user?.email || '',
    phone:       campaigns[0]?.phone       || '',
    gstin:       campaigns[0]?.gstin       || '',
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <a href="/" className="opacity-70 hover:opacity-100 transition-opacity">
              <Logo />
            </a>
            <div className="hidden sm:block h-5 w-px bg-border" />
            <div className="hidden sm:block">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dashboard</p>
              <p className="text-sm font-semibold text-foreground leading-tight">{brandName}</p>
            </div>
          </div>
          <button
            onClick={() => nextAuthSignOut({ callbackUrl: '/login' })}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-12 space-y-8">

        {/* Summary cards */}
        {fetching ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard icon={<CalendarDays className="h-4 w-4" />} label="Campaigns"       value={campaigns.length.toString()} />
            <SummaryCard icon={<Monitor      className="h-4 w-4" />} label="Active screens"  value={activeScreens.toString()} sub="Currently live" />
            <SummaryCard icon={<IndianRupee  className="h-4 w-4" />} label="Total invested"  value={fmt(totalInvested)} />
            <SummaryCard icon={<Eye          className="h-4 w-4" />} label="Est. total views" value={estimatedViews > 0 ? `~${estimatedViews.toLocaleString('en-IN')}` : '—'} />
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="campaigns">
          <TabsList className="mb-6">
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="network">Our Network</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns">
            <AnimatePresence>
              {pending && (
                <div className="mb-4">
                  <PendingPaymentCard
                    pending={pending}
                    onDismiss={() => { localStorage.removeItem(PENDING_KEY); setPending(null); }}
                    onPaid={(newCampaign) => { setCampaigns((prev) => [newCampaign, ...prev]); setPending(null); }}
                  />
                </div>
              )}
            </AnimatePresence>

            {fetching ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
              </div>
            ) : campaigns.length === 0 && !pending ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center space-y-4"
              >
                <Monitor className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <div className="space-y-1.5">
                  <p className="font-bold text-foreground">No campaigns yet</p>
                  <p className="text-sm text-muted-foreground">Launch your first campaign to see it here.</p>
                </div>
                <button
                  onClick={() => setShowNewCampaign(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Start a campaign <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            ) : (
              <>
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setShowNewCampaign(true)}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Book more screens
                  </button>
                </div>
                <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2">
                  {campaigns.map((c) => <CampaignCard key={c.id} c={c} />)}
                </motion.div>
              </>
            )}
          </TabsContent>

          <TabsContent value="performance">
            {fetching
              ? <Skeleton className="h-64 rounded-xl" />
              : <PerformanceCharts campaigns={campaigns} />
            }
          </TabsContent>

          <TabsContent value="account">
            <AccountTab campaigns={campaigns} />
          </TabsContent>

          <TabsContent value="network">
            <NetworkTab />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border/30 py-5 text-center">
        <p className="text-xs text-muted-foreground/40">
          © 2025 Alive Advertising Solutions Pvt. Ltd. · hello@wearealive.in
        </p>
      </footer>

      {/* New Campaign Modal */}
      {showNewCampaign && (
        <NewCampaignModal
          prefill={modalPrefill}
          onClose={() => setShowNewCampaign(false)}
          onBooked={(c) => {
            setCampaigns((prev) => [c, ...prev]);
            setShowNewCampaign(false);
          }}
        />
      )}
    </div>
  );
}
