import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { notifyStoreWA } from '@/lib/notify';
import { isMsg91Configured, sendOtp as msg91SendOtp, verifyOtp as msg91VerifyOtp } from '@/lib/msg91';

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
}

const OTP_TTL = 600; // 10 minutes

function otpKey(phone: string) {
  return `otp:store:${phone}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action: 'request' | 'verify';
      phone: string;
      otp?: string;
      newPassword?: string;
    };

    const phone = `+91${body.phone.replace(/\D/g, '').slice(-10)}`;

    // ── Phase 1: send OTP ────────────────────────────────────────────────────
    if (body.action === 'request') {
      const user = await db.user.findUnique({ where: { phone } });
      if (!user) {
        // Don't reveal whether the number is registered
        return NextResponse.json({ ok: true });
      }

      // Preferred: MSG91 SMS OTP (it generates, sends and later verifies the code).
      if (isMsg91Configured()) {
        const sent = await msg91SendOtp(phone);
        if (!sent) return NextResponse.json({ error: 'Could not send code. Please try again.' }, { status: 502 });
        return NextResponse.json({ ok: true });
      }

      // Fallback: self-managed OTP delivered over WhatsApp (legacy path).
      const otp = String(Math.floor(100000 + Math.random() * 900000));

      const kv = getRedis();
      if (!kv) return NextResponse.json({ error: 'Reset service unavailable. Contact hello@wearealive.in.' }, { status: 503 });

      await kv.set(otpKey(phone), otp, { ex: OTP_TTL });

      await notifyStoreWA(phone, [
        `🔐 *ALIVE Password Reset*`,
        ``,
        `Your one-time code is: *${otp}*`,
        ``,
        `This code expires in 10 minutes.`,
        `If you did not request this, ignore this message.`,
      ].join('\n'));

      return NextResponse.json({ ok: true });
    }

    // ── Phase 2: verify OTP + set new password ───────────────────────────────
    if (body.action === 'verify') {
      if (!body.otp || !body.newPassword) {
        return NextResponse.json({ error: 'OTP and new password are required.' }, { status: 400 });
      }
      if (body.newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }

      const user = await db.user.findUnique({ where: { phone } });
      if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
      const passwordHash = await bcrypt.hash(body.newPassword, 10);

      // Preferred: MSG91 verifies the code on its side.
      if (isMsg91Configured()) {
        const result = await msg91VerifyOtp(phone, body.otp);
        if (!result.ok) {
          return NextResponse.json({ error: result.message ?? 'Invalid or expired code. Request a new one.' }, { status: 400 });
        }
        await db.user.update({ where: { phone }, data: { passwordHash } });
        return NextResponse.json({ ok: true });
      }

      // Fallback: self-managed OTP from Redis (legacy path).
      const kv = getRedis();
      if (!kv) return NextResponse.json({ error: 'Reset service unavailable.' }, { status: 503 });

      const stored = await kv.get<string>(otpKey(phone));
      if (!stored || stored !== body.otp.trim()) {
        return NextResponse.json({ error: 'Invalid or expired code. Request a new one.' }, { status: 400 });
      }

      await db.user.update({ where: { phone }, data: { passwordHash } });
      await kv.del(otpKey(phone));

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
