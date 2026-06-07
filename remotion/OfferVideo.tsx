// ALIVE offer video — a clean, animated product/offer card for in-store screens.
// React-only (Remotion): renders on Linux/Lambda, no Adobe, no licence. Enter
// animations only (spring/fade), matching ALIVE's no-loops design language.

import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type OfferVideoProps = {
  productName: string;
  brand: string;
  sizeVariant?: string;
  price?: number | null;   // rupees
  offerText?: string;      // e.g. "TODAY'S OFFER", "FLAT 20% OFF"
  imageUrl?: string;
  accent?: string;         // brand red by default
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

export const OfferVideo: React.FC<OfferVideoProps> = ({
  productName, brand, sizeVariant, price, offerText, imageUrl, accent = '#ef4444',
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Staggered spring helper — enter animation only, settles and holds.
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

      {/* ALIVE wordmark */}
      <div style={{
        position: 'absolute', bottom: 56, right: 120,
        fontFamily: MONO, fontSize: 24, fontWeight: 600, letterSpacing: 6, color: '#d4d4d8',
        opacity: fade(40),
      }}>
        ALIVE · <span style={{ color: accent }}>wearealive.in</span>
      </div>

      {/* base width keyline (uses width to stay responsive if dims change) */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 4, width: interpolate(frame, [0, 90], [0, width], { extrapolateRight: 'clamp' }), background: accent, opacity: 0.5 }} />
    </AbsoluteFill>
  );
};
