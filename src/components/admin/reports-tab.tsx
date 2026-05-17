'use client';

import { useEffect, useState } from 'react';
import { Loader2, Download, AlertCircle, PlayCircle, Filter } from 'lucide-react';
import { getEvents, getEventsExportUrl, type PlayEvent } from '@/lib/backend-api';

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function fmtDuration(ms: number): string {
  if (ms < 1000)  return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

const inp = 'rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';

export default function ReportsTab() {
  const [events,  setEvents]  = useState<PlayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Filters
  const [deviceFilter, setDeviceFilter] = useState('');
  const [tagFilter,    setTagFilter]    = useState('');
  const [fromDate,     setFromDate]     = useState('');
  const [toDate,       setToDate]       = useState('');

  const load = () => {
    setLoading(true); setError(null);
    const params: Record<string, string> = {};
    if (deviceFilter) params.deviceId = deviceFilter;
    if (tagFilter)    params.tag       = tagFilter;
    if (fromDate)     params.from      = fromDate;
    if (toDate)       params.to        = toDate;
    getEvents(params)
      .then(setEvents)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const totalPlays       = events.length;
  const totalMs          = events.reduce((s, e) => s + e.durationMs, 0);
  const uniqueDevices    = new Set(events.map((e) => e.deviceId)).size;
  const uniqueTags       = new Set(events.map((e) => e.tag).filter(Boolean)).size;
  const totalImpressions = events.reduce((s, e) => s + (e.impressions ?? 1), 0);
  const totalRevPaise    = events.reduce((s, e) => s + (e.costPaise ?? 0), 0);
  const totalRevRupees   = (totalRevPaise / 100).toFixed(2);

  const csvUrl = getEventsExportUrl({
    ...(deviceFilter ? { deviceId: deviceFilter } : {}),
    ...(tagFilter    ? { tag: tagFilter }          : {}),
    ...(fromDate     ? { from: fromDate }          : {}),
    ...(toDate       ? { to: toDate }              : {}),
  });

  if (error) return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex gap-3">
      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-foreground">Could not load events</p>
        <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total plays',     value: totalPlays,                   color: 'text-blue-500'   },
          { label: 'Watch time',      value: fmtDuration(totalMs),         color: 'text-purple-500' },
          { label: 'Active screens',  value: uniqueDevices,                color: 'text-green-500'  },
          { label: 'Campaigns',       value: uniqueTags,                   color: 'text-orange-500' },
          { label: 'Impressions',     value: totalImpressions.toLocaleString('en-IN'), color: 'text-pink-500' },
          { label: 'Est. Revenue',    value: `₹${totalRevRupees}`,         color: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <PlayCircle className={`h-4 w-4 ${s.color} mb-2`} />
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + export */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input type="text" placeholder="Device ID" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} className={inp} />
          <input type="text" placeholder="Campaign tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={inp} />
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inp} title="From date" />
          <input type="date" value={toDate}   onChange={(e) => setToDate(e.target.value)}   className={inp} title="To date" />
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-colors"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />}
            Apply
          </button>
          <a
            href={csvUrl}
            download="alive-pop-report.csv"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-foreground hover:border-primary/40 transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-primary" /> Export CSV
          </a>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !events.length ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          No play events found. ALIVE-Player will send events here as content plays on screens.
        </p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {['Device', 'Media ID', 'Campaign', 'Started', 'Duration', 'Impressions', 'Layout'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.slice(0, 200).map((ev) => (
                <tr key={ev.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{ev.deviceId.slice(0, 10)}…</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{ev.mediaId.slice(0, 12)}…</td>
                  <td className="px-4 py-3">
                    {ev.tag
                      ? <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{ev.tag}</span>
                      : <span className="text-muted-foreground/40">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(ev.startedAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground font-semibold">{fmtDuration(ev.durationMs)}</td>
                  <td className="px-4 py-3 text-muted-foreground font-semibold">{(ev.impressions ?? 1).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground/60">{ev.layoutId?.slice(0, 10) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length > 200 && (
            <div className="px-4 py-2.5 bg-muted/30 text-[11px] text-muted-foreground text-center border-t border-border">
              Showing first 200 of {events.length} events. Use CSV export for full data.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
