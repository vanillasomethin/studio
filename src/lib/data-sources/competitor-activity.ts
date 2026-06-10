import type { NormalizedExternalSignal } from '@/lib/data-sources/types';

const DEFAULT_URL = process.env.COMPETITOR_ACTIVITY_FEED_URL;

export async function collectCompetitorActivitySignals(now = new Date()): Promise<NormalizedExternalSignal[]> {
  const payload = await fetchJson(DEFAULT_URL, [
    { id: 'competitor-a', releaseCount7d: 3, commitCount7d: 44, cadenceDelta: 0.25, confidence: 0.8 },
    { id: 'competitor-b', releaseCount7d: 1, commitCount7d: 14, cadenceDelta: -0.1, confidence: 0.65 },
  ]);

  return payload.map((row: any) => {
    const releaseCount = Number(row.releaseCount7d ?? 0);
    const commitCount = Number(row.commitCount7d ?? 0);
    const trendVelocity = Number(row.cadenceDelta ?? 0);
    const confidence = clamp01(Number(row.confidence ?? 0.6));
    const freshness = 1;
    const score = clamp01((releaseCount / 5) * 0.5 + (commitCount / 60) * 0.3 + Math.max(0, trendVelocity) * 0.2);

    return {
      source: 'competitor_activity',
      sourceId: String(row.id),
      observedAt: now,
      expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
      category: 'release_cadence',
      summary: `Competitor ${row.id} releases=${releaseCount}/7d commits=${commitCount}/7d` ,
      details: row,
      score,
      trendVelocity,
      confidence,
      freshness,
      severity: score > 0.72 ? 'high' : score > 0.35 ? 'medium' : 'low',
      recommendedActions: [
        { type: 'respond_competitor', title: 'Review competitor changelog deltas for roadmap response', owner: 'product', dueHours: 12 },
        { type: 'monitor', title: 'Monitor ship cadence acceleration trends', owner: 'growth', dueHours: 12 },
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
