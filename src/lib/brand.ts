// Brand configuration — the single file to edit when the brand changes.
//
// The advertiser landing page (/advertise) reads everything brand-facing from
// here: the name, the wordmark, the palette, the type stack and the contact
// block. Nothing under src/components/advertise/* hard-codes a colour, a name or
// a phone number — it either imports from this file or reads one of the CSS
// custom properties that brandStyle() puts on the page root. So a rename or a
// repaint is one edit, here.

import type { CSSProperties } from 'react';

// The wordmark, re-exported rather than redrawn: the house rule is that the
// `alive•` mark is only ever rendered by this component, never as hand-rolled
// markup, and never with its font, weight or colour restyled. Point this line at
// a different component to swap the mark for a new brand.
export { Logo as Wordmark } from '@/components/icons/logo';

export const brand = {
  name: 'ALIVE',
  /** Legal entity that contracts with brands and raises the invoice. */
  legalName: 'VS Collective LLP',
  gstin: '29AAXFV2589C1ZE',
  city: 'Mangaluru',
  region: 'Dakshina Kannada, Karnataka',
  address: '217, Milestone 25, Balmatta, Mangalore',
  email: 'hello@wearealive.in',
  /** E.164 without the +, for wa.me links. */
  phoneE164: '919606072227',
  phoneDisplay: '+91 96060 72227',
} as const;

export const brandLinks = {
  tel: `tel:+${brand.phoneE164}`,
  email: `mailto:${brand.email}`,
  whatsapp: `https://wa.me/${brand.phoneE164}`,
} as const;

/**
 * Palette. Every value is checked for WCAG AA against the surface it is used on:
 * accent on white is 4.9:1, inkMuted on white is 6.9:1, accentStrong on white is
 * 6.5:1. Swap these and re-check — the page has no other source of colour.
 */
export const brandPalette = {
  accent: '#D1372E',
  /** Hover / pressed state and small accent text on tinted surfaces. */
  accentStrong: '#A82A23',
  /** Faint wash for callout panels. Not a gradient, not a glow. */
  accentTint: '#FDF3F2',
  ink: '#141414',
  inkMuted: '#5A5A5A',
  line: '#E3E3E3',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F6F5',
} as const;

/** Arial first, then the platform sans — no webfont to wait on. */
export const brandType = {
  sans: 'Arial, Helvetica, "Helvetica Neue", system-ui, sans-serif',
} as const;

/** #rrggbb → the "H S% L%" triple shadcn's CSS variables expect. */
function hexToHslTriple(hex: string): string {
  const int = parseInt(hex.replace('#', ''), 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Inline style for the landing page root. Publishes the palette as custom
 * properties the sections read (`var(--brand-accent)`), sets the type stack, and
 * re-points the two shadcn variables that carry colour — `--primary` and
 * `--ring` — at the brand accent so shared primitives used inside the page (the
 * FAQ accordion, form inputs) follow the brand rather than the app-wide red.
 */
export function brandStyle(): CSSProperties {
  const vars: Record<string, string> = {
    '--brand-accent': brandPalette.accent,
    '--brand-accent-strong': brandPalette.accentStrong,
    '--brand-accent-tint': brandPalette.accentTint,
    '--brand-ink': brandPalette.ink,
    '--brand-ink-muted': brandPalette.inkMuted,
    '--brand-line': brandPalette.line,
    '--brand-surface': brandPalette.surface,
    '--brand-surface-muted': brandPalette.surfaceMuted,
    '--primary': hexToHslTriple(brandPalette.accent),
    '--ring': hexToHslTriple(brandPalette.accent),
    fontFamily: brandType.sans,
    color: brandPalette.ink,
    backgroundColor: brandPalette.surface,
  };
  return vars as CSSProperties;
}
