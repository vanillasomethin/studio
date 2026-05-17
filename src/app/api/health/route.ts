import { NextResponse } from 'next/server';

// Lightweight connectivity probe — used by useNetworkStatus
export function HEAD() {
  return new NextResponse(null, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}

export function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
