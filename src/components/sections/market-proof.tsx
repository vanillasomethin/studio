'use client';

const stats = [
  { value: '74%', label: 'Brand recall · in-store digital' },
  { value: '20%', label: 'Avg sales lift in 30 days' },
  { value: '₹0.13', label: 'Cost per impression' },
  { value: '2x', label: 'Faster shelf turnover' },
];

export default function MarketProof() {
  return (
    <section id="market-proof" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-headline text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            <span className="text-primary">The Digital</span> Advantage in Retail
          </h2>
          <p className="text-lg text-muted-foreground">
            In-store digital media isn&apos;t just new, it&apos;s quantifiably better. We turn passive shoppers into active buyers.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 max-w-4xl mx-auto">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-white p-6 text-left"
              style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}
            >
              <div
                className="font-headline font-bold tracking-tight mb-2"
                style={{ fontSize: 40, color: 'hsl(var(--primary))', letterSpacing: '-0.02em', lineHeight: 1 }}
              >
                {s.value}
              </div>
              <div className="text-sm text-muted-foreground leading-snug">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
