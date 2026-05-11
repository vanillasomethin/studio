'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, LocateFixed, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

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
  const [geoSuccess, setGeoSuccess] = useState(false);
  const [mounted,    setMounted]    = useState(false);

  // Default: Mangaluru
  const initLat = lat ? parseFloat(lat) : 12.8698;
  const initLng = lng ? parseFloat(lng) : 74.8431;

  useEffect(() => { setMounted(true); }, []);

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
    if (!navigator.geolocation) { setGeoError('Geolocation is not supported by your browser.'); return; }
    setGeoLoading(true); setGeoError(''); setGeoSuccess(false);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const { locality, pincode, city } = await reverseGeocode(latitude, longitude);
          onLocation(String(latitude), String(longitude), locality, pincode, city);
        } catch {
          onLocation(String(latitude), String(longitude), '', '', '');
        }
        setGeoLoading(false);
        setGeoSuccess(true);
        setTimeout(() => setGeoSuccess(false), 3000);
      },
      (err) => {
        setGeoError(
          err.code === 1
            ? 'Location access denied — please drag the pin to your shop manually.'
            : 'Could not detect location. Drag the pin instead.',
        );
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  };

  if (!mounted) return (
    <div className="h-64 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="space-y-2">
      {/* GPS button — above map for maximum visibility on mobile */}
      <button
        type="button"
        onClick={detectGPS}
        disabled={geoLoading}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 py-2.5 text-xs font-bold text-gray-700 hover:text-gray-900 hover:border-gray-300 transition-all disabled:opacity-50"
      >
        {geoLoading ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" /> Detecting your location…</>
        ) : geoSuccess ? (
          <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Location set ✓</>
        ) : (
          <><LocateFixed className="h-3.5 w-3.5 text-red-500" /> Use my current location</>
        )}
      </button>

      {geoError && (
        <div className="flex items-start gap-1.5 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-500" />
          <p className="text-xs text-red-600">{geoError}</p>
        </div>
      )}

      {/* Map */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-200" style={{ height: 240 }}>
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
        {!lat && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="rounded-full bg-black/60 backdrop-blur px-3 py-1.5 text-xs text-white/90 flex items-center gap-1.5 whitespace-nowrap">
              <MapPin className="h-3 w-3 text-red-400" /> Tap map or drag pin to set location
            </div>
          </div>
        )}
      </div>

      {lat && (
        <p className="text-[10px] text-gray-400 flex items-center gap-1">
          <MapPin className="h-3 w-3 text-red-400/60 shrink-0" />
          Pinned: {parseFloat(lat).toFixed(5)}°N, {parseFloat(lng).toFixed(5)}°E
        </p>
      )}
    </div>
  );
}
