'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertTriangle, CheckCircle2, Store, BarChart3, Tv2,
  RefreshCw, X, ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertSeverity = 'critical' | 'warning' | 'info';

type Alert = {
  id: string;
  severity: AlertSeverity;
  category: 'device' | 'store' | 'campaign' | 'system';
  title: string;
  body: string;
  timestamp: string;
  link?: { label: string; tab: string };
  dismissed?: boolean;
};

type DeviceRow = {
  id: string; storeName: string; status: string; lastSeen?: string; locality?: string;
};
type StoreRow = {
  id: string; storeName: string; ownerName: string; createdAt: string;
  onboardingStage?: string; city?: string;
};
type CampaignRow = {
  id: string; brandName: string; totalAmount: number; status: string;
  paymentId?: string; createdAt: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DISMISSED_KEY = 'alive_admin_dismissed_alerts';

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch { return new Set(); }
}
function saveDismissed(ids: Set<string>) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}

function timeSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtAmount(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

const SEV_CONFIG: Record<AlertSeverity, { label: string; dot: string; badge: string; border: string; icon: React.ElementType }> = {
  critical: {
    label: 'Critical', dot: 'bg-red-500', icon: AlertTriangle,
    badge: 'bg-red-50 text-red-700 border border-red-200',
    border: 'border-l-red-500',
  },
  warning: {
    label: 'Warning', dot: 'bg-amber-500', icon: AlertTriangle,
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    border: 'border-l-amber-500',
  },
  info: {
    label: 'Info', dot: 'bg-blue-500', icon: CheckCircle2,
    badge: 'bg-blue-50 text-blue-700 border border-blue-200',
    border: 'border-l-blue-400',
  },
};

const CAT_ICON: Record<Alert['category'], React.ElementType> = {
  device: Tv2, store: Store, campaign: BarChart3, system: CheckCircle2,
};

// ─── Generate alerts from raw data ───────────────────────────────────────────

function buildAlerts(
  devices: DeviceRow[],
  stores: StoreRow[],
  campaigns: CampaignRow[],
  dismissed: Set<string>,
): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();

  // Offline devices — critical if >1h, warning if >10min
  for (const d of devices) {
    if (d.status !== 'OFFLINE') continue;
    const lastMs = d.lastSeen ? now - new Date(d.lastSeen).getTime() : Infinity;
    const severity: AlertSeverity = lastMs > 60 * 60 * 1000 ? 'critical' : 'warning';
    const offStr = d.lastSeen ? timeSince(d.lastSeen) : 'unknown';
    const id = `device-offline-${d.id}`;
    alerts.push({
      id, severity, category: 'device',
      title: `${d.storeName} is offline`,
      body: `Last seen ${offStr}${d.locality ? ` · ${d.locality}` : ''}. Check power and internet connection at the store.`,
      timestamp: d.lastSeen ?? new Date().toISOString(),
      link: { label: 'View screens', tab: 'screens' },
      dismissed: dismissed.has(id),
    });
  }

  // Pending devices awaiting setup
  const pending = devices.filter((d) => d.status === 'PENDING');
  if (pending.length > 0) {
    const id = 'devices-pending';
    alerts.push({
      id, severity: 'info', category: 'device',
      title: `${pending.length} screen${pending.length > 1 ? 's' : ''} awaiting setup`,
      body: pending.map((d) => d.storeName).join(', ') + ' — claim and assign to a store.',
      timestamp: new Date().toISOString(),
      link: { label: 'View screens', tab: 'screens' },
      dismissed: dismissed.has(id),
    });
  }

  // New store registrations in last 48h
  const recentCutoff = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const newStores = stores.filter((s) => s.createdAt > recentCutoff && (!s.onboardingStage || s.onboardingStage === 'new'));
  if (newStores.length > 0) {
    const id = `stores-new-${newStores.map((s) => s.id).join('-')}`;
    alerts.push({
      id, severity: 'info', category: 'store',
      title: `${newStores.length} new store registration${newStores.length > 1 ? 's' : ''}`,
      body: newStores.map((s) => `${s.storeName} (${s.city ?? 'unknown'})`).join(', '),
      timestamp: newStores[0].createdAt,
      link: { label: 'View stores', tab: 'stores' },
      dismissed: dismissed.has(id),
    });
  }

  // Pending payment campaigns
  const pendingCampaigns = campaigns.filter(
    (c) => c.paymentId === 'pending' || c.status === 'upcoming',
  );
  if (pendingCampaigns.length > 0) {
    const id = 'campaigns-pending-payment';
    const total = pendingCampaigns.reduce((s, c) => s + c.totalAmount, 0);
    alerts.push({
      id, severity: 'warning', category: 'campaign',
      title: `${pendingCampaigns.length} campaign${pendingCampaigns.length > 1 ? 's' : ''} pending payment`,
      body: `${fmtAmount(total)} awaiting confirmation — ${pendingCampaigns.map((c) => c.brandName).join(', ')}`,
      timestamp: pendingCampaigns[0].createdAt,
      link: { label: 'View campaigns', tab: 'campaigns' },
      dismissed: dismissed.has(id),
    });
  }

  // Active campaigns (info)
  const active = campaigns.filter((c) => c.status === 'active' && c.paymentId && c.paymentId !== 'pending');
  if (active.length > 0) {
    const id = 'campaigns-active';
    alerts.push({
      id, severity: 'info', category: 'campaign',
      title: `${active.length} campaign${active.length > 1 ? 's' : ''} running`,
      body: active.map((c) => c.brandName).join(', ') + ` · ${fmtAmount(active.reduce((s, c) => s + c.totalAmount, 0))} total`,
      timestamp: new Date().toISOString(),
      dismissed: dismissed.has(id),
    });
  }

  // Sort: critical → warning → info, then by timestamp desc within each tier
  const tierOrder: AlertSeverity[] = ['critical', 'warning', 'info'];
  return alerts.sort((a, b) => {
    const td = tierOrder.indexOf(a.severity) - tierOrder.indexOf(b.severity);
    if (td !== 0) return td;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertsTab({ onNav }: { onNav?: (tab: string) => void }) {
  const [alerts,    setAlerts]    = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<'all' | 'active' | AlertSeverity>('active');
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const pw = sessionStorage.getItem('alive_admin_pw') ?? '';
    const h = { 'admin-password': pw };
    try {
      const [devR, stR, cmR] = await Promise.all([
        fetch('/api/devices',         { headers: h }).then((r) => r.ok ? r.json() : { devices: [] }),
        fetch('/api/stores/save',     { headers: h }).then((r) => r.ok ? r.json() : []),
        fetch('/api/campaigns/admin', { headers: h }).then((r) => r.ok ? r.json() : []),
      ]);
      const devs = (devR.devices ?? []) as DeviceRow[];
      const sts  = Array.isArray(stR) ? stR : (stR?.data ?? []) as StoreRow[];
      const cms  = Array.isArray(cmR) ? cmR : [] as CampaignRow[];
      const dis  = loadDismissed();
      setDismissed(dis);
      setAlerts(buildAlerts(devs, sts, cms, dis));
      setLastFetch(new Date());
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    saveDismissed(next);
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, dismissed: true } : a));
  };

  const clearAll = () => {
    const ids = new Set(alerts.map((a) => a.id));
    saveDismissed(ids);
    setDismissed(ids);
    setAlerts((prev) => prev.map((a) => ({ ...a, dismissed: true })));
  };

  const filtered = alerts.filter((a) => {
    if (filter === 'active')   return !a.dismissed;
    if (filter === 'all')      return true;
    return a.severity === filter && !a.dismissed;
  });

  const activeCount    = alerts.filter((a) => !a.dismissed).length;
  const criticalCount  = alerts.filter((a) => a.severity === 'critical' && !a.dismissed).length;
  const warningCount   = alerts.filter((a) => a.severity === 'warning'  && !a.dismissed).length;

  const FILTERS = [
    { value: 'active'   as const, label: `Active (${activeCount})` },
    { value: 'critical' as const, label: `Critical (${criticalCount})` },
    { value: 'warning'  as const, label: `Warnings (${warningCount})` },
    { value: 'all'      as const, label: 'All' },
  ];

  return (
    <div className="space-y-5">
      {/* Page head */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="admin-font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-primary mb-0.5">ALIVE Admin</p>
          <h1 className="admin-font-display text-2xl font-bold text-foreground tracking-tight">
            Alerts &amp; Notifications
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 admin-font-mono">
            {lastFetch ? `Updated ${timeSince(lastFetch.toISOString())}` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeCount > 0 && (
            <button onClick={clearAll}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/60 transition-colors">
              <X className="h-3 w-3" /> Dismiss all
            </button>
          )}
          <button onClick={() => fetchAlerts()} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="admin-summary-row">
        <div className="admin-summary-tile">
          <div className="admin-summary-tile__label">Active alerts</div>
          <div className="admin-summary-tile__value">{activeCount}</div>
          <div className="admin-summary-tile__delta" style={{ color: activeCount > 0 ? '#dc2626' : '#16a34a' }}>
            {activeCount === 0 ? 'All clear' : 'Needs attention'}
          </div>
        </div>
        <div className="admin-summary-tile">
          <div className="admin-summary-tile__label">Critical</div>
          <div className="admin-summary-tile__value" style={{ color: criticalCount > 0 ? '#dc2626' : undefined }}>{criticalCount}</div>
          <div className="admin-summary-tile__delta">Device offline &gt;1h</div>
        </div>
        <div className="admin-summary-tile">
          <div className="admin-summary-tile__label">Warnings</div>
          <div className="admin-summary-tile__value" style={{ color: warningCount > 0 ? '#b45309' : undefined }}>{warningCount}</div>
          <div className="admin-summary-tile__delta">Pending payments/offline</div>
        </div>
        <div className="admin-summary-tile">
          <div className="admin-summary-tile__label">Total tracked</div>
          <div className="admin-summary-tile__value">{alerts.length}</div>
          <div className="admin-summary-tile__delta">incl. dismissed</div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="admin-chips">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`admin-chip${filter === f.value ? ' admin-chip--active' : ''}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-500/40" />
          <p className="text-sm font-semibold text-foreground">All clear</p>
          <p className="text-xs text-muted-foreground">No {filter === 'all' ? '' : 'active '}alerts right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const sev  = SEV_CONFIG[a.severity];
            const Icon = sev.icon;
            const Cat  = CAT_ICON[a.category];
            return (
              <div key={a.id}
                className={`relative rounded-xl border border-border bg-card p-4 border-l-4 ${sev.border} ${a.dismissed ? 'opacity-40' : ''} transition-opacity`}
              >
                <div className="flex items-start gap-3">
                  {/* Category icon */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
                    <Cat className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`admin-badge ${sev.badge}`}>{sev.label}</span>
                      <span className="admin-font-mono text-[10px] text-muted-foreground">{timeSince(a.timestamp)}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.body}</p>
                    {a.link && onNav && (
                      <button onClick={() => onNav(a.link!.tab)}
                        className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        {a.link.label} <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Dismiss */}
                  {!a.dismissed && (
                    <button onClick={() => dismiss(a.id)}
                      className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <p className="text-[10px] text-muted-foreground/50 admin-font-mono text-center pt-2">
        Alerts auto-generate from device status, store registrations, and campaign data. Dismissed alerts persist in browser storage.
      </p>
    </div>
  );
}
