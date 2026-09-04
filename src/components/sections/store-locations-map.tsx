'use client';
import React, { useEffect, useRef, useState } from 'react';
import { BASEMAP } from '@/lib/map-tiles';

type StoreStatus = 'live' | 'in_progress';

type StorePin = {
  id: string;
  storeName: string;
  locality: string | null;
  city: string | null;
  lat: number;
  lng: number;
  status: StoreStatus;
};

// Live screens are the network; in-progress ones are stores that have signed up
// and are being installed. Every pin is a shop — a red storefront badge — and
// fill carries the difference: solid red is playing today, outlined red is on
// its way.
const PIN = {
  live:        { label: 'Live' },
  in_progress: { label: 'Coming soon' },
} as const;

const RED = '#dc2626';

// Lucide "store" glyph (ISC), drawn inside a rounded badge with a pointer tail
// so the tail tip sits on the shop's coordinates. 30×36; the badge is 28×28.
const STORE_GLYPH =
  '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>' +
  '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>' +
  '<path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>' +
  '<path d="M2 7h20"/>' +
  '<path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>';

/** The marker markup: a red shop badge, solid for a live screen and outlined
 *  for one on its way. Status is in the fill, not only the colour, so the two
 *  still read apart for anyone who can't tell red from grey. */
export function shopPinHtml(status: StoreStatus, active: boolean): string {
  const solid = status === 'live';
  const badgeFill   = solid ? RED : '#ffffff';
  const badgeStroke = solid ? '#ffffff' : RED;
  const glyphStroke = solid ? '#ffffff' : RED;
  return (
    `<div class="alive-shop-pin${active ? ' is-active' : ''}">` +
      '<svg width="30" height="36" viewBox="0 0 30 36" aria-hidden="true">' +
        `<path d="M8 1h14a7 7 0 0 1 7 7v14a7 7 0 0 1-7 7h-3.6L15 35l-3.4-6H8a7 7 0 0 1-7-7V8a7 7 0 0 1 7-7z" fill="${badgeFill}" stroke="${badgeStroke}" stroke-width="2" stroke-linejoin="round"/>` +
        `<g transform="translate(5.65 5.65) scale(0.78)" fill="none" stroke="${glyphStroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${STORE_GLYPH}</g>` +
      '</svg>' +
    '</div>'
  );
}

/** Legend / list swatch that matches the pin: a small red square, solid or outlined. */
function swatchStyle(status: StoreStatus, size: number): React.CSSProperties {
  const solid = status === 'live';
  return {
    width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0,
    background: solid ? RED : '#ffffff', border: `1.5px solid ${RED}`,
  };
}

// Store names/localities are partner-entered (registration is public) — escape
// before they touch popup markup.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export default function StoreLocationsMap() {
  const mapRef        = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const [stores, setStores] = useState<StorePin[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  // Marker effect must re-run once the async init lands, not just when stores
  // change — otherwise stores loaded before the map is ready never get pins.
  const [mapReady, setMapReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());

  // Fetch store locations
  useEffect(() => {
    fetch('/api/stores/locations')
      .then(r => r.json())
      .then(d => setStores((d.stores ?? []).filter((s: StorePin) => s.lat && s.lng)))
      .catch(() => {});
  }, []);

  // Init Leaflet map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // The guard above runs before the `await` below, so without cancellation a
    // double-fired effect (Strict Mode, HMR) has both runs pass it and the
    // second L.map() throws "Map container is already initialized".
    let cancelled = false;

    async function init() {
      const L = (await import('leaflet')).default;
      if (cancelled || mapInstanceRef.current) return;

      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.setAttribute('data-leaflet-css', '1');
        document.head.appendChild(link);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = (L as any).map(mapRef.current!, {
        center: [12.9377, 74.8543],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L as any).tileLayer(BASEMAP.url, { maxZoom: BASEMAP.maxZoom }).addTo(map);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L as any).control.zoom({ position: 'bottomright' }).addTo(map);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L as any).control.attribution({ position: 'bottomleft', prefix: BASEMAP.attribution }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
    }

    init();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      // Markers belonged to the destroyed map — reset so a remount (Strict
      // Mode's second pass, HMR) recreates them on the new instance.
      markersRef.current.clear();
      setMapReady(false);
    };
  }, []);

  // Add store markers when data loads
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || stores.length === 0) return;

    async function addMarkers() {
      const L = (await import('leaflet')).default;
      const map = mapInstanceRef.current;
      if (!map) return; // unmounted while the import was in flight

      // A shop badge with a pointer tail; the tail tip is the anchor, so the
      // badge floats just above the shop's coordinates.
      const makeIcon = (status: StoreStatus, active: boolean) =>
        (L as any).divIcon({
          className:   '',
          html:        shopPinHtml(status, active),
          iconSize:    [30, 36],
          iconAnchor:  [15, 35],
          popupAnchor: [0, -30],
        });

      const iconFor = (s: StorePin, active: boolean) => makeIcon(s.status, active);

      stores.forEach(store => {
        if (markersRef.current.has(store.id)) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tag = store.status === 'live'
          ? `<span style="color:#dc2626;">■ Live</span>`
          : `<span style="color:#b91c1c;">□ Coming soon</span>`;

        const marker = (L as any).marker([store.lat, store.lng], {
          icon: iconFor(store, false),
          title: `${store.storeName} — ${PIN[store.status].label}`,
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:var(--font-manrope), sans-serif;min-width:140px;padding:2px 0;">
              <p style="font-size:13px;font-weight:700;margin:0 0 2px;">${esc(store.storeName)}</p>
              <p style="font-size:11px;color:#666;margin:0;">${esc([store.locality, store.city].filter(Boolean).join(' · '))}</p>
              <p style="font-family:var(--font-dm-mono), monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;margin:4px 0 0;">${tag}</p>
            </div>`,
            { closeButton: false, className: 'alive-popup' }
          );

        marker.on('click', () => {
          setSelected(store.id);
          markersRef.current.forEach((m, id) => {
            const s = stores.find((x) => x.id === id);
            if (!s) return;
            const isActive = id === store.id;
            m.setIcon(iconFor(s, isActive));
            // The chosen shop sits on top of its neighbours while it is enlarged.
            m.setZIndexOffset(isActive ? 1000 : 0);
          });
        });

        markersRef.current.set(store.id, marker);
      });

      if (stores.length > 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const group = (L as any).featureGroup(Array.from(markersRef.current.values()));
        map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 14 });
      }
    }

    addMarkers();
  }, [stores, mapReady]);

  const liveCount     = stores.filter((s) => s.status === 'live').length;
  const progressCount = stores.length - liveCount;

  const flyTo = (store: StorePin) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([store.lat, store.lng], 16, { duration: 0.8 });
    markersRef.current.get(store.id)?.openPopup();
    setSelected(store.id);
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: stores.length > 0 ? '1fr 260px' : '1fr',
      height: 520,
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid var(--rule)',
    }}>
      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#f5f5f5' }} />

      {/* Store sidebar */}
      {stores.length > 0 && (
        <div style={{ background: '#fff', borderLeft: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
            <p style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#dc2626', fontWeight: 600 }}>
              {liveCount} live screen{liveCount !== 1 ? 's' : ''}
            </p>
            {progressCount > 0 && (
              <p style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#b91c1c', fontWeight: 600, marginTop: 3 }}>
                {progressCount} coming soon
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {(['live', 'in_progress'] as StoreStatus[]).map((k) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-dm-mono), monospace', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: '#888' }}>
                  <span style={swatchStyle(k, 10)} />
                  {PIN[k].label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {stores.map(store => (
              <button
                key={store.id}
                onClick={() => flyTo(store)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 16px',
                  borderBottom: '1px solid var(--rule)', background: selected === store.id ? '#fef2f2' : 'transparent',
                  cursor: 'pointer', transition: 'background .15s', display: 'block',
                  borderLeft: `2.5px solid ${selected === store.id ? '#dc2626' : 'transparent'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ marginTop: 4, ...swatchStyle(store.status, 8) }} />
                  <div>
                    <p style={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: 13, fontWeight: 600, color: '#0a0a0a', lineHeight: 1.3, margin: 0 }}>{store.storeName}</p>
                    <p style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: 10, color: '#888', marginTop: 2, letterSpacing: '0.05em' }}>
                      {[store.locality, store.city].filter(Boolean).join(' · ')}
                      {store.status === 'in_progress' && <span style={{ color: '#b91c1c' }}> · coming soon</span>}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .alive-shop-pin{width:30px;height:36px;display:block;transform-origin:50% 100%;cursor:pointer;animation:alive-pin-in .4s cubic-bezier(.2,.8,.3,1.15) both;transition:transform .18s ease;}
        .alive-shop-pin svg{display:block;filter:drop-shadow(0 3px 5px rgba(0,0,0,.28));transition:filter .18s ease;}
        .alive-shop-pin:hover{transform:translateY(-2px) scale(1.08);}
        .alive-shop-pin.is-active{transform:scale(1.18);}
        .alive-shop-pin.is-active svg{filter:drop-shadow(0 5px 9px rgba(220,38,38,.45));}
        @keyframes alive-pin-in{from{opacity:0;transform:translateY(-10px) scale(.5);}to{opacity:1;transform:none;}}
        .alive-popup .leaflet-popup-content-wrapper{border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.12);padding:0;}
        .alive-popup .leaflet-popup-content{margin:10px 14px;}
        .alive-popup .leaflet-popup-tip-container{display:none;}
        .leaflet-control-zoom{border:1px solid #e5e5e5 !important;border-radius:8px !important;overflow:hidden;box-shadow:none !important;}
        .leaflet-control-zoom a{width:30px !important;height:30px !important;line-height:30px !important;font-size:16px !important;color:#333 !important;}
        .leaflet-control-attribution{font-size:10px !important;background:rgba(255,255,255,.7) !important;}
      `}</style>
    </div>
  );
}
