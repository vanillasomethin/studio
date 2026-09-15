// The ALIVE wordmark — the only place "alive" + its red dot gets drawn. Font,
// weight, letter-spacing and the dot's proportion are fixed here and never
// meant to be restyled by a caller; only the overall size is a caller's call.
//
// Defaults to 22px, matching every existing call site that never set a size —
// so dropping this in anywhere still looks the same as before. Pass `size`
// (px) for a different fixed size, or `size="inherit"` to instead pick up
// whatever font-size a wrapping element already establishes (a clamp() on a
// splash-screen heading, a footer h3, …) — used by page.tsx's own three
// wordmark instances, which used to hand-roll "alive" + a separately-sized
// dot span per spot, the actual reason the dot read as a different fraction
// of the type from one place to the next.
export function Logo({ className, size = 22 }: { className?: string; size?: number | 'inherit' }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: 'var(--font-poppins), sans-serif',
        fontWeight: 800,
        fontSize: size === 'inherit' ? 'inherit' : `${size}px`,
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
        width: 'var(--wordmark-dot, 0.18em)', height: 'var(--wordmark-dot, 0.18em)',
        borderRadius: '50%', background: '#dc2626',
        marginLeft: '0.08em', display: 'inline-block', flexShrink: 0,
        transform: 'translateY(var(--wordmark-dot-shift, 0.04em))',
      }} />
    </span>
  );
}
