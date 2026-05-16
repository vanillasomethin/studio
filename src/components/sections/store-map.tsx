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
  center: [number, number]; // [lng, lat] for MapLibre
  planned: boolean;
  note?: string;
  // GeoJSON polygon coordinates [lng, lat][]
  coords: [number, number][];
};

const AREAS: Area[] = [
  {
    id: 'hampankatta',
    label: 'Hampankatta',
    center: [74.8431, 12.8698],
    planned: false,
    coords: [[74.8380,12.8730],[74.8490,12.8730],[74.8490,12.8660],[74.8380,12.8660],[74.8380,12.8730]],
  },
  {
    id: 'bejai',
    label: 'Bejai',
    center: [74.8380, 12.8774],
    planned: false,
    coords: [[74.8330,12.8810],[74.8430,12.8810],[74.8430,12.8730],[74.8330,12.8730],[74.8330,12.8810]],
  },
  {
    id: 'balmatta',
    label: 'Balmatta',
    center: [74.8320, 12.8758],
    planned: false,
    coords: [[74.8270,12.8800],[74.8370,12.8800],[74.8370,12.8710],[74.8270,12.8710],[74.8270,12.8800]],
  },
  {
    id: 'attavar',
    label: 'Attavar',
    center: [74.8449, 12.8835],
    planned: true,
    note: 'Expansion Q3 2025',
    coords: [[74.8400,12.8870],[74.8500,12.8870],[74.8500,12.8790],[74.8400,12.8790],[74.8400,12.8870]],
  },
  {
    id: 'kadri',
    label: 'Kadri',
    center: [74.8502, 12.8832],
    planned: true,
    note: 'Expansion Q4 2025',
    coords: [[74.8460,12.8870],[74.8560,12.8870],[74.8560,12.8790],[74.8460,12.8790],[74.8460,12.8870]],
  },
  {
    id: 'urwa',
    label: 'Urwa',
    center: [74.8466, 12.8967],
    planned: true,
    note: 'Expansion Q4 2025',
    coords: [[74.8410,12.9010],[74.8520,12.9010],[74.8520,12.8920],[74.8410,12.8920],[74.8410,12.9010]],
  },
  {
    id: 'kankanady',
    label: 'Kankanady',
    center: [74.8580, 12.8701],
    planned: true,
    note: 'Expansion Q1 2026',
    coords: [[74.8530,12.8740],[74.8640,12.8740],[74.8640,12.8660],[74.8530,12.8660],[74.8530,12.8740]],
  },
  {
    id: 'bendoorwell',
    label: 'Bendoorwell',
    center: [74.8430, 12.8594],
    planned: true,
    note: 'Expansion Q1 2026',
    coords: [[74.8370,12.8640],[74.8480,12.8640],[74.8480,12.8550],[74.8370,12.8550],[74.8370,12.8640]],
  },
];

function storeInArea(s: StoreLocation, area: Area) {
  const lngs = area.coords.map(c => c[0]);
  const lats  = area.coords.map(c => c[1]);
  return s.lng >= Math.min(...lngs) && s.lng <= Math.max(...lngs)
      && s.lat >= Math.min(...lats) && s.lat <= Math.max(...lats);
}

// Build a GeoJSON FeatureCollection from areas
function areasToGeoJSON(active: string | null) {
  return {
    type: 'FeatureCollection' as const,
    features: AREAS.map(area => ({
      type: 'Feature' as const,
      properties: {
        id:      area.id,
        label:   area.label,
        planned: area.planned,
        active:  area.id === active,
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [area.coords],
      },
    })),
  };
}

export default function StoreMap() {
  const mapDiv     = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef     = useRef<any>(null);
  const markersRef = useRef<unknown[]>([]);

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

  // Init MapLibre once
  useEffect(() => {
    if (mapRef.current || !mapDiv.current) return;
    let cancelled = false;

    (async () => {
      const { Map: MLMap, Popup, Marker } = await import('maplibre-gl');
      if (cancelled || mapRef.current || !mapDiv.current) return;

      const map = new MLMap({
        container:  mapDiv.current,
        style:      'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        center:     [74.8431, 12.8698],
        zoom:       12.5,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on('load', () => {
        if (cancelled) return;

        // ── Area fill layer ───────────────────────────────────────────────────
        map.addSource('areas', {
          type: 'geojson',
          data: areasToGeoJSON(null),
        });

        // Fill
        map.addLayer({
          id:     'area-fill',
          type:   'fill',
          source: 'areas',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'active'],  true],
              ['case', ['==', ['get', 'planned'], true], 'rgba(107,114,128,0.30)', 'rgba(220,38,38,0.22)'],
              ['case', ['==', ['get', 'planned'], true], 'rgba(156,163,175,0.13)', 'rgba(220,38,38,0.11)'],
            ],
            'fill-opacity': 1,
          },
        });

        // Outline
        map.addLayer({
          id:     'area-outline',
          type:   'line',
          source: 'areas',
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'planned'], true], '#9ca3af',
              '#dc2626',
            ],
            'line-width': ['case', ['==', ['get', 'active'], true], 2.5, 1.5],
            'line-dasharray': ['case', ['==', ['get', 'planned'], true], ['literal', [5, 3]], ['literal', [1, 0]]],
          },
        });

        // Labels
        map.addLayer({
          id:     'area-labels',
          type:   'symbol',
          source: 'areas',
          layout: {
            'text-field':        ['get', 'label'],
            'text-size':         11,
            'text-font':         ['Noto Sans Regular'],
            'text-letter-spacing': 0.06,
            'text-transform':    'uppercase',
          },
          paint: {
            'text-color': ['case', ['==', ['get', 'planned'], true], '#9ca3af', '#374151'],
            'text-halo-color': 'rgba(255,255,255,0.9)',
            'text-halo-width': 1.5,
          },
        });

        // Click on area
        map.on('click', 'area-fill', (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) setActiveArea(prev => prev === id ? null : id);
        });
        map.on('mouseenter', 'area-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'area-fill', () => { map.getCanvas().style.cursor = ''; });

        // ── Store markers ─────────────────────────────────────────────────────
        // Store them in a ref so we can update later
        markersRef.current = stores.map(s => {
          const el = document.createElement('div');
          el.style.cssText = 'width:22px;height:22px;border-radius:50% 50% 50% 0;background:#dc2626;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.28);transform:rotate(-45deg);cursor:pointer';

          const popup = new Popup({ maxWidth: '220px', offset: 12 }).setHTML(`
            <div style="font-family:sans-serif;padding:4px 2px">
              <p style="font-weight:700;font-size:13px;margin:0 0 3px">${s.storeName}</p>
              ${s.locality ? `<p style="font-size:11px;color:#6b7280;margin:0 0 6px">${s.locality}${s.city ? `, ${s.city}` : ''}</p>` : ''}
              <span style="display:inline-block;background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;letter-spacing:.05em">LIVE</span>
            </div>
          `);

          return new Marker({ element: el })
            .setLngLat([s.lng, s.lat])
            .setPopup(popup)
            .addTo(map);
        });

        setLoaded(true);
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update area fill when activeArea changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource('areas')) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map.getSource('areas') as any).setData(areasToGeoJSON(activeArea));
  }, [activeArea]);

  // Add/remove markers when stores load (after map ready)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !stores.length) return;

    import('maplibre-gl').then(({ Popup, Marker }) => {
      // Remove old markers
      markersRef.current.forEach((m: unknown) => (m as { remove: () => void }).remove());

      const active = AREAS.find(a => a.id === activeArea);
      const visible = active ? stores.filter(s => storeInArea(s, active)) : stores;

      markersRef.current = visible.map(s => {
        const el = document.createElement('div');
        el.style.cssText = 'width:22px;height:22px;border-radius:50% 50% 50% 0;background:#dc2626;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.28);transform:rotate(-45deg);cursor:pointer';

        const popup = new Popup({ maxWidth: '220px', offset: 12 }).setHTML(`
          <div style="font-family:sans-serif;padding:4px 2px">
            <p style="font-weight:700;font-size:13px;margin:0 0 3px">${s.storeName}</p>
            ${s.locality ? `<p style="font-size:11px;color:#6b7280;margin:0 0 6px">${s.locality}${s.city ? `, ${s.city}` : ''}</p>` : ''}
            <span style="display:inline-block;background:#dc2626;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;letter-spacing:.05em">LIVE</span>
          </div>
        `);

        return new Marker({ element: el })
          .setLngLat([s.lng, s.lat])
          .setPopup(popup)
          .addTo(map);
      });
    });
  }, [stores, activeArea, loaded]);

  const liveAreas = AREAS.filter(a => !a.planned);
  const soonAreas = AREAS.filter(a => a.planned);
  const activeObj = AREAS.find(a => a.id === activeArea);

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

        {/* Panel + Map */}
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

            <div className="rounded-xl border border-border bg-muted/30 px-4 py-4 space-y-2.5">
              {([
                ['Live stores',   stores.length || '—'],
                ['Areas covered', liveAreas.length],
                ['Expanding to',  `${soonAreas.length} zones`],
                ['City',          'Mangaluru'],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-sm font-bold text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Map container */}
          <div className="flex-1 relative rounded-2xl border border-border overflow-hidden bg-muted/20" style={{ height: 520 }}>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div ref={mapDiv} style={{ height: '100%', width: '100%' }} />

            {/* Active badge */}
            {activeObj && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[10] pointer-events-none">
                <div className="flex items-center gap-2 rounded-full border border-border bg-background/95 backdrop-blur-sm px-4 py-1.5 shadow-sm pointer-events-auto">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${activeObj.planned ? 'border-2 border-dashed border-gray-400' : 'bg-primary'}`} />
                  <span className="text-xs font-bold text-foreground">{activeObj.label}</span>
                  <button onClick={() => setActiveArea(null)} className="ml-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground">✕</button>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 right-4 z-[10] flex flex-col gap-1.5 rounded-xl border border-border bg-background/95 backdrop-blur-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-[10px] font-semibold text-foreground">Live ALIVE screen</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-5 flex-shrink-0 border border-primary/50 bg-primary/10 rounded-sm" />
                <span className="text-[10px] font-semibold text-muted-foreground">Live area</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-5 flex-shrink-0 border border-dashed border-gray-400 bg-gray-100 rounded-sm" />
                <span className="text-[10px] font-semibold text-muted-foreground">Expansion zone</span>
              </div>
            </div>

            <div className="absolute bottom-2 left-4 z-[10]">
              <p className="text-[9px] text-muted-foreground/30">© CartoDB · MapLibre · OpenStreetMap</p>
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
