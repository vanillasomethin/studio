'use client';

// Prospect locations — shops and spots ALIVE is considering, mapped for review.
//
// This exists because a Store cannot be used for the job: a Store with a pin is
// on the public marketing map the moment it is pinned, and a place nobody has
// signed with must not be advertised there. Prospects live in their own table
// that no public route reads.
//
// The map uses PINNING_BASEMAP (OSM), not the presentation basemap: you are
// placing and studying points against real buildings and landmarks, which is
// exactly what the CARTO style leaves out.

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPinned, Trash2, Loader2, AlertCircle, Crosshair } from 'lucide-react';
import { PINNING_BASEMAP } from '@/lib/map-tiles';

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
  notes: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
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

export default function ProspectsTab() {
  const [rows,    setRows]    = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<'all' | Status>('all');
  const [selected, setSelected] = useState<string | null>(null);

  // The point the operator just clicked, before it is saved.
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const draftMarkerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/prospects');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as { prospects: Prospect[] };
      setRows(d.prospects);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Mount the map once. Clicking anywhere drops a draft pin — that IS the
  // "add a location" gesture; there is no separate lat/lng form to mistype.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true }).setView(MANGALURU, 13);
      L.tileLayer(PINNING_BASEMAP.url, {
        attribution: PINNING_BASEMAP.attribution, maxZoom: PINNING_BASEMAP.maxZoom,
      }).addTo(map);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on('click', (e: any) => {
        setDraft({ lat: e.latlng.lat, lng: e.latlng.lng });
        setSelected(null);
      });
      mapRef.current = map;
      setMapReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Rebuild markers whenever the rows, the filter or the selection change.
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
        marker.on('click', () => { setSelected(p.id); setDraft(null); });
        markersRef.current.set(p.id, marker);
      }
    })();
    return () => { cancelled = true; };
  }, [rows, filter, selected, mapReady]);

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

  const save = async () => {
    if (!draft || !label.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), lat: draft.lat, lng: draft.lng, notes: notes.trim() || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDraft(null); setLabel(''); setNotes('');
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
    await load();
  };

  const shown = rows.filter((r) => filter === 'all' || r.status === filter);
  const countBy = (s: Status) => rows.filter((r) => r.status === s).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">Prospect locations</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Places worth approaching. Click the map to drop one. These are never shown on the public site —
            a store only appears there once it is a real partner with a pin.
          </p>
        </div>
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

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border">
          <div ref={containerRef} className="h-[520px] w-full" />
        </div>

        <div className="space-y-3">
          {/* The click-to-add form appears only once a point exists, so the
              coordinates can never be typed wrong. */}
          {draft ? (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
                <Crosshair className="h-3.5 w-3.5 text-primary" /> New location
                <span className="ml-auto font-mono font-normal text-muted-foreground">
                  {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                </span>
              </p>
              <input
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
                placeholder="Shop or spot name"
                className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Footfall, owner, what was said…"
                rows={2}
                className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
              />
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={saving || !label.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPinned className="h-3 w-3" />} Save
                </button>
                <button
                  onClick={() => { setDraft(null); setLabel(''); setNotes(''); }}
                  className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/10 p-3 text-center">
              <MapPinned className="mx-auto h-5 w-5 text-muted-foreground/40" />
              <p className="mt-1.5 text-[11px] text-muted-foreground">Click anywhere on the map to add a location.</p>
            </div>
          )}

          <div className="max-h-[400px] space-y-2 overflow-y-auto">
            {loading && rows.length === 0 && (
              <p className="text-[11px] text-muted-foreground">Loading…</p>
            )}
            {!loading && shown.length === 0 && (
              <p className="text-[11px] text-muted-foreground">Nothing here yet.</p>
            )}
            {shown.map((p) => (
              <div
                key={p.id}
                onClick={() => { setSelected(p.id); mapRef.current?.panTo([p.lat, p.lng]); }}
                className={`cursor-pointer rounded-xl border bg-card p-3 transition-colors ${
                  selected === p.id ? 'border-primary/50' : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(p.status) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{p.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.locality ?? p.city ?? `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}
                      {p.createdBy && ` · ${p.createdBy}`}
                    </p>
                    {p.notes && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{p.notes}</p>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); void remove(p.id); }}
                    title="Delete"
                    className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
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
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
