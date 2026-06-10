'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export function EluIdentify() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.elu) return;

    if (status === 'authenticated' && session?.user?.email) {
      // ELU Analytics: attach the signed-in user's email to their session so product
      // analytics can attribute behavior to a real person instead of an anonymous
      // device. Optional — safe to remove if you don't want to share email with
      // analytics. See https://elu.dev for docs.
      window.elu.identify(session.user.email, { email: session.user.email });
    }

    if (status === 'unauthenticated') {
      window.elu.reset();
    }
  }, [status, session?.user?.email]);

  return null;
}
