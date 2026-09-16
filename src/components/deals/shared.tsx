'use client';

// Shared between /deals (every offer) and /deals/[storeId] (one store's own,
// reached by scanning its QR code) — the flyer card, its full-screen preview,
// and the loading skeleton, so both pages render an offer identically.

import { motion } from 'framer-motion';
import type { Flyer } from '@/app/api/flyers/save/route';

export const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
};

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function resolveImage(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//')) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

export function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Flyer" className="max-h-[90vh] max-w-full rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose} className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">✕</button>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
      <div className="aspect-video bg-muted" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-20 rounded-full bg-muted" />
        <div className="h-4 w-3/4 rounded-full bg-muted" />
        <div className="h-3 w-full rounded-full bg-muted" />
        <div className="h-3 w-2/3 rounded-full bg-muted" />
        <div className="h-3 w-24 rounded-full bg-muted mt-2" />
      </div>
    </div>
  );
}

/** `showStoreChip=false` on the per-store page — the page header already says
 *  whose deals these are, so repeating the store name on every card is noise. */
export function FlyerCard({ flyer, onOpen, showStoreChip = true }: { flyer: Flyer; onOpen: (src: string) => void; showStoreChip?: boolean }) {
  const imgSrc = resolveImage(flyer.imageBase64);

  return (
    <motion.div
      variants={fadeUp}
      className="rounded-xl border border-border bg-card overflow-hidden flex flex-col hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => imgSrc && onOpen(imgSrc)}
    >
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgSrc} alt={flyer.title} className="w-full aspect-video object-cover" loading="lazy" />
      ) : (
        <div className="w-full aspect-video bg-muted flex items-center justify-center">
          <span className="text-3xl text-muted-foreground/30">🛍</span>
        </div>
      )}

      <div className="flex-1 flex flex-col p-4 space-y-2">
        {showStoreChip && (
          <span className="inline-flex self-start items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            {flyer.storeName}
          </span>
        )}
        <h3 className="text-sm font-bold text-foreground leading-snug">{flyer.title}</h3>
        {flyer.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{flyer.description}</p>
        )}
        <p className="mt-auto pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          Valid until <span className="text-foreground/70">{formatDate(flyer.validUntil)}</span>
        </p>
      </div>
    </motion.div>
  );
}
