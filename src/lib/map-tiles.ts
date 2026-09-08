// Basemap tiles for every map in the app — import BASEMAP, never paste a tile URL.
//
// CARTO's raster basemaps (basemaps.cartocdn.com) now require an API key. With
// none, every tile the server returns is an image that reads "API key required",
// which is exactly what a map here shows the moment the key is missing. The key
// is free up to 5M tile requests a month and needs no account —
// https://carto.com/basemaps/apikey — and goes in NEXT_PUBLIC_CARTO_API_KEY.
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

// ─── Two basemaps, because the maps do two different jobs ─────────────────────
//
// BASEMAP above is the PRESENTATION style: CARTO Voyager, muted and uncluttered,
// which is what a "here is the network" map wants — the pins are the content and
// the basemap should stay out of their way.
//
// That same restraint is wrong for DROPPING A PIN. CARTO's raster style omits
// most building names and small landmarks, and a partner placing their shop has
// nothing to aim at, so pins landed in the wrong place. OSM's standard style
// renders building names, shop names and minor landmarks at high zoom, which is
// exactly what someone needs to say "that one, next to the temple".
//
// Hence two exports rather than one. The rule from CLAUDE.md is unchanged and
// still the point: never paste a tile URL into a component — import the basemap
// whose JOB matches the map you are building.
//
//   BASEMAP        → marketing network map, admin fleet/monitoring overview,
//                    the brand onboarding network map. Looking, not placing.
//   PINNING_BASEMAP → store registration, admin "move this store's pin".
//                    Placing a point on a real building.

export const PINNING_BASEMAP: Basemap = {
  provider: 'osm',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap contributors',
  // 19 is OSM's limit; it is also where building and shop labels appear, which
  // is the entire reason this map uses OSM.
  maxZoom: 19,
};
