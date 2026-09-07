// Sanitiser for client-supplied preferredStoreIds (brand-onboarding map picks).
// Shared by /api/campaigns/save and /api/razorpay/verify-payment — both routes
// take this array from an unauthenticated body, so the shape filter is the only
// thing standing between hostile input and a DB row ops reads.
//
// Two id shapes are REAL in prod (audited 2026-09-02): Prisma's cuid() default
// covers new rows, but every Store row migrated from the legacy Redis store has
// a randomUUID id. A cuid-only filter silently dropped those, losing the
// brand's map picks — keep both shapes accepted.
//
// No imports on purpose: scripts/verify-store-ids.mjs loads this file directly
// via --experimental-strip-types, which cannot resolve '@/' aliases.

const CUID_SHAPE = /^[a-z0-9]{20,32}$/;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isStoreIdShaped(v: unknown): v is string {
  return typeof v === 'string' && (CUID_SHAPE.test(v) || UUID_SHAPE.test(v));
}

// Truncate BEFORE per-element work so an oversized hostile array costs nothing;
// cap the survivors at the self-serve screen ceiling. Unknown-but-well-shaped
// ids are tolerated: ops sees names resolved from the DB, and anything
// unresolvable simply doesn't render.
export function sanitizeStoreIds(input: unknown): string[] {
  return Array.isArray(input)
    ? input.slice(0, 200).filter(isStoreIdShaped).slice(0, 50)
    : [];
}
