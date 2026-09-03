'use client';

import { useEffect, useRef, useState } from 'react';
import { brand, brandType } from '@/lib/brand';
import {
  NETWORK_STORES,
  TIER_META,
  TIER_ORDER,
  type NetworkStore,
  type SlotTier,
} from '@/lib/advertise-network';

// Plain Leaflet, dynamically imported — no react-leaflet (it doesn't support the
// React version this app runs on). Leaflet's stylesheet is already imported by
// src/app/globals.css, so nothing is injected here.

type Props = {
  /** Stores currently chosen in the estimator; the same array the form receives. */
  selectedIds: string[];
  /** Clicking a pin toggles that store in the estimator selection. */
  onToggle: (id: string) => void;
};

/** Tier reads from the letter and the pin size, never from colour alone. */
const TIER_LETTER: Record<SlotTier, string> = { flagship: 'F', growth: 'G', standard: 'S' };
// Kept small on purpose: these shops sit within a couple of kilometres of each
// other, so at the zoom that fits them all, larger badges bury their neighbours.
// Markers also rise on hover, and the estimator's checkbox list is the
// authoritative way to pick a store.
const TIER_SIZE: Record<SlotTier, number> = { flagship: 28, growth: 24, standard: 20 };

function pinHtml(store: NetworkStore, selected: boolean): string {
  const size = TIER_SIZE[store.tier];
  const fill = selected ? 'var(--brand-accent)' : '#ffffff';
  const text = selected ? '#ffffff' : 'var(--brand-accent-strong)';
  return (
    `<span class="adv-pin${selected ? ' is-selected' : ''}" ` +
    `style="width:${size}px;height:${size}px;background:${fill};color:${text};font-size:${Math.round(size * 0.42)}px">` +
    `${TIER_LETTER[store.tier]}</span>`
  );
}

/** Store names are static config, but the popup is built as markup — escape anyway. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function NetworkMap({ selectedIds, onToggle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // The click handler has to see the latest onToggle without rebuilding markers.
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // The guard above runs before the await below, so a double-fired effect
    // (Strict Mode, HMR) would otherwise get past it twice and Leaflet would
    // throw "Map container is already initialized".
    let cancelled = false;

    async function init() {
      const L = (await import('leaflet')).default;
      if (cancelled || mapRef.current || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = (L as any).map(containerRef.current, {
        center: [12.8797, 74.8465], // TODO: recentre once the real store pins land
        zoom: 13,
        zoomControl: false,
        attributionControl: true,
        // A map that eats the page scroll is unusable on a phone.
        scrollWheelZoom: false,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L as any)
        .tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd',
          maxZoom: 19,
          attribution: '© OpenStreetMap · CARTO',
        })
        .addTo(map);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L as any).control.zoom({ position: 'bottomright' }).addTo(map);

      NETWORK_STORES.forEach(store => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const marker = (L as any)
          .marker([store.lat, store.lng], {
            title: `${store.name} — ${TIER_META[store.tier].label}`,
            keyboard: true,
            riseOnHover: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            icon: (L as any).divIcon({
              className: '',
              html: pinHtml(store, false),
              iconSize: [TIER_SIZE[store.tier], TIER_SIZE[store.tier]],
              iconAnchor: [TIER_SIZE[store.tier] / 2, TIER_SIZE[store.tier] / 2],
              popupAnchor: [0, -TIER_SIZE[store.tier] / 2],
            }),
          })
          .addTo(map)
          .bindPopup(
            `<p class="adv-popup-name">${esc(store.name)}</p>` +
              `<p class="adv-popup-tier">${esc(TIER_META[store.tier].label)}</p>` +
              `<p class="adv-popup-hint">Tap the pin to add or remove this store</p>`,
            { closeButton: false, className: 'adv-popup' }
          );

        marker.on('click', () => toggleRef.current(store.id));
        markersRef.current.set(store.id, marker);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const group = (L as any).featureGroup(Array.from(markersRef.current.values()));
      map.fitBounds(group.getBounds().pad(0.15));

      leafletRef.current = L;
      mapRef.current = map;
      setReady(true);
    }

    void init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      setReady(false);
    };
  }, []);

  // Repaint the pins whenever the estimator selection changes.
  useEffect(() => {
    const L = leafletRef.current;
    if (!ready || !L) return;
    NETWORK_STORES.forEach(store => {
      const marker = markersRef.current.get(store.id);
      if (!marker) return;
      const selected = selectedIds.includes(store.id);
      marker.setIcon(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (L as any).divIcon({
          className: '',
          html: pinHtml(store, selected),
          iconSize: [TIER_SIZE[store.tier], TIER_SIZE[store.tier]],
          iconAnchor: [TIER_SIZE[store.tier] / 2, TIER_SIZE[store.tier] / 2],
          popupAnchor: [0, -TIER_SIZE[store.tier] / 2],
        })
      );
      marker.setZIndexOffset(selected ? 500 : 0);
    });
  }, [selectedIds, ready]);

  return (
    <div>
      <div
        ref={containerRef}
        role="application"
        aria-label={`Map of ${NETWORK_STORES.length} stores across ${brand.city}. The same stores are listed as checkboxes in the estimator below.`}
        className="h-[300px] w-full rounded-lg border sm:h-[440px]"
        style={{ borderColor: 'var(--brand-line)', background: 'var(--brand-surface-muted)' }}
      />

      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" aria-hidden="true">
        {TIER_ORDER.map(tier => (
          <li key={tier} className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
            <span
              className="adv-pin"
              style={{
                width: TIER_SIZE[tier],
                height: TIER_SIZE[tier],
                background: '#fff',
                color: 'var(--brand-accent-strong)',
                fontSize: Math.round(TIER_SIZE[tier] * 0.42),
              }}
            >
              {TIER_LETTER[tier]}
            </span>
            {TIER_META[tier].label}
          </li>
        ))}
        <li className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
          <span
            className="adv-pin is-selected"
            style={{
              width: 26,
              height: 26,
              background: 'var(--brand-accent)',
              color: '#fff',
              fontSize: 11,
            }}
          >
            ✓
          </span>
          In your plan
        </li>
      </ul>

      <style>{`
        .adv-pin{display:inline-flex;align-items:center;justify-content:center;border-radius:9999px;
          border:2px solid var(--brand-accent);font-weight:700;line-height:1;
          font-family:${brandType.sans};box-shadow:0 1px 3px rgba(0,0,0,.22);
          transition:transform .15s ease;cursor:pointer;}
        .leaflet-marker-icon:hover .adv-pin,.leaflet-marker-icon:focus .adv-pin{transform:scale(1.12);}
        .leaflet-marker-icon:focus-visible{outline:3px solid var(--brand-accent-strong);outline-offset:2px;border-radius:9999px;}
        .adv-popup .leaflet-popup-content-wrapper{border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);}
        .adv-popup .leaflet-popup-content{margin:10px 14px;font-family:${brandType.sans};}
        .adv-popup-name{font-size:13px;font-weight:700;margin:0;color:#141414;}
        .adv-popup-tier{font-size:11px;margin:2px 0 0;color:#5A5A5A;text-transform:uppercase;letter-spacing:.08em;}
        .adv-popup-hint{font-size:11px;margin:6px 0 0;color:#5A5A5A;}
        .leaflet-control-attribution{font-size:10px !important;}
        .leaflet-control-zoom a{color:#141414 !important;}
      `}</style>
    </div>
  );
}
