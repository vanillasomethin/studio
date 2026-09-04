// The admin console's typefaces — Inter Tight for display, Inter for body,
// JetBrains Mono for labels and tabular numbers.
//
// They were the last @import of fonts.googleapis.com in the codebase, so the
// console still paid the third-party CSS hop and the font swap that the rest of
// the product no longer does. next/font self-hosts them now.
//
// Deliberately a separate module from app/fonts.ts: next/font preloads every
// face declared in a module on every route that imports it, so declaring these
// alongside the site's faces made the marketing site preload the console's
// fonts. Only app/admin/layout.tsx imports this.

import { Inter_Tight, Inter, JetBrains_Mono } from 'next/font/google';

/** Admin display + headings. */
export const interTight = Inter_Tight({
  subsets: ['latin'],
  style: ['normal', 'italic'],   // .sb__upgrade h4 is italic
  display: 'swap',
  variable: '--font-inter-tight',
});

/** Admin body text. */
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

/** Admin labels, badges, tabular numbers. */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

/** For the admin layout's wrapper — see the note above on why it is separate. */
export const adminFontVariables = `${interTight.variable} ${inter.variable} ${jetbrainsMono.variable}`;
