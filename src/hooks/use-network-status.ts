'use client';
import { useEffect, useState } from 'react';

export type NetworkQuality = 'online' | 'slow' | 'offline';

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkQuality>('online');
  const [since, setSince]   = useState<Date | null>(null);

  useEffect(() => {
    // Initial state
    if (!navigator.onLine) { setStatus('offline'); setSince(new Date()); }

    const goOffline = () => { setStatus('offline'); setSince(new Date()); };
    const goOnline  = () => {
      // Brief probe to confirm actual connectivity
      fetch('/api/health', { method: 'HEAD', cache: 'no-store' })
        .then(() => { setStatus('online'); setSince(null); })
        .catch(() => { setStatus('offline'); });
    };

    // Connection change listeners
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    // Network Information API (Chrome) for slow detection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = (navigator as any).connection;
    const handleChange = () => {
      if (!navigator.onLine) { goOffline(); return; }
      const effectiveType = conn?.effectiveType;
      setStatus(effectiveType === 'slow-2g' || effectiveType === '2g' ? 'slow' : 'online');
    };
    conn?.addEventListener('change', handleChange);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      conn?.removeEventListener('change', handleChange);
    };
  }, []);

  const offlineSince = since
    ? formatOfflineDuration(Date.now() - since.getTime())
    : null;

  return { status, isOnline: status !== 'offline', isSlow: status === 'slow', offlineSince };
}

function formatOfflineDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}
