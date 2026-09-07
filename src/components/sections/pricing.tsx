'use client';

import { Check, Star, ArrowRight } from 'lucide-react';

// Store tiers — must match the checkout rates in lib/slot-pricing.ts
// (Standard ₹1,000 / Growth ₹2,000 / Flagship ₹3,000 per screen per month).
const plans = [
  {
    name: 'Standard',
    price: '₹1,000',
    desc: 'Local kirana screens with a loyal daily footfall.',
    features: [
      '~144 plays per day per screen',
      '~4,320 monthly views per screen',
      'Targeted local reach',
      'Campaign performance reporting',
    ],
    popular: false,
    cta: 'Get Started',
  },
  {
    name: 'Growth',
    price: '₹2,000',
    desc: 'Busy neighbourhood anchor stores with heavier walk-ins.',
    features: [
      'Everything in Standard',
      'High-footfall locations',
      'Detailed analytics & insights',
      'Priority support',
    ],
    popular: true,
    cta: 'Get Started',
  },
  {
    name: 'Flagship',
    price: '₹3,000',
    desc: 'Premium high-visibility stores at prime locations.',
    features: [
      'Everything in Growth',
      'Prime, high-visibility placements',
      'Dedicated account manager',
      'Custom creative support',
    ],
    popular: false,
    cta: 'Get Started',
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            <span className="text-primary">Find</span> a Plan That Works for You
          </h2>
          <p className="text-lg text-muted-foreground">
            Every store is tiered by footfall and visibility. Pick the exact stores
            you want at booking — mix tiers freely in one campaign.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-xl p-6 ${
                plan.popular
                  ? 'text-white overflow-hidden'
                  : 'bg-white border border-border'
              }`}
              style={
                plan.popular
                  ? {
                      background: 'linear-gradient(135deg, #fb6b6b 0%, #dc2626 50%, #a01717 100%)',
                      boxShadow: '0 18px 40px -16px rgba(220,38,38,0.55)',
                    }
                  : {}
              }
            >
              {/* Radial highlight for popular card */}
              {plan.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-30%',
                    right: '-20%',
                    width: 240,
                    height: 240,
                    background: 'radial-gradient(circle, rgba(255,255,255,0.28), transparent 60%)',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {plan.popular && (
                <div
                  className="inline-flex items-center gap-1.5 self-start mb-3 relative z-10"
                  style={{
                    background: 'rgba(255,255,255,0.22)',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    padding: '5px 12px',
                    borderRadius: 999,
                  }}
                >
                  <Star size={12} fill="currentColor" /> Most Popular
                </div>
              )}

              <h3
                className={`text-xl font-bold mb-2 font-headline ${plan.popular ? 'text-white' : 'text-foreground'}`}
              >
                {plan.name}
              </h3>
              <p className={`text-sm mb-5 leading-relaxed ${plan.popular ? 'text-white/90' : 'text-muted-foreground'}`}>
                {plan.desc}
              </p>

              <div className="mb-6">
                <span
                  className={`text-4xl font-bold font-headline ${plan.popular ? 'text-white' : 'text-foreground'}`}
                >
                  {plan.price}
                </span>
                {plan.price !== 'Custom' && (
                  <span className={`text-sm ml-1 ${plan.popular ? 'text-white/80' : 'text-muted-foreground'}`}>
                    /screen/mo
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((feat) => (
                  <div key={feat} className="flex items-start gap-3 text-sm">
                    <Check
                      size={16}
                      className={`flex-shrink-0 mt-0.5 ${plan.popular ? 'text-white' : 'text-green-500'}`}
                    />
                    <span className={plan.popular ? 'text-white/92' : 'text-muted-foreground'}>{feat}</span>
                  </div>
                ))}
              </div>

              <a
                href="/brand-onboarding"
                className={`w-full inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  plan.popular
                    ? 'border border-white/35 text-white hover:bg-white/10'
                    : 'border border-border text-foreground hover:bg-muted'
                }`}
                style={plan.popular ? { background: 'rgba(255,255,255,0.2)' } : {}}
              >
                {plan.cta} <ArrowRight size={14} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
