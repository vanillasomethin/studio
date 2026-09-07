import type { ReactNode } from 'react';
import { adminFontVariables } from './fonts';

// The console's three faces are scoped to this subtree rather than the root
// layout, so the marketing site never downloads them. `admin-fonts` is where
// admin.css hangs --font-display / --font-body / --font-mono: those refer to the
// next/font variables, and a custom property is resolved on the element it is
// declared on, so declaring them on :root — where the next/font variables do not
// exist — would leave them invalid.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className={`admin-fonts ${adminFontVariables}`}>{children}</div>;
}
