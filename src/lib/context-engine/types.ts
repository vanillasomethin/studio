export type ContextSourceType = 'git_commit' | 'prod_log' | 'support_note' | 'admin_note';

export type CanonicalContextDocument = {
  sourceType: ContextSourceType;
  sourceId: string;
  timestamp: string;
  actors: string[];
  serviceArea: string;
  summary: string;
  rawRef: string;
  embedding: number[];
};

export type RawCollectorRecord = {
  id: string;
  sourceType: ContextSourceType;
  timestamp: Date;
  actor?: string | null;
  serviceArea?: string | null;
  summary: string;
  rawRef: string;
  payload?: Record<string, unknown>;
};
