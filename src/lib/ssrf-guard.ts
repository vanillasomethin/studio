// Fetching a URL somebody typed into the admin panel makes this server a
// confused deputy: it reaches things the operator's own browser cannot — cloud
// metadata at 169.254.169.254, Postgres on a private subnet, anything on
// localhost. Validating the URL string is not enough, because the destination is
// decided by DNS at connect time and can be changed again by a redirect.
//
// So: resolve the host, reject the request if ANY resolved address is
// non-public, and repeat that check on every redirect hop rather than letting
// fetch follow them blind.
import { lookup } from 'node:dns/promises';

export type SafeFetchResult =
  | { ok: true; body: string; finalUrl: string }
  | { ok: false; reason: 'scheme' | 'dns' | 'blocked' | 'redirects' | 'status' | 'too_large' | 'network' };

const MAX_REDIRECTS = 3;
const MAX_BYTES     = 2 * 1024 * 1024; // 2 MB — a headline feed is a few KB
const TIMEOUT_MS    = 10_000;

const ip4 = (s: string): number[] | null => {
  const p = s.split('.');
  if (p.length !== 4) return null;
  const n = p.map((x) => (/^\d{1,3}$/.test(x) ? Number(x) : -1));
  return n.every((x) => x >= 0 && x <= 255) ? n : null;
};

/**
 * True for any address that is not routable on the public internet, and so must
 * never be reachable through a user-supplied URL.
 *
 * Deliberately a denylist of non-public ranges rather than an allowlist of
 * public ones: the complement of "public" is finite and well-known, whereas
 * enumerating the public internet is not.
 */
export function isBlockedAddress(addr: string): boolean {
  const a = addr.toLowerCase();

  // IPv4-mapped and 6to4 embed a v4 address; unwrap before judging.
  const mapped = a.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isBlockedAddress(mapped[1]);

  const v4 = ip4(a);
  if (v4) {
    const [x, y] = v4;
    if (x === 0)                     return true;  // "this network"
    if (x === 10)                    return true;  // RFC1918
    if (x === 127)                   return true;  // loopback
    if (x === 169 && y === 254)      return true;  // link-local — cloud metadata
    if (x === 172 && y >= 16 && y <= 31) return true; // RFC1918
    if (x === 192 && y === 168)      return true;  // RFC1918
    if (x === 192 && y === 0)        return true;  // IETF protocol assignments
    if (x === 100 && y >= 64 && y <= 127) return true; // CGNAT
    if (x === 198 && (y === 18 || y === 19)) return true; // benchmarking
    if (x >= 224)                    return true;  // multicast + reserved + broadcast
    return false;
  }

  // IPv6
  if (a === '::' || a === '::1')     return true;  // unspecified, loopback
  if (/^f[cd]/.test(a))              return true;  // fc00::/7 unique-local
  if (/^fe[89ab]/.test(a))           return true;  // fe80::/10 link-local
  if (/^ff/.test(a))                 return true;  // ff00::/8 multicast
  if (a.startsWith('64:ff9b:'))      return true;  // NAT64
  if (a.startsWith('2002:'))         return true;  // 6to4 — embeds a v4 address
  return false;
}

/** Resolves the host and rejects unless every address it maps to is public. */
async function hostIsSafe(hostname: string): Promise<'ok' | 'dns' | 'blocked'> {
  // A bare IP in the URL never reaches DNS, so judge it directly. Strip the
  // brackets Node keeps on IPv6 literals.
  const bare = hostname.replace(/^\[|\]$/g, '');
  if (ip4(bare) || bare.includes(':')) return isBlockedAddress(bare) ? 'blocked' : 'ok';

  let addrs: { address: string }[];
  try {
    addrs = await lookup(hostname, { all: true });
  } catch {
    return 'dns';
  }
  if (!addrs.length) return 'dns';
  // ANY blocked address disqualifies the host: a name that resolves to both a
  // public and a private address must not be reachable via the private one.
  return addrs.some((a) => isBlockedAddress(a.address)) ? 'blocked' : 'ok';
}

/**
 * Fetch a user-supplied URL with SSRF protections: scheme allowlist, per-hop
 * address validation, a redirect cap and a body cap.
 *
 * Residual risk, stated rather than hidden: between the DNS check and the
 * connect, a hostile resolver can re-answer with a private address (DNS
 * rebinding). Closing that needs connecting to a pinned IP while preserving TLS
 * SNI, which is a bigger change than this route warrants. The check still stops
 * every static private target, every redirect into one, and the metadata
 * endpoint — which is what the reported bug was about.
 */
export async function safeFetchText(rawUrl: string): Promise<SafeFetchResult> {
  const deadline = Date.now() + TIMEOUT_MS;
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let u: URL;
    try { u = new URL(current); } catch { return { ok: false, reason: 'scheme' }; }
    // http/https only. new URL() happily accepts file:, gopher: and friends.
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, reason: 'scheme' };

    const verdict = await hostIsSafe(u.hostname);
    if (verdict !== 'ok') return { ok: false, reason: verdict };

    const remaining = deadline - Date.now();
    if (remaining <= 0) return { ok: false, reason: 'network' };

    let res: Response;
    try {
      res = await fetch(u.toString(), {
        headers:  { 'User-Agent': 'AliveStudio/1.0 (+https://wearealive.in)' },
        redirect: 'manual', // follow by hand so each hop is re-validated
        signal:   AbortSignal.timeout(remaining),
      });
    } catch {
      return { ok: false, reason: 'network' };
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { ok: false, reason: 'status' };
      current = new URL(loc, u).toString(); // resolve relative redirects
      continue;
    }

    if (!res.ok) return { ok: false, reason: 'status' };

    // Cap the body while reading. Content-Length is a hint a hostile server can
    // lie about, so count actual bytes too.
    const declared = Number(res.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > MAX_BYTES) return { ok: false, reason: 'too_large' };

    if (!res.body) return { ok: false, reason: 'network' };
    const reader  = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) { await reader.cancel(); return { ok: false, reason: 'too_large' }; }
        chunks.push(value);
      }
    } catch {
      return { ok: false, reason: 'network' };
    }

    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.length; }
    return { ok: true, body: new TextDecoder().decode(buf), finalUrl: u.toString() };
  }

  return { ok: false, reason: 'redirects' };
}
