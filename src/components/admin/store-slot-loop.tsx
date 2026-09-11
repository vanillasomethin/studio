'use client';

// One screen for everything a store's ad loop needs: its settings, who is playing in
// it, and what actually plays position by position.
//
// This replaces a five-surface procedure (brand onboarding funnel → Content tab →
// Playlists tab → booking wizard → a separate settings modal). Loop settings are
// edited inline rather than behind a modal, and "Add brand" creates the campaign,
// attaches the creative and starts it playing in one submit.
//
// Deliberately self-contained: it takes a store and a campaign list as props and owns
// nothing else, so it can be mounted anywhere a store is in scope.
//
// "Add brand" writes a SlotPlan — one standing row that runs until stopped — rather
// than materialising dated SlotBooking rows over a horizon. The roster therefore
// shows two lanes: dated bookings (sold, guaranteed, expire on their own) and
// standing assignments (best-effort, never expire, never block a sale).

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Loader2, Pause, Play, Plus, Settings2, Trash2, Tv2 } from 'lucide-react';
import {
  getSlotBookings, createCampaign, updateSlotSettings, getContent, getBrands,
  getSlotPlans, createSlotPlan, createSlotPlans, updateSlotPlan, deleteSlotPlan,
  type SlotStore, type SlotBookingRow, type SlotLoopEntry, type SlotPlanRow, type AdminBrand,
  type Content,
} from '@/lib/backend-api';
import { ContentPickerField } from './content-picker';
import { toast } from '@/hooks/use-toast';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const istTodayStr = () =>
  new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

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
  /** Null = booked before advertisers were first-class rows, so its brand name is
   *  only free text on the campaign. */
  brandId?: string | null;
  slotContentId: string | null;
  slotPlaylist: { id: string; name: string; mediaItems: number } | null;
  slotSpan?: number | null;
};

export default function StoreSlotLoop({
  store, campaigns, allStores = [], onBack, onChanged, onReloadCampaigns,
}: {
  store: SlotStore;
  campaigns: CampaignLike[];
  /** Every slot-mode store, so one brand can be rolled out across screens from
   *  here. Defaults to empty: the panel is usable with just the store it is on. */
  allStores?: SlotStore[];
  onBack: () => void;
  /** Availability changed — the caller's grid is now stale. */
  onChanged: () => void;
  onReloadCampaigns: () => void;
}) {
  const [date]        = useState(istTodayStr());
  const [bookings,    setBookings]    = useState<SlotBookingRow[]>([]);
  const [plans,       setPlans]       = useState<SlotPlanRow[]>([]);
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
    // Standing assignments are a separate read: they have no per-date rows, so the
    // bookings endpoint cannot report them. A brand on a plan would otherwise play
    // in the loop below while being absent from "who's playing" above it.
    //
    // Unfiltered on purpose — the roster then also knows how many OTHER screens each
    // standing brand runs on, which is the whole point of a plan. The network is a
    // few dozen stores and a plan is one row per store+brand, so this is small.
    Promise.all([
      getSlotBookings(store.id, date),
      getSlotPlans().catch(() => [] as SlotPlanRow[]),
    ])
      .then(([r, p]) => {
        setBookings(Array.isArray(r.bookings) ? r.bookings : []);
        setLoop(Array.isArray(r.playableLoop) ? r.playableLoop : []);
        setLoopCount(r.loopSlotCount ?? 0);
        setPlans(p);
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

  // Who is playing, across BOTH lanes — dated bookings and standing assignments.
  //
  // Dated rows are counted in PLAYS (a 30s ad booked twice is 2 plays over 6
  // positions), which is the unit the booking form asks for. A standing row states
  // its own target rate; it has no per-date rows to count, and what it actually
  // gets today depends on what is left after the sold bookings above it.
  type RosterRow = {
    key: string;
    campaignId: string;
    name: string;
    plays: number;
    detail: string;
    lane: 'dated' | 'standing';
    meta: string;
    planId?: string;
    inactive?: boolean;
  };

  const roster: RosterRow[] = (() => {
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

    const dated: RosterRow[] = [...byCampaign.values()]
      .sort((a, b) => b.positions - a.positions)
      .map((r) => {
        const c = campaignById.get(r.campaignId);
        const span = c?.slotSpan ?? 1;
        return {
          key: `booking:${r.campaignId}`,
          campaignId: r.campaignId,
          name: r.name,
          plays: r.plays,
          detail: span > 1 ? `${span * 10}s · ${span} slots per play` : '10s',
          lane: 'dated' as const,
          meta: `${r.positions} slot${r.positions === 1 ? '' : 's'} today`,
        };
      });

    // A campaign can hold both a dated booking and a standing plan here; they are
    // separate commitments and each gets its own row rather than being merged into
    // a single misleading number.
    const standing: RosterRow[] = plans
      .filter((p) => p.storeId === store.id)
      .sort((a, b) => b.slotsPerDay - a.slotsPerDay)
      .map((p) => {
        // How many OTHER screens this brand's standing assignment covers. A plan is
        // one row per store, so a brand is only "network-wide" if it has a row on
        // each — showing the count here is what makes a gap visible at all.
        const elsewhere = plans.filter((q) => q.campaignId === p.campaignId && q.storeId !== store.id).length;
        return {
          key: `plan:${p.id}`,
          campaignId: p.campaignId,
          name: p.brandName,
          plays: p.slotsPerDay,
          detail: p.active ? 'Standing — runs until stopped' : 'Paused',
          lane: 'standing' as const,
          meta: elsewhere > 0
            ? `+${elsewhere} more screen${elsewhere === 1 ? '' : 's'}`
            : (p.endDate ? `until ${p.endDate}` : 'here only'),
          planId: p.id,
          inactive: !p.active,
        };
      });

    return [...dated, ...standing];
  })();

  const housePositions = cells.filter((c) => c?.source === 'house').length;
  const sel = selected == null ? null : cells[selected];

  const removeRow = async (row: RosterRow) => {
    if (row.lane === 'standing') {
      if (!confirm(`Stop ${row.name} playing at ${store.storeName}? This ends the standing assignment.`)) return;
      try {
        await deleteSlotPlan(row.planId!);
        toast({ title: `${row.name} stopped` });
        load(); onChanged();
      } catch (e) {
        toast({ variant: 'destructive', title: 'Could not stop it', description: (e as Error).message });
      }
      return;
    }
    if (!confirm(`Remove ${row.name} from today's loop at ${store.storeName}?`)) return;
    const ids = bookings.filter((b) => b.campaignId === row.campaignId).map((b) => b.id);
    try {
      // Deleting any row of a placement removes the whole placement server-side, so
      // duplicate ids in one span are expected to 404 — tolerate that rather than
      // reporting a failure for work that actually succeeded.
      await Promise.allSettled(ids.map((id) => fetch(`/api/slots/bookings?id=${id}`, { method: 'DELETE' })));
      toast({ title: `${row.name} removed from today` });
      load(); onChanged();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Remove failed', description: (e as Error).message });
    }
  };

  const togglePlan = async (row: RosterRow) => {
    try {
      await updateSlotPlan({ id: row.planId!, active: !!row.inactive });
      toast({ title: row.inactive ? `${row.name} resumed` : `${row.name} paused` });
      load(); onChanged();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not change it', description: (e as Error).message });
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
              return (
                <div key={r.key} className={`flex items-center gap-3 border-b border-border/60 bg-card px-3 py-2 last:border-0 ${r.inactive ? 'opacity-55' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-foreground">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.detail}
                      {c?.slotPlaylist ? ` · ${c.slotPlaylist.mediaItems} creatives rotating` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    r.lane === 'standing'
                      ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-700'
                      : 'border-border text-muted-foreground'
                  }`}>
                    {r.lane === 'standing' ? 'Standing' : 'Dated'}
                  </span>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-bold tabular-nums text-foreground">{r.plays} / day</p>
                    <p className="text-[9px] text-muted-foreground tabular-nums">{r.meta}</p>
                  </div>
                  {r.lane === 'standing' && (
                    <button onClick={() => togglePlan(r)} title={r.inactive ? 'Resume' : 'Pause — keeps the row and its history'}
                      className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                      {r.inactive ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                    </button>
                  )}
                  <button onClick={() => removeRow(r)}
                    title={r.lane === 'standing' ? 'Stop this standing assignment' : 'Remove from today'}
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
          allStores={allStores}
          onClose={() => setAddOpen(false)}
          onDone={() => { setAddOpen(false); load(); onChanged(); onReloadCampaigns(); }}
        />
      )}
    </div>
  );
}

/** Create-or-pick a brand, attach a creative, put it on one or many screens — one
 *  submit. The whole point of the screen: no onboarding funnel, no separate wizard.
 *
 *  The picker is BRAND-first, not campaign-first. A brand is the advertiser; a
 *  campaign is one booking of it. Picking the advertiser lets the creative list
 *  narrow to what that advertiser already plays, which is what makes adding the
 *  same brand to a second screen quicker than the first instead of identical to it.
 *  Campaigns with no brand attached stay reachable in their own group so nothing
 *  booked before brands existed becomes unselectable. */
function AddBrandDialog({ store, campaigns, allStores, onClose, onDone }: {
  store: SlotStore;
  campaigns: CampaignLike[];
  allStores: SlotStore[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name,      setName]      = useState('');
  // 'brand:<id>' | 'campaign:<id>' | '' for a new advertiser.
  const [existing,  setExisting]  = useState<string>('');
  // Typed as the full Content row, not ContentLike, because the brand filter below
  // needs brandId — the column Phase 1 added and nothing on this screen used yet.
  const [library,   setLibrary]   = useState<Content[]>([]);
  const [brands,    setBrands]    = useState<AdminBrand[]>([]);
  const [contentId, setContentId] = useState<string | null>(null);
  const [perDay,    setPerDay]    = useState('2');
  const [showAll,   setShowAll]   = useState(false);
  const [extraStores, setExtraStores] = useState<string[]>([]);
  const [busy,      setBusy]      = useState(false);

  // The creative library and the brand list, only needed once this dialog is open —
  // the slots tab itself never lists either, so loading them here keeps the tab's
  // cost unchanged. Both degrade to empty rather than blocking the form.
  useEffect(() => {
    getContent()
      .then((r) => setLibrary(Array.isArray(r.content) ? r.content : []))
      .catch(() => setLibrary([]));
    getBrands().then(setBrands).catch(() => setBrands([]));
  }, []);

  const brand = existing.startsWith('brand:')
    ? brands.find((b) => b.id === existing.slice(6)) ?? null : null;
  const picked = existing.startsWith('campaign:')
    ? campaigns.find((c) => c.id === existing.slice(9)) ?? null : null;
  const chosenName = brand?.brandName ?? picked?.brandName ?? name.trim();

  // A campaign that already points at a Brand is reachable through the Brands group
  // above; listing it twice would let the same advertiser be picked two ways.
  const unbranded = campaigns.filter((c) => c.brandId == null);

  // Narrow the library to the selected advertiser's own creatives. `showAll` is the
  // escape hatch — a brand's first booking, or a shared asset, is not tagged yet.
  const owned = brand ? library.filter((c) => c.brandId === brand.id) : [];
  const visible = !showAll && owned.length > 0 ? owned : library;

  // Other slot-mode screens this brand could go on in the same submit. The current
  // store is always included and is not listed — it is not an option to opt out of.
  const otherStores = allStores.filter((s) => s.id !== store.id && s.loopSlotCount != null);
  const toggleStore = (id: string) =>
    setExtraStores((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  // A brand already has a campaign only if it has been booked before; its first
  // booking still needs one created. A campaign picked directly is its own answer.
  const needsCampaign = !picked && !brand?.campaignId;

  const submit = async () => {
    const plays = Number(perDay);
    if (!Number.isFinite(plays) || plays < 1) {
      toast({ variant: 'destructive', title: 'Slots per day must be at least 1' }); return;
    }
    if (!picked && !brand && !name.trim()) {
      toast({ variant: 'destructive', title: 'Enter a brand name' }); return;
    }
    if (needsCampaign && !contentId) {
      toast({ variant: 'destructive', title: 'Pick a creative', description: 'A brand needs one to play.' }); return;
    }
    setBusy(true);
    try {
      const campaignId = picked?.id ?? brand?.campaignId ?? (await createCampaign({
        name: chosenName,
        // brandId when the advertiser is known, brandName to find-or-create one.
        // Either way the campaign ends up owned, so the Content tab and the next
        // store's picker can both see it.
        ...(brand ? { brandId: brand.id } : { brandName: chosenName }),
        slotContentId: contentId,
        // Claim the creative for this advertiser — ignored server-side if it already
        // has an owner, so a shared asset is never quietly reassigned.
        tagCreative: true,
      })).id;

      // One row per store that runs until stopped, instead of 60 days of dated
      // bookings per store. This is the seam the screen was built around: the form
      // did not change, the write behind it did. A standing assignment cannot expire
      // unnoticed and never consumes sellable inventory, so it needs no horizon —
      // which is also what makes putting one brand on twelve screens a loop rather
      // than a scheduling problem.
      const storeIds = [store.id, ...extraStores];
      if (storeIds.length === 1) {
        // Single store keeps the precise API errors ("not in slot mode", "cancelled").
        const plan = await createSlotPlan({ storeId: store.id, campaignId, slotsPerDay: plays });
        toast({
          title: `${chosenName} added`,
          description: `${plan.slotsPerDay} play${plan.slotsPerDay === 1 ? '' : 's'} a day, every day, until you stop it.`,
        });
      } else {
        const { plans, skipped } = await createSlotPlans({ storeIds, campaignId, slotsPerDay: plays });
        toast({
          title: `${chosenName} added to ${plans.length} screen${plans.length === 1 ? '' : 's'}`,
          description: skipped.length
            // Name the gap rather than reporting a clean success — the admin needs to
            // know which screens did NOT get the brand, and re-running fills them.
            ? `${plays} a day on each. Skipped ${skipped.map((s) => s.storeName ?? s.storeId).join(', ')}.`
            : `${plays} play${plays === 1 ? '' : 's'} a day on each, until you stop it.`,
        });
      }
      onDone();
    } catch (e) {
      // The API refuses a longer-than-10s creative here, because a plan fills one
      // scattered position at a time. Pass that message through rather than a
      // generic failure — it tells the admin to use a dated booking instead.
      toast({ variant: 'destructive', title: 'Could not add the brand', description: (e as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-sm font-bold text-foreground">Add a brand to this loop</p>
          <p className="text-[11px] text-muted-foreground">{store.storeName} · runs every day until you stop it</p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Brand</span>
          <select value={existing} onChange={(e) => { setExisting(e.target.value); setShowAll(false); }}
            className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none">
            <option value="">— New brand —</option>
            {brands.length > 0 && (
              <optgroup label="Brands">
                {brands.map((b) => (
                  <option key={b.id} value={`brand:${b.id}`}>
                    {b.brandName}{b.creativeCount ? ` · ${b.creativeCount} creative${b.creativeCount === 1 ? '' : 's'}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {/* Bookings made before advertisers were first-class rows. Kept reachable
                so nothing already running becomes unselectable here. */}
            {unbranded.length > 0 && (
              <optgroup label="Campaigns without a brand">
                {unbranded.map((c) => <option key={c.id} value={`campaign:${c.id}`}>{c.brandName}</option>)}
              </optgroup>
            )}
          </select>
        </label>

        {!picked && !brand && (
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Brand name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anand Sweets"
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none" />
            <span className="text-[10px] text-muted-foreground">
              Creates the advertiser and a bookable campaign — no onboarding funnel, no
              payment step. An existing name is reused rather than duplicated.
            </span>
          </label>
        )}

        {needsCampaign && (
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Creative</span>
              {owned.length > 0 && (
                <button type="button" onClick={() => setShowAll((v) => !v)}
                  className="text-[10px] font-semibold text-primary hover:underline">
                  {showAll ? `Just ${brand!.brandName}’s` : 'Show all creatives'}
                </button>
              )}
            </div>
            <ContentPickerField content={visible} value={contentId} onChange={setContentId} />
            <span className="text-[10px] text-muted-foreground">
              {owned.length > 0 && !showAll
                ? `Showing the ${owned.length} creative${owned.length === 1 ? '' : 's'} already tagged to this brand.`
                : 'An untagged creative becomes this brand’s, so it is one click next time.'}
            </span>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Plays per day</span>
          <input value={perDay} inputMode="numeric"
            onChange={(e) => setPerDay(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-24 rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] tabular-nums text-foreground focus:border-primary focus:outline-none" />
          <span className="text-[10px] text-muted-foreground">
            A target, not a guarantee — a standing assignment takes the positions left
            after that day&apos;s sold bookings, so it never blocks a sale.
          </span>
        </label>

        {/* One brand across many screens. A standing assignment is one row per store
            with no dated inventory behind it, so rolling out to the whole network is
            the same act as adding it here — repeated. */}
        {otherStores.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Also add to</span>
              <button type="button"
                onClick={() => setExtraStores(extraStores.length === otherStores.length ? [] : otherStores.map((s) => s.id))}
                className="text-[10px] font-semibold text-primary hover:underline">
                {extraStores.length === otherStores.length ? 'None' : `All ${otherStores.length}`}
              </button>
            </div>
            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
              {otherStores.map((s) => {
                const on = extraStores.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggleStore(s.id)} aria-pressed={on}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                      on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
                    }`}>
                    {s.storeName}
                  </button>
                );
              })}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {extraStores.length === 0
                ? `${store.storeName} only.`
                : `${store.storeName} and ${extraStores.length} more — same rate on each.`}
            </span>
          </div>
        )}

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
