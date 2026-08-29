// Backup codes — the recovery path for admin 2FA.
//
// Without these, a lost or wiped authenticator means the only way back into the
// console is hand-editing the production database. That is not a recovery
// procedure, it is an outage, and the fear of it is what stops people enabling
// 2FA at all. Ten single-use codes, generated at activation, make enrolment a
// reversible decision.
//
// Design notes:
//
//   • Stored bcrypt-hashed, exactly like a password. A leaked database must not
//     yield working credentials, and these ARE credentials — each one is a
//     complete second factor on its own.
//   • Single use. A consumed code is removed from the array in the same
//     conditional update that accepts it, so two sessions racing on the same
//     code cannot both succeed.
//   • Shown exactly once, at generation. There is no endpoint that returns them
//     again, because a stored plaintext copy would defeat the hashing.
//   • Crockford-style alphabet with I, L, O, U and 0/1 removed, since these get
//     read off a phone screen or written on paper under pressure.

import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

/** Unambiguous when hand-copied: no 0/O, 1/I/L, or U (which invites profanity). */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUP = 5;
const GROUPS = 2;
export const BACKUP_CODE_COUNT = 10;

/** One code, formatted `XXXXX-XXXXX` — ~49 bits of entropy. */
function makeCode(): string {
  const chars: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    if (g) chars.push('-');
    for (let i = 0; i < GROUP; i++) {
      // randomInt is CSPRNG-backed and rejection-samples, so no modulo bias.
      chars.push(ALPHABET[randomInt(0, ALPHABET.length)]);
    }
  }
  return chars.join('');
}

/** Normalise for comparison: users retype these with stray spaces and lowercase. */
export function normaliseBackupCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Codes are stored without the dash so formatting never affects verification. */
function canonical(code: string): string {
  return normaliseBackupCode(code);
}

/**
 * Generates a fresh set. Returns the plaintext to show the operator ONCE and
 * the hashes to persist — the caller must never store the former.
 */
export async function generateBackupCodes(): Promise<{ plain: string[]; hashes: string[] }> {
  const plain = Array.from({ length: BACKUP_CODE_COUNT }, makeCode);
  // cost 8 rather than the password default: a set of ten is verified by
  // scanning until a match, so cost 10 would put a worst-case failed attempt
  // near a second of CPU on a serverless function. 49 bits of entropy is what
  // actually defends these; the hash only has to make a database leak useless.
  const hashes = await Promise.all(plain.map((c) => bcrypt.hash(canonical(c), 8)));
  return { plain, hashes };
}

/**
 * Finds which stored hash a supplied code matches.
 * Returns the index, or -1. Scans the whole list even after a hit so the time
 * taken does not reveal the position of the matching code.
 */
export async function findBackupCodeIndex(code: string, hashes: string[]): Promise<number> {
  const candidate = canonical(code);
  // A plausible-shaped code only: skips ten bcrypt comparisons on every ordinary
  // mistyped TOTP digit, which would otherwise be a cheap way to load the server.
  if (candidate.length !== GROUP * GROUPS) return -1;

  let found = -1;
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(candidate, hashes[i]) && found === -1) found = i;
  }
  return found;
}
