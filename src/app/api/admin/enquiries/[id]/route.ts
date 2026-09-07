// PATCH /api/admin/enquiries/[id] — move an enquiry through triage (admin)
// Auth: requireAdmin — admin/ops session.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

/** Mirrors BrandEnquiry.status. Anything else is rejected rather than stored. */
const STATUSES = ['new', 'contacted', 'won', 'lost'] as const;
type Status = (typeof STATUSES)[number];

function isStatus(v: unknown): v is Status {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;

  let body: { status?: unknown };
  try {
    body = (await req.json()) as { status?: unknown };
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!isStatus(body.status)) {
    return NextResponse.json(
      { error: `Status must be one of: ${STATUSES.join(', ')}.` },
      { status: 400 }
    );
  }

  const before = await db.brandEnquiry.findUnique({
    where: { id },
    select: { status: true, reference: true },
  });
  if (!before) return NextResponse.json({ error: 'Enquiry not found.' }, { status: 404 });

  const enquiry = await db.brandEnquiry.update({
    where: { id },
    data: { status: body.status },
  });

  // Who decided a lead was won or lost is worth being able to ask later, so the
  // previous value is recorded alongside the new one.
  await logAdminAction({
    actor,
    req,
    action: 'brand_enquiry.status',
    target: id,
    meta: { reference: before.reference, from: before.status, to: body.status },
  });

  return NextResponse.json({ enquiry });
}
