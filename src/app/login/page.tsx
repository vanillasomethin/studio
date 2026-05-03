'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSignIn, useSignUp, useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Phone, Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/icons/logo';

// ─── Animations ────────────────────────────────────────────────────────────────

const stepVariants = {
  enter:  { opacity: 0, y: 24,  scale: 0.984 },
  center: { opacity: 1, y: 0,   scale: 1,    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } },
  exit:   { opacity: 0, y: -16, scale: 0.984, transition: { duration: 0.2,  ease: [0.22, 1, 0.36, 1] } },
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } } };

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router              = useRouter();
  const { isSignedIn }      = useAuth();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();

  const [phase,   setPhase]   = useState<'phone' | 'otp'>('phone');
  const [phone,   setPhone]   = useState('');
  const [otp,     setOtp]     = useState<string[]>(Array(6).fill(''));
  const [flow,    setFlow]    = useState<'signIn' | 'signUp'>('signIn');
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null));

  useEffect(() => {
    if (isSignedIn) router.replace('/dashboard');
  }, [isSignedIn, router]);

  const isLoaded = signInLoaded && signUpLoaded;

  // ─── Send OTP ──────────────────────────────────────────────────────────────

  const handleSendOtp = async () => {
    if (!isLoaded) return;
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setError('Enter a valid 10-digit number.'); return; }
    setBusy(true);
    setError(null);
    const fullPhone = '+91' + digits;
    try {
      await signIn!.create({ strategy: 'phone_code', identifier: fullPhone });
      setFlow('signIn');
      setPhase('otp');
    } catch (e: unknown) {
      const clerkError = e as { errors?: Array<{ code: string }> };
      if (clerkError?.errors?.[0]?.code === 'form_identifier_not_found') {
        // New user — sign up
        try {
          await signUp!.create({ phoneNumber: fullPhone });
          await signUp!.preparePhoneNumberVerification({ strategy: 'phone_code' });
          setFlow('signUp');
          setPhase('otp');
        } catch (signUpErr) {
          setError((signUpErr as Error).message ?? 'Could not send OTP. Try again.');
        }
      } else {
        setError((e as Error).message ?? 'Could not send OTP. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  // ─── Verify OTP ────────────────────────────────────────────────────────────

  const handleVerifyOtp = async (code: string) => {
    if (!isLoaded) return;
    setBusy(true);
    setError(null);
    try {
      if (flow === 'signIn') {
        const result = await signIn!.attemptFirstFactor({ strategy: 'phone_code', code });
        if (result.status === 'complete') {
          await signIn!.reload();
          router.replace('/dashboard');
        }
      } else {
        const result = await signUp!.attemptPhoneNumberVerification({ code });
        if (result.status === 'complete') {
          router.replace('/dashboard');
        }
      }
    } catch {
      setError('Incorrect code. Please try again.');
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  // ─── OTP input handlers ────────────────────────────────────────────────────

  const handleOtpChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = char;
    setOtp(next);
    if (char && index < 5) inputRefs.current[index + 1]?.focus();
    const code = next.join('');
    if (code.length === 6) handleVerifyOtp(code);
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array(6).fill('');
    text.split('').forEach((c, i) => { next[i] = c; });
    setOtp(next);
    inputRefs.current[Math.min(text.length - 1, 5)]?.focus();
    if (text.length === 6) handleVerifyOtp(text);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/30 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4 sm:px-6">
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity">
            <Logo />
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {phase === 'phone' ? (
              <motion.div key="phone" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
                  <motion.div variants={fadeUp} className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Brand Login</p>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back.</h1>
                    <p className="text-sm text-muted-foreground">
                      Enter your phone number to receive a one-time code.
                    </p>
                  </motion.div>

                  <motion.div variants={fadeUp} className="space-y-4">
                    <div className="flex gap-2">
                      <div className="flex h-14 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground shrink-0">
                        <span>🇮🇳</span>
                        <span className="font-semibold text-foreground">+91</span>
                      </div>
                      <div className="relative flex-1">
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={phone}
                          onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(null); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSendOtp(); }}
                          placeholder=" "
                          autoFocus
                          className="peer w-full h-14 rounded-xl border border-border bg-card px-4 pb-1.5 pt-5 text-sm text-foreground placeholder-transparent transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <label className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground transition-all duration-200 peer-focus:-translate-y-[1.2rem] peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-primary peer-[:not(:placeholder-shown)]:-translate-y-[1.2rem] peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-widest peer-[:not(:placeholder-shown)]:text-muted-foreground">
                          Phone number
                        </label>
                      </div>
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive overflow-hidden"
                        >
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={busy || !isLoaded || phone.replace(/\D/g, '').length !== 10}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                      {busy ? 'Sending…' : 'Send OTP'}
                      {!busy && <ArrowRight className="h-4 w-4" />}
                    </motion.button>
                  </motion.div>

                  <motion.p variants={fadeUp} className="text-center text-xs text-muted-foreground/40">
                    New brand?{' '}
                    <a href="/brand-onboarding" className="text-primary hover:underline">
                      Start your campaign
                    </a>
                  </motion.p>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div key="otp" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
                  <motion.div variants={fadeUp} className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Verify</p>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Check your phone.</h1>
                    <p className="text-sm text-muted-foreground">
                      We sent a 6-digit code to{' '}
                      <span className="font-semibold text-foreground">+91 {phone}</span>
                    </p>
                  </motion.div>

                  <motion.div variants={fadeUp} className="space-y-4">
                    <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
                      {otp.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { inputRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          autoFocus={i === 0}
                          disabled={busy}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className="h-14 w-full rounded-xl border border-border bg-card text-center text-xl font-black text-foreground transition-all duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-40"
                        />
                      ))}
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive overflow-hidden"
                        >
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {busy && (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                      </div>
                    )}
                  </motion.div>

                  <motion.div variants={fadeUp} className="text-center">
                    <button
                      type="button"
                      onClick={() => { setPhase('phone'); setOtp(Array(6).fill('')); setError(null); }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Wrong number? Go back
                    </button>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="border-t border-border/30 py-5 text-center">
        <p className="text-xs text-muted-foreground/40">
          © 2025 Alive Advertising Solutions Pvt. Ltd. · hello@alive.agency
        </p>
      </footer>
    </div>
  );
}
