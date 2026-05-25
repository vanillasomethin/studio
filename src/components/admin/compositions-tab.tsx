'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2, Plus, Trash2, Pencil, X, Check, Layers, LayoutGrid, GripVertical,
  ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import {
  getCompositions, createComposition, updateComposition, deleteComposition,
  getPlaylists,
  type Composition, type ZoneDefinition, type Playlist,
} from '@/lib/backend-api';
import { toast } from '@/hooks/use-toast';

// ─── Zone color palette ───────────────────────────────────────────────────────

const ZONE_COLORS = [
  { bg: 'rgba(59,130,246,0.25)',  border: '#3b82f6', label: 'text-blue-700'   },
  { bg: 'rgba(16,185,129,0.25)', border: '#10b981', label: 'text-emerald-700' },
  { bg: 'rgba(245,158,11,0.25)', border: '#f59e0b', label: 'text-amber-700'   },
  { bg: 'rgba(139,92,246,0.25)', border: '#8b5cf6', label: 'text-violet-700'  },
  { bg: 'rgba(239,68,68,0.25)',  border: '#ef4444', label: 'text-red-700'     },
  { bg: 'rgba(236,72,153,0.25)', border: '#ec4899', label: 'text-pink-700'    },
];
function zc(i: number) { return ZONE_COLORS[i % ZONE_COLORS.length]; }

// ─── Standard presets ─────────────────────────────────────────────────────────

const PRESETS: { name: string; description: string; zones: Omit<ZoneDefinition, 'playlistId' | 'playlistName'>[] }[] = [
  {
    name: 'Full Screen',
    description: 'Single zone — 100% of screen',
    zones: [{ id: 'z1', label: 'Full', x: 0, y: 0, w: 100, h: 100 }],
  },
  {
    name: 'Main + Ticker',
    description: 'Content 80% · Bottom ticker 20%',
    zones: [
      { id: 'z1', label: 'Main',   x: 0, y: 0,  w: 100, h: 80 },
      { id: 'z2', label: 'Ticker', x: 0, y: 80, w: 100, h: 20 },
    ],
  },
  {
    name: 'Left + Right',
    description: '60% main · 40% sidebar',
    zones: [
      { id: 'z1', label: 'Main', x: 0,  y: 0, w: 60, h: 100 },
      { id: 'z2', label: 'Side', x: 60, y: 0, w: 40, h: 100 },
    ],
  },
  {
    name: 'Top + Bottom',
    description: '70% hero · 30% lower panel',
    zones: [
      { id: 'z1', label: 'Hero',  x: 0, y: 0,  w: 100, h: 70 },
      { id: 'z2', label: 'Lower', x: 0, y: 70, w: 100, h: 30 },
    ],
  },
  {
    name: 'Main + Side + Ticker',
    description: '3-zone: content · sidebar · bottom ticker',
    zones: [
      { id: 'z1', label: 'Main',   x: 0,  y: 0,  w: 70, h: 80 },
      { id: 'z2', label: 'Side',   x: 70, y: 0,  w: 30, h: 80 },
      { id: 'z3', label: 'Ticker', x: 0,  y: 80, w: 100, h: 20 },
    ],
  },
  {
    name: 'Quad',
    description: '4 equal zones (50/50 grid)',
    zones: [
      { id: 'z1', label: 'Top-Left',     x: 0,  y: 0,  w: 50, h: 50 },
      { id: 'z2', label: 'Top-Right',    x: 50, y: 0,  w: 50, h: 50 },
      { id: 'z3', label: 'Bottom-Left',  x: 0,  y: 50, w: 50, h: 50 },
      { id: 'z4', label: 'Bottom-Right', x: 50, y: 50, w: 50, h: 50 },
    ],
  },
];

// ─── Zone canvas preview ──────────────────────────────────────────────────────

function ZonePreview({
  zones,
  selected,
  onSelect,
  small = false,
}: {
  zones: ZoneDefinition[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  small?: boolean;
}) {
  return (
    <div
      className={`relative bg-gray-900 rounded-lg overflow-hidden border border-border ${small ? 'w-full' : 'w-full'}`}
      style={{ aspectRatio: '16/9' }}
    >
      {zones.map((z, i) => {
        const c = zc(i);
        const isSelected = selected === z.id;
        return (
          <div
            key={z.id}
            onClick={() => onSelect?.(z.id)}
            className={`absolute flex items-center justify-center transition-all ${onSelect ? 'cursor-pointer' : ''}`}
            style={{
              left:   `${z.x}%`,
              top:    `${z.y}%`,
              width:  `${z.w}%`,
              height: `${z.h}%`,
              background: c.bg,
              border: `${isSelected ? 2 : 1}px solid ${c.border}`,
              boxSizing: 'border-box',
              outline: isSelected ? `2px solid ${c.border}` : undefined,
            }}
          >
            <span className={`${small ? 'text-[8px]' : 'text-[10px]'} font-bold px-1 rounded text-white bg-black/40 truncate max-w-full`}>
              {z.label}{z.playlistName ? ` · ${z.playlistName}` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Draw canvas (for custom editor) ─────────────────────────────────────────

function DrawCanvas({
  zones,
  selected,
  drawMode,
  onSelect,
  onAddZone,
}: {
  zones: ZoneDefinition[];
  selected: string | null;
  drawMode: boolean;
  onSelect: (id: string | null) => void;
  onAddZone: (z: Omit<ZoneDefinition, 'playlistId' | 'playlistName'>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [cur,  setCur]  = useState<{ x: number; y: number } | null>(null);

  const toRel = (clientX: number, clientY: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top)  / rect.height) * 100)),
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!drawMode) return;
    e.preventDefault();
    onSelect(null);
    setDrag(toRel(e.clientX, e.clientY));
    setCur(toRel(e.clientX, e.clientY));
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    setCur(toRel(e.clientX, e.clientY));
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (!drag) return;
    const end = toRel(e.clientX, e.clientY);
    const x = Math.round(Math.min(drag.x, end.x));
    const y = Math.round(Math.min(drag.y, end.y));
    const w = Math.round(Math.abs(end.x - drag.x));
    const h = Math.round(Math.abs(end.y - drag.y));
    if (w >= 5 && h >= 5) {
      onAddZone({ id: `z${Date.now()}`, label: `Zone ${zones.length + 1}`, x, y, w, h });
    }
    setDrag(null); setCur(null);
  };

  const dragRect = drag && cur ? {
    x: Math.min(drag.x, cur.x),
    y: Math.min(drag.y, cur.y),
    w: Math.abs(cur.x - drag.x),
    h: Math.abs(cur.y - drag.y),
  } : null;

  return (
    <div
      ref={ref}
      className={`relative bg-gray-900 rounded-xl overflow-hidden border-2 border-border select-none ${drawMode ? 'cursor-crosshair' : 'cursor-default'}`}
      style={{ aspectRatio: '16/9' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => { setDrag(null); setCur(null); }}
    >
      {zones.map((z, i) => {
        const c = zc(i);
        const isSel = selected === z.id;
        return (
          <div
            key={z.id}
            onClick={(e) => { if (!drawMode) { e.stopPropagation(); onSelect(z.id); } }}
            className="absolute flex items-start justify-start p-1 transition-all"
            style={{
              left:    `${z.x}%`,
              top:     `${z.y}%`,
              width:   `${z.w}%`,
              height:  `${z.h}%`,
              background: c.bg,
              border: `${isSel ? 2 : 1}px solid ${c.border}`,
              boxSizing: 'border-box',
              outline: isSel ? `2px solid ${c.border}` : undefined,
              cursor: drawMode ? 'crosshair' : 'pointer',
            }}
          >
            <span className="text-[9px] font-bold text-white bg-black/50 px-1 rounded truncate max-w-full">
              {z.label}{z.playlistName ? ` · ${z.playlistName}` : ''}
            </span>
          </div>
        );
      })}
      {dragRect && dragRect.w > 1 && dragRect.h > 1 && (
        <div
          className="absolute pointer-events-none border-2 border-primary bg-primary/20"
          style={{ left: `${dragRect.x}%`, top: `${dragRect.y}%`, width: `${dragRect.w}%`, height: `${dragRect.h}%`, boxSizing: 'border-box' }}
        />
      )}
      {drawMode && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[10px] text-white pointer-events-none">
          Click &amp; drag to draw a zone
        </div>
      )}
    </div>
  );
}

// ─── Composition editor modal ─────────────────────────────────────────────────

function EditorModal({
  initial,
  playlists,
  onSave,
  onClose,
}: {
  initial?: Composition;
  playlists: Playlist[];
  onSave: (c: Composition) => void;
  onClose: () => void;
}) {
  const [name,     setName]     = useState(initial?.name ?? '');
  const [desc,     setDesc]     = useState(initial?.description ?? '');
  const [zones,    setZones]    = useState<ZoneDefinition[]>(initial?.zones ?? []);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [saving,   setSaving]   = useState(false);

  const selectedZone = zones.find((z) => z.id === selected) ?? null;

  const addZone = (z: Omit<ZoneDefinition, 'playlistId' | 'playlistName'>) => {
    const newZone: ZoneDefinition = { ...z, playlistId: null, playlistName: null };
    setZones((prev) => [...prev, newZone]);
    setSelected(newZone.id);
    setDrawMode(false);
  };

  const updateZone = (id: string, patch: Partial<ZoneDefinition>) => {
    setZones((prev) => prev.map((z) => z.id === id ? { ...z, ...patch } : z));
  };

  const deleteZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
    setSelected(null);
  };

  const assignPlaylist = (zoneId: string, playlistId: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    updateZone(zoneId, { playlistId: playlistId || null, playlistName: pl?.name ?? null });
  };

  const save = async () => {
    if (!name.trim()) return;
    if (zones.length === 0) { toast({ variant: 'destructive', title: 'Add at least one zone' }); return; }
    setSaving(true);
    try {
      let result: Composition;
      if (initial) {
        result = await updateComposition(initial.id, { name, description: desc, zones });
      } else {
        result = await createComposition({ name, description: desc, zones });
      }
      onSave(result);
      onClose();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Save failed', description: (e as Error).message });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <p className="font-bold text-foreground">{initial ? 'Edit composition' : 'New composition'}</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name + description */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My composition"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Description (optional)</label>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g. Used during Diwali promotions"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Canvas */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Canvas (16:9)</label>
                <button
                  onClick={() => setDrawMode((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${drawMode ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {drawMode ? 'Drawing…' : 'Draw zone'}
                </button>
              </div>
              <DrawCanvas
                zones={zones}
                selected={selected}
                drawMode={drawMode}
                onSelect={setSelected}
                onAddZone={addZone}
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                {drawMode ? 'Click and drag on the canvas above to draw a new zone.' : 'Click a zone to select it, then configure it in the panel.'}
              </p>
            </div>

            {/* Zone list + config */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Zones ({zones.length})</p>

              {zones.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <p className="text-xs text-muted-foreground">No zones yet. Click &ldquo;Draw zone&rdquo; and drag on the canvas.</p>
                </div>
              )}

              <div className="space-y-2">
                {zones.map((z, i) => {
                  const c = zc(i);
                  const isSel = selected === z.id;
                  return (
                    <div key={z.id} className={`rounded-xl border transition-all ${isSel ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}>
                      <button
                        onClick={() => setSelected(isSel ? null : z.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left"
                      >
                        <div className="h-3 w-3 rounded shrink-0" style={{ background: c.border }} />
                        <span className="text-xs font-semibold text-foreground truncate flex-1">{z.label}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{z.w}×{z.h}%</span>
                        {isSel ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      </button>

                      {isSel && (
                        <div className="px-3 pb-3 space-y-2.5 border-t border-border/50 pt-2.5">
                          {/* Label */}
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Label</label>
                            <input
                              value={z.label}
                              onChange={(e) => updateZone(z.id, { label: e.target.value })}
                              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none transition-all"
                            />
                          </div>
                          {/* Position */}
                          <div className="grid grid-cols-2 gap-2">
                            {(['x', 'y', 'w', 'h'] as const).map((f) => (
                              <div key={f}>
                                <label className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{f === 'x' ? 'Left %' : f === 'y' ? 'Top %' : f === 'w' ? 'Width %' : 'Height %'}</label>
                                <input
                                  type="number" min={0} max={100}
                                  value={z[f]}
                                  onChange={(e) => updateZone(z.id, { [f]: Math.max(0, Math.min(100, Number(e.target.value))) })}
                                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none transition-all"
                                />
                              </div>
                            ))}
                          </div>
                          {/* Playlist */}
                          <div>
                            <label className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Playlist</label>
                            <select
                              value={z.playlistId ?? ''}
                              onChange={(e) => assignPlaylist(z.id, e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none transition-all"
                            >
                              <option value="">— None assigned —</option>
                              {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                          {/* Delete */}
                          <button
                            onClick={() => deleteZone(z.id)}
                            className="flex items-center gap-1.5 text-[10px] text-destructive hover:underline"
                          >
                            <Trash2 className="h-3 w-3" /> Delete zone
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button
            onClick={save}
            disabled={saving || !name.trim() || zones.length === 0}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {initial ? 'Save changes' : 'Create composition'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function CompositionsTab() {
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [playlists,    setPlaylists]    = useState<Playlist[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showPresets,  setShowPresets]  = useState(true);

  // undefined = modal closed, null = new, Composition = edit existing
  const [modal, setModal] = useState<Composition | null | undefined>(undefined);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getCompositions(), getPlaylists()])
      .then(([comps, pls]) => { setCompositions(comps); setPlaylists(pls); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saved = (c: Composition) => {
    setCompositions((prev) => {
      const exists = prev.find((x) => x.id === c.id);
      return exists ? prev.map((x) => x.id === c.id ? c : x) : [...prev, c];
    });
  };

  const del = async (id: string) => {
    if (!confirm('Delete this composition?')) return;
    try {
      await deleteComposition(id);
      setCompositions((prev) => prev.filter((c) => c.id !== id));
      toast({ title: 'Composition deleted' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Delete failed', description: (e as Error).message });
    }
  };

  const usePreset = async (preset: typeof PRESETS[number]) => {
    try {
      const c = await createComposition({ name: preset.name, description: preset.description, zones: preset.zones as ZoneDefinition[] });
      setCompositions((prev) => [...prev, c]);
      toast({ title: `"${preset.name}" added to your compositions` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed', description: (e as Error).message });
    }
  };

  const userComps = compositions.filter((c) => !c.isPreset);

  return (
    <div className="space-y-6">
      {/* Modals */}
      {modal !== undefined && (
        <EditorModal
          initial={modal ?? undefined}
          playlists={playlists}
          onSave={saved}
          onClose={() => setModal(undefined)}
        />
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          <span className="font-bold">Compositions</span> define multi-zone screen layouts — each zone plays a separate playlist simultaneously.
          Assign a composition to a schedule to activate it. The ALIVE Player renders all zones in parallel.
        </p>
      </div>

      {/* Standard presets */}
      <div>
        <button
          onClick={() => setShowPresets((v) => !v)}
          className="w-full flex items-center justify-between mb-3 group"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Standard presets
          </p>
          {showPresets ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
        {showPresets && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PRESETS.map((preset) => (
              <div key={preset.name} className="rounded-xl border border-border bg-card p-3 space-y-2.5 hover:border-primary/30 transition-colors">
                <ZonePreview zones={preset.zones as ZoneDefinition[]} small />
                <div>
                  <p className="text-xs font-bold text-foreground">{preset.name}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{preset.description}</p>
                </div>
                <button
                  onClick={() => usePreset(preset)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Use preset
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My compositions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" /> My compositions ({userComps.length})
          </p>
          <button
            onClick={() => setModal(null)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" /> New composition
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : userComps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-3">
            <LayoutGrid className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No custom compositions yet.</p>
            <p className="text-xs text-muted-foreground/70">Use a preset above or click &ldquo;New composition&rdquo; to build one from scratch.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userComps.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors">
                <ZonePreview zones={c.zones} small />
                <div className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
                      {c.description && <p className="text-[10px] text-muted-foreground leading-relaxed truncate">{c.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setModal(c)} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => del(c.id)} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.zones.map((z, i) => (
                      <span key={z.id} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: zc(i).bg, color: zc(i).border }}>
                        <GripVertical className="h-2.5 w-2.5" />{z.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
