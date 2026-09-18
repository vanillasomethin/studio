'use client';

// Proof of Play — operator-facing playback reporting.
// Three lenses over the same PlayEvent data, all scoped by a calendar date range (IST):
//   • By Screen → pick a TV, see every video it played with exact start/stop times
//   • By Ad     → pick a video, see which screens played it, when, and for how long
//   • By Groups → pick groups, see plays across all their screens
// Backed by GET /api/reports/plays (see getPlays / downloadPlaysCsv).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import {
  Loader2, Download, AlertCircle, PlayCircle, CalendarDays, Tv2, Clapperboard, Users, Play,
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getPlays, getPlaySessions, downloadPlaysCsv, getDevices, getContent, getDeviceGroups,
  type PlaysResponse, type PlayScreenSessions, type Device, type Content, type DeviceGroup,
} from '@/lib/backend-api';
import PopArchivePanel from '@/components/admin/pop-archive-panel';

// ─── Time helpers (IST) ────────────────────────────────────────────────────────
// PlayEvent timestamps are stored UTC; the business is India-based, so all display
// and all calendar-day boundaries are computed in IST (+05:30).

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const istDayStartUtc = (d: Date) => new Date(`${ymd(d)}T00:00:00.000+05:30`).toISOString();
const istDayEndUtc   = (d: Date) => new Date(`${ymd(d)}T23:59:59.999+05:30`).toISOString();

function fmtIST(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
  } catch { return iso; }
}

function fmtDur(ms: number): string {
  if (ms < 1000)       return `${ms} ms`;
  if (ms < 60_000)     return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000)  return `${Math.round(ms / 60_000)} min`;
  return `${(ms / 3_600_000).toFixed(1)} hrs`;
}

// ─── Shared styles ──────────────────────────────────────────────────────────────

const inp = 'rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';
const th  = 'px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap';
const thR = 'px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap';

type Mode = 'screen' | 'ad' | 'group';

function SectionLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="admin-section-label">
      <span className="admin-section-label__n">N°{String(n).padStart(2, '0')}</span>
      <span className="admin-section-label__rule" />
      <span className="admin-section-label__lbl">{label}</span>
    </div>
  );
}

// ─── Date-range picker (calendar range + presets, IST) ──────────────────────────

function DateRangePicker({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  const [open, setOpen] = useState(false);

  const label = range.from
    ? range.to && ymd(range.to) !== ymd(range.from)
      ? `${format(range.from, 'd MMM yyyy')} — ${format(range.to, 'd MMM yyyy')}`
      : format(range.from, 'd MMM yyyy')
    : 'Pick a date range';

  const preset = (days: number) => {
    const to = new Date(); const from = new Date();
    from.setDate(to.getDate() - (days - 1));
    onChange({ from, to });
  };
  const thisMonth = () => {
    const now = new Date();
    onChange({ from: new Date(now.getFullYear(), now.getMonth(), 1), to: now });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={`${inp} flex items-center gap-2 min-w-[240px]`}>
          <CalendarDays className="h-4 w-4 text-primary shrink-0" />
          <span className="text-foreground">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-wrap gap-1.5 border-b border-border p-3">
          {[['Today', 1], ['7 days', 7], ['30 days', 30], ['90 days', 90]].map(([lbl, d]) => (
            <button key={lbl} onClick={() => preset(d as number)}
              className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
              {lbl}
            </button>
          ))}
          <button onClick={thisMonth}
            className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors">
            This month
          </button>
        </div>
        <Calendar
          mode="range"
          selected={range}
          onSelect={(r) => onChange(r ?? { from: undefined, to: undefined })}
          numberOfMonths={2}
          defaultMonth={range.from}
        />
        <div className="border-t border-border p-2 text-right">
          <button onClick={() => setOpen(false)}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 transition-colors">
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── KPI tiles ──────────────────────────────────────────────────────────────────

function Kpis({ data, loading }: { data: PlaysResponse | null; loading: boolean }) {
  const s = data?.summary;
  const tiles = [
    { label: 'Total plays',  value: loading || !s ? '—' : (s.totalPlays ?? 0).toLocaleString('en-IN') },
    { label: 'Watch time',   value: loading || !s ? '—' : fmtDur(s.totalMs ?? 0) },
    { label: 'Screens',      value: loading || !s ? '—' : (s.screens ?? 0).toLocaleString('en-IN') },
    { label: 'Videos',       value: loading || !s ? '—' : (s.contentCount ?? 0).toLocaleString('en-IN') },
  ];
  return (
    <div className="admin-summary-row">
      {tiles.map((t) => (
        <div key={t.label} className="admin-summary-tile">
          <div className="admin-summary-tile__label">{t.label}</div>
          <div className="admin-summary-tile__value">{t.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Visual pickers ────────────────────────────────────────────────────────────
// A report is worthless if you picked the wrong screen or the wrong cut, and a
// dropdown of names makes that easy to do. Both pickers show the thing itself —
// the storefront, the creative's first frame — and filter as you type.

const screenLabel = (d: Device) =>
  d.storeName || d.linkedStoreName || `Screen #${(d.hardwareKey ?? d.id ?? '').slice(-4).toUpperCase()}`;

const DOT_TONE: Record<Device['status'], string> = {
  ONLINE: 'bg-green-500', OFFLINE: 'bg-red-500', PENDING: 'bg-amber-400',
};

function PickerShell({ label, count, query, onQuery, children }: {
  label: string; count: number; query: string; onQuery: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
        <span className="text-[10px] text-muted-foreground/60">{count} available</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter…"
          className="ml-auto w-44 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
        />
      </div>
      {children}
    </div>
  );
}

function ScreenPicker({ devices, value, onChange }: {
  devices: Device[]; value: string; onChange: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return devices;
    return devices.filter((d) =>
      `${screenLabel(d)} ${d.linkedStoreName ?? ''} ${d.city ?? ''} ${d.groupName ?? ''} ${d.hardwareKey ?? ''}`
        .toLowerCase().includes(n));
  }, [devices, q]);

  return (
    <PickerShell label="Screen" count={devices.length} query={q} onQuery={setQ}>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No screens match “{q}”.</p>
      ) : (
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((d) => {
            const on = value === d.id;
            return (
              <button
                key={d.id}
                onClick={() => onChange(on ? '' : d.id)}
                className={`flex items-center gap-2.5 rounded-xl border p-2 text-left transition-colors ${
                  on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/40'
                }`}
              >
                {d.storePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.storePhotoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover" />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40">
                    <Tv2 className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-foreground">{screenLabel(d)}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {d.linkedStoreName ?? 'Unlinked'}{d.city ? ` · ${d.city}` : ''}
                  </p>
                </div>
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_TONE[d.status]}`} title={d.status} />
              </button>
            );
          })}
        </div>
      )}
    </PickerShell>
  );
}

function AdPicker({ items, value, onChange }: {
  items: Content[]; value: string; onChange: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? items.filter((c) => (c.name ?? '').toLowerCase().includes(n)) : items;
  }, [items, q]);

  return (
    <PickerShell label="Ad creative" count={items.length} query={q} onQuery={setQ}>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No creatives match “{q}”.</p>
      ) : (
        <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((c) => {
            const on = value === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onChange(on ? '' : c.id)}
                className={`overflow-hidden rounded-xl border text-left transition-colors ${
                  on ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="relative aspect-video bg-muted/50">
                  {c.type === 'video' ? (
                    // preload=metadata paints the first frame without streaming the file
                    <video src={c.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.url} alt="" className="h-full w-full object-cover" />
                  )}
                  {c.durationMs != null && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-semibold text-white">
                      {Math.round(c.durationMs / 1000)}s
                    </span>
                  )}
                  {c.type !== 'video' && (
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">IMG</span>
                  )}
                </div>
                <p className="truncate px-2 py-1.5 text-[10px] font-semibold text-foreground">{c.name}</p>
              </button>
            );
          })}
        </div>
      )}
    </PickerShell>
  );
}

// ─── On-air timeline ────────────────────────────────────────────────────────────
// Reading a play log row by row can't answer "was this screen actually running
// yesterday?". The timeline answers it at a glance: one 24h track per IST day, a
// green bar wherever the screen was playing, empty track wherever it was dark.

const DAY_MS  = 86_400_000;
const IST_OFF = 5.5 * 3_600_000;

const istDayIndex  = (ms: number) => Math.floor((ms + IST_OFF) / DAY_MS);
const istDayOffset = (ms: number) => (ms + IST_OFF) % DAY_MS;
const istDayLabel  = (dayIndex: number) =>
  new Date(dayIndex * DAY_MS - IST_OFF).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short',
  });

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

type DaySpan = { startMs: number; endMs: number; plays: number };

/** Split merged sessions at IST midnight so each lands on exactly one day track. */
function splitByIstDay(sessions: { start: string; end: string; plays: number }[]) {
  const days = new Map<number, DaySpan[]>();
  for (const s of sessions) {
    let t = new Date(s.start).getTime();
    const end = new Date(s.end).getTime();
    if (!Number.isFinite(t) || !Number.isFinite(end) || end < t) continue;
    while (t <= end) {
      const day      = istDayIndex(t);
      const dayEnd   = (day + 1) * DAY_MS - IST_OFF - 1;
      const spanEnd  = Math.min(end, dayEnd);
      const list     = days.get(day) ?? [];
      list.push({ startMs: t, endMs: spanEnd, plays: s.plays });
      days.set(day, list);
      t = spanEnd + 1;
    }
  }
  return days;
}

function UptimeTimeline({ sessions, range, loading }: {
  sessions: { start: string; end: string; plays: number }[];
  range: DateRange;
  loading: boolean;
}) {
  const days = useMemo(() => {
    const byDay = splitByIstDay(sessions);
    // Every day in the picked range gets a track — a day with no plays is the
    // point of the chart, so it must not be silently missing.
    const first = range.from ? istDayIndex(new Date(`${ymd(range.from)}T12:00:00+05:30`).getTime()) : null;
    const last  = range.to   ? istDayIndex(new Date(`${ymd(range.to)}T12:00:00+05:30`).getTime())   : first;
    const out: { day: number; spans: DaySpan[] }[] = [];
    if (first != null && last != null) {
      for (let d = last; d >= first; d--) out.push({ day: d, spans: byDay.get(d) ?? [] });
    } else {
      for (const d of [...byDay.keys()].sort((a, b) => b - a)) out.push({ day: d, spans: byDay.get(d)! });
    }
    return out;
  }, [sessions, range]);

  if (loading) return <Skeleton className="h-52 rounded-xl" />;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Hour scale */}
      <div className="mb-2 flex items-center gap-3">
        <div className="w-24 shrink-0" />
        <div className="relative h-4 flex-1">
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
            <span key={h}
              className="absolute -translate-x-1/2 text-[9px] font-semibold tabular-nums text-muted-foreground/70"
              style={{ left: `${(h / 24) * 100}%` }}>
              {h === 24 ? '24' : h}
            </span>
          ))}
        </div>
        <div className="w-28 shrink-0 text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          On air
        </div>
      </div>

      <div className="space-y-1.5">
        {days.map(({ day, spans }) => {
          const onMs  = spans.reduce((n, s) => n + (s.endMs - s.startMs), 0);
          const firstOn = spans.length ? Math.min(...spans.map((s) => s.startMs)) : null;
          const lastOff = spans.length ? Math.max(...spans.map((s) => s.endMs))   : null;
          return (
            <div key={day} className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-[11px] font-semibold text-foreground">{istDayLabel(day)}</div>
              <div className="relative h-6 flex-1 overflow-hidden rounded-md border border-border bg-muted/30">
                {/* 6-hourly guides */}
                {[6, 12, 18].map((h) => (
                  <span key={h} className="absolute top-0 h-full w-px bg-border/70" style={{ left: `${(h / 24) * 100}%` }} />
                ))}
                {spans.map((s, i) => {
                  const left  = (istDayOffset(s.startMs) / DAY_MS) * 100;
                  const width = ((s.endMs - s.startMs) / DAY_MS) * 100;
                  return (
                    <span
                      key={i}
                      className="absolute top-0 h-full rounded-[3px] bg-green-600/85 hover:bg-green-600"
                      style={{ left: `${left}%`, width: `${Math.max(width, 0.35)}%` }}
                      title={`On ${fmtClock(s.startMs)} → ${fmtClock(s.endMs)} · ${fmtDur(s.endMs - s.startMs)} · ${s.plays.toLocaleString('en-IN')} plays`}
                    />
                  );
                })}
                {!spans.length && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    No plays — screen dark
                  </span>
                )}
              </div>
              <div className="w-28 shrink-0 text-right">
                <div className="text-[11px] font-bold tabular-nums text-foreground">{onMs ? fmtDur(onMs) : '—'}</div>
                {firstOn != null && lastOff != null && (
                  <div className="text-[9px] tabular-nums text-muted-foreground">{fmtClock(firstOn)} – {fmtClock(lastOff)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px] bg-green-600/85" /> Playing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px] border border-border bg-muted/30" /> Off / not reporting
        </span>
        <span>Gaps over 10 minutes are shown as off. Times in IST.</span>
      </p>
    </div>
  );
}

// ─── Fleet timeline (group lens) ────────────────────────────────────────────────
// A group is many screens, so the question changes from "when was it on today?" to
// "which of these screens is dark?". One row per screen, x-axis spanning the whole
// picked range: a screen that stopped reporting on Wednesday shows a gap the eye
// lands on without reading a single number.

/** Milliseconds of a session that fall inside the drawn window. */
const clippedMs = (x: { start: string; end: string }, startMs: number, endMs: number) =>
  Math.max(0, Math.min(Date.parse(x.end), endMs) - Math.max(Date.parse(x.start), startMs));

type FleetRow = { deviceId: string; name: string; groupName: string | null; sessions: { start: string; end: string; plays: number }[] };

function FleetTimeline({ screens, devices, groupNames, range, loading }: {
  screens: PlayScreenSessions[];
  devices: Device[];
  groupNames: string[];
  range: DateRange;
  loading: boolean;
}) {
  const { rows, startMs, endMs, dayCount } = useMemo(() => {
    const from = range.from ?? range.to ?? null;
    const to   = range.to   ?? range.from ?? null;
    // The picker hands back {from: undefined, to: undefined} on an ordinary
    // "start a new range here" click. Fall back to the days the data actually
    // covers rather than drawing an epoch-dated empty track.
    const stamps = screens.flatMap((s) => s.sessions.flatMap((x) => [Date.parse(x.start), Date.parse(x.end)]))
      .filter((n) => Number.isFinite(n));
    const firstDay = from ? istDayIndex(Date.parse(istDayStartUtc(from)))
      : stamps.length ? istDayIndex(Math.min(...stamps)) : istDayIndex(new Date().getTime());
    const lastDay  = to   ? istDayIndex(Date.parse(istDayEndUtc(to)))
      : stamps.length ? istDayIndex(Math.max(...stamps)) : firstDay;
    const startMs = firstDay * DAY_MS - IST_OFF;
    // Exclusive end, so the track is exactly N whole IST days wide.
    const endMs   = (Math.max(lastDay, firstDay) + 1) * DAY_MS - IST_OFF;
    const dayCount = Math.max(1, Math.round((endMs - startMs) / DAY_MS));

    const byDevice = new Map(screens.map((s) => [s.deviceId, s]));
    // Every screen in the picked groups gets a row, including ones that reported
    // nothing at all — a screen missing from the report is the finding, so it must
    // not be missing from the chart.
    const expected = devices.filter((d) => d.groupName && groupNames.includes(d.groupName));
    const ids = new Set([...byDevice.keys(), ...expected.map((d) => d.id)]);
    const devById = new Map(devices.map((d) => [d.id, d]));

    const rows: FleetRow[] = [...ids].map((id) => {
      const dev = devById.get(id);
      const rec = byDevice.get(id);
      return {
        deviceId:  id,
        name:      dev ? screenLabel(dev) : rec?.screenName ?? id,
        groupName: dev?.groupName ?? rec?.groupName ?? null,
        sessions:  rec?.sessions ?? [],
      };
    });

    // Least time on air first: the screens that need someone to look are at the top.
    const onAir = (r: FleetRow) => r.sessions.reduce((n, x) => n + clippedMs(x, startMs, endMs), 0);
    rows.sort((a, b) => onAir(a) - onAir(b) || a.name.localeCompare(b.name));
    return { rows, startMs, endMs, dayCount };
  }, [screens, devices, groupNames, range]);

  if (loading) return <Skeleton className="h-52 rounded-xl" />;
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground">
        No screens in the selected groups.
      </div>
    );
  }

  const span      = Math.max(1, endMs - startMs);
  const labelStep = Math.ceil(dayCount / 14); // keep day labels from colliding on long ranges
  const days      = Array.from({ length: dayCount }, (_, i) => i);
  const multiGroup = new Set(rows.map((r) => r.groupName ?? '')).size > 1;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Day scale */}
      <div className="mb-2 flex items-end gap-3">
        <div className="w-40 shrink-0" />
        <div className="relative h-4 flex-1">
          {days.map((i) => i % labelStep === 0 && (
            <span key={i}
              className="absolute text-[9px] font-semibold tabular-nums text-muted-foreground/70"
              style={{ left: `${(i / dayCount) * 100}%` }}>
              {new Date(startMs + i * DAY_MS + DAY_MS / 2).toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
              })}
            </span>
          ))}
        </div>
        <div className="w-24 shrink-0 text-right text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          On air
        </div>
      </div>

      <div className="space-y-1.5">
        {rows.map((r) => {
          // Clip once: the bar and the hours beside it must describe the same window.
          const spans = r.sessions
            .map((x) => ({ a: Math.max(Date.parse(x.start), startMs), b: Math.min(Date.parse(x.end), endMs), plays: x.plays }))
            .filter((x) => Number.isFinite(x.a) && Number.isFinite(x.b) && x.b >= x.a);
          const onMs = spans.reduce((n, x) => n + (x.b - x.a), 0);
          return (
            <div key={r.deviceId} className="flex items-center gap-3">
              <div className="w-40 shrink-0 min-w-0">
                <p className="truncate text-[11px] font-semibold text-foreground">{r.name}</p>
                {multiGroup && <p className="truncate text-[9px] text-muted-foreground">{r.groupName || 'No group'}</p>}
              </div>
              <div className="relative h-6 flex-1 overflow-hidden rounded-md border border-border bg-muted/30">
                {/* One guide per IST midnight */}
                {days.slice(1).map((i) => (
                  <span key={i} className="absolute top-0 h-full w-px bg-border/70" style={{ left: `${(i / dayCount) * 100}%` }} />
                ))}
                {/* Width is the true proportion, floored in PIXELS not percent: a percentage
                    floor means a different amount of time on every range — 0.3% of the
                    90-day preset is 6.5 hours, which would draw a screen running 1 hr/day
                    as wide as one running 10. One pixel is span-independent. */}
                {spans.map((x, i) => (
                  <span
                    key={i}
                    className="absolute top-0 h-full bg-green-600/85 hover:bg-green-600"
                    style={{
                      left:     `${((x.a - startMs) / span) * 100}%`,
                      width:    `${((x.b - x.a) / span) * 100}%`,
                      minWidth: '1px',
                    }}
                    title={`On ${fmtIST(new Date(x.a).toISOString())} → ${fmtIST(new Date(x.b).toISOString())} · ${fmtDur(x.b - x.a)} · ${x.plays.toLocaleString('en-IN')} plays`}
                  />
                ))}
                {!spans.length && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    Nothing played in this period
                  </span>
                )}
              </div>
              <div className="w-24 shrink-0 text-right">
                <div className="text-[11px] font-bold tabular-nums text-foreground">{onMs ? fmtDur(onMs) : '—'}</div>
                <div className="text-[9px] tabular-nums text-muted-foreground">
                  {onMs ? `${fmtDur(onMs / dayCount)}/day` : 'dark'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px] bg-green-600/85" /> Playing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px] border border-border bg-muted/30" /> Off / not reporting
        </span>
        <span>Least time on air first. Gaps over 10 minutes are shown as off. Times in IST.</span>
      </p>
    </div>
  );
}

function TimelineNotice({ error, truncated }: { error: string | null; truncated: boolean }) {
  if (!error && !truncated) return null;
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex gap-2.5">
      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground">
        {error
          ? <>Could not build the on-air timeline — <span className="text-foreground">{error}</span>. The totals and play log below are unaffected.</>
          : <>This range has more separate on-air stretches than the timeline can draw, so it is cut short. Narrow the date range for a complete picture.</>}
      </p>
    </div>
  );
}

// ─── Main tab ───────────────────────────────────────────────────────────────────

export default function ProofOfPlayTab() {
  const [mode, setMode] = useState<Mode>('screen');

  // Default range: last 7 days.
  const [range, setRange] = useState<DateRange>(() => {
    const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 6);
    return { from, to };
  });

  // Filter selections per lens.
  const [deviceId,       setDeviceId]       = useState('');
  const [mediaId,        setMediaId]        = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  // Reference data.
  const [devices, setDevices] = useState<Device[]>([]);
  const [content, setContent] = useState<Content[]>([]);
  const [groups,  setGroups]  = useState<DeviceGroup[]>([]);

  // Report data.
  const [data,    setData]    = useState<PlaysResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // On-air timeline (screen + group lenses) — merged per screen server-side over the
  // full matching set, so it never inherits the play log's row cap.
  const [screenSessions,    setScreenSessions]    = useState<PlayScreenSessions[]>([]);
  const [sessionsLoading,   setSessionsLoading]   = useState(false);
  const [sessionsError,     setSessionsError]     = useState<string | null>(null);
  const [sessionsTruncated, setSessionsTruncated] = useState(false);
  const reqSeq = useRef(0);

  // Load reference lists once.
  useEffect(() => {
    getDevices({ take: '500' }).then((r) => setDevices(Array.isArray(r?.devices) ? r.devices : [])).catch(() => setDevices([]));
    getContent().then((r) => setContent(Array.isArray(r?.content) ? r.content : [])).catch(() => setContent([]));
    getDeviceGroups().then((g) => setGroups(Array.isArray(g) ? g : [])).catch(() => setGroups([]));
  }, []);

  const rangeParams = useCallback(() => {
    const p: Record<string, string> = {};
    if (range.from) p.from = istDayStartUtc(range.from);
    if (range.to)   p.to   = istDayEndUtc(range.to);
    return p;
  }, [range]);

  const activeFilterParams = useCallback((): Record<string, string> => {
    if (mode === 'screen') return deviceId ? { deviceId } : {};
    if (mode === 'ad')     return mediaId  ? { mediaId }  : {};
    return selectedGroups.length ? { groupNames: selectedGroups.join(',') } : {};
  }, [mode, deviceId, mediaId, selectedGroups]);

  // A report needs a primary selection in every mode except when the user just wants
  // an all-screens sweep — which we don't run automatically (could be huge). Require a pick.
  const hasSelection =
    (mode === 'screen' && !!deviceId) ||
    (mode === 'ad'     && !!mediaId)  ||
    (mode === 'group'  && selectedGroups.length > 0);

  const runReport = useCallback(() => {
    if (!hasSelection) { setData(null); setScreenSessions([]); setSessionsError(null); return; }
    // Every lens writes the same state, and the session fold is far slower than the
    // rollups, so an abandoned request can land after the one that replaced it and
    // repaint the chart with a screen or a group the operator has already left.
    // Only the newest request is allowed to write.
    const seq = ++reqSeq.current;
    setLoading(true); setError(null);
    getPlays({ ...rangeParams(), ...activeFilterParams() })
      .then((r) => { if (seq === reqSeq.current) setData(r); })
      .catch((e: Error) => { if (seq === reqSeq.current) setError(e.message); })
      .finally(() => { if (seq === reqSeq.current) setLoading(false); });

    if (mode === 'screen' || mode === 'group') {
      setSessionsLoading(true); setSessionsError(null);
      getPlaySessions({ ...rangeParams(), ...activeFilterParams() })
        .then((r) => {
          if (seq !== reqSeq.current) return;
          setScreenSessions(Array.isArray(r?.screens) ? r.screens : []);
          setSessionsTruncated(!!r?.truncated);
        })
        // A failed fold must not read as a fleet-wide blackout: every screen would
        // render dark under KPI tiles reporting thousands of plays.
        .catch((e: Error) => { if (seq === reqSeq.current) { setScreenSessions([]); setSessionsError(e.message); } })
        .finally(() => { if (seq === reqSeq.current) setSessionsLoading(false); });
    } else {
      setScreenSessions([]); setSessionsError(null);
    }
  }, [hasSelection, mode, rangeParams, activeFilterParams]);

  // Re-run whenever the primary selection or mode changes (range changes re-run on "Run report").
  useEffect(() => { runReport(); }, [mode, deviceId, mediaId, selectedGroups, runReport]);

  const csvName = useMemo(() => {
    const tag = mode === 'screen' ? (devices.find((d) => d.id === deviceId)?.storeName || 'screen')
      : mode === 'ad' ? (content.find((c) => c.id === mediaId)?.name || 'ad')
      : (selectedGroups.join('-') || 'groups');
    return `alive-pop-${mode}-${tag}`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase() + '.csv';
  }, [mode, deviceId, mediaId, selectedGroups, devices, content]);

  const exportCsv = () => {
    downloadPlaysCsv({ ...rangeParams(), ...activeFilterParams() }, csvName).catch((e: Error) => setError(e.message));
  };

  const toggleGroup = (name: string) =>
    setSelectedGroups((g) => g.includes(name) ? g.filter((x) => x !== name) : [...g, name]);

  const videos = useMemo(() => {
    // Videos first (the "ad" case), then everything else, alphabetically.
    return [...content].sort((a, b) =>
      (a.type === b.type ? 0 : a.type === 'video' ? -1 : 1) || (a.name ?? '').localeCompare(b.name ?? ''));
  }, [content]);

  const MODES: { id: Mode; label: string; icon: typeof Tv2 }[] = [
    { id: 'screen', label: 'By Screen', icon: Tv2 },
    { id: 'ad',     label: 'By Ad video', icon: Clapperboard },
    { id: 'group',  label: 'By Groups', icon: Users },
  ];

  return (
    <div className="space-y-4">
      {/* Page head */}
      <div className="mb-6">
        <p className="admin-font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-primary mb-0.5">Proof of play</p>
        <h1 className="admin-font-display text-3xl font-bold text-foreground tracking-tight">
          Every play, <em className="not-italic text-primary">accounted for</em>.
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Exact start &amp; stop times per screen, per ad, per group — straight from the screens. Times shown in IST.
        </p>
      </div>

      {/* Lens selector + date range */}
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {MODES.map((m) => {
            const Icon = m.icon; const active = mode === m.id;
            return (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${active ? 'bg-primary text-white' : 'border border-border text-muted-foreground hover:text-foreground hover:border-primary/40'}`}>
                <Icon className="h-3.5 w-3.5" /> {m.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DateRangePicker range={range} onChange={setRange} />
          <button onClick={runReport} disabled={!hasSelection}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run report
          </button>
        </div>
      </div>

      {/* Per-lens primary selector */}
      <div className="rounded-xl border border-border bg-card p-4">
        {mode === 'screen' && (
          <ScreenPicker devices={devices} value={deviceId} onChange={setDeviceId} />
        )}
        {mode === 'ad' && (
          <AdPicker items={videos} value={mediaId} onChange={setMediaId} />
        )}
        {mode === 'group' && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Groups</label>
            {groups.length === 0 ? (
              <p className="text-xs text-muted-foreground">No groups defined. Assign screens to a group in the Screens tab.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {groups.map((g) => {
                  const on = selectedGroups.includes(g.name);
                  return (
                    <button key={g.name} onClick={() => toggleGroup(g.name)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${on ? 'bg-primary text-white' : 'border border-border text-muted-foreground hover:border-primary/40'}`}>
                      {g.name} <span className={on ? 'text-white/70' : 'text-muted-foreground/50'}>· {g.total}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Could not load report</p>
            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {!hasSelection ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <PlayCircle className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {mode === 'screen' ? 'Pick a screen to see everything it played.'
              : mode === 'ad'  ? 'Pick an ad video to see which screens played it.'
              : 'Pick one or more groups to see their plays.'}
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : data && (
        <>
          <Kpis data={data} loading={false} />

          {/* Lens-specific rollup */}
          {mode === 'screen' && (
            <>
              <SectionLabel n={1} label="On air — when this screen was running" />
              <TimelineNotice error={sessionsError} truncated={sessionsTruncated} />
              {!sessionsError && <UptimeTimeline sessions={screenSessions[0]?.sessions ?? []} range={range} loading={sessionsLoading} />}

              <SectionLabel n={2} label="Videos on this screen" />
              <RollupTable
                cols={['Video', 'Plays', 'Watch', 'Last played']}
                rows={(Array.isArray(data.summary?.byContent) ? data.summary.byContent : []).map((c) => [c.contentName || c.mediaId, (c.plays ?? 0).toLocaleString('en-IN'), fmtDur(c.totalMs ?? 0), c.lastPlayedAt ? fmtIST(c.lastPlayedAt) : '—'])}
              />
            </>
          )}
          {mode === 'ad' && (
            <>
              <SectionLabel n={1} label="Screens that played this ad" />
              <RollupTable
                cols={['Screen', 'Group', 'Plays', 'Watch', 'Last played']}
                rows={(Array.isArray(data.summary?.byScreen) ? data.summary.byScreen : []).map((s) => [s.screenName, s.groupName || '—', (s.plays ?? 0).toLocaleString('en-IN'), fmtDur(s.totalMs ?? 0), s.lastPlayedAt ? fmtIST(s.lastPlayedAt) : '—'])}
              />
            </>
          )}
          {mode === 'group' && (
            <>
              <SectionLabel n={1} label="On air — which screens were running" />
              <TimelineNotice error={sessionsError} truncated={sessionsTruncated} />
              {!sessionsError && (
                <FleetTimeline
                  screens={screenSessions}
                  devices={devices}
                  groupNames={selectedGroups}
                  range={range}
                  loading={sessionsLoading}
                />
              )}

              <SectionLabel n={2} label="By group" />
              <RollupTable
                cols={['Group', 'Screens', 'Plays', 'Watch']}
                rows={(Array.isArray(data.summary?.byGroup) ? data.summary.byGroup : []).map((g) => [g.groupName, (g.screens ?? 0).toLocaleString('en-IN'), (g.plays ?? 0).toLocaleString('en-IN'), fmtDur(g.totalMs ?? 0)])}
              />
              <SectionLabel n={3} label="By screen" />
              <RollupTable
                cols={['Screen', 'Group', 'Plays', 'Watch', 'Last played']}
                rows={(Array.isArray(data.summary?.byScreen) ? data.summary.byScreen : []).map((s) => [s.screenName, s.groupName || '—', (s.plays ?? 0).toLocaleString('en-IN'), fmtDur(s.totalMs ?? 0), s.lastPlayedAt ? fmtIST(s.lastPlayedAt) : '—'])}
              />
            </>
          )}

          {/* Row-level timeline — the exact-timing proof */}
          <div className="flex items-center justify-between mt-2">
            <SectionLabel n={mode === 'ad' ? 2 : mode === 'screen' ? 3 : 4} label="Play log — exact timing" />
            <button onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-foreground hover:border-primary/40 transition-colors">
              <Download className="h-3.5 w-3.5 text-primary" /> Export CSV
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {mode !== 'screen' && <th className={th}>Screen</th>}
                  {mode === 'group'  && <th className={th}>Group</th>}
                  {mode !== 'ad'     && <th className={th}>Video</th>}
                  <th className={th}>Started (IST)</th>
                  <th className={th}>Stopped (IST)</th>
                  <th className={thR}>Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(Array.isArray(data.rows) ? data.rows : []).map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    {mode !== 'screen' && <td className="px-3 py-2 text-foreground whitespace-nowrap">{r.screenName}</td>}
                    {mode === 'group'  && <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.groupName || '—'}</td>}
                    {mode !== 'ad'     && <td className="px-3 py-2 text-foreground">{r.contentName || <span className="text-muted-foreground/50 font-mono text-[10px]">{r.mediaId}</span>}</td>}
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtIST(r.startedAt)}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtIST(r.endedAt)}</td>
                    <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{fmtDur(r.durationMs ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(Array.isArray(data.rows) ? data.rows : []).length && (
              <p className="text-sm text-muted-foreground text-center py-10">No plays in this period.</p>
            )}
            {data.rowsTruncated && (
              <div className="px-4 py-2 bg-muted/30 text-[10px] text-muted-foreground text-center border-t border-border">
                Showing latest {(Array.isArray(data.rows) ? data.rows : []).length.toLocaleString('en-IN')} of {(data.matchedCount ?? 0).toLocaleString('en-IN')} plays · export CSV for the full log
              </div>
            )}
          </div>
        </>
      )}

      {/* Long-term archive: auto-export to cloud storage + optional pruning */}
      <PopArchivePanel />
    </div>
  );
}

// ─── Small reusable rollup table ────────────────────────────────────────────────

function RollupTable({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground px-1 py-2">No data.</p>;
  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/20">
            {cols.map((c, i) => <th key={c} className={i === 0 ? th : thR}>{c}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, ri) => (
            <tr key={ri} className="hover:bg-muted/20">
              {r.map((cell, ci) => (
                <td key={ci} className={ci === 0 ? 'px-3 py-2 text-foreground' : 'px-3 py-2 text-right text-muted-foreground whitespace-nowrap'}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
