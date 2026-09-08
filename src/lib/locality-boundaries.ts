// Locality boundaries — the city's real neighbourhood outlines, drawn as quiet
// hairlines under a map's own data so the network reads against places people
// know instead of bare tiles. Data: /mangaluru-wards.geojson (public/), the 60
// Mangaluru City Corporation wards vendored since May 2026; each feature names
// its locality in properties.ward_name.
//
// This layer is reference, not state: solid grey hairlines with no fill wash,
// locality name on hover. Coverage keeps its own visual language (the homepage's
// red dashed pincode rings) — addLocalityBoundaries() sends itself to the back
// of the vector pane so anything stateful always draws above it. An earlier
// life of these wards was removed for being loud (red lines + red wash over the
// whole map); the styling here is deliberately the opposite, so keep it quiet.

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

/** Tooltip styling for the hover name — grey, so coverage's red tips stay the
 *  louder voice. Append to the map's <style> alongside its other Leaflet CSS. */
export const LOCALITY_TIP_CSS =
  `.alive-loc-tip{font-family:var(--font-dm-mono),monospace;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#4b5563;background:#fff;border:1px solid rgba(107,114,128,.35);border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.10);padding:3px 8px;}
.alive-loc-tip::before{display:none;}`;

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
    // Solid slate hairlines: continuous lines are what keep 60 localities
    // legible at city zoom, while the grey stays clearly quieter than the red
    // coverage rings (whose '4 4' red dash remains theirs alone). fill stays
    // on at zero opacity: it's what lets the interior of a locality catch the
    // hover for its name without painting any wash on the map.
    style: {
      color: '#475569', weight: 1.5, opacity: 0.5,
      fill: true, fillColor: '#475569', fillOpacity: 0,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onEachFeature: (f: any, l: { bindTooltip(content: string, options?: object): void }) => {
      const name = String(f?.properties?.ward_name ?? '').trim();
      if (name) {
        l.bindTooltip(esc(name), { sticky: true, direction: 'top', className: 'alive-loc-tip' });
      }
    },
  });
  layer.addTo(map);
  // Reference lines sit under every other vector layer, however late they load.
  layer.bringToBack();
  return layer;
}
