// Per-time-window slot pricing for the self-serve booking request flow — pure data +
// helpers. Distinct from Standard/Growth/Flagship (lib/slot-pricing.ts), which prices
// admin-assigned bookings by store tier; this is the flat, universal rate table a
// brand sees when spending credits to REQUEST a specific window (lib/slot-requests-db.ts
// turns the request into a real admin-reviewed booking, never a direct SlotBooking).
//
// Figures are given business data (footfall, ad count, minute totals, cost) — not
// derived from a formula — so they're hardcoded here rather than computed live.
// "Total minutes" = adsInWindow × 20s / 60 (a slot here is a 20s spot, not the 10s
// slot-loop unit lib/slots.ts uses elsewhere — this pricing table is a separate spec).

export type WindowId = '1A' | '1B' | '2A' | '2B' | '3A' | '3B' | '3C' | 'FULL_DAY';

export type SlotWindow = {
  id: WindowId;
  label: string;
  startMin: number; // IST minutes since midnight
  endMin: number;
  peak: boolean;
  averageFootfall: number;
  adsPerDay: number;
  totalMinutes: number;
  costPerMinute: number;   // rupees
  costPerDay: number;      // rupees, rounded for display
  costPerMonth: number;    // rupees — the authoritative billed figure (day/minute are derived display roundings)
};

export const SLOT_WINDOWS: SlotWindow[] = [
  { id: '1A', label: '9:00 AM – 11:00 AM',  startMin: 9 * 60,        endMin: 11 * 60,       peak: true,  averageFootfall: 30,  adsPerDay: 24,  totalMinutes: 8,  costPerMinute: 0.55, costPerDay: 4.40,  costPerMonth: 132.14 },
  { id: '1B', label: '11:00 AM – 12:30 PM', startMin: 11 * 60,       endMin: 12 * 60 + 30,  peak: false, averageFootfall: 18,  adsPerDay: 18,  totalMinutes: 6,  costPerMinute: 0.42, costPerDay: 2.52,  costPerMonth: 75.69 },
  { id: '2A', label: '12:30 PM – 2:30 PM',  startMin: 12 * 60 + 30,  endMin: 14 * 60 + 30,  peak: true,  averageFootfall: 35,  adsPerDay: 24,  totalMinutes: 8,  costPerMinute: 0.61, costPerDay: 4.91,  costPerMonth: 147.17 },
  { id: '2B', label: '2:30 PM – 4:00 PM',   startMin: 14 * 60 + 30,  endMin: 16 * 60,       peak: false, averageFootfall: 14,  adsPerDay: 18,  totalMinutes: 6,  costPerMinute: 0.31, costPerDay: 1.88,  costPerMonth: 56.47 },
  { id: '3A', label: '4:00 PM – 5:30 PM',   startMin: 16 * 60,       endMin: 17 * 60 + 30,  peak: false, averageFootfall: 18,  adsPerDay: 18,  totalMinutes: 6,  costPerMinute: 0.40, costPerDay: 2.42,  costPerMonth: 72.60 },
  { id: '3B', label: '5:30 PM – 7:30 PM',   startMin: 17 * 60 + 30,  endMin: 19 * 60 + 30,  peak: true,  averageFootfall: 45,  adsPerDay: 24,  totalMinutes: 8,  costPerMinute: 0.76, costPerDay: 6.05,  costPerMonth: 181.50 },
  { id: '3C', label: '7:30 PM – 9:30 PM',   startMin: 19 * 60 + 30,  endMin: 21 * 60 + 30,  peak: true,  averageFootfall: 40,  adsPerDay: 24,  totalMinutes: 8,  costPerMinute: 0.65, costPerDay: 5.20,  costPerMonth: 156.00 },
  { id: 'FULL_DAY', label: '9:00 AM – 9:30 PM (Full Day)', startMin: 9 * 60, endMin: 21 * 60 + 30, peak: false, averageFootfall: 200, adsPerDay: 144, totalMinutes: 48, costPerMinute: 0.52, costPerDay: 25.00, costPerMonth: 750.00 },
];

const BY_ID = new Map(SLOT_WINDOWS.map((w) => [w.id, w]));

export function getSlotWindow(id: string): SlotWindow | undefined {
  return BY_ID.get(id as WindowId);
}

export function isWindowId(v: string | null | undefined): v is WindowId {
  return !!v && BY_ID.has(v as WindowId);
}

export const PEAK_WINDOW_COUNT = SLOT_WINDOWS.filter((w) => w.peak).length; // 4: 1A, 2A, 3B, 3C

// Credit cost of a request: peak windows use 2 of a campaign's credits, everything
// else uses 1 — see lib/slot-requests-db.ts for how the balance is tracked.
export const OFF_PEAK_CREDIT_COST = 1;
export const PEAK_CREDIT_COST = 2;

export function creditCostForWindow(id: string): number {
  const w = getSlotWindow(id);
  if (!w) return OFF_PEAK_CREDIT_COST;
  return w.peak ? PEAK_CREDIT_COST : OFF_PEAK_CREDIT_COST;
}
