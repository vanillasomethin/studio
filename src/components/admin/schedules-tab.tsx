'use client';

import { useEffect, useState } from 'react';
import { Loader2, CalendarClock, Plus, Trash2, AlertCircle } from 'lucide-react';
import { getSchedules, getPlaylists, createSchedule, deleteSchedule, type Schedule, type Playlist } from '@/lib/backend-api';

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

const inp = 'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';
const lbl = 'block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1';

const RECURRENCE_LABELS: Record<Schedule['recurrence'], string> = {
  once:   'One-time',
  daily:  'Daily',
  weekly: 'Weekly',
};

export default function SchedulesTab() {
  const [schedules,  setSchedules]  = useState<Schedule[]>([]);
  const [playlists,  setPlaylists]  = useState<Playlist[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);

  const [form, setForm] = useState({
    name: '', playlistId: '', groupName: '',
    startAt: '', endAt: '', recurrence: 'once' as Schedule['recurrence'],
  });

  useEffect(() => {
    Promise.all([getSchedules(), getPlaylists()])
      .then(([s, p]) => { setSchedules(s); setPlaylists(p); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const del = async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    setDeleting(id);
    try {
      await deleteSchedule(id);
      setSchedules((s) => s.filter((x) => x.id !== id));
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.playlistId || !form.startAt || !form.endAt) return;
    setSaving(true);
    try {
      const sch = await createSchedule({
        name:        form.name,
        playlistId:  form.playlistId,
        groupName:   form.groupName || undefined,
        startAt:     new Date(form.startAt).toISOString(),
        endAt:       new Date(form.endAt).toISOString(),
        recurrence:  form.recurrence,
      });
      setSchedules((s) => [sch, ...s]);
      setForm({ name: '', playlistId: '', groupName: '', startAt: '', endAt: '', recurrence: 'once' });
      setShowForm(false);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  if (error) return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex gap-3">
      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-foreground">Backend not reachable</p>
        <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
      </div>
    </div>
  );

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New schedule
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Schedule details</h2>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Name</label>
                <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jul Afternoon Slot" className={inp} />
              </div>
              <div>
                <label className={lbl}>Playlist</label>
                <select required value={form.playlistId} onChange={(e) => setForm((f) => ({ ...f, playlistId: e.target.value }))} className={inp}>
                  <option value="">Select a playlist</option>
                  {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Store group <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
                <input type="text" value={form.groupName} onChange={(e) => setForm((f) => ({ ...f, groupName: e.target.value }))} placeholder="Mangaluru North" className={inp} />
              </div>
              <div>
                <label className={lbl}>Recurrence</label>
                <select value={form.recurrence} onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value as Schedule['recurrence'] }))} className={inp}>
                  <option value="once">One-time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Start</label>
                <input type="datetime-local" required value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>End</label>
                <input type="datetime-local" required value={form.endAt} onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))} className={inp} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-40 transition-colors">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save schedule'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!schedules.length ? (
        <p className="text-sm text-muted-foreground text-center py-10">No schedules yet. Create one to start pushing content to screens.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {['Name', 'Playlist', 'Group', 'Start', 'End', 'Recurrence'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {schedules.map((s) => {
                const pl = playlists.find((p) => p.id === s.playlistId);
                return (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{pl?.name ?? s.playlistId.slice(0, 8) + '…'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.groupName ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(s.startAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(s.endAt)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        <CalendarClock className="h-2.5 w-2.5" />{RECURRENCE_LABELS[s.recurrence]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => del(s.id)}
                        disabled={deleting === s.id}
                        className="flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/15 transition-colors disabled:opacity-40"
                      >
                        {deleting === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
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
