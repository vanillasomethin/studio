interface EluAnalytics {
  identify(userId: string, traits?: Record<string, unknown>): void;
  reset(): void;
}

interface Window {
  elu?: EluAnalytics;
}
