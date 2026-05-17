'use client';
import { useEffect, useRef, useState } from 'react';

type StorePin = {
  id: string;
  storeName: string;
  locality: string | null;
  city: string | null;
  lat: number;
  lng: number;
};

export default function StoreLocationsMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const [stores, setStores] = useState<StorePin[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());

  // Fetch store locations
  useEffect(() => {
    fetch('/api/stores/locations')
      .then(r => r.json())
      .then(d => setStores((d.stores ?? []).filter((s: StorePin) => s.lat && s.lng)))
      .catch(() => {});
  }, []);

  // Init Leaflet once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    async function init() {
      const L = (await import('leaflet')).default;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      if (typeof window !== 'undefined' && !document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.setAttribute('data-leaflet-css', '1');
        document.head.appendChild(link);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = (L as any).map(mapRef.current!, {
        center: [12.87, 74.84],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L as any).tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd', maxZoom: 20,
      }).addTo(map);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L as any).control.zoom({ position: 'bottomright' }).addTo(map);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L as any).control.attribution({ position: 'bottomleft', prefix: '' }).addTo(map);

      mapInstanceRef.current = map;
    }

    init();
  }, []);

  // Add/update markers when stores load
  useEffect(() => {
    if (!mapInstanceRef.current || stores.length === 0) return;

    async function addMarkers() {
      const L = (await import('leaflet')).default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = mapInstanceRef.current as any;

      // Custom red pin icon
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pinIcon = (L as any).divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#dc2626;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(220,38,38,.45);cursor:pointer;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -10],
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activePinIcon = (L as any).divIcon({
        className: '',
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 3px 14px rgba(220,38,38,.6);cursor:pointer;"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -12],
      });

      stores.forEach(store => {
        if (markersRef.current.has(store.id)) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const marker = (L as any).marker([store.lat, store.lng], { icon: pinIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:Manrope,sans-serif;min-width:140px;padding:2px 0;">
              <p style="font-size:13px;font-weight:700;margin:0 0 2px;">${store.storeName}</p>
              <p style="font-size:11px;color:#666;margin:0;">${store.locality ?? ''}${store.locality && store.city ? ' · ' : ''}${store.city ?? ''}</p>
            </div>
          `, { closeButton: false, className: 'alive-popup' });

        marker.on('click', () => {
          setSelected(store.id);
          // Update all icons
          markersRef.current.forEach((m, id) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (m as any).setIcon(id === store.id ? activePinIcon : pinIcon);
          });
        });

        markersRef.current.set(store.id, marker);
      });

      // Fit map to markers if we have some
      if (stores.length > 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const group = (L as any).featureGroup(Array.from(markersRef.current.values()) as any[]);
        map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 14 });
      }
    }

    addMarkers();
  }, [stores]);

  const flyTo = (store: StorePin) => {
    if (!mapInstanceRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any;
    map.flyTo([store.lat, store.lng], 16, { duration: 0.8 });
    const marker = markersRef.current.get(store.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (marker) (marker as any).openPopup();
    setSelected(store.id);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: stores.length > 0 ? '1fr 280px' : '1fr', gap: 0, height: 520, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--rule)' }}>
      {/* Map */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#f5f5f5' }} />

      {/* Store list sidebar */}
      {stores.length > 0 && (
        <div style={{ background: '#fff', borderLeft: '1px solid var(--rule)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--rule)', flexShrink: 0 }}>
            <p style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--red)', fontWeight: 600 }}>
              {stores.length} live screen{stores.length !== 1 ? 's' : ''}
            </p>
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
                  borderLeft: selected === store.id ? '2.5px solid #dc2626' : '2.5px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ marginTop: 3, width: 8, height: 8, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontFamily: '"Manrope",sans-serif', fontSize: 13, fontWeight: 600, color: '#0a0a0a', lineHeight: 1.3, margin: 0 }}>{store.storeName}</p>
                    <p style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, color: '#888', marginTop: 2, letterSpacing: '0.05em' }}>
                      {[store.locality, store.city].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state — no stores with coords yet */}
      {stores.length === 0 && (
        <div style={{ display: 'none' }} />
      )}

      <style>{`
        .alive-popup .leaflet-popup-content-wrapper{border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.12);padding:0;}
        .alive-popup .leaflet-popup-content{margin:10px 14px;}
        .alive-popup .leaflet-popup-tip-container{display:none;}
        .leaflet-control-zoom{border:1px solid var(--rule) !important;border-radius:8px !important;overflow:hidden;}
        .leaflet-control-zoom a{width:30px !important;height:30px !important;line-height:30px !important;font-size:16px !important;color:#333 !important;}
      `}</style>
    </div>
  );
}
