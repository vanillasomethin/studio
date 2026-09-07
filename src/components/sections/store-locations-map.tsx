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
  tier?: StoreTier;               // absent on a stale API during deploy → standard
};

// Live screens are the network; in-progress ones are stores that have signed up
// and are being installed. Every store is one round mark wearing the site's
// hairline red rim; the CORE carries the state — grey until the screen is
// live, then the store's slot-pricing tier colour, so the network's mix reads
// at a glance.
const PIN = {
  live:        { label: 'Live' },
  in_progress: { label: 'Coming soon' },
} as const;

const RED = '#dc2626';

type StoreTier = 'standard' | 'growth' | 'flagship';

// Tier colours stay in the brand family: flagship is the red, growth warms to
// amber, standard is ink. Grey means onboarded — signed up, screen on its way.
const TIER: Record<StoreTier, { label: string; color: string }> = {
  flagship: { label: 'Flagship', color: RED },
  growth:   { label: 'Growth',   color: '#f59e0b' },
  standard: { label: 'Standard', color: '#111827' },
};
const ONBOARDED = '#9ca3af';

function coreColor(status: StoreStatus, tier?: StoreTier): string {
  return status === 'live' ? TIER[tier ?? 'standard'].color : ONBOARDED;
}

// The dot's box, in px. Geometry is derived from this everywhere — the SVG,
// the divIcon's iconSize/iconAnchor/popupAnchor, and the CSS below — so the
// mark can be resized in one place without floating off its shop.
const DOT = 18;

/** The marker markup: coloured core, white gap, hairline red rim. */
export function shopPinHtml(core: string, active: boolean): string {
  const c = DOT / 2;
  return (
    `<div class="alive-shop-pin${active ? ' is-active' : ''}">` +
      `<svg width="${DOT}" height="${DOT}" viewBox="0 0 ${DOT} ${DOT}" aria-hidden="true">` +
        `<circle cx="${c}" cy="${c}" r="${c - 1.4}" fill="#ffffff" stroke="${RED}" stroke-width="1.4"/>` +
        `<circle cx="${c}" cy="${c}" r="${c - 4.4}" fill="${core}"/>` +
      '</svg>' +
    '</div>'
  );
}

/** Legend / list swatch that matches the pin: same core, same hairline rim. */
function swatchStyle(color: string, size: number): React.CSSProperties {
  return {
    width: size, height: size, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
    background: color, border: '1.5px solid #ffffff', boxShadow: `0 0 0 1px ${RED}`,
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

      // A round mark centred on the shop's coordinates — so the anchor is the
      // middle of the dot, not a tail tip, and the popup clears its top edge.
      const iconFor = (s: StorePin, active: boolean) =>
        (L as any).divIcon({
          className:   '',
          html:        shopPinHtml(coreColor(s.status, s.tier), active),
          iconSize:    [DOT, DOT],
          iconAnchor:  [DOT / 2, DOT / 2],
          popupAnchor: [0, -(DOT / 2 + 4)],
        });

      stores.forEach(store => {
        if (markersRef.current.has(store.id)) return;

        const tierInfo = TIER[store.tier ?? 'standard'];
        const tag = store.status === 'live'
          ? `<span style="color:${tierInfo.color};">● Live · ${tierInfo.label}</span>`
          : `<span style="color:#6b7280;">● Coming soon</span>`;

        const marker = (L as any).marker([store.lat, store.lng], {
          icon: iconFor(store, false),
          title: `${store.storeName} — ${store.status === 'live' ? `${tierInfo.label} · Live` : PIN[store.status].label}`,
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
              <p style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, marginTop: 3 }}>
                {progressCount} coming soon
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
              {[...(Object.keys(TIER) as StoreTier[]).map((t) => [TIER[t].label, TIER[t].color] as const), ['Onboarded', ONBOARDED] as const].map(([label, color]) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-dm-mono), monospace', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: '#888' }}>
                  <span style={swatchStyle(color, 10)} />
                  {label}
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
                  borderBottom: '1px solid var(--rule)', background: selected === store.id ? '#f5f5f5' : 'transparent',
                  cursor: 'pointer', transition: 'background .15s', display: 'block',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ marginTop: 4, ...swatchStyle(coreColor(store.status, store.tier), 8) }} />
                  <div>
                    <p style={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: 13, fontWeight: 600, color: '#0a0a0a', lineHeight: 1.3, margin: 0 }}>{store.storeName}</p>
                    <p style={{ fontFamily: 'var(--font-dm-mono), monospace', fontSize: 10, color: '#888', marginTop: 2, letterSpacing: '0.05em' }}>
                      {[store.locality, store.city].filter(Boolean).join(' · ')}
                      {store.status === 'live'
                        ? <span style={{ color: TIER[store.tier ?? 'standard'].color }}> · {TIER[store.tier ?? 'standard'].label.toLowerCase()}</span>
                        : <span style={{ color: '#6b7280' }}> · coming soon</span>}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .alive-shop-pin{width:${DOT}px;height:${DOT}px;display:block;transform-origin:50% 50%;cursor:pointer;animation:alive-pin-in .4s cubic-bezier(.2,.8,.3,1.15) both;transition:transform .18s ease;}
        .alive-shop-pin svg{display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,.32));transition:filter .18s ease;}
        .alive-shop-pin:hover{transform:scale(1.25);}
        .alive-shop-pin.is-active{transform:scale(1.35);}
        .alive-shop-pin.is-active svg{filter:drop-shadow(0 2px 6px rgba(0,0,0,.4));}
        @keyframes alive-pin-in{from{opacity:0;transform:scale(.3);}to{opacity:1;transform:none;}}
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
