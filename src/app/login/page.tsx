'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useSignIn, useSignUp } from '@clerk/nextjs/legacy';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, Eye, EyeOff, Mail, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/icons/logo';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

const fadeUp  = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.03 } } };

type Tab   = 'signin' | 'signup';
type Phase = 'form' | 'verify';

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {msg}
    </div>
  );
}

function PwHint({ pw }: { pw: string }) {
  const rules = [
    { ok: pw.length >= 8,           label: '8+ characters' },
    { ok: /[A-Z]/.test(pw),         label: '1 uppercase' },
    { ok: /[0-9!@#$%^&*]/.test(pw), label: '1 number or symbol' },
  ];
  if (!pw) return null;
  return (
    <div className="flex gap-3 flex-wrap">
      {rules.map(({ ok, label }) => (
        <span key={label} className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${ok ? 'text-green-600' : 'text-muted-foreground/60'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signIn, isLoaded: siLoaded, setActive } = useSignIn();
  const { signUp, isLoaded: suLoaded } = useSignUp();

  const [tab,      setTab]      = useState<Tab>('signin');
  const [phase,    setPhase]    = useState<Phase>('form');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [code,     setCode]     = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn) router.replace('/dashboard');
  }, [isSignedIn, router]);

  const switchTab = (t: Tab) => { setTab(t); setError(null); setPhase('form'); setCode(''); };

  const handleGoogle = async () => {
    if (!siLoaded || !signIn) return;
    setBusy(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy:            'oauth_google',
        redirectUrl:         '/sso-callback',
        redirectUrlComplete: '/dashboard',
      });
    } catch (e) {
      setError((e as Error).message ?? 'Google sign-in failed.');
      setBusy(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siLoaded || !signIn || !setActive) return;
    setBusy(true); setError(null);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.replace('/dashboard');
      } else {
        setError('Sign-in incomplete. Please try again.');
      }
    } catch (e: unknown) {
      const msg = (e as { errors?: { message: string }[] })?.errors?.[0]?.message
        ?? (e as Error).message ?? 'Sign-in failed.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suLoaded || !signUp) return;
    setBusy(true); setError(null);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPhase('verify');
    } catch (e: unknown) {
      const clerkErr = (e as { errors?: { code: string; message: string }[] })?.errors?.[0];
      if (clerkErr?.code === 'form_identifier_exists' || clerkErr?.code?.includes('exists')) {
        switchTab('signin');
        setError('An account with this email already exists. Please sign in instead.');
      } else {
        setError(clerkErr?.message ?? (e as Error).message ?? 'Sign-up failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suLoaded || !signUp || !setActive) return;
    setBusy(true); setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete' || result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace('/dashboard');
      } else {
        setError('Verification incomplete. Please try again.');
      }
    } catch (e: unknown) {
      const clerkErr = (e as { errors?: { code: string; message: string }[] })?.errors?.[0];
      // Already verified → just sign in with the same credentials
      if (clerkErr?.code?.includes('already_verified') || clerkErr?.code?.includes('verified')) {
        try {
          const res = await signIn!.create({ identifier: email, password });
          if (res.status === 'complete') {
            await setActive({ session: res.createdSessionId });
            router.replace('/dashboard'); return;
          }
        } catch { /* fall through */ }
      }
      setError(clerkErr?.message ?? (e as Error).message ?? 'Invalid code.');
    } finally {
      setBusy(false);
    }
  };

  const isLoaded = siLoaded && suLoaded;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/30 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4 sm:px-6">
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity"><Logo /></a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-7">

            <motion.div variants={fadeUp} className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Brand Login</p>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {phase === 'verify' ? 'Check your email.' : tab === 'signin' ? 'Welcome back.' : 'Create account.'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {phase === 'verify'
                  ? `We sent a 6-digit code to ${email}`
                  : tab === 'signin'
                  ? 'Sign in to access your brand dashboard.'
                  : 'Create an account to track your campaigns.'}
              </p>
            </motion.div>

            <AnimatePresence mode="wait">
              {phase === 'verify' ? (
                <motion.form key="verify" onSubmit={handleVerify}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {error && <ErrorBox msg={error} />}
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit code" autoFocus
                    className="w-full h-14 rounded-xl border border-border bg-card px-4 text-center text-2xl font-bold tracking-widest text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button type="submit" disabled={busy || code.length < 6}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-700 px-5 py-3.5 text-sm font-bold text-white disabled:opacity-40">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Verify &amp; sign in <ArrowRight className="h-4 w-4" /></>}
                  </button>
                  <button type="button" onClick={() => { setPhase('form'); setCode(''); setError(null); }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
                    ← Back
                  </button>
                </motion.form>
              ) : (
                <motion.div key={tab}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="space-y-5"
                >
                  {/* Tab switcher */}
                  <div className="flex rounded-xl border border-border bg-muted/30 p-1">
                    {(['signin', 'signup'] as Tab[]).map((t) => (
                      <button key={t} type="button" onClick={() => switchTab(t)}
                        className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === t ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                        {t === 'signin' ? 'Sign in' : 'Sign up'}
                      </button>
                    ))}
                  </div>

                  {error && <ErrorBox msg={error} />}

                  <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp} className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        className="w-full h-12 rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          className="w-full h-12 rounded-xl border border-border bg-card px-4 pr-10 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground">
                          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {tab === 'signup' && <PwHint pw={password} />}
                    </div>
                    <button type="submit" disabled={busy || !isLoaded}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-700 px-5 py-3.5 text-sm font-bold text-white shadow-[0_6px_16px_-6px_rgba(220,38,38,0.5)] disabled:opacity-40">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{tab === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight className="h-4 w-4" /></>}
                    </button>
                  </form>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground/50">or</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <button type="button" onClick={handleGoogle} disabled={busy || !isLoaded}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted/50 disabled:opacity-40 transition-all">
                    <GoogleIcon /> Continue with Google
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.p variants={fadeUp} className="text-center text-xs text-muted-foreground/50">
              New to Alive?{' '}
              <a href="/brand-onboarding" className="text-primary hover:underline">Start your campaign</a>
            </motion.p>

          </motion.div>
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
