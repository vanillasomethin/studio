'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, Download, Wifi, WifiOff, Activity, Users, Eye, ShieldAlert } from 'lucide-react';
import {
  searchStores,
  getFootfall,
  getFootfallAudit,
  getSensorHealth,
  getFootfallExportUrl,
  type StoreSearchResult,
  type FootfallResponse,
  type FootfallAuditResponse,
  type SensorHealthResponse,
} from '@/lib/backend-api';

function SectionLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="admin-section-label">
      <span className="admin-section-label__n">N°{String(n).padStart(2, '0')}</span>
      <span className="admin-section-label__rule" />
      <span className="admin-section-label__lbl">{label}</span>
    </div>
  );
}

const RANGE_OPTIONS = [
  { id: 'today',     label: 'Today',  days: 1 },
  { id: '7d',        label: '7d',     days: 7 },
  { id: '30d',       label: '30d',    days: 30 },
] as const;

function rangeToDates(rangeDays: number): { from: string; to: string } {
  const to   = new Date();
  const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatHourIST(iso: string, includeDay: boolean): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: true,
    ...(includeDay ? { day: '2-digit', month: 'short' } : {}),
  });
}

function HourlyBarChart({ hourly, includeDay }: { hourly: FootfallResponse['hourly']; includeDay: boolean }) {
  if (hourly.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">No footfall data for this range yet.</p>;
  }

  const maxVal = Math.max(1, ...hourly.map((h) => h.customerCount + h.unconfirmedCount));
  const barW   = Math.max(6, Math.min(28, Math.floor(640 / hourly.length)));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${hourly.length * barW} 160`}
        width={hourly.length * barW}
        height={160}
        className="block"
        preserveAspectRatio="none"
      >
        {hourly.map((h, i) => {
          const confirmedH   = Math.round((h.customerCount / maxVal) * 130);
          const unconfirmedH = Math.round((h.unconfirmedCount / maxVal) * 130);
          const x = i * barW;
          return (
            <g key={h.hourBucket}>
              <rect x={x + 2} y={130 - confirmedH} width={Math.max(2, barW - 6)} height={confirmedH} fill="#dc2626" rx={1} />
              <rect x={x + 2} y={130 - confirmedH - unconfirmedH} width={Math.max(2, barW - 6)} height={unconfirmedH} fill="#fca5a5" rx={1} />
            </g>
          );
        })}
        <line x1={0} y1={130} x2={hourly.length * barW} y2={130} stroke="var(--border)" strokeWidth={1} />
      </svg>
      <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-1">
        <span>{formatHourIST(hourly[0].hourBucket, includeDay)}</span>
        <span>{formatHourIST(hourly[hourly.length - 1].hourBucket, includeDay)}</span>
      </div>
    </div>
  );
}

export default function FootfallTab() {
  const [stores,    setStores]    = useState<StoreSearchResult[]>([]);
  const [storeId,   setStoreId]   = useState<string>('');
  const [range,     setRange]     = useState<(typeof RANGE_OPTIONS)[number]['id']>('7d');

  const [data,      setData]      = useState<FootfallResponse | null>(null);
  const [audit,     setAudit]     = useState<FootfallAuditResponse | null>(null);
  const [health,    setHealth]    = useState<SensorHealthResponse | null>(null);

  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Load store list once
  useEffect(() => {
    searchStores().then((r) => {
      setStores(r.stores);
      if (r.stores.length > 0) setStoreId(r.stores[0].id);
    }).catch((e: Error) => setError(e.message));
  }, []);

  const days = RANGE_OPTIONS.find((r) => r.id === range)?.days ?? 7;

  const load = useCallback(() => {
    if (!storeId) return;
    setLoading(true); setError(null);
    const { from, to } = rangeToDates(days);
    Promise.all([
      getFootfall(storeId, { from, to }),
      getFootfallAudit(storeId, { from, to }),
      getSensorHealth(storeId),
    ])
      .then(([f, a, h]) => { setData(f); setAudit(a); setHealth(h); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [storeId, days]);

  useEffect(() => { load(); }, [load]);

  const storeName = useMemo(() => stores.find((s) => s.id === storeId)?.storeName ?? '', [stores, storeId]);

  if (error) return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex gap-3">
      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-foreground">Could not load footfall data</p>
        <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
      </div>
    </div>
  );

  const totals = data?.totals ?? { customerCount: 0, unconfirmedCount: 0, excludedCount: 0 };

  return (
    <div className="space-y-4 admin-font-display">
      {/* Page head */}
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="admin-font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-primary mb-0.5">In-store presence</p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            <em className="not-italic text-primary">Footfall</em> & screen presence.
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            WiFi CSI footfall counts, ad-presence correlation, and sensor health — per store.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.storeName}{s.city ? ` — ${s.city}` : ''}</option>
            ))}
          </select>
          <div className="admin-chips">
            {RANGE_OPTIONS.map((r) => (
              <button key={r.id} className={`admin-chip${range === r.id ? ' admin-chip--active' : ''}`} onClick={() => setRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
          {storeId && (
            <a href={getFootfallExportUrl(storeId, rangeToDates(days))} className="admin-chip flex items-center gap-1">
              <Download className="h-3 w-3" /> CSV
            </a>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !storeId ? (
        <p className="text-sm text-muted-foreground text-center py-10">No stores found.</p>
      ) : (
        <>
          {/* KPI row */}
          <div className="admin-kpi-row">
            <div className="admin-kpi">
              <div className="admin-kpi__icon"><Users className="h-3.5 w-3.5" /></div>
              <div className="admin-kpi__label">Confirmed visits</div>
              <div className="admin-kpi__value">{totals.customerCount.toLocaleString('en-IN')}</div>
              <div className="admin-kpi__sub">{storeName}</div>
            </div>
            <div className="admin-kpi admin-kpi--feature">
              <div className="admin-kpi__icon"><Activity className="h-3.5 w-3.5" /></div>
              <div className="admin-kpi__label">Unconfirmed (CSI only)</div>
              <div className="admin-kpi__value">{totals.unconfirmedCount.toLocaleString('en-IN')}</div>
              <div className="admin-kpi__sub">No BLE corroboration</div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi__icon"><ShieldAlert className="h-3.5 w-3.5" /></div>
              <div className="admin-kpi__label">Staff-excluded</div>
              <div className="admin-kpi__value">{totals.excludedCount.toLocaleString('en-IN')}</div>
              <div className="admin-kpi__sub">Dwell / baseline / zone</div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi__icon"><Eye className="h-3.5 w-3.5" /></div>
              <div className="admin-kpi__label">Avg confidence</div>
              <div className="admin-kpi__value">
                {data?.hourly.length
                  ? `${Math.round(
                      (data.hourly.reduce((s, h) => s + (h.avgConfidence ?? 0), 0) / data.hourly.length) * 100,
                    )}%`
                  : '—'}
              </div>
              <div className="admin-kpi__sub">CSI signal quality</div>
            </div>
          </div>

          {/* Hourly chart */}
          <SectionLabel n={1} label="Hourly footfall" />
          <div className="card">
            <div className="card__head">
              <div>
                <p className="card__title">Confirmed vs unconfirmed</p>
                <p className="card__sub">Red = confirmed (CSI + BLE) · light = CSI-only, awaiting corroboration</p>
              </div>
            </div>
            <HourlyBarChart hourly={data?.hourly ?? []} includeDay={days > 1} />
          </div>

          {/* Screen presence per campaign */}
          <SectionLabel n={2} label="Screen presence correlation" />
          <div className="card">
            <div className="card__head">
              <div>
                <p className="card__title">Ad plays with confirmed presence</p>
                <p className="card__sub">% of ad plays at this store with a corroborated footfall event nearby</p>
              </div>
            </div>
            {!data?.presenceByCampaign.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">No screen-presence events recorded for this range.</p>
            ) : (
              <table className="tbl">
                <thead>
                  <tr><th>Campaign</th><th>Plays</th><th>Confirmed</th><th>Presence rate</th></tr>
                </thead>
                <tbody>
                  {data.presenceByCampaign.map((c) => (
                    <tr key={c.campaignId}>
                      <td>{c.campaignName}</td>
                      <td>{c.total}</td>
                      <td>{c.confirmed}</td>
                      <td>{c.presenceRate != null ? `${Math.round(c.presenceRate * 100)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Sensor health + audit */}
          <SectionLabel n={3} label="Sensor health & exclusions" />
          <div className="grid-2-1">
            <div className="card">
              <div className="card__head">
                <div>
                  <p className="card__title">Staff-exclusion audit</p>
                  <p className="card__sub">Footfall events filtered before counting — full audit trail, never silently dropped</p>
                </div>
              </div>
              {!audit?.breakdown.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">No exclusions in this range.</p>
              ) : (
                <div className="admin-chips" style={{ marginBottom: 12 }}>
                  {audit.breakdown.map((b) => (
                    <span key={b.reason} className="admin-chip">{b.reason} · {b.count}</span>
                  ))}
                </div>
              )}
              {!!audit?.events.length && (
                <table className="tbl">
                  <thead>
                    <tr><th>Time (IST)</th><th>Reason</th><th>Zone</th><th>Confidence</th></tr>
                  </thead>
                  <tbody>
                    {audit.events.slice(0, 10).map((e) => (
                      <tr key={e.id}>
                        <td className="font-mono text-xs">{new Date(e.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                        <td>{e.exclusionReason}</td>
                        <td>{e.zoneId ?? '—'}</td>
                        <td>{e.confidenceScore != null ? e.confidenceScore.toFixed(2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <div className="card__head">
                <div>
                  <p className="card__title">Sensor nodes</p>
                  <p className="card__sub">{health?.calibrationStatus ?? 'pending'} · {health?.firmwareVersion ?? 'unknown firmware'}</p>
                </div>
              </div>
              <div className="admin-feed">
                <div className="admin-feed-item">
                  {health?.ruview.status === 'online'
                    ? <span className="admin-live-dot admin-live-dot--online" />
                    : <span className="admin-live-dot admin-live-dot--offline" />}
                  <div className="admin-feed-item__info">
                    <div className="admin-feed-item__name">RuView (CSI)</div>
                    <div className="admin-feed-item__meta">
                      {health?.ruview.lastSeen
                        ? `Last seen ${new Date(health.ruview.lastSeen).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
                        : 'Never seen'}
                      {health?.ruview.uptime != null ? ` · ${health.ruview.uptime.toFixed(1)}% uptime` : ''}
                    </div>
                  </div>
                  {health?.ruview.status === 'online'
                    ? <Wifi className="h-3.5 w-3.5 text-green-500" />
                    : <WifiOff className="h-3.5 w-3.5 text-red-500" />}
                </div>
                <div className="admin-feed-item">
                  {health?.espresense.status === 'online'
                    ? <span className="admin-live-dot admin-live-dot--online" />
                    : <span className="admin-live-dot admin-live-dot--offline" />}
                  <div className="admin-feed-item__info">
                    <div className="admin-feed-item__name">ESPresense (BLE)</div>
                    <div className="admin-feed-item__meta">
                      {health?.espresense.lastSeen
                        ? `Last seen ${new Date(health.espresense.lastSeen).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
                        : 'Never seen'}
                      {health?.espresense.uptime != null ? ` · ${health.espresense.uptime.toFixed(1)}% uptime` : ''}
                    </div>
                  </div>
                  {health?.espresense.status === 'online'
                    ? <Wifi className="h-3.5 w-3.5 text-green-500" />
                    : <WifiOff className="h-3.5 w-3.5 text-red-500" />}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
