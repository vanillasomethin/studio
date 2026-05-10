'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';

// Dynamically import leaflet only on client — avoids SSR window errors
async function loadLeaflet() {
  const L = (await import('leaflet')).default;
  // @ts-expect-error — CSS import has no type declaration
  await import('leaflet/dist/leaflet.css');
  // Fix default marker icon path broken by webpack
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
  return L;
}

async function reverseGeocode(lat: number, lng: number) {
  const res  = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    { headers: { 'Accept-Language': 'en' } },
  );
  const data = await res.json();
  const a    = data.address ?? {};
  return {
    locality: a.suburb || a.neighbourhood || a.village || a.county || a.state_district || '',
    pincode:  (a.postcode ?? '').replace(/\D/g, '').slice(0, 6),
    city:     a.city || a.town || a.municipality || a.state_district || '',
  };
}

type Props = {
  lat: string; lng: string;
  onLocation: (lat: string, lng: string, locality: string, pincode: string, city: string) => void;
};

export default function MapPicker({ lat, lng, onLocation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef    = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError,   setGeoError]   = useState('');
  const [mounted,    setMounted]    = useState(false);

  // Default: Mangaluru
  const initLat = lat ? parseFloat(lat) : 12.8698;
  const initLng = lng ? parseFloat(lng) : 74.8431;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current || mapRef.current) return;

    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true }).setView([initLat, initLng], lat ? 17 : 13);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);
      marker.bindPopup('<b>Drag to pin your exact shop location</b>').openPopup();

      const onMove = async () => {
        const { lat: newLat, lng: newLng } = marker.getLatLng();
        try {
          const { locality, pincode, city } = await reverseGeocode(newLat, newLng);
          onLocation(String(newLat), String(newLng), locality, pincode, city);
        } catch {
          onLocation(String(newLat), String(newLng), '', '', '');
        }
      };

      marker.on('dragend', onMove);
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng([e.latlng.lat, e.latlng.lng]);
        onMove();
      });

      mapRef.current    = map;
      markerRef.current = marker;

      // If we already have coords, fire once
      if (lat && lng) onMove();
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Update marker when coords change externally (e.g. GPS detect)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !lat || !lng) return;
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    markerRef.current.setLatLng([parsedLat, parsedLng]);
    mapRef.current.setView([parsedLat, parsedLng], 17, { animate: true });
  }, [lat, lng]);

  const detectGPS = () => {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported.'); return; }
    setGeoLoading(true); setGeoError('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const { locality, pincode, city } = await reverseGeocode(latitude, longitude);
          onLocation(String(latitude), String(longitude), locality, pincode, city);
        } catch {
          onLocation(String(latitude), String(longitude), '', '', '');
        }
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.code === 1 ? 'Location access denied.' : 'Could not get location.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  if (!mounted) return (
    <div className="h-64 rounded-2xl bg-white/5 border border-white/20 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-white/40" />
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Map */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-white/20" style={{ height: 260 }}>
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
        {/* Overlay hint */}
        {!lat && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="rounded-full bg-black/70 backdrop-blur px-3 py-1.5 text-xs text-white/80 flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-red-400" /> Tap map or drag pin to set location
            </div>
          </div>
        )}
      </div>

      {/* GPS button */}
      <button
        type="button"
        onClick={detectGPS}
        disabled={geoLoading}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/8 py-2.5 text-xs font-bold text-white/70 hover:border-white/40 hover:text-white transition-all disabled:opacity-50"
      >
        {geoLoading
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Detecting…</>
          : <><Navigation className="h-3.5 w-3.5 text-red-400" /> Use GPS to jump to my location</>
        }
      </button>
      {geoError && <p className="text-xs text-red-300">{geoError}</p>}
      {lat && (
        <p className="text-[10px] text-white/30 flex items-center gap-1">
          <MapPin className="h-3 w-3 text-red-400/60 shrink-0" />
          Pinned: {parseFloat(lat).toFixed(5)}°N, {parseFloat(lng).toFixed(5)}°E
        </p>
      )}
    </div>
  );
}
