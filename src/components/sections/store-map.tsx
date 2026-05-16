'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

type StoreLocation = {
  id: string;
  storeName: string;
  locality: string | null;
  city: string | null;
  lat: number;
  lng: number;
  status: 'live';
};

// Coming-soon expansion zones — not yet live stores
const PLANNED_ZONES: Array<{ name: string; lat: number; lng: number; note: string }> = [
  { name: 'Bejai',        lat: 12.8774, lng: 74.8380, note: 'Expansion planned Q3 2025' },
  { name: 'Attavar',      lat: 12.8835, lng: 74.8449, note: 'Expansion planned Q3 2025' },
  { name: 'Kadri',        lat: 12.8832, lng: 74.8502, note: 'Expansion planned Q4 2025' },
  { name: 'Urwa',         lat: 12.8967, lng: 74.8466, note: 'Expansion planned Q4 2025' },
  { name: 'Kankanady',    lat: 12.8701, lng: 74.8580, note: 'Expansion planned Q1 2026' },
  { name: 'Bendoorwell',  lat: 12.8594, lng: 74.8430, note: 'Expansion planned Q1 2026' },
];

const MANGALURU = { lat: 12.8698, lng: 74.8431 };

export default function StoreMap() {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<unknown>(null);
  const [loaded,  setLoaded]  = useState(false);
  const [stores,  setStores]  = useState<StoreLocation[]>([]);
  const [counts,  setCounts]  = useState({ live: 0, planned: PLANNED_ZONES.length });

  // Fetch live store locations
  useEffect(() => {
    fetch('/api/stores/locations')
      .then((r) => r.json())
      .then((d: { stores?: StoreLocation[] }) => {
        const list = (d.stores ?? []).filter((s) => s.lat && s.lng);
        setStores(list);
        setCounts((c) => ({ ...c, live: list.length }));
      })
      .catch(() => {});
  }, []);

  // Load Leaflet and render map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    async function initMap() {
      const L = (await import('leaflet')).default;
      if (!mapRef.current || mapInstance.current) return;

      const map = L.map(mapRef.current, {
        center:          [MANGALURU.lat, MANGALURU.lng],
        zoom:            13,
        zoomControl:     true,
        scrollWheelZoom: false,
        attributionControl: false,
      });
      mapInstance.current = map;

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19 }
      ).addTo(map);

      // ── Live store icon (red) ──────────────────────────────────────────────
      const liveIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:32px;height:32px;border-radius:50% 50% 50% 0;
          background:#dc2626;border:3px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.25);
          transform:rotate(-45deg);
        "></div>`,
        iconSize:   [32, 32],
        iconAnchor: [16, 32],
        popupAnchor:[0, -36],
      });

      // ── Planned zone icon (gray outlined) ─────────────────────────────────
      const plannedIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:24px;height:24px;border-radius:50%;
          background:#f5f5f5;border:2.5px dashed #9ca3af;
          box-shadow:0 1px 4px rgba(0,0,0,0.12);
        "></div>`,
        iconSize:   [24, 24],
        iconAnchor: [12, 12],
        popupAnchor:[0, -16],
      });

      // ── Plot live stores ───────────────────────────────────────────────────
      stores.forEach((s) => {
        L.marker([s.lat, s.lng], { icon: liveIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;min-width:140px">
              <p style="font-weight:700;font-size:13px;margin:0 0 2px">${s.storeName}</p>
              ${s.locality ? `<p style="font-size:11px;color:#6b7280;margin:0">${s.locality}${s.city ? `, ${s.city}` : ''}</p>` : ''}
              <span style="display:inline-block;margin-top:6px;background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;letter-spacing:.05em">LIVE</span>
            </div>
          `, { maxWidth: 200 });
      });

      // ── Plot planned zones ─────────────────────────────────────────────────
      PLANNED_ZONES.forEach((z) => {
        L.marker([z.lat, z.lng], { icon: plannedIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;min-width:140px">
              <p style="font-weight:700;font-size:13px;margin:0 0 2px">${z.name}</p>
              <p style="font-size:11px;color:#6b7280;margin:0">${z.note}</p>
              <span style="display:inline-block;margin-top:6px;background:#f3f4f6;color:#6b7280;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;border:1px dashed #d1d5db;letter-spacing:.05em">COMING SOON</span>
            </div>
          `, { maxWidth: 200 });
      });

      setLoaded(true);
    }

    void initMap();

    return () => {
      if (mapInstance.current) {
        (mapInstance.current as { remove: () => void }).remove();
        mapInstance.current = null;
      }
    };
  // stores changes after Leaflet loads — re-add markers by reinitializing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores.length]);

  return (
    <section className="py-20 sm:py-28 bg-background border-t border-border/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">

        {/* Header */}
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Our network</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Find an ALIVE screen near you
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Live screens are already serving shoppers across Mangaluru. Expansion zones show where
            we&apos;re onboarding next — contact us to fast-track your area.
          </p>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <div className="h-3 w-3 rounded-full bg-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{counts.live > 0 ? `${counts.live} live` : 'Growing'}</p>
              <p className="text-xs text-muted-foreground">Active partner stores</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <div className="h-3 w-3 rounded-full border-2 border-dashed border-gray-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{counts.planned} zones</p>
              <p className="text-xs text-muted-foreground">Expansion areas planned</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-bold text-foreground">Mangaluru</p>
              <p className="text-xs text-muted-foreground">Karnataka, India</p>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="relative rounded-2xl border border-border overflow-hidden bg-muted/20" style={{ height: 520 }}>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

          {/* Legend overlay */}
          <div className="absolute bottom-4 left-4 z-[400] flex flex-col gap-2 rounded-xl border border-border bg-background/95 backdrop-blur-sm px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="h-3 w-3 rounded-full bg-primary flex-shrink-0" />
              <span className="text-xs font-semibold text-foreground">Live ALIVE screen</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-3 w-3 rounded-full border-2 border-dashed border-gray-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground">Expansion zone</span>
            </div>
          </div>

          {/* Attribution */}
          <div className="absolute bottom-2 right-2 z-[400]">
            <p className="text-[9px] text-muted-foreground/40">© CartoDB · OpenStreetMap contributors</p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between rounded-2xl border border-border bg-card px-6 py-5">
          <div>
            <p className="font-bold text-foreground">Want your store on the map?</p>
            <p className="text-sm text-muted-foreground mt-0.5">Register as a store partner — it&apos;s free and takes 5 minutes.</p>
          </div>
          <a
            href="/store"
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <MapPin className="h-4 w-4" /> Join the network
          </a>
        </div>
      </div>
    </section>
  );
}
