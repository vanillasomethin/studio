'use client';

// "Monthly archive" — bottom section of the Proof of Play tab.
//
// Auto-export of the full play log to CSVs in cloud storage (private R2
// bucket) every month or every two months, with an OPTIONAL prune of the
// archived rows from the database. State the operator must never have to
// guess: how far the archive has reached, what period is next and when,
// whether pruning is armed, and every past export with its files.

import { useCallback, useEffect, useState } from 'react';
import {
  Archive, Check, CloudUpload, Download, Loader2, AlertCircle, Trash2,
} from 'lucide-react';
import {
  getPopExportStatus, updatePopExportConfig, runPopExportNow, downloadPopExportFile,
  type PopExportStatus, type PopExportRow,
} from '@/lib/backend-api';
import { toast } from '@/hooks/use-toast';

const th = 'px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap';
const thR = 'px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap';

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** IST calendar date of the last instant BEFORE an exclusive month boundary. */
function fmtBoundary(iso: string): string {
  return new Date(new Date(iso).getTime() - 1).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
  });
}

const STATUS_TONE: Record<PopExportRow['status'], string> = {
  COMPLETED: 'bg-green-50 text-green-700 border-green-500/30',
  RUNNING:   'bg-amber-50 text-amber-700 border-amber-400/40',
  FAILED:    'bg-red-50 text-red-700 border-red-500/30',
};

export default function PopArchivePanel() {
  const [data, setData] = useState<PopExportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);

  const reload = useCallback(() => getPopExportStatus()
    .then((d) => setData({ ...d, exports: Array.isArray(d?.exports) ? d.exports : [], next: d?.next ?? null }))
    .catch(() => {}), []);
  useEffect(() => { reload().finally(() => setLoading(false)); }, [reload]);

  const config = data?.config ?? null;

  const update = (patch: Partial<NonNullable<typeof config>>) => {
    setData((d) => d ? { ...d, config: { ...d.config, ...patch } } : d);
    setSaved(false);
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const updated = await updatePopExportConfig({
        enabled: config.enabled,
        frequency: config.frequency,
        deleteAfterExport: config.deleteAfterExport,
      });
      setData((d) => d ? { ...d, config: updated } : d);
      setSaved(true);
      toast({ title: 'Archive settings saved ✓' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Save failed', description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const exportNow = async () => {
    setRunning(true);
    try {
      const result = await runPopExportNow();
      if (result.export?.status === 'COMPLETED') {
        toast({ title: `Archived ${result.export.periodLabel} ✓`, description: `${(result.export.playCount ?? 0).toLocaleString('en-IN')} plays uploaded to cloud storage.` });
      } else if (result.skipped === 'up-to-date') {
        toast({ title: 'Archive is up to date', description: 'Every completed period is already exported. The current month exports once it ends.' });
      } else if (result.skipped === 'already-running') {
        toast({ title: 'An export is already running', description: 'Check the history below in a minute.' });
      } else {
        toast({ variant: 'destructive', title: 'Export failed', description: result.export?.error ?? 'Unknown error — see the history below.' });
      }
      if (Array.isArray(result.pruned) && result.pruned.length) {
        toast({ title: 'Old play logs pruned', description: result.pruned.map((p) => `${p.periodLabel}: ${(p.deletedRows ?? 0).toLocaleString('en-IN')} rows`).join(' · ') });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Export failed', description: (err as Error).message });
    } finally {
      setRunning(false);
      reload();
    }
  };

  const download = (id: string, file: 'plays' | 'byAd' | 'byScreen') =>
    downloadPopExportFile(id, file).catch((err: Error) =>
      toast({ variant: 'destructive', title: 'Download failed', description: err.message }));

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!config) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Head */}
      <div className="flex flex-wrap items-center gap-2">
        <Archive className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold text-foreground">Monthly archive — cloud storage</p>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${config.enabled ? 'bg-green-50 text-green-700 border-green-500/30' : 'bg-muted/40 text-muted-foreground border-border'}`}>
          {config.enabled ? 'AUTO-EXPORT ON' : 'AUTO-EXPORT OFF'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportNow}
            disabled={running}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground hover:border-primary/40 transition-colors disabled:opacity-40"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5 text-primary" />}
            {running ? 'Exporting…' : 'Export now'}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 ${
              saved ? 'bg-green-500/10 text-green-700 border border-green-500/30' : 'bg-primary text-white hover:bg-primary/90'
            }`}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground -mt-2">
        Every play is written to three CSVs (full play log · by ad · by screen) in private cloud storage
        once the period ends — {config.exportedThrough
          ? <>archived through <span className="font-semibold text-foreground">{fmtBoundary(config.exportedThrough)}</span></>
          : 'nothing archived yet'}.
        {data?.next && (
          <> Next: <span className="font-semibold text-foreground">{data.next.periodLabel}</span>{data.next.due
            ? <span className="text-amber-700 font-semibold"> — due now, runs on the next sweep</span>
            : <> after {fmtBoundary(data.next.periodEnd)}</>}.
          </>
        )}
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded accent-primary cursor-pointer"
            checked={config.enabled ?? false}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          <span className="text-[11px] font-semibold text-foreground">Auto-export on schedule</span>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Every</span>
          <select
            value={config.frequency}
            onChange={(e) => update({ frequency: e.target.value as 'MONTHLY' | 'BIMONTHLY' })}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
          >
            <option value="MONTHLY">month</option>
            <option value="BIMONTHLY">2 months</option>
          </select>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded accent-primary cursor-pointer"
            checked={config.deleteAfterExport ?? false}
            onChange={(e) => update({ deleteAfterExport: e.target.checked })}
          />
          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
            <Trash2 className="h-3 w-3 text-muted-foreground" /> Delete logs after successful export
          </span>
        </label>
      </div>

      {config.deleteAfterExport && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">
            Archived plays are removed from the database <span className="font-semibold text-foreground">45 days after their period ends</span> —
            never at export time, so partner electricity payouts and 30-day uptime (both computed from recent plays) settle first.
            Rows are only ever deleted after their CSVs are uploaded and byte-verified in cloud storage; from then on those
            CSVs are the permanent record, and in-app reports for those dates go empty.
          </p>
        </div>
      )}

      {/* History */}
      {data && data.exports.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className={th}>Period</th>
                <th className={th}>Status</th>
                <th className={thR}>Plays</th>
                <th className={thR}>Screens</th>
                <th className={thR}>Ads</th>
                <th className={thR}>Size</th>
                <th className={th}>Database rows</th>
                <th className={th}>Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.exports.map((x) => (
                <tr key={x.id} className="hover:bg-muted/20 align-top">
                  <td className="px-3 py-2 font-semibold text-foreground whitespace-nowrap">{x.periodLabel}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[x.status]}`}>{x.status}</span>
                    {x.error && <p className="mt-1 max-w-[260px] text-[10px] text-red-700">{x.error}</p>}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{(x.playCount ?? 0).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{x.screenCount}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{x.adCount}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{fmtBytes(x.totalBytes ?? 0)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {x.deletedRows != null
                      ? <span className="text-[10px] font-semibold text-red-700">deleted {x.deletedRows.toLocaleString('en-IN')}</span>
                      : x.status === 'COMPLETED'
                        ? <span className="text-[10px] text-muted-foreground">still in database</span>
                        : <span className="text-[10px] text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {x.status === 'COMPLETED' ? (
                      <div className="flex flex-wrap gap-1">
                        {([['plays', 'Play log'], ['byAd', 'By ad'], ['byScreen', 'By screen']] as const).map(([file, label]) => (
                          <button
                            key={file}
                            onClick={() => download(x.id, file)}
                            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                          >
                            <Download className="h-3 w-3 text-primary" /> {label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-xs text-muted-foreground">
            No archives yet. Turn on auto-export (or hit &ldquo;Export now&rdquo;) — the first run archives every completed
            month from the beginning of recorded history, so nothing is ever missed.
          </p>
        </div>
      )}
    </div>
  );
}
