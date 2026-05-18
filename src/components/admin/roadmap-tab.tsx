'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Copy, CheckCircle2, MessageSquare } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'built' | 'in-progress' | 'planned' | 't2';
type FilterValue = 'all' | 'built' | 'in-progress' | 'planned' | 't2';

type RoadmapItem = {
  id: string;
  cluster: string;
  label: string;
  sub: string;
  status: Status;
  path?: string;
  description?: string;
  notes?: string[];
  critical?: boolean;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const ITEMS: RoadmapItem[] = [
  // Marketing Site
  {
    id: 'homepage', cluster: 'Marketing Site', label: 'Homepage', sub: 'Main brand-facing marketing page',
    status: 'built', path: 'src/app/page.tsx', critical: true,
    description: 'Main marketing homepage targeting brands. Shows value proposition, store map, pricing.',
  },
  {
    id: 'store-reg', cluster: 'Marketing Site', label: 'Store Registration', sub: '2-step kirana signup with map',
    status: 'built', path: 'src/app/store/page.tsx', critical: true,
    description: 'Two-step store partner registration: store details + Leaflet map picker, then agreement screen.',
  },
  {
    id: 'store-agreement', cluster: 'Marketing Site', label: 'Store Agreement', sub: 'Full VS Collective LLP contract',
    status: 'built', path: 'src/app/store-agreement/page.tsx',
    description: 'Rendered store partner agreement page for VS Collective LLP.',
  },
  {
    id: 'brand-onboarding', cluster: 'Marketing Site', label: 'Brand Onboarding', sub: 'Multi-step campaign flow with Razorpay',
    status: 'built', path: 'src/app/brand-onboarding/', critical: true,
    description: 'Audience → locations → duration → creative → pricing → agreement → Razorpay payment.',
  },
  {
    id: 'deals', cluster: 'Marketing Site', label: 'Deals / Offers Page', sub: 'Shopper-facing deals listing',
    status: 'built', path: 'src/app/deals/',
    description: 'Public deals page for shoppers to browse active offers at their local kirana store.',
  },
  {
    id: 'voicebill', cluster: 'Marketing Site', label: 'VoiceBill POS', sub: 'Bill model + receipt + customer dashboard',
    status: 'planned',
    description: 'Full POS integration per plan doc: Bill model, public receipt URL, customer dashboard.',
  },

  // Store Dashboard
  {
    id: 'store-auth', cluster: 'Store Dashboard', label: 'Store Auth', sub: 'Phone + password, localStorage session',
    status: 'built', path: 'src/app/store-dashboard/', critical: true,
    description: 'Custom phone+password auth. No Clerk. Session stored in localStorage under alive_store_session key.',
  },
  {
    id: 'store-overview', cluster: 'Store Dashboard', label: 'Overview Tab', sub: 'Earnings, screen status, referral code',
    status: 'built', path: 'src/app/store-dashboard/',
    description: 'Shows monthly earnings, screen health, referral code and referral count.',
  },
  {
    id: 'store-flyers', cluster: 'Store Dashboard', label: 'Flyers Tab', sub: 'Store-specific flyer management',
    status: 'built', path: 'src/app/store-dashboard/',
    description: 'Partner can view and request flyers for their store.',
  },
  {
    id: 'store-payout', cluster: 'Store Dashboard', label: 'Payout Settings', sub: 'UPI / bank details entry',
    status: 'built', path: 'src/app/store-dashboard/',
    description: 'Store partner enters UPI ID or bank account details for monthly ₹500 payout.',
  },

  // Admin Panel
  {
    id: 'admin-stores', cluster: 'Admin Panel', label: 'Stores Tab', sub: 'Search, reject, delete, stage management',
    status: 'built', path: 'src/app/admin/page.tsx', critical: true,
    description: 'Full store partner CRM: search, filter, onboarding stage selector, payout status, delete.',
  },
  {
    id: 'admin-flyers', cluster: 'Admin Panel', label: 'Flyers Tab', sub: 'Upload and manage flyers',
    status: 'built', path: 'src/app/admin/page.tsx',
    description: 'Admin can upload, preview and delete flyers. Client-side Canvas compression before storage.',
  },
  {
    id: 'admin-campaigns', cluster: 'Admin Panel', label: 'Campaigns Tab', sub: 'Revenue totals, paid/pending counts',
    status: 'built', path: 'src/app/admin/page.tsx',
    description: 'Displays all brand campaigns with revenue total, payment status and delete action.',
  },
  {
    id: 'admin-screens', cluster: 'Admin Panel', label: 'Screens Tab', sub: 'Fleet with schedule + play details',
    status: 'built', path: 'src/components/admin/screens-tab.tsx', critical: true,
    description: 'Full device fleet: claim status, heartbeat, active schedule, group assignment.',
  },
  {
    id: 'admin-content', cluster: 'Admin Panel', label: 'Content Tab', sub: 'Media library with R2 upload',
    status: 'built', path: 'src/components/admin/content-tab.tsx',
    description: 'Upload images/videos to Cloudflare R2. Displays library with MD5, duration, delete.',
  },
  {
    id: 'admin-playlists', cluster: 'Admin Panel', label: 'Playlists Tab', sub: 'Ordered content playlists',
    status: 'built', path: 'src/components/admin/playlists-tab.tsx',
    description: 'Create and manage playlists — ordered list of content items with per-item duration.',
  },
  {
    id: 'admin-schedules', cluster: 'Admin Panel', label: 'Schedules Tab', sub: 'Assign playlists to devices/groups',
    status: 'built', path: 'src/components/admin/schedules-tab.tsx', critical: true,
    description: 'Assign a playlist to specific devices or a group name, with optional dayparting.',
  },
  {
    id: 'admin-reports', cluster: 'Admin Panel', label: 'Reports Tab', sub: 'POP logs + CSV export',
    status: 'built', path: 'src/components/admin/reports-tab.tsx', critical: true,
    description: 'Proof-of-play event log. Filter by device/campaign/date. CSV download for billing.',
  },
  {
    id: 'admin-monitoring', cluster: 'Admin Panel', label: 'Monitoring Tab', sub: 'Live heartbeat grid',
    status: 'built', path: 'src/components/admin/monitoring-tab.tsx',
    description: 'Real-time device health grid. Shows online/offline state, last seen, CPU/RAM.',
  },
  {
    id: 'admin-payments', cluster: 'Admin Panel', label: 'Payments Tab', sub: 'Per-store monthly payout tracking',
    status: 'built', path: 'src/components/admin/store-payments-tab.tsx', critical: true,
    description: 'Track ₹500/month per store. Pay Now via UPI modal with QR code. Mark paid / skip / UTR entry.',
  },
  {
    id: 'admin-media', cluster: 'Admin Panel', label: 'Site Media Tab', sub: 'Hero images via R2',
    status: 'built', path: 'src/components/admin/site-media-tab.tsx',
    description: 'Manage homepage hero images stored on Cloudflare R2.',
  },
  {
    id: 'admin-moderation', cluster: 'Admin Panel', label: 'Creative Moderation Queue', sub: 'Approve / reject brand creatives',
    status: 't2',
    description: 'Admin review queue for brand-submitted ad creatives before they go to screens.',
  },
  {
    id: 'admin-roadmap', cluster: 'Admin Panel', label: 'Platform Map', sub: 'This tab — build progress overview',
    status: 'built', path: 'src/components/admin/roadmap-tab.tsx',
    description: 'Visual build-progress map of all ALIVE platform components.',
  },

  // Device APIs
  {
    id: 'api-claim', cluster: 'Device APIs', label: 'POST /api/device/claim', sub: 'First-boot → JWT provisioning',
    status: 'built', path: 'src/app/api/device/claim/route.ts', critical: true,
    description: 'Android player calls this on first boot with hardwareKey → returns JWT for subsequent requests.',
  },
  {
    id: 'api-events', cluster: 'Device APIs', label: 'POST /api/device/events', sub: 'POP batch + hash chain',
    status: 'built', path: 'src/app/api/device/events/route.ts', critical: true,
    description: 'Receives batched proof-of-play events from player. Stores prevHash/rowHash for tamper-evident chain.',
  },
  {
    id: 'api-plan', cluster: 'Device APIs', label: 'GET /api/device/plan', sub: '72-hour schedule + content window',
    status: 'built', path: 'src/app/api/device/plan/route.ts', critical: true,
    description: 'Returns 72h schedule plan with content URLs and MD5s. Player caches for offline operation.',
  },
  {
    id: 'api-devices', cluster: 'Device APIs', label: 'GET /api/devices', sub: 'Fleet list with live schedule',
    status: 'built', path: 'src/app/api/devices/route.ts',
    description: 'Admin fleet list with current schedule, last heartbeat, device metadata.',
  },
  {
    id: 'api-payout', cluster: 'Device APIs', label: 'POST /api/admin/payout', sub: 'Razorpay X + UPI fallback',
    status: 'built', path: 'src/app/api/admin/payout/route.ts',
    description: 'Initiate store partner payout via Razorpay X transfer or manual UPI reference.',
  },
  {
    id: 'api-health', cluster: 'Device APIs', label: 'GET /api/health', sub: 'Platform health check',
    status: 'built', path: 'src/app/api/health/route.ts',
    description: 'Returns platform health status. Used by uptime monitors.',
  },

  // Background Jobs
  {
    id: 'job-health-cron', cluster: 'Background Jobs', label: 'Device Health Cron', sub: 'Offline detect → tickets',
    status: 'built', path: 'src/app/api/cron/',
    description: 'Periodic job that marks devices offline if heartbeat overdue. Creates support tickets.',
  },
  {
    id: 'job-context-sync', cluster: 'Background Jobs', label: 'Context Sync Cron', sub: 'Platform state for AI',
    status: 'built', path: 'src/app/api/cron/',
    description: 'Syncs platform context (store list, device states) for AI features.',
  },
  {
    id: 'job-signals', cluster: 'Background Jobs', label: 'External Signals Cron', sub: 'Festival / weather / news',
    status: 'built', path: 'src/app/api/cron/',
    description: 'Pulls festival calendar, local weather and news for contextual ad targeting.',
  },
  {
    id: 'job-whatsapp', cluster: 'Background Jobs', label: 'WhatsApp Alerts', sub: 'Device offline → notify admin',
    status: 'in-progress', path: 'src/lib/notify.ts',
    description: 'notifyAdminWA() function exists. Auto-trigger from health cron pending integration.',
  },
  {
    id: 'job-remediation', cluster: 'Background Jobs', label: 'Auto Remediation', sub: 'AI proposes fixes for issues',
    status: 'in-progress',
    description: 'Route exists for AI-proposed fixes. Not yet auto-triggered from monitoring pipeline.',
  },
  {
    id: 'job-gst', cluster: 'Background Jobs', label: 'GST Invoice Generator', sub: 'Automated GST invoices',
    status: 't2',
    description: 'Automated GST invoice generation. Needs CA validation before enabling.',
  },

  // Data & Infra
  {
    id: 'infra-postgres', cluster: 'Data & Infra', label: 'PostgreSQL / Neon', sub: 'Primary database',
    status: 'built', critical: true,
    description: 'Neon serverless Postgres. Pooled DATABASE_URL for runtime, direct for migrations.',
  },
  {
    id: 'infra-redis', cluster: 'Data & Infra', label: 'Redis / Upstash', sub: 'Cache + rate limiting',
    status: 'built',
    description: 'Upstash Redis for sessions, rate limiting, short-lived state.',
  },
  {
    id: 'infra-r2', cluster: 'Data & Infra', label: 'Cloudflare R2', sub: 'Zero-egress media storage',
    status: 'built', critical: true,
    description: 'R2 bucket for all media. Direct browser → R2 upload via signed PUT URLs from lib/r2.ts.',
  },
  {
    id: 'infra-prisma', cluster: 'Data & Infra', label: 'Prisma Migrations', sub: 'Schema + migration history',
    status: 'built', path: 'prisma/schema.prisma',
    description: 'Prisma 6 schema with all models. Run npx prisma migrate dev after schema changes.',
  },
  {
    id: 'infra-vercel', cluster: 'Data & Infra', label: 'Vercel Deploy', sub: 'Auto-deploy on push to main',
    status: 'built',
    description: 'Push to main → auto-deploy to Vercel production. Feature branch: claude/build-alive-advertising-platform-tlG96.',
  },

  // Android Player
  {
    id: 'player-launcher', cluster: 'Android Player', label: 'SystemLauncher', sub: 'Home app, survives reboot',
    status: 'planned', critical: true,
    description: 'Sets ALIVE Player as the Android TV home app so it auto-starts on reboot.',
  },
  {
    id: 'player-watchdog', cluster: 'Android Player', label: 'WatchdogService', sub: 'Crash detect + auto restart',
    status: 'planned', critical: true,
    description: 'Monitors player process health and auto-restarts on crash.',
  },
  {
    id: 'player-ntp', cluster: 'Android Player', label: 'NTPSyncManager', sub: 'Clock accuracy for POP timestamps',
    status: 'planned', critical: true,
    description: 'Syncs device clock via NTP for accurate proof-of-play timestamps.',
    notes: ['Highest RICE score in T1 (405) — build before POPEmitter'],
  },
  {
    id: 'player-cache', cluster: 'Android Player', label: 'ContentCache', sub: 'Local creative store + MD5 verify',
    status: 'planned',
    description: 'Caches downloaded creatives locally. MD5 verification before serving.',
  },
  {
    id: 'player-sync', cluster: 'Android Player', label: 'SyncManager', sub: 'Delta schedule + content pull',
    status: 'planned', critical: true,
    description: 'Pulls schedule and content deltas from /api/device/plan. Stores for offline use.',
  },
  {
    id: 'player-playback', cluster: 'Android Player', label: 'PlaybackEngine', sub: 'ExoPlayer video + image renderer',
    status: 'planned', critical: true,
    description: 'ExoPlayer-based video and image slideshow renderer following playlist schedule.',
  },
  {
    id: 'player-pop', cluster: 'Android Player', label: 'POPEmitter', sub: 'Per-play log + offline SQLite buffer',
    status: 'planned', critical: true,
    description: 'Records each play event, buffers in SQLite when offline, batches to /api/device/events.',
  },
  {
    id: 'player-telemetry', cluster: 'Android Player', label: 'TelemetryAgent', sub: 'CPU/RAM/net heartbeat',
    status: 'planned',
    description: 'Sends periodic CPU, RAM and network telemetry to monitoring endpoint.',
  },
  {
    id: 'player-apk', cluster: 'Android Player', label: 'APK Distribution', sub: 'Signed APK + OTA update channel',
    status: 'planned',
    description: 'Distribute signed APK to store partners. OTA update channel for fleet management.',
    notes: ['ALIVE_PLAYER_API.md in repo root has full integration guide'],
  },

  // Brand Features T2
  {
    id: 't2-wallet', cluster: 'Brand Features T2', label: 'Brand Wallet', sub: 'Razorpay top-up + balance',
    status: 't2',
    description: 'Prepaid brand wallet with Razorpay top-up. walletPaise BigInt on Brand model.',
  },
  {
    id: 't2-builder', cluster: 'Brand Features T2', label: 'Self-Serve Campaign Builder', sub: 'Brand DIY campaign creation',
    status: 't2',
    description: 'Self-serve UI for brands to build and submit campaigns without sales team.',
  },
  {
    id: 't2-billing', cluster: 'Brand Features T2', label: 'Billing Engine', sub: 'Per-play debit + auto-pause',
    status: 't2',
    description: 'Debit brand wallet per verified play. Auto-pause campaign when balance runs low.',
  },
  {
    id: 't2-audit', cluster: 'Brand Features T2', label: 'Audit Log Service', sub: 'Immutable trail',
    status: 't2',
    description: 'Immutable audit log using prevHash/rowHash chain on AuditLog model.',
  },
  {
    id: 't2-remote-ops', cluster: 'Brand Features T2', label: 'Remote Device Ops', sub: 'Reboot/sync via queue',
    status: 't2',
    description: 'Remote reboot, force-sync and config push to devices via a command queue.',
  },
];

// ─── Cluster order ────────────────────────────────────────────────────────────

const CLUSTER_ORDER = [
  'Marketing Site',
  'Store Dashboard',
  'Admin Panel',
  'Device APIs',
  'Background Jobs',
  'Data & Infra',
  'Android Player',
  'Brand Features T2',
];

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Status, { label: string; dot: string; badge: string }> = {
  'built':       { label: 'Built',        dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border border-green-200'   },
  'in-progress': { label: 'In Progress',  dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border border-amber-200'   },
  'planned':     { label: 'Planned (T1)', dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 border border-blue-200'     },
  't2':          { label: 'T2 Future',    dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 border border-purple-200' },
};

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'built',       label: 'Built' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'planned',     label: 'Planned (T1)' },
  { value: 't2',          label: 'T2 Future' },
];

const NOTES_KEY = 'alive_roadmap_notes';

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoadmapTab() {
  const [filter, setFilter]       = useState<FilterValue>('all');
  const [notes, setNotes]         = useState<Record<string, string>>({});
  const [selected, setSelected]   = useState<RoadmapItem | null>(null);
  const [panelNote, setPanelNote] = useState('');
  const [copied, setCopied]       = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Load notes from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      if (raw) setNotes(JSON.parse(raw) as Record<string, string>);
    } catch { /* ignore */ }
  }, []);

  // When panel opens, populate textarea with existing note
  useEffect(() => {
    if (selected) setPanelNote(notes[selected.id] ?? '');
  }, [selected, notes]);

  const saveNote = useCallback(() => {
    if (!selected) return;
    const updated = { ...notes, [selected.id]: panelNote };
    if (!panelNote) delete updated[selected.id];
    setNotes(updated);
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  }, [selected, panelNote, notes]);

  const copyBrief = useCallback(() => {
    if (!selected) return;
    const text = [
      `**Item: ${selected.label}**`,
      selected.sub,
      `Status: ${selected.status}`,
      selected.path ? `Path: ${selected.path}` : null,
      notes[selected.id] ? `Note: ${notes[selected.id]}` : null,
      '',
    ].filter(v => v !== null).join('\n');
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [selected, notes]);

  const copyAllNotes = useCallback(() => {
    const dated = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const itemsWithNotes = ITEMS.filter(item => notes[item.id]);
    if (!itemsWithNotes.length) { alert('No notes added yet.'); return; }
    const lines = [
      `# ALIVE Platform Notes — ${dated}`,
      '',
      '## Items needing attention:',
      '',
      ...itemsWithNotes.flatMap(item => [
        `**${item.label}** (${item.cluster})`,
        `Status: ${item.status}${item.path ? ` | Path: ${item.path}` : ''}`,
        `Note: ${notes[item.id]}`,
        '',
      ]),
    ];
    void navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  }, [notes]);

  // Stats
  const t1Items = ITEMS.filter(i => i.status !== 't2');
  const builtCount      = ITEMS.filter(i => i.status === 'built').length;
  const inProgressCount = ITEMS.filter(i => i.status === 'in-progress').length;
  const plannedCount    = ITEMS.filter(i => i.status === 'planned').length;
  const t2Count         = ITEMS.filter(i => i.status === 't2').length;
  const t1Built         = t1Items.filter(i => i.status === 'built').length;
  const progressPct     = Math.round((t1Built / t1Items.length) * 100);

  // Filtered items grouped by cluster
  const visibleItems = filter === 'all' ? ITEMS : ITEMS.filter(i => i.status === filter);
  const clusters = CLUSTER_ORDER.filter(c => visibleItems.some(i => i.cluster === c));

  const noteCount = Object.keys(notes).length;

  return (
    <div className="space-y-5">

      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
              T1 Progress
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-green-600 shrink-0">{progressPct}%</span>
          </div>
          {/* Stats row */}
          <div className="flex flex-wrap gap-3 text-[11px]">
            <span className="text-green-600 font-semibold">{builtCount} built</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-amber-600 font-semibold">{inProgressCount} in progress</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-blue-600 font-semibold">{plannedCount} planned</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-purple-600 font-semibold">{t2Count} t2</span>
          </div>
        </div>
        {/* Copy all notes */}
        <button
          onClick={copyAllNotes}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors shrink-0"
        >
          {copiedAll ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copiedAll ? 'Copied!' : `Copy all notes for Claude${noteCount > 0 ? ` (${noteCount})` : ''}`}
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
              filter === f.value
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Clusters */}
      <div className="space-y-8">
        {clusters.map(cluster => {
          const clusterItems = visibleItems.filter(i => i.cluster === cluster);
          const clusterNotes = clusterItems.filter(i => notes[i.id]).length;
          return (
            <div key={cluster}>
              {/* Cluster heading */}
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{cluster}</h2>
                {clusterNotes > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <MessageSquare className="h-2.5 w-2.5" />
                    {clusterNotes} {clusterNotes === 1 ? 'note' : 'notes'}
                  </span>
                )}
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Item grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {clusterItems.map(item => {
                  const sc = STATUS_CONFIG[item.status];
                  const hasNote = !!notes[item.id];
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className="text-left rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all p-3 group"
                    >
                      <div className="flex items-start gap-2">
                        {/* Status dot */}
                        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${sc.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                              {item.label}
                            </span>
                            {item.critical && (
                              <span className="rounded-full px-1.5 py-px text-[9px] font-bold uppercase bg-red-50 text-red-600 border border-red-200 leading-tight shrink-0">
                                critical
                              </span>
                            )}
                            {hasNote && (
                              <MessageSquare className="h-3 w-3 text-amber-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                            {item.sub}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      {selected && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelected(null)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 z-50 h-full w-full max-w-[360px] bg-card border-l border-border flex flex-col shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CONFIG[selected.status].badge}`}>
                    {STATUS_CONFIG[selected.status].label}
                  </span>
                  {selected.critical && (
                    <span className="rounded-full px-1.5 py-px text-[9px] font-bold uppercase bg-red-50 text-red-600 border border-red-200">
                      critical
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-foreground leading-tight">{selected.label}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{selected.sub}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Cluster */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Cluster</p>
                <p className="text-sm text-foreground">{selected.cluster}</p>
              </div>

              {/* Path */}
              {selected.path && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Path</p>
                  <code className="text-xs bg-muted rounded px-2 py-1 text-foreground break-all block">{selected.path}</code>
                </div>
              )}

              {/* Description */}
              {selected.description && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Description</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
                </div>
              )}

              {/* Notes from data */}
              {selected.notes && selected.notes.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
                  <ul className="space-y-1">
                    {selected.notes.map((n, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Admin note textarea */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Add note for Claude...</p>
                <textarea
                  value={panelNote}
                  onChange={e => setPanelNote(e.target.value)}
                  placeholder="What needs attention? What's blocking this? Paste context here…"
                  rows={4}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                />
                <button
                  onClick={saveNote}
                  className="mt-1.5 w-full rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-colors"
                >
                  Save note
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border">
              <button
                onClick={copyBrief}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy Claude Brief'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
