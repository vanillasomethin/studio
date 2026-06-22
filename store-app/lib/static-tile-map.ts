// Composites a small raster tile mosaic from CartoDB Voyager — the same
// tile provider already used by the web app's Leaflet map-picker (no API
// key required). Used for the registration screen's location preview;
// the old `staticmap.openstreetmap.de` demo endpoint this replaced is dead.

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
      const sub = 'abcd'[(x + y) % 4];
      tiles.push({
        uri: `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}.png`,
        left: tx * TILE_SIZE - offsetX,
        top: ty * TILE_SIZE - offsetY,
      });
    }
  }
  return tiles;
}
