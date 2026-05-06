'use client';

import Image from 'next/image';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const heroContent = {
  brands: {
    eyebrow: 'For Brands',
    title: ['Seen.', 'Remembered. Bought.'],
    subtitle: 'Place your ads inside kirana stores across the city — reaching millions of shoppers at the exact moment they decide what to buy.',
    image: '/For brands_r1.jpg',
    imageAlt: 'Brand advertising on in-store Alive screen',
    cta: 'Start your campaign',
    ctaTitle: 'Start your campaign',
  },
  stores: {
    eyebrow: 'For Kirana Stores',
    title: ['Earn', 'more from your shelves.'],
    subtitle: 'Turn your existing shelf space into a media channel. Zero investment, new revenue stream, starting immediately.',
    image: '/Kirana_Shop.jpg',
    imageAlt: 'Kirana store with Alive screen',
    cta: 'Register your store',
    ctaTitle: 'Register as a Kirana Partner',
  },
  consumers: {
    eyebrow: 'For Shoppers',
    title: ['Discover', 'your next favorite.'],
    subtitle: 'Find new products and exclusive deals every time you shop at your local kirana. No app needed.',
    image: '/pexels-kevin-malik-9016541.jpg',
    imageAlt: 'Consumer discovering products at a kirana',
    cta: 'Find deals near you',
    ctaTitle: 'Get Deals as a Shopper',
  },
};

type Tab = 'brands' | 'stores' | 'consumers';

const TABS: { key: Tab; label: string }[] = [
  { key: 'brands',    label: 'Brands'   },
  { key: 'stores',    label: 'Kiranas'  },
  { key: 'consumers', label: 'Shoppers' },
];

type HeroProps = {
  onGetStartedClick: (title: string) => void;
};

export default function Hero({ onGetStartedClick }: HeroProps) {
  const [activeTab, setActiveTab] = useState<Tab>('brands');
  const c = heroContent[activeTab];

  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-white py-20 md:py-28"
      style={{
        backgroundImage: `
          radial-gradient(900px 500px at 92% 8%, rgba(220,38,38,0.10), transparent 60%),
          radial-gradient(700px 400px at -10% 110%, rgba(220,38,38,0.07), transparent 65%)
        `,
      }}
    >
      <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 md:grid-cols-2 lg:px-8">
        {/* Text side */}
        <div className="space-y-7 text-center md:text-left">

          {/* Audience pill switcher */}
          <div className="flex gap-1.5 justify-center md:justify-start p-1 bg-secondary rounded-xl w-fit mx-auto md:mx-0">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === key
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {activeTab === key && (
                  <motion.div
                    layoutId="hero-tab"
                    className="absolute inset-0 rounded-lg bg-white shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              className="space-y-4"
            >
              <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.05]">
                <span className="text-primary">{c.title[0]}</span>{' '}
                {c.title[1]}
              </h1>
              <p className="text-lg text-muted-foreground md:text-xl leading-relaxed max-w-lg">
                {c.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>

          <button
            onClick={() => onGetStartedClick(c.ctaTitle)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-700 px-8 py-3.5 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(220,38,38,0.55)] transition-all hover:from-red-600 hover:to-red-800 hover:shadow-[0_12px_24px_-8px_rgba(220,38,38,0.6)]"
          >
            {c.cta} <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Portrait device frame */}
        <div className="flex justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + '-device'}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.4 }}
              className="relative"
              style={{
                width: '100%',
                maxWidth: 300,
                aspectRatio: '9/16',
                borderRadius: 22,
                padding: 14,
                background: 'linear-gradient(160deg, #1a1a1a 0%, #0a0a0a 100%)',
                boxShadow: `
                  0 30px 60px -20px rgba(220,38,38,0.35),
                  0 25px 50px -12px rgba(0,0,0,0.35),
                  inset 0 0 0 1px rgba(255,90,90,0.18)
                `,
              }}
            >
              <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 56, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ width: '100%', height: '100%', borderRadius: 12, position: 'relative', overflow: 'hidden' }}>
                <Image src={c.image} alt={c.imageAlt} fill className="object-cover" priority />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.16) 0%, transparent 25%, transparent 75%, rgba(255,255,255,0.07) 100%)', borderRadius: 12, pointerEvents: 'none' }} />
              </div>
              <div style={{ position: 'absolute', bottom: 22, left: 22, fontWeight: 700, fontSize: 13, color: '#fafafa', letterSpacing: '-0.01em', display: 'inline-flex', alignItems: 'center', gap: 6, zIndex: 2 }}>
                alive.
                <span style={{ width: 8, height: 8, borderRadius: 999, background: '#ef4444', boxShadow: '0 0 12px rgba(239,68,68,0.8)', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
              </div>
              <div style={{ position: 'absolute', left: '50%', bottom: -28, transform: 'translateX(-50%)', width: '70%', height: 28, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.28), transparent 70%)', filter: 'blur(2px)', pointerEvents: 'none' }} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
