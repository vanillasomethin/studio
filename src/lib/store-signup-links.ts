// Gated store-signup links, one per slot pricing tier.
//
// A store's tier decides both what brands pay per slot and what the partner is
// paid, so it can't be self-selected on a public form — each tier gets its own
// secret link and the key is re-validated server-side at save time.
//
//   /store?tier=<STORE_SIGNUP_KEY_STANDARD>   → standard
//   /store?tier=<STORE_SIGNUP_KEY_GROWTH>     → growth
//   /store?tier=<STORE_SIGNUP_KEY_FLAGSHIP>   → flagship
//
// No key (or an unrecognised one) falls back to standard, so the plain /store
// link keeps working exactly as before.

import type { SlotTier } from './slot-pricing';

export const TIER_KEY_ENV: Record<SlotTier, string> = {
  standard: 'STORE_SIGNUP_KEY_STANDARD',
  growth:   'STORE_SIGNUP_KEY_GROWTH',
  flagship: 'STORE_SIGNUP_KEY_FLAGSHIP',
};

export const TIER_LABEL: Record<SlotTier, string> = {
  standard: 'Standard',
  growth:   'Growth',
  flagship: 'Flagship',
};

/**
 * Resolves a signup key to its tier. Server-only — reads env.
 * Returns 'standard' for a missing/unknown key, never throws.
 * An unset env var never matches, so a blank key can't unlock a tier.
 */
export function tierForSignupKey(key: string | null | undefined): SlotTier {
  if (!key) return 'standard';
  for (const tier of ['flagship', 'growth', 'standard'] as SlotTier[]) {
    const expected = process.env[TIER_KEY_ENV[tier]];
    if (expected && key === expected) return tier;
  }
  return 'standard';
}

/** True when the key actually matched a configured tier link (vs falling back). */
export function isConfiguredTierKey(key: string | null | undefined): boolean {
  if (!key) return false;
  return (['standard', 'growth', 'flagship'] as SlotTier[])
    .some((t) => { const e = process.env[TIER_KEY_ENV[t]]; return !!e && key === e; });
}
