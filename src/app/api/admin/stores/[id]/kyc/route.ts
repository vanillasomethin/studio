// Admin KYC review: approve or reject submitted KYC docs for a store.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const { id } = await params;
  const body = await req.json() as { action: 'approve' | 'reject'; reason?: string };

  if (body.action === 'approve') {
    await db.$executeRaw`
      UPDATE "Store"
      SET "kycStatus" = 'approved', "kycVerifiedAt" = NOW(), "kycRejectedReason" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${id}
    `;
  } else if (body.action === 'reject') {
    await db.$executeRaw`
      UPDATE "Store"
      SET "kycStatus" = 'rejected', "kycRejectedReason" = ${body.reason ?? 'Documents need correction.'}, "updatedAt" = NOW()
      WHERE "id" = ${id}
    `;
  } else {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
  }

  // Identity verification is the one store decision with a legal tail — record
  // who cleared (or refused) the documents, and why.
  await logAdminAction({
    actor, req,
    action: body.action === 'approve' ? 'store.approve_kyc' : 'store.reject_kyc',
    target: id,
    meta:   body.action === 'reject' ? { reason: body.reason ?? null } : {},
  });

  return NextResponse.json({ ok: true });
}
