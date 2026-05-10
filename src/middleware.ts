import { auth } from '@/lib/auth';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const hasClerk =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
  Boolean(process.env.CLERK_SECRET_KEY);

const isClerkProtected   = createRouteMatcher(['/dashboard(.*)']);
const isAuthJsProtected  = (pathname: string) => pathname.startsWith('/store-dashboard');

export default async function middleware(req: NextRequest) {
  // Strip Clerk handshake params that crash the Edge Runtime when DNS isn't verified
  if (req.nextUrl.searchParams.has('__clerk_handshake')) {
    const url = req.nextUrl.clone();
    url.searchParams.delete('__clerk_handshake');
    url.searchParams.delete('__clerk_help_debug_token');
    return NextResponse.redirect(url);
  }

  // Auth.js — protect /store-dashboard
  if (isAuthJsProtected(req.nextUrl.pathname)) {
    const session = await auth();
    if (!session) {
      const loginUrl = new URL('/store-dashboard', req.url);
      // Redirect to the same page; PhoneLogin UI will be rendered
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Clerk — protect /dashboard (brand campaigns)
  if (hasClerk && isClerkProtected(req)) {
    return clerkMiddleware(async (clerkAuth, request) => {
      const { userId } = await clerkAuth();
      if (!userId) return NextResponse.redirect(new URL('/login', request.url));
    })(req, {} as never);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
