// Returns the eWeLink OAuth login URL for the admin "Connect eWeLink" button.
// GET /api/admin/ewelink/login-url
// Auth: admin-password header
// The browser navigates to the returned URL; eWeLink redirects back to
// /api/ewelink/callback, whose URL must be whitelisted in the app settings at
// https://dev.ewelink.cc.

import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/with-api-handler';
import { buildLoginUrl, ewelinkConfigured } from '@/lib/ewelink';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';

export const GET = withApiHandler('/api/admin/ewelink/login-url', 'admin', async (req) => {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  if (!ewelinkConfigured()) {
    return NextResponse.json({ error: 'eWeLink not configured — set EWELINK_APP_ID and EWELINK_APP_SECRET' }, { status: 501 });
  }
  const redirectUrl = `${req.nextUrl.origin}/api/ewelink/callback`;
  return NextResponse.json({ url: buildLoginUrl(redirectUrl), redirectUrl });
});
