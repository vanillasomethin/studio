// GET /api/feed/proxy?url=<rss-or-atom-url>
// Fetches an RSS/Atom feed server-side, returns normalized headlines.
// Cached in-memory for 5 min. Admin-guarded.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { safeFetchText } from '@/lib/ssrf-guard';

type FeedItem = { title: string; link: string; pubDate: string | null };

const cache = new Map<string, { items: FeedItem[]; at: number }>();
const TTL_MS = 5 * 60 * 1000;

function parseRss(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  // crude but robust RSS/Atom parser — pulls <item> or <entry> blocks
  const itemRe = /<(item|entry)\b[\s\S]*?<\/\1>/gi;
  const matches = xml.match(itemRe) ?? [];

  for (const block of matches.slice(0, 30)) {
    const titleM = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkM  = block.match(/<link[^>]*href="([^"]+)"/i) || block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const dateM  = block.match(/<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/\1>/i);
    const rawTitle = (titleM?.[1] ?? '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim();
    if (!rawTitle) continue;
    const link = (linkM?.[1] ?? '').trim();
    const date = (dateM?.[2] ?? '').trim();
    items.push({
      title:   rawTitle,
      link,
      pubDate: date || null,
    });
  }
  return items;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return adminUnauthorized();
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  try {
    new URL(url); // validate
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 });
  }

  const now = Date.now();
  const cached = cache.get(url);
  if (cached && now - cached.at < TTL_MS) {
    return NextResponse.json({ items: cached.items, cached: true });
  }

  // safeFetchText enforces http/https, re-validates the resolved address on
  // every redirect hop, and caps the body. A plain fetch here made this route a
  // confused deputy: it reaches from the server's network position, so an admin
  // could read cloud metadata or anything on a private subnet through it.
  const result = await safeFetchText(url);

  if (!result.ok) {
    // One message for every failure. Distinguishing "connection refused" from
    // "timed out" turns the route into a port scanner for the private network:
    // an attacker learns which internal hosts exist from the error text alone.
    const status = result.reason === 'scheme' || result.reason === 'blocked' ? 400 : 502;
    return NextResponse.json({ error: "Couldn't fetch that feed." }, { status });
  }

  const items = parseRss(result.body);
  cache.set(url, { items, at: now });
  return NextResponse.json({ items, cached: false });
}
