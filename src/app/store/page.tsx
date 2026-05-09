'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/icons/logo';
import { Button } from '@/components/ui/button';

// ─── Animation variants ────────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06, delayChildren: 0.03 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Input helpers ─────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';

const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5';

// ─── Form state ────────────────────────────────────────────────────────────────

type FormData = {
  storeName:   string;
  ownerName:   string;
  phone:       string;
  whatsapp:    string;
  address:     string;
  area:        string;
  city:        string;
  pincode:     string;
  screenCount: '1' | '2' | '3+' | '';
};

const INITIAL: FormData = {
  storeName:   '',
  ownerName:   '',
  phone:       '',
  whatsapp:    '',
  address:     '',
  area:        '',
  city:        '',
  pincode:     '',
  screenCount: '',
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function StorePage() {
  const [form,    setForm]    = useState<FormData>(INITIAL);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const set = (k: keyof FormData, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const valid =
    form.storeName &&
    form.ownerName &&
    form.phone &&
    form.address &&
    form.area &&
    form.city &&
    form.pincode.length === 6 &&
    form.screenCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stores/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Submission failed. Please try again.');
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/30 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4 sm:px-6">
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity">
            <Logo />
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {success ? (
            /* ── Success card ── */
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-border bg-card p-8 text-center space-y-5"
            >
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 ring-8 ring-green-500/5">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Thank you!</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Our team will contact you within 24 hours.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background/50 px-4 py-3">
                <p className="text-xs text-muted-foreground/70">
                  <span className="font-semibold text-foreground">{form.storeName}</span> — registered successfully.
                </p>
              </div>
              <a
                href="/"
                className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Return to homepage
              </a>
            </motion.div>
          ) : (
            /* ── Registration form ── */
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-7">

              <motion.div variants={fadeUp} className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Store Registration
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Join our network.
                </h1>
                <p className="text-sm text-muted-foreground">
                  Register your kirana store to start displaying ads and earning extra income.
                </p>
              </motion.div>

              <motion.form
                variants={fadeUp}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {/* Store name */}
                <div>
                  <label className={labelCls}>Store name</label>
                  <input
                    type="text"
                    required
                    value={form.storeName}
                    onChange={(e) => set('storeName', e.target.value)}
                    placeholder="Sharma General Store"
                    className={inputCls}
                  />
                </div>

                {/* Owner name */}
                <div>
                  <label className={labelCls}>Owner name</label>
                  <input
                    type="text"
                    required
                    value={form.ownerName}
                    onChange={(e) => set('ownerName', e.target.value)}
                    placeholder="Ramesh Sharma"
                    className={inputCls}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+91 98765 43210"
                    className={inputCls}
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className={labelCls}>WhatsApp number <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
                  <input
                    type="tel"
                    value={form.whatsapp}
                    onChange={(e) => set('whatsapp', e.target.value)}
                    placeholder="Same as phone if same"
                    className={inputCls}
                  />
                </div>

                {/* Full address */}
                <div>
                  <label className={labelCls}>Full address</label>
                  <textarea
                    required
                    rows={3}
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                    placeholder="Door no., street, landmark…"
                    className={inputCls + ' resize-none'}
                  />
                </div>

                {/* Area / locality */}
                <div>
                  <label className={labelCls}>Area / locality</label>
                  <input
                    type="text"
                    required
                    value={form.area}
                    onChange={(e) => set('area', e.target.value)}
                    placeholder="Kankanady"
                    className={inputCls}
                  />
                </div>

                {/* City + Pincode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>City</label>
                    <input
                      type="text"
                      required
                      value={form.city}
                      onChange={(e) => set('city', e.target.value)}
                      placeholder="Mangaluru"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Pincode</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      pattern="[0-9]{6}"
                      value={form.pincode}
                      onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="575002"
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Screen count */}
                <div>
                  <label className={labelCls}>How many screens are you interested in?</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {(['1', '2', '3+'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set('screenCount', v)}
                        className={`rounded-xl border py-3 text-sm font-semibold transition-all ${
                          form.screenCount === v
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                    {error}
                  </p>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={busy || !valid}
                  className="w-full h-11 text-sm font-bold"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Register my store'
                  )}
                </Button>
              </motion.form>

            </motion.div>
          )}
        </div>
      </main>

      <footer className="border-t border-border/30 py-5 text-center">
        <p className="text-xs text-muted-foreground/40">
          © 2025 Alive Advertising Solutions Pvt. Ltd. · hello@wearealive.in
        </p>
      </footer>
    </div>
  );
}
