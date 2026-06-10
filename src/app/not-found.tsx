import Link from 'next/link';

// Premium 404 — calm, editorial, zero anxiety

export default function NotFound() {
  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center', fontFamily: '"Manrope", system-ui, sans-serif', background: '#fff', color: '#0a0a0a' }}>

      {/* Wordmark */}
      <div style={{ fontFamily: '"Manrope", sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em', marginBottom: 56, display: 'flex', alignItems: 'center', gap: 4, opacity: 0.3 }}>
        alive<span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', display: 'inline-block', transform: 'translateY(1px)' }} />
      </div>

      {/* Large editorial 404 */}
      <div style={{ fontFamily: '"Manrope", sans-serif', fontWeight: 800, fontSize: 'clamp(100px,20vw,200px)', lineHeight: 1, letterSpacing: '-0.055em', color: '#f0f0f0', userSelect: 'none', marginBottom: -16 }}>
        404
      </div>

      <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#dc2626', fontWeight: 600, marginBottom: 20 }}>
        Page not found
      </div>

      <h1 style={{ fontWeight: 700, fontSize: 'clamp(20px,4vw,32px)', letterSpacing: '-0.03em', lineHeight: 1.2, margin: '0 0 14px', maxWidth: '18ch' }}>
        This page doesn&apos;t exist.
      </h1>

      <p style={{ fontSize: 15, color: '#737373', lineHeight: 1.65, margin: '0 0 36px', maxWidth: '32ch' }}>
        It may have moved, been deleted, or the link might have a typo in it.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/"
          style={{ padding: '12px 24px', borderRadius: 999, border: 'none', background: '#0a0a0a', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none', letterSpacing: '-0.01em' }}
        >
          Back to homepage
        </Link>
        <Link
          href="/store-dashboard"
          style={{ padding: '12px 24px', borderRadius: 999, border: '1px solid #e5e5e5', background: '#fff', color: '#0a0a0a', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
        >
          Store dashboard
        </Link>
      </div>
    </div>
  );
}
