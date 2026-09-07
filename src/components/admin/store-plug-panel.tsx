'use client';

// Live smart-plug power panel inside the admin store card (Stores tab).
//
// Three states: Tuya project not configured (setup hint), no plug linked
// (picker over the Smart Life account's devices), linked (live wattage, units
// today / this month with a ₹ estimate, a 24h draw strip, refresh + unlink).
// Data comes from /api/admin/stores/[id]/power, which re-polls Tuya itself
// when the cron-written snapshot is stale — the panel never talks to Tuya.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plug, RefreshCw, Unlink, Zap } from 'lucide-react';
import { adminGetObject, adminPw } from '@/lib/admin-fetch';

type PowerData = {
  configured: boolean;
  linked: boolean;
  // present only when linked
  name?: string;
  online?: boolean | null;
  switchOn?: boolean | null;
  socketsOn?: number | null;
  socketCount?: number | null;
  powerW?: number | null;
  voltageV?: number | null;
  currentA?: number | null;
  lastPolledAt?: string | null;
  todayKwh?: number;
  monthKwh?: number;
  ratePaisePerKwh?: number;
  estMonthCostPaise?: number;
  hourly24?: { hour: string; avgW: number | null }[];
  tuyaDeviceId?: string;
};

type PickerDevice = {
  id: string; name: string; online: boolean;
  category: string | null; productName: string | null;
  linkedStoreId: string | null; linkedStoreName: string | null;
};

function agoLabel(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function StorePlugPanel({ storeId }: { storeId: string }) {
  const [data, setData] = useState<PowerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'load' | 'refresh' | 'link' | 'unlink' | null>('load');
  // null = closed; loading and a legitimately empty device list are distinct
  // states, or an account with no paired plugs would spin forever.
  const [picker, setPicker] = useState<{ loading: boolean; devices: PickerDevice[] } | null>(null);
  const [pickerErr, setPickerErr] = useState<string | null>(null);
  const [chosen, setChosen] = useState('');

  const load = useCallback(async (refresh = false) => {
    setBusy(refresh ? 'refresh' : 'load');
    setError(null);
    try {
      const qs = refresh ? '?refresh=1' : '';
      setData(await adminGetObject<PowerData>(`/api/admin/stores/${storeId}/power${qs}`));
    } catch {
      setError('Could not load power data.');
    } finally {
      setBusy(null);
    }
  }, [storeId]);

  useEffect(() => { void load(); }, [load]);

  const openPicker = async () => {
    setPicker({ loading: true, devices: [] }); setPickerErr(null);
    try {
      const body = await adminGetObject<{ devices: PickerDevice[] }>('/api/admin/tuya/devices');
      setPicker({ loading: false, devices: body.devices });
      const firstFree = body.devices.find((d) => !d.linkedStoreId);
      if (firstFree) setChosen(firstFree.id);
    } catch {
      setPicker({ loading: false, devices: [] });
      setPickerErr('Could not reach the Tuya cloud. Check the project credentials and retry.');
    }
  };

  const link = async () => {
    if (!chosen) return;
    setBusy('link');
    try {
      const res = await fetch(`/api/admin/stores/${storeId}/plug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'admin-password': adminPw() },
        body: JSON.stringify({ tuyaDeviceId: chosen }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        setPickerErr(body?.error ?? `Link failed (HTTP ${res.status})`);
        return;
      }
      setPicker(null);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const unlink = async () => {
    if (!confirm('Unlink this smart plug? Its consumption history will be deleted.')) return;
    setBusy('unlink');
    try {
      const res = await fetch(`/api/admin/stores/${storeId}/plug`, {
        method: 'DELETE',
        headers: { 'admin-password': adminPw() },
      });
      if (res.ok) await load();
      else setError('Unlink failed.');
    } finally {
      setBusy(null);
    }
  };

  const maxW = Math.max(1, ...(data?.hourly24 ?? []).map((h) => h.avgW ?? 0));

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Zap className="h-3 w-3" /> Power (Aziot plug)
        </p>
        {data?.linked && (
          <div className="flex items-center gap-1.5">
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${data.online ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {data.online ? 'Online' : 'Offline'}
            </span>
            <button type="button" title="Refresh from Tuya" disabled={busy !== null} onClick={() => void load(true)}
              className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground disabled:opacity-40">
              {busy === 'refresh' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </button>
            <button type="button" title="Unlink plug" disabled={busy !== null} onClick={() => void unlink()}
              className="rounded-md border border-border p-1 text-muted-foreground hover:text-red-600 disabled:opacity-40">
              {busy === 'unlink' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
            </button>
          </div>
        )}
      </div>

      {busy === 'load' && !data && (
        <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading power data…
        </div>
      )}
      {error && (
        <p className="text-[11px] text-red-600">{error}{' '}
          <button type="button" className="underline" onClick={() => void load()}>Retry</button>
        </p>
      )}

      {data && !data.linked && !data.configured && (
        <p className="text-[11px] text-muted-foreground">
          Tuya cloud project not configured. Set <code className="font-mono">TUYA_CLIENT_ID</code> and{' '}
          <code className="font-mono">TUYA_CLIENT_SECRET</code> (Tuya IoT Platform → your project → link the
          Smart Life account that owns the Aziot plugs), then reload.
        </p>
      )}

      {data && !data.linked && data.configured && picker === null && (
        <button type="button" onClick={() => void openPicker()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:border-primary/40">
          <Plug className="h-3 w-3" /> Link Aziot plug…
        </button>
      )}

      {data && !data.linked && picker !== null && (
        <div className="space-y-2">
          {picker.loading && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching devices from the Smart Life account…
            </div>
          )}
          {!picker.loading && picker.devices.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select value={chosen} onChange={(e) => setChosen(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-[11px]">
                <option value="">Select a device…</option>
                {picker.devices.map((d) => (
                  <option key={d.id} value={d.id} disabled={!!d.linkedStoreId}>
                    {d.name}{d.online ? '' : ' (offline)'}{d.linkedStoreName ? ` — linked to ${d.linkedStoreName}` : ''}
                  </option>
                ))}
              </select>
              <button type="button" disabled={!chosen || busy !== null} onClick={() => void link()}
                className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40">
                {busy === 'link' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Link'}
              </button>
            </div>
          )}
          {!picker.loading && picker.devices.length === 0 && !pickerErr && (
            <p className="text-[11px] text-muted-foreground">
              No devices on the linked Smart Life account yet — pair the Aziot plug in the Smart Life app first, then retry.
            </p>
          )}
          {pickerErr && <p className="text-[11px] text-red-600">{pickerErr}</p>}
          {!picker.loading && (
            <button type="button" onClick={() => { setPicker(null); setPickerErr(null); }}
              className="text-[11px] text-muted-foreground underline">Cancel</button>
          )}
        </div>
      )}

      {data?.linked && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Drawing now', value: data.online && data.powerW != null ? `${Math.round(data.powerW)} W` : '—' },
              { label: 'Today', value: `${(data.todayKwh ?? 0).toFixed(2)} units` },
              { label: 'This month', value: `${(data.monthKwh ?? 0).toFixed(2)} units` },
              { label: 'Est. cost (mo)', value: `≈ ₹${Math.round((data.estMonthCostPaise ?? 0) / 100).toLocaleString('en-IN')}` },
            ].map((t) => (
              <div key={t.label} className="rounded-lg border border-border bg-background px-2.5 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</p>
                <p className="text-sm font-bold text-foreground">{t.value}</p>
              </div>
            ))}
          </div>

          {!!data.hourly24?.length && (
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">Avg draw · last 24h</p>
              <div className="flex h-8 items-end gap-[2px]">
                {data.hourly24.map((h) => (
                  <div key={h.hour} title={`${new Date(h.hour).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} — ${h.avgW != null ? `${h.avgW} W` : 'no data'}`}
                    className={`flex-1 rounded-sm ${h.avgW != null ? 'bg-primary/60' : 'bg-border'}`}
                    style={{ height: h.avgW != null ? `${Math.max(8, (h.avgW / maxW) * 100)}%` : '3px' }} />
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/70">
            {data.name}
            {data.socketCount ? ` · ${data.socketsOn ?? 0}/${data.socketCount} sockets on` : ''}
            {data.voltageV != null && data.online ? ` · ${Math.round(data.voltageV)} V` : ''}
            {' · updated '}{agoLabel(data.lastPolledAt)}
            {data.tuyaDeviceId ? ` · ${data.tuyaDeviceId}` : ''}
          </p>
        </>
      )}
    </div>
  );
}
