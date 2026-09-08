// Locality boundaries — the city's real neighbourhood outlines, drawn under a
// map's own data so the network reads against places people know instead of
// bare tiles. Data: /mangaluru-wards.geojson (public/), the 60 Mangaluru City
// Corporation wards vendored since May 2026; each feature names its locality in
// properties.ward_name (+ ward_no).
//
// The styling IS the pre-abb9f98 homepage look, restored on request: red
// hairlines with a 4% red wash, a ward brightening under the cursor, and a red
// mono "Name · Ward N" label at its centre on hover. That commit removed the
// red version as decoration; the founder later asked for exactly this look
// back ("the red boundaries for all the localities"), so don't re-quiet it to
// grey without being asked. Coverage still has its own voice — the homepage's
// dashed pincode rings — and addLocalityBoundaries() sends itself to the back
// of the vector pane so anything stateful always draws above it.

// One fetch per session no matter how many maps mount; a failed fetch clears
// the cache so a later mount can retry instead of pinning null forever.
let wardsPromise: Promise<unknown | null> | null = null;

function loadWards(): Promise<unknown | null> {
  wardsPromise ??= fetch('/mangaluru-wards.geojson')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((data) => {
      if (!data) wardsPromise = null;
      return data;
    });
  return wardsPromise;
}

// Ward names are vendored, not user input — escaped anyway because they land in
// tooltip markup, matching how every map treats popup strings.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Tooltip styling for the hover label — the old look: Leaflet's stock white
 *  tooltip carrying red DM Mono small caps. Append to the map's <style>
 *  alongside its other Leaflet CSS. */
export const LOCALITY_TIP_CSS =
  `.alive-loc-tip{font-family:var(--font-dm-mono),monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;font-weight:600;color:#dc2626;}`;

/**
 * Draw the locality boundaries onto a live Leaflet map. Resolves to the added
 * layer, or null when the data isn't available (the map just stays as it was).
 *
 * The wards fetch is async, so callers whose map can die in the meantime pass
 * `isLive` — checked after the await; when it says no, nothing touches the map.
 * The layer needs no separate teardown: it dies with map.remove().
 */
export async function addLocalityBoundaries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  L: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any,
  isLive?: () => boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const wards = await loadWards();
  if (!wards || (isLive && !isLive())) return null;

  const layer = L.geoJSON(wards, {
    // The before-look, verbatim: brand-red hairlines and a light red wash.
    // The fill doubles as the hover surface that carries the ward's label.
    style: {
      color: '#dc2626', weight: 1.5, opacity: 0.5,
      fillColor: '#dc2626', fillOpacity: 0.04,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onEachFeature: (f: any, l: any) => {
      const name = String(f?.properties?.ward_name ?? '').trim();
      const no   = String(f?.properties?.ward_no ?? '').trim();
      if (!name) return;
      l.bindTooltip(
        esc(no ? `${name} · Ward ${no}` : name),
        { permanent: false, direction: 'center', opacity: 1, className: 'alive-loc-tip' },
      );
      // The ward under the cursor brightens, exactly as it used to.
      l.on('mouseover', () => l.setStyle({ fillOpacity: 0.14, opacity: 0.75 }));
      l.on('mouseout',  () => l.setStyle({ fillOpacity: 0.04, opacity: 0.5  }));
    },
  });
  layer.addTo(map);
  // Reference lines sit under every other vector layer, however late they load.
  layer.bringToBack();
  return layer;
}
