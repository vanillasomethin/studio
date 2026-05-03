'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { format, addMonths, eachDayOfInterval, parseISO } from 'date-fns';
import {
  collection, query, where, getDocs, doc, getDoc, orderBy, type Timestamp,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Logo } from '@/components/icons/logo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Monitor, TrendingUp, Eye, DollarSign, LogOut, Mail,
  CalendarDays, CheckCircle2, Clock, AlertCircle, ArrowRight,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Campaign = {
  id:             string;
  brandName:      string;
  contactName:    string;
  email:          string;
  phone:          string;
  gstin:          string;
  screens:        number;
  months:         number;
  startDate:      string;
  pricePerScreen: number;
  totalAmount:    number;
  paymentId:      string;
  orderId:        string;
  status:         'upcoming' | 'active' | 'completed';
  createdAt:      Timestamp | null;
};

type UserProfile = {
  brandName:   string;
  contactName: string;
  email:       string;
  phone:       string;
  gstin:       string;
};

// ─── Animations ────────────────────────────────────────────────────────────────

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } } };

// ─── Utilities ─────────────────────────────────────────────────────────────────

const fmt     = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const PLAYS   = 144;
const VIEWS   = 4320;

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const STATUS_STYLES: Record<Campaign['status'], string> = {
  upcoming:  'bg-blue-500/15 text-blue-400 border-blue-500/20',
  active:    'bg-green-500/15 text-green-400 border-green-500/20',
  completed: 'bg-muted text-muted-foreground border-border',
};

const STATUS_ICONS: Record<Campaign['status'], React.ReactNode> = {
  upcoming:  <Clock       className="h-3 w-3" />,
  active:    <CheckCircle2 className="h-3 w-3" />,
  completed: <AlertCircle  className="h-3 w-3" />,
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

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

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
  const status = deriveCampaignStatus(c);
  const startFormatted = c.startDate
    ? format(parseISO(c.startDate), 'd MMM yyyy')
    : '—';
  const endFormatted = c.startDate
    ? format(addMonths(parseISO(c.startDate), c.months), 'd MMM yyyy')
    : '—';

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
          { icon: <Monitor className="h-3.5 w-3.5" />,    label: 'Screens',    value: c.screens.toString() },
          { icon: <TrendingUp className="h-3.5 w-3.5" />, label: 'Plays/day',  value: `~${(PLAYS * c.screens).toLocaleString('en-IN')}` },
          { icon: <Eye className="h-3.5 w-3.5" />,        label: 'Views/mo',   value: `~${(VIEWS * c.screens).toLocaleString('en-IN')}` },
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
          <p className="font-mono text-[10px] text-foreground mt-0.5 truncate max-w-[120px]">{c.paymentId}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Performance Charts ────────────────────────────────────────────────────────

function PerformanceCharts({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) return (
    <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground text-sm">
      No campaign data to display.
    </div>
  );

  // Monthly views bar chart data
  const barData = campaigns.map((c) => ({
    name:       c.brandName.length > 12 ? c.brandName.slice(0, 12) + '…' : c.brandName,
    'Monthly views': VIEWS * c.screens,
    'Daily plays':   PLAYS * c.screens,
  }));

  // Daily plays area chart — build a timeline for each campaign
  const allDates = new Set<string>();
  const campaignDayMap: Record<string, Record<string, number>> = {};

  campaigns.forEach((c) => {
    if (!c.startDate) return;
    const start = parseISO(c.startDate);
    const end   = addMonths(start, c.months);
    const days  = eachDayOfInterval({ start, end });
    const label = c.brandName.length > 12 ? c.brandName.slice(0, 12) + '…' : c.brandName;
    campaignDayMap[label] = {};
    days.forEach((d) => {
      const key = format(d, 'dd MMM');
      allDates.add(key);
      campaignDayMap[label][key] = PLAYS * c.screens;
    });
  });

  const sortedDates = [...allDates].slice(0, 60); // cap at 60 days for readability
  const areaData = sortedDates.map((date) => {
    const row: Record<string, string | number> = { date };
    Object.entries(campaignDayMap).forEach(([label, days]) => {
      row[label] = days[date] ?? 0;
    });
    return row;
  });

  const campaignLabels = Object.keys(campaignDayMap);
  const axisStyle = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Daily plays timeline</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={areaData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={axisStyle} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString('en-IN')} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {campaignLabels.map((label, i) => (
              <Area
                key={label}
                type="monotone"
                dataKey={label}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
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
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
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

function AccountTab({ phone, profile }: { phone: string | null; profile: UserProfile | null }) {
  const fields: [string, string][] = [
    ['Brand / company',   profile?.brandName   || '—'],
    ['Contact name',      profile?.contactName || '—'],
    ['Email',             profile?.email       || '—'],
    ['Phone',             phone                || '—'],
    ['GSTIN',             profile?.gstin       || '—'],
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
        href={`mailto:hello@alive.agency?subject=Campaign%20support%20—%20${encodeURIComponent(profile?.brandName || '')}`}
        className="flex items-center justify-center gap-2.5 w-full rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-all"
      >
        <Mail className="h-4 w-4" /> Contact your Account Manager
      </motion.a>
    </motion.div>
  );
}

// ─── Dashboard Content ────────────────────────────────────────────────────────

function DashboardContent({ uid, phone }: { uid: string; phone: string | null }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [profile,   setProfile]   = useState<UserProfile | null>(null);
  const [fetching,  setFetching]  = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(
          collection(db, 'campaigns'),
          where('uid', '==', uid),
          orderBy('createdAt', 'desc'),
        );
        const snap = await getDocs(q);
        setCampaigns(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign)));

        const uSnap = await getDoc(doc(db, 'users', uid));
        if (uSnap.exists()) setProfile(uSnap.data() as UserProfile);
      } catch {
        // Firestore index may not exist yet on first run — campaigns will be empty
      } finally {
        setFetching(false);
      }
    };
    load();
  }, [uid]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  // Summary stats
  const totalInvested  = campaigns.reduce((s, c) => s + c.totalAmount, 0);
  const activeScreens  = campaigns.filter((c) => deriveCampaignStatus(c) === 'active').reduce((s, c) => s + c.screens, 0);
  const estimatedViews = campaigns.reduce((s, c) => s + VIEWS * c.screens * c.months, 0);

  const brandName = profile?.brandName || campaigns[0]?.brandName || 'Brand';

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
            onClick={handleSignOut}
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
            <SummaryCard icon={<CalendarDays className="h-4 w-4" />} label="Campaigns"     value={campaigns.length.toString()} sub={campaigns.length === 1 ? '1 campaign' : `${campaigns.length} total`} />
            <SummaryCard icon={<Monitor      className="h-4 w-4" />} label="Active screens" value={activeScreens.toString()}    sub="Currently running" />
            <SummaryCard icon={<DollarSign   className="h-4 w-4" />} label="Total invested" value={fmt(totalInvested)}           sub="All campaigns" />
            <SummaryCard icon={<Eye          className="h-4 w-4" />} label="Est. total views" value={estimatedViews > 0 ? `~${estimatedViews.toLocaleString('en-IN')}` : '—'} sub="Across all campaigns" />
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
            {fetching ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
              </div>
            ) : campaigns.length === 0 ? (
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
            <AccountTab phone={phone} profile={profile} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border/30 py-5 text-center">
        <p className="text-xs text-muted-foreground/40">
          © 2025 Alive Advertising Solutions Pvt. Ltd. · hello@alive.agency
        </p>
      </footer>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router         = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user === null) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || user === undefined) return <LoadingSkeleton />;
  if (!user) return null;

  return <DashboardContent uid={user.uid} phone={user.phoneNumber} />;
}
