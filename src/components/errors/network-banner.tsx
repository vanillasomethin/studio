'use client';
import { useEffect, useState } from 'react';
import { useNetworkStatus } from '@/hooks/use-network-status';

// Slides down from top when offline or on a slow connection.
// Dismissible. Auto-hides when back online.

export function NetworkBanner() {
  const { status, isOnline, offlineSince } = useNetworkStatus();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOnline) { setDismissed(false); setVisible(true); }
    else if (visible) {
      // Brief "back online" message then hide
      setTimeout(() => setVisible(false), 3500);
    }
  }, [isOnline]);  // eslint-disable-line

  if (!visible || dismissed) return null;

  const isBack = isOnline && visible;
  const isSlow = status === 'slow';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '10px 20px',
        background: isBack ? '#f0fdf4' : isSlow ? '#fffbeb' : '#1c1c1c',
        borderBottom: `1px solid ${isBack ? '#bbf7d0' : isSlow ? '#fde68a' : '#2e2e2e'}`,
        color: isBack ? '#15803d' : isSlow ? '#92400e' : '#fafafa',
        transform: 'translateY(0)',
        animation: 'bannerSlide .28s cubic-bezier(.22,1,.36,1)',
        fontFamily: '"Manrope", sans-serif',
        fontSize: 13,
      }}
    >
      <style>{`@keyframes bannerSlide{from{transform:translateY(-100%)}to{transform:translateY(0)}}`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Icon */}
        {isBack ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill="#dcfce7" />
            <path d="M5 8l2.2 2.2L11 6" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2l12 12M6.5 5.5A5.5 5.5 0 0 1 13 10M3 7a7 7 0 0 1 2.5-2.5M8 12v.01" stroke={isSlow ? '#d97706' : '#a3a3a3'} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}

        <div>
          <span style={{ fontWeight: 600 }}>
            {isBack ? 'Back online — syncing your changes' :
             isSlow  ? 'Slow connection' :
                       `You're offline${offlineSince ? ` · ${offlineSince}` : ''}`}
          </span>
          {!isBack && !isSlow && (
            <span style={{ opacity: .65, marginLeft: 8, fontSize: 12 }}>
              Changes are saved locally and will sync when you reconnect.
            </span>
          )}
          {isSlow && (
            <span style={{ opacity: .65, marginLeft: 8, fontSize: 12 }}>
              Some actions may be slower than usual.
            </span>
          )}
        </div>
      </div>

      {!isBack && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', opacity: .6, color: 'inherit', fontSize: 18, lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </div>
  );
}
