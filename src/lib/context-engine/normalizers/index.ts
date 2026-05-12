import type { CanonicalContextDocument, RawCollectorRecord } from '@/lib/context-engine/types';

export function normalizeContextRecord(
  record: RawCollectorRecord,
  embedding: number[],
): CanonicalContextDocument {
  return {
    sourceType: record.sourceType,
    sourceId: record.id,
    timestamp: record.timestamp.toISOString(),
    actors: record.actor ? [record.actor] : [],
    serviceArea: record.serviceArea ?? 'unknown',
    summary: record.summary,
    rawRef: record.rawRef,
    embedding,
  };
}
