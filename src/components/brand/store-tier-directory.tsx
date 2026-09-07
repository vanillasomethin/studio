'use client';

// The network, listed by tier: Flagship / Growth / Standard, with the stores in
// each named underneath. A brand can pick screens here by name and calibre
// instead of hunting pins on the map — same selection, same cap, same rules
// (coming-soon and sold-out stores are shown but not bookable).
//
// The tier sets the price. A brand is billed per store it selects, at that
// store's tier — Standard ₹1,000, Growth ₹2,000, Flagship ₹3,000 per month — so
// the rate is shown on each group header. That is the whole point of the
// grouping: the buyer can see what a calibre of location costs before picking.

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { SLOT_TIERS_BY_VALUE, SLOT_TIER_LABEL, type SlotTier } from '@/lib/slot-pricing';
import { storeMonthlyPrice } from '@/lib/brand-pricing';
import { useBrandScreens, type ScreenPin } from './use-brand-screens';

const STATUS_DOT: Record<string, string> = {
  available: 'bg-green-500',
  limited:   'bg-yellow-500',
  sold_out:  'bg-gray-400',
  none:      'bg-green-500', // schedule-mode stores are selectable
};

const STATUS_LABEL: Record<string, string> = {
  available: 'Slots open',
  limited:   'Few slots left',
  sold_out:  'Sold out',
  none:      'Available',
};

// Tier weight carried by contrast, not colour — the red is reserved for CTAs.
const TIER_BADGE: Record<SlotTier, string> = {
  flagship: 'bg-foreground text-background',
  growth:   'bg-muted text-foreground',
  standard: 'border border-border text-muted-foreground',
};

function statusOf(pin: ScreenPin) {
  if (!pin.live) return { dot: 'bg-white border-2 border-amber-500', label: 'Coming soon' };
  const k = pin.slotStatus ?? 'none';
  return { dot: STATUS_DOT[k], label: STATUS_LABEL[k] };
}

function bookable(pin: ScreenPin) {
  return pin.live && pin.slotStatus !== 'sold_out';
}

export default function StoreTierDirectory({
  selected, onToggle, startDate,
}: {
  selected: string[];
  onToggle: (id: string, storeName: string) => void;
  startDate: string;
}) {
  const { pins, loading, error } = useBrandScreens(startDate);
  // Flagship open by default — the tier a buyer most wants to see named.
  const [open, setOpen] = useState<Record<string, boolean>>({ flagship: true, growth: true, standard: false });

  const byTier = useMemo(() => {
    const m = new Map<SlotTier, ScreenPin[]>();
    for (const t of SLOT_TIERS_BY_VALUE) m.set(t, []);
    for (const p of pins) m.get(p.tier)?.push(p);
    // Bookable first, then alphabetical — a brand scanning for a name should not
    // have to step over sold-out and not-yet-live stores to reach one they can buy.
    for (const list of m.values()) {
      list.sort((a, b) =>
        Number(bookable(b)) - Number(bookable(a)) || a.storeName.localeCompare(b.storeName));
    }
    return m;
  }, [pins]);

  if (loading || error || pins.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Or browse stores by tier
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          You&rsquo;re billed per store you pick, at that store&rsquo;s tier rate. Tap a store to add it.
        </p>
      </div>

      <div className="space-y-2">
        {SLOT_TIERS_BY_VALUE.map((tier) => {
          const list = byTier.get(tier) ?? [];
          if (list.length === 0) return null; // no empty headings
          const isOpen = open[tier];
          const openCount = list.filter(bookable).length;

          return (
            <div key={tier} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [tier]: !o[tier] }))}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                />
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${TIER_BADGE[tier]}`}>
                  {SLOT_TIER_LABEL[tier]}
                </span>
                <span className="text-xs font-bold text-foreground shrink-0">
                  ₹{storeMonthlyPrice(tier).toLocaleString('en-IN')}
                  <span className="font-normal text-muted-foreground">/store/mo</span>
                </span>
                <span className="text-xs text-muted-foreground flex-1 text-right">
                  {list.length} store{list.length === 1 ? '' : 's'}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {openCount} bookable
                </span>
              </button>

              {isOpen && (
                <ul className="border-t border-border divide-y divide-border/50">
                  {list.map((pin, i) => {
                    const isSel = selected.includes(pin.id);
                    const canBook = bookable(pin);
                    const s = statusOf(pin);
                    return (
                      <motion.li
                        key={pin.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: Math.min(i, 8) * 0.02 }}
                      >
                        <button
                          type="button"
                          disabled={!canBook}
                          onClick={() => onToggle(pin.id, pin.storeName)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                            canBook ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-not-allowed opacity-60'
                          } ${isSel ? 'bg-primary/5' : ''}`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.dot}`} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-semibold text-foreground truncate">
                              {pin.storeName}
                            </span>
                            <span className="block text-[10px] text-muted-foreground truncate">
                              {pin.locality ?? pin.city ?? '—'} · {s.label}
                            </span>
                          </span>
                          {isSel && (
                            <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shrink-0">
                              <Check className="h-2.5 w-2.5" />
                              Added
                            </span>
                          )}
                        </button>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
