// GET /api/apk/latest
// Stable internal URL → redirects to the current ALIVE Player APK.
// Admin can update by setting ALIVE_APK_URL env var or uploading via site-media tab.

import { NextResponse } from 'next/server';

const FALLBACK_APK_URL = 'https://github.com/vanillasomethin/ALIVE-Player/releases/tag/sideload-latest';

export async function GET() {
  const url = process.env.ALIVE_APK_URL?.trim() || FALLBACK_APK_URL;
  return NextResponse.redirect(url, 302);
}
