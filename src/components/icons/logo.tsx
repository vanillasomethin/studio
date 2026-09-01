// The ALIVE wordmark. The dot is sized in em, not pixels, so it stays the same
// proportion of the type wherever this renders — the homepage CSS uses the matching
// --wordmark-dot ratio for its own inline copies of the mark.
const DOT_EM = 0.18;
const DOT_SHIFT_EM = 0.04;

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-poppins), sans-serif',
        fontWeight: 800,
        fontSize: 22,
        letterSpacing: '-0.02em',
        display: 'inline-flex',
        alignItems: 'center',
        color: 'inherit',
        textRendering: 'optimizeLegibility',
        lineHeight: 1,
      }}
    >
      alive
      <span style={{
        width: `${DOT_EM}em`, height: `${DOT_EM}em`, borderRadius: '50%', background: '#dc2626',
        marginLeft: '0.08em', display: 'inline-block', flexShrink: 0,
        transform: `translateY(${DOT_SHIFT_EM}em)`,
      }} />
    </span>
  );
}
