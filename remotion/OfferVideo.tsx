// ALIVE offer video — animated product/offer card for in-store screens.
// React-only (Remotion): renders on Linux/Lambda, no Adobe, no licence. Enter
// animations only (spring/fade), matching ALIVE's no-loops design language.

import { loadFont } from '@remotion/google-fonts/Poppins';
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Load Poppins (800 weight) — used for the ALIVE logo, matches the site logo component.
const { fontFamily: POPPINS } = loadFont('normal', { weights: ['800'] });

export type OfferVideoProps = {
  productName: string;
  brand: string;
  sizeVariant?: string;
  price?: number | null;
  offerText?: string;     // e.g. "TODAY'S OFFER", "FLAT 20% OFF"
  imageUrl?: string;
  accent?: string;
};

export const offerVideoDefaults: OfferVideoProps = {
  productName: 'Cow Ghee Jar',
  brand: 'KC Ghee',
  sizeVariant: '1 Ltr',
  price: 549,
  offerText: "TODAY'S OFFER",
  imageUrl: undefined,
  accent: '#ef4444',
};

const SANS = 'Inter Tight, Inter, system-ui, -apple-system, Segoe UI, sans-serif';
const MONO = 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace';

// Inline ALIVE logo — "alive" in Poppins 800 + red dot, mirrors Logo component exactly.
const AliveLogo: React.FC<{ size?: number; opacity?: number }> = ({ size = 52, opacity = 1 }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', opacity }}>
    <span style={{
      fontFamily: POPPINS,
      fontWeight: 800,
      fontSize: size,
      letterSpacing: '-0.02em',
      lineHeight: 1,
      color: '#0a0a0a',
      textRendering: 'optimizeLegibility',
    }}>
      alive
    </span>
    <span style={{
      width: size * 0.14,
      height: size * 0.14,
      borderRadius: '50%',
      background: '#dc2626',
      marginLeft: size * 0.04,
      flexShrink: 0,
      transform: `translateY(${size * 0.02}px)`,
      display: 'inline-block',
    }} />
  </div>
);

export const OfferVideo: React.FC<OfferVideoProps> = ({
  productName, brand, sizeVariant, price, offerText, imageUrl, accent = '#ef4444',
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const enter = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 18, mass: 0.6 } });

  const fade = (delay: number, span = 12) =>
    interpolate(frame, [delay, delay + span], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const imgScale = interpolate(enter(6), [0, 1], [0.86, 1]);
  const priceScale = interpolate(enter(34), [0, 1], [0.7, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff', fontFamily: SANS }}>
      {/* thin red top rule */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, background: accent }} />

      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', padding: '0 120px', gap: 100 }}>
        {/* Left: product image */}
        <div style={{ flex: '0 0 640px', height: 640, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {imageUrl ? (
            <Img
              src={imageUrl}
              style={{
                maxWidth: 640, maxHeight: 640, objectFit: 'contain',
                transform: `scale(${imgScale})`, opacity: fade(6),
                filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.12))',
              }}
            />
          ) : (
            <div style={{
              width: 520, height: 520, borderRadius: 32, background: '#f4f4f5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: `scale(${imgScale})`, opacity: fade(6),
              color: '#a1a1aa', fontSize: 28, fontWeight: 600,
            }}>{brand}</div>
          )}
        </div>

        {/* Right: copy */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {offerText && (
            <div style={{
              alignSelf: 'flex-start', background: accent, color: 'white',
              fontFamily: MONO, fontSize: 26, fontWeight: 600, letterSpacing: 2,
              padding: '10px 20px', borderRadius: 10,
              transform: `translateY(${interpolate(enter(0), [0, 1], [24, 0])}px)`, opacity: fade(0),
            }}>{offerText}</div>
          )}

          <div style={{
            fontFamily: MONO, fontSize: 28, fontWeight: 600, letterSpacing: 3,
            textTransform: 'uppercase', color: accent, opacity: fade(10),
          }}>{brand}</div>

          <div style={{
            fontSize: 92, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, color: '#0a0a0a',
            transform: `translateY(${interpolate(enter(14), [0, 1], [28, 0])}px)`, opacity: fade(14),
          }}>{productName}</div>

          {sizeVariant && (
            <div style={{ fontSize: 38, color: '#71717a', opacity: fade(22) }}>{sizeVariant}</div>
          )}

          {price != null && (
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 18,
              transform: `scale(${priceScale})`, transformOrigin: 'left center', opacity: fade(34),
            }}>
              <span style={{ fontSize: 64, fontWeight: 700, color: '#0a0a0a' }}>₹</span>
              <span style={{ fontSize: 140, fontWeight: 900, letterSpacing: -4, color: '#0a0a0a' }}>
                {price.toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ALIVE logo — bottom right, matches the site logo component */}
      <div style={{ position: 'absolute', bottom: 52, right: 120, opacity: fade(40) }}>
        <AliveLogo size={48} />
      </div>

      {/* progress keyline */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, height: 4,
        width: interpolate(frame, [0, 90], [0, width], { extrapolateRight: 'clamp' }),
        background: accent, opacity: 0.5,
      }} />
    </AbsoluteFill>
  );
};
