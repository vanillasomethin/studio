'use client';

import { SessionProvider } from 'next-auth/react';
import { EluIdentify } from '@/components/elu-identify';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <EluIdentify />
      {children}
    </SessionProvider>
  );
}
