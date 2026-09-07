// Shop categories for store partners. The slug is what Store.category holds;
// the label is what every UI shows. Admin-set from Admin → Stores → Edit —
// registration doesn't ask for it, so null simply means "not categorised yet"
// (true for the whole pre-feature fleet).
export const STORE_CATEGORIES = [
  { value: 'kirana',      label: 'Kirana / General store' },
  { value: 'supermarket', label: 'Supermarket / Mini-mart' },
  { value: 'bakery',      label: 'Bakery & sweets' },
  { value: 'pharmacy',    label: 'Pharmacy / Medical' },
  { value: 'fruits_veg',  label: 'Fruits & vegetables' },
  { value: 'cafe',        label: 'Café / Eatery' },
  { value: 'electronics', label: 'Electronics & mobile' },
  { value: 'fashion',     label: 'Clothing & fashion' },
  { value: 'stationery',  label: 'Stationery & books' },
  { value: 'hardware',    label: 'Hardware & paints' },
  { value: 'salon',       label: 'Salon & beauty' },
  { value: 'other',       label: 'Other' },
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number]['value'];

export function isStoreCategory(v: string): v is StoreCategory {
  return STORE_CATEGORIES.some((c) => c.value === v);
}

/** Display label for a stored slug; falls back to the raw value so an
 *  out-of-list slug (schema drift) still renders something readable. */
export function storeCategoryLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return STORE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
