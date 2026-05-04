'use client';

import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const heroContent = {
  brands: {
    title: ['Seen.', 'Remembered. Bought.'],
    subtitle: 'Alive connects brands, kirana stores, and consumers—right where purchase decisions happen.',
    image: '/For brands_r1.jpg',
    imageAlt: 'Brand advertising on in-store Alive screen',
    cta: 'Join as a Brand',
  },
  stores: {
    title: ['Earn', 'More From Your Shelves.'],
    subtitle: 'Turn your store into a media channel and create a new revenue stream with zero investment.',
    image: '/Kirana_Shop.jpg',
    imageAlt: 'Kirana store with Alive screen',
    cta: 'Partner as a Kirana',
  },
  consumers: {
    title: ['Discover', 'Your Next Favorite.'],
    subtitle: 'Find exciting new products and unmissable deals every time you visit your local kirana store.',
    image: '/pexels-kevin-malik-9016541.jpg',
    imageAlt: 'Consumer discovering products at a kirana',
    cta: 'Get Deals as a Consumer',
  },
};

type Tab = 'brands' | 'stores' | 'consumers';

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
        <div className="space-y-6 text-center md:text-left">
          <AnimatePresence mode="wait">
            <motion.h1
              key={activeTab + '-title'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4 }}
              className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.05]"
            >
              <span className="text-primary">{c.title[0]}</span>{' '}
              {c.title[1]}
            </motion.h1>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.p
              key={activeTab + '-sub'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4, delay: 0.07 }}
              className="text-lg text-muted-foreground md:text-xl leading-relaxed"
            >
              {c.subtitle}
            </motion.p>
          </AnimatePresence>

          <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
            {(['brands', 'stores', 'consumers'] as Tab[]).map((tab) => (
              <Button
                key={tab}
                size="lg"
                variant={activeTab === tab ? 'default' : 'outline'}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'brands' ? 'For Brands' : tab === 'stores' ? 'For Kirana Stores' : 'For Consumers'}
              </Button>
            ))}
          </div>

          <div className="pt-2">
            <Button
              size="lg"
              variant="default"
              onClick={() => onGetStartedClick(c.cta)}
              className="px-10"
            >
              {c.cta}
            </Button>
          </div>
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
              {/* Speaker notch */}
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 56,
                  height: 5,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)',
                }}
              />

              {/* Screen photo */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 12,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <Image
                  src={c.image}
                  alt={c.imageAlt}
                  fill
                  className="object-cover"
                  priority
                />
                {/* Screen sheen */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(115deg, rgba(255,255,255,0.16) 0%, transparent 25%, transparent 75%, rgba(255,255,255,0.07) 100%)',
                    borderRadius: 12,
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* alive. brand tag */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 22,
                  left: 22,
                  fontWeight: 700,
                  fontSize: 13,
                  color: '#fafafa',
                  letterSpacing: '-0.01em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  zIndex: 2,
                }}
              >
                alive.
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: '#ef4444',
                    boxShadow: '0 0 12px rgba(239,68,68,0.8)',
                    animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
                  }}
                />
              </div>

              {/* Shelf shadow below device */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: -28,
                  transform: 'translateX(-50%)',
                  width: '70%',
                  height: 28,
                  background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.28), transparent 70%)',
                  filter: 'blur(2px)',
                  pointerEvents: 'none',
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
