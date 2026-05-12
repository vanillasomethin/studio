import { db } from '@/lib/db';
import type { RawCollectorRecord } from '@/lib/context-engine/types';

export async function collectGitCommits(since: Date): Promise<RawCollectorRecord[]> {
  const events = await db.telemetryEvent.findMany({
    where: { route: 'git.commit', createdAt: { gt: since } },
    orderBy: { createdAt: 'asc' },
  });

  return events.map((event) => ({
    id: event.id,
    sourceType: 'git_commit',
    timestamp: event.createdAt,
    actor: event.errorClass,
    serviceArea: 'engineering',
    summary: event.message,
    rawRef: `telemetry_event:${event.id}`,
  }));
}

export async function collectProdLogs(since: Date): Promise<RawCollectorRecord[]> {
  const events = await db.telemetryEvent.findMany({
    where: { level: { in: ['error', 'warn'] }, createdAt: { gt: since } },
    orderBy: { createdAt: 'asc' },
  });

  return events.map((event) => ({
    id: event.id,
    sourceType: 'prod_log',
    timestamp: event.createdAt,
    actor: event.errorClass,
    serviceArea: event.route,
    summary: event.message,
    rawRef: `telemetry_event:${event.id}`,
  }));
}

export async function collectSupportAdminNotes(since: Date): Promise<RawCollectorRecord[]> {
  const tickets = await db.remediationTicket.findMany({
    where: { createdAt: { gt: since } },
    orderBy: { createdAt: 'asc' },
    include: { device: { select: { id: true, groupName: true } } },
  });

  return tickets.flatMap((ticket) => [
    {
      id: `${ticket.id}:support`,
      sourceType: 'support_note' as const,
      timestamp: ticket.createdAt,
      actor: 'ops',
      serviceArea: ticket.device.groupName ?? 'device-ops',
      summary: `Support ticket ${ticket.id} opened for trigger ${ticket.triggerType}`,
      rawRef: `remediation_ticket:${ticket.id}`,
    },
    {
      id: `${ticket.id}:admin`,
      sourceType: 'admin_note' as const,
      timestamp: ticket.createdAt,
      actor: 'admin',
      serviceArea: ticket.device.groupName ?? 'device-ops',
      summary: `Admin note: ticket ${ticket.id} severity ${ticket.severity}`,
      rawRef: `remediation_ticket:${ticket.id}`,
    },
  ]);
}



export async function collectExternalSignals(since: Date): Promise<RawCollectorRecord[]> {
  const signals = await db.externalSignal.findMany({
    where: { observedAt: { gt: since } },
    orderBy: { observedAt: 'asc' },
  });

  return signals.map((signal) => ({
    id: signal.id,
    sourceType: 'external_signal',
    timestamp: signal.observedAt,
    actor: signal.source,
    serviceArea: signal.category,
    summary: signal.summary,
    rawRef: `external_signal:${signal.id}`,
    payload: { confidence: signal.confidence, freshness: signal.freshness, severity: signal.severity },
  }));
}

export async function collectAllContextSources(since: Date): Promise<RawCollectorRecord[]> {
  const [commits, logs, notes, externalSignals] = await Promise.all([
    collectGitCommits(since),
    collectProdLogs(since),
    collectSupportAdminNotes(since),
    collectExternalSignals(since),
  ]);

  return [...commits, ...logs, ...notes, ...externalSignals].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}
