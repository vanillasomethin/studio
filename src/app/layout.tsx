import type { Metadata } from 'next';
import './globals.css';
import '../bones/registry';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/components/providers';
import { cn } from '@/lib/utils';
import { NetworkBanner } from '@/components/errors/network-banner';
import { SessionExpiredModal } from '@/components/errors/session-expired-modal';

export const metadata: Metadata = {
  title: 'ALIVE — In-store advertising for Indian kirana stores',
  description:
    'Alive connects brands, kirana stores, and consumers — right where purchase decisions happen.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Poppins:wght@700;800;900&family=Manrope:wght@200..800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap"
            rel="stylesheet"
          />
        </head>
        <body
          className={cn('min-h-screen bg-background font-sans antialiased')}
          style={{ fontFamily: '"Manrope", system-ui, sans-serif' }}
        >
          <NetworkBanner />
          <SessionExpiredModal />
          <Providers>{children}</Providers>
          <Toaster />
        </body>
      </html>
  );
}
