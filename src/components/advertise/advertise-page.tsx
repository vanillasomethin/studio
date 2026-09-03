'use client';

import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Wordmark, brand, brandLinks, brandStyle } from '@/lib/brand';
import {
  MINUTES_PER_DAY_PER_SLOT,
  NETWORK_STORES,
  PLAYS_PER_DAY_PER_SLOT,
  SCREEN_HOURS_PER_DAY,
  SLOT_SECONDS,
  STORES_BY_TIER,
  TIER_META,
  formatInr,
} from '@/lib/advertise-network';
import Estimator from './estimator';
import NetworkMap from './network-map';
import OnboardingForm from './onboarding-form';

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#network', label: 'The network' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#creative', label: 'Creative' },
  { href: '#faq', label: 'FAQ' },
];

export default function AdvertisePage() {
  // Estimator state lives here, at the page, so the map, the estimator and the
  // enquiry form are all looking at one selection.
  const [selectedIds, setSelectedIds] = useState<string[]>(
    // Start on the Flagship six so the estimator shows a real number on arrival
    // instead of an empty box. Every one of them is visibly ticked and clearable.
    STORES_BY_TIER.find(g => g.tier === 'flagship')?.stores.map(s => s.id) ?? []
  );
  const [slots, setSlots] = useState(1);
  const [months, setMonths] = useState(3);

  return (
    <div style={brandStyle()} className="min-h-screen">
      <SiteHeader />

      <main id="top">
        <Hero />
        <Problem />
        <HowItWorks />

        <Section
          id="network"
          eyebrow="The network"
          title={`${NETWORK_STORES.length} supermarkets across ${brand.city}`}
          lede="One screen per shop, at the counter or the main aisle. Tap a pin to add that store to your plan."
        >
          <NetworkMap
            selectedIds={selectedIds}
            onToggle={id =>
              setSelectedIds(prev =>
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
              )
            }
          />

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {STORES_BY_TIER.map(({ tier, stores }) => (
              <div key={tier}>
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--brand-accent-strong)' }}>
                  {TIER_META[tier].label}
                  <span className="ml-2 font-normal normal-case tracking-normal" style={{ color: 'var(--brand-ink-muted)' }}>
                    {stores.length} store{stores.length === 1 ? '' : 's'}
                  </span>
                </h3>
                <ul className="mt-3 space-y-1.5 border-t pt-3 text-sm" style={{ borderColor: 'var(--brand-line)' }}>
                  {stores.map(store => (
                    <li key={store.id}>{store.name}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="pricing"
          eyebrow="Pricing"
          title="Work out what it costs"
          lede="Pick your stores, choose how many slots you want in each loop and for how long. The total updates as you go."
          muted
        >
          <Estimator
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            slots={slots}
            setSlots={setSlots}
            months={months}
            setMonths={setMonths}
          />
        </Section>

        <CreativeRequirements />
        <WhatYouGet />

        <Section
          id="enquiry"
          eyebrow="Get started"
          title="Tell us what you want to book"
          lede="No payment here. We'll call you back with store availability and a written quote."
          muted
        >
          <OnboardingForm
            selectedIds={selectedIds}
            slots={slots}
            setSlots={setSlots}
            months={months}
            setMonths={setMonths}
          />
        </Section>

        <Faq />
      </main>

      <SiteFooter />
      <StickyCta />
    </div>
  );
}

/* ------------------------------------------------------------------ chrome */

function SiteHeader() {
  return (
    <>
      <header
        className="sticky top-0 z-40 border-b"
        style={{ borderColor: 'var(--brand-line)', background: 'var(--brand-surface)' }}
      >
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]">
            <Wordmark />
            <span className="sr-only">{brand.name} — home</span>
            <span className="hidden text-xs md:inline" style={{ color: 'var(--brand-ink-muted)' }}>
              in-store screens
            </span>
          </a>

          <nav aria-label="Sections" className="hidden items-center gap-6 sm:flex">
            {NAV.map(item => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={brandLinks.tel}
              className="hidden text-sm font-bold md:inline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
              style={{ color: 'var(--brand-accent-strong)' }}
            >
              {brand.phoneDisplay}
            </a>
            <a
              href="#enquiry"
              className="hidden rounded-md px-4 py-2 text-sm font-bold text-white sm:inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2"
              style={{ background: 'var(--brand-accent)' }}
            >
              Get a quote
            </a>
          </div>
        </div>
      </header>

      {/* Mobile anchor nav. Scrolls away with the page — the sticky bar at the
          bottom of the screen carries the action once the hero is gone. */}
      <nav
        aria-label="Sections"
        className="overflow-x-auto border-b sm:hidden"
        style={{ borderColor: 'var(--brand-line)' }}
      >
        <ul className="flex w-max items-center gap-4 px-4 py-2.5">
          {NAV.map(item => (
            <li key={item.href}>
              <a href={item.href} className="whitespace-nowrap text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function StickyCta() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Watch the hero itself, not a thin sentinel under it: a fast fling can
    // carry a one-pixel marker straight through the viewport between frames,
    // and with no intersection change there is no callback — the bar would
    // stay up after scrolling back to the top. The hero is the page's first
    // and tallest block, so "hero not in view" is exactly "scrolled past it".
    const el = document.getElementById('hero');
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!shown}
      className="fixed inset-x-0 bottom-0 z-40 border-t p-3 transition-transform duration-200 sm:hidden"
      style={{
        borderColor: 'var(--brand-line)',
        background: 'var(--brand-surface)',
        transform: shown ? 'translateY(0)' : 'translateY(110%)',
        boxShadow: '0 -1px 0 rgba(0,0,0,.04)',
      }}
    >
      <div className="flex gap-2">
        <a
          href="#enquiry"
          tabIndex={shown ? 0 : -1}
          className="flex-1 rounded-md px-4 py-3 text-center text-sm font-bold text-white"
          style={{ background: 'var(--brand-accent)' }}
        >
          Get a quote
        </a>
        <a
          href={brandLinks.whatsapp}
          tabIndex={shown ? 0 : -1}
          className="rounded-md border px-4 py-3 text-center text-sm font-bold"
          style={{ borderColor: 'var(--brand-accent)', color: 'var(--brand-accent-strong)' }}
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- sections */

function Section({
  id,
  eyebrow,
  title,
  lede,
  muted = false,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-16 border-t py-12 sm:py-20"
      style={{
        borderColor: 'var(--brand-line)',
        background: muted ? 'var(--brand-surface-muted)' : 'var(--brand-surface)',
      }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-accent-strong)' }}>
          {eyebrow}
        </p>
        <h2 id={`${id}-title`} className="mt-2 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
          {title}
        </h2>
        {lede ? (
          <p className="mt-3 max-w-2xl text-base" style={{ color: 'var(--brand-ink-muted)' }}>
            {lede}
          </p>
        ) : null}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section id="hero" aria-labelledby="hero-title" className="py-12 sm:py-20">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-accent-strong)' }}>
            {brand.city} · {brand.region}
          </p>
          <h1 id="hero-title" className="mt-3 text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl">
            Reach shoppers at the shelf, not on the way there.
          </h1>

          <p className="mt-5 text-lg font-bold sm:text-xl">
            {NETWORK_STORES.length} supermarkets · {SCREEN_HOURS_PER_DAY} hours a day ·{' '}
            {PLAYS_PER_DAY_PER_SLOT} plays
          </p>
          <p className="mt-2 max-w-xl text-base" style={{ color: 'var(--brand-ink-muted)' }}>
            Your {SLOT_SECONDS}-second ad on a screen inside the shop, playing{' '}
            {PLAYS_PER_DAY_PER_SLOT} times a day in every store you pick — while people are standing
            in front of your category.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#enquiry"
              className="rounded-md px-6 py-3.5 text-center text-base font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2"
              style={{ background: 'var(--brand-accent)' }}
            >
              Get a quote
            </a>
            <a
              href="#pricing"
              className="rounded-md border px-6 py-3.5 text-center text-base font-bold transition-colors hover:bg-[var(--brand-accent-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2"
              style={{ borderColor: 'var(--brand-accent)', color: 'var(--brand-accent-strong)' }}
            >
              See pricing
            </a>
          </div>
        </div>

        {/* What a slot actually is, up front — the number people ask for first. */}
        <div className="rounded-lg border" style={{ borderColor: 'var(--brand-line)' }}>
          <h2
            className="border-b px-5 py-3 text-xs font-bold uppercase tracking-wider"
            style={{ borderColor: 'var(--brand-line)', color: 'var(--brand-accent-strong)' }}
          >
            One slot buys
          </h2>
          <dl>
            {[
              { v: `${SLOT_SECONDS} seconds`, k: 'of screen, every play' },
              { v: `${PLAYS_PER_DAY_PER_SLOT} plays`, k: 'a day, in each store you pick' },
              { v: `${MINUTES_PER_DAY_PER_SLOT} minutes`, k: 'of screen time a day' },
              { v: `${SCREEN_HOURS_PER_DAY} hours`, k: 'the screen is on, every day' },
            ].map((row, i) => (
              <div
                key={row.k}
                className="px-5 py-3"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--brand-line)' }}
              >
                <dt className="text-xl font-black tracking-tight">{row.v}</dt>
                <dd className="text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
                  {row.k}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <Section
      id="problem"
      eyebrow="The problem"
      title="Most ad money is spent a long way from the shelf"
      muted
    >
      <div className="max-w-2xl space-y-4 text-base sm:text-lg">
        <p>
          A hoarding on the highway or a reel on a phone reaches someone hours or days before they
          are anywhere near a shop.
        </p>
        <p>
          By the time they are in the aisle, holding your pack in one hand and a competitor&apos;s in
          the other, none of that spend is in the room.
        </p>
        <p>
          The screen inside the shop is the last thing they see before they choose — and it costs a
          fraction of what the rest of the plan does.
        </p>
      </div>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: 'Choose your stores',
      body: `Pick the shops you want to be in from the ${NETWORK_STORES.length} on the network. Start with three, or take a whole tier.`,
    },
    {
      title: `Send a ${SLOT_SECONDS}-second creative`,
      body: 'One MP4, landscape, no sound needed. If you do not have a video yet, we will make one for you.',
    },
    {
      title: 'Live in a week',
      body: 'We schedule your slot into each store loop and push it to the screens. You get a report at the end of every month.',
      // TODO: confirm the one-week go-live promise with ops before publishing.
    },
  ];

  return (
    <Section id="how" eyebrow="How it works" title="Three steps, about a week">
      <ol className="grid gap-6 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className="rounded-lg border p-5"
            style={{ borderColor: 'var(--brand-line)' }}
          >
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-black text-white"
              style={{ background: 'var(--brand-accent)' }}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <h3 className="mt-4 text-base font-bold">
              <span className="sr-only">Step {i + 1}: </span>
              {step.title}
            </h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function CreativeRequirements() {
  // TODO: confirm each line against what the player actually accepts before publishing.
  const spec = [
    { k: 'Length', v: `Exactly ${SLOT_SECONDS} seconds` },
    { k: 'Resolution', v: '1920 × 1080' },
    { k: 'Aspect ratio', v: '16:9, landscape' },
    { k: 'Format', v: 'MP4, H.264' },
    { k: 'Sound', v: 'Screens run silent — the ad has to work with no audio' },
    { k: 'Text', v: 'Large and legible from three metres away' },
  ];

  return (
    <Section
      id="creative"
      eyebrow="Creative"
      title="What we need from you"
      lede="One file, to this spec. Send it on WhatsApp or email and we take it from there."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <dl className="rounded-lg border" style={{ borderColor: 'var(--brand-line)' }}>
          {spec.map((row, i) => (
            <div
              key={row.k}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-6"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--brand-line)' }}
            >
              <dt className="text-sm font-bold sm:w-36 sm:shrink-0">{row.k}</dt>
              <dd className="text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
                {row.v}
              </dd>
            </div>
          ))}
        </dl>

        <div
          className="rounded-lg border p-5"
          style={{ borderColor: 'var(--brand-accent)', background: 'var(--brand-accent-tint)' }}
        >
          <h3 className="text-base font-bold">No video yet? We&apos;ll make it.</h3>
          <p className="mt-2 text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
            Our team shoots and cuts a {SLOT_SECONDS}-second ad built for a silent screen — your pack,
            your price, one clear message. Two rounds of changes included.
          </p>
          {/* TODO: confirm the production fee and turnaround with the studio, then put the
              real number here instead of "from". */}
          <p className="mt-4 text-2xl font-black tracking-tight" style={{ color: 'var(--brand-accent-strong)' }}>
            from {formatInr(7500)}
            <span className="ml-1 text-sm font-bold" style={{ color: 'var(--brand-ink-muted)' }}>
              one-off
            </span>
          </p>
          <p className="mt-3 text-sm">
            Choose <strong>Need help</strong> in the form below and we will quote it with your
            booking.
          </p>
        </div>
      </div>
    </Section>
  );
}

function WhatYouGet() {
  const items = [
    {
      title: 'A proof-of-play report every month',
      // TODO: confirm the report format and delivery date with ops.
      body: 'Every play logged by store and by date. It arrives in the first week of the following month, so you can see exactly what you paid for.',
    },
    {
      title: 'Screens that are actually on',
      // TODO: confirm the uptime commitment and the make-good rule with ops.
      body: `Every screen reports in through the day. If one goes dark for more than a day, those plays are made good or credited — you are never billed for a blank screen.`,
    },
    {
      title: 'A live store count',
      body: `You always know how many of the ${NETWORK_STORES.length} screens are carrying your ad today, and we tell you before anything changes.`,
    },
  ];

  return (
    <Section id="what-you-get" eyebrow="What you get" title="Proof, not a promise">
      <ul className="grid gap-6 sm:grid-cols-3">
        {items.map(item => (
          <li key={item.title} className="rounded-lg border p-5" style={{ borderColor: 'var(--brand-line)' }}>
            <h3 className="text-base font-bold">{item.title}</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
              {item.body}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Faq() {
  const faqs = [
    {
      q: 'What is the minimum commitment?',
      // TODO: confirm the minimum term with sales.
      a: 'One month, one store, one slot. Most brands start with three or four stores for a month to see how the creative performs, then extend. Bookings run calendar month to calendar month.',
    },
    {
      q: 'Can I change the ad mid-month?',
      // TODO: confirm the free-swap allowance and notice period with ops.
      a: 'Yes. One swap a month is free — send the new file with three working days notice and we schedule it across every store you are in. Extra swaps in the same month are charged at a small handling fee.',
    },
    {
      q: 'What happens if a screen is down?',
      // TODO: confirm the downtime / make-good policy with ops.
      a: 'Screens are monitored through the day. Short outages are made good by extending your run; if a store is dark for more than a day, that store is credited pro-rata on your next invoice. You are never billed for plays that did not happen.',
    },
    {
      q: 'Do I get a GST invoice?',
      // TODO: confirm with finance whether the rate card is quoted before or after GST.
      a: `Yes. Every booking is invoiced by ${brand.legalName}, GSTIN ${brand.gstin}, with GST charged at the applicable rate on top of the rate card. The invoice is emailed the day the campaign starts.`,
    },
    {
      q: 'When do I pay?',
      // TODO: confirm payment terms and accepted methods with finance.
      a: 'The first month is paid in advance, before the campaign goes live. Longer runs are billed monthly in advance after that. Bank transfer, UPI and card all work.',
    },
  ];

  return (
    <Section id="faq" eyebrow="FAQ" title="The questions we get asked" muted>
      <Accordion type="single" collapsible className="max-w-3xl">
        {faqs.map((faq, i) => (
          <AccordionItem key={faq.q} value={`faq-${i}`} style={{ borderColor: 'var(--brand-line)' }}>
            <AccordionTrigger className="rounded text-left text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}

function SiteFooter() {
  return (
    <footer
      className="border-t pb-24 pt-12 sm:pb-12"
      style={{ borderColor: 'var(--brand-line)', background: 'var(--brand-surface)' }}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:grid-cols-2 sm:px-6">
        <div>
          <Wordmark />
          <p className="mt-3 text-sm font-bold">{brand.legalName}</p>
          <address className="mt-1 text-sm not-italic" style={{ color: 'var(--brand-ink-muted)' }}>
            {brand.address}
            <br />
            {brand.city}, {brand.region}
          </address>
          <p className="mt-3 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
            GSTIN {brand.gstin}
          </p>
        </div>

        <div className="sm:text-right">
          <h2 className="text-sm font-bold">Talk to us</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href={brandLinks.tel} className="font-bold hover:underline" style={{ color: 'var(--brand-accent-strong)' }}>
                {brand.phoneDisplay}
              </a>
            </li>
            <li>
              <a href={brandLinks.whatsapp} className="hover:underline">
                WhatsApp us
              </a>
            </li>
            <li>
              <a href={brandLinks.email} className="hover:underline">
                {brand.email}
              </a>
            </li>
          </ul>
          <p className="mt-6 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
            {/* TODO: point these at the real brand-facing terms once they exist. */}
            Rates shown exclude GST. Availability is confirmed in writing before any booking.
          </p>
        </div>
      </div>

      <p className="mx-auto mt-10 w-full max-w-6xl px-4 text-xs sm:px-6" style={{ color: 'var(--brand-ink-muted)' }}>
        © {new Date().getFullYear()} {brand.legalName}. All rights reserved.
      </p>

      {/* Smooth anchor scrolling, scoped to the time this page is mounted, and
          off for anyone who has asked for reduced motion. */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          html { scroll-behavior: smooth; }
        }
      `}</style>
    </footer>
  );
}
