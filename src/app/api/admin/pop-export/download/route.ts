// Download one file of an archived proof-of-play export. The CSVs live in the
// private R2 bucket (business records: campaign spend, per-screen activity), so
// like KYC docs they have no public URL — bytes stream only through this
// admin-authenticated route.
// GET /api/admin/pop-export/download?id=<PopExport.id>&file=plays|byAd|byScreen

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { getPrivateObject } from '@/lib/r2';

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();

  const id = req.nextUrl.searchParams.get('id');
  const file = req.nextUrl.searchParams.get('file');
  if (!id || !file || !['plays', 'byAd', 'byScreen'].includes(file)) {
    return NextResponse.json({ error: 'id and file (plays|byAd|byScreen) required' }, { status: 400 });
  }

  const record = await db.popExport.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const key = file === 'plays' ? record.playsKey : file === 'byAd' ? record.byAdKey : record.byScreenKey;
  if (!key) return NextResponse.json({ error: 'Export has no file yet' }, { status: 404 });

  // Defence in depth: only ever serve objects from the archive prefix, so a
  // corrupted DB value cannot make this route stream some other private file.
  if (!key.startsWith('pop-exports/')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const obj = await getPrivateObject(key);
  if (!obj) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const filename = key.split('/').pop() ?? 'alive-pop-export.csv';
  return new NextResponse(Buffer.from(obj.body), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
