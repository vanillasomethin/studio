'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

// Dedicated SSO callback for brand-onboarding — always lands back on onboarding
export default function SSOCallbackOnboardingPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl="/brand-onboarding"
      signUpForceRedirectUrl="/brand-onboarding"
    />
  );
}
