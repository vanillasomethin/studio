'use client';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import Header from '@/components/sections/header';
import Hero from '@/components/sections/hero';
import HowItWorks from '@/components/sections/how-it-works';
import MarketProof from '@/components/sections/market-proof';
import Benefits from '@/components/sections/benefits';
import Features from '@/components/sections/features';
import Testimonials from '@/components/sections/testimonials';
import BusinessModel from '@/components/sections/business-model';
import OurStory from '@/components/sections/our-story';
import ClosingCta from '@/components/sections/closing-cta';
import Footer from '@/components/sections/footer';
import Brands from '@/components/sections/brands';
import Team from '@/components/sections/team';
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
      <Header onGetStartedClick={() => openContactForm('Get Started as a Brand')} />
      <main className="flex-1">
        <Hero onGetStartedClick={openContactForm} />
        <Brands />
        <AnimatedSection>
          <HowItWorks />
        </AnimatedSection>
        <AnimatedSection>
          <Benefits />
        </AnimatedSection>
        <AnimatedSection>
          <MarketProof />
        </AnimatedSection>
        <AnimatedSection>
          <Features />
        </AnimatedSection>
        <AnimatedSection>
          <Testimonials />
        </AnimatedSection>
        <AnimatedSection>
          <BusinessModel onGetStartedClick={() => openContactForm('Get Started')} />
        </AnimatedSection>
        <AnimatedSection>
          <OurStory />
        </AnimatedSection>
        <AnimatedSection>
          <ClosingCta onCtaClick={openContactForm} />
        </AnimatedSection>
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
