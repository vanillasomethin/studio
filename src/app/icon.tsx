import { ImageResponse } from 'next/og';

// The PNG icon Next serves at /icon, alongside app/favicon.ico.
//
// It used to be a bare red circle — the wordmark's dot with the wordmark
// removed, which is not the brand, just a dot. It now matches favicon.ico: the
// "a" with its red dot, the mark's distinctive part, which is what survives at
// 32px when the full "alive•" would be a smudge.
//
// Drawn rather than generated from the font on purpose: ImageResponse would need
// the Poppins file loaded and shipped into the edge bundle for one glyph, and a
// tab icon that silently falls back to a system face is worse than a shape we
// control. The proportions follow scripts/generate-pwa-icons.js so the two
// cannot drift apart.

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* The "a", drawn as a bowl with a stem so it reads at 32px without a
            webfont: a filled ring plus a bar down its right side. */}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', position: 'relative', width: 17, height: 17 }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: 17,
                height: 17,
                borderRadius: '50%',
                border: '4px solid #0a0a0a',
              }}
            />
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 3,
                width: 4,
                height: 14,
                background: '#0a0a0a',
                borderRadius: 1,
              }}
            />
          </div>
          {/* The red dot, on the baseline, at the wordmark's proportion. */}
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: '#dc2626',
              marginLeft: 2,
              marginBottom: 1,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
