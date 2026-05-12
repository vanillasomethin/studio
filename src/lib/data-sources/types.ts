export type ExternalSignalSource = 'market_sentiment' | 'competitor_activity' | 'infra_cost_efficiency';

export type ExternalSignalSeverity = 'low' | 'medium' | 'high';

export type RecommendedAction = {
  type: 'monitor' | 'optimize_cost' | 'respond_competitor' | 'adjust_roadmap' | 'increase_reliability';
  title: string;
  owner: 'ops' | 'product' | 'engineering' | 'growth';
  dueHours: number;
};

export type NormalizedExternalSignal = {
  source: ExternalSignalSource;
  sourceId: string;
  observedAt: Date;
  expiresAt: Date;
  category: string;
  summary: string;
  details: Record<string, unknown>;
  score: number;
  trendVelocity: number;
  confidence: number;
  freshness: number;
  severity: ExternalSignalSeverity;
  recommendedActions: RecommendedAction[];
};
