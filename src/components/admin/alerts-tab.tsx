'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, AlertTriangle, CheckCircle2, Store, BarChart3, Tv2,
  RefreshCw, X, ChevronRight, MessageSquare, UserCircle2, Check, RotateCcw, Send,
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
// Real DeviceAlert rows from /api/admin/alerts — joined onto the synthesized
// offline cards below so the shopkeeper's answer and the telemetry verdict
// have a persistent surface (the watcher's toast lasts 12 seconds; this page
// is where an admin looks afterwards).
type DeviceAlertRow = {
  id: string; deviceId: string; status: 'OPEN' | 'RESOLVED';
  startedAt: string;
  cause: string | null;
  partnerReportedCause: string | null;
  partnerReportedAt: string | null;
};

/** The shopkeeper's answer, worded as testimony — it is what they told us, not telemetry. */
function partnerSaysText(cause: string | null): string | null {
  switch (cause) {
    case 'POWER_CUT':   return 'power cut at the store';
    case 'NO_INTERNET': return 'no internet at the store';
    case 'TV_OFF':      return 'the TV was switched off';
    case 'APP_CLOSED':  return 'the player app was closed';
    case 'DONT_KNOW':   return 'doesn’t know why it stopped';
    default:            return null;
  }
}

// Durable, team-visible action state layered on top of a computed alert — see
// /api/admin/alert-actions. Distinct from `dismissed`, a personal, local-only hide.
type AlertTeam = 'tech' | 'operations' | 'marketing';
type AlertActionState = {
  alertId: string;
  team: AlertTeam | null;
  assignee: string | null;
  status: 'open' | 'closed';
  closedAt: string | null;
  closedBy: string | null;
  commentCount: number;
};
type AlertCommentRow = { id: string; author: string | null; body: string; createdAt: string };

const TEAM_CONFIG: Record<AlertTeam, { label: string; badge: string }> = {
  tech:       { label: 'Tech Team',  badge: 'bg-violet-50 text-violet-700 border border-violet-200' },
  operations: { label: 'Operations', badge: 'bg-cyan-50 text-cyan-700 border border-cyan-200' },
  marketing:  { label: 'Marketing',  badge: 'bg-pink-50 text-pink-700 border border-pink-200' },
};
const ACTOR_NAME_KEY = 'alive_admin_actor_name';

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
  deviceAlerts: DeviceAlertRow[],
  dismissed: Set<string>,
): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();

  // Newest OPEN DeviceAlert per device, so the offline cards can carry what is
  // actually known about the outage rather than a generic "go check".
  const openByDevice = new Map<string, DeviceAlertRow>();
  for (const a of deviceAlerts) {
    if (a.status !== 'OPEN') continue;
    const cur = openByDevice.get(a.deviceId);
    if (!cur || a.startedAt > cur.startedAt) openByDevice.set(a.deviceId, a);
  }

  // Offline devices — critical if >1h, warning if >10min
  for (const d of devices) {
    if (d.status !== 'OFFLINE') continue;
    const lastMs = d.lastSeen ? now - new Date(d.lastSeen).getTime() : Infinity;
    const severity: AlertSeverity = lastMs > 60 * 60 * 1000 ? 'critical' : 'warning';
    const offStr = d.lastSeen ? timeSince(d.lastSeen) : 'unknown';
    const id = `device-offline-${d.id}`;
    // Lead with the shopkeeper's answer when there is one — it usually decides
    // the next move (wait out the power cut / call the ISP / drive out), and
    // "check power and internet" is redundant once a human has answered.
    const row  = openByDevice.get(d.id);
    const says = partnerSaysText(row?.partnerReportedCause ?? null);
    const tail = says
      ? `Partner says: ${says}${row?.partnerReportedAt ? ` (answered ${timeSince(row.partnerReportedAt)})` : ''}.`
      : 'Check power and internet connection at the store.';
    alerts.push({
      id, severity, category: 'device',
      title: `${d.storeName} is offline`,
      body: `Last seen ${offStr}${d.locality ? ` · ${d.locality}` : ''}. ${tail}`,
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

// ─── Alert Actions (assign / comment / close) ─────────────────────────────────

function getActorName(): string {
  try { return localStorage.getItem(ACTOR_NAME_KEY) ?? ''; } catch { return ''; }
}
function saveActorName(name: string) {
  try { localStorage.setItem(ACTOR_NAME_KEY, name); } catch { /* ignore */ }
}

function AlertActionsPanel({
  alertId, action, onChange,
}: {
  alertId: string;
  action?: AlertActionState;
  onChange: () => void;
}) {
  const [open, setOpen] = useState<'assign' | 'comments' | null>(null);
  const [team, setTeam] = useState<AlertTeam | ''>(action?.team ?? '');
  const [assignee, setAssignee] = useState(action?.assignee ?? '');
  const [saving, setSaving] = useState(false);

  const [comments, setComments] = useState<AlertCommentRow[] | null>(null);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [actorName, setActorName] = useState(getActorName());

  const pw = () => sessionStorage.getItem('alive_admin_pw') ?? '';

  async function postAction(body: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch('/api/admin/alert-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'admin-password': pw() },
        body: JSON.stringify({ alertId, ...body }),
      });
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function loadComments() {
    setComments(null);
    const res = await fetch(`/api/admin/alerts/comments?alertId=${encodeURIComponent(alertId)}`, {
      headers: { 'admin-password': pw() },
    });
    const data = res.ok ? await res.json() as { comments: AlertCommentRow[] } : { comments: [] };
    setComments(data.comments);
  }

  async function addComment() {
    const body = newComment.trim();
    if (!body) return;
    setPosting(true);
    try {
      saveActorName(actorName.trim());
      await fetch('/api/admin/alerts/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'admin-password': pw() },
        body: JSON.stringify({ alertId, author: actorName.trim() || null, body }),
      });
      setNewComment('');
      await loadComments();
      onChange(); // refresh comment count on the parent
    } finally {
      setPosting(false);
    }
  }

  const isClosed = action?.status === 'closed';

  return (
    <div className="mt-2.5">
      {/* Status row: team / assignee / closed badges */}
      {(action?.team || action?.assignee || isClosed) && (
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {action?.team && (
            <span className={`admin-badge ${TEAM_CONFIG[action.team].badge}`}>{TEAM_CONFIG[action.team].label}</span>
          )}
          {action?.assignee && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <UserCircle2 className="h-3 w-3" /> {action.assignee}
            </span>
          )}
          {isClosed && (
            <span className="admin-badge bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
              <Check className="h-3 w-3" /> Closed{action.closedBy ? ` by ${action.closedBy}` : ''}
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setOpen(open === 'assign' ? null : 'assign')}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/60 transition-colors"
        >
          <UserCircle2 className="h-3 w-3" /> {action?.team || action?.assignee ? 'Reassign' : 'Assign'}
        </button>
        <button
          onClick={() => { const next = open === 'comments' ? null : 'comments'; setOpen(next); if (next === 'comments' && comments === null) loadComments(); }}
          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/60 transition-colors"
        >
          <MessageSquare className="h-3 w-3" /> Comment{action && action.commentCount > 0 ? ` (${action.commentCount})` : ''}
        </button>
        {isClosed ? (
          <button
            onClick={() => postAction({ action: 'reopen' })}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" /> Reopen
          </button>
        ) : (
          <button
            onClick={() => { saveActorName(actorName.trim()); postAction({ action: 'close', closedBy: actorName.trim() || null }); }}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            <Check className="h-3 w-3" /> Close
          </button>
        )}
      </div>

      {/* Assign panel */}
      {open === 'assign' && (
        <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Team</label>
            {(['tech', 'operations', 'marketing'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTeam(team === t ? '' : t)}
                className={`admin-chip${team === t ? ' admin-chip--active' : ''}`}
              >
                {TEAM_CONFIG[t].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">Person</label>
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Who's on this?"
              className="flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
            />
          </div>
          <button
            onClick={async () => { await postAction({ action: 'assign', team: team || null, assignee }); setOpen(null); }}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </button>
        </div>
      )}

      {/* Comments panel */}
      {open === 'comments' && (
        <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          {comments === null ? (
            <div className="flex justify-center py-3"><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No comments yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="text-[11px]">
                  <span className="font-semibold text-foreground">{c.author || 'Admin'}</span>
                  <span className="ml-1.5 text-muted-foreground/70">{timeSince(c.createdAt)}</span>
                  <p className="text-muted-foreground mt-0.5 leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
            <input
              value={actorName}
              onChange={(e) => setActorName(e.target.value)}
              placeholder="Your name"
              className="w-24 shrink-0 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px]"
            />
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addComment(); }}
              placeholder="Add a comment…"
              className="flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px]"
            />
            <button
              onClick={addComment}
              disabled={posting || !newComment.trim()}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AlertsTab({ onNav }: { onNav?: (tab: string) => void }) {
  const [alerts,    setAlerts]    = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [actions,   setActions]   = useState<Map<string, AlertActionState>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<'all' | 'active' | AlertSeverity>('active');
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const pw = sessionStorage.getItem('alive_admin_pw') ?? '';
    const h = { 'admin-password': pw };
    try {
      const [devR, stR, cmR, daR] = await Promise.all([
        fetch('/api/devices',         { headers: h }).then((r) => r.ok ? r.json() : { devices: [] }),
        fetch('/api/stores/save',     { headers: h }).then((r) => r.ok ? r.json() : []),
        fetch('/api/campaigns/admin', { headers: h }).then((r) => r.ok ? r.json() : []),
        // Real DeviceAlert rows — carries the partner's "why is it off?" answer.
        fetch('/api/admin/alerts',    { headers: h }).then((r) => r.ok ? r.json() : { alerts: [] }),
      ]);
      const devs = (devR.devices ?? []) as DeviceRow[];
      const sts  = Array.isArray(stR) ? stR : (stR?.data ?? []) as StoreRow[];
      const cms  = Array.isArray(cmR) ? cmR : [] as CampaignRow[];
      const das  = (daR?.alerts ?? []) as DeviceAlertRow[];
      const dis  = loadDismissed();
      setDismissed(dis);
      setAlerts(buildAlerts(devs, sts, cms, das, dis));
      setLastFetch(new Date());
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  // Team-visible assignment/close/comment state — separate fetch (and separate
  // refresh trigger) from the computed alerts themselves, see /api/admin/alert-actions.
  const fetchActions = useCallback(async () => {
    const pw = sessionStorage.getItem('alive_admin_pw') ?? '';
    try {
      const res = await fetch('/api/admin/alert-actions', { headers: { 'admin-password': pw } });
      const data = res.ok ? await res.json() as { actions: AlertActionState[] } : { actions: [] };
      setActions(new Map(data.actions.map((a) => [a.alertId, a])));
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchAlerts(); fetchActions(); }, [fetchAlerts, fetchActions]);

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
          <button onClick={() => { fetchAlerts(); fetchActions(); }} disabled={loading}
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
            const sev    = SEV_CONFIG[a.severity];
            const Icon   = sev.icon;
            const Cat    = CAT_ICON[a.category];
            const action = actions.get(a.id);
            return (
              <div key={a.id}
                className={`relative rounded-xl border border-border bg-card p-4 border-l-4 ${sev.border} ${a.dismissed || action?.status === 'closed' ? 'opacity-40' : ''} transition-opacity`}
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
                    <AlertActionsPanel alertId={a.id} action={action} onChange={fetchActions} />
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
        Alerts auto-generate from device status, store registrations, and campaign data. Dismiss just hides an alert for you; Assign/Comment/Close are saved for the whole team.
      </p>
    </div>
  );
}
