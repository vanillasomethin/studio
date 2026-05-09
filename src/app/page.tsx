'use client';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import Header from '@/components/sections/header';
import Hero from '@/components/sections/hero';
import HowItWorks from '@/components/sections/how-it-works';
import BeforeAfter from '@/components/sections/before-after';
import MarketProof from '@/components/sections/market-proof';
import Testimonials from '@/components/sections/testimonials';
import Pricing from '@/components/sections/pricing';
import ClosingCta from '@/components/sections/closing-cta';
import Footer from '@/components/sections/footer';
import Brands from '@/components/sections/brands';

function AnimatedSection({ children }: { children: React.ReactNode }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end center'],
  });
  const opacity = useTransform(scrollYProgress, [0.3, 0.7], [0.85, 1]);
  return (
    <motion.div ref={ref} style={{ opacity }}>
      {children}
    </motion.div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1">
        <Hero />
        <Brands />
        <AnimatedSection><HowItWorks /></AnimatedSection>
        <AnimatedSection><BeforeAfter /></AnimatedSection>
        <AnimatedSection><MarketProof /></AnimatedSection>
        <AnimatedSection><Testimonials /></AnimatedSection>
        <AnimatedSection><Pricing /></AnimatedSection>
        <AnimatedSection><ClosingCta /></AnimatedSection>
      </main>
      <Footer />
    </div>
  );
}
