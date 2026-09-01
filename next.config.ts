import type {NextConfig} from 'next';

// Security headers applied to every response.
//
// CSP ships as TWO headers, deliberately:
//
//   1. An ENFORCING policy containing only directives that cannot break
//      rendering — they restrict document capabilities, not resource loading.
//      These carry real value (base-tag injection, plugin embedding,
//      clickjacking, and form-based exfiltration of a stolen credential) and
//      have no "did we allowlist every CDN?" failure mode. They are safe to turn
//      on today with no violation data.
//
//   2. The full resource policy, still REPORT-ONLY, because turning it on is
//      only safe with evidence from /api/csp-report — see the note on
//      CSP_REPORT_ONLY below for what has to be true before it flips.
//
// Splitting them means the parts that can be enforced are enforced now, instead
// of the whole policy staying advisory indefinitely because one directive is
// uncertain.

const RAZORPAY = ['https://api.razorpay.com', 'https://checkout.razorpay.com'];

// ── 1. Enforcing. None of these can block a script, style, image or font. ─────
const CSP_ENFORCED = [
  // Stops an injected <base> tag silently repointing every relative URL on the
  // page — including the admin console's own API calls — at an attacker origin.
  "base-uri 'self'",
  // No Flash/Java/embed objects. We use none, so this costs nothing.
  "object-src 'none'",
  // Clickjacking. Duplicates X-Frame-Options below, which is the older header
  // some browsers still prefer; CSP is the one that is actually specified.
  "frame-ancestors 'none'",
  // Bounds where a <form> may submit. Without it, injected markup can POST the
  // page's form data — or a phished admin password — straight to an attacker.
  // Razorpay is listed because checkout can hand off via a form submission.
  `form-action 'self' ${RAZORPAY.join(' ')}`,
  'report-uri /api/csp-report',
].join('; ');

// ── 2. Report-only. The resource allowlist. ──────────────────────────────────
//
// VERIFIED against the actual markup in src/app/layout.tsx, not assumed. The
// previous version of this policy would have broken the site the moment it was
// enforced: it was missing the ELU analytics script (layout.tsx:33), the Google
// Fonts stylesheet (:37) and the gstatic font files (:35) — so flipping the key
// would have blocked webfonts site-wide and killed analytics. Anything added to
// <head> must be added here at the same time.
//
// BEFORE THIS CAN BE ENFORCED, two things must be true:
//   a. /api/csp-report shows no violations from our own origins over a few days
//      of real checkout and map traffic (query TelemetryEvent where
//      route = '/api/csp-report').
//   b. script-src still contains 'unsafe-inline', which is what makes this
//      policy weak against the threat it was written for: an XSS reading the
//      admin credential out of sessionStorage can still run inline. Removing it
//      requires per-request nonces (Next injects inline hydration scripts, and
//      src/app/offline/page.tsx has a deliberate inline recovery script), which
//      means generating the CSP in middleware rather than here.
//
// Worth noting the cheaper fix for (b): the credential only sits in
// sessionStorage because of the shared ADMIN_PASSWORD. Named accounts keep their
// session in an httpOnly cookie that script cannot read at all, so finishing that
// migration removes the asset this policy is protecting.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `form-action 'self' ${RAZORPAY.join(' ')}`,
  // 'unsafe-inline': Razorpay injects an inline bootstrap, and Next injects
  // inline hydration scripts. elu.dev is the analytics tag in layout.tsx.
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://elu.dev",
  `frame-src ${RAZORPAY.join(' ')}`,
  // fonts.googleapis.com serves the stylesheet; gstatic serves the font files.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://elu.dev https://*.r2.dev https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org",
  "worker-src 'self' blob:",
  // Without this the policy reports only into each visitor's own console, where
  // nobody at ALIVE will ever read it — so it could never be turned on with any
  // confidence. Violations land in telemetry (level 'warn'), which is what makes
  // flipping the key an evidenced decision rather than a gamble.
  'report-uri /api/csp-report',
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy',             value: CSP_ENFORCED },
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'flic.kr',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.pexels.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'news.microsoft.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pub-7a9bd7006a434f6c84ea68e69b323918.r2.dev',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
