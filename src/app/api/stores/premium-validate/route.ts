// GET /api/stores/premium-validate?key=...
// Public. Tells the registration UI whether a premium signup key is valid so it
// can switch to the ₹1000 framing + agreement. The key is also re-validated at
// save time (/api/stores/save) — this endpoint is display-only and never the
// thing that actually grants premium status.

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key') ?? '';
  const premium = !!process.env.PREMIUM_SIGNUP_KEY && key === process.env.PREMIUM_SIGNUP_KEY;
  const monthlyPaise = premium ? Number(process.env.PREMIUM_MONTHLY_PAISE ?? 100000) : 50000;
  return NextResponse.json({ premium, monthlyPaise });
}
