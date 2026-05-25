'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Trash2, Upload, ImageIcon, Store, BarChart3, FileImage,
  Phone, MapPin, CheckCircle2, Clock, X, MessageCircle, ExternalLink,
  IndianRupee, Eye, Package,
  Tv2, ListVideo, CalendarClock, FileBarChart2, Activity,
  Menu, ChevronRight, LogOut, LayoutDashboard, Images, Map, Layers,
  // New icons for the redesign
  Play, Trophy, MonitorPlay, PlayCircle, TrendingUp, Users,
  Search, Bell, Moon, Sun, LifeBuoy, Download, Plus, ArrowRight,
  ArrowUpRight, Settings2, Megaphone, Image, MoreHorizontal,
  RefreshCw, Filter, ChevronLeft, ChevronDown,
  TriangleAlert, CheckCircle,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import './admin.css';

const ScreensTab      = dynamic(() => import('@/components/admin/screens-tab'),       { ssr: false });
const ReportsTab      = dynamic(() => import('@/components/admin/reports-tab'),       { ssr: false });
const ContentTab      = dynamic(() => import('@/components/admin/content-tab'),       { ssr: false });
const PlaylistsTab    = dynamic(() => import('@/components/admin/playlists-tab'),     { ssr: false });
const SchedulesTab    = dynamic(() => import('@/components/admin/schedules-tab'),     { ssr: false });
const LayoutsTab      = dynamic(() => import('@/components/admin/layouts-tab'),       { ssr: false });
const MonitoringTab   = dynamic(() => import('@/components/admin/monitoring-tab'),   { ssr: false });
const StorePaymentsTab = dynamic(() => import('@/components/admin/store-payments-tab'), { ssr: false });
const SiteMediaTab     = dynamic(() => import('@/components/admin/site-media-tab'),     { ssr: false });
const RoadmapTab       = dynamic(() => import('@/components/admin/roadmap-tab'),        { ssr: false });
const ProductsTab      = dynamic(() => import('@/components/admin/products-tab'),       { ssr: false });
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
  onboardingStage?: string | null; payoutStatus?: string | null; payoutMethod?: string | null; upiId?: string | null;
  bankAccountName?: string; bankAccountNo?: string; bankIfsc?: string; bankName?: string;
  payoutLastPaidAt?: string | null; payoutNotes?: string | null;
  referralCode?: string; referredBy?: string | null; agreedAt?: string | null; liveAt?: string | null;
  deviceCount?: number;
};
type Campaign = {
  id: string; brandId: string | null; brandName: string; contactName: string; email: string;
  phone: string; screens: number; months: number; startDate: string;
  pricePerScreen: number; totalAmount: number; paymentId: string;
  status: 'upcoming' | 'active' | 'completed' | 'trial'; createdAt: string;
  trialOfferedAt: string | null; trialUsedAt: string | null;
};

// ─── Nav config ──────────────────────────────────────────────────────────────

type Tab = 'overview' | 'flyers' | 'stores' | 'campaigns' | 'payments' | 'screens' | 'content' | 'playlists' | 'schedules' | 'layouts' | 'reports' | 'monitoring' | 'media' | 'roadmap' | 'products';

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
      { id: 'products',   label: 'Products',    icon: Package     },
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
      { id: 'layouts',    label: 'Layouts',     icon: Layers       },
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
  layouts:    { eyebrow: 'On-screen overlays', title: 'Layouts & tickers'  },
  reports:    { eyebrow: 'Proof of play',      title: 'Play reports'       },
  monitoring: { eyebrow: 'Live network',       title: 'Monitoring'         },
  media:      { eyebrow: 'Site management',    title: 'Homepage media'     },
  products:   { eyebrow: 'Product catalogue',  title: 'Master Products'    },
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
    const img = document.createElement('img') as HTMLImageElement;
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

const STAGE_LABELS: Record<string, string> = {
  new: 'New', physically_onboarded: 'Physically onboarded',
  digitally_onboarded: 'Digitally onboarded', live: 'Live', rejected: 'Rejected',
};
const STAGE_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-600', physically_onboarded: 'bg-blue-50 text-blue-600',
  digitally_onboarded: 'bg-indigo-50 text-indigo-600', live: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-500',
};

function openAsPartner(s: StoreReg) {
  const session = {
    storeName: s.storeName, ownerName: s.ownerName,
    whatsapp: s.whatsapp, phone: s.phone || s.whatsapp,
    address: s.address, locality: s.locality, city: s.city, pincode: s.pincode,
    lat: s.lat, lng: s.lng, gstin: s.gstin || null,
    referralCode: s.referralCode, referredBy: s.referredBy || null,
    agreedAt: s.agreedAt || null, liveAt: s.liveAt || null,
    upiId: s.upiId || null, payoutMethod: s.payoutMethod || null,
    id: s.id,
  };
  localStorage.setItem('alive_store_session', JSON.stringify(session));
  window.open('/store-dashboard', '_blank');
}

function StoresPanel() {
  const [stores,   setStores]   = useState<StoreReg[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving,   setSaving]   = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    const pw = sessionStorage.getItem(SS_PW) ?? '';
    fetch('/api/stores/save', { headers: { 'admin-password': pw } })
      .then((r) => r.json())
      .then((body) => {
        const arr = Array.isArray(body) ? body : (body?.data ?? []);
        setStores(arr as StoreReg[]);
      })
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveStore = async (store: StoreReg) => {
    setSaving(store.id);
    try {
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
    } finally { setSaving(null); }
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

  const patchLocal = (id: string, patch: Partial<StoreReg>) =>
    setStores((all) => all.map((x) => x.id === id ? { ...x, ...patch } : x));

  const filtered = stores.filter((s) =>
    !search ||
    s.storeName.toLowerCase().includes(search.toLowerCase()) ||
    (s.ownerName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.phone ?? '').includes(search) || (s.whatsapp ?? '').includes(search) ||
    (s.referralCode ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const live     = stores.filter((s) => s.onboardingStage === 'live').length;
  const pending  = stores.filter((s) => !s.onboardingStage || s.onboardingStage === 'new').length;
  const screened = stores.filter((s) => (s.deviceCount ?? 0) > 0).length;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Registered',  value: stores.length },
          { label: 'Live',        value: live },
          { label: 'Pending',     value: pending },
          { label: 'With screen', value: screened },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <input type="search" placeholder="Search by name, owner, city, phone, referral code…" value={search} onChange={(e) => setSearch(e.target.value)} className={inp} />

      {!filtered.length ? (
        <p className="text-sm text-muted-foreground text-center py-10">{search ? 'No stores match.' : 'No store registrations yet.'}</p>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
          {filtered.map((s) => {
            const stage      = s.onboardingStage ?? 'new';
            const isRejected = stage === 'rejected';
            const isExpanded = expanded === s.id;
            const phone      = s.phone || s.whatsapp;
            const waNum      = (phone ?? '').replace(/\D/g, '').slice(-10);
            return (
              <motion.div key={s.id} variants={fadeIn} className={`rounded-xl border bg-card ${isRejected ? 'border-red-200 opacity-70' : 'border-border'}`}>
                {/* Top row — always visible */}
                <div className="flex items-start gap-3 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${isRejected ? 'bg-red-50 text-red-400' : 'bg-primary/10 text-primary'}`}>
                    {s.storeName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{s.storeName}</p>
                        <p className="text-xs text-muted-foreground">{s.ownerName}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STAGE_LABELS[stage] ?? stage}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(s.deviceCount ?? 0) > 0 ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                          {s.deviceCount ?? 0} screen{(s.deviceCount ?? 0) !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">{fmtDate(s.createdAt)}</span>
                      </div>
                    </div>

                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{phone ? `+91 ${waNum}` : '—'}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[s.locality, s.city].filter(Boolean).join(', ') || '—'}</span>
                      {s.referralCode && <span className="flex items-center gap-1 font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">ref: {s.referralCode}</span>}
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {waNum.length === 10 && (
                        <a
                          href={`https://wa.me/91${waNum}?text=${encodeURIComponent(`Hi ${s.ownerName}, this is the ALIVE team regarding your store ${s.storeName}.`)}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/8 px-2.5 py-1.5 text-[11px] font-semibold text-[#25D366] hover:bg-[#25D366]/15 transition-colors"
                        >
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => openAsPartner(s)}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> View dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : s.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? 'Less' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteStore(s.id, s.storeName)}
                        disabled={deleting === s.id}
                        className="ml-auto flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        {deleting === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {s.address && <span><span className="font-semibold text-foreground/60">Address:</span> {s.address}, {s.pincode}</span>}
                      {s.gstin   && <span><span className="font-semibold text-foreground/60">GST:</span> {s.gstin}</span>}
                      {s.email   && <span><span className="font-semibold text-foreground/60">Email:</span> {s.email}</span>}
                      {s.upiId   && <span><span className="font-semibold text-foreground/60">UPI:</span> {s.upiId}</span>}
                      {s.referredBy && <span><span className="font-semibold text-foreground/60">Referred by:</span> {s.referredBy}</span>}
                      {s.liveAt  && <span><span className="font-semibold text-foreground/60">Live since:</span> {fmtDate(s.liveAt)}</span>}
                      {s.agreedAt && <span><span className="font-semibold text-foreground/60">Agreed:</span> {fmtDate(s.agreedAt)}</span>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <select value={s.onboardingStage ?? 'new'} onChange={(e) => patchLocal(s.id, { onboardingStage: e.target.value })} className={inp}>
                        <option value="new">New</option>
                        <option value="physically_onboarded">Physically onboarded</option>
                        <option value="digitally_onboarded">Digitally onboarded</option>
                        <option value="live">Live</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <select value={s.payoutStatus ?? 'pending_setup'} onChange={(e) => patchLocal(s.id, { payoutStatus: e.target.value })} className={inp}>
                        <option value="pending_setup">Payout setup pending</option>
                        <option value="ready">Ready for payout</option>
                        <option value="paid">Paid</option>
                        <option value="on_hold">On hold</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input value={s.payoutNotes ?? ''} onChange={(e) => patchLocal(s.id, { payoutNotes: e.target.value })} placeholder="Notes (rejection reason, payout notes…)" className={`${inp} flex-1`} />
                      <button type="button" disabled={saving === s.id} onClick={() => void saveStore(s)} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
                        {saving === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
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
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [deleting,     setDeleting]     = useState<string | null>(null);
  const [offeringTrial, setOfferingTrial] = useState<string | null>(null);

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

  const offerTrial = async (brandId: string, brandName: string) => {
    if (!confirm(`Offer a free 1-month trial to "${brandName}"? They'll be notified via WhatsApp and email.`)) return;
    setOfferingTrial(brandId);
    try {
      const pw  = sessionStorage.getItem(SS_PW) ?? '';
      const res = await fetch(`/api/admin/brands/${brandId}/offer-trial`, { method: 'POST', headers: { 'admin-password': pw } });
      const b   = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { alert(b.error ?? 'Failed to offer trial'); return; }
      setCampaigns((all) => all.map((c) => c.brandId === brandId ? { ...c, trialOfferedAt: new Date().toISOString() } : c));
    } finally { setOfferingTrial(null); }
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
              <tr>{['Brand', 'Contact', 'Screens', 'Amount', 'Status', 'Date', 'Trial', ''].map((h) => (
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.trialOfferedAt ? (
                        <span className="text-[10px] text-muted-foreground/60">Offered {fmtDate(c.trialOfferedAt)}</span>
                      ) : c.brandId ? (
                        <button
                          type="button"
                          onClick={() => void offerTrial(c.brandId!, c.brandName)}
                          disabled={offeringTrial === c.brandId}
                          className="flex items-center gap-1 rounded-lg border border-green-200 px-2 py-1 text-[11px] font-medium text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
                        >
                          {offeringTrial === c.brandId ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Offer trial'}
                        </button>
                      ) : <span className="text-[10px] text-muted-foreground/40">—</span>}
                    </td>
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

// ─── NEW DESIGN COMPONENTS ────────────────────────────────────────────────────

// Stats type for overview panel
type OpsStats = {
  screens:   { online: number; offline: number; pending: number; total: number };
  schedules: { active: number; total: number };
  content:   { count: number; totalMB: number };
  stores:    { total: number; live: number };
  campaigns: { total: number; paid: number };
};

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({ data, color = '#dc2626', w = 80, h = 28 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(...data), min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 2) + 1;
    const y = h - 2 - ((v - min) / span) * (h - 4);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${path} L${w - 1},${h - 1} L1,${h - 1} Z`;
  const last = pts[pts.length - 1];
  const gid = `sg-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="kpi__spark">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.22} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────

function SectionLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="sect-label">
      <span className="sect-label__n">N°{String(n).padStart(2, '0')}</span>
      <span className="sect-label__rule"></span>
      <span className="sect-label__txt">{label}</span>
    </div>
  );
}

// ─── DateRange ────────────────────────────────────────────────────────────────

function DateRange({ active, onChange }: { active: string; onChange: (v: string) => void }) {
  const segs = ['Today', '7d', '30d', 'Pilot', 'Custom'];
  return (
    <div className="range">
      {segs.map((s) => (
        <button key={s} className={`range__seg${active === s ? ' range__seg--active' : ''}`} onClick={() => onChange(s)}>{s}</button>
      ))}
    </div>
  );
}

// ─── Insight Banner ───────────────────────────────────────────────────────────

const INSIGHTS = [
  { eyebrow: 'AI · 14s ago', body: 'Plays in Attavar are 32% above forecast tonight. Two open evening slots on Suresh Stores could absorb a Britannia overflow.', cta: 'Auto-allocate' },
  { eyebrow: 'AI · anomaly', body: '2 screens went offline in Kadri Kambla 47 minutes ago. Field team has been dispatched; ETA 20 minutes.', cta: 'View ticket' },
  { eyebrow: 'AI · forecast', body: "You'll hit 1.78M plays by Sunday at the current pace — beating last week by 8.4%. Parle and Britannia leading the lift.", cta: 'Open report' },
  { eyebrow: 'AI · audience', body: 'Bejai shows 2.1× stock-velocity for Amul vs. control — recommend extending the Mangaluru wave by two weeks.', cta: 'Extend wave' },
];

function InsightBanner() {
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const cur = INSIGHTS[idx];
  return (
    <div className="insight">
      <div className="insight__glyph">
        <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
          <path d="M16 4 L18 12 L26 14 L18 16 L16 24 L14 16 L6 14 L14 12 Z" fill="currentColor" />
          <circle cx="24" cy="6" r="1.5" fill="currentColor" opacity={0.7} />
          <circle cx="8" cy="26" r="1" fill="currentColor" opacity={0.5} />
        </svg>
      </div>
      <div>
        <div className="insight__eyebrow">{cur.eyebrow}</div>
        <div className="insight__body">{cur.body}</div>
      </div>
      <div className="insight__actions">
        <div className="insight__dots">
          {INSIGHTS.map((_, k) => (
            <button key={k} className={`insight__dot${k === idx ? ' insight__dot--active' : ''}`} onClick={() => setIdx(k)} aria-label={`Insight ${k + 1}`}></button>
          ))}
        </div>
        <button className="btn btn--primary btn--sm">{cur.cta} <ArrowRight className="h-3 w-3" /></button>
        <button className="btn btn--ghost btn--sm" onClick={() => setIdx((idx + 1) % INSIGHTS.length)}><ChevronRight className="h-4 w-4" /></button>
        <button className="dot-menu" onClick={() => setDismissed(true)} aria-label="Dismiss"><X className="h-3 w-3" /></button>
      </div>
    </div>
  );
}

// ─── KPI Row ──────────────────────────────────────────────────────────────────

function KpiRow({ stats }: { stats: OpsStats | null }) {
  const liveCount = stats?.screens.online ?? 412;
  const totalScreens = stats?.screens.total ?? 438;
  const campaignsTotal = stats?.campaigns.total ?? 8;
  const storesLive = stats?.stores.live ?? 412;
  const storesTotal = stats?.stores.total ?? 438;

  const cards = [
    {
      label: 'Live screens', icon: <MonitorPlay className="h-4 w-4" />,
      value: liveCount.toLocaleString(), sub: `/ ${totalScreens}`,
      delta: '+14', up: true, period: 'this week',
      spark: [378, 382, 384, 388, 392, 396, 401, 404, 406, 408, 410, 411, 412, 412, 412],
      feature: false,
    },
    {
      label: 'Plays today', icon: <PlayCircle className="h-4 w-4" />,
      value: '47,328', sub: undefined,
      delta: '+8.4%', up: true, period: 'vs. yesterday',
      spark: [38, 42, 41, 47, 51, 49, 58, 62, 64, 68, 73, 78, 81, 84, 92],
      feature: true,
    },
    {
      label: 'Campaigns', icon: <Megaphone className="h-4 w-4" />,
      value: campaignsTotal.toString(), sub: undefined,
      delta: '+2', up: true, period: 'this month',
      spark: [3, 3, 4, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8],
      feature: false,
    },
    {
      label: 'Store partners', icon: <Store className="h-4 w-4" />,
      value: storesLive.toString(), sub: `/ ${storesTotal}`,
      delta: '+14', up: true, period: 'this month',
      spark: [340, 355, 365, 372, 380, 386, 392, 396, 400, 403, 406, 408, 410, 411, 412],
      feature: false,
    },
  ];

  return (
    <div className="kpi-row">
      {cards.map((k, i) => (
        <div key={i} className={`kpi${k.feature ? ' kpi--feature' : ''}`}>
          <div className="kpi__head">
            <span className="kpi__icon">{k.icon}</span>
            <span className="kpi__label">{k.label}</span>
            <button className="dot-menu kpi__menu"><MoreHorizontal className="h-3.5 w-3.5" /></button>
          </div>
          <div>
            <span className="kpi__value">{k.value}</span>
            {k.sub && <span className="kpi__value-sub">{k.sub}</span>}
          </div>
          <div className="kpi__foot">
            <div className="row" style={{ gap: 8 }}>
              <span className={`kpi__delta ${k.up ? 'kpi__delta--up' : 'kpi__delta--down'}`}>
                {k.up ? <ArrowUpRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {k.delta}
              </span>
              <span className="kpi__period">{k.period}</span>
            </div>
            <Sparkline data={k.spark} color={k.feature ? '#ffffff' : '#dc2626'} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Area Chart ───────────────────────────────────────────────────────────────

function smoothPath(pts: number[][]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const cx = (p0[0] + p1[0]) / 2;
    d += ` C${cx},${p0[1]} ${cx},${p1[1]} ${p1[0]},${p1[1]}`;
  }
  return d;
}

const CHART_SERIES: Record<string, { label: string; unit: string; data: number[][] }> = {
  plays: {
    label: 'Plays', unit: '',
    data: [
      [0,0,0,0,0,0,0, 980,1820,2640,3520,4280,4760,4480,4120,3920,3640,3480,3920,4640,3260,1480,0,0],
      [0,0,0,0,0,0,0, 880,1640,2410,3220,3940,4380,4120,3780,3580,3320,3180,3580,4240,2980,1340,0,0],
    ],
  },
  uplift: {
    label: 'Sales uplift %', unit: '%',
    data: [
      [16.2,17.0,17.4,17.9,18.3,18.7,19.0,19.3,19.6,19.8,20.0,20.2,20.3,20.4,20.5,20.5,20.5,20.6,20.5,20.4,20.4,20.4,20.4,20.4],
      [12.0,12.4,12.6,12.8,13.0,13.2,13.3,13.5,13.6,13.8,13.9,14.0,14.0,14.1,14.1,14.2,14.2,14.2,14.3,14.3,14.3,14.3,14.3,14.3],
    ],
  },
  recall: {
    label: 'Aided brand recall %', unit: '%',
    data: [
      [62,63,64,65,66,67,68,68,69,70,70,71,71,72,72,72,73,73,73,73,74,74,74,74],
      [28,28,28,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29],
    ],
  },
};

function AreaChart() {
  const [tab, setTab] = useState('plays');
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 720, H = 240, padL = 44, padR = 12, padT = 16, padB = 28;
  const series = CHART_SERIES[tab].data;
  const unit = CHART_SERIES[tab].unit;
  const allValues = series.flat();
  const max = Math.max(...allValues);
  const min = tab === 'plays' ? 0 : Math.min(...allValues) * 0.85;
  const span = max - min || 1;
  const xs = (i: number) => padL + (i / 23) * (W - padL - padR);
  const ys = (v: number) => padT + (1 - (v - min) / span) * (H - padT - padB);
  const buildPath = (arr: number[]) => arr.map((v, i) => [xs(i), ys(v)]);
  const p1 = buildPath(series[0]);
  const p2 = buildPath(series[1]);
  const line1 = smoothPath(p1);
  const line2 = smoothPath(p2);
  const area1 = line1 + ` L${xs(23)},${H - padB} L${xs(0)},${H - padB} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ y: padT + t * (H - padT - padB), v: max - t * span }));
  const hours = [0, 4, 8, 12, 16, 20];
  const fmt2 = (n: number) => {
    if (unit === '%') return Math.round(n) + '%';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return Math.round(n).toString();
  };
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((x - padL) / (W - padL - padR)) * 23);
    if (idx >= 0 && idx <= 23) setHover(idx);
  };
  const anomalies = tab === 'plays' ? [{ i: 19, label: '+32% vs forecast' }] : tab === 'uplift' ? [{ i: 17, label: 'Bejai peak' }] : [];

  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3 className="card__title">Network performance</h3>
          <p className="card__sub">Last 24 hours · 412 screens · 7 AM – 9 PM</p>
        </div>
        <div className="card__actions">
          <div className="tabs">
            <button className={tab === 'plays' ? 'active' : ''} onClick={() => setTab('plays')}>Plays</button>
            <button className={tab === 'uplift' ? 'active' : ''} onClick={() => setTab('uplift')}>Sales uplift</button>
            <button className={tab === 'recall' ? 'active' : ''} onClick={() => setTab('recall')}>Recall</button>
          </div>
          <button className="dot-menu"><MoreHorizontal className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="chart">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="aFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#dc2626" stopOpacity={0.22} />
              <stop offset="1" stopColor="#dc2626" stopOpacity={0} />
            </linearGradient>
          </defs>
          {grid.map((g, i) => (
            <g key={i}>
              <line x1={padL} y1={g.y} x2={W - padR} y2={g.y} stroke="var(--hairline)" strokeDasharray="3 3" />
              <text x={padL - 8} y={g.y + 4} fontSize="10" fill="var(--ink-4)" textAnchor="end" style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(g.v)}</text>
            </g>
          ))}
          {tab === 'plays' && (
            <rect x={xs(7)} y={padT} width={xs(21) - xs(7)} height={H - padT - padB} fill="rgba(220,38,38,.025)" />
          )}
          {hours.map((h) => (
            <text key={h} x={xs(h)} y={H - 8} fontSize="10" fill="var(--ink-4)" textAnchor="middle" style={{ fontFamily: 'var(--font-mono)' }}>
              {String(h).padStart(2, '0')}:00
            </text>
          ))}
          <path d={line2} fill="none" stroke="var(--ink-4)" strokeWidth="1.5" strokeDasharray="4 4" opacity={0.8} />
          <path d={area1} fill="url(#aFill)" />
          <path d={line1} fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {anomalies.map((a, idx2) => (
            <g key={idx2}>
              <line x1={xs(a.i)} y1={padT} x2={xs(a.i)} y2={ys(series[0][a.i])} stroke="#dc2626" strokeWidth="1" strokeDasharray="2 3" opacity={0.5} />
              <circle cx={xs(a.i)} cy={ys(series[0][a.i])} r="6" fill="none" stroke="#dc2626" strokeWidth="1.5" />
              <circle cx={xs(a.i)} cy={ys(series[0][a.i])} r="3" fill="#dc2626" />
              <text x={xs(a.i) + 10} y={ys(series[0][a.i]) - 6} className="anomaly-flag">{a.label}</text>
            </g>
          ))}
          {hover != null && (
            <g>
              <line x1={xs(hover)} y1={padT} x2={xs(hover)} y2={H - padB} stroke="#dc2626" strokeOpacity={0.25} strokeDasharray="3 3" />
              <circle cx={xs(hover)} cy={ys(series[0][hover])} r="4" fill="#fff" stroke="#dc2626" strokeWidth="2" />
              <g transform={`translate(${xs(hover) + 8}, ${ys(series[0][hover]) - 32})`}>
                <rect x="0" y="0" width="108" height="28" rx="5" fill="#0a0a0a" />
                <text x="8" y="11" fontSize="9.5" fill="#a3a3a3" style={{ fontFamily: 'var(--font-mono)' }}>{String(hover).padStart(2, '0')}:00 today</text>
                <text x="8" y="22" fontSize="11" fontWeight="600" fill="#fff" style={{ fontFamily: 'var(--font-mono)' }}>{fmt2(series[0][hover])} {CHART_SERIES[tab].label.toLowerCase()}</text>
              </g>
            </g>
          )}
        </svg>
      </div>
      <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <div className="chart__legend">
          <span className="chart__legend-item"><span className="chart__legend-dot" style={{ background: '#dc2626' }}></span> Today</span>
          <span className="chart__legend-item"><span className="chart__legend-dot" style={{ background: 'var(--ink-4)' }}></span> Same day last week</span>
          {tab === 'plays' && <span className="chart__legend-item"><span className="chart__legend-dot" style={{ background: 'rgba(220,38,38,.18)', borderRadius: 2 }}></span> Operating hours</span>}
        </div>
        <span className="muted" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '.04em' }}>refreshes 30s · 14s ago</span>
      </div>
    </div>
  );
}

// ─── Live Feed Card ───────────────────────────────────────────────────────────

const LIVE_SCREENS = [
  { name: 'Suresh Stores',     area: 'Attavar',      owner: 'Suresh K.',      status: 'live',    plays: 138, brand: 'Parle' },
  { name: 'Ganesh Provisions', area: 'Bejai',         owner: 'Ganesh R.',      status: 'live',    plays: 134, brand: 'Britannia' },
  { name: 'Lakshmi General',   area: 'Kadri',         owner: 'Lakshmi B.',     status: 'live',    plays: 131, brand: 'Amul' },
  { name: 'Manjunath Stores',  area: 'Falnir',        owner: 'Manjunath S.',   status: 'live',    plays: 128, brand: 'Dabur' },
  { name: 'Shenoy Stores',     area: 'Balmatta',      owner: 'Anand Shenoy',   status: 'live',    plays: 124, brand: 'Tata Salt' },
  { name: 'Mohan Provisions',  area: 'Kankanady',     owner: 'Mohan P.',       status: 'live',    plays: 119, brand: 'Marico' },
  { name: 'Sai Kirana',        area: 'Bunder',        owner: 'Vinod Sai',      status: 'idle',    plays: 48,  brand: '—' },
  { name: 'Prabhu General',    area: 'Hampankatta',   owner: 'Prabhu N.',      status: 'live',    plays: 114, brand: 'ITC' },
  { name: 'Tulsi Stores',      area: 'Mannagudda',    owner: 'Tulsi Devi',     status: 'live',    plays: 109, brand: 'Britannia' },
  { name: 'Bhat Provisions',   area: 'Kadri Kambla',  owner: 'Ramesh Bhat',    status: 'offline', plays: 0,   brand: '—' },
];

function LiveFeedCard() {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? LIVE_SCREENS : LIVE_SCREENS.filter((s) => s.status === filter);
  const liveCount = LIVE_SCREENS.filter((s) => s.status === 'live').length;
  const idleCount = LIVE_SCREENS.filter((s) => s.status === 'idle').length;
  const offlineCount = LIVE_SCREENS.filter((s) => s.status === 'offline').length;

  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3 className="card__title">Live screens · Mangaluru</h3>
          <p className="card__sub">Top by plays · last 60 min</p>
        </div>
        <button className="dot-menu"><RefreshCw className="h-3.5 w-3.5" /></button>
      </div>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`chip${filter === 'all' ? ' chip--active' : ''}`} onClick={() => setFilter('all')}>All · {LIVE_SCREENS.length}</button>
        <button className={`chip${filter === 'live' ? ' chip--active' : ''}`} onClick={() => setFilter('live')}>Live · {liveCount}</button>
        <button className={`chip${filter === 'idle' ? ' chip--active' : ''}`} onClick={() => setFilter('idle')}>Idle · {idleCount}</button>
        <button className={`chip${filter === 'offline' ? ' chip--active' : ''}`} onClick={() => setFilter('offline')}>Offline · {offlineCount}</button>
      </div>
      <div className="feed">
        {filtered.map((s, i) => (
          <div key={i} className="feed-item">
            <span className={`feed-item__dot feed-item__dot--${s.status}`}></span>
            <div className="feed-item__main">
              <div className="feed-item__name">{s.name} <span className="feed-item__area">· {s.area}</span></div>
              <div className="feed-item__sub">{s.owner} · now playing <strong style={{ color: 'var(--ink)' }}>{s.brand}</strong></div>
            </div>
            <div>
              <div className="feed-item__val">{s.plays}</div>
              <div className="feed-item__val-sub">plays · today</div>
            </div>
          </div>
        ))}
      </div>
      <div className="divider"></div>
      <button className="btn btn--ghost btn--sm" style={{ width: '100%' }}>
        View all 438 stores <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Goals Card (Progress Rings) ──────────────────────────────────────────────

function ProgressRing({ value, label, valueLabel, color = '#dc2626', size = 110 }: {
  value: number; label: string; valueLabel: string; color?: string; size?: number;
}) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div className="ring">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--neutral-100)" strokeWidth="6" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          style={{ font: '600 22px var(--font-display)', letterSpacing: '-0.025em', fill: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
          {value}%
        </text>
      </svg>
      <div className="ring__label">{label}</div>
      <div className="ring__sub">{valueLabel}</div>
    </div>
  );
}

function GoalsCard({ stats }: { stats: OpsStats | null }) {
  const screensLive = stats?.screens.online ?? 412;
  const screensTotal = stats?.screens.total ?? 438;
  const screensPct = screensTotal > 0 ? Math.round((screensLive / screensTotal) * 100) : 94;
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3 className="card__title">Pilot benchmarks</h3>
          <p className="card__sub">412 stores · 6 categories · 12-week window</p>
        </div>
        <button className="btn btn--ghost btn--sm">Adjust targets <Settings2 className="h-3 w-3" /></button>
      </div>
      <div className="rings">
        <ProgressRing value={screensPct} label="Screens live" valueLabel={`${screensLive} / ${screensTotal}`} />
        <ProgressRing value={68} label="Sales uplift" valueLabel="20.4% / 30%" />
        <ProgressRing value={74} label="Aided recall" valueLabel="74% / 100%" />
        <ProgressRing value={86} label="Slot fill" valueLabel="86% sold-through" />
      </div>
    </div>
  );
}

// ─── Brand Accounts Card ──────────────────────────────────────────────────────

const BRANDS = [
  { name: 'Parle',         logo: 'P', color: '#1e40af', campaigns: 3, spend: '₹3.8L', uplift: '+24%', screens: 386 },
  { name: 'Britannia',     logo: 'B', color: '#b91c1c', campaigns: 2, spend: '₹2.9L', uplift: '+21%', screens: 312 },
  { name: 'Amul',          logo: 'A', color: '#dc2626', campaigns: 2, spend: '₹2.6L', uplift: '+19%', screens: 298 },
  { name: 'Dabur',         logo: 'D', color: '#dc2626', campaigns: 2, spend: '₹2.1L', uplift: '+18%', screens: 244 },
  { name: 'ITC',           logo: 'I', color: '#0a0a0a', campaigns: 1, spend: '₹1.8L', uplift: '+16%', screens: 218 },
  { name: 'Tata Consumer', logo: 'T', color: '#1d4ed8', campaigns: 1, spend: '₹1.4L', uplift: '+14%', screens: 184 },
  { name: 'Marico',        logo: 'M', color: '#16a34a', campaigns: 1, spend: '₹1.2L', uplift: '+12%', screens: 156 },
  { name: 'Nestlé',        logo: 'N', color: '#ca8a04', campaigns: 1, spend: '₹98k',  uplift: '+11%', screens: 142 },
];

function BrandAccountsCard() {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3 className="card__title">Brand accounts</h3>
          <p className="card__sub">Top spenders this month · ranked by MTD spend</p>
        </div>
        <button className="btn btn--ghost btn--sm">All brands <ArrowRight className="h-3 w-3" /></button>
      </div>
      <div className="brands-grid">
        {BRANDS.map((b, i) => (
          <button key={i} className="brand-card">
            <div className="brand-card__head">
              <div className="brand-card__logo" style={{ background: b.color }}>{b.logo}</div>
              <div>
                <div className="brand-card__name">{b.name}</div>
                <div className="brand-card__sub">{b.campaigns} live · {b.screens} screens</div>
              </div>
            </div>
            <div className="brand-card__stats">
              <div>
                <div className="brand-card__stat-label">Spend MTD</div>
                <div className="brand-card__stat-val">{b.spend}</div>
              </div>
              <div>
                <div className="brand-card__stat-label">Uplift</div>
                <div className="brand-card__stat-val" style={{ color: '#16a34a' }}>{b.uplift}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Ticker ───────────────────────────────────────────────────────────────────

const TICKER_ITEMS = [
  { red: 'LIVE',   text: 'Parle-G Monsoon Bites playing across 386 screens · Mangaluru' },
  { red: '+24%',   text: 'Sales uplift detected in Attavar cluster · last 72h' },
  { red: 'ALERT',  text: '2 screens offline · Kadri Kambla · field team dispatched' },
  { red: 'PAYOUT', text: '₹64,200 released to 84 kirana partners via UPI' },
  { red: 'NEW',    text: 'Hegde Kirana, Yeyyadi onboarded — pilot reaches 412' },
  { red: 'AI',     text: 'Britannia recommended for two open evening slots tonight' },
  { red: 'RECALL', text: '74% aided brand recall · vs 29% on print & OOH' },
];

function Ticker() {
  return (
    <div className="ticker">
      <div className="ticker__pill">Live wire</div>
      <div className="ticker__track">
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
          <span key={i} className="ticker__item">
            <span className="ticker__red">{t.red}</span>
            <span>{t.text}</span>
            <span className="ticker__dot">●</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Command Palette ──────────────────────────────────────────────────────────

const PALETTE_GROUPS = [
  {
    label: 'Pages',
    items: [
      { icon: LayoutDashboard, label: 'Go to Overview',        hint: 'G then O' },
      { icon: Megaphone,       label: 'Go to Campaigns',       hint: 'G then C' },
      { icon: Store,           label: 'Go to Kirana partners', hint: 'G then K' },
      { icon: IndianRupee,     label: 'Go to Payouts',         hint: 'G then P' },
    ],
  },
  {
    label: 'Actions',
    items: [
      { icon: Plus,        label: 'New campaign',              hint: '⌘N' },
      { icon: Upload,      label: 'Upload 8-second creative',  hint: '⌘U' },
      { icon: Store,       label: 'Onboard a kirana',          hint: '⌘⇧K' },
      { icon: IndianRupee, label: 'Release May payouts',       hint: undefined },
    ],
  },
  {
    label: 'Recent',
    items: [
      { icon: Megaphone, label: 'Campaign · Parle-G Monsoon Bites', hint: undefined },
      { icon: Image,     label: 'Creative · Good Day Wave 7',       hint: undefined },
      { icon: Store,     label: 'Store · Suresh Stores, Attavar',   hint: undefined },
    ],
  },
];

function CommandPalette({ open, onClose, onNav }: { open: boolean; onClose: () => void; onNav: (t: Tab) => void }) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const filter = (txt: string) => txt.toLowerCase().includes(q.toLowerCase());

  const tabMap: Record<string, Tab> = {
    'Go to Overview': 'overview',
    'Go to Campaigns': 'campaigns',
    'Go to Kirana partners': 'stores',
    'Go to Payouts': 'payments',
  };

  return (
    <div className="cmd__overlay" onClick={onClose}>
      <div className="cmd" onClick={(e) => e.stopPropagation()}>
        <div className="cmd__input">
          <Search className="h-4 w-4" style={{ color: 'var(--adm-muted)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search anything — campaigns, stores, brands, actions…"
          />
          <span className="tb__kbd">esc</span>
        </div>
        <div className="cmd__body">
          {PALETTE_GROUPS.map((g) => {
            const items = g.items.filter((it) => !q || filter(it.label));
            if (!items.length) return null;
            return (
              <div key={g.label} className="cmd__group">
                <div className="cmd__group-label">{g.label}</div>
                {items.map((it, k) => {
                  const IconComp = it.icon;
                  return (
                    <button key={k} className="cmd__item" onClick={() => {
                      if (tabMap[it.label]) onNav(tabMap[it.label]);
                      onClose();
                    }}>
                      <span className="cmd__item-icon"><IconComp className="h-3.5 w-3.5" /></span>
                      <span className="cmd__item-label">{it.label}</span>
                      {it.hint && <span className="cmd__item-hint">{it.hint}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="cmd__foot">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
          <span style={{ marginLeft: 'auto' }}>Alive Command · v4.12</span>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Drawer ─────────────────────────────────────────────────────

const NOTIFICATIONS = [
  { text: '2 screens offline in Kadri Kambla — auto-ticket #047 opened', time: '14 min', unread: true,  color: 'red'   },
  { text: 'Priya M. approved "Good Day Wave 7" for 312 screens',          time: '1 hr',   unread: true,  color: 'green' },
  { text: 'Parle-G Monsoon Bites is live across 386 screens',             time: '2 hr',   unread: true,  color: 'red'   },
  { text: '₹64,200 released to 84 kirana partners via UPI',               time: '5 hr',   unread: false, color: 'green' },
  { text: 'Network 027 firmware v4.12.0 deployed to all 412 screens',     time: '1d',     unread: false, color: ''      },
  { text: 'Pilot reached 412 stores · +20% lift confirmed by third-party',time: '2d',     unread: false, color: ''      },
];

function NotificationsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`drawer__scrim${open ? ' drawer__scrim--open' : ''}`} onClick={onClose}></div>
      <aside className={`drawer${open ? ' drawer--open' : ''}`}>
        <div className="drawer__head">
          <div>
            <h3 className="card__title">Notifications</h3>
            <p className="card__sub">{unread} unread · Network 027</p>
          </div>
          <button className="dot-menu" onClick={onClose}><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="drawer__tabs">
          <button className="active">All <span className="muted">{NOTIFICATIONS.length}</span></button>
          <button>Unread <span className="muted">{unread}</span></button>
          <button>Alerts</button>
          <button>System</button>
        </div>
        <div className="drawer__list">
          {NOTIFICATIONS.map((n, i) => (
            <div key={i} className={`drawer-item${n.unread ? ' drawer-item--unread' : ''}`}>
              <span className={`act-icon${n.color ? ` act-icon--${n.color}` : ''}`}>
                {n.color === 'red' ? <TriangleAlert className="h-3 w-3" /> : n.color === 'green' ? <CheckCircle className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
              </span>
              <div>
                <div className="drawer-item__text">{n.text}</div>
                <div className="drawer-item__time">{n.time} ago</div>
              </div>
              {n.unread && <span className="drawer-item__dot"></span>}
            </div>
          ))}
        </div>
        <div className="drawer__foot">
          <button className="btn btn--ghost btn--sm" style={{ width: '100%' }}>Mark all as read</button>
        </div>
      </aside>
    </>
  );
}

// ─── New Sidebar Nav ──────────────────────────────────────────────────────────

const NAV_DESIGN = [
  {
    group: null,
    items: [
      { id: 'overview' as Tab,   label: 'Overview',         icon: LayoutDashboard, count: null },
      { id: 'campaigns' as Tab,  label: 'Campaigns',        icon: Megaphone,       count: 8    },
      { id: 'content' as Tab,    label: 'Creatives',        icon: Image,           count: 4    },
      { id: 'schedules' as Tab,  label: 'Schedule',         icon: CalendarClock,   count: null },
    ],
  },
  {
    group: 'Network',
    items: [
      { id: 'stores' as Tab,     label: 'Kirana partners',  icon: Store,           count: 412  },
      { id: 'screens' as Tab,    label: 'Screens',          icon: Tv2,             count: null },
      { id: 'playlists' as Tab,  label: 'Playlists',        icon: ListVideo,       count: null },
      { id: 'monitoring' as Tab, label: 'Monitoring',       icon: Activity,        count: null },
    ],
  },
  {
    group: 'Finance',
    items: [
      { id: 'payments' as Tab,   label: 'Payouts',          icon: IndianRupee,     count: 412  },
      { id: 'reports' as Tab,    label: 'Reports',          icon: FileBarChart2,   count: null },
    ],
  },
  {
    group: 'Admin',
    items: [
      { id: 'flyers' as Tab,     label: 'Flyers',           icon: FileImage,       count: null },
      { id: 'layouts' as Tab,    label: 'Layouts',          icon: Layers,          count: null },
      { id: 'media' as Tab,      label: 'Media',            icon: Images,          count: null },
      { id: 'products' as Tab,   label: 'Products',         icon: Package,         count: null },
      { id: 'roadmap' as Tab,    label: 'Platform',         icon: Map,             count: null },
    ],
  },
];

function SidebarNav({ tab, onTab, onSignOut, liveCount }: {
  tab: Tab; onTab: (t: Tab) => void; onSignOut: () => void; liveCount: number;
}) {
  return (
    <aside className="sb">
      <div className="sb__logo">
        <span>alive</span>
        <span className="sb__logo-dot"></span>
        <span className="sb__logo-sub">Net · 027</span>
      </div>

      {NAV_DESIGN.map((section, si) => (
        <React.Fragment key={si}>
          {section.group && <div className="sb__group">{section.group}</div>}
          {section.items.map((item) => {
            const IconComp = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                className={`sb__item${active ? ' sb__item--active' : ''}`}
                onClick={() => onTab(item.id)}
              >
                <IconComp className="h-4 w-4" />
                <span>{item.label}</span>
                {item.count != null && <span className="sb__count">{item.count.toLocaleString()}</span>}
              </button>
            );
          })}
        </React.Fragment>
      ))}

      <div className="sb__bottom">
        <div className="sb__upgrade">
          <h4>Onboard a kirana</h4>
          <p>One screen. Zero investment. Live in 48 hours.</p>
          <button className="sb__upgrade-btn" onClick={() => onTab('stores')}>
            <Plus className="h-3 w-3" /> New partner
          </button>
        </div>
        <button className="sb__user" onClick={onSignOut} title="Sign out">
          <div className="sb__avatar">RV</div>
          <div className="sb__user-meta">
            <div className="sb__user-name">Rohan Varma</div>
            <div className="sb__user-role">Network Admin</div>
          </div>
          <LogOut className="h-3.5 w-3.5" style={{ color: 'var(--neutral-400)', marginLeft: 'auto' }} />
        </button>
      </div>
    </aside>
  );
}

// ─── New Topbar ───────────────────────────────────────────────────────────────

function Topbar({ section, liveCount, onOpenCmd, onOpenNotif, theme, setTheme, unread }: {
  section: string; liveCount: number; onOpenCmd: () => void; onOpenNotif: () => void;
  theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void; unread: number;
}) {
  const isDark = theme === 'dark';
  return (
    <header className="tb">
      <div className="tb__crumbs">
        <span>Network 027</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <strong>{section}</strong>
      </div>
      <button className="tb__search" onClick={onOpenCmd}>
        <Search className="h-3.5 w-3.5" />
        <span style={{ flex: 1, color: 'var(--neutral-400)', font: '400 13px var(--font-body)', textAlign: 'left' }}>
          Search stores, brands, campaigns, screens…
        </span>
        <span className="tb__kbd">⌘K</span>
      </button>
      <div className="tb__spacer"></div>
      <span className="live-pill">Live · {liveCount} screens</span>
      <div className="tb__divider"></div>
      <button className="tb__icon-btn" title="Network status"><Activity className="h-4 w-4" /></button>
      <button
        className={`tb__icon-btn${unread > 0 ? ' tb__icon-btn--dot' : ''}`}
        title="Notifications"
        onClick={onOpenNotif}
      >
        <Bell className="h-4 w-4" />
      </button>
      <button
        className="tb__icon-btn"
        title={isDark ? 'Light mode' : 'Dark mode'}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <button className="tb__icon-btn" title="Help"><LifeBuoy className="h-4 w-4" /></button>
      <div className="tb__divider"></div>
      <button className="btn btn--outline btn--sm"><Download className="h-3 w-3" /> Export</button>
      <button className="btn btn--primary btn--sm"><Plus className="h-3 w-3" /> New Campaign</button>
    </header>
  );
}

// ─── Overview Panel ───────────────────────────────────────────────────────────

function OverviewPanel({ onNav }: { onNav: (t: Tab) => void }) {
  const [stats,   setStats]   = useState<OpsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range,   setRange]   = useState('7d');

  useEffect(() => {
    const pw = sessionStorage.getItem(SS_PW) ?? '';
    const h  = { 'admin-password': pw };
    const now = new Date().toISOString();
    Promise.all([
      fetch('/api/devices',       { headers: h }).then((r) => r.ok ? r.json() : { devices: [] }),
      fetch('/api/schedules',     { headers: h }).then((r) => r.ok ? r.json() : { schedules: [] }),
      fetch('/api/content',       { headers: h }).then((r) => r.ok ? r.json() : { content: [], totalBytes: 0 }),
      fetch('/api/stores/save',   { headers: h }).then((r) => r.ok ? r.json() : []),
      fetch('/api/campaigns/admin',{ headers: h }).then((r) => r.ok ? r.json() : []),
    ]).then(([devR, schR, ctR, stR, cmR]) => {
      const devs = (devR.devices ?? []) as { status: string }[];
      const schs = (schR.schedules ?? []) as { startAt: string; endAt: string }[];
      const cts  = (ctR.content ?? []) as unknown[];
      const sts  = Array.isArray(stR) ? stR : (stR?.data ?? []) as { onboardingStage?: string }[];
      const cms  = Array.isArray(cmR) ? cmR : [] as { paymentId?: string }[];
      setStats({
        screens:   {
          online:  devs.filter((d) => d.status === 'ONLINE').length,
          offline: devs.filter((d) => d.status === 'OFFLINE').length,
          pending: devs.filter((d) => d.status === 'PENDING').length,
          total:   devs.length,
        },
        schedules: {
          active: schs.filter((s) => s.startAt <= now && s.endAt >= now).length,
          total:  schs.length,
        },
        content:   { count: cts.length, totalMB: ctR.totalBytes ? ctR.totalBytes / (1024 * 1024) : 0 },
        stores:    { total: sts.length, live: sts.filter((s) => s.onboardingStage === 'live').length },
        campaigns: { total: cms.length, paid: cms.filter((c) => c.paymentId && c.paymentId !== 'pending').length },
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const storesLive  = stats?.stores.live  ?? 412;
  const storesTotal = stats?.stores.total ?? 438;

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">
            <span className="red">Good morning,</span>{' '}Rohan.
          </h1>
          <p className="page__sub">
            Network 027 is alive in Mangaluru. {storesLive} of {storesTotal} screens are running, the pilot cohort is +20% on sales lift, and 74% on aided recall — vs 29% on print &amp; OOH.
          </p>
        </div>
        <div className="page__actions">
          <DateRange active={range} onChange={setRange} />
          <button className="btn btn--outline btn--sm"><CalendarClock className="h-3 w-3" /> May 17–24</button>
        </div>
      </div>

      <InsightBanner />
      <SectionLabel n={1} label="Performance" />
      <KpiRow stats={stats} />

      <div className="grid-2">
        <AreaChart />
        <LiveFeedCard />
      </div>

      <SectionLabel n={2} label="Benchmarks & Brands" />
      <GoalsCard stats={stats} />
      <BrandAccountsCard />
    </>
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
  const [tab,         setTab]         = useState<Tab>('overview');
  const [refreshKey,  setRefreshKey]  = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen,     setCmdOpen]     = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [theme,       setTheme]       = useState<'light' | 'dark'>('light');
  const [adminPw,     setAdminPw]     = useState('');
  const [liveCount]                   = useState(412);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load theme from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('alive-theme') as 'light' | 'dark' | null;
      if (saved) setTheme(saved);
    } catch {}
    setAdminPw(sessionStorage.getItem(SS_PW) ?? '');
  }, []);

  // Apply theme to container
  useEffect(() => {
    try { localStorage.setItem('alive-theme', theme); } catch {}
  }, [theme]);

  // ⌘K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleNav = (t: Tab) => { setTab(t); setSidebarOpen(false); };
  const signOut = () => {
    sessionStorage.removeItem('alive_admin');
    sessionStorage.removeItem(SS_PW);
    window.location.reload();
  };

  const sectionName: Record<Tab, string> = {
    overview:   'Overview',
    campaigns:  'Campaigns',
    content:    'Creatives',
    schedules:  'Schedule',
    stores:     'Kirana Partners',
    screens:    'Screens',
    playlists:  'Playlists',
    monitoring: 'Monitoring',
    payments:   'Payouts',
    reports:    'Reports',
    flyers:     'Flyers',
    layouts:    'Layouts',
    media:      'Media',
    products:   'Products',
    roadmap:    'Platform',
  };

  return (
    <div className="adm app" ref={containerRef} data-theme={theme}>
      <SidebarNav tab={tab} onTab={handleNav} onSignOut={signOut} liveCount={liveCount} />

      <main className="main">
        <Topbar
          section={sectionName[tab] ?? tab}
          liveCount={liveCount}
          onOpenCmd={() => setCmdOpen(true)}
          onOpenNotif={() => setNotifOpen(true)}
          theme={theme}
          setTheme={setTheme}
          unread={3}
        />
        <Ticker />

        <div className="page">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {tab === 'overview'   && <OverviewPanel onNav={handleNav} />}
              {tab === 'flyers'     && (
                <div className="grid-2">
                  <UploadPanel onSaved={() => setRefreshKey((k) => k + 1)} />
                  <FlyersList refresh={refreshKey} />
                </div>
              )}
              {tab === 'stores'     && <StoresPanel />}
              {tab === 'campaigns'  && <CampaignsPanel />}
              {tab === 'payments'   && <StorePaymentsTab adminPassword={adminPw} />}
              {tab === 'screens'    && <ScreensTab />}
              {tab === 'content'    && <ContentTab />}
              {tab === 'playlists'  && <PlaylistsTab />}
              {tab === 'schedules'  && <SchedulesTab />}
              {tab === 'layouts'    && <LayoutsTab />}
              {tab === 'reports'    && <ReportsTab />}
              {tab === 'monitoring' && <MonitoringTab />}
              {tab === 'media'      && <SiteMediaTab adminPassword={adminPw} />}
              {tab === 'products'   && <ProductsTab adminPw={adminPw} />}
              {tab === 'roadmap'    && <RoadmapTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onNav={handleNav} />
      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
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
