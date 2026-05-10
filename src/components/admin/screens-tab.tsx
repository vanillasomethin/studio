'use client';

import { useEffect, useState } from 'react';
import { Loader2, Tv2, Wifi, WifiOff, Clock, AlertCircle } from 'lucide-react';
import { getDevices, type Device } from '@/lib/backend-api';

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function timeSince(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return `${secs}s ago`;
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

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex gap-3">
      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-foreground">Could not load screens</p>
        <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total screens', value: devices.length,      icon: Tv2,     color: 'text-blue-500'    },
          { label: 'Online',        value: online,               icon: Wifi,    color: 'text-green-500'   },
          { label: 'Offline',       value: offline,              icon: WifiOff, color: 'text-red-500'     },
          { label: 'Pending claim', value: pending,              icon: Clock,   color: 'text-yellow-500'  },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <s.icon className={`h-4 w-4 ${s.color} mb-2`} />
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search by store name or device ID…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
      />

      {!filtered.length ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          {search ? 'No devices match your search.' : 'No screens registered yet. Install ALIVE-Player on an Android TV to get started.'}
        </p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {['Store', 'Device ID', 'Status', 'Last seen', 'Uptime', 'Claimed'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => {
                const StatusIcon = STATUS_ICONS[d.status];
                return (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{d.storeName}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{d.id.slice(0, 12)}…</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${STATUS_COLORS[d.status]}`}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.lastSeen ? timeSince(d.lastSeen) : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.uptimePct != null ? (
                        <span className={d.uptimePct >= 98 ? 'text-green-600 font-semibold' : d.uptimePct >= 90 ? 'text-yellow-600' : 'text-red-500'}>
                          {d.uptimePct.toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground/60">{fmtDate(d.claimedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
