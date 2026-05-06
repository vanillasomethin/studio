'use client';

import { useEffect, useState } from 'react';
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

// Check sessionStorage to decide where to land after OAuth.
// If brand-onboarding state was saved, go back there (the page will restore
// step + form from sessionStorage). Otherwise go to dashboard.
export default function SSOCallbackPage() {
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('alive_onboarding');
      setRedirectUrl(saved ? '/brand-onboarding' : '/dashboard');
    } catch {
      setRedirectUrl('/dashboard');
    }
  }, []);

  if (!redirectUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl={redirectUrl}
      signUpForceRedirectUrl={redirectUrl}
    />
  );
}
