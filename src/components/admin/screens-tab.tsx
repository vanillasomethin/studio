'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Tv2, Wifi, WifiOff, Clock, AlertCircle, Smartphone, Download, QrCode, ChevronDown, ChevronUp, Copy, Check, Play, CalendarDays, Pencil } from 'lucide-react';
import { getDevices, updateDevice, type Device } from '@/lib/backend-api';

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
  const [devices,  setDevices]  = useState<Device[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    getDevices()
      .then(setDevices)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
          <input
            type="search"
            placeholder="Search by store name, device ID or hardware key…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />

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
                  <div key={d.id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors">
                    {/* Top row — store + status + last seen */}
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
                      <div className="flex items-center gap-3 min-w-0">
                        <Tv2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <RenameField device={d} onSave={(updated) => setDevices((prev) => prev.map((x) => x.id === updated.id ? { ...x, storeName: updated.storeName, groupName: updated.groupName } : x))} />
                          <p className="text-[10px] font-mono text-muted-foreground/70 truncate">{d.hardwareKey.slice(0, 20)}&hellip;</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
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
