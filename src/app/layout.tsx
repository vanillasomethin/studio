import type { Metadata } from 'next';
import './globals.css';
import '../bones/registry';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { Providers } from '@/components/providers';
import { cn } from '@/lib/utils';
import { NetworkBanner } from '@/components/errors/network-banner';
import { SessionExpiredModal } from '@/components/errors/session-expired-modal';
import { PwaRegister } from '@/components/pwa-register';
import ChunkErrorRecovery from '@/components/chunk-error-recovery';
import { fontVariables } from './fonts';

export const metadata: Metadata = {
  title: 'ALIVE — In-store advertising for Indian kirana stores',
  description:
    'Alive connects brands, kirana stores, and consumers — right where purchase decisions happen.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ALIVE Partner',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" className={fontVariables}>
        <head>
          {/*
            Marks the document once the webfonts have actually loaded, so the
            loading screen's wordmark can wait for Poppins instead of painting in
            a fallback and jumping (see .loader-mark in globals.css).

            Inline and synchronous on purpose: it has to run before first paint,
            or the class arrives too late to prevent the flash it exists to stop.
            The 1.2s timeout is the safety net — a font that fails to load must
            reveal the mark rather than hide it forever.
          */}
          <script
            dangerouslySetInnerHTML={{
              __html:
                "(function(){var r=function(){document.documentElement.classList.add('fonts-ready')};" +
                "setTimeout(r,1200);try{document.fonts?document.fonts.ready.then(r):r()}catch(e){r()}})()",
            }}
          />
          {/* ELU Analytics */}
          <script async src="https://elu.dev/v1/elu_pk_live_K1L6QWGkeB5UyhEp3HiP6sc70C.js" />
          {/* PWA / home-screen meta */}
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="ALIVE Partner" />
          <meta name="application-name" content="ALIVE Partner" />
          <meta name="msapplication-TileColor" content="#ef4444" />
          <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        </head>
        <body
          className={cn('min-h-screen bg-background font-sans antialiased')}
          style={{ fontFamily: 'var(--font-manrope), system-ui, sans-serif' }}
        >
          <ChunkErrorRecovery />
          <PwaRegister />
          <NetworkBanner />
          <SessionExpiredModal />
          <Providers>{children}</Providers>
          <Toaster />
          <SonnerToaster richColors position="top-right" />
        </body>
      </html>
  );
}
