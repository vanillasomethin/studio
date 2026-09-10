'use client';

// One screen for everything a store's ad loop needs: its settings, who is playing in
// it, and what actually plays position by position.
//
// This replaces a five-surface procedure (brand onboarding funnel → Content tab →
// Playlists tab → booking wizard → a separate settings modal). Loop settings are
// edited inline rather than behind a modal, and "Add brand" creates the campaign,
// attaches the creative and books the slots in one submit.
//
// Deliberately self-contained: it takes a store and a campaign list as props and owns
// nothing else, so it can be mounted anywhere a store is in scope.
//
// Bookings are written through the EXISTING bulk endpoint over a 60-day horizon (its
// hard cap). That is a known seam, not an oversight: when SlotPlan standing
// assignments land, only the write path behind this form changes and the UI does not.

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Loader2, Plus, Settings2, Trash2, Tv2 } from 'lucide-react';
import {
  getSlotBookings, bulkAssignSlots, createCampaign, updateSlotSettings, getContent,
  type SlotStore, type SlotBookingRow, type SlotLoopEntry,
} from '@/lib/backend-api';
import { ContentPickerField, type ContentLike } from './content-picker';
import { toast } from '@/hooks/use-toast';

// Horizon for a booking made here. The bulk endpoint caps a request at 60 days
// (MAX_RANGE_DAYS), so this is the longest a single submit can reach.
const HORIZON_DAYS = 60;
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const istTodayStr = () =>
  new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Why a position is playing what it is. `sold` is a booked, guaranteed play;
 *  `bonus` is an unsold position redistributed to a paying campaign; `house` is
 *  ALIVE's own filler, which is what stops the screen going dark. */
type Source = 'sold' | 'plan' | 'bonus' | 'house';
const SOURCE_STYLE: Record<Source, string> = {
  sold:  'bg-primary/10 border-primary/40 text-primary',
  plan:  'bg-indigo-500/10 border-indigo-500/40 text-indigo-700',
  bonus: 'bg-amber-500/10 border-amber-500/40 text-amber-700',
  house: 'bg-muted border-border text-muted-foreground',
};
const SOURCE_LABEL: Record<Source, string> = {
  sold: 'Booked', plan: 'Standing', bonus: 'Bonus', house: 'House',
};

type CampaignLike = {
  id: string; brandName: string; status: string;
  slotContentId: string | null;
  slotPlaylist: { id: string; name: string; mediaItems: number } | null;
  slotSpan?: number | null;
};

export default function StoreSlotLoop({
  store, campaigns, onBack, onChanged, onReloadCampaigns,
}: {
  store: SlotStore;
  campaigns: CampaignLike[];
  onBack: () => void;
  /** Availability changed — the caller's grid is now stale. */
  onChanged: () => void;
  onReloadCampaigns: () => void;
}) {
  const [date]        = useState(istTodayStr());
  const [bookings,    setBookings]    = useState<SlotBookingRow[]>([]);
  const [loop,        setLoop]        = useState<SlotLoopEntry[]>([]);
  const [loopCount,   setLoopCount]   = useState<number>(store.loopSlotCount ?? 0);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<number | null>(null);
  const [addOpen,     setAddOpen]     = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);

  // Editable settings, seeded from the store and written back on blur.
  const [slots,  setSlots]  = useState(String(store.loopSlotCount ?? ''));
  const [hStart, setHStart] = useState(store.hoursStart);
  const [hEnd,   setHEnd]   = useState(store.hoursEnd);
  const [days,   setDays]   = useState(store.openDays);

  const load = useCallback(() => {
    setLoading(true);
    getSlotBookings(store.id, date)
      .then((r) => {
        setBookings(Array.isArray(r.bookings) ? r.bookings : []);
        setLoop(Array.isArray(r.playableLoop) ? r.playableLoop : []);
        setLoopCount(r.loopSlotCount ?? 0);
      })
      .catch((e: Error) => toast({ variant: 'destructive', title: 'Could not load the loop', description: e.message }))
      .finally(() => setLoading(false));
  }, [store.id, date]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async (patch: Parameters<typeof updateSlotSettings>[0]) => {
    setSettingsBusy(true);
    try {
      await updateSlotSettings(patch);
      toast({ title: 'Loop settings saved ✓' });
      load();
      onChanged();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Save failed', description: (e as Error).message });
    } finally { setSettingsBusy(false); }
  };

  const toggleDay = (i: number) => {
    const next = days ^ (1 << i);
    setDays(next);
    void saveSettings({ storeId: store.id, openDays: next });
  };

  const campaignById = new Map(campaigns.map((c) => [c.id, c]));
  const soldCampaignIds = new Set(bookings.map((b) => b.campaignId));

  // Positions the loop actually plays, expanded across spans, so a 30s ad reads as
  // the three positions it occupies rather than one.
  const cells: ({ entry: SlotLoopEntry; source: Source } | null)[] =
    Array.from({ length: loopCount }, () => null);
  for (const e of loop) {
    // Prefer the builder's own answer. The fallback below is only correct while
    // standing assignments do not exist: a plan play is isFiller=true with no
    // booking here, so it would read as house content belonging to nobody.
    const source: Source = e.source
      ? (e.source === 'filler' ? 'house' : e.source)
      : !e.isFiller ? 'sold' : soldCampaignIds.has(e.campaignId) ? 'bonus' : 'house';
    for (let i = 0; i < e.spanSlots; i++) {
      if (e.slotPosition + i < loopCount) cells[e.slotPosition + i] = { entry: e, source };
    }
  }

  // Who is playing — one row per campaign, counted in PLAYS (a 30s ad booked twice is
  // 2 plays over 6 positions), which is the unit the booking form asks for.
  const roster = (() => {
    const seenSpans = new Set<string>();
    const byCampaign = new Map<string, { campaignId: string; name: string; plays: number; positions: number }>();
    for (const b of bookings) {
      const row = byCampaign.get(b.campaignId)
        ?? { campaignId: b.campaignId, name: b.campaignName, plays: 0, positions: 0 };
      row.positions += 1;
      // Every row of a multi-slot placement shares a spanId; count the play once.
      if (b.spanId) {
        if (!seenSpans.has(b.spanId)) { seenSpans.add(b.spanId); row.plays += 1; }
      } else {
        row.plays += 1;
      }
      byCampaign.set(b.campaignId, row);
    }
    return [...byCampaign.values()].sort((a, b) => b.positions - a.positions);
  })();

  const housePositions = cells.filter((c) => c?.source === 'house').length;
  const sel = selected == null ? null : cells[selected];

  const removeCampaign = async (campaignId: string, name: string) => {
    if (!confirm(`Remove ${name} from today's loop at ${store.storeName}?`)) return;
    const ids = bookings.filter((b) => b.campaignId === campaignId).map((b) => b.id);
    try {
      // Deleting any row of a placement removes the whole placement server-side, so
      // duplicate ids in one span are expected to 404 — tolerate that rather than
      // reporting a failure for work that actually succeeded.
      await Promise.allSettled(ids.map((id) => fetch(`/api/slots/bookings?id=${id}`, { method: 'DELETE' })));
      toast({ title: `${name} removed from today` });
      load(); onChanged();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Remove failed', description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2">
          <button onClick={onBack} title="Back to the inventory grid"
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div>
            <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Tv2 className="h-4 w-4 text-muted-foreground" />{store.storeName}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {store.city ?? '—'} · today {date}
            </p>
          </div>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white hover:bg-primary/90 transition-colors">
          <Plus className="h-3.5 w-3.5" />Add brand
        </button>
      </div>

      {/* Settings, inline rather than behind a modal. */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Loop size</span>
          <input
            value={slots} inputMode="numeric"
            onChange={(e) => setSlots(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => {
              const n = Number(slots);
              if (!slots || !Number.isFinite(n) || n < 1 || n === store.loopSlotCount) return;
              void saveSettings({ storeId: store.id, loopSlotCount: n });
            }}
            className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-[12px] tabular-nums text-foreground focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Opens</span>
          <input type="time" value={hStart}
            onChange={(e) => setHStart(e.target.value)}
            onBlur={() => hStart !== store.hoursStart && void saveSettings({ storeId: store.id, hoursStart: hStart })}
            className="rounded-lg border border-border bg-background px-2 py-1 text-[12px] text-foreground focus:border-primary focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Closes</span>
          <input type="time" value={hEnd}
            onChange={(e) => setHEnd(e.target.value)}
            onBlur={() => hEnd !== store.hoursEnd && void saveSettings({ storeId: store.id, hoursEnd: hEnd })}
            className="rounded-lg border border-border bg-background px-2 py-1 text-[12px] text-foreground focus:border-primary focus:outline-none" />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Open days</span>
          <div className="flex gap-1">
            {DAY_LABELS.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)}
                aria-label={`Toggle day ${i + 1}`} aria-pressed={(days & (1 << i)) !== 0}
                className={`h-6 w-6 rounded text-[9px] font-bold transition-colors ${
                  (days & (1 << i)) ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                }`}>{d}</button>
            ))}
          </div>
        </div>
        {settingsBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground mb-1.5" />}
        <span className="ml-auto mb-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
          <Settings2 className="h-3 w-3" />Saved as you edit
        </span>
      </div>

      {/* Who's playing */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Who&apos;s playing · {roster.length} {roster.length === 1 ? 'brand' : 'brands'}
        </p>
        {loading ? (
          <p className="text-[11px] text-muted-foreground">Loading…</p>
        ) : roster.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
            Nothing booked today — the whole loop is playing house content.
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {roster.map((r) => {
              const c = campaignById.get(r.campaignId);
              const span = c?.slotSpan ?? 1;
              return (
                <div key={r.campaignId} className="flex items-center gap-3 border-b border-border/60 bg-card px-3 py-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-foreground">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {span > 1 ? `${span * 10}s · ${span} slots per play` : '10s'}
                      {c?.slotPlaylist ? ` · ${c.slotPlaylist.mediaItems} creatives rotating` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-bold tabular-nums text-foreground">{r.plays} / day</p>
                    <p className="text-[9px] text-muted-foreground tabular-nums">{r.positions} slots</p>
                  </div>
                  <button onClick={() => removeCampaign(r.campaignId, r.name)} title="Remove from today"
                    className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/15 transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* The loop */}
      {loopCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Now playing · {loopCount} positions · {(loopCount * 10 / 60).toFixed(1)} min loop
            </p>
            <p className="text-[10px] text-muted-foreground">
              {housePositions > 0 ? `${housePositions} playing house content` : 'fully sold'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {cells.map((c, pos) => (
              <button key={pos}
                onClick={() => setSelected(selected === pos ? null : pos)}
                title={c ? `#${pos + 1} · ${campaignById.get(c.entry.campaignId)?.brandName ?? 'House'} — ${SOURCE_LABEL[c.source]}` : `#${pos + 1} · empty`}
                aria-label={`Position ${pos + 1}, ${c ? SOURCE_LABEL[c.source] : 'empty'}`}
                className={`h-7 w-7 rounded border text-[9px] font-bold tabular-nums transition-transform hover:-translate-y-0.5 ${
                  c ? SOURCE_STYLE[c.source] : 'border-dashed border-border text-muted-foreground/40'
                } ${selected === pos ? 'ring-2 ring-foreground ring-offset-1 ring-offset-background' : ''}`}>
                {pos + 1}
              </button>
            ))}
          </div>
          {sel && (
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <p className="text-[12px] font-semibold text-foreground">
                {sel.source === 'house'
                  ? 'ALIVE house content'
                  : campaignById.get(sel.entry.campaignId)?.brandName ?? sel.entry.campaignId}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Position #{sel.entry.slotPosition + 1}
                {sel.entry.spanSlots > 1 ? `–#${sel.entry.slotPosition + sel.entry.spanSlots}` : ''}
                {' · '}{SOURCE_LABEL[sel.source]}
                {sel.source === 'bonus' ? ' — an unsold position replayed for a paying brand' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {addOpen && (
        <AddBrandDialog
          store={store}
          campaigns={campaigns}
          onClose={() => setAddOpen(false)}
          onDone={() => { setAddOpen(false); load(); onChanged(); onReloadCampaigns(); }}
        />
      )}
    </div>
  );
}

/** Create-or-pick a brand, attach a creative, book it — one submit.
 *  The whole point of the screen: no onboarding funnel, no separate wizard. */
function AddBrandDialog({ store, campaigns, onClose, onDone }: {
  store: SlotStore;
  campaigns: CampaignLike[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name,      setName]      = useState('');
  const [existing,  setExisting]  = useState<string>('');   // campaign id, '' = new
  const [library,   setLibrary]   = useState<ContentLike[]>([]);
  const [contentId, setContentId] = useState<string | null>(null);
  const [perDay,    setPerDay]    = useState('2');
  const [busy,      setBusy]      = useState(false);

  // The creative library, only needed once this dialog is open — the slots tab
  // itself never lists content, so loading it here keeps the tab's cost unchanged.
  useEffect(() => {
    getContent()
      .then((r) => setLibrary(Array.isArray(r.content) ? r.content : []))
      .catch(() => setLibrary([]));
  }, []);

  const picked = existing ? campaigns.find((c) => c.id === existing) ?? null : null;
  const from = istTodayStr();
  const to   = addDays(from, HORIZON_DAYS - 1);

  const submit = async () => {
    const plays = Number(perDay);
    if (!Number.isFinite(plays) || plays < 1) {
      toast({ variant: 'destructive', title: 'Slots per day must be at least 1' }); return;
    }
    if (!picked && !name.trim()) {
      toast({ variant: 'destructive', title: 'Enter a brand name' }); return;
    }
    if (!picked && !contentId) {
      toast({ variant: 'destructive', title: 'Pick a creative', description: 'A new brand needs one to play.' }); return;
    }
    setBusy(true);
    try {
      const campaignId = picked
        ? picked.id
        : (await createCampaign({ name: name.trim(), slotContentId: contentId })).id;

      const res = await bulkAssignSlots({
        campaignId, storeIds: [store.id], from, to,
        daysOfWeek: store.openDays, slotsPerDay: plays,
      });

      // Book-what-fits is deliberate policy, so a partial result is a success with a
      // caveat — never a silent one. Saying "booked" while days were skipped is the
      // failure mode worth avoiding here.
      const shortDays = res.gaps?.length ?? 0;
      toast({
        title: `${picked?.brandName ?? name.trim()} booked`,
        description: shortDays > 0
          ? `${res.booked} plays booked · ${res.missed} short across ${shortDays} full store-day${shortDays === 1 ? '' : 's'}`
          : `${res.booked} plays booked across the next ${HORIZON_DAYS} days`,
      });
      onDone();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not book', description: (e as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-sm font-bold text-foreground">Add a brand to this loop</p>
          <p className="text-[11px] text-muted-foreground">{store.storeName} · books the next {HORIZON_DAYS} days</p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Existing brand</span>
          <select value={existing} onChange={(e) => setExisting(e.target.value)}
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none">
            <option value="">— New brand —</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.brandName}</option>)}
          </select>
        </label>

        {!picked && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Brand name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anand Sweets"
                className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none" />
              <span className="text-[10px] text-muted-foreground">
                Creates a bookable campaign directly — no onboarding funnel, no payment step.
              </span>
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Creative</span>
              <ContentPickerField content={library} value={contentId} onChange={setContentId} />
            </div>
          </>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Plays per day</span>
          <input value={perDay} inputMode="numeric"
            onChange={(e) => setPerDay(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-24 rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] tabular-nums text-foreground focus:border-primary focus:outline-none" />
          <span className="text-[10px] text-muted-foreground">
            {from} → {to}, on this store&apos;s open days.
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} disabled={busy}
            className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add to loop
          </button>
        </div>
      </div>
    </div>
  );
}
