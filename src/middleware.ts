import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const hasClerkCredentials =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
  Boolean(process.env.CLERK_SECRET_KEY);

export default async function middleware(req: NextRequest, evt: NextFetchEvent) {
  if (!hasClerkCredentials) {
    return NextResponse.next();
  }

  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');
  const isProtected = createRouteMatcher(['/dashboard(.*)']);

  const handler = clerkMiddleware(async (auth, request) => {
    if (isProtected(request)) {
      await auth.protect();
    }
  });

  return handler(req, evt);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
