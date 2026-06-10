'use client';
import { useEffect, useState } from 'react';
import { onSessionExpired } from '@/lib/session-events';
import { signIn } from 'next-auth/react';

// Listens for session-expiry events from apiFetch and shows a modal.
// Mount once in root layout.

export function SessionExpiredModal() {
  const [open, setOpen] = useState(false);
  const [returnTo, setReturnTo] = useState('/');

  useEffect(() => {
    setReturnTo(window.location.pathname + window.location.search);
    return onSessionExpired(() => setOpen(true));
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 16px',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn .2s ease',
      }}
    >
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{
        background: '#fff', borderRadius: 16, padding: '32px 28px',
        maxWidth: 360, width: '100%', textAlign: 'center',
        boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
        animation: 'slideUp .25s cubic-bezier(.22,1,.36,1)',
      }}>
        {/* Icon */}
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fafafa', border: '1px solid #e5e5e5', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="8" r="4" stroke="#737373" strokeWidth="1.5" />
            <path d="M3 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#737373" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        <h2 id="session-title" style={{ fontFamily: '"Manrope", sans-serif', fontWeight: 700, fontSize: 17, color: '#0a0a0a', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
          Your session ended
        </h2>
        <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: 13, color: '#737373', lineHeight: 1.6, margin: '0 0 24px' }}>
          You&apos;ve been signed out after a period of inactivity. Any unsaved changes are preserved locally — sign back in to continue.
        </p>

        <button
          onClick={() => signIn(undefined, { callbackUrl: returnTo })}
          style={{
            width: '100%', padding: '12px', borderRadius: 10,
            background: '#0a0a0a', color: '#fff', border: 'none',
            fontFamily: '"Manrope", sans-serif', fontWeight: 600, fontSize: 14,
            cursor: 'pointer', transition: 'background .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1f1f1f'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#0a0a0a'; }}
        >
          Sign in again
        </button>

        <button
          onClick={() => setOpen(false)}
          style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Manrope", sans-serif', fontSize: 12, color: '#a3a3a3', padding: '4px 8px' }}
        >
          Stay on this page
        </button>
      </div>
    </div>
  );
}
