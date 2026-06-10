// ALIVE Partner — Service Worker
// Strategy:
//   - API routes  → network-first (fresh data, fall back to cache)
//   - Static assets → cache-first (JS, CSS, images, fonts)
//   - Navigation   → network-first, fall back to /offline if totally offline

const CACHE     = 'alive-partner-v1';
const PRECACHE  = [
  '/store-dashboard',
  '/store',
  '/offline',
];

// ── Install: precache the shell ───────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // Use { cache: 'reload' } so we always get a fresh copy on install
      Promise.allSettled(PRECACHE.map((url) => c.add(new Request(url, { cache: 'reload' }))))
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // API routes and auth — always network-first, short timeout fallback
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    e.respondWith(networkFirst(request));
    return;
  }

  // Static assets (Next.js /_next/) — cache-first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(cacheFirst(request));
    return;
  }

  // HTML navigation — network-first with offline fallback
  if (request.mode === 'navigate') {
    e.respondWith(navigationHandler(request));
    return;
  }

  // Everything else — stale-while-revalidate
  e.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    return cached ?? new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('', { status: 503 });
  }
}

async function staleWhileRevalidate(req) {
  const cached = await caches.match(req);
  const fetchPromise = fetch(req).then((res) => {
    if (res.ok) {
      caches.open(CACHE).then((c) => c.put(req, res.clone()));
    }
    return res;
  }).catch(() => cached);
  return cached ?? fetchPromise;
}

async function navigationHandler(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    const offline = await caches.match('/offline');
    return offline ?? new Response('<h1>You are offline</h1>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
