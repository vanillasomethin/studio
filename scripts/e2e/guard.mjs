// Refuses to run against anything that is not a local, throwaway database.
//
// Every script in this directory writes real rows: it books slots, pairs devices
// and resets tables. Pointed at the production Neon URL it would put ads on real
// screens. The check is here rather than in each script so there is exactly one
// place to get it right, and it is deliberately an allowlist of local hosts —
// a "does it look like prod" denylist fails open on the URL nobody thought of.

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;

export function assertLocalDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — see scripts/e2e/README.md');
  }
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a parseable URL');
  }
  if (!LOCAL.test(host)) {
    throw new Error(
      `Refusing to run: DATABASE_URL points at "${host}", not a local database.\n` +
      'These scripts write bookings and pair devices — they are for a disposable\n' +
      'local Postgres only. See scripts/e2e/README.md.',
    );
  }
  return url;
}

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:9002';

/** Chromium that ships with the image; the repo's Playwright may pin a newer build. */
export const CHROME =
  process.env.E2E_CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failures = 0;
export const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.error(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};
export const ok = (name, cond, detail = '') => {
  if (cond) { console.log(`  ok   ${name}${detail ? `  — ${detail}` : ''}`); return; }
  failures++;
  console.error(`  FAIL ${name}${detail ? `  — ${detail}` : ''}`);
};
export const finish = (label) => {
  console.log(failures === 0 ? `\n${label}: all checks passed.` : `\n${label}: ${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
};
