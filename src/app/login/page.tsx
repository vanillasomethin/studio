'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useSignIn } from '@clerk/nextjs/legacy';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/icons/logo';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } } };

export default function LoginPage() {
  const router         = useRouter();
  const { isSignedIn } = useAuth();
  const { signIn, isLoaded } = useSignIn();

  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn) router.replace('/dashboard');
  }, [isSignedIn, router]);

  const handleGoogleSignIn = async () => {
    if (!isLoaded || !signIn) return;
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
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
            <motion.div variants={fadeUp} className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Brand Login</p>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back.</h1>
              <p className="text-sm text-muted-foreground">
                Sign in to access your brand dashboard.
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                </div>
              )}

              <motion.button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={busy || !isLoaded}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                {busy ? 'Redirecting…' : 'Continue with Google'}
              </motion.button>
            </motion.div>

            <motion.p variants={fadeUp} className="text-center text-xs text-muted-foreground/40">
              New brand?{' '}
              <a href="/brand-onboarding" className="text-primary hover:underline">
                Start your campaign
              </a>
            </motion.p>
          </motion.div>
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
