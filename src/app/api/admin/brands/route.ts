// GET  /api/admin/brands → { brands: { id, brandName, creativeCount, hasLogin, campaignId }[] }
// POST /api/admin/brands → { brand: { id, brandName, … } }   create a login-less brand
//
// The picker list behind Content's brand column and the slot-mode creative chooser.
// Deliberately thin: brands are few and this is a dropdown, so it returns every
// brand in one shot rather than paginating.
//
// POST creates an advertiser that has no self-serve account — the common case, since
// most brands are sold to in person. See the Brand model comment for why userId is
// nullable. Self-serve signup still goes through /api/brands/register, which creates
// the User and the Brand together; this route never touches User at all.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

const MAX_NAME = 120;

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  try {
    const brands = await db.brand.findMany({
      select: {
        id:        true,
        brandName: true,
        userId:    true,
        // How many creatives this brand already owns — lets the picker show
        // "3 creatives" so an admin can tell a set-up brand from an empty one.
        _count: { select: { creatives: true } },
        // The brand's most recent bookable campaign. Slot plans hang off a
        // CAMPAIGN, not a brand, so the loop panel needs this to put an existing
        // brand on another screen without creating a duplicate campaign for it.
        // Cancelled rows are excluded — reusing one would resurrect a booking the
        // admin deliberately stopped.
        campaigns: {
          where:   { status: { not: 'cancelled' } },
          orderBy: { createdAt: 'desc' },
          take:    1,
          select:  { id: true },
        },
      },
      orderBy: { brandName: 'asc' },
    });

    return NextResponse.json({
      brands: brands.map((b) => ({
        id:            b.id,
        brandName:     b.brandName,
        creativeCount: b._count.creatives,
        // Whether this advertiser can sign in. Shown so an admin editing contact
        // details knows whether they are touching someone's account.
        hasLogin:      b.userId != null,
        campaignId:    b.campaigns[0]?.id ?? null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const body = await req.json() as {
      brandName?: string; contactName?: string; email?: string; phone?: string;
    };
    const brandName = (body.brandName ?? '').trim().slice(0, MAX_NAME);
    if (!brandName) return NextResponse.json({ error: 'brandName required' }, { status: 400 });

    // Case-insensitive, so "anand sweets" typed at the second store finds the brand
    // created at the first instead of splitting one advertiser across two rows.
    // Returned rather than rejected: the caller's intent is "make sure this brand
    // exists", and a 409 would just make every caller handle the same retry.
    const existing = await db.brand.findFirst({
      where:  { brandName: { equals: brandName, mode: 'insensitive' } },
      select: { id: true, brandName: true, userId: true },
    });
    if (existing) {
      return NextResponse.json({
        brand: { id: existing.id, brandName: existing.brandName, hasLogin: existing.userId != null, created: false },
      });
    }

    const trimmed = (v: string | undefined) => {
      const s = (v ?? '').trim();
      return s ? s.slice(0, MAX_NAME) : null;
    };

    const brand = await db.brand.create({
      data: {
        brandName,
        // Null, not '' — we have not collected these, and an empty string would
        // read as "they have no phone number".
        contactName: trimmed(body.contactName),
        email:       trimmed(body.email),
        phone:       trimmed(body.phone),
      },
      select: { id: true, brandName: true },
    });

    await logAdminAction({ actor, req, action: 'brand.create', target: brand.id, meta: { brandName } });

    return NextResponse.json({ brand: { id: brand.id, brandName: brand.brandName, hasLogin: false, created: true } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
