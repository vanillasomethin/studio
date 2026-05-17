import { NextResponse } from 'next/server';

// Proxies the Google My Maps KML so Leaflet can load it without CORS issues.
const KML_URL =
  'https://www.google.com/maps/d/kml?mid=1DkPh9XelMTPYXlNEmNQ5fl3qj6-_G0o&forcekml=1';

export const revalidate = 3600; // re-fetch from Google once per hour

export async function GET() {
  try {
    const res = await fetch(KML_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ALIVE-Network/1.0)' },
    });
    if (!res.ok) return new NextResponse('', { status: 502 });
    const kml = await res.text();
    return new NextResponse(kml, {
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new NextResponse('', { status: 502 });
  }
}
