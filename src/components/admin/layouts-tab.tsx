'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2, Plus, Trash2, Pencil, AlertCircle, CheckCircle2,
  Type, Newspaper, ImageIcon, Info, X, Search, Users, Store, MapPin, Globe, Monitor,
  Wifi, Eye, EyeOff, Sparkles, Layers,
} from 'lucide-react';
import {
  getOverlays, createOverlay, updateOverlay, deleteOverlay, previewFeed,
  getDeviceGroups, searchStores, getDevices,
  type Overlay, type OverlayType, type OverlayPosition,
  type DeviceGroup, type StoreSearchResult, type Device,
} from '@/lib/backend-api';
import { toast } from '@/hooks/use-toast';

const inp = 'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';
const lbl = 'block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1';

type TargetMode = 'all' | 'device' | 'group' | 'store' | 'city';

const TYPE_META: Record<OverlayType, { label: string; icon: React.ElementType; desc: string; needs: ('text' | 'feedUrl' | 'imageUrl')[] }> = {
  TICKER:      { label: 'Scrolling ticker',  icon: Type,      desc: 'Plain text scrolling across the screen edge',           needs: ['text'] },
  NEWS_TICKER: { label: 'Live news feed',    icon: Newspaper, desc: 'RSS / Atom feed — headlines scroll automatically',      needs: ['feedUrl'] },
  BANNER:      { label: 'Banner strip',      icon: ImageIcon, desc: 'Static image strip (logos, promos, ALIVE branding)',    needs: ['imageUrl'] },
  INFO_BAR:    { label: 'Static info bar',   icon: Info,      desc: 'Fixed text bar — store hours, offers, contact info',    needs: ['text'] },
};

const POSITION_META: Record<OverlayPosition, string> = {
  TOP:    'Top strip',
  BOTTOM: 'Bottom strip',
  LEFT:   'Left rail',
  RIGHT:  'Right rail',
};

const TARGET_MODES: { id: TargetMode; label: string; icon: React.ElementType }[] = [
  { id: 'all',    label: 'All screens',      icon: Globe },
  { id: 'device', label: 'Specific screens', icon: Monitor },
  { id: 'group',  label: 'Group',            icon: Users },
  { id: 'store',  label: 'Store',            icon: Store },
  { id: 'city',   label: 'City',             icon: MapPin },
];

type FormState = {
  name:        string;
  type:        OverlayType;
  enabled:     boolean;
  text:        string;
  feedUrl:     string;
  imageUrl:    string;
  position:    OverlayPosition;
  bgColor:     string;
  fgColor:     string;
  speedPxSec:  number;
  heightPct:   number;
  targetMode:  TargetMode;
  deviceIds:   string[];
  groupName:   string;
  storeIds:    string[];
  cityFilter:  string;
  requireWifi: boolean;
  priority:    number;
};

const BLANK_FORM: FormState = {
  name:        '',
  type:        'TICKER',
  enabled:     true,
  text:        '',
  feedUrl:     '',
  imageUrl:    '',
  position:    'BOTTOM',
  bgColor:     '#000000',
  fgColor:     '#ffffff',
  speedPxSec:  60,
  heightPct:   8,
  targetMode:  'all',
  deviceIds:   [],
  groupName:   '',
  storeIds:    [],
  cityFilter:  '',
  requireWifi: false,
  priority:    0,
};

function detectTargetMode(o: Overlay): TargetMode {
  if (o.deviceIds.length)  return 'device';
  if (o.groupName)         return 'group';
  if (o.storeIds.length)   return 'store';
  if (o.cityFilter)        return 'city';
  return 'all';
}

export default function LayoutsTab() {
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // Reference data (loaded lazily as needed)
  const [groups,   setGroups]   = useState<DeviceGroup[]>([]);
  const [cities,   setCities]   = useState<string[]>([]);
  const [devices,  setDevices]  = useState<Device[]>([]);
  const [storeResults, setStoreResults] = useState<StoreSearchResult[]>([]);
  const [selectedStores, setSelectedStores] = useState<StoreSearchResult[]>([]);
  const [storeQuery, setStoreQuery] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [form,     setForm]     = useState<FormState>(BLANK_FORM);
  const [saving,   setSaving]   = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Feed preview
  const [feedPreview, setFeedPreview] = useState<{ items: { title: string; pubDate: string | null }[]; loading: boolean; error: string | null }>({ items: [], loading: false, error: null });

  const storeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getOverlays(),
      getDeviceGroups().catch(() => []),
      searchStores().catch(() => ({ stores: [] as StoreSearchResult[], cities: [] as string[] })),
      getDevices({ take: '500' }).catch(() => ({ devices: [] as Device[], nextCursor: null, total: 0 })),
    ])
      .then(([o, g, sr, dr]) => {
        setOverlays(o);
        setGroups(g);
        setCities(sr.cities);
        setDevices(dr.devices);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Debounced store search
  useEffect(() => {
    if (storeTimer.current) clearTimeout(storeTimer.current);
    storeTimer.current = setTimeout(() => {
      searchStores({ q: storeQuery }).then((r) => { setStoreResults(r.stores); setCities(r.cities); }).catch(() => {});
    }, 300);
    return () => { if (storeTimer.current) clearTimeout(storeTimer.current); };
  }, [storeQuery]);

  const openNew = () => {
    setForm(BLANK_FORM);
    setEditId(null);
    setSelectedStores([]);
    setStoreQuery('');
    setDeviceSearch('');
    setFeedPreview({ items: [], loading: false, error: null });
    setShowForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const openEdit = (o: Overlay) => {
    setForm({
      name:        o.name,
      type:        o.type,
      enabled:     o.enabled,
      text:        o.text ?? '',
      feedUrl:     o.feedUrl ?? '',
      imageUrl:    o.imageUrl ?? '',
      position:    o.position,
      bgColor:     o.bgColor ?? '#000000',
      fgColor:     o.fgColor ?? '#ffffff',
      speedPxSec:  o.speedPxSec,
      heightPct:   o.heightPct,
      targetMode:  detectTargetMode(o),
      deviceIds:   o.deviceIds,
      groupName:   o.groupName ?? '',
      storeIds:    o.storeIds,
      cityFilter:  o.cityFilter ?? '',
      requireWifi: o.requireWifi,
      priority:    o.priority,
    });
    setEditId(o.id);
    setShowForm(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const doPreviewFeed = async () => {
    if (!form.feedUrl) return;
    setFeedPreview({ items: [], loading: true, error: null });
    try {
      const r = await previewFeed(form.feedUrl);
      setFeedPreview({ items: r.items.slice(0, 5), loading: false, error: null });
    } catch (e) {
      setFeedPreview({ items: [], loading: false, error: (e as Error).message });
    }
  };

  const toggleEnabled = async (o: Overlay) => {
    try {
      const updated = await updateOverlay(o.id, { enabled: !o.enabled });
      setOverlays((prev) => prev.map((x) => x.id === o.id ? updated : x));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Couldn\'t toggle overlay', description: (e as Error).message });
    }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this overlay?')) return;
    setDeletingId(id);
    try {
      await deleteOverlay(id);
      setOverlays((prev) => prev.filter((x) => x.id !== id));
      toast({ title: 'Overlay deleted' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Delete failed', description: (e as Error).message });
    } finally {
      setDeletingId(null);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const needs = TYPE_META[form.type].needs;
    for (const n of needs) {
      if (!form[n]) {
        toast({ variant: 'destructive', title: 'Missing field', description: `Please fill in the ${n === 'feedUrl' ? 'feed URL' : n === 'imageUrl' ? 'image URL' : 'text'} for this overlay type.` });
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        type:        form.type,
        enabled:     form.enabled,
        text:        form.text || null,
        feedUrl:     form.feedUrl || null,
        imageUrl:    form.imageUrl || null,
        position:    form.position,
        bgColor:     form.bgColor || null,
        fgColor:     form.fgColor || null,
        speedPxSec:  form.speedPxSec,
        heightPct:   form.heightPct,
        deviceIds:   form.targetMode === 'device' ? form.deviceIds  : [],
        groupName:   form.targetMode === 'group'  ? (form.groupName || null) : null,
        storeIds:    form.targetMode === 'store'  ? form.storeIds   : [],
        cityFilter:  form.targetMode === 'city'   ? (form.cityFilter || null) : null,
        requireWifi: form.requireWifi,
        priority:    form.priority,
      };
      if (editId) {
        const updated = await updateOverlay(editId, payload);
        setOverlays((prev) => prev.map((x) => x.id === editId ? updated : x));
        toast({ title: 'Overlay updated ✓' });
      } else {
        const created = await createOverlay(payload);
        setOverlays((prev) => [created, ...prev]);
        toast({ title: 'Overlay created ✓' });
      }
      setShowForm(false);
      setEditId(null);
      setForm(BLANK_FORM);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Save failed', description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (error) return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex gap-3">
      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-foreground">Could not load overlays</p>
        <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
      </div>
    </div>
  );

  const TypeIcon = TYPE_META[form.type].icon;

  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <Sparkles className="h-3 w-3 inline mr-1 text-primary" />
          <strong className="text-foreground">Overlays</strong> sit on top of your scheduled playlist content — scrolling tickers,
          live news feeds, banner strips or static info bars. The ALIVE Player renders them as a layer above the video / image.
          Rendering happens on the device; this page configures what + where + when.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{overlays.length} overlay{overlays.length !== 1 ? 's' : ''}</p>
        <button
          onClick={showForm ? () => { setShowForm(false); setEditId(null); } : openNew}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> New overlay
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{editId ? 'Edit overlay' : 'New overlay'}</h2>
          <form onSubmit={save} className="space-y-5">

            {/* Type picker */}
            <div>
              <label className={lbl}>Overlay type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(TYPE_META) as OverlayType[]).map((t) => {
                  const meta = TYPE_META[t];
                  const active = form.type === t;
                  const Icon = meta.icon;
                  return (
                    <button key={t} type="button" onClick={() => set('type', t)}
                      className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors ${
                        active ? 'border-primary/50 bg-primary/5' : 'border-border bg-background hover:border-primary/20'
                      }`}>
                      <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground/60'}`} />
                      <p className={`text-[11px] font-bold ${active ? 'text-primary' : 'text-foreground'}`}>{meta.label}</p>
                      <p className="text-[9px] text-muted-foreground/70 leading-tight">{meta.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className={lbl}>Name</label>
                <input type="text" required value={form.name} onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Festival news ticker" className={inp} />
              </div>
              <div>
                <label className={lbl}>Enabled</label>
                <button type="button" onClick={() => set('enabled', !form.enabled)}
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    form.enabled ? 'border-green-500/30 bg-green-500/10 text-green-700' : 'border-border bg-background text-muted-foreground'
                  }`}>
                  {form.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {form.enabled ? 'Live' : 'Paused'}
                </button>
              </div>
            </div>

            {/* Type-specific content */}
            {(form.type === 'TICKER' || form.type === 'INFO_BAR') && (
              <div>
                <label className={lbl}>{form.type === 'TICKER' ? 'Ticker text' : 'Info bar text'}</label>
                <textarea value={form.text} onChange={(e) => set('text', e.target.value)}
                  placeholder={form.type === 'TICKER' ? 'Welcome to Sharma Stores — 10% off all snacks today' : 'Open 9am–10pm · UPI accepted · WhatsApp +91…'}
                  rows={2} required
                  className={`${inp} resize-y`} />
              </div>
            )}

            {form.type === 'NEWS_TICKER' && (
              <div className="space-y-2">
                <label className={lbl}>RSS / Atom feed URL</label>
                <div className="flex gap-2">
                  <input type="url" value={form.feedUrl} onChange={(e) => set('feedUrl', e.target.value)}
                    placeholder="https://feeds.bbci.co.uk/news/rss.xml" required className={`${inp} flex-1`} />
                  <button type="button" onClick={doPreviewFeed} disabled={!form.feedUrl || feedPreview.loading}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                    {feedPreview.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Preview'}
                  </button>
                </div>
                {feedPreview.error && (
                  <p className="text-[11px] text-destructive">{feedPreview.error}</p>
                )}
                {feedPreview.items.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Latest headlines</p>
                    {feedPreview.items.map((item, i) => (
                      <p key={i} className="text-[11px] text-foreground truncate">• {item.title}</p>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/60">
                  Server fetches and caches the feed every 5 min. Suggestions: Cricbuzz RSS for scores, BBC/NDTV for news.
                </p>
              </div>
            )}

            {form.type === 'BANNER' && (
              <div>
                <label className={lbl}>Image URL</label>
                <input type="url" value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)}
                  placeholder="https://... (upload via Content tab first, then paste the public URL)" required className={inp} />
                {form.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.imageUrl} alt="banner preview" className="mt-2 max-h-24 rounded-lg border border-border" />
                )}
              </div>
            )}

            {/* Position + visual */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className={lbl}>Position</label>
                <select value={form.position} onChange={(e) => set('position', e.target.value as OverlayPosition)} className={inp}>
                  {(Object.keys(POSITION_META) as OverlayPosition[]).map((p) => (
                    <option key={p} value={p}>{POSITION_META[p]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Height (% of screen)</label>
                <input type="number" min={2} max={50} value={form.heightPct}
                  onChange={(e) => set('heightPct', Number(e.target.value))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Background</label>
                <input type="color" value={form.bgColor} onChange={(e) => set('bgColor', e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-background cursor-pointer" />
              </div>
              <div>
                <label className={lbl}>Text colour</label>
                <input type="color" value={form.fgColor} onChange={(e) => set('fgColor', e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-background cursor-pointer" />
              </div>
            </div>

            {/* Ticker speed (only for scrolling types) */}
            {(form.type === 'TICKER' || form.type === 'NEWS_TICKER') && (
              <div>
                <label className={lbl}>Scroll speed <span className="normal-case font-normal text-muted-foreground/60">({form.speedPxSec} px/sec)</span></label>
                <input type="range" min={10} max={200} step={5} value={form.speedPxSec}
                  onChange={(e) => set('speedPxSec', Number(e.target.value))} className="w-full accent-primary" />
                <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-1">
                  <span>Slow</span><span>Fast</span>
                </div>
              </div>
            )}

            {/* Live preview */}
            <div>
              <label className={lbl}>Live preview</label>
              <div className="relative aspect-video rounded-xl border border-border bg-gradient-to-br from-slate-900 to-slate-700 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center text-white/30 text-xs">[ Playlist content ]</div>
                {(form.type === 'TICKER' || form.type === 'NEWS_TICKER' || form.type === 'INFO_BAR') && form.text && (
                  <div
                    className={`absolute left-0 right-0 flex items-center px-4 ${
                      form.position === 'TOP' ? 'top-0' : form.position === 'BOTTOM' ? 'bottom-0' : ''
                    }`}
                    style={{
                      height: `${form.heightPct}%`,
                      backgroundColor: form.bgColor,
                      color: form.fgColor,
                    }}
                  >
                    <p className="text-xs font-semibold truncate">{form.text || form.feedUrl}</p>
                  </div>
                )}
                {form.type === 'NEWS_TICKER' && !form.text && (
                  <div className={`absolute left-0 right-0 flex items-center px-4 ${form.position === 'TOP' ? 'top-0' : 'bottom-0'}`}
                    style={{ height: `${form.heightPct}%`, backgroundColor: form.bgColor, color: form.fgColor }}>
                    <p className="text-xs font-semibold truncate">
                      {feedPreview.items[0]?.title ?? '[ Live news headlines will scroll here ]'}
                    </p>
                  </div>
                )}
                {form.type === 'BANNER' && form.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.imageUrl} alt="" className={`absolute left-0 right-0 w-full object-cover ${form.position === 'TOP' ? 'top-0' : 'bottom-0'}`}
                    style={{ height: `${form.heightPct}%` }} />
                )}
              </div>
            </div>

            {/* Targeting */}
            <div className="space-y-3">
              <label className={lbl}>Targeting</label>
              <div className="flex flex-wrap gap-1.5">
                {TARGET_MODES.map((m) => {
                  const Icon = m.icon;
                  const active = form.targetMode === m.id;
                  return (
                    <button key={m.id} type="button" onClick={() => set('targetMode', m.id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                        active
                          ? 'border-primary/50 bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}>
                      <Icon className="h-3 w-3" /> {m.label}
                    </button>
                  );
                })}
              </div>

              {form.targetMode === 'all' && (
                <p className="text-[11px] text-muted-foreground">Overlay will render on every registered screen.</p>
              )}

              {form.targetMode === 'device' && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <input type="text" placeholder="Search screens…" value={deviceSearch}
                      onChange={(e) => setDeviceSearch(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                    {devices.filter((d) => !deviceSearch || d.storeName.toLowerCase().includes(deviceSearch.toLowerCase())).map((d) => {
                      const checked = form.deviceIds.includes(d.id);
                      return (
                        <button key={d.id} type="button"
                          onClick={() => set('deviceIds', checked ? form.deviceIds.filter((id) => id !== d.id) : [...form.deviceIds, d.id])}
                          className={`w-full flex items-center justify-between px-4 py-2 text-left text-xs transition-colors ${checked ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                          <span className="text-foreground">{d.storeName}</span>
                          <div className={`h-4 w-4 rounded border-2 flex items-center justify-center ${checked ? 'border-primary bg-primary' : 'border-border'}`}>
                            {checked && <div className="h-2 w-2 bg-white rounded-sm" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {form.targetMode === 'group' && (
                <select value={form.groupName} onChange={(e) => set('groupName', e.target.value)} className={inp}>
                  <option value="">Select a group…</option>
                  {groups.map((g) => <option key={g.name} value={g.name}>{g.name} ({g.total} screen{g.total !== 1 ? 's' : ''})</option>)}
                </select>
              )}

              {form.targetMode === 'store' && (
                <div className="space-y-2">
                  <input type="text" placeholder="Search stores…" value={storeQuery}
                    onChange={(e) => setStoreQuery(e.target.value)} className={inp} />
                  {selectedStores.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedStores.map((s) => (
                        <span key={s.id} className="flex items-center gap-1 bg-primary/10 text-primary text-[11px] font-semibold rounded-full px-2.5 py-1">
                          {s.storeName}
                          <button type="button" onClick={() => {
                            set('storeIds', form.storeIds.filter((id) => id !== s.id));
                            setSelectedStores((p) => p.filter((x) => x.id !== s.id));
                          }} className="hover:text-primary/70"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  {storeResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                      {storeResults.map((s) => {
                        const checked = form.storeIds.includes(s.id);
                        return (
                          <button key={s.id} type="button"
                            onClick={() => {
                              if (checked) {
                                set('storeIds', form.storeIds.filter((id) => id !== s.id));
                                setSelectedStores((p) => p.filter((x) => x.id !== s.id));
                              } else {
                                set('storeIds', [...form.storeIds, s.id]);
                                setSelectedStores((p) => [...p, s]);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2 text-left text-xs ${checked ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                            <div>
                              <p className="text-foreground font-semibold">{s.storeName}</p>
                              <p className="text-[10px] text-muted-foreground">{[s.locality, s.city].filter(Boolean).join(', ')} · {s.screenCount} screen{s.screenCount !== 1 ? 's' : ''}</p>
                            </div>
                            <div className={`h-4 w-4 rounded border-2 flex items-center justify-center ${checked ? 'border-primary bg-primary' : 'border-border'}`}>
                              {checked && <div className="h-2 w-2 bg-white rounded-sm" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {form.targetMode === 'city' && (
                <div className="flex flex-wrap gap-2">
                  {cities.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No cities yet — link screens to stores first.</p>
                  ) : cities.map((c) => {
                    const active = form.cityFilter === c;
                    return (
                      <button key={c} type="button" onClick={() => set('cityFilter', active ? '' : c)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${active ? 'border-primary/50 bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Constraints */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => set('requireWifi', !form.requireWifi)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                  form.requireWifi ? 'border-primary/50 bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
                }`}>
                <Wifi className="h-3.5 w-3.5" /> Only show on WiFi-connected screens
              </button>
              <div>
                <label className={lbl}>Priority <span className="normal-case font-normal text-muted-foreground/60">(higher wins overlap)</span></label>
                <input type="number" min={0} max={10} value={form.priority}
                  onChange={(e) => set('priority', Number(e.target.value))} className={inp} />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-40 transition-colors">
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : editId ? <><CheckCircle2 className="h-3.5 w-3.5" /> Update overlay</> : 'Create overlay'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }}
                className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {overlays.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-16">
          <Layers className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mt-2">No overlays yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Add a ticker, news feed or banner to enrich the on-screen experience.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {overlays.map((o) => {
            const meta = TYPE_META[o.type];
            const Icon = meta.icon;
            return (
              <div key={o.id} className={`rounded-xl border bg-card p-4 flex items-center gap-4 transition-colors ${o.enabled ? 'border-border' : 'border-border bg-muted/30 opacity-60'}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${o.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{o.name}</p>
                    <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground font-semibold">{meta.label}</span>
                    {o.priority > 0 && <span className="text-[9px] font-bold bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-full">P{o.priority}</span>}
                    {o.requireWifi && <span title="WiFi only" className="text-blue-500"><Wifi className="h-3 w-3" /></span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>{POSITION_META[o.position]} · {o.heightPct}%</span>
                    <span>
                      {o.deviceIds.length ? `${o.deviceIds.length} screen${o.deviceIds.length !== 1 ? 's' : ''}` :
                       o.groupName       ? `Group: ${o.groupName}` :
                       o.storeIds.length ? `${o.storeIds.length} store${o.storeIds.length !== 1 ? 's' : ''}` :
                       o.cityFilter      ? o.cityFilter :
                       'All screens'}
                    </span>
                    {(o.text || o.feedUrl) && <span className="truncate max-w-[200px]">— {o.text || o.feedUrl}</span>}
                  </div>
                </div>
                <button onClick={() => toggleEnabled(o)}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors ${
                    o.enabled ? 'border-green-500/30 bg-green-500/10 text-green-700' : 'border-border text-muted-foreground hover:text-foreground'
                  }`}>
                  {o.enabled ? <><Eye className="h-3 w-3" /> Live</> : <><EyeOff className="h-3 w-3" /> Paused</>}
                </button>
                <button onClick={() => openEdit(o)}
                  className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/5 px-2 py-1 text-[10px] font-semibold text-blue-600 hover:bg-blue-500/15 transition-colors">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={() => del(o.id)} disabled={deletingId === o.id}
                  className="flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/15 transition-colors disabled:opacity-40">
                  {deletingId === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
