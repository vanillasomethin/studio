'use client';

// A store's own deals page — what its QR code (printed at onboarding, or
// generated any time from Admin -> Stores / the partner's own dashboard)
// points at. Scanning it should do three things for a shopper: show this
// store's current offers, say ALIVE is a real network (not just one screen),
// and offer a way to see every deal nearby too.

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, ArrowRight } from 'lucide-react';
import { useAnimationStallGuard } from '@/hooks/use-animation-stall-guard';
import { Logo } from '@/components/icons/logo';
import type { Flyer } from '@/app/api/flyers/save/route';
import type { StoreLocation } from '@/app/api/stores/locations/route';
import { stagger, fadeUp, ImageModal, SkeletonCard, FlyerCard } from '@/components/deals/shared';

export default function StoreDealsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const [store,   setStore]   = useState<StoreLocation | null | undefined>(undefined); // undefined = loading, null = not found
  const [flyers,  setFlyers]  = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<string | null>(null);

  const stallGuard = useAnimationStallGuard<HTMLElement>([loading, flyers.length]);

  useEffect(() => {
    let cancelled = false;
    params.then(({ storeId }) => {
      if (cancelled) return;
      Promise.all([
        fetch('/api/stores/locations').then((r) => (r.ok ? r.json() : { stores: [] })) as Promise<{ stores: StoreLocation[] }>,
        fetch(`/api/flyers/save?forStoreId=${encodeURIComponent(storeId)}`).then((r) => (r.ok ? r.json() : [])) as Promise<Flyer[]>,
      ]).then(([storesRes, flyersRes]) => {
        if (cancelled) return;
        setStore(storesRes.stores?.find((s) => s.id === storeId) ?? null);
        setFlyers(Array.isArray(flyersRes) ? flyersRes : []);
      }).catch(() => {
        if (!cancelled) setStore(null);
      }).finally(() => {
        if (!cancelled) setLoading(false);
      });
    });
    return () => { cancelled = true; };
  }, [params]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity">
            <Logo />
          </a>
        </div>
      </header>

      {modal && <ImageModal src={modal} onClose={() => setModal(null)} />}

      <main ref={stallGuard} className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-10 sm:py-14">
        {loading ? (
          <div className="space-y-10">
            <div className="h-24 w-full max-w-md animate-pulse rounded-xl bg-muted" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          </div>
        ) : !store ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
            <div className="text-5xl">🔍</div>
            <h1 className="text-lg font-bold text-foreground">Store not found</h1>
            <p className="text-sm text-muted-foreground">This link may be out of date.</p>
            <a href="/deals" className="mt-2 text-sm font-semibold text-primary hover:underline">Browse every deal instead →</a>
          </div>
        ) : (
          <>
            {/* Store header */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="mb-10">
              <motion.div variants={fadeUp} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                {store.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={store.photo} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">🏪</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                    {store.status === 'live' ? 'On ALIVE now' : 'Coming soon to ALIVE'}
                  </p>
                  <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{store.storeName}</h1>
                  {(store.locality || store.city) && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {[store.locality, store.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </motion.div>
              <motion.p variants={fadeUp} className="mt-4 text-sm text-muted-foreground">
                ALIVE puts a screen above the counter at kirana stores like this one — deals from
                brands you already buy, right where you shop. <a href="/deals" className="font-semibold text-primary hover:underline">See every deal nearby →</a>
              </motion.p>
            </motion.div>

            {/* This store's deals */}
            {flyers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
                <div className="text-4xl">🛒</div>
                <h2 className="text-base font-bold text-foreground">No offers from {store.storeName} right now</h2>
                <p className="text-sm text-muted-foreground">Check back soon, or see what's on nearby.</p>
                <a href="/deals" className="mt-1 flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  Browse local deals <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {flyers.map((flyer) => (
                  <FlyerCard key={flyer.id} flyer={flyer} onOpen={setModal} showStoreChip={false} />
                ))}
              </motion.div>
            )}

            {/* Coming soon — deliberately not clickable: neither exists yet. */}
            <div className="mt-14 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Coming soon</p>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground/70">Join the ALIVE WhatsApp channel for local offers</span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground/70">Download the ALIVE app</span>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-border/30 py-5 text-center">
        <p className="text-xs text-muted-foreground/40">© {new Date().getFullYear()} VS Collective LLP · hello@wearealive.in</p>
      </footer>
    </div>
  );
}
