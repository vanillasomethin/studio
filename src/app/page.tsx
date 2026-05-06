'use client';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
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
import ContactForm from '@/components/interactive/contact-form';

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
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [contactFormTitle, setContactFormTitle] = useState('Contact Us');

  const openContactForm = (title: string) => {
    setContactFormTitle(title);
    setIsContactFormOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Header onGetStartedClick={() => openContactForm('Start your campaign')} />
      <main className="flex-1">
        <Hero onGetStartedClick={openContactForm} />
        <Brands />
        <AnimatedSection><HowItWorks /></AnimatedSection>
        <AnimatedSection><BeforeAfter /></AnimatedSection>
        <AnimatedSection><MarketProof /></AnimatedSection>
        <AnimatedSection><Testimonials /></AnimatedSection>
        <AnimatedSection><Pricing onCta={() => openContactForm('Start your campaign')} /></AnimatedSection>
        <AnimatedSection><ClosingCta onCtaClick={openContactForm} /></AnimatedSection>
      </main>
      <Footer />
      <ContactForm
        isOpen={isContactFormOpen}
        onOpenChange={setIsContactFormOpen}
        title={contactFormTitle}
      />
    </div>
  );
}
