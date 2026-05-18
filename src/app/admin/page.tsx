'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Trash2, Upload, ImageIcon, Store, BarChart3, FileImage,
  Phone, MapPin, CheckCircle2, Clock, X,
  IndianRupee, Eye,
  Tv2, ListVideo, CalendarClock, FileBarChart2, Activity,
  Menu, ChevronRight, LogOut, LayoutDashboard, Images, Map,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const ScreensTab      = dynamic(() => import('@/components/admin/screens-tab'),       { ssr: false });
const ReportsTab      = dynamic(() => import('@/components/admin/reports-tab'),       { ssr: false });
const ContentTab      = dynamic(() => import('@/components/admin/content-tab'),       { ssr: false });
const PlaylistsTab    = dynamic(() => import('@/components/admin/playlists-tab'),     { ssr: false });
const SchedulesTab    = dynamic(() => import('@/components/admin/schedules-tab'),     { ssr: false });
const MonitoringTab   = dynamic(() => import('@/components/admin/monitoring-tab'),   { ssr: false });
const StorePaymentsTab = dynamic(() => import('@/components/admin/store-payments-tab'), { ssr: false });
const SiteMediaTab     = dynamic(() => import('@/components/admin/site-media-tab'),     { ssr: false });
const RoadmapTab       = dynamic(() => import('@/components/admin/roadmap-tab'),        { ssr: false });
import { Logo } from '@/components/icons/logo';

// ─── Types ───────────────────────────────────────────────────────────────────

type Flyer = {
  id: string; storeName: string; title: string;
  description: string; validUntil: string; imageBase64: string; createdAt: string;
};
type StoreReg = {
  id: string; storeName: string; ownerName: string; phone: string;
  whatsapp: string; address?: string; locality: string; city: string; pincode: string;
  lat?: string; lng?: string; gstin?: string; email?: string; createdAt: string;
  onboardingStage?: string; payoutStatus?: string; payoutMethod?: string; upiId?: string;
  bankAccountName?: string; bankAccountNo?: string; bankIfsc?: string; bankName?: string;
  payoutLastPaidAt?: string | null; payoutNotes?: string | null;
};
type Campaign = {
  id: string; brandName: string; contactName: string; email: string;
  phone: string; screens: number; months: number; startDate: string;
  pricePerScreen: number; totalAmount: number; paymentId: string;
  status: 'upcoming' | 'active' | 'completed'; createdAt: string;
};

// ─── Nav config ──────────────────────────────────────────────────────────────

type Tab = 'overview' | 'flyers' | 'stores' | 'campaigns' | 'payments' | 'screens' | 'content' | 'playlists' | 'schedules' | 'reports' | 'monitoring' | 'media' | 'roadmap';

const NAV: { group: string; items: { id: Tab; label: string; icon: React.ElementType; badge?: string }[] }[] = [
  {
    group: 'Overview',
    items: [
      { id: 'overview',   label: 'Dashboard',   icon: LayoutDashboard },
    ],
  },
  {
    group: 'Operations',
    items: [
      { id: 'flyers',     label: 'Flyers',      icon: FileImage   },
      { id: 'stores',     label: 'Stores',      icon: Store       },
      { id: 'campaigns',  label: 'Campaigns',   icon: BarChart3   },
      { id: 'payments',   label: 'Payments',    icon: IndianRupee },
    ],
  },
  {
    group: 'Screen Network',
    items: [
      { id: 'screens',    label: 'Screens',     icon: Tv2         },
      { id: 'content',    label: 'Content',     icon: ImageIcon   },
      { id: 'playlists',  label: 'Playlists',   icon: ListVideo   },
      { id: 'schedules',  label: 'Schedules',   icon: CalendarClock },
      { id: 'reports',    label: 'Reports',     icon: FileBarChart2 },
      { id: 'monitoring', label: 'Monitoring',  icon: Activity    },
    ],
  },
  {
    group: 'Site',
    items: [
      { id: 'media',      label: 'Media',       icon: Images      },
    ],
  },
  {
    group: 'Platform',
    items: [
      { id: 'roadmap',    label: 'Platform Map', icon: Map        },
    ],
  },
];

const PAGE_META: Record<Tab, { eyebrow: string; title: string }> = {
  overview:   { eyebrow: 'ALIVE Admin',        title: 'Dashboard'          },
  flyers:     { eyebrow: 'Flyer management',   title: 'Published flyers'   },
  stores:     { eyebrow: 'Store partners',     title: 'Registered stores'  },
  campaigns:  { eyebrow: 'Brand campaigns',    title: 'All campaigns'      },
  payments:   { eyebrow: 'Store payouts',      title: 'Partner payments'   },
  screens:    { eyebrow: 'Screen fleet',       title: 'Registered screens' },
  content:    { eyebrow: 'Media library',      title: 'Content'            },
  playlists:  { eyebrow: 'Screen programming', title: 'Playlists'          },
  schedules:  { eyebrow: 'Content delivery',   title: 'Schedules'          },
  reports:    { eyebrow: 'Proof of play',      title: 'Play reports'       },
  monitoring: { eyebrow: 'Live network',       title: 'Monitoring'         },
  media:      { eyebrow: 'Site management',    title: 'Homepage media'     },
  roadmap:    { eyebrow: 'ALIVE PLATFORM',     title: 'Platform Roadmap'   },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SS_PW = 'alive_admin_pw';

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
function resolveImage(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//')) return raw;
  return `data:image/jpeg;base64,${raw}`;
}
function fmt(n: number) { return `₹${n.toLocaleString('en-IN')}`; }

function compressImage(dataUrl: string, maxPx = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeIn  = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } } };
const inp = 'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';
const lbl = 'block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1';

// ─── Flyer image modal ────────────────────────────────────────────────────────

function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Flyer preview" className="max-h-[90vh] max-w-full rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// ─── Upload Flyer Panel ───────────────────────────────────────────────────────

function UploadPanel({ onSaved }: { onSaved: () => void }) {
  const [form,        setForm]        = useState({ storeName: '', title: '', description: '', validUntil: '' });
  const [preview,     setPreview]     = useState('');
  const [imgB64,      setImgB64]      = useState('');
  const [busy,        setBusy]        = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [ok,          setOk]          = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = reader.result as string;
      setPreview(raw);
      setImgB64(await compressImage(raw, 1200, 0.75));
      setCompressing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.storeName || !form.title || !form.validUntil) return;
    setBusy(true); setError(null);
    try {
      const pw  = sessionStorage.getItem(SS_PW) ?? '';
      const res = await fetch('/api/flyers/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'admin-password': pw },
        body:   JSON.stringify({ ...form, imageBase64: imgB64 }),
      });
      const body = await res.json() as { success?: boolean; id?: string; error?: string; note?: string };
      if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.note) setError('Saved in memory only (Redis not configured). Flyers won\'t persist across deploys.');
      setForm({ storeName: '', title: '', description: '', validUntil: '' });
      setPreview(''); setImgB64('');
      if (fileRef.current) fileRef.current.value = '';
      if (!body.note) { setOk(true); setTimeout(() => setOk(false), 4000); }
      onSaved();
    } catch (e) {
      setError((e as Error).message ?? 'Error saving flyer');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Upload flyer</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div><label className={lbl}>Store name</label>
          <input type="text" required value={form.storeName} onChange={(e) => set('storeName', e.target.value)} placeholder="Sharma General Store" className={inp} /></div>
        <div><label className={lbl}>Offer title</label>
          <input type="text" required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="WOW Summer Offer — Up to 60% off" className={inp} /></div>
        <div><label className={lbl}>Description <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
          <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Available at all affiliated Alive stores…" className={inp + ' resize-none'} /></div>
        <div><label className={lbl}>Valid until</label>
          <input type="date" required value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} className={inp} /></div>
        <div>
          <label className={lbl}>Flyer image {compressing && <span className="normal-case font-normal text-primary/60">(compressing…)</span>}</label>
          <div onClick={() => fileRef.current?.click()} className="relative cursor-pointer rounded-xl border-2 border-dashed border-border bg-background hover:border-primary/40 transition-colors overflow-hidden">
            {preview
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Preview" className="w-full max-h-52 object-contain" />
              : <div className="flex flex-col items-center justify-center h-28 gap-2 text-muted-foreground/50"><ImageIcon className="h-7 w-7" /><span className="text-xs font-semibold">Click to upload</span><span className="text-[10px] text-muted-foreground/40">Auto-compressed for storage</span></div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
        {error && <p className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">{error}</p>}
        {ok    && <p className="text-xs text-green-600 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2">Flyer published ✓</p>}
        <button type="submit" disabled={busy || compressing || !form.storeName || !form.title || !form.validUntil}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> Publish flyer</>}
        </button>
      </form>
    </div>
  );
}

// ─── Flyer List ───────────────────────────────────────────────────────────────

function FlyersList({ refresh }: { refresh: number }) {
  const [flyers,   setFlyers]   = useState<Flyer[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [modal,    setModal]    = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/flyers/save')
      .then((r) => r.json() as Promise<Flyer[]>)
      .then(setFlyers).catch(() => setFlyers([]))
      .finally(() => setLoading(false));
  }, [refresh]);

  const del = async (id: string) => {
    if (!confirm('Delete this flyer?')) return;
    setDeleting(id);
    const pw = sessionStorage.getItem(SS_PW) ?? '';
    await fetch('/api/flyers/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'admin-password': pw },
      body:   JSON.stringify({ id }),
    }).finally(() => { setDeleting(null); setFlyers((f) => f.filter((x) => x.id !== id)); });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!flyers.length) return <p className="text-sm text-muted-foreground text-center py-12">No flyers published yet.</p>;

  return (
    <>
      {modal && <ImageModal src={modal} onClose={() => setModal(null)} />}
      <div className="grid grid-cols-2 gap-3">
        {flyers.map((f) => {
          const img = resolveImage(f.imageBase64);
          return (
            <div key={f.id} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
              <div className="relative cursor-pointer bg-muted overflow-hidden" onClick={() => img && setModal(img)}>
                {img
                  ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={f.title} className="w-full aspect-video object-cover hover:scale-105 transition-transform duration-300" />
                  : <div className="w-full aspect-video flex items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground/30" /></div>}
                {img && <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center"><Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" /></div>}
              </div>
              <div className="p-3 flex-1 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-primary">{f.storeName}</span>
                <p className="text-xs font-semibold text-foreground line-clamp-1">{f.title}</p>
                <p className="text-[10px] text-muted-foreground/60">Valid until {fmtDate(f.validUntil)}</p>
                <div className="mt-auto pt-2">
                  <button onClick={() => del(f.id)} disabled={deleting === f.id}
                    className="w-full flex items-center justify-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/15 transition-colors disabled:opacity-40">
                    {deleting === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3" /> Delete</>}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Stores Panel ─────────────────────────────────────────────────────────────

function StoresPanel() {
  const [stores,   setStores]   = useState<StoreReg[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    const pw = sessionStorage.getItem(SS_PW) ?? '';
    fetch('/api/stores/save', { headers: { 'admin-password': pw } })
      .then((r) => r.json())
      .then((body) => {
        // unwrap envelope { data: [...] } or plain array
        const arr = Array.isArray(body) ? body : (body?.data ?? []);
        setStores(arr as StoreReg[]);
      })
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveStore = async (store: StoreReg) => {
    const pw = sessionStorage.getItem(SS_PW) ?? '';
    const res = await fetch(`/api/admin/stores/${store.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'admin-password': pw },
      body: JSON.stringify({
        onboardingStage: store.onboardingStage,
        payoutStatus: store.payoutStatus,
        payoutNotes: store.payoutNotes || null,
      }),
    });
    if (!res.ok) throw new Error('Save failed');
  };

  const deleteStore = async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}" and their account? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const pw = sessionStorage.getItem(SS_PW) ?? '';
      const res = await fetch(`/api/admin/stores/${id}`, { method: 'DELETE', headers: { 'admin-password': pw } });
      if (!res.ok) { const b = await res.json() as { error?: string }; alert(b.error ?? 'Delete failed'); return; }
      setStores((all) => all.filter((s) => s.id !== id));
    } finally { setDeleting(null); }
  };

  const filtered = stores.filter((s) =>
    !search ||
    s.storeName.toLowerCase().includes(search.toLowerCase()) ||
    s.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search) || s.whatsapp?.includes(search),
  );

  const active   = stores.filter((s) => s.onboardingStage === 'live').length;
  const rejected = stores.filter((s) => s.onboardingStage === 'rejected').length;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: stores.length },
          { label: 'Live',     value: active },
          { label: 'Rejected', value: rejected },
          { label: 'Cities',   value: new Set(stores.map((s) => s.city)).size },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <input type="search" placeholder="Search stores, owners, cities…" value={search} onChange={(e) => setSearch(e.target.value)} className={inp} />
      {!filtered.length ? (
        <p className="text-sm text-muted-foreground text-center py-10">{search ? 'No stores match your search.' : 'No store registrations yet.'}</p>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
          {filtered.map((s) => {
            const isRejected = s.onboardingStage === 'rejected';
            return (
              <motion.div key={s.id} variants={fadeIn} className={`flex items-start gap-3 rounded-xl border bg-card p-4 ${isRejected ? 'border-red-200 opacity-60' : 'border-border'}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-base ${isRejected ? 'bg-red-50 text-red-400' : 'bg-primary/10 text-primary'}`}>{s.storeName[0]?.toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{s.storeName}</p>
                      <p className="text-xs text-muted-foreground">{s.ownerName}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isRejected && <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Rejected</span>}
                      <span className="text-[10px] text-muted-foreground/50">{fmtDate(s.createdAt)}</span>
                      <button
                        type="button"
                        onClick={() => void deleteStore(s.id, s.storeName)}
                        disabled={deleting === s.id}
                        title="Delete store"
                        className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        {deleting === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone || (s.whatsapp ? `+91 ${s.whatsapp}` : '—')}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {[s.address, s.locality, s.city, s.pincode].filter(Boolean).join(', ') || '—'}</span>
                  </div>
                  {(s.gstin || s.email) && (
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground/70">
                      {s.gstin && <span>GST: {s.gstin}</span>}
                      {s.email && <span>{s.email}</span>}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <select value={s.onboardingStage ?? 'new'} onChange={(e) => setStores((all) => all.map((x) => x.id === s.id ? { ...x, onboardingStage: e.target.value } : x))} className={inp}>
                      <option value="new">New</option>
                      <option value="physically_onboarded">Physically onboarded</option>
                      <option value="digitally_onboarded">Digitally onboarded</option>
                      <option value="live">Live</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <select value={s.payoutStatus ?? 'pending_setup'} onChange={(e) => setStores((all) => all.map((x) => x.id === s.id ? { ...x, payoutStatus: e.target.value } : x))} className={inp}>
                      <option value="pending_setup">Payout setup pending</option>
                      <option value="ready">Ready for payout</option>
                      <option value="paid">Paid</option>
                      <option value="on_hold">On hold</option>
                    </select>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input value={s.payoutNotes ?? ''} onChange={(e) => setStores((all) => all.map((x) => x.id === s.id ? { ...x, payoutNotes: e.target.value } : x))} placeholder="Notes (rejection reason, payout notes…)" className={`${inp} flex-1`} />
                    <button type="button" onClick={() => void saveStore(s)} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white">Save</button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

// ─── Campaigns Panel ──────────────────────────────────────────────────────────

function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  useEffect(() => {
    const pw = sessionStorage.getItem(SS_PW) ?? '';
    fetch('/api/campaigns/admin', { headers: { 'admin-password': pw } })
      .then((r) => r.json() as Promise<Campaign[]>)
      .then(setCampaigns).catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  const deleteCampaign = async (id: string, name: string) => {
    if (!confirm(`Delete campaign for "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const pw = sessionStorage.getItem(SS_PW) ?? '';
      const res = await fetch(`/api/admin/campaigns/${id}`, { method: 'DELETE', headers: { 'admin-password': pw } });
      if (!res.ok) { const b = await res.json() as { error?: string }; alert(b.error ?? 'Delete failed'); return; }
      setCampaigns((all) => all.filter((c) => c.id !== id));
    } finally { setDeleting(null); }
  };

  const total   = campaigns.reduce((s, c) => s + (c.totalAmount ?? 0), 0);
  const paid    = campaigns.filter((c) => c.paymentId && c.paymentId !== 'pending').length;
  const pending = campaigns.filter((c) => !c.paymentId || c.paymentId === 'pending').length;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: BarChart3,    label: 'Total bookings',  value: campaigns.length, color: 'text-blue-500'    },
          { icon: IndianRupee,  label: 'Revenue',         value: fmt(total),       color: 'text-green-500'   },
          { icon: CheckCircle2, label: 'Paid',            value: paid,             color: 'text-emerald-500' },
          { icon: Clock,        label: 'Pending payment', value: pending,          color: 'text-yellow-500'  },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <s.icon className={`h-4 w-4 ${s.color} mb-2`} />
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      {!campaigns.length ? (
        <p className="text-sm text-muted-foreground text-center py-10">No campaigns yet.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>{['Brand', 'Contact', 'Screens', 'Amount', 'Status', 'Date', ''].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((c) => {
                const isPaid = c.paymentId && c.paymentId !== 'pending';
                return (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{c.brandName || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground"><p>{c.contactName}</p><p className="text-[10px] text-muted-foreground/60">{c.email}</p></td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.screens} × {c.months}mo</td>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{fmt(c.totalAmount ?? 0)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${isPaid ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
                        {isPaid ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                        {isPaid ? 'Paid' : 'Pay later'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground/60 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void deleteCampaign(c.id, c.brandName || c.contactName || 'this campaign')}
                        disabled={deleting === c.id}
                        className="flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        {deleting === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    </td>
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

// ─── Overview / Dashboard ────────────────────────────────────────────────────

function OverviewPanel({ onNav }: { onNav: (t: Tab) => void }) {
  const quickActions: { label: string; sub: string; tab: Tab; icon: React.ElementType; color: string }[] = [
    { label: 'Screens',    sub: 'View fleet status',       tab: 'screens',    icon: Tv2,          color: 'bg-blue-500/10 text-blue-600'    },
    { label: 'Content',    sub: 'Upload media',            tab: 'content',    icon: ImageIcon,    color: 'bg-purple-500/10 text-purple-600' },
    { label: 'Playlists',  sub: 'Build playlists',         tab: 'playlists',  icon: ListVideo,    color: 'bg-indigo-500/10 text-indigo-600' },
    { label: 'Schedules',  sub: 'Push to screens',         tab: 'schedules',  icon: CalendarClock,color: 'bg-orange-500/10 text-orange-600' },
    { label: 'Reports',    sub: 'Proof of play',           tab: 'reports',    icon: FileBarChart2,color: 'bg-green-500/10 text-green-600'   },
    { label: 'Monitoring', sub: 'Live heartbeat grid',     tab: 'monitoring', icon: Activity,     color: 'bg-red-500/10 text-red-600'       },
  ];

  const platformFeatures = [
    { label: 'Schedule priority',       status: 'planned',  desc: 'Higher-priority schedules override lower ones (Xibo-style)' },
    { label: 'POP audit hash chain',    status: 'planned',  desc: 'Tamper-evident SHA-256 chain on play_events for billing integrity' },
    { label: 'Hourly POP aggregation',  status: 'planned',  desc: 'Pre-aggregate plays/hour per device for fast billing queries' },
    { label: 'Audience impressions',    status: 'planned',  desc: 'Cost-per-play and impressions model (Xibo Audience Reporting)' },
    { label: 'MD5 content integrity',   status: 'live',     desc: 'Player verifies MD5 before skipping re-download' },
    { label: 'Group-based scheduling',  status: 'live',     desc: 'Assign schedules to store groups, not individual screens' },
    { label: '72-hour plan polling',    status: 'live',     desc: 'Xibo-style offline-safe plan window for Android player' },
    { label: 'Referral attribution',    status: 'live',     desc: 'tag field on play_events traces campaign → brand' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">System operational</p>
        </div>
        <h2 className="text-2xl font-bold text-foreground">ALIVE Admin Console</h2>
        <p className="text-sm text-muted-foreground mt-1">Kirana store digital advertising network · Mangaluru, Karnataka</p>
      </div>

      {/* Quick-access grid */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Quick access</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickActions.map((a) => (
            <button key={a.tab} onClick={() => onNav(a.tab)}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:bg-primary/5 transition-all group">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.color}`}>
                <a.icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{a.label}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">{a.sub}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors ml-auto shrink-0 mt-0.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Platform features roadmap — Xibo/Screenly-inspired */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Platform features</p>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Feature</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {platformFeatures.map((f) => (
                <tr key={f.label} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">{f.label}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      f.status === 'live' ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-700'
                    }`}>
                      {f.status === 'live' ? '● Live' : '○ Planned'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground/70 hidden sm:table-cell">{f.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar Nav ──────────────────────────────────────────────────────────────

function SidebarNav({
  tab, onTab, onSignOut,
}: {
  tab: Tab; onTab: (t: Tab) => void; onSignOut: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border/50">
        <a href="/" className="opacity-80 hover:opacity-100 transition-opacity block">
          <Logo />
        </a>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mt-2">Admin Console</p>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV.map((group) => (
          <div key={group.group}>
            <p className="px-2 mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">{group.group}</p>
            {group.items.map((item) => {
              const Icon    = item.icon;
              const active  = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTab(item.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                  {active && <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-70" />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-border/50">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Password gate ────────────────────────────────────────────────────────────

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [pw,   setPw]   = useState('');
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res  = await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      const body = await res.json() as { ok: boolean };
      if (body.ok) { sessionStorage.setItem('alive_admin', '1'); sessionStorage.setItem(SS_PW, pw); onAuth(); }
      else setErr('Incorrect password.');
    } catch { setErr('Failed to verify.'); }
    finally   { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity inline-block mb-8"><Logo /></a>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-1">Admin</p>
          <h1 className="text-3xl font-bold text-foreground">Enter password</h1>
          <p className="text-sm text-muted-foreground mt-1">Restricted to Alive staff.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input type="password" required autoFocus value={pw} onChange={(e) => setPw(e.target.value)}
            placeholder="Admin password"
            className="w-full h-12 rounded-xl border border-border bg-card px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
          {err && <p className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">{err}</p>}
          <button type="submit" disabled={busy || !pw}
            className="w-full h-11 rounded-xl bg-primary text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enter dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function Dashboard() {
  const [tab,        setTab]        = useState<Tab>('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminPw,    setAdminPw]    = useState('');
  const meta = PAGE_META[tab];

  useEffect(() => {
    setAdminPw(sessionStorage.getItem(SS_PW) ?? '');
  }, []);

  const signOut = () => {
    sessionStorage.removeItem('alive_admin');
    sessionStorage.removeItem(SS_PW);
    window.location.reload();
  };

  const handleNav = (t: Tab) => {
    setTab(t);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border/50 bg-card/50 sticky top-0 h-screen overflow-hidden">
        <SidebarNav tab={tab} onTab={handleNav} onSignOut={signOut} />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -224 }} animate={{ x: 0 }} exit={{ x: -224 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 h-full w-56 bg-card border-r border-border/50 lg:hidden flex flex-col"
            >
              <SidebarNav tab={tab} onTab={handleNav} onSignOut={signOut} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar (mobile + breadcrumb) */}
        <header className="sticky top-0 z-30 border-b border-border/30 bg-background/95 backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
              <span className="hidden sm:inline font-semibold text-foreground">Admin</span>
              <ChevronRight className="h-3.5 w-3.5 hidden sm:block shrink-0" />
              <span className="truncate font-semibold text-foreground">{meta.title}</span>
            </div>

            {/* Desktop logo (sidebar not visible on md) */}
            <a href="/" className="ml-auto opacity-60 hover:opacity-100 transition-opacity lg:hidden">
              <Logo />
            </a>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 py-6 max-w-5xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Page heading */}
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{meta.eyebrow}</p>
                <h1 className="text-2xl font-bold text-foreground">{meta.title}</h1>
              </div>

              {/* Tab content */}
              {tab === 'overview'   && <OverviewPanel onNav={handleNav} />}
              {tab === 'flyers'     && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <UploadPanel onSaved={() => setRefreshKey((k) => k + 1)} />
                  <div className="space-y-4">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live flyers</h2>
                    <FlyersList refresh={refreshKey} />
                  </div>
                </div>
              )}
              {tab === 'stores'     && <StoresPanel />}
              {tab === 'campaigns'  && <CampaignsPanel />}
              {tab === 'payments'   && <StorePaymentsTab adminPassword={adminPw} />}
              {tab === 'screens'    && <ScreensTab />}
              {tab === 'content'    && <ContentTab />}
              {tab === 'playlists'  && <PlaylistsTab />}
              {tab === 'schedules'  && <SchedulesTab />}
              {tab === 'reports'    && <ReportsTab />}
              {tab === 'monitoring' && <MonitoringTab />}
              {tab === 'media'      && <SiteMediaTab adminPassword={adminPw} />}
              {tab === 'roadmap'    && <RoadmapTab />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ─── Root export ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const ok = sessionStorage.getItem('alive_admin') === '1';
    setAuthed(ok);
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />;
  return <Dashboard />;
}
