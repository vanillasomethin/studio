'use client';

// Prospect locations — shops and spots ALIVE is considering, mapped for review.
//
// This exists because a Store cannot be used for the job: a Store with a pin is
// on the public marketing map the moment it is pinned, and a place nobody has
// signed with must not be advertised there. Prospects live in their own table
// that stays admin-only (see CLAUDE.md's Store map pin section for the one
// deliberate exception: a trimmed public read for /advertise's Potential pins).
//
// The map uses PINNING_BASEMAP (OSM), not the presentation basemap: you are
// placing and studying points against real buildings and landmarks, which is
// exactly what the CARTO style leaves out. Existing stores are drawn on the
// same map (same tier colours the homepage uses) so scouting reads against
// what's already covered, not in a vacuum — and the same dashed "areas
// covered" rings the homepage draws, built from the same shared helper.

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPinned, Trash2, Loader2, AlertCircle, Crosshair, Plus, Pencil, Check, Store as StoreIcon, Users } from 'lucide-react';
import { PINNING_BASEMAP } from '@/lib/map-tiles';
import { addLocalityBoundaries, LOCALITY_TIP_CSS } from '@/lib/locality-boundaries';
import { buildCoverageRings } from '@/lib/alive-map';
import { TIER, ONBOARDED, coreColor, shopPinHtml, DOT, SHOP_PIN_CSS, swatchStyle, type StoreTier } from '@/components/sections/store-locations-map';

const MANGALURU: [number, number] = [12.8698, 74.8431];

const STATUSES = ['scouting', 'contacted', 'negotiating', 'rejected', 'converted'] as const;
type Status = (typeof STATUSES)[number];

// Colour carries the stage so a glance at the map answers "where are we with
// this area?" without reading a single label.
const STATUS_COLOR: Record<Status, string> = {
  scouting:    '#64748b',
  contacted:   '#eab308',
  negotiating: '#3b82f6',
  rejected:    '#ef4444',
  converted:   '#16a34a',
};

type Prospect = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  locality: string | null;
  city: string | null;
  pincode: string | null;
  address: string | null;
  ownerName: string | null;
  phone: string | null;
  notes: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  requestCount: number;
};

type ProspectRequestRow = {
  id: string;
  brandName: string;
  contactPerson: string;
  phone: string;
  notes: string | null;
  createdAt: string;
};

/** Just what this map needs from /api/stores/locations — an existing store
 *  drawn for context, not for editing (that's Admin → Stores). */
type StorePin = {
  id: string;
  storeName: string;
  lat: number | null;
  lng: number | null;
  locality: string | null;
  city: string | null;
  pincode: string | null;
  status: 'live' | 'in_progress';
  tier: StoreTier;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const colorOf = (s: string) => STATUS_COLOR[(s as Status)] ?? STATUS_COLOR.scouting;

function pinHtml(p: Prospect, active: boolean) {
  const c = colorOf(p.status);
  return (
    `<div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center">` +
      `<div style="width:${active ? 18 : 14}px;height:${active ? 18 : 14}px;border-radius:50%;` +
      `background:${c};border:${active ? 3 : 2.5}px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>` +
    `</div>`
  );
}

/** Fields a prospect carries beyond label/lat/lng — shared by the "new
 *  location" draft form and each card's inline editor. */
type Details = { label: string; notes: string; ownerName: string; phone: string; address: string; pincode: string };
const EMPTY_DETAILS: Details = { label: '', notes: '', ownerName: '', phone: '', address: '', pincode: '' };

function DetailsFields({ v, onChange }: { v: Details; onChange: (v: Details) => void }) {
  return (
    <div className="space-y-1.5">
      <input
        autoFocus
        value={v.label}
        onChange={(e) => onChange({ ...v, label: e.target.value })}
        placeholder="Shop or spot name"
        className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
      />
      <div className="grid grid-cols-2 gap-1.5">
        <input
          value={v.ownerName}
          onChange={(e) => onChange({ ...v, ownerName: e.target.value })}
          placeholder="Owner name (optional)"
          className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
        />
        <input
          value={v.phone}
          onChange={(e) => onChange({ ...v, phone: e.target.value })}
          placeholder="Phone (optional)"
          className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
        />
      </div>
      <input
        value={v.address}
        onChange={(e) => onChange({ ...v, address: e.target.value })}
        placeholder="Address (optional)"
        className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
      />
      <input
        value={v.pincode}
        onChange={(e) => onChange({ ...v, pincode: e.target.value })}
        placeholder="Pincode (optional)"
        className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
      />
      <textarea
        value={v.notes}
        onChange={(e) => onChange({ ...v, notes: e.target.value })}
        placeholder="Footfall, what was said…"
        rows={2}
        className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
      />
    </div>
  );
}

export default function ProspectsTab() {
  const [rows,    setRows]    = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<'all' | Status>('all');
  const [selected, setSelected] = useState<string | null>(null);

  // The point the operator just clicked or opened "+ Add prospect" on, before
  // it is saved.
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [saving, setSaving] = useState(false);

  // Inline "edit this prospect" — id of the card currently open for editing.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDetails, setEditDetails] = useState<Details>(EMPTY_DETAILS);

  // Brand interest — which card's request list is expanded, and what it holds.
  const [requestsFor, setRequestsFor] = useState<string | null>(null);
  const [requests, setRequests] = useState<ProspectRequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Existing stores drawn for context — what's already covered, not editable here.
  const [stores, setStores] = useState<StorePin[]>([]);
  const [showStores, setShowStores] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [areas, setAreas] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storeMarkersRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zonesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const draftMarkerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/prospects');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as { prospects: Prospect[] };
      // A 200 without `prospects` (or carrying the wrong type) would land a
      // non-array in state, and the next rows.filter throws into the admin
      // error boundary — blanking the whole console, not just this panel.
      setRows(Array.isArray(d?.prospects) ? d.prospects : []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Existing stores, for context — public route, same one the homepage map uses.
  useEffect(() => {
    fetch('/api/stores/locations')
      .then((r) => (r.ok ? r.json() : { stores: [] }))
      .then((d: { stores?: StorePin[] }) => setStores(Array.isArray(d?.stores) ? d.stores.filter((s) => s.lat && s.lng) : []))
      .catch(() => {});
  }, []);

  // Pincode area polygons for the coverage rings — same static file the
  // homepage map reads.
  useEffect(() => {
    fetch('/geo/pincode-areas-mangaluru.json')
      .then((r) => (r.ok ? r.json() : null))
      .then(setAreas)
      .catch(() => {});
  }, []);

  // Mount the map once. Clicking anywhere drops a draft pin — that IS the
  // "add a location" gesture, alongside the "+ Add prospect" button below
  // (which drops one at the map's current centre, for when there's nothing
  // obvious to click yet).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      // Keeps its own basemap (see the note above) but not Leaflet's rAF tile
      // fade: a throttled renderer never runs the frame callback that walks a
      // tile up to opacity 1, so the prospects would float on white. Same
      // reason as createAliveMap — read the note at the top of
      // src/lib/alive-map.ts.
      const map = L.map(containerRef.current, {
        zoomControl: true, scrollWheelZoom: true, fadeAnimation: false,
      }).setView(MANGALURU, 13);
      L.tileLayer(PINNING_BASEMAP.url, {
        attribution: PINNING_BASEMAP.attribution, maxZoom: PINNING_BASEMAP.maxZoom,
      }).addTo(map);
      // Same locality hairlines every other ALIVE map draws — decoupled from
      // which basemap tiles are under it.
      void addLocalityBoundaries(L, map, () => mapRef.current === map);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on('click', (e: any) => {
        setDraft({ lat: e.latlng.lat, lng: e.latlng.lng });
        setDetails(EMPTY_DETAILS);
        setSelected(null);
      });
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      storeMarkersRef.current.clear();
      zonesRef.current = null;
    };
  }, []);

  // Rebuild prospect markers whenever the rows, the filter or the selection change.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      for (const m of markersRef.current.values()) m.remove();
      markersRef.current.clear();

      for (const p of rows) {
        if (filter !== 'all' && p.status !== filter) continue;
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ html: pinHtml(p, selected === p.id), className: '', iconSize: [26, 26], iconAnchor: [13, 13] }),
          title: p.label,
        }).addTo(mapRef.current);
        marker.bindTooltip(
          `<strong>${esc(p.label)}</strong>` +
          (p.locality ? `<br/><span style="opacity:.75">${esc(p.locality)}</span>` : '') +
          `<br/><span style="opacity:.6;text-transform:capitalize">${esc(p.status)}</span>`,
          { direction: 'top', offset: [0, -12] },
        );
        marker.on('click', () => { setSelected(p.id); setDraft(null); setEditingId(null); });
        markersRef.current.set(p.id, marker);
      }
    })();
    return () => { cancelled = true; };
  }, [rows, filter, selected, mapReady]);

  // Existing stores — small tier-coloured dots, same palette as the homepage
  // map, drawn for context only (no click action; Admin → Stores is where you
  // edit one). Toggled off entirely via showStores.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      for (const m of storeMarkersRef.current.values()) m.remove();
      storeMarkersRef.current.clear();
      if (!showStores) return;

      for (const s of stores) {
        if (s.lat == null || s.lng == null) continue;
        const marker = L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: '', html: shopPinHtml(coreColor(s.status, s.tier), false),
            iconSize: [DOT, DOT], iconAnchor: [DOT / 2, DOT / 2],
          }),
          title: `${s.storeName} — existing store`,
          interactive: false,
        }).addTo(mapRef.current);
        storeMarkersRef.current.set(s.id, marker);
      }
    })();
    return () => { cancelled = true; };
  }, [stores, showStores, mapReady]);

  // "Areas covered" — the same dashed pincode rings the homepage draws, built
  // from where ALIVE already has real stores (not prospects — a scouted spot
  // isn't "covered" yet).
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      if (zonesRef.current) { zonesRef.current.remove(); zonesRef.current = null; }
      if (!showStores) return; // rings answer "what does the store layer cover" — hide with it
      const points = stores.filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({ lat: s.lat as number, lng: s.lng as number, pincode: s.pincode }));
      const zones = buildCoverageRings(L, areas, points);
      if (zones) { zones.addTo(mapRef.current); zonesRef.current = zones; }
    })();
    return () => { cancelled = true; };
  }, [stores, areas, showStores, mapReady]);

  // The unsaved point, shown as a hollow ring so it reads as "not committed".
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      if (draftMarkerRef.current) { draftMarkerRef.current.remove(); draftMarkerRef.current = null; }
      if (!draft) return;
      draftMarkerRef.current = L.marker([draft.lat, draft.lng], {
        icon: L.divIcon({
          html: '<div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center">'
              + '<div style="width:16px;height:16px;border-radius:50%;background:#fff;border:3px dashed #dc2626"></div></div>',
          className: '', iconSize: [26, 26], iconAnchor: [13, 13],
        }),
      }).addTo(mapRef.current);
    })();
    return () => { cancelled = true; };
  }, [draft, mapReady]);

  const addAtCentre = () => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    setSelected(null);
    setEditingId(null);
    setDetails(EMPTY_DETAILS);
    setDraft({ lat: c.lat, lng: c.lng });
  };

  const save = async () => {
    if (!draft || !details.label.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: details.label.trim(), lat: draft.lat, lng: draft.lng,
          notes: details.notes.trim() || null,
          ownerName: details.ownerName.trim() || null,
          phone: details.phone.trim() || null,
          address: details.address.trim() || null,
          pincode: details.pincode.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDraft(null); setDetails(EMPTY_DETAILS);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: Prospect) => {
    setEditingId(p.id);
    setEditDetails({
      label: p.label, notes: p.notes ?? '', ownerName: p.ownerName ?? '',
      phone: p.phone ?? '', address: p.address ?? '', pincode: p.pincode ?? '',
    });
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/prospects', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, label: editDetails.label.trim(),
          notes: editDetails.notes.trim() || null,
          ownerName: editDetails.ownerName.trim() || null,
          phone: editDetails.phone.trim() || null,
          address: editDetails.address.trim() || null,
          pincode: editDetails.pincode.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEditingId(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id: string, status: Status) => {
    await fetch('/api/admin/prospects', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    }).catch(() => {});
    await load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/admin/prospects?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    if (selected === id) setSelected(null);
    if (editingId === id) setEditingId(null);
    await load();
  };

  const toggleRequests = async (id: string) => {
    if (requestsFor === id) { setRequestsFor(null); return; }
    setRequestsFor(id);
    setRequestsLoading(true);
    try {
      const res = await fetch(`/api/admin/prospects/requests?prospectId=${encodeURIComponent(id)}`);
      const d = await res.json() as { requests?: ProspectRequestRow[] };
      setRequests(Array.isArray(d?.requests) ? d.requests : []);
    } catch {
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  };

  const shown = rows.filter((r) => filter === 'all' || r.status === filter);
  const countBy = (s: Status) => rows.filter((r) => r.status === s).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Prospect locations</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Places worth approaching. Non-rejected, non-converted ones also show as a greyed
            "Potential" pin on /advertise, where a brand can ask ALIVE to onboard it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={addAtCentre}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add prospect
          </button>
          <button
            onClick={() => setShowStores((v) => !v)}
            title={showStores ? 'Hide existing stores + coverage' : 'Show existing stores + coverage'}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
              showStores ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <StoreIcon className="h-3.5 w-3.5" /> {stores.length} store{stores.length !== 1 ? 's' : ''}
          </button>
          <div className="flex flex-wrap items-center gap-1">
            {(['all', ...STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                  filter === s ? 'border-primary/50 bg-primary/10 text-primary'
                               : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'all' ? `All (${rows.length})` : `${s} (${countBy(s)})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-2">
          <div className="overflow-hidden rounded-xl border border-border">
            <div ref={containerRef} className="h-[520px] w-full" />
          </div>
          {/* Two legends: what a store pin's colour means, and what a prospect's means. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-border bg-card px-3 py-2">
            {showStores && (
              <div className="flex flex-wrap items-center gap-2">
                {[...(Object.keys(TIER) as StoreTier[]).map((t) => [TIER[t].label, TIER[t].color] as const), ['Onboarded', ONBOARDED] as const].map(([label, color]) => (
                  <span key={label} className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span style={swatchStyle(color, 8)} /> {label}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {STATUSES.map((s) => (
                <span key={s} className="flex items-center gap-1 text-[9px] font-semibold capitalize text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: colorOf(s) }} /> {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* The add/edit form appears once a point exists — via a map click or
              "+ Add prospect" — so the coordinates can never be typed wrong. */}
          {draft ? (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
                <Crosshair className="h-3.5 w-3.5 text-primary" /> New location
                <span className="ml-auto font-mono font-normal text-muted-foreground">
                  {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground">Click elsewhere on the map to move this point.</p>
              <DetailsFields v={details} onChange={setDetails} />
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={saving || !details.label.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPinned className="h-3 w-3" />} Save
                </button>
                <button
                  onClick={() => { setDraft(null); setDetails(EMPTY_DETAILS); }}
                  className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/10 p-3 text-center">
              <MapPinned className="mx-auto h-5 w-5 text-muted-foreground/40" />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Click "Add prospect" above, or click anywhere on the map, to drop a location.
              </p>
            </div>
          )}

          <div className="max-h-[600px] space-y-2 overflow-y-auto">
            {loading && rows.length === 0 && (
              <p className="text-[11px] text-muted-foreground">Loading…</p>
            )}
            {!loading && shown.length === 0 && (
              <p className="text-[11px] text-muted-foreground">Nothing here yet.</p>
            )}
            {shown.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl border bg-card p-3 transition-colors ${
                  selected === p.id ? 'border-primary/50' : 'border-border hover:border-primary/30'
                }`}
              >
                {editingId === p.id ? (
                  <div className="space-y-2">
                    <DetailsFields v={editDetails} onChange={setEditDetails} />
                    <div className="flex gap-2">
                      <button
                        onClick={() => void saveEdit(p.id)}
                        disabled={saving || !editDetails.label.trim()}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" /> Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => { setSelected(p.id); mapRef.current?.panTo([p.lat, p.lng]); }}
                      className="flex cursor-pointer items-start gap-2"
                    >
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(p.status) }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-foreground">{p.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {[p.address, p.locality ?? p.city].filter(Boolean).join(' · ') || `${(p.lat ?? 0).toFixed(4)}, ${(p.lng ?? 0).toFixed(4)}`}
                          {p.pincode && ` · ${p.pincode}`}
                          {p.createdBy && ` · ${p.createdBy}`}
                        </p>
                        {(p.ownerName || p.phone) && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {[p.ownerName, p.phone].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {p.notes && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{p.notes}</p>}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                        title="Edit details"
                        className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-primary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); void remove(p.id); }}
                        title="Delete"
                        className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={(e) => { e.stopPropagation(); void setStatus(p.id, s); }}
                          className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold capitalize transition-colors ${
                            p.status === s ? 'border-transparent text-white' : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                          style={p.status === s ? { background: colorOf(s) } : undefined}
                        >
                          {s}
                        </button>
                      ))}
                      {p.status !== 'rejected' && p.status !== 'converted' && p.requestCount > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); void toggleRequests(p.id); }}
                          className="ml-auto flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary"
                          title="Brands who asked us to onboard this"
                        >
                          <Users className="h-2.5 w-2.5" /> {p.requestCount} brand{p.requestCount !== 1 ? 's' : ''} asked
                        </button>
                      )}
                    </div>
                    {requestsFor === p.id && (
                      <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
                        {requestsLoading ? (
                          <p className="text-[10px] text-muted-foreground">Loading…</p>
                        ) : requests.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground">No requests yet.</p>
                        ) : requests.map((r) => (
                          <div key={r.id} className="rounded-lg bg-muted/30 px-2 py-1.5">
                            <p className="text-[10px] font-semibold text-foreground">{r.brandName} <span className="font-normal text-muted-foreground">· {r.contactPerson} · {r.phone}</span></p>
                            {r.notes && <p className="mt-0.5 text-[10px] text-muted-foreground">{r.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`${LOCALITY_TIP_CSS}${SHOP_PIN_CSS}`}</style>
    </div>
  );
}
