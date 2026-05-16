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

// Mangaluru neighbourhoods with approximate bounding polygons
// Polygons are [lat, lng] arrays — rough outlines of each area
type Area = {
  id: string;
  label: string;
  color: string;          // fill color
  border: string;         // stroke color
  center: [number, number];
  polygon: [number, number][];
  planned: boolean;       // true = expansion zone only
  note?: string;
};

const AREAS: Area[] = [
  {
    id: 'hampankatta',
    label: 'Hampankatta',
    color: 'rgba(220,38,38,0.12)',
    border: '#dc2626',
    center: [12.8698, 74.8431],
    planned: false,
    polygon: [
      [12.8730, 74.8380], [12.8730, 74.8490],
      [12.8660, 74.8490], [12.8660, 74.8380],
    ],
  },
  {
    id: 'bejai',
    label: 'Bejai',
    color: 'rgba(220,38,38,0.10)',
    border: '#dc2626',
    center: [12.8774, 74.8380],
    planned: false,
    polygon: [
      [12.8810, 74.8330], [12.8810, 74.8430],
      [12.8730, 74.8430], [12.8730, 74.8330],
    ],
  },
  {
    id: 'attavar',
    label: 'Attavar',
    color: 'rgba(156,163,175,0.13)',
    border: '#9ca3af',
    center: [12.8835, 74.8449],
    planned: true,
    note: 'Expansion Q3 2025',
    polygon: [
      [12.8870, 74.8400], [12.8870, 74.8500],
      [12.8790, 74.8500], [12.8790, 74.8400],
    ],
  },
  {
    id: 'kadri',
    label: 'Kadri',
    color: 'rgba(156,163,175,0.13)',
    border: '#9ca3af',
    center: [12.8832, 74.8502],
    planned: true,
    note: 'Expansion Q4 2025',
    polygon: [
      [12.8870, 74.8460], [12.8870, 74.8560],
      [12.8790, 74.8560], [12.8790, 74.8460],
    ],
  },
  {
    id: 'urwa',
    label: 'Urwa',
    color: 'rgba(156,163,175,0.13)',
    border: '#9ca3af',
    center: [12.8967, 74.8466],
    planned: true,
    note: 'Expansion Q4 2025',
    polygon: [
      [12.9010, 74.8410], [12.9010, 74.8520],
      [12.8920, 74.8520], [12.8920, 74.8410],
    ],
  },
  {
    id: 'kankanady',
    label: 'Kankanady',
    color: 'rgba(156,163,175,0.13)',
    border: '#9ca3af',
    center: [12.8701, 74.8580],
    planned: true,
    note: 'Expansion Q1 2026',
    polygon: [
      [12.8740, 74.8530], [12.8740, 74.8640],
      [12.8660, 74.8640], [12.8660, 74.8530],
    ],
  },
  {
    id: 'bendoorwell',
    label: 'Bendoorwell',
    color: 'rgba(156,163,175,0.13)',
    border: '#9ca3af',
    center: [12.8594, 74.8430],
    planned: true,
    note: 'Expansion Q1 2026',
    polygon: [
      [12.8640, 74.8370], [12.8640, 74.8480],
      [12.8550, 74.8480], [12.8550, 74.8370],
    ],
  },
  {
    id: 'balmatta',
    label: 'Balmatta',
    color: 'rgba(220,38,38,0.10)',
    border: '#dc2626',
    center: [12.8758, 74.8320],
    planned: false,
    polygon: [
      [12.8800, 74.8270], [12.8800, 74.8370],
      [12.8710, 74.8370], [12.8710, 74.8270],
    ],
  },
];

const MANGALURU = { lat: 12.8698, lng: 74.8431 };

export default function StoreMap() {
  const mapRef       = useRef<HTMLDivElement>(null);
  const mapInstance  = useRef<unknown>(null);
  const polygonRefs  = useRef<Record<string, unknown>>({});
  const markerLayer  = useRef<unknown>(null);

  const [loaded,      setLoaded]      = useState(false);
  const [stores,      setStores]      = useState<StoreLocation[]>([]);
  const [activeArea,  setActiveArea]  = useState<string | null>(null);
  const [counts,      setCounts]      = useState({ live: 0, planned: AREAS.filter(a => a.planned).length });

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

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    let cancelled = false;

    async function initMap() {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current || mapInstance.current) return;

      const map = L.map(mapRef.current, {
        center:             [MANGALURU.lat, MANGALURU.lng],
        zoom:               13,
        zoomControl:        true,
        scrollWheelZoom:    false,
        attributionControl: false,
      });
      mapInstance.current = map;

      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19 }
      ).addTo(map);

      // Draw area polygons
      AREAS.forEach((area) => {
        const poly = L.polygon(area.polygon, {
          color:       area.border,
          fillColor:   area.color,
          fillOpacity: 1,
          weight:      area.planned ? 1.5 : 2,
          dashArray:   area.planned ? '6 4' : undefined,
        }).addTo(map);

        // Area label tooltip
        poly.bindTooltip(area.label, {
          permanent:   true,
          direction:   'center',
          className:   'area-label',
        });

        poly.on('click', () => setActiveArea((prev) => prev === area.id ? null : area.id));
        polygonRefs.current[area.id] = poly;
      });

      // Marker layer group
      const group = L.layerGroup().addTo(map);
      markerLayer.current = group;

      setLoaded(true);
    }

    void initMap();
    return () => {
      cancelled = true;
      if (mapInstance.current) {
        (mapInstance.current as { remove: () => void }).remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Re-plot markers whenever stores or activeArea changes
  useEffect(() => {
    if (!mapInstance.current || !markerLayer.current) return;

    import('leaflet').then(({ default: L }) => {
      const group = markerLayer.current as { clearLayers: () => void; addLayer: (l: unknown) => void };
      group.clearLayers();

      const liveIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:28px;height:28px;border-radius:50% 50% 50% 0;
          background:#dc2626;border:3px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.28);
          transform:rotate(-45deg);
        "></div>`,
        iconSize:    [28, 28],
        iconAnchor:  [14, 28],
        popupAnchor: [0, -32],
      });

      const filteredStores = activeArea
        ? stores.filter((s) => {
            const area = AREAS.find((a) => a.id === activeArea);
            if (!area) return true;
            const [lat, lng] = [s.lat, s.lng];
            const lats = area.polygon.map(p => p[0]);
            const lngs = area.polygon.map(p => p[1]);
            return lat >= Math.min(...lats) && lat <= Math.max(...lats)
                && lng >= Math.min(...lngs) && lng <= Math.max(...lngs);
          })
        : stores;

      filteredStores.forEach((s) => {
        const marker = L.marker([s.lat, s.lng], { icon: liveIcon })
          .bindPopup(`
            <div style="font-family:sans-serif;min-width:150px;padding:2px 0">
              <p style="font-weight:700;font-size:13px;margin:0 0 3px">${s.storeName}</p>
              ${s.locality ? `<p style="font-size:11px;color:#6b7280;margin:0 0 6px">${s.locality}${s.city ? `, ${s.city}` : ''}</p>` : ''}
              <span style="display:inline-block;background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;letter-spacing:.05em">LIVE</span>
            </div>
          `, { maxWidth: 220 });
        group.addLayer(marker);
      });
    });
  }, [stores, activeArea]);

  // Highlight selected area polygon
  useEffect(() => {
    import('leaflet').then(({ default: L }) => {
      AREAS.forEach((area) => {
        const poly = polygonRefs.current[area.id] as ReturnType<typeof L.polygon> | undefined;
        if (!poly) return;
        const isActive = activeArea === area.id;
        poly.setStyle({
          color:       area.border,
          fillColor:   isActive
            ? (area.planned ? 'rgba(156,163,175,0.30)' : 'rgba(220,38,38,0.22)')
            : area.color,
          weight:      isActive ? 3 : (area.planned ? 1.5 : 2),
          fillOpacity: 1,
        });
      });
    });
  }, [activeArea]);

  const liveAreas  = AREAS.filter((a) => !a.planned);
  const soonAreas  = AREAS.filter((a) => a.planned);

  return (
    <section className="py-20 sm:py-28 bg-background border-t border-border/40">
      {/* Tooltip label styles injected inline */}
      <style>{`
        .area-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          font-size: 10px !important;
          font-weight: 700 !important;
          color: #374151 !important;
          white-space: nowrap !important;
          pointer-events: none !important;
          text-transform: uppercase !important;
          letter-spacing: 0.06em !important;
        }
        .area-label::before { display: none !important; }
        .leaflet-tooltip-top.area-label::before { display: none !important; }
      `}</style>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">

        {/* Header */}
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Our network</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Find an ALIVE screen near you
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Live screens serve shoppers across Mangaluru. Select an area to explore — or contact us
            to fast-track your neighbourhood.
          </p>
        </div>

        {/* Area selector + Map side-by-side on desktop */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left panel — area pills */}
          <div className="lg:w-56 xl:w-64 flex-shrink-0 space-y-5">

            {/* Live areas */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-1">Live areas</p>
              {liveAreas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => setActiveArea((p) => p === area.id ? null : area.id)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                    activeArea === area.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:border-primary/30 hover:bg-muted/30'
                  }`}
                >
                  <div className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{area.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {stores.filter((s) => {
                        const lats = area.polygon.map(p => p[0]);
                        const lngs = area.polygon.map(p => p[1]);
                        return s.lat >= Math.min(...lats) && s.lat <= Math.max(...lats)
                            && s.lng >= Math.min(...lngs) && s.lng <= Math.max(...lngs);
                      }).length || 0} store{(stores.filter((s) => {
                        const lats = area.polygon.map(p => p[0]);
                        const lngs = area.polygon.map(p => p[1]);
                        return s.lat >= Math.min(...lats) && s.lat <= Math.max(...lats)
                            && s.lng >= Math.min(...lngs) && s.lng <= Math.max(...lngs);
                      }).length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Expansion areas */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-1">Coming soon</p>
              {soonAreas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => setActiveArea((p) => p === area.id ? null : area.id)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                    activeArea === area.id
                      ? 'border-gray-400 bg-gray-50 shadow-sm'
                      : 'border-border bg-card hover:border-gray-300 hover:bg-muted/20'
                  }`}
                >
                  <div className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{area.label}</p>
                    <p className="text-[10px] text-muted-foreground">{area.note}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Stats */}
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Live stores</span>
                <span className="text-sm font-bold text-foreground">{counts.live || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Areas covered</span>
                <span className="text-sm font-bold text-foreground">{liveAreas.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Expanding to</span>
                <span className="text-sm font-bold text-foreground">{counts.planned} zones</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">City</span>
                <span className="text-sm font-bold text-foreground">Mangaluru</span>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative rounded-2xl border border-border overflow-hidden bg-muted/20 min-h-[420px] lg:min-h-0" style={{ height: 520 }}>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

            {/* Active area badge */}
            {activeArea && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400]">
                <div className="flex items-center gap-2 rounded-full border border-border bg-background/95 backdrop-blur-sm px-4 py-1.5 shadow-sm">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${AREAS.find(a => a.id === activeArea)?.planned ? 'border-2 border-dashed border-gray-400' : 'bg-primary'}`} />
                  <span className="text-xs font-bold text-foreground">{AREAS.find(a => a.id === activeArea)?.label}</span>
                  <button
                    onClick={() => setActiveArea(null)}
                    className="ml-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors text-xs leading-none"
                  >✕</button>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 right-4 z-[400] flex flex-col gap-2 rounded-xl border border-border bg-background/95 backdrop-blur-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-[10px] font-semibold text-foreground">Live ALIVE screen</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 flex-shrink-0 border border-primary/40 bg-primary/10 rounded-sm" />
                <span className="text-[10px] font-semibold text-muted-foreground">Active area</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 flex-shrink-0 border border-dashed border-gray-400 bg-gray-100 rounded-sm" />
                <span className="text-[10px] font-semibold text-muted-foreground">Expansion zone</span>
              </div>
            </div>

            {/* Attribution */}
            <div className="absolute bottom-2 left-4 z-[400]">
              <p className="text-[9px] text-muted-foreground/30">© CartoDB · OpenStreetMap</p>
            </div>
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
