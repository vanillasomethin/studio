import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// Routes protected by Auth.js session (store partners + brands)
function isProtected(pathname: string) {
  return pathname.startsWith('/store-dashboard') || pathname.startsWith('/dashboard');
}

export default async function middleware(req: NextRequest) {
  // Strip Clerk handshake params (safe to keep during transition period)
  if (req.nextUrl.searchParams.has('__clerk_handshake')) {
    const url = req.nextUrl.clone();
    url.searchParams.delete('__clerk_handshake');
    url.searchParams.delete('__clerk_help_debug_token');
    return NextResponse.redirect(url);
  }

  if (isProtected(req.nextUrl.pathname)) {
    const session = await auth();
    if (!session) {
      const loginUrl = req.nextUrl.pathname.startsWith('/store-dashboard')
        ? new URL('/store-dashboard', req.url)
        : new URL('/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
