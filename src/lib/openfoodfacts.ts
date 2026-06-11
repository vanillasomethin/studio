// Open Food Facts + Open Prices — barcode-based product identity & price lookup.
// Zero setup, no API key, free. Authoritative for products that have a registered
// EAN-13 barcode (the same number printed on Indian FMCG packaging).
//
//   - Open Food Facts  → product name / brand / pack size / image from the barcode
//   - Open Prices      → crowdsourced real-receipt prices (filtered to INR)
//
// Coverage for Indian FMCG is partial — where Open Prices has no INR price we still
// return the verified product identity so admin can confirm the match, then fall
// back to Maxun (Amazon/Flipkart) or the bulk CSV import for the MRP figure.

export type OffPriceCandidate = {
  source: 'openfoodfacts';
  title: string;       // product name (+ location if known)
  price: number;       // rupees
  url?: string;
};

export type OffLookup = {
  found: boolean;
  identity?: { productName?: string; brand?: string; quantity?: string; imageUrl?: string };
  candidates: OffPriceCandidate[];
  note?: string;
};

const OFF_PRODUCT = 'https://world.openfoodfacts.org/api/v2/product';
const OPEN_PRICES = 'https://prices.openfoodfacts.org/api/v1/prices';
const UA = 'ALIVE-Admin/1.0 (wearealive.in)';

// EAN-13 / UPC: 8–14 digits
function normalizeEan(ean: string): string | null {
  const digits = ean.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

async function fetchIdentity(ean: string): Promise<OffLookup['identity'] | undefined> {
  try {
    const res = await fetch(
      `${OFF_PRODUCT}/${ean}.json?fields=product_name,brands,quantity,image_url`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return undefined;
    const json = await res.json() as { status?: number; product?: Record<string, unknown> };
    if (json.status !== 1 || !json.product) return undefined;
    const p = json.product;
    return {
      productName: typeof p.product_name === 'string' ? p.product_name : undefined,
      brand:       typeof p.brands === 'string' ? p.brands : undefined,
      quantity:    typeof p.quantity === 'string' ? p.quantity : undefined,
      imageUrl:    typeof p.image_url === 'string' ? p.image_url : undefined,
    };
  } catch { return undefined; }
}

async function fetchPrices(ean: string, identityName?: string): Promise<OffPriceCandidate[]> {
  try {
    const res = await fetch(
      `${OPEN_PRICES}?product_code=${encodeURIComponent(ean)}&order_by=-date&size=20`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return [];
    const json = await res.json() as {
      items?: { price?: number; currency?: string; date?: string; location_id?: number }[];
    };
    const items = json.items ?? [];
    const seen = new Set<number>();
    const out: OffPriceCandidate[] = [];
    for (const it of items) {
      if (it.currency && it.currency !== 'INR') continue; // India MRP only
      const price = typeof it.price === 'number' ? Math.round(it.price) : null;
      if (price === null || price <= 0 || price >= 1_000_000) continue;
      if (seen.has(price)) continue;
      seen.add(price);
      out.push({
        source: 'openfoodfacts',
        title:  identityName ? `${identityName}${it.date ? ` · ${it.date}` : ''}` : `Receipt price${it.date ? ` · ${it.date}` : ''}`,
        price,
      });
    }
    return out;
  } catch { return []; }
}

// Look up a product by its EAN barcode. Returns verified identity plus any INR
// price candidates found on Open Prices.
export async function lookupByBarcode(rawEan: string): Promise<OffLookup> {
  const ean = normalizeEan(rawEan);
  if (!ean) return { found: false, candidates: [], note: 'No valid EAN barcode on this product. Add one to enable barcode lookup.' };

  const identity = await fetchIdentity(ean);
  const candidates = await fetchPrices(ean, identity?.productName);

  return {
    found: !!identity || candidates.length > 0,
    identity,
    candidates,
    note: candidates.length === 0
      ? (identity ? 'Product verified, but no crowdsourced INR price yet. Use Amazon/Flipkart fetch or enter MRP manually.' : 'Barcode not found on Open Food Facts.')
      : undefined,
  };
}
