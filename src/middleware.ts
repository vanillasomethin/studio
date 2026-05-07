import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const hasClerkCredentials =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
  Boolean(process.env.CLERK_SECRET_KEY);

const isProtected = createRouteMatcher(['/dashboard(.*)']);

export default function middleware(req: NextRequest) {
  // Clerk adds __clerk_handshake to the URL during cross-domain cookie sync.
  // While clerk.wearealive.in DNS is unverified the JWT processing crashes the
  // Edge Runtime. Strip it and redirect clean so the page loads normally.
  if (req.nextUrl.searchParams.has('__clerk_handshake')) {
    const url = req.nextUrl.clone();
    url.searchParams.delete('__clerk_handshake');
    url.searchParams.delete('__clerk_help_debug_token');
    return NextResponse.redirect(url);
  }

  if (!hasClerkCredentials) return NextResponse.next();

  return clerkMiddleware(async (auth, request) => {
    if (!isProtected(request)) return;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  })(req, {} as never);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
