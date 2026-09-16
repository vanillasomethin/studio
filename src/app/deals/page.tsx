'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAnimationStallGuard } from '@/hooks/use-animation-stall-guard';
import { Logo } from '@/components/icons/logo';
import type { Flyer } from '@/app/api/flyers/save/route';
import { stagger, fadeUp, ImageModal, SkeletonCard, FlyerCard } from '@/components/deals/shared';

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DealsPage() {
  const [flyers,  setFlyers]  = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [modal,   setModal]   = useState<string | null>(null);

  // rAF-starved renderers (suspended tabs, embedded webviews) freeze the enter
  // animations at opacity 0 and blank the page. Deps: the fetch resolving
  // mounts the grid / empty state as fresh animated nodes.
  const stallGuard = useAnimationStallGuard<HTMLElement>([loading, error, flyers.length]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/flyers/save')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load deals');
        return res.json() as Promise<Flyer[]>;
      })
      .then((data) => {
        if (!cancelled) setFlyers(data);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message ?? 'Could not load deals');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity">
            <Logo />
          </a>
        </div>
      </header>

      {modal && <ImageModal src={modal} onClose={() => setModal(null)} />}

      <main ref={stallGuard} className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-10 sm:py-14">

        {/* Hero heading */}
        <motion.div
          variants={stagger} initial="hidden" animate="show"
          className="mb-10 space-y-2"
        >
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Local deals
          </motion.p>
          <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            Deals <span className="text-primary">near you</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="text-sm text-muted-foreground">
            Exclusive offers from kirana stores in your area.
          </motion.p>
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            {error}
          </div>
        ) : flyers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center justify-center py-24 text-center space-y-3"
          >
            <div className="text-5xl">🛒</div>
            <h2 className="text-lg font-bold text-foreground">No deals yet</h2>
            <p className="text-sm text-muted-foreground">Check back soon — new offers are added regularly.</p>
          </motion.div>
        ) : (
          <motion.div
            variants={stagger} initial="hidden" animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {flyers.map((flyer) => (
              <FlyerCard key={flyer.id} flyer={flyer} onOpen={setModal} />
            ))}
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-5 text-center">
        <p className="text-xs text-muted-foreground/40">
          © {new Date().getFullYear()} VS Collective LLP · hello@wearealive.in
        </p>
      </footer>
    </div>
  );
}
