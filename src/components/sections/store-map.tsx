'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

type StoreLocation = {
  id: string;
  storeName: string;
  locality: string | null;
  city: string | null;
  lat: number;
  lng: number;
  status: 'live';
};

type Ward = {
  wardNo: number;
  wardName: string;
  storeCount: number;
};

// Fallback neighbourhood zones if ArcGIS is unreachable
const FALLBACK_GEOJSON = {
  type: 'FeatureCollection' as const,
  features: [
    { type: 'Feature', properties: { WARD_NO: 0, WARD_NAME: 'Hampankatta' }, geometry: { type: 'Polygon', coordinates: [[[74.838,12.873],[74.849,12.873],[74.849,12.866],[74.838,12.866],[74.838,12.873]]] } },
    { type: 'Feature', properties: { WARD_NO: 0, WARD_NAME: 'Bejai'        }, geometry: { type: 'Polygon', coordinates: [[[74.833,12.881],[74.843,12.881],[74.843,12.873],[74.833,12.873],[74.833,12.881]]] } },
    { type: 'Feature', properties: { WARD_NO: 0, WARD_NAME: 'Balmatta'     }, geometry: { type: 'Polygon', coordinates: [[[74.827,12.880],[74.837,12.880],[74.837,12.871],[74.827,12.871],[74.827,12.880]]] } },
    { type: 'Feature', properties: { WARD_NO: 0, WARD_NAME: 'Attavar'      }, geometry: { type: 'Polygon', coordinates: [[[74.840,12.887],[74.850,12.887],[74.850,12.879],[74.840,12.879],[74.840,12.887]]] } },
    { type: 'Feature', properties: { WARD_NO: 0, WARD_NAME: 'Kadri'        }, geometry: { type: 'Polygon', coordinates: [[[74.846,12.887],[74.856,12.887],[74.856,12.879],[74.846,12.879],[74.846,12.887]]] } },
    { type: 'Feature', properties: { WARD_NO: 0, WARD_NAME: 'Urwa'         }, geometry: { type: 'Polygon', coordinates: [[[74.841,12.901],[74.852,12.901],[74.852,12.892],[74.841,12.892],[74.841,12.901]]] } },
    { type: 'Feature', properties: { WARD_NO: 0, WARD_NAME: 'Kankanady'    }, geometry: { type: 'Polygon', coordinates: [[[74.853,12.874],[74.864,12.874],[74.864,12.866],[74.853,12.866],[74.853,12.874]]] } },
    { type: 'Feature', properties: { WARD_NO: 0, WARD_NAME: 'Bendoorwell'  }, geometry: { type: 'Polygon', coordinates: [[[74.837,12.864],[74.848,12.864],[74.848,12.855],[74.837,12.855],[74.837,12.864]]] } },
    { type: 'Feature', properties: { WARD_NO: 0, WARD_NAME: 'Falnir'       }, geometry: { type: 'Polygon', coordinates: [[[74.843,12.875],[74.853,12.875],[74.853,12.867],[74.843,12.867],[74.843,12.875]]] } },
    { type: 'Feature', properties: { WARD_NO: 0, WARD_NAME: 'Kodialbail'   }, geometry: { type: 'Polygon', coordinates: [[[74.831,12.875],[74.841,12.875],[74.841,12.867],[74.831,12.867],[74.831,12.875]]] } },
    { type: 'Feature', properties: { WARD_NO: 0, WARD_NAME: 'Kudroli'      }, geometry: { type: 'Polygon', coordinates: [[[74.834,12.868],[74.842,12.868],[74.842,12.861],[74.834,12.861],[74.834,12.868]]] } },
    { type: 'Feature', properties: { WARD_NO: 0, WARD_NAME: 'Mangaladevi'  }, geometry: { type: 'Polygon', coordinates: [[[74.828,12.867],[74.836,12.867],[74.836,12.860],[74.828,12.860],[74.828,12.867]]] } },
  ],
};

// Attempt to fetch the real MCC ward GeoJSON from ArcGIS Hub
// The webmap ID is from the embed: a6217443465847d9b22c2b377dd7eaf3
async function fetchWardGeoJSON() {
  // Try ArcGIS Hub dataset API (public, no auth needed for public items)
  const endpoints = [
    'https://hub.arcgis.com/api/v3/datasets/a6217443465847d9b22c2b377dd7eaf3_0/downloads/metadata?redirect=true&token=',
    'https://opendata.arcgis.com/api/v3/datasets/a6217443465847d9b22c2b377dd7eaf3_0/downloads/data?spatialRefId=4326&where=1%3D1&geometry=&outSR=4326&f=geojson',
  ];

  // Primary: ArcGIS Hub GeoJSON download API
  try {
    const res = await fetch(
      `https://opendata.arcgis.com/api/v3/datasets/a6217443465847d9b22c2b377dd7eaf3_0/downloads/data?spatialRefId=4326&f=geojson`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const json = await res.json();
      if (json?.features?.length) return json;
    }
  } catch { /* fall through */ }

  // Secondary: ArcGIS Hub standard query
  try {
    const res = await fetch(
      `https://services1.arcgis.com/0MSEUqKaxRlEPj5g/arcgis/rest/services/nceas-fishing/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const json = await res.json();
      if (json?.features?.length) return json;
    }
  } catch { /* fall through */ }

  return null;
}

// Colour ramp — ward index → fill colour (red gradient for live, gray for unserved)
function wardFill(live: boolean, active: boolean) {
  if (active) return live ? 'rgba(220,38,38,0.30)' : 'rgba(107,114,128,0.30)';
  return live ? 'rgba(220,38,38,0.13)' : 'rgba(156,163,175,0.08)';
}

function buildGeoJSON(
  raw: typeof FALLBACK_GEOJSON,
  activeWard: string | null,
  liveWardNames: Set<string>,
) {
  return {
    ...raw,
    features: raw.features.map(f => {
      const name = String(f.properties?.WARD_NAME ?? '');
      const live   = liveWardNames.has(name.toLowerCase());
      const active = activeWard === name;
      return { ...f, properties: { ...f.properties, _live: live, _active: active, _name: name } };
    }),
  };
}

export default function StoreMap() {
  const mapDiv    = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef    = useRef<any>(null);
  const markersRef = useRef<unknown[]>([]);

  const [loaded,      setLoaded]      = useState(false);
  const [dataError,   setDataError]   = useState(false);
  const [stores,      setStores]      = useState<StoreLocation[]>([]);
  const [wardGeoJSON, setWardGeoJSON] = useState<typeof FALLBACK_GEOJSON | null>(null);
  const [wards,       setWards]       = useState<Ward[]>([]);
  const [activeWard,  setActiveWard]  = useState<string | null>(null);

  // Fetch stores
  useEffect(() => {
    fetch('/api/stores/locations')
      .then(r => r.json())
      .then((d: { stores?: StoreLocation[] }) =>
        setStores((d.stores ?? []).filter(s => s.lat && s.lng))
      )
      .catch(() => {});
  }, []);

  // Fetch ward GeoJSON (client-side so ArcGIS is reachable)
  useEffect(() => {
    fetchWardGeoJSON()
      .then(data => {
        if (data) {
          setWardGeoJSON(data);
        } else {
          setWardGeoJSON(FALLBACK_GEOJSON);
          setDataError(true);
        }
      })
      .catch(() => {
        setWardGeoJSON(FALLBACK_GEOJSON);
        setDataError(true);
      });
  }, []);

  // Build ward list from GeoJSON
  useEffect(() => {
    if (!wardGeoJSON) return;
    const list: Ward[] = wardGeoJSON.features.map(f => ({
      wardNo:   Number(f.properties?.WARD_NO ?? 0),
      wardName: String(f.properties?.WARD_NAME ?? 'Ward'),
      storeCount: 0,
    })).sort((a, b) => a.wardNo - b.wardNo || a.wardName.localeCompare(b.wardName));
    setWards(list);
  }, [wardGeoJSON]);

  // Build set of ward names that have live stores
  const liveWardNames = new Set(
    stores.map(s => (s.locality ?? '').toLowerCase()).filter(Boolean)
  );

  // Init MapLibre once
  useEffect(() => {
    if (mapRef.current || !mapDiv.current) return;
    let cancelled = false;

    (async () => {
      const { Map: MLMap } = await import('maplibre-gl');
      if (cancelled || mapRef.current || !mapDiv.current) return;

      const map = new MLMap({
        container:  mapDiv.current,
        style:      'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        center:     [74.868, 12.879],
        zoom:       12,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on('load', () => {
        if (cancelled) return;

        map.addSource('wards', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        map.addLayer({
          id: 'ward-fill', type: 'fill', source: 'wards',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', '_active'], true],
              ['case', ['==', ['get', '_live'], true], 'rgba(220,38,38,0.30)', 'rgba(107,114,128,0.30)'],
              ['case', ['==', ['get', '_live'], true], 'rgba(220,38,38,0.13)', 'rgba(156,163,175,0.08)'],
            ],
            'fill-opacity': 1,
          },
        });

        map.addLayer({
          id: 'ward-outline', type: 'line', source: 'wards',
          paint: {
            'line-color': ['case', ['==', ['get', '_live'], true], '#dc2626', '#9ca3af'],
            'line-width': ['case', ['==', ['get', '_active'], true], 2.5, 1],
            'line-opacity': 0.8,
          },
        });

        map.addLayer({
          id: 'ward-labels', type: 'symbol', source: 'wards',
          minzoom: 13,
          layout: {
            'text-field':        ['get', '_name'],
            'text-size':         10,
            'text-font':         ['Noto Sans Regular'],
            'text-letter-spacing': 0.04,
          },
          paint: {
            'text-color': ['case', ['==', ['get', '_live'], true], '#7f1d1d', '#6b7280'],
            'text-halo-color': 'rgba(255,255,255,0.9)',
            'text-halo-width': 1.5,
          },
        });

        map.on('click', 'ward-fill', e => {
          const name = e.features?.[0]?.properties?._name as string | undefined;
          if (name) setActiveWard(prev => prev === name ? null : name);
        });
        map.on('mouseenter', 'ward-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'ward-fill', () => { map.getCanvas().style.cursor = ''; });

        setLoaded(true);
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Update ward layer when GeoJSON or active/stores change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !wardGeoJSON || !map.getSource('wards')) return;
    const data = buildGeoJSON(wardGeoJSON, activeWard, liveWardNames);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map.getSource('wards') as any).setData(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardGeoJSON, activeWard, stores]);

  // Redraw store markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    import('maplibre-gl').then(({ Popup, Marker }) => {
      markersRef.current.forEach(m => (m as { remove: () => void }).remove());

      const visible = activeWard
        ? stores.filter(s => (s.locality ?? '').toLowerCase().includes(activeWard.toLowerCase()))
        : stores;

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
  }, [stores, activeWard, loaded]);

  // Fly to active ward
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeWard || !wardGeoJSON) return;
    const feat = wardGeoJSON.features.find(f =>
      String(f.properties?.WARD_NAME ?? '') === activeWard
    );
    if (!feat) return;
    // Compute centroid from first polygon ring
    const coords = feat.geometry.coordinates[0] as [number,number][];
    if (!coords?.length) return;
    const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    map.flyTo({ center: [lng, lat], zoom: 14, duration: 600 });
  }, [activeWard, wardGeoJSON]);

  const liveCount = stores.length;
  const activeWardObj = wards.find(w => w.wardName === activeWard);

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
            Live screens serve shoppers across Mangaluru. Click any ward to explore — or contact us
            to fast-track your area.
          </p>
          {dataError && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-fit">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Showing approximate zones — live ward data loading
            </div>
          )}
        </div>

        {/* Panel + Map */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Ward list panel */}
          <div className="lg:w-60 xl:w-64 flex-shrink-0 flex flex-col gap-4">

            {/* Stats */}
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-4 space-y-2.5">
              {([
                ['Live stores',   liveCount || '—'],
                ['Total wards',   wards.length || '60'],
                ['City',          'Mangaluru MCC'],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-sm font-bold text-foreground">{v}</span>
                </div>
              ))}
            </div>

            {/* Scrollable ward list */}
            <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {wards.length ? `${wards.length} Wards` : 'Wards'}
                </p>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
                {wards.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : wards.map(w => {
                  const isLive   = liveWardNames.has(w.wardName.toLowerCase());
                  const isActive = activeWard === w.wardName;
                  return (
                    <button key={w.wardName}
                      onClick={() => setActiveWard(p => p === w.wardName ? null : w.wardName)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-border/40 last:border-0 transition-colors ${
                        isActive ? 'bg-primary/5' : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        isLive ? 'bg-primary' : 'bg-gray-200 border border-gray-300'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                          {w.wardNo > 0 ? `${w.wardNo}. ` : ''}{w.wardName}
                        </p>
                      </div>
                      {isLive && (
                        <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">LIVE</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative rounded-2xl border border-border overflow-hidden bg-muted/20" style={{ height: 560 }}>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div ref={mapDiv} style={{ height: '100%', width: '100%' }} />

            {/* Active ward badge */}
            {activeWardObj && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[10] pointer-events-none">
                <div className="flex items-center gap-2 rounded-full border border-border bg-background/95 backdrop-blur-sm px-4 py-1.5 shadow-sm pointer-events-auto">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                    liveWardNames.has(activeWardObj.wardName.toLowerCase()) ? 'bg-primary' : 'bg-gray-300'
                  }`} />
                  <span className="text-xs font-bold text-foreground">{activeWardObj.wardName}</span>
                  <button onClick={() => { setActiveWard(null); mapRef.current?.flyTo({ center: [74.868, 12.879], zoom: 12, duration: 600 }); }}
                    className="ml-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground">✕</button>
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
                <span className="text-[10px] font-semibold text-muted-foreground">Active ward</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-5 flex-shrink-0 border border-gray-300 bg-gray-100/80 rounded-sm" />
                <span className="text-[10px] font-semibold text-muted-foreground">Unserved ward</span>
              </div>
            </div>

            <div className="absolute bottom-2 left-4 z-[10]">
              <p className="text-[9px] text-muted-foreground/30">© CartoDB · MapLibre · MCC</p>
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
