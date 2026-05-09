import { NextRequest, NextResponse } from 'next/server';

// ─── POST — verify admin password ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Dev mode — if env var not set, always allow
  if (!adminPassword) {
    return NextResponse.json({ ok: true });
  }

  try {
    const { password } = await req.json() as { password: string };

    if (password === adminPassword) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
