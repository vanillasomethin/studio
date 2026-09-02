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

/**
 * Persist one telemetry row. NEVER rejects.
 *
 * Telemetry must not be able to break the thing it is observing, and both ways
 * this is called made that possible.
 *
 * The `void recordError(...)` call sites (with-api-handler, the device-health
 * cron) had no catch, so a failing insert became an unhandled rejection — and
 * the insert fails for the most ordinary reasons, since the row carries a
 * caller-supplied message and requestMeta: a message past the column width, a
 * requestMeta that is not valid JSON, a pool exhausted by whatever was already
 * going wrong.
 *
 * The `await recordError(...)` sites are worse, and every one of them sits
 * inside a catch. A throw there discards the error being reported AND replaces
 * the 500 envelope the route meant to return, so a telemetry outage turns a
 * diagnosable failure into a different, unexplained one — precisely when the
 * logs matter most.
 *
 * On failure the row is dropped, but the stream sink is still attempted: it is
 * a separate destination and is often the one still working when the database
 * is not. console.error is the last resort — the platform log is the only sink
 * left once both have failed.
 */
async function persist(
  data: Prisma.TelemetryEventUncheckedCreateInput,
): Promise<{ id: string } | null> {
  try {
    return await db.telemetryEvent.create({ data });
  } catch (e) {
    console.error(
      '[telemetry] could not persist:',
      (e as Error)?.message?.slice(0, 300) ?? e,
    );
    return null;
  }
}

export async function recordEvent(input: EventInput) {
  const row = await persist({
    route: input.route,
    level: input.level ?? 'info',
    message: input.message,
    correlationId: input.correlationId,
    actorType: input.actorType,
    requestMeta: input.requestMeta as Prisma.InputJsonValue | undefined,
    deviceId: input.deviceId,
  });

  streamPayload({ type: 'event', ...input, id: row?.id });
  return row;
}

export async function recordError(input: ErrorInput) {
  const row = await persist({
    route: input.route,
    level: 'error',
    errorClass: input.errorClass,
    message: input.message,
    stackHash: input.stackHash,
    correlationId: input.correlationId,
    actorType: input.actorType,
    requestMeta: input.requestMeta as Prisma.InputJsonValue | undefined,
    deviceId: input.deviceId,
  });

  streamPayload({ type: 'error', ...input, id: row?.id });
  return row;
}
