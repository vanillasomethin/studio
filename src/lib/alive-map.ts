// One way to make a map. Every ALIVE map — the homepage network map, the
// /advertise network map, the brand-onboarding screen picker and the admin
// fleet map — is created here, so a brand who lands on the site, clicks
// Advertise and then starts onboarding sees the SAME city three times: same
// basemap, same red locality boundaries, same controls in the same corners.
// Each page still draws its own pins on top; only the map underneath is shared.
//
// ─── Why fadeAnimation is off ────────────────────────────────────────────────
//
// Leaflet fades a tile in by setting it to opacity 0 on load and then walking it
// up to 1 from a requestAnimationFrame loop (`GridLayer._updateOpacity`). A tab
// that is backgrounded, throttled or otherwise starved never fires rAF, so the
// tiles finish downloading and STAY invisible — the map paints its vector
// layers (ward boundaries) and its markers (CSS-positioned divIcons), but no
// basemap. That is the "white map with red lines and pins" the founder
// reported on /brand-onboarding while the homepage map, loaded in a foreground
// tab, looked normal: same code, different rAF luck, so the maps looked like
// different features. Killing the fade paints every tile at full opacity the
// moment it arrives, with no frame callback in the path.
//
// This is the same class of bug as the animation stall guards in
// src/lib/use-animation-stall-guard.ts — a suspended renderer must never be the
// difference between a page that works and a page that looks broken.

import { BASEMAP } from './map-tiles';
import { addLocalityBoundaries } from './locality-boundaries';

export type AliveMapInit = {
  /** First frame. Callers that know their pins should still fitToPins() after. */
  center: [number, number];
  zoom: number;
  /** One-finger drag over a mid-form map is a scroll trap — the picker turns
   *  dragging off on phones. Everything else leaves it on. */
  dragging?: boolean;
  /** Ward hairlines. On by default; there is no map here that wants them off. */
  boundaries?: boolean;
};

/**
 * Create the shared ALIVE map on `el`: basemap tiles, locality boundaries,
 * zoom control bottom-right, attribution bottom-left.
 *
 * `isAlive` is checked after the boundaries' async fetch resolves — pass the
 * same guard the caller uses for its own late work (`() => mapRef.current ===
 * map`), so a map that unmounted mid-fetch is never touched.
 */
export function createAliveMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  L: any,
  el: HTMLElement,
  init: AliveMapInit,
  isAlive?: () => boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const map = L.map(el, {
    center: init.center,
    zoom: init.zoom,
    // Chrome is added below so every map carries it in the same corner.
    zoomControl: false,
    attributionControl: false,
    // A map that eats the page scroll is unusable on a phone.
    scrollWheelZoom: false,
    dragging: init.dragging ?? true,
    // See the note at the top of this file — this is load-bearing.
    fadeAnimation: false,
  });

  L.tileLayer(BASEMAP.url, { maxZoom: BASEMAP.maxZoom }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  // `prefix` replaces Leaflet's own "Leaflet" credit with the tile provider's,
  // which is the line OSM's tile policy asks us to keep visible.
  L.control.attribution({ position: 'bottomleft', prefix: BASEMAP.attribution }).addTo(map);

  if (init.boundaries !== false) void addLocalityBoundaries(L, map, isAlive);

  return map;
}

/**
 * Frame a map on the pins it carries — the same padding and zoom ceiling on
 * every page, so the network reads at one scale wherever you meet it. A single
 * pin keeps the caller's zoom (fitting one point would slam to maxZoom).
 */
export function fitToPins(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  L: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layers: any[],
): void {
  if (layers.length < 2) return;
  const bounds = L.featureGroup(layers).getBounds();
  if (!bounds.isValid()) return;
  map.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
}

/** Map chrome, identical on every page: the credit line and the zoom buttons.
 *  Append to whatever <style> the map component already ships. */
export const ALIVE_MAP_CSS =
  `.leaflet-control-zoom{border:1px solid #e5e5e5 !important;border-radius:8px !important;overflow:hidden;box-shadow:none !important;}
.leaflet-control-zoom a{width:30px !important;height:30px !important;line-height:30px !important;font-size:16px !important;color:#333 !important;}
.leaflet-control-attribution{font-size:10px !important;background:rgba(255,255,255,.7) !important;}`;

// ─── "Areas covered" rings ──────────────────────────────────────────────────
// The homepage's own coverage visualisation, lifted out so any other map
// (Admin → Prospects, so ops can see scouting against what's already covered)
// can draw the same dashed red pincode rings instead of re-deriving them.

/** A pincode area from /geo/pincode-areas-mangaluru.json — official data.gov.in
 *  boundaries, vendored and simplified (see the file's attribution key). */
type AreaFeature = {
  properties: { Pincode?: string; Office_Name?: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
};

/** A point worth checking against the coverage areas — anything with a
 *  location and, optionally, a claimed pincode. */
export type CoveragePoint = { lat: number; lng: number; pincode?: string | null };

// Ray-cast a point against the outer ring(s) of a polygon/multipolygon. Holes
// are ignored — for "does this point sit inside this pincode area" that's plenty.
function areaContains(geom: AreaFeature['geometry'], lat: number, lng: number): boolean {
  const rings: number[][][] =
    geom.type === 'Polygon'
      ? [(geom.coordinates as number[][][])[0]]
      : (geom.coordinates as number[][][][]).map((poly) => poly[0]);
  return rings.some((ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}

// "Kodiyalbail S.O" → "Kodiyalbail" — office-type suffixes are postal jargon,
// not area names.
function areaName(f: AreaFeature): string {
  const office = (f.properties.Office_Name ?? '').replace(/\s+[HSB]\.O\.?$/i, '').trim();
  return office || f.properties.Pincode || 'Area';
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Build a Leaflet GeoJSON layer of dashed red rings around every pincode area
 * that's covered — a pincode qualifies when a point claims it OR geometrically
 * sits inside it, so a blank/mistyped pincode can't hide a covered area. Not
 * added to the map — the caller does that (and removes the previous layer
 * first), matching how it already manages its own marker layers.
 *
 * Returns null when there's nothing to draw (no area data, or no points).
 */
export function buildCoverageRings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  L: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  areas: any,
  points: CoveragePoint[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (!areas?.features?.length || points.length === 0) return null;
  const claimed = new Set(
    points.map((p) => (p.pincode ?? '').trim()).filter((p) => /^\d{6}$/.test(p)),
  );
  return L.geoJSON(areas, {
    filter: (f: AreaFeature) =>
      (!!f.properties.Pincode && claimed.has(f.properties.Pincode)) ||
      points.some((p) => areaContains(f.geometry, p.lat, p.lng)),
    style: {
      color: '#dc2626', weight: 1, opacity: 0.5, dashArray: '4 4',
      fillColor: '#dc2626', fillOpacity: 0.04,
    },
    onEachFeature: (f: AreaFeature, layer: { bindTooltip(content: string, options?: object): void }) => {
      layer.bindTooltip(
        `${escHtml(areaName(f))} · ${escHtml(f.properties.Pincode ?? '')}`,
        { sticky: true, direction: 'top', className: 'alive-zone-tip' },
      );
    },
  });
}
