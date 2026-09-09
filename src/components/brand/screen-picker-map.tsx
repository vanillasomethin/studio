'use client';

// Onboarding map picker: store screens on a Leaflet map, click to select —
// live ones are bookable, the rest are "Coming soon" so a brand can see where
// the network is heading. The pins ARE the homepage network map's marks
// (shopPinHtml: tier-coloured core, white gap, hairline red rim; grey core
// until live) so a brand lands here from that map and reads the same network —
// this file only adds the picker states on top: a check disc when a store is
// picked, a dimmed mark when it is sold out. Selection is a routing hint for
// ops (Campaign.preferredStoreIds), not a hard slot reservation — copy in
// the parent explains that. Leaflet is dynamically
// imported (no react-leaflet — React 19 only) and its CSS ships globally.
//
// Lifecycle rules learned the hard way:
// - The map mounts once; MARKERS are torn down and rebuilt whenever pins change
//   (a startDate refetch changes slotStatus), so click guards and tooltips can
//   never act on stale availability.
// - Store names/localities are partner-entered strings — always HTML-escaped
//   before they touch tooltip markup (stored-XSS on a public payment page
//   otherwise).
// - Errors never unmount the container: a mounted Leaflet map whose DOM node
//   vanishes can't re-init. We overlay a notice instead.

import { useEffect, useRef, useState } from 'react';
import { ALIVE_MAP_CSS, createAliveMap, fitToPins } from '@/lib/alive-map';
import { LOCALITY_TIP_CSS } from '@/lib/locality-boundaries';
import { coreColor, SHOP_PIN_CSS, shopPinHtml, swatchStyle, TIER } from '@/components/sections/store-locations-map';
import type { SlotTier } from '@/lib/slot-pricing';
import { X } from 'lucide-react';

const MANGALURU: [number, number] = [12.8698, 74.8431];

type ScreenPin = {
  id: string;
  storeName: string;
  locality: string | null;
  city: string | null;
  lat: number;
  lng: number;
  live: boolean;                  // playing today; false = onboarded, screen not up yet
  slotStatus: 'available' | 'limited' | 'sold_out' | null;
  tier?: SlotTier;                // absent on a stale API during deploy → standard
};

const STATUS_LABEL: Record<string, string> = {
  available: 'Slots open',
  limited:   'Few slots left',
  sold_out:  'Sold out',
  none:      'Available',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// The homepage mark, centred in a 36px box (touch minimum) so the visual can
// stay small without shrinking the hit target. Picker states ride on top:
// picked = is-active scale + a red check disc, sold out = dimmed. Slot
// availability stays in the tooltip and the tier directory below — the core's
// colour is the store's tier, exactly like the homepage.
function markerHtml(pin: ScreenPin, selected: boolean) {
  const dim  = !selected && pin.live && pin.slotStatus === 'sold_out';
  const mark = shopPinHtml(coreColor(pin.live ? 'live' : 'in_progress', pin.tier), selected);
  const check = selected
    ? `<div style="position:absolute;top:-6px;right:-6px;width:14px;height:14px;border-radius:50%;background:#dc2626;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;pointer-events:none">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>`
    : '';
  return (
    `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center${dim ? ';opacity:.55' : ''}">` +
      `<div style="position:relative">${mark}${check}</div>` +
    `</div>`
  );
}

function statusLabel(pin: ScreenPin) {
  return pin.live ? STATUS_LABEL[pin.slotStatus ?? 'none'] : 'Coming soon';
}

function tierLabel(pin: ScreenPin) {
  return TIER[pin.tier ?? 'standard'].label;
}

function tooltipHtml(pin: ScreenPin) {
  const status = pin.live
    ? `${tierLabel(pin)} · ${statusLabel(pin)}`
    : 'Coming soon — not bookable yet';
  return `<strong>${esc(pin.storeName)}</strong><br/>${esc(pin.locality ?? pin.city ?? '')} · ${status}`;
}

export default function ScreenPickerMap({
  selected, onToggle, startDate,
}: {
  selected: string[];
  onToggle: (id: string, storeName: string) => void;
  startDate: string;              // YYYY-MM-DD — availability is shown for this date
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  // The map is framed on the pins once; see the marker effect.
  const framedRef = useRef(false);
  const [pins, setPins]       = useState<ScreenPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  // Refs so marker handlers always see current state without rebinding.
  const pinsRef = useRef<Map<string, ScreenPin>>(new Map());
  pinsRef.current = new Map(pins.map((p) => [p.id, p]));
  const selectedRef = useRef<string[]>(selected);
  selectedRef.current = selected;
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(`/api/brand/screens?date=${encodeURIComponent(startDate)}`)
      .then((r) => r.ok ? (r.json() as Promise<{ screens: ScreenPin[] }>) : Promise.reject(new Error()))
      .then((d) => { if (live) { setPins(d.screens); setError(false); } })
      .catch(() => { if (live) setError(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [startDate]);

  // Mount the map once when the first pins arrive; REBUILD markers on every
  // pins change so handlers/tooltips always reflect the fetched date.
  useEffect(() => {
    if (!containerRef.current || pins.length === 0) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        const center: [number, number] = [
          pins.reduce((s, p) => s + p.lat, 0) / pins.length,
          pins.reduce((s, p) => s + p.lng, 0) / pins.length,
        ];
        // The shared ALIVE map — same basemap, same ward hairlines, same
        // controls as the homepage network map a brand just came from. The
        // guard is the ref, not `cancelled`: this effect re-runs per pins
        // change and the map outlives those runs — only unmount nulls the ref.
        const map = createAliveMap(
          L,
          containerRef.current,
          {
            center: pins.length ? center : MANGALURU,
            zoom: 13,
            // One-finger drag over a mid-form map is a scroll trap on phones;
            // pinch-zoom still works for positioning.
            dragging: !L.Browser.mobile,
          },
          () => mapRef.current === map,
        );
        mapRef.current = map;
      }

      // Rebuild markers from the current pins.
      for (const m of markersRef.current.values()) m.remove();
      markersRef.current.clear();

      for (const pin of pins) {
        const isSel = selectedRef.current.includes(pin.id);
        const icon = L.divIcon({
          html: markerHtml(pin, isSel), className: '',
          iconSize: [36, 36], iconAnchor: [18, 18],
        });
        const marker = L.marker([pin.lat, pin.lng], {
          icon,
          title: `${pin.storeName} — ${pin.live ? `${tierLabel(pin)} · ${statusLabel(pin)}` : statusLabel(pin)}`,
        }).addTo(mapRef.current);
        marker.bindTooltip(tooltipHtml(pin), { direction: 'top', offset: [0, -14] });
        marker.on('click', () => {
          const current = pinsRef.current.get(pin.id);
          // Coming-soon stores can't be booked yet; sold-out ones are full.
          if (!current?.live || current.slotStatus === 'sold_out') return;
          onToggleRef.current(pin.id, current?.storeName ?? pin.storeName);
        });
        markersRef.current.set(pin.id, marker);
      }

      // Frame the network the way the homepage map frames it — once. A later
      // pins change (the brand moved the start date) must not yank the view
      // back from wherever they had panned to.
      if (!framedRef.current && markersRef.current.size > 0) {
        framedRef.current = true;
        fitToPins(L, mapRef.current, Array.from(markersRef.current.values()));
      }
    })();
    return () => { cancelled = true; };
  }, [pins]);

  // Restyle markers when the selection changes (no rebuild needed).
  useEffect(() => {
    if (!mapRef.current) return;
    (async () => {
      const L = (await import('leaflet')).default;
      for (const [id, marker] of markersRef.current) {
        const pin = pinsRef.current.get(id);
        if (!pin) continue;
        marker.setIcon(L.divIcon({
          html: markerHtml(pin, selected.includes(id)), className: '',
          iconSize: [36, 36], iconAnchor: [18, 18],
        }));
      }
    })();
  }, [selected]);

  // Tear down on unmount only — the container never unmounts while errors show.
  useEffect(() => () => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    markersRef.current.clear();
  }, []);

  // Genuinely nothing to show (no live geocoded screens): render nothing —
  // the heading lives here, so no orphan section is left behind.
  if (!loading && !error && pins.length === 0) return null;

  const byId = new Map(pins.map((p) => [p.id, p]));

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Pick screens near your customers
      </p>
      <div className="relative">
        <div
          ref={containerRef}
          className="h-[300px] sm:h-[340px] rounded-xl overflow-hidden border border-border bg-muted/30"
        />
        {loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center rounded-xl bg-muted/40 text-xs text-muted-foreground">
            Loading screens…
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-x-0 bottom-0 z-[500] rounded-b-xl bg-background/95 border-t border-border px-3 py-2 text-xs text-muted-foreground">
            Couldn&rsquo;t refresh availability — you can still book by screen count below.
          </div>
        )}
      </div>

      {/* Same legend semantics as the homepage: the core is the tier. Sold-out
          and picked are the picker's own states, drawn the way the pins draw
          them — dimmed, and check-disc. */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {(['flagship', 'growth', 'standard'] as SlotTier[]).map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span style={swatchStyle(TIER[t].color, 10)} /> {TIER[t].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5"><span style={swatchStyle(coreColor('in_progress'), 10)} /> Coming soon</span>
        <span className="flex items-center gap-1.5"><span style={{ ...swatchStyle(TIER.standard.color, 10), opacity: 0.55 }} /> Sold out</span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-3 w-3 items-center justify-center rounded-full border border-white bg-[#dc2626] text-[7px] font-black leading-none text-white shadow-sm">✓</span> Selected
        </span>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const pin = byId.get(id);
            if (!pin) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggle(id, pin.storeName)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-foreground/30 transition-colors"
              >
                <span style={swatchStyle(coreColor('live', pin.tier), 8)} />
                {pin.storeName}
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}

      {/* The homepage map owns this CSS string, so the mark behaves identically
          on both pages (entry pop, hover and active scaling). */}
      <style>{SHOP_PIN_CSS + LOCALITY_TIP_CSS + ALIVE_MAP_CSS}</style>
    </div>
  );
}
