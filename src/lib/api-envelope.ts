import { buildLearningArtifact, emitLearningArtifact, LearningOutcome } from '@/lib/learning-artifacts';

type RespondInput = {
  route: string;
  request: unknown;
  outcome: LearningOutcome;
  policyFlags?: string[];
  errorCategory?: string | null;
  startedAtMs?: number;
};

export async function respond<T>(data: T, { route, request, outcome, policyFlags = [], errorCategory = null, startedAtMs = Date.now() }: RespondInput) {
  const meta = {
    route,
    outcome,
    timestamp: new Date().toISOString(),
  };

  const artifact = buildLearningArtifact({
    route,
    request,
    responseMeta: { meta, data },
    latencyMs: Date.now() - startedAtMs,
    outcome,
    policyFlags,
    errorCategory,
  });

  const learningArtifactRef = await emitLearningArtifact(artifact);

  return { data, meta, learningArtifactRef };
}
