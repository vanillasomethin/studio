// Basemap tiles for every map in the app — import BASEMAP, never paste a tile URL.
//
// CARTO's raster basemaps (basemaps.cartocdn.com) now require an API key. With
// none, every tile the server returns is an image that reads "API key required",
// which is exactly what a map here shows the moment the key is missing. The key
// is free up to 5M tile requests a month and needs no account —
// https://carto.com/basemaps/apikey — and goes in NEXT_PUBLIC_CARTO_API_KEY
// (EXPO_PUBLIC_CARTO_API_KEY for store-app, see store-app/lib/static-tile-map.ts).
//
// With no key we fall back to OpenStreetMap's standard tiles rather than show an
// error. OSM's tile policy asks that this stays light use with attribution kept
// visible, which a site this size is; the CARTO key is still the intended setup.
//
// No imports on purpose: this must stay safe to evaluate anywhere, including SSG.

const CARTO_API_KEY = (process.env.NEXT_PUBLIC_CARTO_API_KEY ?? '').trim();

export type Basemap = {
  url: string;
  attribution: string;
  maxZoom: number;
  /** Which provider is live — for a debug label or a test, never for logic. */
  provider: 'carto' | 'osm';
};

export const BASEMAP: Basemap = CARTO_API_KEY
  ? {
      provider: 'carto',
      // {r} lets Leaflet ask for @2x tiles on retina screens.
      url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_API_KEY)}`,
      attribution: '© OpenStreetMap contributors © CARTO',
      maxZoom: 20,
    }
  : {
      provider: 'osm',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    };
