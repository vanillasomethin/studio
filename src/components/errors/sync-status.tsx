'use client';
import { useEffect, useState } from 'react';
import { SaveStatus } from '@/hooks/use-auto-save';

// Fine-grained status line — use inline next to save buttons or at bottom of forms.
// Shows: Saving… → Saved · last synced X ago → Error + retry

type Props = {
  status: SaveStatus;
  lastSavedText?: string | null;
  retryCount?: number;
  retryIn?: number | null;
  onRetry?: () => void;
  className?: string;
};

const MONO: React.CSSProperties = {
  fontFamily: '"DM Mono", ui-monospace, monospace',
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  fontWeight: 500,
};

export function SyncStatus({ status, lastSavedText, retryCount, retryIn, onRetry, className = '' }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(status !== 'idle');
  }, [status]);

  if (!visible && status === 'idle') return null;

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        transition: 'opacity .3s ease',
        opacity: visible ? 1 : 0,
      }}
    >
      {status === 'pending' && <PendingDot />}
      {status === 'saving' && <Spinner />}
      {status === 'saved' && <CheckMark />}
      {status === 'error' && <ErrorDot />}
      {status === 'offline' && <OfflineDot />}

      <span style={{ ...MONO, color: statusColor(status) }}>
        {status === 'pending' && 'Unsaved changes'}
        {status === 'saving'  && 'Saving…'}
        {status === 'saved'   && (lastSavedText ? `Saved · ${lastSavedText}` : 'All changes saved')}
        {status === 'offline' && 'Saved locally · will sync when online'}
        {status === 'error'   && (
          <>
            {retryCount ? `Couldn't save · retrying (${retryCount})` : "Couldn't save"}
            {retryIn ? ` · ${retryIn}s` : ''}
            {!retryIn && onRetry && (
              <button onClick={onRetry} style={{ ...MONO, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4, padding: 0 }}>
                Try again
              </button>
            )}
          </>
        )}
      </span>
    </div>
  );
}

function statusColor(s: SaveStatus) {
  if (s === 'saved')   return '#16a34a';
  if (s === 'error')   return '#dc2626';
  if (s === 'offline') return '#d97706';
  return '#737373';
}

function Spinner() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: 'spin .8s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="#e5e5e5" strokeWidth="1.5" />
      <path d="M6 1.5 A4.5 4.5 0 0 1 10.5 6" fill="none" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" fill="#dcfce7" />
      <path d="M3.5 6l1.8 1.8L8.5 4" stroke="#16a34a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PendingDot() {
  return <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d4d4d4' }} />;
}

function ErrorDot() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" fill="#fee2e2" />
      <path d="M6 3.5v3M6 8.5v.01" stroke="#dc2626" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function OfflineDot() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" fill="#fef3c7" />
      <path d="M3 3l6 6M5 4.5A3 3 0 0 1 8.83 7M3.17 5A5 5 0 0 1 9 3M6 9v.01" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
