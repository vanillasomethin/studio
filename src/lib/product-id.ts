// Product ID format: CAT-BRAND-SEQ  e.g. GRO-KC-001
// group_id = CAT-BRAND  e.g. GRO-KC (shared by variants)

export const CATEGORY_CODES: Record<string, string> = {
  GRO: 'Grocery',
  STA: 'Stationery',
  CHL: 'Chilled',
  HNB: 'Health & Beauty',
  NFD: 'Non Food',
  HHD: 'Household',
  BAK: 'Bakery & Fresh',
  TOY: 'Toys',
  LUG: 'Luggage',
  HLN: 'Home Linen',
  FSH: 'Fashion',
  DAI: 'Dairy',
  FNV: 'Fruits & Veg',
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_CODES).map(([code, label]) => ({ code, label }));

export const UNIT_TYPES = ['ml', 'g', 'count', 'ltr', 'kg', 'pcs', 'pack'] as const;

// Derive a 2-4 char brand slug from the brand name
export function brandSlug(brand: string): string {
  return brand
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4) || 'XX';
}

// groupId = CAT-BRANDSLUG  e.g. GRO-KC
export function makeGroupId(category: string, brand: string): string {
  return `${category.toUpperCase()}-${brandSlug(brand)}`;
}

// productId = CAT-BRANDSLUG-SEQ  e.g. GRO-KC-001
export function makeProductId(category: string, brand: string, seq: number): string {
  return `${makeGroupId(category, brand)}-${String(seq).padStart(3, '0')}`;
}
