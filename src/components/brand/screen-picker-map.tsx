'use client';

// Onboarding screen picker: the same network map a brand saw on the homepage —
// every pinned store (any stage but rejected), drawn with the same red shop
// badges — plus a tier-grouped store list (Flagship / Growth / Standard),
// click to select. Live stores are bookable; outlined "Coming soon" badges
// show where the network is heading and which stores an ad can be placed at.
// Selection is a routing hint for ops (Campaign.preferredStoreIds), not a hard
// slot reservation — copy in the parent explains that. Each store's tier sets
// its per-screen monthly price (lib/brand-pricing.ts), so the tier and rate
// are shown wherever a store can be picked. Leaflet is dynamically imported
// (no react-leaflet — React 19 only) and its CSS ships globally.
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
import { MapPin, X, Check } from 'lucide-react';
import { SLOT_TIER_RATE_RUPEES, type SlotTier } from '@/lib/slot-pricing';

const TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
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
  tier: SlotTier;                 // sets the per-screen monthly rate
};

const STATUS_DOT: Record<string, string> = {
  available: '#22c55e',
  limited:   '#eab308',
  sold_out:  '#9ca3af',
  none:      '#22c55e', // schedule-mode stores are selectable
};

const STATUS_LABEL: Record<string, string> = {
  available: 'Slots open',
  limited:   'Few slots left',
  sold_out:  'Sold out',
  none:      'Available',
};

// Flagship first — the premium end of the network leads the list.
const TIER_ORDER: SlotTier[] = ['flagship', 'growth', 'standard'];

const TIER_META: Record<SlotTier, { label: string; blurb: string; badge: string }> = {
  flagship: {
    label: 'Flagship',
    blurb: 'Premium high-footfall stores',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  growth: {
    label: 'Growth',
    blurb: 'Busy neighbourhood anchors',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  standard: {
    label: 'Standard',
    blurb: 'Local kirana screens',
    badge: 'bg-muted text-muted-foreground border-border',
  },
};

const fmtRate = (tier: SlotTier) => `₹${SLOT_TIER_RATE_RUPEES[tier].toLocaleString('en-IN')}`;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// The same red shop badge as the public network map (store-locations-map.tsx)
// — a brand lands here from that map, so the pins must read as one network.
// Solid red = live screen, outlined = coming soon. Lucide "store" glyph (ISC)
// inside a 30×36 badge whose pointer tail sits on the store's coordinates.
const RED = '#dc2626';
const STORE_GLYPH =
  '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>' +
  '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>' +
  '<path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>' +
  '<path d="M2 7h20"/>' +
  '<path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>';

function shopBadgeSvg(solid: boolean): string {
  const badgeFill   = solid ? RED : '#ffffff';
  const badgeStroke = solid ? '#ffffff' : RED;
  const glyphStroke = solid ? '#ffffff' : RED;
  return (
    `<svg width="30" height="36" viewBox="0 0 30 36" aria-hidden="true" style="display:block;filter:drop-shadow(0 3px 5px rgba(0,0,0,.28))">` +
      `<path d="M8 1h14a7 7 0 0 1 7 7v14a7 7 0 0 1-7 7h-3.6L15 35l-3.4-6H8a7 7 0 0 1-7-7V8a7 7 0 0 1 7-7z" fill="${badgeFill}" stroke="${badgeStroke}" stroke-width="2" stroke-linejoin="round"/>` +
      `<g transform="translate(5.65 5.65) scale(0.78)" fill="none" stroke="${glyphStroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${STORE_GLYPH}</g>` +
    `</svg>`
  );
}

// Badge + a top-right state disc: a check when the store is picked, its slot
// availability dot when it's live. A sold-out badge is dimmed. The 36×40
// wrapper keeps the touch target at the 36px minimum; the badge sits
// bottom-centre so the tail tip stays on the coordinates.
function markerHtml(pin: ScreenPin, selected: boolean) {
  const dim  = !selected && pin.live && pin.slotStatus === 'sold_out';
  const disc = selected
    ? `<div style="position:absolute;top:-4px;right:-2px;width:16px;height:16px;border-radius:50%;background:${RED};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>`
    : pin.live
    ? `<div style="position:absolute;top:-3px;right:-1px;width:12px;height:12px;border-radius:50%;background:${STATUS_DOT[pin.slotStatus ?? 'none']};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>`
    : '';
  return (
    `<div style="width:36px;height:40px;display:flex;align-items:flex-end;justify-content:center${dim ? ';opacity:.55' : ''}">` +
      `<div style="position:relative;width:30px;height:36px">${shopBadgeSvg(pin.live || selected)}${disc}</div>` +
    `</div>`
  );
}

function statusLabel(pin: ScreenPin) {
  return pin.live ? STATUS_LABEL[pin.slotStatus ?? 'none'] : 'Coming soon';
}

function tooltipHtml(pin: ScreenPin) {
  const status = pin.live ? statusLabel(pin) : 'Coming soon — not bookable yet';
  const tier   = `${TIER_META[pin.tier].label} · ${fmtRate(pin.tier)}/mo`;
  return `<strong>${esc(pin.storeName)}</strong><br/>${esc(pin.locality ?? pin.city ?? '')} · ${status}<br/>${tier}`;
}

export default function ScreenPickerMap({
  selected, onToggle, startDate,
}: {
  selected: string[];
  onToggle: (id: string, storeName: string, tier: SlotTier) => void;
  startDate: string;              // YYYY-MM-DD — availability is shown for this date
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
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
        mapRef.current = L.map(containerRef.current, {
          zoomControl: true,
          scrollWheelZoom: false,
          // One-finger drag over a mid-form map is a scroll trap on phones;
          // pinch-zoom still works for positioning.
          dragging: !L.Browser.mobile,
        }).setView(pins.length ? center : MANGALURU, 13);
        L.tileLayer(TILE, { attribution: '© OpenStreetMap © CARTO', maxZoom: 19 }).addTo(mapRef.current);
        // Frame the whole network once at mount — pins refetch on date change,
        // and re-fitting then would yank the map out of the brand's hands.
        if (pins.length > 1) {
          mapRef.current.fitBounds(
            L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])).pad(0.2),
            { maxZoom: 14 },
          );
        }
      }

      // Rebuild markers from the current pins.
      for (const m of markersRef.current.values()) m.remove();
      markersRef.current.clear();

      for (const pin of pins) {
        const isSel = selectedRef.current.includes(pin.id);
        const icon = L.divIcon({
          html: markerHtml(pin, isSel), className: '',
          iconSize: [36, 40], iconAnchor: [18, 39],
        });
        const marker = L.marker([pin.lat, pin.lng], {
          icon, title: `${pin.storeName} — ${statusLabel(pin)}`,
        }).addTo(mapRef.current);
        marker.bindTooltip(tooltipHtml(pin), { direction: 'top', offset: [0, -38] });
        marker.on('click', () => {
          const current = pinsRef.current.get(pin.id);
          // Coming-soon stores can't be booked yet; sold-out ones are full.
          if (!current?.live || current.slotStatus === 'sold_out') return;
          onToggleRef.current(pin.id, current?.storeName ?? pin.storeName, current?.tier ?? pin.tier);
        });
        markersRef.current.set(pin.id, marker);
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
          iconSize: [36, 40], iconAnchor: [18, 39],
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

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-red-600 inline-block" /> Live screen</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-red-600 bg-white inline-block" /> Coming soon</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" /> Slots open</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-500 inline-block" /> Few left</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-400 inline-block" /> Sold out</span>
        <span className="flex items-center gap-1.5"><span className="flex h-3 w-3 items-center justify-center rounded-full bg-primary"><Check className="h-2 w-2 text-white" /></span> Selected</span>
      </div>

      {/* Tier-grouped store list — the browsable answer to "which stores, at
          what price". Same toggle + guards as the map pins. */}
      {pins.length > 0 && (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {TIER_ORDER.map((tier) => {
            const group = pins.filter((p) => p.tier === tier);
            if (group.length === 0) return null;
            const meta = TIER_META[tier];
            return (
              <div key={tier}>
                <div className="flex items-center justify-between gap-2 bg-muted/30 px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.badge}`}>
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">{meta.blurb}</span>
                  </div>
                  <span className="text-xs font-bold text-foreground whitespace-nowrap">
                    {fmtRate(tier)}<span className="font-normal text-muted-foreground text-[10px]">/screen/mo</span>
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {group.map((pin) => {
                    const isSel    = selected.includes(pin.id);
                    const bookable = pin.live && pin.slotStatus !== 'sold_out';
                    return (
                      <button
                        key={pin.id}
                        type="button"
                        disabled={!bookable}
                        onClick={() => onToggle(pin.id, pin.storeName, pin.tier)}
                        className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                          isSel ? 'bg-primary/5' : 'hover:bg-muted/40'
                        } ${bookable ? '' : 'opacity-50 cursor-not-allowed'}`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={pin.live
                            ? { background: STATUS_DOT[pin.slotStatus ?? 'none'] }
                            : { background: '#fff', border: '2px solid #dc2626' }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{pin.storeName}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {pin.locality ?? pin.city ?? '—'} · {statusLabel(pin)}
                          </span>
                        </span>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isSel ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-transparent'
                        }`}>
                          <Check className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((id) => {
            const pin = byId.get(id);
            if (!pin) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggle(id, pin.storeName, pin.tier)}
                className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/60 transition-colors"
              >
                <MapPin className="h-3 w-3 text-primary" />
                {pin.storeName}
                <span className={`rounded-full border px-1.5 py-px text-[10px] font-bold ${TIER_META[pin.tier].badge}`}>
                  {TIER_META[pin.tier].label} · {fmtRate(pin.tier)}/mo
                </span>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
