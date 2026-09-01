// The typeface. Singular — the whole product is set in Poppins.
//
// It used to be five: Poppins, Manrope and DM Mono on the marketing site and
// store dashboard, Inter Tight and JetBrains Mono in the admin console, all
// pulled from fonts.googleapis.com with display=swap. That meant two network
// round trips (the CSS, then each woff2 from gstatic) before any real glyph, so
// everything painted in a fallback and then jumped — most visibly on the loading
// screen, where the alive• wordmark is Poppins 800 at up to 140px.
//
// Poppins is the one that could not be dropped: the alive• wordmark is Poppins
// 800 and the brand is defined by it (see CLAUDE.md), so making it the single
// family is what makes "one font" and "the logo is untouched" the same decision.
//
// next/font self-hosts it: the woff2 is fetched at build time and served from
// our own origin with a preload, so there is no third-party hop at all.
//
// Everything downstream — the stylesheet, admin.css, Tailwind's font-sans,
// inline styles — refers to `--font-sans` and nothing else, so swapping the
// product's typeface is a change to the one call below.

import { Poppins } from 'next/font/google';

export const sans = Poppins({
  subsets: ['latin'],
  // Poppins has no variable cut, so each weight is its own file. These are the
  // ones the UI actually uses; adding more costs another download each.
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-sans',
});

/** For the <html> className, so --font-sans is defined for the whole document. */
export const fontVariables = sans.variable;
