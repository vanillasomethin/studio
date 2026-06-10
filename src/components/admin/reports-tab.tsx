'use client';

import { useEffect, useState, useMemo } from 'react';
import { Loader2, Download, AlertCircle, PlayCircle, Filter, BarChart3, FileBarChart2, FileText, Activity, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getEvents, getEventsExportUrl, getDevices, type PlayEvent, type Device } from '@/lib/backend-api';

function fmtHours(ms: number): string {
  if (ms < 60_000)       return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000)    return `${Math.round(ms / 60_000)} min`;
  return `${(ms / 3_600_000).toFixed(1)} hrs`;
}

function fmtDateShort(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }
  catch { return iso; }
}

const inp = 'rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';

function screenLabel(d?: Device | null): string {
  if (!d) return 'Unknown screen';
  const tail = (d.hardwareKey ?? d.id).slice(-4).toUpperCase();
  return d.linkedStoreName ? `${d.linkedStoreName} · #${tail}` : `Screen #${tail}`;
}

function SectionLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="admin-section-label">
      <span className="admin-section-label__n">N°{String(n).padStart(2, '0')}</span>
      <span className="admin-section-label__rule" />
      <span className="admin-section-label__lbl">{label}</span>
    </div>
  );
}

const SAVED_REPORTS = [
  { name: 'Pilot uplift · 412 stores · 12 weeks',   date: 'Generated weekly · Nielsen partnership',        Icon: FileBarChart2 },
  { name: 'Brand recall study · Parle-G',            date: 'May 18 · matched-control sample n=412',         Icon: FileText      },
  { name: 'Kirana payout ledger · April 2026',       date: 'Released May 1 · UPI / NEFT receipts',          Icon: BarChart3     },
  { name: 'Slot utilisation · 7 AM – 9 PM',          date: 'Updated daily · Network 027',                   Icon: Activity      },
  { name: 'Network expansion plan · Q3 2026',        date: 'Bengaluru, Hyderabad, Chennai readiness',       Icon: MapPin        },
];

const ACTIVITY_FEED = [
  { text: 'Parle-G Monsoon Bites went live on 386 screens',           time: '12s ago',   color: 'red'   },
  { text: '₹64,200 released to 84 partners via UPI',                   time: '8 min ago', color: 'green' },
  { text: 'New partner onboarded — Hegde Kirana, Yeyyadi',            time: '21 min ago',color: ''      },
  { text: '"Good Day Wave 7" approved for 312 screens',               time: '44 min ago',color: 'green' },
  { text: '2 screens offline in Kadri Kambla — field team dispatched',time: '1 hr ago',  color: 'red'   },
  { text: 'Pilot cohort 412 stores · +20% average sales lift confirmed', time: '2 hr ago', color: '' },
];

export default function ReportsTab() {
  const [events,  setEvents]  = useState<PlayEvent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [tagFilter, setTagFilter] = useState('');
  const [fromDate,  setFromDate]  = useState('');
  const [toDate,    setToDate]    = useState('');

  const load = () => {
    setLoading(true); setError(null);
    const params: Record<string, string> = {};
    if (tagFilter) params.tag  = tagFilter;
    if (fromDate)  params.from = fromDate;
    if (toDate)    params.to   = toDate;
    Promise.all([
      getEvents(params),
      getDevices({ take: '500' }).then((r) => r.devices).catch(() => [] as Device[]),
    ])
      .then(([ev, dv]) => { setEvents(ev); setDevices(dv); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const deviceById = useMemo(() => {
    const m = new Map<string, Device>();
    devices.forEach((d) => m.set(d.id, d));
    return m;
  }, [devices]);

  const totalPlays    = events.length;
  const totalMs       = events.reduce((s, e) => s + e.durationMs, 0);
  const activeScreens = new Set(events.map((e) => e.deviceId)).size;
  const totalRevPaise = events.reduce((s, e) => s + (e.costPaise ?? 0), 0);

  type ContentRow = { mediaId: string; campaignTag: string | null; plays: number; durationMs: number; screens: Set<string>; lastPlayedAt: string };
  const byContent = useMemo(() => {
    const m = new Map<string, ContentRow>();
    for (const e of events) {
      const key = `${e.mediaId}|${e.tag ?? ''}`;
      const row = m.get(key) ?? { mediaId: e.mediaId, campaignTag: e.tag ?? null, plays: 0, durationMs: 0, screens: new Set<string>(), lastPlayedAt: e.startedAt };
      row.plays += 1; row.durationMs += e.durationMs; row.screens.add(e.deviceId);
      if (e.startedAt > row.lastPlayedAt) row.lastPlayedAt = e.startedAt;
      m.set(key, row);
    }
    return Array.from(m.values()).sort((a, b) => b.plays - a.plays);
  }, [events]);

  type ScreenRow = { deviceId: string; plays: number; durationMs: number; lastPlayedAt: string };
  const byScreen = useMemo(() => {
    const m = new Map<string, ScreenRow>();
    for (const e of events) {
      const row = m.get(e.deviceId) ?? { deviceId: e.deviceId, plays: 0, durationMs: 0, lastPlayedAt: e.startedAt };
      row.plays += 1; row.durationMs += e.durationMs;
      if (e.startedAt > row.lastPlayedAt) row.lastPlayedAt = e.startedAt;
      m.set(e.deviceId, row);
    }
    return Array.from(m.values()).sort((a, b) => b.plays - a.plays);
  }, [events]);

  const csvUrl = getEventsExportUrl({
    ...(tagFilter ? { tag: tagFilter } : {}),
    ...(fromDate  ? { from: fromDate } : {}),
    ...(toDate    ? { to: toDate }     : {}),
  });

  if (error) return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex gap-3">
      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-foreground">Could not load reports</p>
        <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Page head */}
      <div className="mb-6">
        <p className="admin-font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-primary mb-0.5">Proof of play</p>
        <h1 className="admin-font-display text-3xl font-bold text-foreground tracking-tight">
          <em className="not-italic text-primary">Quantifiably</em> better, in writing.
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every campaign verified by play event. 20% sales lift · 74% brand recall · 2× stock velocity. Pull the report, share with your team.
        </p>
      </div>

      {/* KPI summary tiles */}
      <div className="admin-summary-row">
        {[
          { label: 'Total plays',    value: loading ? '—' : totalPlays.toLocaleString('en-IN') },
          { label: 'Watch time',     value: loading ? '—' : fmtHours(totalMs) },
          { label: 'Active screens', value: loading ? '—' : activeScreens.toString() },
          { label: 'Revenue',        value: loading ? '—' : `₹${(totalRevPaise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
        ].map((s) => (
          <div key={s.label} className="admin-summary-tile">
            <div className="admin-summary-tile__label">{s.label}</div>
            <div className="admin-summary-tile__value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Saved reports + activity feed */}
      <SectionLabel n={1} label="Saved reports" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card px-5 py-2">
          {SAVED_REPORTS.map((r) => (
            <div key={r.name} className="admin-report-row">
              <div className="admin-report-icon"><r.Icon className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="admin-report-name truncate">{r.name}</div>
                <div className="admin-report-date">{r.date}</div>
              </div>
              <a href={csvUrl} download className="shrink-0 flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                <Download className="h-3 w-3" /> CSV
              </a>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Activity</p>
            <p className="admin-font-mono text-[9px] text-muted-foreground/60">Network 027</p>
          </div>
          <div className="admin-act">
            {ACTIVITY_FEED.map((a, i) => (
              <div key={i} className="admin-act-item">
                <div className={`admin-act-icon${a.color ? ` admin-act-icon--${a.color}` : ''}`}>
                  <Activity className="h-3 w-3" />
                </div>
                <div className="admin-act-text">{a.text}</div>
                <span className="admin-act-time">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Proof-of-play event filters */}
      <SectionLabel n={2} label="Proof-of-play events" />
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mr-1">
          <Filter className="h-3.5 w-3.5" />
        </div>
        <input type="text" placeholder="Campaign tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={inp} />
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inp} title="From date" />
        <input type="date" value={toDate}   onChange={(e) => setToDate(e.target.value)}   className={inp} title="To date" />
        <button onClick={load}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-colors">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />} Apply
        </button>
        <a href={csvUrl} download="alive-pop-report.csv"
          className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-foreground hover:border-primary/40 transition-colors">
          <Download className="h-3.5 w-3.5 text-primary" /> CSV
        </a>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0,1,2,3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : !events.length ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <PlayCircle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No play events yet for this period.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Screens will report play events once content runs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top content */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Top content</p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Content</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plays</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Watch</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Screens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {byContent.slice(0, 15).map((c) => (
                  <tr key={`${c.mediaId}|${c.campaignTag ?? ''}`} className="hover:bg-muted/20">
                    <td className="px-3 py-2">
                      {c.campaignTag
                        ? <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{c.campaignTag}</span>
                        : <span className="text-muted-foreground/50 text-[10px] italic">Untagged</span>}
                      <p className="text-[9px] text-muted-foreground/40 mt-0.5">Last played {fmtDateShort(c.lastPlayedAt)}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-foreground">{c.plays}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{fmtHours(c.durationMs)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{c.screens.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {byContent.length > 15 && (
              <div className="px-4 py-2 bg-muted/30 text-[10px] text-muted-foreground text-center border-t border-border">
                Top 15 of {byContent.length} · CSV has all
              </div>
            )}
          </div>

          {/* Top screens */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Top screens</p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Screen</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plays</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Watch</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Last</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {byScreen.slice(0, 15).map((s) => (
                  <tr key={s.deviceId} className="hover:bg-muted/20">
                    <td className="px-3 py-2 text-foreground truncate max-w-[180px]">{screenLabel(deviceById.get(s.deviceId))}</td>
                    <td className="px-3 py-2 text-right font-bold text-foreground">{s.plays}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{fmtHours(s.durationMs)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{fmtDateShort(s.lastPlayedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {byScreen.length > 15 && (
              <div className="px-4 py-2 bg-muted/30 text-[10px] text-muted-foreground text-center border-t border-border">
                Top 15 of {byScreen.length} screens
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
