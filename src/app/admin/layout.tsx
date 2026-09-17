import type { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { adminFontVariables } from './fonts';

// The console's three faces are scoped to this subtree rather than the root
// layout, so the marketing site never downloads them. `admin-fonts` is where
// admin.css hangs --font-display / --font-body / --font-mono: those refer to the
// next/font variables, and a custom property is resolved on the element it is
// declared on, so declaring them on :root — where the next/font variables do not
// exist — would leave them invalid.
// Radix tooltips throw "`Tooltip` must be used within `TooltipProvider`" when no
// provider is above them, and that throw reaches the error boundary — the whole
// console goes to "Something went wrong" rather than losing one hover preview.
// Four surfaces render a bare <Tooltip> (Programming → Creatives and its slot
// settings, Playlists, the content picker, Content), so the provider belongs here
// once rather than being repeated in each of them and forgotten by the fifth.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`admin-fonts ${adminFontVariables}`}>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </div>
  );
}
