// MSG91 managed OTP (SMS) — https://docs.msg91.com/p/tf9GTextN/e/Cug_pkdF/MSG91
//
// MSG91 generates, delivers (SMS over the DLT-approved template) and verifies
// the OTP on its side, so we never store or compare codes ourselves. Env-gated,
// like the other optional integrations (Twilio/Resend): if MSG91 isn't
// configured the callers fall back to their existing behaviour.
//
// Env:
//   MSG91_AUTH_KEY          — account auth key
//   MSG91_OTP_TEMPLATE_ID   — DLT-approved OTP template id
//   MSG91_OTP_EXPIRY_MIN    — optional, OTP validity in minutes (default 10)

const BASE = 'https://control.msg91.com/api/v5';

function cfg(): { authkey: string; templateId: string; expiryMin: number } | null {
  const authkey    = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  if (!authkey || !templateId) return null;
  return { authkey, templateId, expiryMin: Number(process.env.MSG91_OTP_EXPIRY_MIN ?? 10) };
}

export function isMsg91Configured(): boolean {
  return cfg() !== null;
}

// MSG91 expects the mobile with country code and no '+', e.g. 919876543210.
// Stored phones are "+91XXXXXXXXXX", so stripping non-digits yields that.
function toMobile(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Sends an OTP via MSG91. Returns true if MSG91 accepted the request. */
export async function sendOtp(phone: string): Promise<boolean> {
  const c = cfg();
  if (!c) return false;
  const mobile = toMobile(phone);
  const url = `${BASE}/otp?template_id=${encodeURIComponent(c.templateId)}&mobile=${mobile}&otp_length=6&otp_expiry=${c.expiryMin}`;
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { authkey: c.authkey, 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({})) as { type?: string };
    return data?.type === 'success';
  } catch {
    return false;
  }
}

/** Verifies an OTP via MSG91. */
export async function verifyOtp(phone: string, otp: string): Promise<{ ok: boolean; message?: string }> {
  const c = cfg();
  if (!c) return { ok: false, message: 'OTP service not configured.' };
  const mobile = toMobile(phone);
  const url = `${BASE}/otp/verify?otp=${encodeURIComponent(otp.trim())}&mobile=${mobile}`;
  try {
    const res = await fetch(url, { method: 'GET', headers: { authkey: c.authkey } });
    const data = await res.json().catch(() => ({})) as { type?: string; message?: string };
    return { ok: data?.type === 'success', message: data?.message };
  } catch {
    return { ok: false, message: 'Could not verify code. Try again.' };
  }
}

/** Re-sends the OTP (text channel). Best-effort. */
export async function resendOtp(phone: string): Promise<boolean> {
  const c = cfg();
  if (!c) return false;
  const mobile = toMobile(phone);
  const url = `${BASE}/otp/retry?mobile=${mobile}&retrytype=text`;
  try {
    const res = await fetch(url, { method: 'GET', headers: { authkey: c.authkey } });
    const data = await res.json().catch(() => ({})) as { type?: string };
    return data?.type === 'success';
  } catch {
    return false;
  }
}
