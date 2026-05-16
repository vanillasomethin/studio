import crypto from 'crypto';
import { db } from '@/lib/db';

type Primitive = string | number | boolean | null;
type JsonLike = Primitive | JsonLike[] | { [key: string]: JsonLike };

export type LearningOutcome = 'success' | 'invalid_request' | 'unauthorized' | 'conflict' | 'server_error';

export type LearningArtifactInput = {
  route: string;
  request: unknown;
  responseMeta?: unknown;
  latencyMs: number;
  outcome: LearningOutcome;
  policyFlags?: string[];
  errorCategory?: string | null;
};

export type LearningArtifact = {
  id: string;
  route: string;
  createdAt: string;
  latencyMs: number;
  outcome: LearningOutcome;
  errorCategory: string | null;
  policyFlags: string[];
  inputSummary: JsonLike;
  outputSummary: JsonLike;
};

function summarize(value: unknown, depth = 0): JsonLike {
  if (value == null) return null;
  if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth > 2) return `[array:${value.length}]`;
    return value.slice(0, 10).map((item) => summarize(item, depth + 1));
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort().slice(0, 30);
    const result: Record<string, JsonLike> = {};
    for (const key of keys) {
      if (/password|token|secret|authorization|cookie/i.test(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = depth > 2 ? '[object]' : summarize(obj[key], depth + 1);
      }
    }
    return result;
  }
  return String(value);
}

export function buildLearningArtifact({ route, request, responseMeta, latencyMs, outcome, policyFlags = [], errorCategory = null }: LearningArtifactInput): LearningArtifact {
  const summary = {
    route,
    inputSummary: summarize(request),
    outputSummary: summarize(responseMeta),
    latencyMs: Math.max(0, Math.round(latencyMs)),
    outcome,
    policyFlags,
    errorCategory,
  };

  const id = crypto.createHash('sha256').update(JSON.stringify(summary)).digest('hex').slice(0, 24);

  return {
    id,
    route,
    createdAt: new Date().toISOString(),
    latencyMs: summary.latencyMs,
    outcome,
    errorCategory,
    policyFlags,
    inputSummary: summary.inputSummary,
    outputSummary: summary.outputSummary,
  };
}

export async function emitLearningArtifact(artifact: LearningArtifact): Promise<string> {
  await db.telemetryEvent.create({
    data: {
      route: artifact.route,
      level: 'learning_artifact',
      message: JSON.stringify({
        learningArtifactId: artifact.id,
        outcome: artifact.outcome,
        latencyMs: artifact.latencyMs,
        errorCategory: artifact.errorCategory,
        policyFlags: artifact.policyFlags,
        inputSummary: artifact.inputSummary,
        outputSummary: artifact.outputSummary,
      }),
      correlationId: artifact.id,
      actorType: 'system',
      requestMeta: {
        type: 'vector_ingestion_queue',
        artifactRef: artifact.id,
        createdAt: artifact.createdAt,
      },
    },
  });

  return artifact.id;
}
