// GET /api/apk/latest
// Stable internal URL → redirects to the current ALIVE Player APK.
// Admin can update by setting ALIVE_APK_URL env var or uploading via site-media tab.

import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.ALIVE_APK_URL?.trim();
  if (!url) {
    return NextResponse.json(
      { error: 'APK not yet uploaded. Contact ALIVE admin (+91 74113 24448) to receive the installer.' },
      { status: 404 },
    );
  }
  return NextResponse.redirect(url, 302);
}
