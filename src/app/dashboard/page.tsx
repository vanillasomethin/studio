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
  Monitor, TrendingUp, Eye, DollarSign, LogOut, Mail,
  CalendarDays, CheckCircle2, Clock, AlertCircle, ArrowRight,
  CreditCard, X, Loader2,
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
  const fmt            = (n: number) => `₹${n.toLocaleString('en-IN')}`;

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
          ['Rate',     fmt(pricePerScreen) + '/screen'],
          ['Start',    pending.startDate ? format(parseISO(pending.startDate), 'd MMM') : '—'],
          ['Total',    fmt(total)],
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
          : <><CreditCard className="h-4 w-4" /> Complete payment — {fmt(total)}</>
        }
      </button>
    </motion.div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router                  = useRouter();
  const { data: session, status } = useSession();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [fetching,  setFetching]  = useState(true);
  const [pending,   setPending]   = useState<PendingForm | null>(null);

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
            <SummaryCard icon={<DollarSign   className="h-4 w-4" />} label="Total invested"  value={fmt(totalInvested)} />
            <SummaryCard icon={<Eye          className="h-4 w-4" />} label="Est. total views" value={estimatedViews > 0 ? `~${estimatedViews.toLocaleString('en-IN')}` : '—'} />
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="campaigns">
          <TabsList className="mb-6">
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
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
                <a
                  href="/brand-onboarding"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Start a campaign <ArrowRight className="h-4 w-4" />
                </a>
              </motion.div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2">
                {campaigns.map((c) => <CampaignCard key={c.id} c={c} />)}
              </motion.div>
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
        </Tabs>
      </main>

      <footer className="border-t border-border/30 py-5 text-center">
        <p className="text-xs text-muted-foreground/40">
          © 2025 Alive Advertising Solutions Pvt. Ltd. · hello@wearealive.in
        </p>
      </footer>
    </div>
  );
}
