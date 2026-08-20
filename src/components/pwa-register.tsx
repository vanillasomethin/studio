'use client';

import { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const DISMISSED_KEY = 'alive_pwa_dismissed';

export function PwaRegister() {
  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => { /* non-fatal */ });
    }
  }, []);

  return null;
}

function isIosSafari() {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as MacIntel with touch, so UA sniffing alone misses it.
  const iOS = /iphone|ipad|ipod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!iOS) return false;
  // Chrome/Firefox/Edge on iOS can't install to the home screen at all.
  return !/crios|fxios|edgios/i.test(ua);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// Shown only on store-dashboard — nudges mobile users to install.
// Two paths: Android/desktop Chrome fires `beforeinstallprompt` and we can
// trigger the native sheet; iOS Safari never fires it, so we show the manual
// Share → Add to Home Screen steps instead.
export function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show,   setShow]   = useState(false);
  const [ios,    setIos]    = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (isIosSafari()) {
      setIos(true);
      setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setShow(false));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setShow(false);
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt=""
          className="h-10 w-10 shrink-0 rounded-xl border border-border"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">Add ALIVE to Home Screen</p>
          <p className="text-[11px] text-muted-foreground">Works offline · No App Store needed</p>
        </div>
        {!ios && (
          <button
            onClick={() => void install()}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white"
          >
            <Download className="h-3.5 w-3.5" /> Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {ios && (
        <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
          Tap <Share className="inline h-3.5 w-3.5 -translate-y-px text-foreground" />{' '}
          <span className="font-semibold text-foreground">Share</span> below, then choose{' '}
          <span className="font-semibold text-foreground">Add to Home Screen</span>.
        </p>
      )}
    </div>
  );
}
