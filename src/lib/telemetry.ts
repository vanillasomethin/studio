import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export type ActorType = 'device' | 'admin' | 'user' | 'system' | 'anonymous';

type TelemetryBase = {
  route: string;
  correlationId: string;
  requestMeta?: Record<string, unknown>;
  actorType: ActorType;
  deviceId?: string;
};

type ErrorInput = TelemetryBase & {
  errorClass: string;
  message: string;
  stackHash?: string;
};

type EventInput = TelemetryBase & {
  message: string;
  level?: 'error' | 'warn' | 'info';
};

function streamPayload(payload: Record<string, unknown>) {
  const streamUrl = process.env.TELEMETRY_STREAM_URL;
  if (!streamUrl) return;

  void fetch(streamUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // best-effort only
  });
}

export function hashStack(stack?: string | null) {
  if (!stack) return undefined;
  return crypto.createHash('sha256').update(stack).digest('hex');
}

export function getOrCreateCorrelationId(headerValue?: string | null) {
  return headerValue?.trim() || crypto.randomUUID();
}

export async function recordEvent(input: EventInput) {
  const row = await db.telemetryEvent.create({
    data: {
      route: input.route,
      level: input.level ?? 'info',
      message: input.message,
      correlationId: input.correlationId,
      actorType: input.actorType,
      requestMeta: input.requestMeta as Prisma.InputJsonValue | undefined,
      deviceId: input.deviceId,
    },
  });

  streamPayload({ type: 'event', ...input, id: row.id });
  return row;
}

export async function recordError(input: ErrorInput) {
  const row = await db.telemetryEvent.create({
    data: {
      route: input.route,
      level: 'error',
      errorClass: input.errorClass,
      message: input.message,
      stackHash: input.stackHash,
      correlationId: input.correlationId,
      actorType: input.actorType,
      requestMeta: input.requestMeta as Prisma.InputJsonValue | undefined,
      deviceId: input.deviceId,
    },
  });

  streamPayload({ type: 'error', ...input, id: row.id });
  return row;
}
