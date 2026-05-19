'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Tv2, Wifi, WifiOff, Clock, AlertCircle, Smartphone, Download, QrCode, ChevronDown, ChevronUp, Copy, Check, Play, CalendarDays, Pencil, Stethoscope, X, ExternalLink, CheckCircle2, TriangleAlert, Film, ImageIcon, Layers, Trash2 } from 'lucide-react';
import { getDevices, updateDevice, bulkUpdateDevices, type Device } from '@/lib/backend-api';
import { toast } from '@/hooks/use-toast';

// ─── Diagnostic types ─────────────────────────────────────────────────────────
type DiagIssue = { level: 'ok' | 'warn' | 'error'; message: string };
type PlanPreview = {
  device:      { id: string; name: string; hardwareKey: string; groupName: string | null; status: string; lastSeen: string | null };
  plan:        { planHash: string; scheduleId: string | null; scheduleName: string | null; playlistName: string | null; items: { name: string; url: string; type: string; durationMs: number; order: number }[]; scheduleCount: number; validUntil: string };
  diagnostics: { issues: DiagIssue[] };
  curl:        string;
};

// ─── Diagnostic panel ─────────────────────────────────────────────────────────
function DiagPanel({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  const [data,    setData]    = useState<PlanPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const pw = typeof window !== 'undefined' ? (sessionStorage.getItem('alive_admin_pw') ?? '') : '';
    fetch(`/api/admin/devices/${deviceId}/plan-preview`, { headers: { 'admin-password': pw } })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error as string);
        setData(d as PlanPreview);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [deviceId]);

  useEffect(() => { load(); }, [load]);

  const copyCurl = () => {
    if (!data?.curl) return;
    navigator.clipboard.writeText(data.curl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const levelIcon = (level: DiagIssue['level']) => {
    if (level === 'ok')    return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />;
    if (level === 'warn')  return <TriangleAlert className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />;
    return <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-foreground">Plan diagnostic</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading} className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
            </button>
            <button onClick={onClose} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
          {error && <p className="text-xs text-red-500 bg-red-500/5 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

          {data && (
            <>
              {/* Diagnostics */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Checklist</p>
                <div className="space-y-2">
                  {data.diagnostics.issues.map((issue, i) => (
                    <div key={i} className={`flex gap-2 rounded-xl px-3 py-2.5 text-xs ${
                      issue.level === 'ok'   ? 'bg-green-500/5 border border-green-500/15 text-green-800' :
                      issue.level === 'warn' ? 'bg-yellow-500/5 border border-yellow-500/20 text-yellow-800' :
                                              'bg-red-500/5 border border-red-500/20 text-red-700'
                    }`}>
                      {levelIcon(issue.level)}
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plan summary */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">What this device receives now</p>
                <div className="rounded-xl border border-border bg-background p-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Schedule</span>
                    <span className="font-semibold text-foreground">{data.plan.scheduleName ?? <span className="text-muted-foreground/50 font-normal italic">none</span>}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Playlist</span>
                    <span className="font-semibold text-foreground">{data.plan.playlistName ?? <span className="text-muted-foreground/50 font-normal italic">none</span>}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Content items</span>
                    <span className="font-semibold text-foreground">{data.plan.items.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Schedules in window</span>
                    <span className="font-semibold text-foreground">{data.plan.scheduleCount}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Plan hash</span>
                    <span className="font-mono text-[10px] text-muted-foreground/60">{data.plan.planHash.slice(0, 12)}…</span>
                  </div>
                </div>
              </div>

              {/* Content list */}
              {data.plan.items.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Content in active playlist</p>
                  <div className="space-y-1.5">
                    {data.plan.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.type === 'VIDEO' ? 'bg-purple-500/10' : 'bg-blue-500/10'}`}>
                          {item.type === 'VIDEO'
                            ? <Film className="h-3.5 w-3.5 text-purple-600" />
                            : <ImageIcon className="h-3.5 w-3.5 text-blue-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">{(item.durationMs / 1000).toFixed(0)}s · {item.type.toLowerCase()}</p>
                        </div>
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                          title="Open content URL (test if R2 is accessible)">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 mt-1.5">↗ Click the link icon to test if the media file is accessible from R2.</p>
                </div>
              )}

              {/* curl test */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Test from terminal</p>
                <div className="rounded-xl bg-muted/50 border border-border px-3 py-2.5 flex items-start gap-2">
                  <code className="flex-1 text-[10px] font-mono text-muted-foreground break-all leading-relaxed">{data.curl}</code>
                  <button onClick={copyCurl} className="shrink-0 rounded-lg border border-border bg-background p-1.5 hover:bg-muted/50 transition-colors">
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">Replace &lt;device-token&gt; with the JWT from /api/device/claim.</p>
              </div>

              {/* Sync guide */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-2">
                <p className="text-[11px] font-bold text-foreground">Player sync checklist</p>
                <ul className="space-y-1.5 text-[10px] text-muted-foreground">
                  {[
                    ['1', 'ALIVE Player APK installed and running on Android TV'],
                    ['2', 'App has called POST /api/device/claim — device appears in this list'],
                    ['3', 'App polls GET /api/device/plan every 5 minutes'],
                    ['4', 'Schedule has deviceIds including this device, OR groupName matches'],
                    ['5', 'Schedule startAt is in the past and endAt is in the future'],
                    ['6', 'Playlist has at least 1 content item'],
                    ['7', 'Content files are accessible on R2 (test links above)'],
                  ].map(([n, t]) => (
                    <li key={n} className="flex gap-2"><span className="font-bold text-primary/70 shrink-0">{n}.</span><span>{t}</span></li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Play Store / APK config ─────────────────────────────────────────────────
// Update PLAY_STORE_URL once the app is published.
const PLAY_STORE_URL   = 'https://play.google.com/store/apps/details?id=in.wearealive.player';
const APK_DIRECT_URL   = 'https://pub-7a9bd7006a434f6c84ea68e69b323918.r2.dev/alive-player-latest.apk';
const CLAIM_ENDPOINT   = '/api/device/claim';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function timeSince(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const STATUS_COLORS: Record<Device['status'], string> = {
  ONLINE:  'bg-green-500/10 text-green-600 border-green-500/20',
  OFFLINE: 'bg-red-500/10 text-red-600 border-red-500/20',
  PENDING: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
};

const STATUS_ICONS: Record<Device['status'], React.ElementType> = {
  ONLINE:  Wifi,
  OFFLINE: WifiOff,
  PENDING: Clock,
};

// ─── Registration onboarding card ────────────────────────────────────────────
function AddScreenCard() {
  const [open,    setOpen]    = useState(false);
  const [copied,  setCopied]  = useState(false);

  const baseUrl   = typeof window !== 'undefined' ? window.location.origin : 'https://wearealive.in';
  const claimUrl  = `${baseUrl}${CLAIM_ENDPOINT}`;
  const qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(PLAY_STORE_URL)}`;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Register a new screen</p>
            <p className="text-xs text-muted-foreground mt-0.5">Install ALIVE Player on any Android TV device → it connects automatically</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-primary/10 px-5 py-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Step 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px] font-black shrink-0">1</span>
                <p className="text-xs font-bold text-foreground">Install ALIVE Player</p>
              </div>
              <div className="flex flex-col items-center gap-3">
                {/* QR Code */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Play Store QR" className="rounded-xl border border-border" width={120} height={120} />
                <p className="text-[10px] text-muted-foreground text-center">Scan to open Play Store on Android TV</p>
              </div>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-primary/90 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Get on Play Store
              </a>
              <a
                href={APK_DIRECT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Direct APK download
              </a>
            </div>

            {/* Step 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px] font-black shrink-0">2</span>
                <p className="text-xs font-bold text-foreground">Boot &amp; auto-connect</p>
              </div>
              <ol className="space-y-2.5">
                {[
                  { n: 'a', t: 'Open ALIVE Player on the Android TV / Fire Stick' },
                  { n: 'b', t: 'The app reads the device\'s hardware ID automatically' },
                  { n: 'c', t: 'It calls the claim endpoint and gets a unique token' },
                  { n: 'd', t: 'The screen appears here as "Pending" within seconds' },
                ].map(s => (
                  <li key={s.n} className="flex gap-2.5 text-[11px] text-muted-foreground">
                    <span className="font-bold text-primary shrink-0 w-4">{s.n}.</span>
                    <span>{s.t}</span>
                  </li>
                ))}
              </ol>
              <div className="rounded-xl bg-muted/40 border border-border p-3">
                <p className="text-[10px] font-bold text-foreground mb-1.5 flex items-center gap-1.5"><QrCode className="h-3 w-3" />Claim endpoint</p>
                <div className="flex items-center gap-2">
                  <code className="text-[9px] font-mono text-muted-foreground flex-1 break-all">{claimUrl}</code>
                  <button
                    onClick={() => copy(claimUrl)}
                    className="shrink-0 rounded-lg border border-border bg-background p-1.5 hover:bg-muted/50 transition-colors"
                    title="Copy"
                  >
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px] font-black shrink-0">3</span>
                <p className="text-xs font-bold text-foreground">Assign &amp; go live</p>
              </div>
              <ol className="space-y-2.5">
                {[
                  { n: 'a', t: 'Screen appears in the list below as status: PENDING' },
                  { n: 'b', t: 'Assign it to a store group in the Schedules tab' },
                  { n: 'c', t: 'Upload content in the Content tab' },
                  { n: 'd', t: 'Build a playlist → attach to a schedule → screen goes ONLINE and starts playing' },
                ].map(s => (
                  <li key={s.n} className="flex gap-2.5 text-[11px] text-muted-foreground">
                    <span className="font-bold text-primary shrink-0 w-4">{s.n}.</span>
                    <span>{s.t}</span>
                  </li>
                ))}
              </ol>
              <div className="rounded-xl bg-green-500/8 border border-green-500/20 p-3">
                <p className="text-[11px] text-green-700 font-semibold">Supported devices</p>
                <ul className="mt-1.5 space-y-1 text-[10px] text-green-700/80">
                  <li>• Android TV boxes (Mi Box, Nvidia Shield, etc.)</li>
                  <li>• Amazon Fire TV Stick (4K or later)</li>
                  <li>• Smart TVs running Android TV OS</li>
                  <li>• Android tablets in kiosk mode</li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline rename ────────────────────────────────────────────────────────────
function RenameField({ device, onSave }: { device: Device; onSave: (d: Device) => void }) {
  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState(device.storeName);
  const [group,    setGroup]    = useState(device.groupName ?? '');
  const [saving,   setSaving]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = () => { setName(device.storeName); setGroup(device.groupName ?? ''); setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); };
  const cancel = () => setEditing(false);
  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateDevice(device.id, { storeName: name, groupName: group });
      onSave(updated);
      setEditing(false);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  if (!editing) return (
    <button onClick={open} className="flex items-center gap-1.5 group/rename" title="Rename screen">
      <p className="text-sm font-bold text-foreground truncate">{device.storeName}</p>
      <Pencil className="h-3 w-3 text-muted-foreground/30 group-hover/rename:text-primary/60 transition-colors shrink-0" />
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Screen name"
        className="rounded-lg border border-primary/40 bg-background px-2 py-1 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 w-48"
      />
      <input value={group} onChange={(e) => setGroup(e.target.value)}
        placeholder="Group name (optional)"
        className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 w-48"
      />
      <div className="flex gap-1.5">
        <button onClick={save} disabled={saving || !name.trim()}
          className="rounded-lg bg-primary px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-40 hover:bg-primary/90 transition-colors flex items-center gap-1">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
        </button>
        <button onClick={cancel} className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
      </div>
    </div>
  );
}

// ─── Main tab ────────────────────────────────────────────────────────────────
export default function ScreensTab() {
  const [devices,   setDevices]   = useState<Device[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [search,    setSearch]    = useState('');
  const [diagId,    setDiagId]    = useState<string | null>(null);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [bulking,   setBulking]   = useState(false);
  const [groupInput, setGroupInput] = useState('');
  const [showGroup,  setShowGroup] = useState(false);

  useEffect(() => {
    getDevices()
      .then(setDevices)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = (ids: string[]) =>
    setSelected((prev) => prev.size === ids.length && ids.every((id) => prev.has(id)) ? new Set() : new Set(ids));

  const doBulkGroup = async () => {
    setBulking(true);
    try {
      await bulkUpdateDevices({ ids: [...selected], action: 'group', groupName: groupInput.trim() || undefined });
      setDevices((prev) => prev.map((d) => selected.has(d.id) ? { ...d, groupName: groupInput.trim() || null } : d));
      toast({ title: `${selected.size} screen${selected.size > 1 ? 's' : ''} moved to group "${groupInput.trim() || 'none'}" ✓` });
      setSelected(new Set()); setShowGroup(false); setGroupInput('');
    } catch (e) {
      toast({ variant: 'destructive', title: 'Bulk group failed', description: (e as Error).message });
    } finally { setBulking(false); }
  };

  const doBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} screen${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulking(true);
    try {
      await bulkUpdateDevices({ ids: [...selected], action: 'delete' });
      setDevices((prev) => prev.filter((d) => !selected.has(d.id)));
      toast({ title: `${selected.size} screen${selected.size > 1 ? 's' : ''} deleted` });
      setSelected(new Set());
    } catch (e) {
      toast({ variant: 'destructive', title: 'Bulk delete failed', description: (e as Error).message });
    } finally { setBulking(false); }
  };

  const filtered = devices.filter((d) =>
    !search ||
    d.storeName.toLowerCase().includes(search.toLowerCase()) ||
    d.id.includes(search) ||
    d.hardwareKey.includes(search),
  );

  const online  = devices.filter((d) => d.status === 'ONLINE').length;
  const offline = devices.filter((d) => d.status === 'OFFLINE').length;
  const pending = devices.filter((d) => d.status === 'PENDING').length;

  return (
    <div className="space-y-4">
      {/* Diagnostic modal */}
      {diagId && <DiagPanel deviceId={diagId} onClose={() => setDiagId(null)} />}

      {/* Add screen onboarding */}
      <AddScreenCard />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total screens', value: devices.length, icon: Tv2,     color: 'text-blue-500'   },
          { label: 'Online',        value: online,          icon: Wifi,    color: 'text-green-500'  },
          { label: 'Offline',       value: offline,         icon: WifiOff, color: 'text-red-500'    },
          { label: 'Pending claim', value: pending,         icon: Clock,   color: 'text-yellow-500' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <s.icon className={`h-4 w-4 ${s.color} mb-2`} />
            <p className="text-xl font-bold text-foreground">{loading ? '—' : s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Could not load screens</p>
            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="search"
              placeholder="Search by store name, device ID or hardware key…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {filtered.length > 0 && (
              <button
                onClick={() => toggleAll(filtered.map((d) => d.id))}
                className="rounded-xl border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
              <span className="text-xs font-semibold text-primary">{selected.size} selected</span>
              <div className="flex-1" />

              {showGroup ? (
                <div className="flex items-center gap-2">
                  <input
                    value={groupInput}
                    onChange={(e) => setGroupInput(e.target.value)}
                    placeholder="Group name (blank = remove)"
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-all w-48"
                    onKeyDown={(e) => { if (e.key === 'Enter') doBulkGroup(); if (e.key === 'Escape') setShowGroup(false); }}
                    autoFocus
                  />
                  <button onClick={doBulkGroup} disabled={bulking} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                    {bulking ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Apply'}
                  </button>
                  <button onClick={() => setShowGroup(false)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setShowGroup(true)} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  <Layers className="h-3 w-3" /> Assign group
                </button>
              )}

              <button onClick={doBulkDelete} disabled={bulking} className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/15 transition-colors disabled:opacity-50">
                {bulking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete
              </button>
              <button onClick={() => setSelected(new Set())} className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground ml-1 transition-colors">Clear</button>
            </div>
          )}

          {!filtered.length ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {search ? 'No devices match your search.' : 'No screens registered yet — expand "Register a new screen" above to get started.'}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((d) => {
                const StatusIcon = STATUS_ICONS[d.status];
                const sched = d.currentSchedule;
                return (
                  <div key={d.id} className={`rounded-xl border bg-card overflow-hidden hover:border-primary/30 transition-colors ${selected.has(d.id) ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                    {/* Top row — store + status + last seen */}
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={selected.has(d.id)}
                          onChange={() => toggleSelect(d.id)}
                          className="h-3.5 w-3.5 rounded accent-primary cursor-pointer shrink-0"
                        />
                        <Tv2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <RenameField device={d} onSave={(updated) => setDevices((prev) => prev.map((x) => x.id === updated.id ? { ...x, storeName: updated.storeName, groupName: updated.groupName } : x))} />
                          <p className="text-[10px] font-mono text-muted-foreground/70 truncate">{d.hardwareKey.slice(0, 20)}&hellip;</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setDiagId(d.id)}
                          className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                          title="Diagnose — check what plan this screen receives"
                        >
                          <Stethoscope className="h-3 w-3" /> Diagnose
                        </button>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${STATUS_COLORS[d.status]}`}>
                          <StatusIcon className="h-2.5 w-2.5" />
                          {d.status}
                        </span>
                        {d.uptimePct != null && (
                          <span className={`text-[10px] font-semibold ${d.uptimePct >= 98 ? 'text-green-600' : d.uptimePct >= 90 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {d.uptimePct.toFixed(1)}% up
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom row — working details */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/60">
                      {/* Now playing / schedule */}
                      <div className="px-4 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                          <CalendarDays className="h-2.5 w-2.5" />
                          Schedule
                        </p>
                        {sched ? (
                          <>
                            <p className="text-[11px] font-semibold text-foreground truncate">{sched.name}</p>
                            {sched.playlistName && (
                              <p className="text-[10px] text-muted-foreground truncate">{sched.playlistName}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-[11px] text-muted-foreground/50 italic">No active schedule</p>
                        )}
                      </div>

                      {/* Schedule end time */}
                      <div className="px-4 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          Ends at
                        </p>
                        <p className="text-[11px] text-foreground">
                          {sched ? fmtDate(sched.endsAt) : '—'}
                        </p>
                      </div>

                      {/* Last play event */}
                      <div className="px-4 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                          <Play className="h-2.5 w-2.5" />
                          Last play
                        </p>
                        <p className="text-[11px] text-foreground">
                          {d.lastPlayAt ? timeSince(d.lastPlayAt) : '—'}
                        </p>
                      </div>

                      {/* Last seen / heartbeat */}
                      <div className="px-4 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                          <Wifi className="h-2.5 w-2.5" />
                          Heartbeat
                        </p>
                        <p className="text-[11px] text-foreground">
                          {d.lastSeen ? timeSince(d.lastSeen) : 'Never'}
                        </p>
                        {d.groupName && (
                          <p className="text-[10px] text-muted-foreground/70">Group: {d.groupName}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
