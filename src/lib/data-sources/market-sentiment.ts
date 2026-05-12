import type { NormalizedExternalSignal } from '@/lib/data-sources/types';

const DEFAULT_URL = process.env.MARKET_SENTIMENT_FEED_URL;

export async function collectMarketSentimentSignals(now = new Date()): Promise<NormalizedExternalSignal[]> {
  const payload = await fetchJson(DEFAULT_URL, [
    { id: 'retail-media-mentions', category: 'industry_mentions', mentions: 124, velocity: 0.18, confidence: 0.77 },
    { id: 'in-store-adoption', category: 'category_trend', mentions: 91, velocity: 0.12, confidence: 0.71 },
  ]);

  return payload.map((row: any) => {
    const confidence = clamp01(Number(row.confidence ?? 0.6));
    const trendVelocity = Number(row.velocity ?? 0);
    const freshness = 1;
    const score = clamp01((Number(row.mentions ?? 0) / 200) * 0.6 + Math.abs(trendVelocity) * 0.4);
    return {
      source: 'market_sentiment',
      sourceId: String(row.id),
      observedAt: now,
      expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      category: String(row.category ?? 'market'),
      summary: `Market sentiment ${row.id} mentions=${row.mentions} velocity=${trendVelocity.toFixed(2)}`,
      details: row,
      score,
      trendVelocity,
      confidence,
      freshness,
      severity: score > 0.75 ? 'high' : score > 0.4 ? 'medium' : 'low',
      recommendedActions: [
        { type: 'adjust_roadmap', title: 'Prioritize features for high-momentum categories', owner: 'product', dueHours: 24 },
        { type: 'monitor', title: 'Track sentiment drift every ingestion cycle', owner: 'growth', dueHours: 6 },
      ],
    } satisfies NormalizedExternalSignal;
  });
}

async function fetchJson<T>(url: string | undefined, fallback: T): Promise<T> {
  if (!url) return fallback;
  const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
  if (!res.ok) return fallback;
  return await res.json() as T;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
