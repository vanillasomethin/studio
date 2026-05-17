import { NextRequest, NextResponse } from 'next/server';
import { signedUploadUrl, publicUrl } from '@/lib/r2';

function checkAdmin(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !process.env.ADMIN_PASSWORD || pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const key  = searchParams.get('key')  ?? '';
  const type = searchParams.get('type') ?? 'image/jpeg';
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
  try {
    const uploadUrl = await signedUploadUrl(key, type);
    return NextResponse.json({ uploadUrl, publicUrl: publicUrl(key) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
