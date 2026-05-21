// POST /api/admin/brands/[brandId]/offer-trial
// Admin grants a free 1-month trial to a brand. Stamps trialOfferedAt and notifies via WhatsApp/email.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { notifyStoreWA, notifyAdminEmail } from '@/lib/notify';

export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const adminPw = req.headers.get('admin-password');
  if (adminPw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { brandId } = await params;

  const brand = await db.brand.findUnique({
    where:  { id: brandId },
    select: { id: true, brandName: true, contactName: true, email: true, phone: true, trialOfferedAt: true },
  });
  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
  if (brand.trialOfferedAt) return NextResponse.json({ error: 'Trial already offered' }, { status: 409 });

  await db.brand.update({
    where: { id: brandId },
    data:  { trialOfferedAt: new Date() },
  });

  const name = brand.contactName || brand.brandName;
  const msg  = `Hi ${name}! 🎉 ALIVE is offering you a FREE 1-month ad campaign trial on our kirana network. Log in to your dashboard at wearealive.in/dashboard to claim it. — Team ALIVE`;

  // Notify brand via WhatsApp and email (both non-fatal)
  if (brand.phone) notifyStoreWA(brand.phone, msg).catch(() => {});
  if (brand.email) {
    notifyAdminEmail(
      `Your free ALIVE trial is ready, ${name}!`,
      `<p>${msg.replace(/\n/g, '<br>')}</p><p><a href="https://wearealive.in/dashboard">Go to dashboard →</a></p>`,
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
