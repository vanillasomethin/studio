import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export const QUERY_SCHEMA = {
  version: '1.0',
  domains: {
    engineering: {
      description: 'Device fleet health and play-event reliability.',
      metrics: ['device_count', 'online_devices', 'offline_devices', 'pending_devices', 'play_events', 'play_duration_ms'],
      groupBy: ['status', 'storeId', 'campaignId', 'deviceId', 'day'],
      filters: ['status', 'storeId', 'campaignId', 'deviceId'],
      timeField: 'startedAt/updatedAt',
    },
    sales: {
      description: 'Campaign and payment verification outcomes.',
      metrics: ['campaign_count', 'active_campaigns', 'payment_verified', 'payment_unverified', 'sales_value_total'],
      groupBy: ['status', 'brandId', 'email', 'day'],
      filters: ['status', 'brandId', 'email', 'paymentVerified'],
      timeField: 'createdAt/startDate',
    },
    user_behavior: {
      description: 'Bills, claim conversion, and store-level activity.',
      metrics: ['bill_count', 'paid_bills', 'open_bills', 'claim_converted', 'claim_unconverted', 'bill_total_amount'],
      groupBy: ['storeId', 'status', 'payMethod', 'day'],
      filters: ['storeId', 'status', 'payMethod', 'claimed'],
      timeField: 'createdAt',
    },
    finance_ops: {
      description: 'Store payouts and revenue proxies.',
      metrics: ['stores_ready_for_payout', 'stores_paid', 'stores_on_hold', 'campaign_revenue_proxy', 'bill_revenue_proxy', 'high_risk_external_signals', 'avg_external_confidence'],
      groupBy: ['payoutStatus', 'city', 'day', 'severity'],
      filters: ['payoutStatus', 'city', 'source', 'severity'],
      timeField: 'createdAt/payoutLastPaidAt',
    },
  },
} as const;

type Domain = keyof typeof QUERY_SCHEMA.domains;
type QueryDsl = {
  domain: Domain;
  metrics?: string[];
  filters?: Record<string, string | number | boolean | null>;
  groupBy?: string[];
  timeRange?: { from?: string; to?: string };
  limit?: number;
};

const LIMIT_MAX = 500;

function asDate(v?: string) {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function groupRows<T extends Record<string, unknown>>(rows: T[], groupBy: string[]) {
  if (!groupBy.length) return [{ group: {}, rows }];
  const buckets = new Map<string, { group: Record<string, unknown>; rows: T[] }>();
  for (const row of rows) {
    const group: Record<string, unknown> = {};
    for (const key of groupBy) group[key] = row[key];
    const bucketKey = JSON.stringify(group);
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, { group, rows: [] });
    buckets.get(bucketKey)!.rows.push(row);
  }
  return Array.from(buckets.values());
}

export async function runQueryDsl(input: QueryDsl) {
  const spec = QUERY_SCHEMA.domains[input.domain];
  if (!spec) throw new Error(`Unsupported domain: ${input.domain}`);

  const metrics = (input.metrics?.length ? input.metrics : spec.metrics).filter((m) => spec.metrics.includes(m as never));
  const groupBy = (input.groupBy ?? []).filter((g) => spec.groupBy.includes(g as never));
  const filters = input.filters ?? {};
  const from = asDate(input.timeRange?.from);
  const to = asDate(input.timeRange?.to);
  const limit = Math.max(1, Math.min(input.limit ?? 100, LIMIT_MAX));

  switch (input.domain) {
    case 'engineering': {
      const deviceWhere: Prisma.DeviceWhereInput = {
        ...(typeof filters.status === 'string' ? { status: filters.status as any } : {}),
        ...(typeof filters.storeId === 'string' ? { storeId: filters.storeId } : {}),
      };
      const playWhere: Prisma.PlayEventWhereInput = {
        ...(typeof filters.campaignId === 'string' ? { campaignId: filters.campaignId } : {}),
        ...(typeof filters.deviceId === 'string' ? { deviceId: filters.deviceId } : {}),
        ...(from || to ? { startedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      };

      const [devices, plays] = await Promise.all([
        db.device.findMany({ where: deviceWhere, select: { id: true, status: true, storeId: true, updatedAt: true } }),
        db.playEvent.findMany({ where: playWhere, select: { id: true, deviceId: true, campaignId: true, durationMs: true, startedAt: true } }),
      ]);

      const playRows = plays.map((p) => ({ ...p, day: dayKey(p.startedAt) }));
      const grouped = groupRows(playRows as any[], groupBy);
      const totals = {
        device_count: devices.length,
        online_devices: devices.filter((d) => d.status === 'ONLINE').length,
        offline_devices: devices.filter((d) => d.status === 'OFFLINE').length,
        pending_devices: devices.filter((d) => d.status === 'PENDING').length,
        play_events: plays.length,
        play_duration_ms: plays.reduce((acc, p) => acc + p.durationMs, 0),
      };
      return { domain: input.domain, metrics, totals, groups: grouped.slice(0, limit).map((g) => ({ group: g.group, play_events: g.rows.length, play_duration_ms: g.rows.reduce((a, r: any) => a + r.durationMs, 0) })) };
    }
    case 'sales': {
      const where: Prisma.CampaignWhereInput = {
        ...(typeof filters.status === 'string' ? { status: filters.status } : {}),
        ...(typeof filters.brandId === 'string' ? { brandId: filters.brandId } : {}),
        ...(typeof filters.email === 'string' ? { email: filters.email } : {}),
        ...(typeof filters.paymentVerified === 'boolean'
          ? (filters.paymentVerified ? { paymentId: { not: null } } : { paymentId: null })
          : {}),
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      };
      const campaigns = await db.campaign.findMany({ where, select: { id: true, status: true, brandId: true, email: true, paymentId: true, totalAmount: true, createdAt: true } });
      const rows = campaigns.map((c) => ({ ...c, paymentVerified: !!c.paymentId, day: dayKey(c.createdAt) }));
      const grouped = groupRows(rows as any[], groupBy);
      return {
        domain: input.domain,
        metrics,
        totals: {
          campaign_count: campaigns.length,
          active_campaigns: campaigns.filter((c) => c.status === 'active').length,
          payment_verified: campaigns.filter((c) => !!c.paymentId).length,
          payment_unverified: campaigns.filter((c) => !c.paymentId).length,
          sales_value_total: campaigns.reduce((a, c) => a + c.totalAmount, 0),
        },
        groups: grouped.slice(0, limit).map((g) => ({ group: g.group, campaign_count: g.rows.length, sales_value_total: g.rows.reduce((a, r: any) => a + r.totalAmount, 0) })),
      };
    }
    case 'user_behavior': {
      const where: Prisma.BillWhereInput = {
        ...(typeof filters.storeId === 'string' ? { storeId: filters.storeId } : {}),
        ...(typeof filters.status === 'string' ? { status: filters.status } : {}),
        ...(typeof filters.payMethod === 'string' ? { payMethod: filters.payMethod } : {}),
        ...(typeof filters.claimed === 'boolean' ? (filters.claimed ? { customerId: { not: null } } : { customerId: null }) : {}),
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      };
      const bills = await db.bill.findMany({ where, select: { id: true, storeId: true, status: true, payMethod: true, totalAmount: true, customerId: true, createdAt: true } });
      const rows = bills.map((b) => ({ ...b, claimed: !!b.customerId, day: dayKey(b.createdAt) }));
      const grouped = groupRows(rows as any[], groupBy);
      return { domain: input.domain, metrics, totals: {
        bill_count: bills.length,
        paid_bills: bills.filter((b) => b.status === 'paid').length,
        open_bills: bills.filter((b) => b.status === 'open').length,
        claim_converted: bills.filter((b) => !!b.customerId).length,
        claim_unconverted: bills.filter((b) => !b.customerId).length,
        bill_total_amount: bills.reduce((a, b) => a + b.totalAmount, 0),
      }, groups: grouped.slice(0, limit).map((g) => ({ group: g.group, bill_count: g.rows.length, bill_total_amount: g.rows.reduce((a, r: any) => a + r.totalAmount, 0) })) };
    }
    case 'finance_ops': {
      const storeWhere: Prisma.StoreWhereInput = {
        ...(typeof filters.payoutStatus === 'string' ? { payoutStatus: filters.payoutStatus } : {}),
        ...(typeof filters.city === 'string' ? { city: filters.city } : {}),
      };
      const signalWhere: Prisma.ExternalSignalWhereInput = {
        ...(typeof filters.source === 'string' ? { source: filters.source as any } : {}),
        ...(typeof filters.severity === 'string' ? { severity: filters.severity } : {}),
        ...(from || to ? { observedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      };
      const [stores, campaigns, bills, signals] = await Promise.all([
        db.store.findMany({ where: storeWhere, select: { id: true, city: true, payoutStatus: true, createdAt: true } }),
        db.campaign.findMany({ where: (from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}, select: { totalAmount: true } }),
        db.bill.findMany({ where: (from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}, select: { totalAmount: true } }),
        db.externalSignal.findMany({ where: signalWhere, select: { source: true, severity: true, confidence: true, observedAt: true } }),
      ]);
      const rows = stores.map((s) => ({ ...s, day: dayKey(s.createdAt) }));
      const signalRows = signals.map((x) => ({ ...x, day: dayKey(x.observedAt) }));
      const grouped = groupRows((groupBy.includes('severity') ? signalRows : rows) as any[], groupBy);
      return { domain: input.domain, metrics, totals: {
        stores_ready_for_payout: stores.filter((s) => s.payoutStatus === 'ready').length,
        stores_paid: stores.filter((s) => s.payoutStatus === 'paid').length,
        stores_on_hold: stores.filter((s) => s.payoutStatus === 'on_hold').length,
        campaign_revenue_proxy: campaigns.reduce((a, c) => a + c.totalAmount, 0),
        bill_revenue_proxy: bills.reduce((a, b) => a + b.totalAmount, 0),
        high_risk_external_signals: signals.filter((x) => x.severity === 'high').length,
        avg_external_confidence: signals.length ? signals.reduce((a, x) => a + x.confidence, 0) / signals.length : 0,
      }, groups: grouped.slice(0, limit).map((g) => ({ group: g.group, count: g.rows.length })) };
    }
  }
}
