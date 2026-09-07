// GET /r/<slug> — trackable QR redirect.
//
// A printed QR encodes this URL rather than the destination, so the target can be
// repointed after the sticker is on a wall and every scan is counted.
//
// The scan write must never delay the redirect: the person is standing in a shop
// waiting for their phone. The row is written in after(), which runs once the
// response is already on its way — a bare floating promise would risk the
// serverless invocation being frozen before the insert lands.
//
// Node runtime, not edge: Prisma here is the standard client (@/lib/db) and needs
// it. Geo therefore comes from Vercel's request headers rather than the
// `request.geo` object, which Next 15 removed — the headers are populated on both
// runtimes, so this keeps working if the route is ever moved to the edge.

import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';

const FALLBACK_URL = 'https://wearealive.in';

/** Vercel percent-encodes non-ASCII geo headers (e.g. a city with an accent). */
function geoHeader(req: NextRequest, name: string): string | null {
  const raw = req.headers.get(name);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw) || null;
  } catch {
    return raw || null;
  }
}

/** Only ever redirect to an absolute http(s) URL — never to a javascript:/data: target. */
function safeTarget(targetUrl: string): string {
  try {
    const u = new URL(targetUrl);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : FALLBACK_URL;
  } catch {
    return FALLBACK_URL;
  }
}

function redirect(to: string) {
  const res = NextResponse.redirect(to, 302);
  // Without this a CDN or browser can cache the hop and later scans never reach
  // us — the counts would silently flatten out.
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let destination: { id: string; targetUrl: string } | null = null;
  try {
    destination = await db.qrDestination.findUnique({
      where: { slug },
      select: { id: true, targetUrl: true },
    });
  } catch {
    // Database unreachable — still send the person somewhere useful.
    return redirect(FALLBACK_URL);
  }

  if (!destination) return redirect(FALLBACK_URL);

  const destinationId = destination.id;
  const referrer  = req.headers.get('referer') ?? null;
  const userAgent = req.headers.get('user-agent') ?? null;
  const ip        = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  const country   = geoHeader(req, 'x-vercel-ip-country');
  const city      = geoHeader(req, 'x-vercel-ip-city');

  after(async () => {
    try {
      await db.qrScan.create({
        data: { destinationId, referrer, userAgent, ip, country, city },
      });
    } catch {
      // A lost scan count must never surface to the person scanning.
    }
  });

  return redirect(safeTarget(destination.targetUrl));
}
