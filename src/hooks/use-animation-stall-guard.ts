'use client';

import { useEffect, useRef } from 'react';

/**
 * Framer-motion runs on requestAnimationFrame, so a renderer that gets no
 * frames (backgrounded phone tab, suspended/embedded webview) freezes every
 * enter animation at its initial pose — opacity 0 — and the step reads as an
 * empty page even though the content is mounted. Attach the returned ref to
 * the animated container: once the animation should long be over, any element
 * still stuck transparent has its inline opacity/transform cleared. A stalled
 * framer re-applies its frozen values on every re-render, so after the first
 * genuine stall a MutationObserver keeps re-revealing until unmount. In a
 * healthy tab the deadline check finds nothing transparent and none of this
 * engages.
 *
 * Pass anything that remounts or swaps the animated content (e.g. the wizard
 * step) in `deps` — including flags that gate whether the container renders at
 * all, so the effect re-runs once the ref is actually attached.
 */
export function useAnimationStallGuard<T extends HTMLElement>(deps: readonly unknown[] = []) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = (): boolean => {
      let cleared = false;
      const nodes = [el, ...Array.from(el.querySelectorAll<HTMLElement>('[style*="opacity"]'))];
      for (const node of nodes) {
        if (parseFloat(getComputedStyle(node).opacity) < 0.99) {
          node.style.opacity = '';
          node.style.transform = '';
          cleared = true;
        }
      }
      return cleared;
    };

    const observer = new MutationObserver(() => reveal());
    const timer = setTimeout(() => {
      if (reveal()) {
        observer.observe(el, { attributes: true, attributeFilter: ['style'], subtree: true });
      }
    }, 1200);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}
