'use client';

'use client';

import { useEffect, useState } from 'react';
import {
  Loader2, CalendarClock, Plus, Trash2, AlertCircle, Monitor,
  Zap, Clock3, CalendarDays, RotateCcw, Tv2, Smartphone, Pencil, CheckCircle2,
  LayoutList, CalendarRange,
} from 'lucide-react';
import {
  getSchedules, getPlaylists, getDevices,
  createSchedule, updateSchedule, deleteSchedule,
  type Schedule, type Playlist, type Device,
} from '@/lib/backend-api';
import { toast } from '@/hooks/use-toast';
import ScheduleCalendar from './schedule-calendar';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
}

function nowLocal(): string {
  const d = new Date(); d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localPlusDays(days: number): string {
  const d = new Date(); d.setSeconds(0, 0); d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert ISO → datetime-local value ("YYYY-MM-DDTHH:mm")
function isoToLocal(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}

const FAR_FUTURE = '2099-12-31T23:59';

const INTERVAL_MARKS = [
  { value: 0,  label: 'Continuous' },
  { value: 5,  label: 'Every 5 min' },
  { value: 10, label: 'Every 10 min' },
  { value: 15, label: 'Every 15 min' },
  { value: 20, label: 'Every 20 min' },
  { value: 30, label: 'Every 30 min' },
  { value: 60, label: 'Every hour' },
];

const RECURRENCE_LABELS: Record<Schedule['recurrence'], string> = {
  once: 'One-time', daily: 'Daily', weekly: 'Weekly',
};

const inp = 'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';
const lbl = 'block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1';

type TimingMode = 'scheduled' | 'now_indefinite' | 'now_until';

const BLANK_FORM = {
  name:            '',
  playlistId:      '',
  groupName:       '',
  selectedDevices: [] as string[],
  timingMode:      'scheduled' as TimingMode,
  startAt:         '',
  endAt:           '',
  recurrence:      'daily' as Schedule['recurrence'],
  orientation:     'landscape' as 'landscape' | 'portrait' | 'any',
  intervalMins:    0,
  priority:        0,
};

// ─── Orientation icon ─────────────────────────────────────────────────────────
function OrientationIcon({ o, size = 14 }: { o: 'landscape' | 'portrait' | 'any'; size?: number }) {
  if (o === 'landscape') return <Tv2 style={{ width: size, height: size }} />;
  if (o === 'portrait')  return <Smartphone style={{ width: size, height: size }} />;
  return <RotateCcw style={{ width: size, height: size }} />;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SchedulesTab() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [devices,   setDevices]   = useState<Device[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [listView,  setListView]  = useState<'list' | 'calendar'>('list');

  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [form, setForm] = useState({ ...BLANK_FORM, startAt: '', endAt: '' });

  useEffect(() => {
    Promise.all([getSchedules(), getPlaylists(), getDevices()])
      .then(([s, p, d]) => { setSchedules(s); setPlaylists(p); setDevices(d); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const openNew = () => {
    setForm({ ...BLANK_FORM, startAt: nowLocal(), endAt: localPlusDays(7) });
    setEditId(null);
    setShowForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const openEdit = (s: Schedule) => {
    const isIndefinite = s.endAt > '2090-01-01';
    setForm({
      name:            s.name,
      playlistId:      s.playlistId,
      groupName:       s.groupName ?? '',
      selectedDevices: s.deviceIds ?? [],
      timingMode:      'scheduled',
      startAt:         isoToLocal(s.startAt),
      endAt:           isIndefinite ? localPlusDays(30) : isoToLocal(s.endAt),
      recurrence:      s.recurrence,
      orientation:     (s.orientation as 'landscape' | 'portrait' | 'any') ?? 'landscape',
      intervalMins:    s.intervalMins ?? 0,
      priority:        s.priority ?? 0,
    });
    setEditId(s.id);
    setShowForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleDevice = (id: string) =>
    setForm((f) => ({
      ...f,
      selectedDevices: f.selectedDevices.includes(id)
        ? f.selectedDevices.filter((d) => d !== id)
        : [...f.selectedDevices, id],
    }));

  const del = async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    setDeleting(id);
    try {
      await deleteSchedule(id);
      setSchedules((s) => s.filter((x) => x.id !== id));
      toast({ title: 'Schedule deleted' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Delete failed', description: (e as Error).message });
    } finally {
      setDeleting(null);
    }
  };

  const resolveTimings = () => {
    if (form.timingMode === 'now_indefinite') {
      return { startAt: new Date().toISOString(), endAt: new Date(FAR_FUTURE).toISOString() };
    }
    if (form.timingMode === 'now_until') {
      return { startAt: new Date().toISOString(), endAt: new Date(form.endAt).toISOString() };
    }
    return { startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString() };
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.playlistId) return;
    if (form.timingMode === 'scheduled' && (!form.startAt || !form.endAt)) return;
    if (form.timingMode === 'now_until' && !form.endAt) return;
    setSaving(true);
    try {
      const { startAt, endAt } = resolveTimings();
      const payload = {
        name:         form.name,
        playlistId:   form.playlistId,
        groupName:    form.groupName || undefined,
        deviceIds:    form.selectedDevices.length ? form.selectedDevices : undefined,
        startAt,
        endAt,
        recurrence:   form.recurrence,
        orientation:  form.orientation,
        intervalMins: form.intervalMins > 0 ? form.intervalMins : null,
        priority:     form.priority,
      };

      if (editId) {
        const updated = await updateSchedule(editId, payload);
        setSchedules((s) => s.map((x) => x.id === editId ? updated : x));
        toast({ title: 'Schedule updated ✓', description: 'Changes will reach screens at next poll.' });
      } else {
        const created = await createSchedule(payload);
        setSchedules((s) => [created, ...s]);
        toast({ title: 'Schedule created ✓', description: 'Content will start playing as scheduled.' });
      }

      setForm({ ...BLANK_FORM, startAt: nowLocal(), endAt: localPlusDays(7) });
      closeForm();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Save failed', description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
  if (error) return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex gap-3">
      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-foreground">Could not load schedules</p>
        <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
      </div>
    </div>
  );

  const intervalLabel = INTERVAL_MARKS.find((m) => m.value === form.intervalMins)?.label
    ?? `Every ${form.intervalMins} min`;
  const isAlwaysOn = form.timingMode === 'now_indefinite';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">Timezone: <span className="font-semibold text-foreground">{userTz}</span></p>
        <button
          onClick={showForm ? closeForm : openNew}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New schedule
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {editId ? 'Edit schedule' : 'New schedule'}
            </h2>
            {editId && (
              <span className="flex items-center gap-1.5 text-[11px] text-primary bg-primary/10 rounded-full px-2.5 py-1 font-semibold">
                <Pencil className="h-3 w-3" /> Editing
              </span>
            )}
          </div>
          <form onSubmit={save} className="space-y-5">

            {/* Name + Playlist row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Name</label>
                <input type="text" required value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Afternoon Slot — July" className={inp} />
              </div>
              <div>
                <label className={lbl}>Playlist</label>
                <select required value={form.playlistId}
                  onChange={(e) => set('playlistId', e.target.value)} className={inp}>
                  <option value="">Select a playlist</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.items.length} items)</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Timing mode ───────────────────────────────────────────── */}
            <div>
              <label className={lbl}>When to run</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'scheduled',      label: 'Scheduled',            icon: CalendarDays, desc: 'Pick start & end date/time' },
                  { id: 'now_indefinite', label: 'Start now · Always on', icon: Zap,         desc: 'Runs immediately, never expires' },
                  { id: 'now_until',      label: 'Start now · Until…',    icon: Clock3,       desc: 'Starts now, you pick end time' },
                ] as { id: TimingMode; label: string; icon: React.ElementType; desc: string }[]).map((opt) => {
                  const active = form.timingMode === opt.id;
                  return (
                    <button key={opt.id} type="button" onClick={() => set('timingMode', opt.id)}
                      className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors ${
                        active ? 'border-primary/50 bg-primary/5' : 'border-border bg-background hover:border-primary/20'
                      }`}>
                      <opt.icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground/60'}`} />
                      <p className={`text-[11px] font-bold ${active ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                      <p className="text-[9px] text-muted-foreground/70 leading-tight">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date/time inputs (conditional) */}
            {form.timingMode !== 'now_indefinite' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {form.timingMode === 'scheduled' && (
                  <div>
                    <label className={lbl}>Start <span className="normal-case font-normal text-muted-foreground/50">({userTz})</span></label>
                    <input type="datetime-local" required step="60"
                      value={form.startAt}
                      min={nowLocal()}
                      onChange={(e) => set('startAt', e.target.value)} className={inp} />
                  </div>
                )}
                <div>
                  <label className={lbl}>
                    {form.timingMode === 'now_until' ? 'Run until' : 'End'}
                    <span className="normal-case font-normal text-muted-foreground/50 ml-1">({userTz})</span>
                  </label>
                  <input type="datetime-local" required step="60"
                    value={form.endAt}
                    min={form.timingMode === 'now_until' ? nowLocal() : form.startAt || nowLocal()}
                    onChange={(e) => set('endAt', e.target.value)} className={inp} />
                </div>
              </div>
            )}
            {isAlwaysOn && (
              <p className="text-[11px] text-green-700 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2">
                Schedule starts immediately and runs indefinitely. Delete it manually to stop.
              </p>
            )}

            {/* ── Recurrence + Priority ─────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Recurrence</label>
                <select value={form.recurrence}
                  onChange={(e) => set('recurrence', e.target.value as Schedule['recurrence'])} className={inp}>
                  <option value="once">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Priority <span className="normal-case font-normal text-muted-foreground/60">(higher wins overlap)</span></label>
                <input type="number" min={0} max={10} value={form.priority}
                  onChange={(e) => set('priority', Number(e.target.value))} className={inp} />
              </div>
            </div>

            {/* ── Orientation ───────────────────────────────────────────── */}
            <div>
              <label className={lbl}>Screen orientation</label>
              <div className="grid grid-cols-3 gap-2">
                {(['landscape', 'portrait', 'any'] as const).map((o) => {
                  const labels = { landscape: 'Landscape (TV)', portrait: 'Portrait (vertical)', any: 'Any orientation' };
                  const active = form.orientation === o;
                  return (
                    <button key={o} type="button" onClick={() => set('orientation', o)}
                      className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-colors ${
                        active ? 'border-primary/50 bg-primary/5' : 'border-border bg-background hover:border-primary/20'
                      }`}>
                      <OrientationIcon o={o} size={15} />
                      <span className={`text-[11px] font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>
                        {labels[o]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Playback frequency ────────────────────────────────────── */}
            <div>
              <label className={lbl}>
                Playback frequency
                <span className="normal-case font-normal text-muted-foreground/60 ml-1">— how often the playlist loops</span>
              </label>
              <div className="rounded-xl border border-border bg-background px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Continuous loop</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    form.intervalMins === 0
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-foreground'
                  }`}>{intervalLabel}</span>
                  <span className="text-[11px] text-muted-foreground">Every hour</span>
                </div>
                <input
                  type="range" min={0} max={60} step={5}
                  value={form.intervalMins}
                  onChange={(e) => set('intervalMins', Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="grid grid-cols-7 gap-0 text-center">
                  {INTERVAL_MARKS.map((m) => (
                    <button key={m.value} type="button"
                      onClick={() => set('intervalMins', m.value)}
                      className={`text-[9px] rounded py-0.5 transition-colors ${
                        form.intervalMins === m.value
                          ? 'text-primary font-bold'
                          : 'text-muted-foreground/50 hover:text-foreground'
                      }`}>
                      {m.value === 0 ? '∞' : `${m.value}m`}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-snug">
                  {form.intervalMins === 0
                    ? 'Playlist loops back-to-back continuously. Best for full-time brand takeovers.'
                    : `Playlist plays once, then waits until the ${form.intervalMins}-minute mark before repeating. ~${Math.floor(60 / form.intervalMins)} plays/hour. Good for periodic ads mixed with other content.`
                  }
                </p>
              </div>
            </div>

            {/* ── Group / target ───────────────────────────────────────── */}
            <div>
              <label className={lbl}>Group name <span className="normal-case font-normal text-muted-foreground/60">(optional — targets all screens in this group)</span></label>
              <input type="text" value={form.groupName}
                onChange={(e) => set('groupName', e.target.value)}
                placeholder="Mangaluru North" className={inp} />
            </div>

            {/* Screen picker */}
            <div>
              <label className={lbl}>
                Assign to specific screens
                <span className="normal-case font-normal text-muted-foreground/60 ml-1">
                  — {form.selectedDevices.length ? `${form.selectedDevices.length} selected` : 'none (use group name above)'}
                </span>
              </label>
              {!devices.length ? (
                <p className="text-xs text-muted-foreground py-2">No screens registered yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
                  {devices.map((d) => {
                    const checked = form.selectedDevices.includes(d.id);
                    return (
                      <button key={d.id} type="button" onClick={() => toggleDevice(d.id)}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                          checked ? 'border-primary/50 bg-primary/5' : 'border-border bg-background hover:border-primary/20'
                        }`}>
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          d.status === 'ONLINE' ? 'bg-green-500/10' : 'bg-muted'
                        }`}>
                          <Monitor className={`h-4 w-4 ${d.status === 'ONLINE' ? 'text-green-600' : 'text-muted-foreground/40'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{d.storeName}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              d.status === 'ONLINE' ? 'bg-green-500' : d.status === 'OFFLINE' ? 'bg-red-400' : 'bg-yellow-400'
                            }`} />
                            <span className="text-[10px] text-muted-foreground capitalize">{d.status.toLowerCase()}</span>
                          </div>
                        </div>
                        <div className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center ${
                          checked ? 'border-primary bg-primary' : 'border-border'
                        }`}>
                          {checked && <div className="h-2 w-2 rounded-sm bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-40 transition-colors">
                {saving
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                  : editId
                    ? <><CheckCircle2 className="h-3.5 w-3.5" /> Update schedule</>
                    : 'Save schedule'
                }
              </button>
              <button type="button" onClick={closeForm}
                className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Schedule list */}
      {schedules.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">{schedules.length} schedule{schedules.length !== 1 ? 's' : ''}</p>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setListView('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${listView === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutList className="h-3 w-3" /> List
            </button>
            <button
              onClick={() => setListView('calendar')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${listView === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <CalendarRange className="h-3 w-3" /> Calendar
            </button>
          </div>
        </div>
      )}

      {!schedules.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-16">
          <CalendarClock className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No schedules yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create one to push content to your screens.</p>
        </div>
      ) : listView === 'calendar' ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <ScheduleCalendar schedules={schedules} />
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {['Name', 'Playlist', 'Screens', 'Start', 'End', 'Recurrence', 'Orientation', 'Frequency', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schedules.map((s) => {
                const pl = playlists.find((p) => p.id === s.playlistId);
                const screenCount = s.deviceIds?.length ?? 0;
                const isAlwaysOnRow = s.endAt > '2090-01-01';
                const isEditing = editId === s.id;
                return (
                  <tr key={s.id} className={`transition-colors ${isEditing ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                      {s.name}
                      {s.priority > 0 && (
                        <span className="ml-1.5 text-[9px] font-bold bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-full">P{s.priority}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{pl?.name ?? s.playlist?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {screenCount > 0
                        ? `${screenCount} screen${screenCount > 1 ? 's' : ''}`
                        : s.groupName ? `Group: ${s.groupName}` : 'All'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {isAlwaysOnRow ? <span className="text-green-600 font-semibold">Now</span> : fmtDateTime(s.startAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {isAlwaysOnRow ? <span className="text-muted-foreground/40 italic text-[10px]">Indefinite</span> : fmtDateTime(s.endAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary whitespace-nowrap">
                        <CalendarClock className="h-2.5 w-2.5" />{RECURRENCE_LABELS[s.recurrence]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <OrientationIcon o={(s.orientation as 'landscape' | 'portrait' | 'any') ?? 'landscape'} size={12} />
                        <span className="capitalize">{s.orientation ?? 'landscape'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-[10px]">
                      {s.intervalMins ? `Every ${s.intervalMins}m` : '∞ Loop'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openEdit(s)}
                          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors ${
                            isEditing
                              ? 'border-primary/40 bg-primary/10 text-primary'
                              : 'border-blue-500/30 bg-blue-500/5 text-blue-600 hover:bg-blue-500/15'
                          }`}>
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => del(s.id)} disabled={deleting === s.id}
                          className="flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/15 transition-colors disabled:opacity-40">
                          {deleting === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
