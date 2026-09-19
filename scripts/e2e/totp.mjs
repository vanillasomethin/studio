// TOTP code generation for the seeded test admin.
// src/lib/totp.ts only VERIFIES codes (the app never needs to mint one), so the
// generator lives here. scripts/e2e/seed.mjs cross-checks it against that
// verifier, so a drift in either direction fails the seed rather than the login.

import { createHmac } from 'crypto';
const DIGITS = 6, PERIOD = 30;
function base32Decode(secret) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of secret.toUpperCase().replace(/=+$/,'')) {
    const v = A.indexOf(ch); if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i+8), 2));
  return Buffer.from(out);
}
export function totpNow(secret, atMs = Date.now()) {
  const counter = Math.floor(atMs / 1000 / PERIOD);
  const buf = Buffer.alloc(8); buf.writeUInt32BE(Math.floor(counter / 2**32), 0); buf.writeUInt32BE(counter >>> 0, 4);
  const d = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const off = d[d.length-1] & 0x0f;
  const bin = ((d[off] & 0x7f) << 24) | (d[off+1] << 16) | (d[off+2] << 8) | d[off+3];
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}
