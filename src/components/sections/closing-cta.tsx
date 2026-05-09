import { ArrowRight } from 'lucide-react';

export default function ClosingCta() {
  return (
    <section id="closing-cta" className="bg-secondary">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-headline text-4xl font-bold tracking-tight sm:text-5xl">
          <span className="text-primary">Be Alive</span> With Us.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Ready to put your brand in front of millions of kirana shoppers?
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/brand-onboarding"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-700 px-8 py-3.5 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(220,38,38,0.55)] transition-all hover:from-red-600 hover:to-red-800"
          >
            Start your campaign <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="/store"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-8 py-3.5 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:text-primary"
          >
            Register your store
          </a>
        </div>
      </div>
    </section>
  );
}
