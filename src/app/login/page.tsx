'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, Eye, EyeOff, Mail, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/icons/logo';

const fadeUp  = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.03 } } };

type Tab = 'signin' | 'signup';

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {msg}
    </div>
  );
}

export default function LoginPage() {
  const router         = useRouter();
  const { status }     = useSession();
  const [tab,      setTab]      = useState<Tab>('signin');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  const switchTab = (t: Tab) => { setTab(t); setError(null); };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await signIn('email-password', { email, password, redirect: false });
      if (result?.error) {
        setError('Incorrect email or password. Please try again.');
      } else {
        router.replace('/dashboard');
      }
    } catch {
      setError('Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/brands/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? 'Sign-up failed.'); return; }

      const result = await signIn('email-password', { email, password, redirect: false });
      if (result?.error) {
        setError('Account created — please sign in.');
        setTab('signin');
      } else {
        router.replace('/dashboard');
      }
    } catch {
      setError('Sign-up failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const inputClass = "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";

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
                {tab === 'signin' ? 'Welcome back.' : 'Create account.'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {tab === 'signin'
                  ? 'Sign in to access your brand dashboard.'
                  : 'Create an account to track your campaigns.'}
              </p>
            </motion.div>

            {/* Tabs */}
            <motion.div variants={fadeUp} className="flex rounded-xl border border-border overflow-hidden">
              {(['signin', 'signup'] as Tab[]).map((t) => (
                <button key={t} type="button" onClick={() => switchTab(t)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                    tab === t
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'signin' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.form key={tab}
                onSubmit={tab === 'signin' ? handleSignIn : handleSignUp}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {error && <ErrorBox msg={error} />}

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                    <input
                      type="email" required autoComplete="email"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@brand.com"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Password {tab === 'signup' && <span className="text-muted-foreground/60 font-normal">(min 6 chars)</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'} required
                      minLength={tab === 'signup' ? 6 : undefined}
                      autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputClass} pr-11`}
                    />
                    <button type="button" onClick={() => setShowPw((p) => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={busy}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all"
                >
                  {busy
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <>{tab === 'signin' ? 'Sign in' : 'Create account'}<ArrowRight className="h-4 w-4" /></>
                  }
                </button>
              </motion.form>
            </AnimatePresence>

          </motion.div>
        </div>
      </main>
    </div>
  );
}
