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
  pincode?: string | null;
  photo?: string | null;          // storefront shot; card falls back to a glyph header
  since?: string;                 // createdAt ISO → "Since Mar 2026"
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
// `color` paints the marker core; `text`/`tint` are the darker chip pairing so
// small caps stay readable on the popup card.
const TIER: Record<StoreTier, { label: string; color: string; text: string; tint: string }> = {
  flagship: { label: 'Flagship', color: RED,       text: '#b91c1c', tint: 'rgba(220,38,38,.09)' },
  growth:   { label: 'Growth',   color: '#f59e0b', text: '#b45309', tint: 'rgba(245,158,11,.14)' },
  standard: { label: 'Standard', color: '#111827', text: '#111827', tint: 'rgba(17,24,39,.06)' },
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

// Lucide "store" glyph (ISC) — the card's header stand-in for shops without a
// storefront photo yet.
const STORE_GLYPH =
  '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>' +
  '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>' +
  '<path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>' +
  '<path d="M2 7h20"/>' +
  '<path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>';

/** The click-through card: photo (or glyph) header with a floating status
 *  pill, then name, address line, tier chip, partner-since, and a directions
 *  CTA. Every partner-entered string passes through esc(). */
function shopCardHtml(store: StorePin): string {
  const live = store.status === 'live';
  const t = TIER[store.tier ?? 'standard'];
  const dot = live ? t.color : ONBOARDED;
  const statusText  = live ? t.text : '#4b5563';
  const statusTint  = live ? t.tint : 'rgba(107,114,128,.10)';
  const loc = [store.locality, store.city, store.pincode].filter(Boolean).join(' · ');
  const since = store.since
    ? new Date(store.since).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : null;
  const header = store.photo
    ? `<img class="ph-img" src="${esc(store.photo)}" alt="" loading="lazy"/>`
    : `<div class="ph-empty" style="background:${statusTint};">` +
        `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="${dot}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" opacity=".6" aria-hidden="true">${STORE_GLYPH}</svg>` +
      '</div>';
  return (
    '<div class="alive-shop-card">' +
      `<div class="ph">${header}` +
        `<span class="st" style="color:${statusText};"><i style="background:${dot};"></i>${live ? 'Live' : 'Coming soon'}</span>` +
      '</div>' +
      '<div class="bd">' +
        `<p class="nm">${esc(store.storeName)}</p>` +
        (loc ? `<p class="loc">${esc(loc)}</p>` : '') +
        '<div class="row">' +
          `<span class="chip" style="color:${t.text};background:${t.tint};">${t.label} partner</span>` +
          (since ? `<span class="since">Since ${since}</span>` : '') +
        '</div>' +
        `<a class="dir" href="https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}" target="_blank" rel="noopener noreferrer">Get directions` +
          '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>' +
        '</a>' +
      '</div>' +
    '</div>'
  );
}

// Haversine metres between two points — sizes each area ring from its members.
function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180, R = 6371000;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
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
  // Area rings — one thin red boundary per locality cluster, rebuilt with the markers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zonesRef = useRef<any>(null);

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
      zonesRef.current = null;
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
        const marker = (L as any).marker([store.lat, store.lng], {
          icon: iconFor(store, false),
          title: `${store.storeName} — ${store.status === 'live' ? `${tierInfo.label} · Live` : PIN[store.status].label}`,
        })
          .addTo(map)
          .bindPopup(shopCardHtml(store), {
            closeButton: false, className: 'alive-popup', minWidth: 236, maxWidth: 236,
          });

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

      // ── Area-wise coverage borders ────────────────────────────────────────
      // Group shops by locality (city, then the shop itself, as fallbacks) and
      // ring each cluster with a thin dashed red boundary — the areas ALIVE
      // covers, visible the moment the map opens. Rebuilt wholesale with the
      // markers; rings live in the overlay pane, so dots stay clickable above
      // them, and a sticky tooltip names the area on hover.
      if (zonesRef.current) { zonesRef.current.remove(); zonesRef.current = null; }
      const groups = new Map<string, StorePin[]>();
      stores.forEach((s) => {
        // `||` not `??`: a failed autofill leaves locality as '' — nullish
        // coalescing would lump every such store into one city-wide ring.
        const key = (s.locality || s.city || s.id).trim().toLowerCase();
        const list = groups.get(key);
        if (list) list.push(s); else groups.set(key, [s]);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zones = (L as any).layerGroup();
      groups.forEach((members) => {
        const lat = members.reduce((sum, m) => sum + m.lat, 0) / members.length;
        const lng = members.reduce((sum, m) => sum + m.lng, 0) / members.length;
        const spread = members.reduce((r, m) => Math.max(r, metersBetween(lat, lng, m.lat, m.lng)), 0);
        // ~200m exclusivity plus breathing room for a lone shop; clamped so one
        // bad geocode can't paint a ring across half the city.
        const radius = Math.min(Math.max(spread + 180, 260), 2500);
        const name = (members[0].locality || members[0].city || members[0].storeName).trim();
        (L as any).circle([lat, lng], {
          radius, color: RED, weight: 1, opacity: 0.5, dashArray: '4 4',
          fillColor: RED, fillOpacity: 0.04,
        })
          .bindTooltip(
            `${esc(name)} · ${members.length} store${members.length > 1 ? 's' : ''}`,
            { sticky: true, direction: 'top', className: 'alive-zone-tip' },
          )
          .addTo(zones);
      });
      zones.addTo(map);
      zonesRef.current = zones;

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
                        ? <span style={{ color: TIER[store.tier ?? 'standard'].text }}> · {TIER[store.tier ?? 'standard'].label.toLowerCase()}</span>
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
        .alive-popup .leaflet-popup-content-wrapper{border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.16);padding:0;overflow:hidden;}
        .alive-popup .leaflet-popup-content{margin:0;line-height:1.4;}
        .alive-popup .leaflet-popup-tip-container{display:none;}
        .alive-zone-tip{font-family:var(--font-dm-mono),monospace;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#b91c1c;background:#fff;border:1px solid rgba(220,38,38,.35);border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.10);padding:3px 8px;}
        .alive-zone-tip::before{display:none;}
        .alive-shop-card{width:236px;background:#fff;font-family:var(--font-manrope),sans-serif;}
        .alive-shop-card .ph{position:relative;height:106px;background:#f5f5f5;}
        .alive-shop-card .ph-img{display:block;width:100%;height:100%;object-fit:cover;}
        .alive-shop-card .ph-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;}
        .alive-shop-card .st{position:absolute;left:10px;bottom:10px;display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 1px 4px rgba(0,0,0,.18);font-family:var(--font-dm-mono),monospace;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;}
        .alive-shop-card .st i{width:7px;height:7px;border-radius:50%;display:inline-block;}
        .alive-shop-card .bd{padding:12px 14px 13px;}
        .alive-shop-card .nm{margin:0;font-size:14.5px;font-weight:800;letter-spacing:-.01em;line-height:1.25;color:#0a0a0a;}
        .alive-shop-card .loc{margin:3px 0 0;font-family:var(--font-dm-mono),monospace;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:#888;}
        .alive-shop-card .row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;}
        .alive-shop-card .chip{display:inline-flex;padding:3px 9px;border-radius:999px;font-family:var(--font-dm-mono),monospace;font-size:8.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}
        .alive-shop-card .since{font-family:var(--font-dm-mono),monospace;font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;}
        .alive-shop-card .dir{margin-top:12px;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 0;border-radius:9px;background:#dc2626;color:#fff;font-size:11.5px;font-weight:700;text-decoration:none;transition:background .15s;}
        .alive-shop-card .dir:hover{background:#b91c1c;}
        .leaflet-control-zoom{border:1px solid #e5e5e5 !important;border-radius:8px !important;overflow:hidden;box-shadow:none !important;}
        .leaflet-control-zoom a{width:30px !important;height:30px !important;line-height:30px !important;font-size:16px !important;color:#333 !important;}
        .leaflet-control-attribution{font-size:10px !important;background:rgba(255,255,255,.7) !important;}
      `}</style>
    </div>
  );
}
