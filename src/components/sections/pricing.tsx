'use client';

import { Check, Star, ArrowRight } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '₹799',
    desc: 'Perfect for testing the waters in a single high-traffic location.',
    features: [
      '~144 plays per day',
      '~4,320 monthly views',
      'Targeted local reach',
      'Basic performance analytics',
    ],
    popular: false,
    cta: 'Get Started',
  },
  {
    name: 'Growth',
    price: '₹2,249',
    desc: 'Expand your reach across multiple key stores to capture a larger audience.',
    features: [
      '~432 plays per day',
      '~12,960 monthly views',
      'Multi-store campaign management',
      'Detailed analytics & insights',
      'Priority support',
    ],
    popular: true,
    cta: 'Get Started',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    desc: 'Maximum impact with wide-scale deployment and tailored solutions.',
    features: [
      'Volume-based pricing',
      'Dedicated account manager',
      'API access & integrations',
      'Custom creative services',
    ],
    popular: false,
    cta: 'Contact Sales',
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
            Affordable, scalable plans designed to put your brand in the spotlight.
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
                    /mo
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
