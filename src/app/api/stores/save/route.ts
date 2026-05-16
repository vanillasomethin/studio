import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { notifyAdminWA, storeRegistrationMsg } from '@/lib/notify';
import { respond } from '@/lib/api-envelope';

// ─── Redis (dual-write for admin panel backward compat during migration) ──────

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
}

// ─── GET — list all stores (admin) ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const route = '/api/stores/save';
  const startedAtMs = Date.now();
  const pw = req.headers.get('admin-password') ?? '';
  if (process.env.ADMIN_PASSWORD && pw !== process.env.ADMIN_PASSWORD) {
    const envelope = await respond({ error: 'Unauthorized' }, { route, request: { hasAdminPassword: !!pw }, outcome: 'unauthorized', policyFlags: ['admin_guard'], errorCategory: 'auth', startedAtMs });
    return NextResponse.json(envelope, { status: 401 });
  }
  try {
    const stores = await db.store.findMany({
      include: { user: { select: { phone: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    // Flatten user.phone/email to top level for admin panel
    const result = stores.map(({ user, ...s }) => ({
      ...s,
      phone:     user?.phone ?? null,
      email:     user?.email ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      agreedAt:  s.agreedAt?.toISOString() ?? null,
      onboardingStage: s.onboardingStage,
      payoutStatus: s.payoutStatus,
      payoutMethod: s.payoutMethod,
      upiId: s.upiId,
      bankAccountName: s.bankAccountName,
      bankAccountNo: s.bankAccountNo,
      bankIfsc: s.bankIfsc,
      bankName: s.bankName,
      payoutLastPaidAt: s.payoutLastPaidAt?.toISOString() ?? null,
      payoutNotes: s.payoutNotes ?? null,
    }));
    const envelope = await respond(result, { route, request: { operation: 'list_stores' }, outcome: 'success', startedAtMs });
    return NextResponse.json(envelope);
  } catch (e) {
    const envelope = await respond({ error: (e as Error).message }, { route, request: { operation: 'list_stores' }, outcome: 'server_error', policyFlags: ['exception'], errorCategory: 'runtime', startedAtMs });
    return NextResponse.json(envelope, { status: 500 });
  }
}

// ─── POST — register a new store partner ─────────────────────────────────────

type RegistrationBody = {
  storeName:    string;
  ownerName:    string;
  whatsapp:     string;   // 10-digit, no country code
  password:     string;
  address:      string;   // mandatory
  locality?:    string;
  city?:        string;
  pincode?:     string;
  lat?:         string;
  lng?:         string;
  gstin?:       string;
  referredBy?:  string;
  referralCode: string;
  agreedAt:     string;
  payoutMethod?: string;
  upiId?: string;
  bankAccountName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankName?: string;
};

export async function POST(req: NextRequest) {
  const route = '/api/stores/save';
  const startedAtMs = Date.now();
  try {
    const body = await req.json() as RegistrationBody;

    if (!body.address?.trim()) {
      const envelope = await respond({ error: 'Shop address is required.' }, { route, request: { hasAddress: false }, outcome: 'invalid_request', policyFlags: ['missing_required_fields'], errorCategory: 'validation', startedAtMs });
      return NextResponse.json(envelope, { status: 400 });
    }

    const phone = `+91${body.whatsapp.replace(/\D/g, '').slice(-10)}`;

    // Guard: duplicate phone
    const existing = await db.user.findUnique({ where: { phone } });
    if (existing) {
      const envelope = await respond({ error: 'An account with this number already exists.' }, { route, request: { phone }, outcome: 'conflict', policyFlags: ['duplicate_account'], errorCategory: 'duplicate', startedAtMs });
      return NextResponse.json(envelope, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await db.user.create({
      data: {
        phone,
        passwordHash,
        name: body.ownerName,
        role: 'STORE_PARTNER',
        store: {
          create: {
            storeName:    body.storeName,
            ownerName:    body.ownerName,
            whatsapp:     body.whatsapp,
            address:      body.address,
            gstin:        body.gstin || null,
            locality:     body.locality,
            city:         body.city,
            pincode:      body.pincode,
            lat:          body.lat ? parseFloat(body.lat) : null,
            lng:          body.lng ? parseFloat(body.lng) : null,
            referralCode: body.referralCode,
            referredBy:   body.referredBy || null,
            agreedAt:     new Date(body.agreedAt),
            payoutMethod: body.payoutMethod || null,
            upiId: body.upiId || null,
            bankAccountName: body.bankAccountName || null,
            bankAccountNo: body.bankAccountNo || null,
            bankIfsc: body.bankIfsc || null,
            bankName: body.bankName || null,
          },
        },
      },
      include: { store: true },
    });

    // Dual-write to Redis so the existing admin panel still lists new stores
    try {
      const kv = getRedis();
      if (kv && user.store) {
        const s = user.store;
        const ids: string[] = (await kv.get<string[]>('stores:index')) ?? [];
        if (!ids.includes(s.id)) await kv.set('stores:index', [s.id, ...ids]);
        await kv.set(`store:${s.id}`, {
          id:           s.id,
          storeName:    s.storeName,
          ownerName:    s.ownerName,
          phone,
          whatsapp:     s.whatsapp,
          address:      s.address ?? '',
          locality:     s.locality ?? '',
          city:         s.city ?? '',
          pincode:      s.pincode ?? '',
          referralCode: s.referralCode,
          referredBy:   s.referredBy ?? '',
          agreedAt:     s.agreedAt?.toISOString() ?? '',
          createdAt:    s.createdAt.toISOString(),
        });
      }
    } catch {
      // Redis dual-write failure is non-fatal — Postgres is source of truth
    }

    // Notify admin via WhatsApp (non-fatal)
    void notifyAdminWA(storeRegistrationMsg({
      storeName: body.storeName,
      ownerName: body.ownerName,
      phone,
      city:    body.city    ?? null,
      address: body.address ?? null,
      gstin:   body.gstin   ?? null,
    }));

    return NextResponse.json({ success: true, referralCode: user.store?.referralCode });
    const envelope = await respond({ success: true, referralCode: user.store?.referralCode }, { route, request: { phone, storeName: body.storeName }, outcome: 'success', startedAtMs });
    return NextResponse.json(envelope);
  } catch (e) {
    const msg = (e as Error).message ?? 'Failed to register store';
    const envelope = await respond({ error: msg }, { route, request: { operation: 'register_store' }, outcome: 'server_error', policyFlags: ['exception'], errorCategory: 'runtime', startedAtMs });
    return NextResponse.json(envelope, { status: 500 });
  }
}
