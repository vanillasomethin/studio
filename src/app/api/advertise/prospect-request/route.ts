// POST /api/advertise/prospect-request — a brand clicking a "Potential" pin on
// /advertise and asking ALIVE to onboard it. Deliberately lighter than
// BrandEnquiry (no agreement, no slot math): just "we'd want a screen here",
// stored against the prospect for Admin → Prospects to see and prioritise.
//
// Public and unauthenticated, same as /api/advertise/enquiry — so it gets the
// same shape of care: rate-limited per IP, the prospect id checked against the
// DB (not trusted blindly), and the write survives even if the notify step
// fails.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hitLimit } from '@/lib/rate-limit';
import { notifyAdminWA } from '@/lib/notify';

type Body = {
  prospectId?: string;
  brandName?: string;
  contactPerson?: string;
  phone?: string;
  notes?: string;
};

const PHONE = /^[6-9]\d{9}$/;

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Body | null;
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const prospectId    = text(body.prospectId, 40);
  const brandName     = text(body.brandName, 120);
  const contactPerson = text(body.contactPerson, 120);
  const phone         = text(body.phone, 15).replace(/\D/g, '').slice(-10);
  const notes         = text(body.notes, 500) || null;

  if (!prospectId)    return NextResponse.json({ error: 'prospectId required' }, { status: 400 });
  if (!brandName)     return NextResponse.json({ error: 'Brand name is required.' }, { status: 400 });
  if (!contactPerson) return NextResponse.json({ error: 'Contact person is required.' }, { status: 400 });
  if (!PHONE.test(phone)) {
    return NextResponse.json({ error: 'Enter a valid 10-digit Indian mobile number.' }, { status: 400 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  if ((await hitLimit(`advertise:prospect-request:ip:${ip}`, 5, 3600)).limited) {
    return NextResponse.json(
      { error: 'That is a lot of requests from one place. Please WhatsApp us instead.' },
      { status: 429 },
    );
  }

  const prospect = await db.prospectLocation.findUnique({
    where: { id: prospectId },
    select: { id: true, label: true, status: true },
  });
  if (!prospect || prospect.status === 'rejected' || prospect.status === 'converted') {
    return NextResponse.json({ error: 'That location is no longer open to requests.' }, { status: 404 });
  }

  const request = await db.prospectRequest.create({
    data: { prospectId, brandName, contactPerson, phone, notes },
  });

  await notifyAdminWA(
    `📍 *${brandName}* wants ALIVE onboarded at *${prospect.label}*\n` +
    `Contact: ${contactPerson} · ${phone}` + (notes ? `\nNote: ${notes}` : ''),
  ).catch(() => {});

  return NextResponse.json({ ok: true, id: request.id });
}
