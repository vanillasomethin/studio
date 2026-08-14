'use client';

// Fleet electricity estimates + screen survey.
//
// The numbers here are estimates: measured on-hours × an ASSUMED wattage × an assumed
// tariff. Stores still on the fleet default wattage are flagged, because those are the
// ones whose rupee figure should not be quoted to a partner until someone surveys the
// screen (docs/SCREEN_SURVEY_SOP.md).

import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, Zap, Camera, Check, X, Tv2, Wifi, WifiOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';

type DeviceInfo = {
  id: string; name: string; status: string; lastSeen: string | null;
  androidVersion: string | null; appVersion: string | null;
  orientation: string; freeStorageMb: number | null; cpuTempC: number | null;
};

type PowerStore = {
  id: string; storeName: string; city: string | null;
  screen: {
    model: string | null; watts: number | null; surveyedAt: string | null;
    platePhotoUrl: string | null; ratingPhotoUrl: string | null;
  };
  devices: DeviceInfo[];
  estimate: {
    onHours: number; units: number; costPaise: number;
    watts: number; usingDefaultWatts: boolean;
  };
};

type PowerResponse = {
  since: string;
  settings: { defaultWatts: number; paisePerKwh: number };
  stores: PowerStore[];
};

const adminPw = () => ({ 'admin-password': sessionStorage.getItem('alive_admin_pw') ?? '' });
const rupees  = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function PowerTab() {
  const [data,    setData]    = useState<PowerResponse | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [editing, setEditing] = useState<PowerStore | null>(null);

  const load = useCallback(() => {
    fetch('/api/admin/power', { headers: adminPw() })
      .then((r) => r.ok ? r.json() as Promise<PowerResponse> : Promise.reject(new Error('Could not load')))
      .then((d) => { setData(d); setError(null); })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex gap-3">
      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div><p className="text-sm font-semibold text-foreground">Could not load power data</p>
        <p className="text-xs text-muted-foreground mt-0.5">{error}</p></div>
    </div>
  );
  if (!data) return <div className="space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  const totalPaise   = data.stores.reduce((s, x) => s + x.estimate.costPaise, 0);
  const totalUnits   = data.stores.reduce((s, x) => s + x.estimate.units, 0);
  const unsurveyed   = data.stores.filter((s) => s.screen.watts == null).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-foreground">Estimated electricity — this month</p>
            <p className="text-[11px] text-muted-foreground">
              Measured running hours × screen wattage × ₹{(data.settings.paisePerKwh / 100).toFixed(2)}/unit. Estimates, not meter readings.
            </p>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <p className="text-lg font-black text-foreground">{totalUnits.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              <p className="text-[10px] text-muted-foreground">units</p>
            </div>
            <div>
              <p className="text-lg font-black text-primary">{rupees(totalPaise)}</p>
              <p className="text-[10px] text-muted-foreground">fleet total</p>
            </div>
          </div>
        </div>
        {unsurveyed > 0 && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
            <Zap className="h-3 w-3 shrink-0" />
            {unsurveyed} store{unsurveyed > 1 ? 's' : ''} still using the {data.settings.defaultWatts}W fleet default — survey the screen before quoting those figures.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="px-3 py-2 font-bold">Store</th>
              <th className="px-3 py-2 font-bold">Screen</th>
              <th className="px-3 py-2 font-bold">Player</th>
              <th className="px-3 py-2 font-bold text-right">Hours</th>
              <th className="px-3 py-2 font-bold text-right">Units</th>
              <th className="px-3 py-2 font-bold text-right">Cost</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.stores.map((s) => {
              const d = s.devices[0];
              return (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-foreground">{s.storeName}</p>
                    <p className="text-[10px] text-muted-foreground">{s.city ?? '—'}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-foreground">{s.screen.model ?? <span className="text-muted-foreground/60">Not surveyed</span>}</p>
                    <p className={`text-[10px] ${s.estimate.usingDefaultWatts ? 'text-amber-600' : 'text-muted-foreground'}`}>
                      {s.estimate.watts}W {s.estimate.usingDefaultWatts ? '(fleet default)' : ''}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {d ? (
                      <>
                        <p className="flex items-center gap-1 text-foreground">
                          {d.status === 'ONLINE'
                            ? <Wifi className="h-3 w-3 text-green-600" />
                            : <WifiOff className="h-3 w-3 text-muted-foreground/50" />}
                          {d.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {d.appVersion ? `v${d.appVersion}` : '—'}
                          {d.androidVersion ? ` · Android ${d.androidVersion}` : ''}
                          {d.freeStorageMb != null ? ` · ${(d.freeStorageMb / 1024).toFixed(1)}GB free` : ''}
                          {d.cpuTempC != null ? ` · ${d.cpuTempC.toFixed(0)}°C` : ''}
                        </p>
                      </>
                    ) : <span className="text-muted-foreground/60">No player</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">{s.estimate.onHours.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right text-foreground">{s.estimate.units.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">{rupees(s.estimate.costPaise)}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => setEditing(s)}
                      className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
                      <Camera className="h-3 w-3" /> Survey
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FleetSettings settings={data.settings} onSaved={load} />

      {editing && <SurveyDialog store={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

// ─── Fleet defaults ───────────────────────────────────────────────────────────

function FleetSettings({ settings, onSaved }: {
  settings: { defaultWatts: number; paisePerKwh: number }; onSaved: () => void;
}) {
  const [watts,  setWatts]  = useState(settings.defaultWatts);
  const [rupeesPerUnit, setRupeesPerUnit] = useState((settings.paisePerKwh / 100).toFixed(2));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/power', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminPw() },
        body: JSON.stringify({
          defaultScreenWatts: watts,
          electricityPaisePerKwh: Math.round(Number(rupeesPerUnit) * 100),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'Fleet settings saved ✓' });
      onSaved();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Save failed', description: (e as Error).message });
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Fleet assumptions</p>
      <p className="text-[10px] text-muted-foreground mb-3">
        Used for any store without its own surveyed wattage. The tariff is a flat rate — real MESCOM billing is slabbed, so treat the rupee figures as indicative.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Default screen watts</label>
          <input type="number" min={1} max={1000} value={watts} onChange={(e) => setWatts(Number(e.target.value))}
            className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-muted-foreground mb-1">₹ per unit (kWh)</label>
          <input type="number" min={0.01} step={0.01} value={rupeesPerUnit} onChange={(e) => setRupeesPerUnit(e.target.value)}
            className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-40">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
        </button>
      </div>
    </div>
  );
}

// ─── Per-store screen survey ──────────────────────────────────────────────────

function SurveyDialog({ store, onClose, onSaved }: {
  store: PowerStore; onClose: () => void; onSaved: () => void;
}) {
  const [model, setModel] = useState(store.screen.model ?? '');
  const [watts, setWatts] = useState(store.screen.watts?.toString() ?? '');
  const [plateUrl,  setPlateUrl]  = useState(store.screen.platePhotoUrl ?? '');
  const [ratingUrl, setRatingUrl] = useState(store.screen.ratingPhotoUrl ?? '');
  const [busy,   setBusy]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Phone photos are far under Vercel's ~4.5 MB request cap, so the server-side proxy
  // is the right upload path here (no CORS setup needed) — same as KYC docs.
  const upload = async (file: File, kind: 'plate' | 'rating') => {
    setBusy(kind);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('key', `screens/${store.id}/${kind}-${Date.now()}-${file.name}`);
      const res = await fetch('/api/admin/r2-upload', { method: 'POST', headers: adminPw(), body: form });
      if (!res.ok) throw new Error(await res.text());
      const { publicUrl } = await res.json() as { publicUrl: string };
      if (kind === 'plate') setPlateUrl(publicUrl); else setRatingUrl(publicUrl);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Upload failed', description: (e as Error).message });
    } finally { setBusy(null); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/power', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminPw() },
        body: JSON.stringify({
          storeId: store.id,
          screenModel: model.trim() || null,
          screenWatts: watts.trim() ? Number(watts) : null,
          screenPlatePhotoUrl:  plateUrl  || null,
          screenRatingPhotoUrl: ratingUrl || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: 'Screen survey saved ✓', description: watts.trim() ? 'Estimates now use the real wattage.' : 'No wattage recorded — still on the fleet default.' });
      onSaved();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Save failed', description: (e as Error).message });
    } finally { setSaving(false); }
  };

  const PhotoField = ({ label, url, kind }: { label: string; url: string; kind: 'plate' | 'rating' }) => (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</label>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="mb-1.5 h-20 w-full rounded-lg border border-border object-cover" />
      ) : (
        <div className="mb-1.5 flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-[10px] text-muted-foreground">
          No photo
        </div>
      )}
      <input type="file" accept="image/*" capture="environment"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, kind); }}
        className="w-full text-[10px] text-muted-foreground file:mr-2 file:rounded-lg file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-[10px] file:font-semibold" />
      {busy === kind && <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Uploading…</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <p className="text-sm font-bold text-foreground flex items-center gap-1.5"><Tv2 className="h-4 w-4" />{store.storeName}</p>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          <p className="rounded-lg bg-muted/30 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
            Photograph the model plate and the power rating label on the back of the TV, then type the wattage.
            Leave wattage blank if the label genuinely can&apos;t be read — a blank keeps the store flagged, a guess
            becomes a rupee figure the partner sees. Full steps: docs/SCREEN_SURVEY_SOP.md
          </p>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Screen model</label>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Mi TV 4A Horizon L32M6-EI"
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Power rating (W)</label>
            <input type="number" min={1} max={1000} value={watts} onChange={(e) => setWatts(e.target.value)} placeholder="e.g. 65"
              className="w-28 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PhotoField label="Model plate" url={plateUrl}  kind="plate"  />
            <PhotoField label="Rating label" url={ratingUrl} kind="rating" />
          </div>

          <button onClick={save} disabled={saving}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-40">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save survey
          </button>
        </div>
      </div>
    </div>
  );
}
