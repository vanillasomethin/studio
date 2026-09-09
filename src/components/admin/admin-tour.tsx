'use client';

// The guided tour: steps through the sidebar in order, one nav item at a
// time, showing the REAL page behind a small callout rather than a mock or a
// separate slideshow — "Next" navigates the actual tab, then the sidebar's
// existing active-item styling does the highlighting for free. Opt-in only
// (no auto-launch, no "seen it" nagging): the user asked for "an option to
// click," so it only ever runs when someone clicks it.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export type TourStep<Tab extends string> = { tab: Tab; group: string | null; blurb: string };

const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

function useTargetRect(tourId: string, deps: unknown[]) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(`[data-tour-id="${tourId}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener('resize', measure);
    // Nav items don't move on scroll (the sidebar is fixed-height), but a
    // fresh measure per step is cheap insurance against a layout still
    // settling from the tab switch that just happened.
    const t = setTimeout(measure, 50);
    return () => { window.removeEventListener('resize', measure); clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return rect;
}

export function AdminTour<Tab extends string>({
  steps, open, onOpenChange, onNav,
}: {
  steps: TourStep<Tab>[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNav: (tab: Tab) => void;
}) {
  const [i, setI] = useState(0);

  useEffect(() => { if (open) setI(0); }, [open]);
  useEffect(() => { if (open && steps[i]) onNav(steps[i].tab); }, [open, i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const step = steps[i];
  const rect = useTargetRect(step?.tab ?? '', [open, i]);

  if (!open || !step) return null;

  const last = i === steps.length - 1;
  // Beside the sidebar item; if it isn't found (mid-navigation layout churn),
  // fall back to a fixed spot rather than rendering nothing.
  const top  = rect ? Math.max(16, Math.min(rect.top, window.innerHeight - 220)) : 80;
  const left = rect ? rect.right + 12 : 220;

  return (
    <AnimatePresence>
      <motion.div
        key={step.tab}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        exit="hidden"
        style={{ position: 'fixed', top, left, zIndex: 60 }}
        className="w-72 rounded-xl border border-border bg-card p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          {step.group && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-primary">{step.group}</span>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="ml-auto rounded-md p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
            title="Skip tour"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-snug text-foreground">{step.blurb}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{i + 1} of {steps.length}</span>
          <div className="flex items-center gap-1.5">
            {i > 0 && (
              <button
                onClick={() => setI((v) => v - 1)}
                className="flex items-center gap-0.5 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="h-3 w-3" /> Back
              </button>
            )}
            <button
              onClick={() => (last ? onOpenChange(false) : setI((v) => v + 1))}
              className="flex items-center gap-0.5 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-primary/90"
            >
              {last ? 'Done' : 'Next'} {!last && <ChevronRight className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
