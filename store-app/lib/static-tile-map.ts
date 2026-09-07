// Composites a small raster tile mosaic for the registration screen's
// location preview; the old `staticmap.openstreetmap.de` demo endpoint this
// replaced is dead.
//
// CARTO's Voyager tiles — the same provider the web app's Leaflet maps use —
// now require a (free) API key: without one every tile comes back as an image
// reading "API key required". Set EXPO_PUBLIC_CARTO_API_KEY (from
// https://carto.com/basemaps/apikey) to keep the Voyager look; with no key we
// fall back to OpenStreetMap's standard tiles so the preview never shows an
// error. Mirrors NEXT_PUBLIC_CARTO_API_KEY / src/lib/map-tiles.ts on the web.
const CARTO_API_KEY = (process.env.EXPO_PUBLIC_CARTO_API_KEY ?? '').trim();

function tileUri(zoom: number, x: number, y: number): string {
  return CARTO_API_KEY
    ? `https://basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}.png?key=${encodeURIComponent(CARTO_API_KEY)}`
    : `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

const TILE_SIZE = 256;

function lonToWorldX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

function latToWorldY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * TILE_SIZE * 2 ** zoom;
}

export interface StaticMapTile {
  uri: string;
  left: number;
  top: number;
}

/**
 * Returns the tiles needed to fill a `width`x`height` viewport centered
 * exactly on (lat, lon) at the given zoom — the marker can always be drawn
 * dead-center of the viewport since the mosaic is built around it.
 */
export function buildStaticMapTiles(
  lat: number,
  lon: number,
  zoom: number,
  width: number,
  height: number,
): StaticMapTile[] {
  const originX = lonToWorldX(lon, zoom) - width / 2;
  const originY = latToWorldY(lat, zoom) - height / 2;

  const tileX0 = Math.floor(originX / TILE_SIZE);
  const tileY0 = Math.floor(originY / TILE_SIZE);
  const offsetX = originX - tileX0 * TILE_SIZE;
  const offsetY = originY - tileY0 * TILE_SIZE;

  const tilesX = Math.ceil((offsetX + width) / TILE_SIZE);
  const tilesY = Math.ceil((offsetY + height) / TILE_SIZE);

  const tiles: StaticMapTile[] = [];
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x = tileX0 + tx;
      const y = tileY0 + ty;
      tiles.push({
        uri: tileUri(zoom, x, y),
        left: tx * TILE_SIZE - offsetX,
        top: ty * TILE_SIZE - offsetY,
      });
    }
  }
  return tiles;
}
