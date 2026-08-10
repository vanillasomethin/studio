// Shared per-device video rendition tier — see prisma schema RenditionTier /
// Device.renditionTier for the "why". Used by /api/device/events + /api/devices/[id]/test-play
// (downgrade on a real failure signal) and /api/device/plan (forwarded to the player,
// which already owns rendition *selection* via its local decoder-capability heuristic —
// see DecoderCapabilities.preferHevc() in the Android player. The tier only comes into
// play as a hard override once a device has been downgraded off the HEVC default:
// H264_MAIN or H264_BASELINE mean "this box has already demonstrably failed a higher
// tier — stop offering it, regardless of what the local heuristic would otherwise pick.")

import { RenditionTier } from '@prisma/client';

const TIER_ORDER: RenditionTier[] = ['HEVC', 'H264_MAIN', 'H264_BASELINE'];

/** One notch less efficient / more broadly compatible. Clamped at the floor. */
export function downgradeTier(tier: RenditionTier): RenditionTier {
  const next = TIER_ORDER.indexOf(tier) + 1;
  return TIER_ORDER[Math.min(next, TIER_ORDER.length - 1)];
}
