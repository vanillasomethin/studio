// The site's three typefaces, self-hosted by next/font.
//
// They used to come from a <link> to fonts.googleapis.com with display=swap,
// which put two network round trips (the CSS, then the woff2 from gstatic)
// between first paint and the real glyphs. Everything painted in the generic
// `sans-serif` first and then jumped — most visibly on the loading screen, where
// the alive• wordmark is set in Poppins 800 at up to 140px, so even a small
// metric difference moves the mark by tens of pixels.
//
// next/font fixes both halves of that:
//   • the woff2 is downloaded at build time and served from our own origin, so
//     there is no third-party CSS hop and the file is preloaded;
//   • it derives a fallback @font-face from the real font's metrics
//     (size-adjust / ascent-override / descent-override), so the pre-swap paint
//     occupies the same box as the loaded font and the swap is invisible.
//
// Each font is exposed as a CSS variable rather than a class, because the
// stylesheet refers to these families by name in ~40 places.

import { Poppins, Manrope, DM_Mono } from 'next/font/google';

/** Wordmark and display headings. Static weights — Poppins has no variable cut. */
export const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-poppins',
});

/** Body and headline text. Variable font, so the whole 200–800 axis is one file. */
export const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

/** Editorial labels and numerics. */
export const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-dm-mono',
});

// The admin console's own three faces live in app/admin/fonts.ts, NOT here:
// next/font preloads every face a module declares onto every route that imports
// that module, so keeping them in this file made a shopper on the homepage
// preload the console's fonts too.

/** Every site font variable, for the <html> className. */
export const fontVariables = `${poppins.variable} ${manrope.variable} ${dmMono.variable}`;
