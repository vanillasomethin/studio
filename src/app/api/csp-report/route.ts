// POST /api/csp-report — collector for Content-Security-Policy violations.
//
// The CSP ships in Report-Only mode, which is the correct way to introduce one:
// it never breaks a page, it only reports. But a report-only policy with nowhere
// to report to is theatre — the violation lands in the visitor's own console
// where nobody at ALIVE will ever read it, so the policy can never be turned on
// with any confidence and stays advisory forever.
//
// This gives the policy somewhere to go. Once a few days of real checkout and
// map traffic produce no violations from our own origins, the header key can be
// switched from Content-Security-Policy-Report-Only to Content-Security-Policy
// and the policy starts actually blocking.
//
// Unauthenticated by necessity: the browser posts these itself, with no
// credentials, before any of our code runs. Treated accordingly — everything is
// bounded and nothing is trusted.

import { NextRequest, NextResponse } from 'next/server';
import { recordEvent, getOrCreateCorrelationId } from '@/lib/telemetry';

export const runtime = 'nodejs';

type CspReport = {
  'csp-report'?: Record<string, unknown>;
  // Reporting API (report-to) uses a different envelope than report-uri.
  body?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  try {
    // Cap the body: this endpoint is open, so an unbounded read is a free way to
    // make us buy memory. Real reports are well under a kilobyte.
    const raw = await req.text();
    if (raw.length > 8_192) return new NextResponse(null, { status: 204 });

    const parsed = JSON.parse(raw) as CspReport | CspReport[];
    const first  = Array.isArray(parsed) ? parsed[0] : parsed;
    const r      = (first?.['csp-report'] ?? first?.body ?? {}) as Record<string, unknown>;

    const directive = String(r['violated-directive'] ?? r['effectiveDirective'] ?? 'unknown').slice(0, 120);
    const blocked   = String(r['blocked-uri']        ?? r['blockedURL']        ?? '').slice(0, 300);
    const document  = String(r['document-uri']       ?? r['documentURL']       ?? '').slice(0, 300);

    // Ignore the noise that every public site collects: browser extensions and
    // injected scripts report against our policy but are not our code, and
    // drowning the real signal is how a report-only rollout stalls.
    const NOISE = ['chrome-extension', 'moz-extension', 'safari-extension', 'about:', 'data:'];
    if (NOISE.some((n) => blocked.startsWith(n))) return new NextResponse(null, { status: 204 });

    // recordEvent, not recordError: recordError hardcodes level 'error', and a
    // policy violation is information about the policy, not a fault. Filing
    // these as errors would bury the real error stream — the one used to verify
    // every deploy — under browser-extension noise from ordinary visitors.
    await recordEvent({
      route:         '/api/csp-report',
      level:         'warn',
      message:       `CSP: ${directive} blocked ${blocked || '(inline)'} on ${document}`,
      actorType:     'user',
      // Browsers send these out-of-band, with no correlation header to carry.
      correlationId: getOrCreateCorrelationId(req.headers.get('x-correlation-id')),
    }).catch(() => { /* reporting must never fail the reporter */ });

    return new NextResponse(null, { status: 204 });
  } catch {
    // Malformed report — the browser does not care about our answer.
    return new NextResponse(null, { status: 204 });
  }
}
