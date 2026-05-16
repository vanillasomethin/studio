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

type Area = {
  id: string;
  label: string;
  fillColor: string;
  strokeColor: string;
  center: [number, number];
  polygon: [number, number][];
  planned: boolean;
  note?: string;
};

const AREAS: Area[] = [
  {
    id: 'hampankatta',
    label: 'Hampankatta',
    fillColor: 'rgba(220,38,38,0.12)',
    strokeColor: '#dc2626',
    center: [12.8698, 74.8431],
    planned: false,
    polygon: [[12.8730,74.8380],[12.8730,74.8490],[12.8660,74.8490],[12.8660,74.8380]],
  },
  {
    id: 'bejai',
    label: 'Bejai',
    fillColor: 'rgba(220,38,38,0.10)',
    strokeColor: '#dc2626',
    center: [12.8774, 74.8380],
    planned: false,
    polygon: [[12.8810,74.8330],[12.8810,74.8430],[12.8730,74.8430],[12.8730,74.8330]],
  },
  {
    id: 'balmatta',
    label: 'Balmatta',
    fillColor: 'rgba(220,38,38,0.10)',
    strokeColor: '#dc2626',
    center: [12.8758, 74.8320],
    planned: false,
    polygon: [[12.8800,74.8270],[12.8800,74.8370],[12.8710,74.8370],[12.8710,74.8270]],
  },
  {
    id: 'attavar',
    label: 'Attavar',
    fillColor: 'rgba(156,163,175,0.13)',
    strokeColor: '#9ca3af',
    center: [12.8835, 74.8449],
    planned: true,
    note: 'Expansion Q3 2025',
    polygon: [[12.8870,74.8400],[12.8870,74.8500],[12.8790,74.8500],[12.8790,74.8400]],
  },
  {
    id: 'kadri',
    label: 'Kadri',
    fillColor: 'rgba(156,163,175,0.13)',
    strokeColor: '#9ca3af',
    center: [12.8832, 74.8502],
    planned: true,
    note: 'Expansion Q4 2025',
    polygon: [[12.8870,74.8460],[12.8870,74.8560],[12.8790,74.8560],[12.8790,74.8460]],
  },
  {
    id: 'urwa',
    label: 'Urwa',
    fillColor: 'rgba(156,163,175,0.13)',
    strokeColor: '#9ca3af',
    center: [12.8967, 74.8466],
    planned: true,
    note: 'Expansion Q4 2025',
    polygon: [[12.9010,74.8410],[12.9010,74.8520],[12.8920,74.8520],[12.8920,74.8410]],
  },
  {
    id: 'kankanady',
    label: 'Kankanady',
    fillColor: 'rgba(156,163,175,0.13)',
    strokeColor: '#9ca3af',
    center: [12.8701, 74.8580],
    planned: true,
    note: 'Expansion Q1 2026',
    polygon: [[12.8740,74.8530],[12.8740,74.8640],[12.8660,74.8640],[12.8660,74.8530]],
  },
  {
    id: 'bendoorwell',
    label: 'Bendoorwell',
    fillColor: 'rgba(156,163,175,0.13)',
    strokeColor: '#9ca3af',
    center: [12.8594, 74.8430],
    planned: true,
    note: 'Expansion Q1 2026',
    polygon: [[12.8640,74.8370],[12.8640,74.8480],[12.8550,74.8480],[12.8550,74.8370]],
  },
];

const MANGALURU: [number, number] = [12.8698, 74.8431];

function storeInArea(s: StoreLocation, area: Area) {
  const lats = area.polygon.map(p => p[0]);
  const lngs = area.polygon.map(p => p[1]);
  return s.lat >= Math.min(...lats) && s.lat <= Math.max(...lats)
      && s.lng >= Math.min(...lngs) && s.lng <= Math.max(...lngs);
}

export default function StoreMap() {
  const mapDiv      = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L           = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef      = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polysRef    = useRef<Record<string, any>>({});

  const [loaded,     setLoaded]     = useState(false);
  const [stores,     setStores]     = useState<StoreLocation[]>([]);
  const [activeArea, setActiveArea] = useState<string | null>(null);

  // Fetch live stores
  useEffect(() => {
    fetch('/api/stores/locations')
      .then(r => r.json())
      .then((d: { stores?: StoreLocation[] }) => {
        setStores((d.stores ?? []).filter(s => s.lat && s.lng));
      })
      .catch(() => {});
  }, []);

  // Init map once
  useEffect(() => {
    if (mapRef.current || !mapDiv.current) return;
    let cancelled = false;

    (async () => {
      const Leaflet = (await import('leaflet')).default;
      if (cancelled || mapRef.current || !mapDiv.current) return;
      L.current = Leaflet;

      const map = Leaflet.map(mapDiv.current, {
        center: MANGALURU, zoom: 13,
        scrollWheelZoom: false, attributionControl: false,
      });
      mapRef.current = map;

      Leaflet.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19 }
      ).addTo(map);

      // Draw area polygons
      AREAS.forEach(area => {
        const poly = Leaflet.polygon(area.polygon, {
          color:       area.strokeColor,
          fillColor:   area.fillColor,
          fillOpacity: 1,
          weight:      area.planned ? 1.5 : 2,
          dashArray:   area.planned ? '6 4' : undefined,
        }).addTo(map);

        poly.bindTooltip(area.label, {
          permanent: true, direction: 'center',
          className: 'alive-area-label',
        });

        poly.on('click', () => setActiveArea(prev => prev === area.id ? null : area.id));
        polysRef.current[area.id] = poly;
      });

      // Marker layer group
      markersRef.current = Leaflet.layerGroup().addTo(map);
      setLoaded(true);
    })();

    return () => { cancelled = true; };
  }, []);

  // Redraw markers when stores or filter changes
  useEffect(() => {
    if (!markersRef.current || !L.current) return;
    const Leaflet = L.current;
    markersRef.current.clearLayers();

    const liveIcon = Leaflet.divIcon({
      className: '',
      html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#dc2626;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.28);transform:rotate(-45deg)"></div>`,
      iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -30],
    });

    const visible = activeArea
      ? stores.filter(s => { const a = AREAS.find(a => a.id === activeArea); return a ? storeInArea(s, a) : true; })
      : stores;

    visible.forEach(s => {
      Leaflet.marker([s.lat, s.lng], { icon: liveIcon })
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:150px;padding:2px 0">
            <p style="font-weight:700;font-size:13px;margin:0 0 3px">${s.storeName}</p>
            ${s.locality ? `<p style="font-size:11px;color:#6b7280;margin:0 0 6px">${s.locality}${s.city ? `, ${s.city}` : ''}</p>` : ''}
            <span style="display:inline-block;background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;letter-spacing:.05em">LIVE</span>
          </div>
        `, { maxWidth: 220 })
        .addTo(markersRef.current);
    });
  }, [stores, activeArea]);

  // Highlight selected polygon
  useEffect(() => {
    if (!loaded) return;
    AREAS.forEach(area => {
      const poly = polysRef.current[area.id];
      if (!poly) return;
      const isActive = activeArea === area.id;
      poly.setStyle({
        color:       area.strokeColor,
        fillColor:   isActive
          ? (area.planned ? 'rgba(156,163,175,0.32)' : 'rgba(220,38,38,0.24)')
          : area.fillColor,
        fillOpacity: 1,
        weight:      isActive ? 3 : (area.planned ? 1.5 : 2),
      });
    });
  }, [activeArea, loaded]);

  const liveAreas = AREAS.filter(a => !a.planned);
  const soonAreas = AREAS.filter(a => a.planned);
  const activeAreaObj = AREAS.find(a => a.id === activeArea);

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
            Live screens serve shoppers across Mangaluru. Select an area to explore — or contact us
            to fast-track your neighbourhood.
          </p>
        </div>

        {/* Area panel + Map */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left panel */}
          <div className="lg:w-56 xl:w-64 flex-shrink-0 space-y-5">

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-1">Live areas</p>
              {liveAreas.map(area => {
                const count = stores.filter(s => storeInArea(s, area)).length;
                return (
                  <button key={area.id}
                    onClick={() => setActiveArea(p => p === area.id ? null : area.id)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                      activeArea === area.id
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:border-primary/30 hover:bg-muted/30'
                    }`}
                  >
                    <div className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{area.label}</p>
                      <p className="text-[10px] text-muted-foreground">{count} store{count !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-1">Coming soon</p>
              {soonAreas.map(area => (
                <button key={area.id}
                  onClick={() => setActiveArea(p => p === area.id ? null : area.id)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                    activeArea === area.id
                      ? 'border-gray-400 bg-gray-50 shadow-sm'
                      : 'border-border bg-card hover:border-gray-300 hover:bg-muted/20'
                  }`}
                >
                  <div className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{area.label}</p>
                    <p className="text-[10px] text-muted-foreground">{area.note}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Stats */}
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-4 space-y-2.5">
              {[
                ['Live stores',   stores.length || '—'],
                ['Areas covered', liveAreas.length],
                ['Expanding to',  `${soonAreas.length} zones`],
                ['City',          'Mangaluru'],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-sm font-bold text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative rounded-2xl border border-border overflow-hidden bg-muted/20" style={{ height: 520 }}>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div ref={mapDiv} style={{ height: '100%', width: '100%' }} />

            {/* Active area badge */}
            {activeAreaObj && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] pointer-events-none">
                <div className="flex items-center gap-2 rounded-full border border-border bg-background/95 backdrop-blur-sm px-4 py-1.5 shadow-sm pointer-events-auto">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${activeAreaObj.planned ? 'border-2 border-dashed border-gray-400' : 'bg-primary'}`} />
                  <span className="text-xs font-bold text-foreground">{activeAreaObj.label}</span>
                  <button onClick={() => setActiveArea(null)} className="ml-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors text-xs">✕</button>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 right-4 z-[400] flex flex-col gap-1.5 rounded-xl border border-border bg-background/95 backdrop-blur-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-[10px] font-semibold text-foreground">Live ALIVE screen</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-5 flex-shrink-0 border border-primary/50 bg-primary/10 rounded-sm" />
                <span className="text-[10px] font-semibold text-muted-foreground">Active area</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-5 flex-shrink-0 border border-dashed border-gray-400 bg-gray-100 rounded-sm" />
                <span className="text-[10px] font-semibold text-muted-foreground">Expansion zone</span>
              </div>
            </div>

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
          <a href="/store"
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <MapPin className="h-4 w-4" /> Join the network
          </a>
        </div>
      </div>
    </section>
  );
}
