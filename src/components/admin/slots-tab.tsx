'use client';

// Slot inventory grid: rows = stores, columns = dates, cell = sold/total (heat-coloured).
// Click a cell to expand its loop positions and assign/unassign campaigns.
// Closed days (per the store's openDays bitmask) render greyed and are not clickable.
//
// Filler/bonus fill is deliberately NOT part of the sold count — the cell shows what is
// sold; the expanded panel shows what will actually play (bonus + house fill included).

import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, X, Check, Settings2, Gift, CalendarPlus, Copy, ListVideo } from 'lucide-react';
import {
  getSlotAvailability, getSlotBookings, assignSlot, unassignSlot, updateSlotSettings,
  bulkAssignSlots, copySlotDay, getPlaylists,
  type SlotStore, type SlotBookingRow, type SlotLoopEntry, type BulkAssignResult, type Playlist,
} from '@/lib/backend-api';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { SLOT_TIERS, SLOT_TIER_RATE_RUPEES, type SlotTier } from '@/lib/slot-pricing';

const TIER_LABEL: Record<SlotTier, string> = { standard: 'Standard', growth: 'Growth', flagship: 'Flagship' };

type AdminCampaign = {
  id: string; brandName: string; status: string; slotContentId: string | null;
  slotPlaylist: { id: string; name: string; mediaItems: number } | null;
  preferredStores?: { id: string; storeName: string; locality: string | null }[];
};

// Playable = a single 10s creative OR a slot playlist with at least one media item.
const hasSlotCreative = (c: AdminCampaign) => !!c.slotContentId || (c.slotPlaylist?.mediaItems ?? 0) > 0;

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 14;

const istTodayStr = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) =>
  new Date(new Date(`${d}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const dayLabel = (d: string) => {
  const dt = new Date(`${d}T00:00:00Z`);
  return { dow: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][(dt.getUTCDay() + 6) % 7], day: dt.getUTCDate() };
};

/** What a single loop position is doing, and how it reads in the grid. */
type SlotState = 'sold' | 'filler' | 'open';

const SLOT_STATE: Record<SlotState, { label: string; pill: string; swatch: string }> = {
  sold:   { label: 'Filled',      pill: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',          swatch: 'border-red-300 bg-red-400' },
  filler: { label: 'ALIVE filler', pill: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100', swatch: 'border-amber-300 bg-amber-400' },
  open:   { label: 'Open',        pill: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',  swatch: 'border-green-300 bg-green-400' },
};

/** Heat colour by sold ratio — sold-out is a strong signal, not an alarm. */
function heat(sold: number, total: number): string {
  if (total <= 0) return 'bg-muted text-muted-foreground';
  const r = sold / total;
  if (r === 0)   return 'bg-background text-muted-foreground/60 border-border';
  if (r < 0.5)   return 'bg-green-50 text-green-800 border-green-200';
  if (r < 1)     return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-primary/10 text-primary border-primary/30 font-bold';
}

export default function SlotsTab() {
  const [from,     setFrom]     = useState(istTodayStr());
  const [stores,   setStores]   = useState<SlotStore[]>([]);
  const [dates,    setDates]    = useState<string[]>([]);
  const [defaultFiller, setDefaultFiller] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [cell,     setCell]     = useState<{ store: SlotStore; date: string } | null>(null);
  const [configStore, setConfigStore] = useState<SlotStore | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getSlotAvailability(from, addDays(from, WINDOW_DAYS - 1))
      .then((r) => { setStores(r.stores); setDates(r.dates); setDefaultFiller(r.defaultFillerCampaignId); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const pw = sessionStorage.getItem('alive_admin_pw') ?? '';
    fetch('/api/campaigns/admin', { headers: { 'admin-password': pw } })
      .then((r) => r.json() as Promise<AdminCampaign[]>)
      .then((cs) => setCampaigns(Array.isArray(cs) ? cs : []))
      .catch(() => setCampaigns([]));
  }, []);

  const slotStores = stores.filter((s) => s.loopSlotCount != null);
  const offStores  = stores.filter((s) => s.loopSlotCount == null);

  if (loading && !stores.length) return (
    <div className="space-y-3">{[0,1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
  );
  if (error) return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex gap-3">
      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div><p className="text-sm font-semibold text-foreground">Could not load slot inventory</p>
        <p className="text-xs text-muted-foreground mt-0.5">{error}</p></div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-foreground">Slot inventory</p>
          <p className="text-[11px] text-muted-foreground">
            Sold slots per store per day. Empty slots never go dark — they replay sold campaigns as bonus plays, or house ads when nothing is sold.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white hover:bg-primary/90 transition-colors">
            <CalendarPlus className="h-3.5 w-3.5" />Book slots
          </button>
          <button onClick={() => setFrom(addDays(from, -WINDOW_DAYS))}
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setFrom(istTodayStr())}
            className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
            Today
          </button>
          <button onClick={() => setFrom(addDays(from, WINDOW_DAYS))}
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <SlotRequestsPanel />

      {/* Grid */}
      {!slotStores.length ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 py-12 text-center">
          <p className="text-sm text-muted-foreground">No stores are in slot mode yet.</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">Set a loop slot count on a store below to start selling slot inventory.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Store</th>
                {dates.map((d) => {
                  const { dow, day } = dayLabel(d);
                  return (
                    <th key={d} className="px-1 py-2 text-center min-w-[44px]">
                      <span className="block text-[9px] font-bold uppercase text-muted-foreground/60">{dow}</span>
                      <span className="block text-[11px] font-semibold text-foreground">{day}</span>
                    </th>
                  );
                })}
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {slotStores.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 min-w-[150px]">
                    <p className="text-[11px] font-semibold text-foreground truncate">{s.storeName}</p>
                    <p className="text-[9px] text-muted-foreground">{s.city ?? '—'} · {s.loopSlotCount} slots · {s.hoursStart}–{s.hoursEnd} · {TIER_LABEL[(s.slotPricingTier as SlotTier) || 'standard']}</p>
                  </td>
                  {dates.map((d) => {
                    const sold = s.sold?.[d];
                    const closed = sold === null || sold === undefined;
                    return (
                      <td key={d} className="px-1 py-1 text-center">
                        {closed ? (
                          <span title="Store closed" className="block rounded-md bg-muted/40 px-1 py-1.5 text-[10px] text-muted-foreground/40">—</span>
                        ) : (
                          <button
                            onClick={() => setCell({ store: s, date: d })}
                            className={`block w-full rounded-md border px-1 py-1.5 text-[10px] transition-colors hover:ring-1 hover:ring-primary/40 ${heat(sold, s.loopSlotCount!)}`}
                          >
                            {sold}/{s.loopSlotCount}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2">
                    <button onClick={() => setConfigStore(s)} title="Slot settings"
                      className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                      <Settings2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stores not yet in slot mode */}
      {offStores.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Not in slot mode</p>
          <div className="flex flex-wrap gap-2">
            {offStores.map((s) => (
              <button key={s.id} onClick={() => setConfigStore(s)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
                <Settings2 className="h-3 w-3" />{s.storeName}
              </button>
            ))}
          </div>
        </div>
      )}

      {cell && (
        <SlotEditor
          store={cell.store} date={cell.date} campaigns={campaigns} slotStores={slotStores}
          onClose={() => setCell(null)} onChanged={load}
        />
      )}
      {wizardOpen && (
        <BulkBookingWizard
          campaigns={campaigns} defaultFrom={from}
          onCampaignUpdate={(id, slotPlaylist) =>
            setCampaigns((cs) => cs.map((c) => (c.id === id ? { ...c, slotPlaylist } : c)))}
          onClose={() => setWizardOpen(false)} onChanged={load}
        />
      )}
      {configStore && (
        <StoreSlotSettings
          store={configStore} campaigns={campaigns} defaultFiller={defaultFiller}
          onClose={() => setConfigStore(null)}
          onSaved={() => { setConfigStore(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Per-cell slot editor ─────────────────────────────────────────────────────

function SlotEditor({ store, date, campaigns, slotStores, onClose, onChanged }: {
  store: SlotStore; date: string; campaigns: AdminCampaign[]; slotStores: SlotStore[];
  onClose: () => void; onChanged: () => void;
}) {
  const [bookings, setBookings] = useState<SlotBookingRow[]>([]);
  const [loop,     setLoop]     = useState<SlotLoopEntry[]>([]);
  // From the bookings response, not the grid prop — another admin may have resized
  // the loop since the grid loaded, and selling into a phantom position 400s.
  const [loopCount, setLoopCount] = useState(store.loopSlotCount ?? 0);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const load = useCallback(() => {
    getSlotBookings(store.id, date)
      .then((r) => { setBookings(r.bookings); setLoop(r.playableLoop); setLoopCount(r.loopSlotCount); })
      .catch((e: Error) => toast({ variant: 'destructive', title: 'Could not load slots', description: e.message }))
      .finally(() => setLoading(false));
  }, [store.id, date]);

  useEffect(() => { load(); }, [load]);

  const assign = async (slotPosition: number, campaignId: string) => {
    setBusy(slotPosition);
    try {
      await assignSlot({ storeId: store.id, date, slotPosition, campaignId });
      load(); onChanged();
      toast({ title: 'Slot assigned ✓' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Assign failed', description: (e as Error).message });
    } finally { setBusy(null); }
  };

  const unassign = async (booking: SlotBookingRow) => {
    setBusy(booking.slotPosition);
    try {
      await unassignSlot(booking.id);
      load(); onChanged();
      toast({ title: 'Slot cleared', description: 'It will replay a sold campaign as a bonus play.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Unassign failed', description: (e as Error).message });
    } finally { setBusy(null); }
  };

  const byPos = new Map(bookings.map((b) => [b.slotPosition, b]));
  const loopByPos = new Map(loop.map((l) => [l.slotPosition, l]));
  const campaignName = (id: string) => campaigns.find((c) => c.id === id)?.brandName ?? id.slice(0, 8);
  const sellable = campaigns.filter((c) => c.status !== 'cancelled');
  // Response-driven, not the grid prop — another admin may have resized the loop
  // since the grid loaded, and selling into a phantom position 400s.
  const total = loopCount;

  const stateOf = (pos: number): SlotState =>
    byPos.has(pos) ? 'sold' : loopByPos.has(pos) ? 'filler' : 'open';

  const counts = Array.from({ length: total }, (_, p) => stateOf(p))
    .reduce((acc, s) => ({ ...acc, [s]: acc[s] + 1 }), { sold: 0, filler: 0, open: 0 } as Record<SlotState, number>);

  const selBooking = selected == null ? undefined : byPos.get(selected);
  const selPlaying = selected == null ? undefined : loopByPos.get(selected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div>
            <p className="text-sm font-bold text-foreground">{store.storeName}</p>
            <p className="text-[11px] text-muted-foreground">{date} · {bookings.length}/{total} sold</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <div className="p-5 grid grid-cols-10 gap-2">{Array.from({ length: 30 }, (_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}</div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Legend — the loop at a glance */}
            <div className="flex flex-wrap items-center gap-4">
              {(['sold', 'filler', 'open'] as SlotState[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={`h-3 w-3 rounded-full border ${SLOT_STATE[s].swatch}`} />
                  {SLOT_STATE[s].label}
                  <span className="font-bold text-foreground">{counts[s]}</span>
                </span>
              ))}
            </div>

            {/* The loop itself — one pill per position */}
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
              {Array.from({ length: total }, (_, pos) => {
                const s = stateOf(pos);
                const isSel = selected === pos;
                return (
                  <button
                    key={pos}
                    onClick={() => setSelected(isSel ? null : pos)}
                    title={byPos.get(pos)?.campaignName
                      ?? (loopByPos.has(pos) ? `Bonus play — ${campaignName(loopByPos.get(pos)!.campaignId)}` : 'Open')}
                    className={`relative flex h-11 items-center justify-center rounded-lg border text-[11px] font-bold transition-colors ${SLOT_STATE[s].pill} ${
                      isSel ? 'ring-2 ring-foreground ring-offset-1 ring-offset-card' : ''
                    }`}
                  >
                    {busy === pos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : pos + 1}
                  </button>
                );
              })}
            </div>

            {/* Detail for the clicked pill */}
            {selected == null ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[11px] text-muted-foreground">
                Click a slot to see what plays there and reassign it.
              </p>
            ) : (
              <div className="rounded-xl border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-foreground">Slot #{selected + 1}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SLOT_STATE[stateOf(selected)].pill}`}>
                    {SLOT_STATE[stateOf(selected)].label}
                  </span>
                </div>

                {selBooking ? (
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selBooking.campaignName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {!selBooking.hasCreative
                        ? <span className="text-amber-600">Sold but no 10s creative — plays as bonus/house fill</span>
                        : selBooking.creativeCount > 1
                          ? <span className="flex items-center gap-1"><ListVideo className="h-3.5 w-3.5" />Sold · rotates {selBooking.creativeCount} playlist creatives daily</span>
                          : 'Sold · guaranteed play'}
                    </p>
                  </div>
                ) : selPlaying ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Gift className="h-3.5 w-3.5 text-amber-600" />
                    Unsold — bonus play for <span className="font-semibold text-foreground">{campaignName(selPlaying.campaignId)}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/70">Unsold, and no filler creative is configured — this position plays nothing.</p>
                )}

                <div className="flex items-center gap-2">
                  <select
                    value={selBooking?.campaignId ?? ''}
                    disabled={busy === selected}
                    onChange={(e) => e.target.value ? assign(selected, e.target.value) : selBooking && unassign(selBooking)}
                    className="flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="">— leave open —</option>
                    {sellable.map((c) => (
                      <option key={c.id} value={c.id}>{c.brandName}{hasSlotCreative(c) ? '' : ' (no creative)'}</option>
                    ))}
                  </select>
                  {busy === selected && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <CopyDayPanel store={store} date={date} slotStores={slotStores} onChanged={() => { load(); onChanged(); }} />
        )}
      </div>
    </div>
  );
}

// ─── Pending slot requests (self-serve intake, admin approves) ────────────────
//
// A SlotRequest is not a booking — it's a brand spending credits to ask for a
// store + time-window. Approving just marks it decided; the admin still picks the
// exact loop position via the grid below (SlotEditor / assignSlot), same as always.

type SlotRequestRow = {
  id: string; campaignId: string; brandName: string;
  storeId: string; storeName: string; city: string | null;
  window: string; creditsCost: number; status: string; note: string | null;
  requestedAt: string;
};

function SlotRequestsPanel() {
  const [requests, setRequests] = useState<SlotRequestRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    const pw = sessionStorage.getItem('alive_admin_pw') ?? '';
    fetch('/api/admin/slot-requests?status=pending', { headers: { 'admin-password': pw } })
      .then((r) => r.ok ? r.json() as Promise<{ requests: SlotRequestRow[] }> : { requests: [] })
      .then((d) => setRequests(d.requests))
      .catch(() => setRequests([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(id: string, decision: 'approved' | 'rejected') {
    setBusy(id);
    const pw = sessionStorage.getItem('alive_admin_pw') ?? '';
    try {
      await fetch('/api/admin/slot-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'admin-password': pw },
        body: JSON.stringify({ id, decision }),
      });
      toast({ title: decision === 'approved' ? 'Approved — assign the exact slot below ✓' : 'Rejected' });
      load();
    } finally {
      setBusy(null);
    }
  }

  if (!requests || requests.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <p className="px-4 py-2.5 text-xs font-bold text-amber-700">{requests.length} pending slot request{requests.length > 1 ? 's' : ''}</p>
      <div className="divide-y divide-border">
        {requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">
                {r.brandName} → {r.storeName}{r.city ? ` · ${r.city}` : ''} · {r.window} ({r.creditsCost} credit{r.creditsCost > 1 ? 's' : ''})
              </p>
              {r.note && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">&ldquo;{r.note}&rdquo;</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => decide(r.id, 'approved')} disabled={busy === r.id}
                className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700 hover:bg-green-100 transition-colors disabled:opacity-40">
                Approve
              </button>
              <button onClick={() => decide(r.id, 'rejected')} disabled={busy === r.id}
                className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40">
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Copy a day's loop to other dates / stores ───────────────────────────────
// Same positions, same campaigns; taken positions are never overwritten — the
// server books what fits and reports the rest as gaps.

function CopyDayPanel({ store, date, slotStores, onChanged }: {
  store: SlotStore; date: string; slotStores: SlotStore[]; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(addDays(date, 1));
  const [to,   setTo]   = useState(addDays(date, 7));
  const [sel,  setSel]  = useState<Set<string>>(new Set([store.id]));
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => setSel((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const run = async () => {
    setBusy(true);
    try {
      const r = await copySlotDay({ sourceStoreId: store.id, sourceDate: date, storeIds: [...sel], from, to });
      toast({
        title: `Copied — ${r.booked} slot${r.booked === 1 ? '' : 's'} booked ✓`,
        description: [
          r.alreadySatisfied ? `${r.alreadySatisfied} already in place` : null,
          r.missed ? `${r.missed} missed (position taken or loop too small)` : null,
          r.raced ? `${r.raced} lost to a concurrent booking — re-run to top up` : null,
          r.closedSkipped ? `${r.closedSkipped} closed day${r.closedSkipped === 1 ? '' : 's'} skipped` : null,
        ].filter(Boolean).join(' · ') || 'No gaps.',
      });
      setOpen(false);
      onChanged();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Copy failed', description: (e as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <div className="border-t border-border bg-muted/20 px-5 py-3">
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors">
          <Copy className="h-3 w-3" />Copy this day to other dates or stores…
        </button>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Copy to</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary" />
            <span className="text-[10px] text-muted-foreground">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div className="max-h-28 overflow-y-auto rounded-lg border border-border bg-background p-2 space-y-1">
            {slotStores.map((s) => (
              <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} className="h-3 w-3 accent-primary" />
                <span className="text-[11px] text-foreground">{s.storeName}</span>
                <span className="text-[9px] text-muted-foreground">{s.city ?? '—'} · {s.loopSlotCount} slots{s.id === store.id ? ' · this store' : ''}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={run} disabled={busy || sel.size === 0 || !from || !to || from > to}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white hover:bg-primary/90 disabled:opacity-40">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
              Copy bookings
            </button>
            <button onClick={() => setOpen(false)} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Per-store slot settings ──────────────────────────────────────────────────

const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function StoreSlotSettings({ store, campaigns, defaultFiller, onClose, onSaved }: {
  store: SlotStore; campaigns: AdminCampaign[]; defaultFiller: string | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [enabled,  setEnabled]  = useState(store.loopSlotCount != null);
  const [count,    setCount]    = useState(store.loopSlotCount ?? 30);
  const [openDays, setOpenDays] = useState(store.openDays);
  const [start,    setStart]    = useState(store.hoursStart);
  const [end,      setEnd]      = useState(store.hoursEnd);
  const [filler,   setFiller]   = useState(store.fillerCampaignId ?? '');
  const [tier,     setTier]     = useState(store.slotPricingTier || 'standard');
  const [saving,   setSaving]   = useState(false);

  // Mirrors resolveFillerCampaign on the server: per-store override, else global
  // default, and the campaign must have a playable slot creative (single or playlist).
  const effectiveFillerId = filler || defaultFiller || '';
  const fillerCampaign    = campaigns.find((c) => c.id === effectiveFillerId);
  const fillerPlayable    = !!fillerCampaign && hasSlotCreative(fillerCampaign);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateSlotSettings({
        storeId: store.id,
        loopSlotCount: enabled ? count : null,
        openDays, hoursStart: start, hoursEnd: end,
        fillerCampaignId: filler || null,
        slotPricingTier: tier,
      });
      const moved = res.reassigned ?? [];
      toast(moved.length
        ? {
            title: `Saved — ${moved.length} booking${moved.length > 1 ? 's' : ''} moved ✓`,
            description: `${[...new Set(moved.map((m) => m.campaignName))].join(', ')} kept their plays at lower slot numbers. Shown on their dashboards; no email sent.`,
          }
        : { title: 'Slot settings saved ✓' });
      if (res.warning) {
        toast({ variant: 'destructive', title: 'No filler campaign — screen can go dark', description: res.warning });
      }
      onSaved();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Save failed', description: (e as Error).message });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-bold text-foreground">{store.storeName} — slot settings</p>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
            <span className="text-xs font-semibold text-foreground">Slot mode</span>
            <span className="text-[10px] text-muted-foreground">— screen runs the fixed ad loop instead of its schedules</span>
          </label>

          <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Slots per loop <span className="font-normal normal-case tracking-normal text-muted-foreground/70">— how many brands this store can run</span>
                </label>
                <input type="number" min={1} max={60} value={count} onChange={(e) => setCount(Number(e.target.value))}
                  className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
                <span className="ml-2 text-[10px] text-muted-foreground">× 10s = {count * 10}s per loop</span>
                {store.loopSlotCount != null && count < store.loopSlotCount && (
                  <p className="mt-1 text-[10px] text-amber-600">
                    Reducing from {store.loopSlotCount}. Upcoming bookings above slot {count} move down into free slots automatically, and the brands see it on their dashboard. Only a day with more bookings than {count} will block the change.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Pricing tier <span className="font-normal normal-case tracking-normal text-muted-foreground/70">— price per slot, and the store's payout</span>
                </label>
                <div className="flex gap-1.5">
                  {SLOT_TIERS.map((t) => (
                    <button key={t} onClick={() => setTier(t)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                        tier === t ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground/70'
                      }`}>
                      {TIER_LABEL[t]}<br />₹{SLOT_TIER_RATE_RUPEES[t].toLocaleString('en-IN')}/slot
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">Not shown to the store partner — their dashboard only shows the resulting payout total.</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Open days</label>
                <div className="flex gap-1">
                  {DOW.map((d, i) => {
                    const on = (openDays & (1 << i)) !== 0;
                    return (
                      <button key={d} onClick={() => setOpenDays(on ? openDays & ~(1 << i) : openDays | (1 << i))}
                        className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                          on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground/50'
                        }`}>{d}</button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Opens</label>
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Closes</label>
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Filler campaign</label>
                <select value={filler} onChange={(e) => setFiller(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary">
                  <option value="">Use default house ads{defaultFiller ? '' : ' (none set)'}</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.brandName}{hasSlotCreative(c) ? '' : ' (no creative)'}</option>)}
                </select>
                <p className="mt-1 text-[10px] text-muted-foreground">Plays only when nothing is sold for the day.</p>
                {enabled && !fillerPlayable && (
                  <div className="mt-1.5 flex gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/8 px-2.5 py-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-px" />
                    <p className="text-[10px] text-amber-700 leading-snug">
                      {effectiveFillerId
                        ? 'The chosen filler campaign has no 10s slot creative, so it cannot play. '
                        : 'No filler campaign is set and there is no global default. '}
                      On a day with <strong>zero bookings</strong> this screen falls back to its schedules —
                      with no schedules it goes dark. Pick a filler campaign with a slot creative.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-40">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk booking wizard ─────────────────────────────────────────────────────
// Campaign → dates & stores → review. One request books the whole matrix; the
// server books what fits (existing bookings count toward the target) and the
// result screen lists every gap instead of anything failing silently.

const weekdayOf = (d: string) => (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; // 0=Mon

function BulkBookingWizard({ campaigns, defaultFrom, onCampaignUpdate, onClose, onChanged }: {
  campaigns: AdminCampaign[]; defaultFrom: string;
  onCampaignUpdate: (id: string, slotPlaylist: AdminCampaign['slotPlaylist']) => void;
  onClose: () => void; onChanged: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [campaignId,   setCampaignId]   = useState('');
  const [playlists,    setPlaylists]    = useState<Playlist[]>([]);
  const [attachSel,    setAttachSel]    = useState('');
  const [attachBusy,   setAttachBusy]   = useState(false);

  const [from,   setFrom]   = useState(defaultFrom);
  const [to,     setTo]     = useState(addDays(defaultFrom, 13));
  const [dow,    setDow]    = useState(127);
  const [perDay, setPerDay] = useState(1);

  const [avail,        setAvail]        = useState<{ dates: string[]; stores: SlotStore[] } | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [sel,          setSel]          = useState<Set<string>>(new Set());

  const [busy,   setBusy]   = useState(false);
  const [result, setResult] = useState<BulkAssignResult | null>(null);
  // Brand-pick pre-selection is applied once per campaign choice, so a deliberate
  // clear-all is never silently undone by stepping Back and Next again.
  const [preselectedFor, setPreselectedFor] = useState<string | null>(null);

  const campaign = campaigns.find((c) => c.id === campaignId) ?? null;
  const sellable = campaigns.filter((c) => c.status !== 'cancelled');

  // The bulk endpoint caps a request at 60 days; the availability grid silently
  // stops at 60 dates. Surface the cap up front instead of a doomed Book click.
  const rangeDays = from && to ? (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS + 1 : 0;
  const rangeTooLong = rangeDays > 60;

  useEffect(() => { getPlaylists().then(setPlaylists).catch(() => setPlaylists([])); }, []);

  // Availability drives the store list's free counts AND the review matrix. The
  // stale flag drops out-of-order responses — otherwise a slow fetch for an old
  // range could overwrite the numbers the admin is about to approve.
  useEffect(() => {
    if (!from || !to || from > to || rangeTooLong) return;
    let stale = false;
    setAvailLoading(true);
    getSlotAvailability(from, to)
      .then((r) => { if (!stale) setAvail({ dates: r.dates, stores: r.stores }); })
      .catch((e: Error) => { if (!stale) toast({ variant: 'destructive', title: 'Could not load availability', description: e.message }); })
      .finally(() => { if (!stale) setAvailLoading(false); });
    return () => { stale = true; };
  }, [from, to, rangeTooLong]);

  const slotStores = (avail?.stores ?? []).filter((s) => s.loopSlotCount != null);
  const dates      = (avail?.dates ?? []).filter((d) => (dow & (1 << weekdayOf(d))) !== 0);
  const chosen     = slotStores.filter((s) => sel.has(s.id));

  const mediaCount = (p: Playlist) => p.items.filter((i) => i.contentId).length;

  const attach = async (playlistId: string | null) => {
    if (!campaign) return;
    setAttachBusy(true);
    try {
      await updateSlotSettings({ campaignId: campaign.id, slotPlaylistId: playlistId });
      const pl = playlistId ? playlists.find((p) => p.id === playlistId) : undefined;
      // Update the tab's campaign list, not a local copy — the change must survive
      // closing the wizard and show up in every creative label on the tab.
      onCampaignUpdate(campaign.id, pl ? { id: pl.id, name: pl.name, mediaItems: mediaCount(pl) } : null);
      toast(playlistId
        ? { title: 'Playlist attached ✓', description: 'Its media items rotate through this campaign’s slots — one per play, advancing daily.' }
        : { title: 'Playlist detached' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not attach playlist', description: (e as Error).message });
    } finally { setAttachBusy(false); }
  };

  // Entering step 2: pre-tick the brand's map picks so the common case books itself
  // — once per campaign choice, so an admin's clear-all is not undone on re-entry.
  const goStores = () => {
    if (preselectedFor !== campaignId) {
      if (sel.size === 0 && campaign?.preferredStores?.length) {
        setSel(new Set(campaign.preferredStores.map((p) => p.id)));
      }
      setPreselectedFor(campaignId);
    }
    setStep(2);
  };

  const toggleStore = (id: string) => setSel((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const byCity = new Map<string, SlotStore[]>();
  for (const s of slotStores) {
    const key = s.city ?? '—';
    byCity.set(key, [...(byCity.get(key) ?? []), s]);
  }

  const freeSummary = (s: SlotStore) => {
    let free = 0, cap = 0;
    for (const d of dates) {
      const sold = s.sold?.[d];
      if (sold == null) continue; // closed
      cap  += s.loopSlotCount!;
      free += Math.max(0, s.loopSlotCount! - sold);
    }
    return { free, cap };
  };

  // Client-side estimate for the review matrix. The server additionally counts this
  // campaign's existing bookings toward the target, so the real result can only be
  // equal or better; the response is the ground truth shown afterwards.
  const estimate = (() => {
    let will = 0, miss = 0;
    for (const s of chosen) for (const d of dates) {
      const sold = s.sold?.[d];
      if (sold == null) continue;
      const take = Math.min(perDay, Math.max(0, s.loopSlotCount! - sold));
      will += take; miss += perDay - take;
    }
    return { will, miss };
  })();

  const book = async () => {
    setBusy(true);
    try {
      const r = await bulkAssignSlots({
        campaignId,
        storeIds: chosen.map((s) => s.id),
        from, to,
        ...(dow !== 127 ? { daysOfWeek: dow } : {}),
        slotsPerDay: perDay,
      });
      setResult(r);
      onChanged();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Booking failed', description: (e as Error).message });
    } finally { setBusy(false); }
  };

  const stepTitle = result ? 'Booking result' : step === 1 ? 'Campaign & creative' : step === 2 ? 'Dates & stores' : 'Review & book';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div>
            <p className="text-sm font-bold text-foreground">Book slots — {stepTitle}</p>
            {!result && <p className="text-[11px] text-muted-foreground">Step {step} of 3 · books what fits, then reports every gap</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {result ? (
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Booked',        value: result.booked,           strong: true },
                { label: 'Already held',  value: result.alreadySatisfied, strong: false },
                { label: 'Missed',        value: result.missed,           strong: false },
                { label: 'Closed days',   value: result.closedSkipped,    strong: false },
              ].map(({ label, value, strong }) => (
                <div key={label} className="rounded-xl border border-border bg-background px-3 py-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                  <p className={`text-lg tracking-tight ${strong ? 'font-black text-primary' : 'font-bold text-foreground'}`}>{value}</p>
                </div>
              ))}
            </div>
            {result.raced > 0 && (
              <p className="text-[11px] text-amber-600">{result.raced} position(s) were taken by someone else mid-request — re-run to top up from what&apos;s left.</p>
            )}
            {result.skippedStores.length > 0 && (
              <p className="text-[11px] text-amber-600">
                Skipped stores: {result.skippedStores.map((s) => `${s.storeName} (${s.reason})`).join(', ')}
              </p>
            )}
            {result.gaps.length > 0 ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-muted/60">
                      <tr>
                        <th className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Store</th>
                        <th className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Date</th>
                        <th className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Missed</th>
                        <th className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.gaps.map((g, i) => (
                        <tr key={i} className="border-t border-border/60">
                          <td className="px-3 py-1.5 text-[11px] text-foreground">{g.storeName}</td>
                          <td className="px-3 py-1.5 text-[11px] text-muted-foreground">{g.date}</td>
                          <td className="px-3 py-1.5 text-[11px] font-semibold text-foreground">{g.missed}</td>
                          <td className="px-3 py-1.5 text-[11px] text-muted-foreground">{g.reason === 'full' ? 'Day sold out' : 'Partially available'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.gapsTruncated && <p className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">Showing the first 500 gaps — the totals above cover everything.</p>}
              </div>
            ) : (
              <p className="text-[11px] text-green-700">No gaps — everything requested was booked (or already in place).</p>
            )}
            <button onClick={onClose}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90">
              <Check className="h-3.5 w-3.5" />Done
            </button>
          </div>
        ) : (
        <div className="p-5 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Campaign</label>
                {sellable.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">No campaigns yet.</p>
                ) : (
                  <div className="rounded-xl border border-border max-h-56 overflow-y-auto divide-y divide-border">
                    {sellable.map((c) => {
                      const on = campaignId === c.id;
                      return (
                        <button key={c.id}
                          onClick={() => {
                            if (campaignId === c.id) return;
                            setCampaignId(c.id);
                            // A different campaign means a different booking: drop the
                            // old selection so ITS brand picks pre-tick on step 2.
                            setSel(new Set());
                            setPreselectedFor(null);
                          }}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${on ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                          <span className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${on ? 'border-primary bg-primary' : 'border-border bg-background'}`} />
                          <span className="flex-1 min-w-0">
                            <span className="block truncate text-[11px] font-semibold text-foreground">{c.brandName}</span>
                            <span className="block text-[9px] text-muted-foreground capitalize">{c.status}{c.preferredStores?.length ? ` · ${c.preferredStores.length} brand-picked store${c.preferredStores.length === 1 ? '' : 's'}` : ''}</span>
                          </span>
                          {c.slotPlaylist && c.slotPlaylist.mediaItems > 0 ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                              <ListVideo className="h-3 w-3" />{c.slotPlaylist.mediaItems} rotating
                            </span>
                          ) : c.slotContentId ? (
                            <span className="shrink-0 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[9px] font-bold text-green-800">10s creative</span>
                          ) : (
                            <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">no creative</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {campaign && (
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">What plays in its slots</p>
                  {campaign.slotPlaylist && campaign.slotPlaylist.mediaItems > 0 ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[11px] text-foreground">
                        <ListVideo className="h-3.5 w-3.5 text-primary" />
                        <span className="font-semibold">{campaign.slotPlaylist.name}</span>
                        <span className="text-muted-foreground">— {campaign.slotPlaylist.mediaItems} creatives rotate, one per play, advancing daily</span>
                      </p>
                      <button onClick={() => attach(null)} disabled={attachBusy}
                        className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40">
                        Detach
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-[11px] text-muted-foreground">
                        {campaign.slotContentId
                          ? 'Single 10s creative. Attach a playlist to rotate several creatives instead:'
                          : <span className="text-amber-600">No creative yet — its slots would book as sold but play as bonus/house fill. Attach a playlist now, or set a 10s creative later:</span>}
                      </p>
                      <div className="flex items-center gap-2">
                        <select value={attachSel} onChange={(e) => setAttachSel(e.target.value)}
                          className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] text-foreground focus:outline-none focus:border-primary">
                          <option value="">— pick a playlist —</option>
                          {playlists.map((p) => (
                            <option key={p.id} value={p.id} disabled={mediaCount(p) === 0}>
                              {p.name} · {mediaCount(p)} media item{mediaCount(p) === 1 ? '' : 's'}{mediaCount(p) === 0 ? ' (unplayable)' : ''}
                            </option>
                          ))}
                        </select>
                        <button onClick={() => attachSel && attach(attachSel)} disabled={attachBusy || !attachSel}
                          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-primary/90 disabled:opacity-40">
                          {attachBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListVideo className="h-3 w-3" />}Attach
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">From</label>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">To</label>
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Days</label>
                  <div className="flex gap-1">
                    {DOW.map((d, i) => {
                      const on = (dow & (1 << i)) !== 0;
                      return (
                        <button key={d} onClick={() => setDow(on ? dow & ~(1 << i) : dow | (1 << i))}
                          className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                            on ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground/50'
                          }`}>{d}</button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {rangeTooLong && (
                <p className="text-[11px] text-amber-600">
                  That range is {rangeDays} days — bookings go out at most 60 days per request. Shorten the range to continue.
                </p>
              )}

              {availLoading ? (
                <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
              ) : slotStores.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No stores are in slot mode.</p>
              ) : (
                <div className="rounded-xl border border-border max-h-72 overflow-y-auto divide-y divide-border">
                  {[...byCity.entries()].map(([city, cityStores]) => {
                    const allOn = cityStores.every((s) => sel.has(s.id));
                    return (
                      <div key={city}>
                        <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{city}</p>
                          <button
                            onClick={() => setSel((s) => {
                              const next = new Set(s);
                              cityStores.forEach((st) => { if (allOn) next.delete(st.id); else next.add(st.id); });
                              return next;
                            })}
                            className="text-[10px] font-semibold text-primary hover:underline">
                            {allOn ? 'Clear' : 'Select all'}
                          </button>
                        </div>
                        {cityStores.map((s) => {
                          const { free, cap } = freeSummary(s);
                          const preferred = campaign?.preferredStores?.some((p) => p.id === s.id);
                          return (
                            <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/20">
                              <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggleStore(s.id)} className="h-3.5 w-3.5 accent-primary" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-foreground truncate">
                                  {s.storeName}
                                  {preferred && <span className="ml-1.5 rounded bg-primary/10 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-primary">brand pick</span>}
                                </p>
                                <p className="text-[9px] text-muted-foreground">{s.loopSlotCount} slots/loop · {s.hoursStart}–{s.hoursEnd}</p>
                              </div>
                              <span className={`text-[10px] font-semibold ${free === 0 ? 'text-primary' : 'text-green-700'}`}>{free}/{cap} free</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Slots per day per store</label>
                  <input type="number" min={1} max={60} value={perDay} onChange={(e) => setPerDay(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div className="flex-1 text-[11px] text-muted-foreground pt-4">
                  <span className="font-semibold text-foreground">{campaign?.brandName}</span> · {chosen.length} store{chosen.length === 1 ? '' : 's'} · {dates.length} day{dates.length === 1 ? '' : 's'} ·
                  est. <span className="font-semibold text-green-700"> {estimate.will} booked</span>
                  {estimate.miss > 0 && <span className="font-semibold text-amber-600"> · {estimate.miss} won&apos;t fit</span>}
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-x-auto max-h-72 overflow-y-auto">
                <table className="border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-10 bg-card px-3 py-1.5 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Store</th>
                      {dates.map((d) => {
                        const { dow: wd, day } = dayLabel(d);
                        return (
                          <th key={d} className="sticky top-0 bg-card px-1 py-1.5 text-center min-w-[36px]">
                            <span className="block text-[8px] font-bold uppercase text-muted-foreground/60">{wd}</span>
                            <span className="block text-[10px] font-semibold text-foreground">{day}</span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {chosen.map((s) => (
                      <tr key={s.id} className="border-t border-border/60">
                        <td className="sticky left-0 z-10 bg-card px-3 py-1.5 text-[10px] font-semibold text-foreground whitespace-nowrap">{s.storeName}</td>
                        {dates.map((d) => {
                          const sold = s.sold?.[d];
                          if (sold == null) return <td key={d} className="px-1 py-1 text-center text-[9px] text-muted-foreground/40">—</td>;
                          const take = Math.min(perDay, Math.max(0, s.loopSlotCount! - sold));
                          const cls = take === perDay ? 'bg-green-50 text-green-800 border-green-200'
                                    : take > 0        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    :                   'bg-primary/10 text-primary border-primary/30';
                          return (
                            <td key={d} className="px-0.5 py-0.5 text-center">
                              <span className={`block rounded border px-0.5 py-1 text-[9px] font-semibold ${cls}`}>{take}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Each cell = slots this request will book that day (grey — = closed). Positions already held by this campaign count toward the target, so re-running never double-books.
              </p>
            </>
          )}

          <div className="flex items-center justify-between border-t border-border pt-3.5">
            <button
              onClick={() => step > 1 ? setStep((s) => (s - 1) as 1 | 2) : onClose()}
              className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step === 1 && (
              <button onClick={goStores} disabled={!campaignId}
                className="rounded-lg bg-primary px-4 py-1.5 text-[11px] font-bold text-white hover:bg-primary/90 disabled:opacity-40">
                Next — dates &amp; stores
              </button>
            )}
            {step === 2 && (
              <button onClick={() => setStep(3)}
                disabled={chosen.length === 0 || dates.length === 0 || !from || !to || from > to || rangeTooLong || availLoading}
                className="rounded-lg bg-primary px-4 py-1.5 text-[11px] font-bold text-white hover:bg-primary/90 disabled:opacity-40">
                Next — review ({chosen.length} store{chosen.length === 1 ? '' : 's'})
              </button>
            )}
            {step === 3 && (
              <button onClick={book} disabled={busy || chosen.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[11px] font-bold text-white hover:bg-primary/90 disabled:opacity-40">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
                Book what fits
              </button>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
