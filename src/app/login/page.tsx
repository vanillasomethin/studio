'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Logo } from '@/components/icons/logo';
import { ArrowRight, ArrowLeft, Phone, Loader2, AlertCircle } from 'lucide-react';

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
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const [phase,   setPhase]   = useState<'phone' | 'otp'>('phone');
  const [phone,   setPhone]   = useState('');
  const [otp,     setOtp]     = useState<string[]>(Array(6).fill(''));
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const confirmationRef  = useRef<ConfirmationResult | null>(null);
  const recaptchaRef     = useRef<RecaptchaVerifier | null>(null);
  const inputRefs        = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null));

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // Clean up reCAPTCHA on unmount
  useEffect(() => {
    return () => { recaptchaRef.current?.clear(); };
  }, []);

  const getReturnPath = () => searchParams.get('return') === 'dashboard' ? '/dashboard' : '/dashboard';

  // ─── Send OTP ──────────────────────────────────────────────────────────────

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setError('Enter a valid 10-digit number.'); return; }
    setBusy(true);
    setError(null);
    try {
      recaptchaRef.current?.clear();
      recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {},
      });
      const result = await signInWithPhoneNumber(auth, '+91' + digits, recaptchaRef.current);
      confirmationRef.current = result;
      setPhase('otp');
    } catch (e) {
      setError((e as Error).message ?? 'Failed to send OTP. Try again.');
    } finally {
      setBusy(false);
    }
  };

  // ─── Confirm OTP ───────────────────────────────────────────────────────────

  const handleConfirmOtp = async (code: string) => {
    if (!confirmationRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const cred = await confirmationRef.current.confirm(code);
      await setDoc(doc(db, 'users', cred.user.uid), {
        phone:     cred.user.phoneNumber,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      router.replace(getReturnPath());
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
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    const code = next.join('');
    if (code.length === 6) handleConfirmOtp(code);
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
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
    const lastIndex = Math.min(text.length - 1, 5);
    inputRefs.current[lastIndex]?.focus();
    if (text.length === 6) handleConfirmOtp(text);
  };

  const resetToPhone = () => {
    setPhase('phone');
    setOtp(Array(6).fill(''));
    setError(null);
    confirmationRef.current = null;
  };

  if (loading || (user !== undefined && user !== null)) return null;

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
        {/* reCAPTCHA anchor — must never unmount */}
        <div id="recaptcha-container" />

        <div className="w-full max-w-sm">
          <AnimatePresence mode="wait">
            {phase === 'phone' ? (
              <motion.div
                key="phone"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
                  <motion.div variants={fadeUp} className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Brand Login</p>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back.</h1>
                    <p className="text-sm text-muted-foreground">Enter your phone number to receive a one-time code.</p>
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
                      disabled={busy || phone.replace(/\D/g, '').length !== 10}
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
              <motion.div
                key="otp"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
              >
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

                  <motion.div variants={fadeUp} className="space-y-2 text-center">
                    <button
                      type="button"
                      onClick={resetToPhone}
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
