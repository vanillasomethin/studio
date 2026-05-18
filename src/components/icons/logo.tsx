export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: '"Poppins", sans-serif',
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
        width: 6, height: 6, borderRadius: '50%', background: '#dc2626',
        marginLeft: 2, display: 'inline-block', flexShrink: 0,
        transform: 'translateY(1px)',
      }} />
    </span>
  );
}
