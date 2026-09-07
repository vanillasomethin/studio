// TOTP (RFC 6238) over HMAC-SHA1 — the algorithm every authenticator app
// implements (Google Authenticator, Authy, 1Password, Bitwarden).
//
// Implemented directly on node:crypto rather than pulling in a dependency. It is
// ~60 lines of well-specified arithmetic, and for a second authentication factor
// a reviewable implementation with no supply chain beats an opaque one: adding a
// transitive dependency tree to the login path is itself an attack surface, and
// this is exactly the code an attacker would love to see silently updated.
//
// SHA-1 here is not a weakness. TOTP uses it inside HMAC, which does not rely on
// collision resistance, and it is what the authenticator apps speak. Deviating
// would mean codes that don't validate anywhere.

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const DIGITS = 6;
const PERIOD = 30; // seconds
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Generate a new base32 secret for enrolment (160 bits, per RFC 4226 §4). */
export function generateSecret(): string {
  const buf = randomBytes(20);
  let bits = '';
  for (const byte of buf) bits += byte.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** The 6-digit code for a given counter step. */
function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // Counter is a 64-bit big-endian int; JS bitwise ops are 32-bit, so write it
  // as two 32-bit halves rather than shifting past bit 31.
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac('sha1', key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const bin =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/**
 * Verify a code and return the counter step it matched, or null.
 *
 * Callers need the step, not just a yes/no, to enforce single use: a code is
 * valid for roughly 90 seconds across the ±1 drift window, so verification alone
 * lets an observed code be replayed. Recording the step spent lets the caller
 * refuse it the second time.
 *
 * `window` accepts codes from adjacent steps so a slightly-wrong device clock
 * still works — ±1 step (±30s) is the standard tolerance. Widening it linearly
 * widens the guessing window, so it stays small.
 *
 * The comparison is constant-time: a 6-digit space is small enough that leaking
 * per-digit timing would meaningfully help an attacker.
 */
export function verifyTotpStep(secret: string, code: string, atMs?: number, window = 1): number | null {
  const clean = (code ?? '').replace(/\D/g, '');
  if (clean.length !== DIGITS) return null;

  const key = base32Decode(secret);
  if (key.length === 0) return null;

  const counter = Math.floor((atMs ?? Date.now()) / 1000 / PERIOD);
  const expect = Buffer.from(clean);

  let matched: number | null = null;
  for (let drift = -window; drift <= window; drift++) {
    const step = counter + drift;
    // A negative step is not a valid TOTP counter, and writeUInt32BE throws on
    // one. Only reachable within `window` steps of the Unix epoch (i.e. in
    // tests), but an unhandled throw on the login path is a lockout, so it is
    // skipped rather than left to escape. The branch depends only on the clock,
    // never on the secret or the submitted code, so it leaks no timing signal.
    if (step < 0) continue;
    const candidate = Buffer.from(hotp(key, step));
    // Don't break early on a match — a short-circuit here would reintroduce the
    // timing signal the constant-time compare exists to remove. Later steps
    // overwrite earlier ones, so a code matching more than once (impossible for
    // a sane secret) resolves to the newest step, never an already-spent one.
    if (candidate.length === expect.length && timingSafeEqual(candidate, expect)) matched = step;
  }
  return matched;
}

/** Boolean form, for callers with no replay concern (e.g. enrolment activation). */
export function verifyTotp(secret: string, code: string, atMs?: number, window = 1): boolean {
  return verifyTotpStep(secret, code, atMs, window) !== null;
}

/** otpauth:// URI for the enrolment QR code. */
export function otpauthUri(secret: string, account: string, issuer = 'ALIVE Admin'): string {
  return (
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
    `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`
  );
}
