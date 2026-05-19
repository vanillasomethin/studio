export default function OfflinePage() {
  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center', fontFamily: '"Manrope", system-ui, sans-serif' }}>
      <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.03em', marginBottom: 48, display: 'flex', alignItems: 'center', gap: 4, opacity: 0.4 }}>
        alive<span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', display: 'inline-block', transform: 'translateY(1px)' }} />
      </div>
      <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#dc2626', fontWeight: 600, marginBottom: 20 }}>
        No connection
      </div>
      <h1 style={{ fontWeight: 700, fontSize: 'clamp(22px, 5vw, 36px)', letterSpacing: '-0.03em', lineHeight: 1.2, margin: '0 0 14px', maxWidth: '16ch' }}>
        You&apos;re offline right now
      </h1>
      <p style={{ fontSize: 15, color: '#737373', lineHeight: 1.65, margin: '0 0 36px', maxWidth: '34ch' }}>
        Your data is saved. Connect to the internet to sync offers, bills, and earnings.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{ padding: '12px 28px', borderRadius: 999, border: 'none', background: '#0a0a0a', color: '#fff', fontFamily: '"Manrope", sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  );
}
