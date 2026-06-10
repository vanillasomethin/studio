import type { NormalizedExternalSignal } from '@/lib/data-sources/types';

const DEFAULT_URL = process.env.INFRA_COST_FEED_URL;

export async function collectInfraCostEfficiencySignals(now = new Date()): Promise<NormalizedExternalSignal[]> {
  const payload = await fetchJson(DEFAULT_URL, [
    { id: 'api-cluster', service: 'api', costPerHourUsd: 42, utilizationPct: 55, anomalyScore: 0.62, confidence: 0.86 },
    { id: 'worker-pool', service: 'workers', costPerHourUsd: 18, utilizationPct: 23, anomalyScore: 0.74, confidence: 0.89 },
  ]);

  return payload.map((row: any) => {
    const anomalyScore = clamp01(Number(row.anomalyScore ?? 0));
    const utilizationPct = Number(row.utilizationPct ?? 0);
    const confidence = clamp01(Number(row.confidence ?? 0.7));
    const underUtilization = Math.max(0, (50 - utilizationPct) / 50);
    const costPressure = Math.min(1, Number(row.costPerHourUsd ?? 0) / 50);
    const score = clamp01(anomalyScore * 0.6 + underUtilization * 0.25 + costPressure * 0.15);

    return {
      source: 'infra_cost_efficiency',
      sourceId: String(row.id),
      observedAt: now,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      category: 'cost_efficiency',
      summary: `Infra ${row.service} cost/hr=$${row.costPerHourUsd} util=${utilizationPct}% anomaly=${anomalyScore.toFixed(2)}`,
      details: row,
      score,
      trendVelocity: anomalyScore,
      confidence,
      freshness: 1,
      severity: score > 0.7 ? 'high' : score > 0.35 ? 'medium' : 'low',
      recommendedActions: [
        { type: 'optimize_cost', title: 'Review autoscaling + right-size instances for flagged services', owner: 'engineering', dueHours: 6 },
        { type: 'increase_reliability', title: 'Validate anomaly against deploy/event timeline', owner: 'ops', dueHours: 4 },
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
