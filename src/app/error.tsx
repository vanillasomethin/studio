'use client';
import { useEffect, useState } from 'react';
import { isChunkLoadError, recover, recoveryAttempted } from '@/components/chunk-error-recovery';

// Next.js global error boundary page — shown for unhandled runtime errors.
// Keep this minimal and reassuring.
//
// Chunk-load failures get special treatment. A lazily-imported panel whose chunk
// 404s (this tab is running a build that a redeploy replaced) throws INSIDE the
// React tree, so the boundary catches it and the window-level listeners in
// ChunkErrorRecovery never fire — which stranded an admin on this page for an
// error a reload fixes (exactly how the Alerts-tab deploy on 2026-08-29 was
// experienced as "the admin panel is broken"). So the boundary itself detects
// that case, shows "updating" instead of an error, and runs the same
// purge-and-reload-once recovery. recover() is sessionStorage-guarded, so a
// second failure falls through to the real error page rather than looping.

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Decided in an effect, not during render: sessionStorage isn't available while
  // the boundary is server-rendered, and reading it must not throw here of all places.
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (isChunkLoadError(error) && !recoveryAttempted()) {
      setUpdating(true);
      void recover();
      return; // stale build, not an incident — skip the error telemetry
    }
    // Silent telemetry ping
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 'error', errorClass: error.name, message: error.message, digest: error.digest, source: 'next-error-page', route: typeof window !== 'undefined' ? window.location.pathname : undefined }),
    }).catch(() => {});
  }, [error]);

  if (updating) {
    return (
      <html lang="en">
        <head>
          <title>Updating — ALIVE</title>
        </head>
        <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fff', color: '#0a0a0a' }}>
          <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 4, opacity: 0.35 }}>
              alive<span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
            </div>
            <p style={{ fontSize: 14, color: '#737373' }}>Getting the latest version…</p>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <title>Something went wrong — ALIVE</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, fontFamily: '"Manrope", system-ui, sans-serif', background: '#fff', color: '#0a0a0a' }}>
        <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>

          {/* Wordmark */}
          <div style={{ fontFamily: '"Manrope", sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em', marginBottom: 48, display: 'flex', alignItems: 'center', gap: 4, opacity: 0.35 }}>
            alive<span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', display: 'inline-block', transform: 'translateY(1px)' }} />
          </div>

          {/* Error marker */}
          <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#dc2626', fontWeight: 600, marginBottom: 24 }}>
            Unexpected error
          </div>

          <h1 style={{ fontFamily: '"Manrope", sans-serif', fontWeight: 700, fontSize: 'clamp(24px, 5vw, 40px)', letterSpacing: '-0.035em', lineHeight: 1.15, margin: '0 0 16px', maxWidth: '14ch' }}>
            Something went wrong on our end.
          </h1>

          <p style={{ fontSize: 16, color: '#737373', lineHeight: 1.65, margin: '0 0 36px', maxWidth: '36ch' }}>
            We've been notified and are looking into it. Your data is safe — nothing was lost.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '12px 24px', borderRadius: 999, border: 'none',
                background: '#0a0a0a', color: '#fff',
                fontFamily: '"Manrope", sans-serif', fontWeight: 600, fontSize: 14,
                cursor: 'pointer', letterSpacing: '-0.01em',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: '12px 24px', borderRadius: 999, border: '1px solid #e5e5e5',
                background: '#fff', color: '#0a0a0a', textDecoration: 'none',
                fontFamily: '"Manrope", sans-serif', fontWeight: 600, fontSize: 14,
              }}
            >
              Go home
            </a>
          </div>

          {error.digest && (
            <p style={{ marginTop: 40, fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#d4d4d4', letterSpacing: '0.1em' }}>
              ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
