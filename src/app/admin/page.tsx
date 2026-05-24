'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Trash2, Upload, ImageIcon, Store, BarChart3, FileImage,
  Phone, MapPin, CheckCircle2, Clock, X, MessageCircle, ExternalLink,
  IndianRupee, Eye, Package,
  Tv2, CalendarClock, FileBarChart2, Activity,
  Menu, ChevronRight, LogOut, LayoutDashboard, LayoutGrid, Images, Map, Layers,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const ScreensTab      = dynamic(() => import('@/components/admin/screens-tab'),       { ssr: false });
const ReportsTab      = dynamic(() => import('@/components/admin/reports-tab'),       { ssr: false });
const ContentTab      = dynamic(() => import('@/components/admin/content-tab'),       { ssr: false });
const ProgrammingTab  = dynamic(() => import('@/components/admin/programming-tab'),  { ssr: false });
const CompositionsTab = dynamic(() => import('@/components/admin/compositions-tab'), { ssr: false });
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

type Tab = 'overview' | 'flyers' | 'stores' | 'campaigns' | 'payments' | 'screens' | 'content' | 'programming' | 'compositions' | 'layouts' | 'reports' | 'monitoring' | 'media' | 'roadmap' | 'products';

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
      { id: 'programming', label: 'Programming', icon: CalendarClock },
      { id: 'compositions', label: 'Compositions', icon: LayoutGrid    },
      { id: 'layouts',      label: 'Layouts',       icon: Layers        },
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
  content:      { eyebrow: 'Media library',      title: 'Content'            },
  programming:  { eyebrow: 'Screen programming', title: 'Programming'        },
  compositions: { eyebrow: 'Multi-zone layouts', title: 'Screen compositions'    },
  layouts:      { eyebrow: 'On-screen overlays', title: 'Layouts & tickers'      },
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
  // Writes the store's session into localStorage then opens the partner dashboard.
  // This lets admin see exactly what the store partner sees.
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
      {/* Page head */}
      <div className="mb-2">
        <p className="admin-font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-primary mb-0.5">Store partners</p>
        <h1 className="admin-font-display text-3xl font-bold text-foreground tracking-tight">
          <em className="not-italic text-primary">{stores.length}</em> kirana partners.
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{live} live · {pending} pending onboarding · {screened} with screen · Mangaluru, Karnataka</p>
      </div>

      {/* N°01 Network stats */}
      <SectionLabel n={1} label="Network" />
      <div className="admin-summary-row">
        {[
          { label: 'Registered',  value: String(stores.length), sub: 'total partners' },
          { label: 'Live',        value: String(live),           sub: 'screens active' },
          { label: 'Pending',     value: String(pending),        sub: 'onboarding' },
          { label: 'With screen', value: String(screened),       sub: 'device paired' },
        ].map((s) => (
          <div key={s.label} className="admin-summary-tile">
            <div className="admin-summary-tile__label">{s.label}</div>
            <div className="admin-summary-tile__value">{s.value}</div>
            <div className="admin-summary-tile__sub">{s.sub}</div>
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
                        {/* Stage badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STAGE_LABELS[stage] ?? stage}
                        </span>
                        {/* Device count badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(s.deviceCount ?? 0) > 0 ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                          {s.deviceCount ?? 0} screen{(s.deviceCount ?? 0) !== 1 ? 's' : ''}
                        </span>
                        {/* Registered date */}
                        <span className="text-[10px] text-muted-foreground/50">{fmtDate(s.createdAt)}</span>
                      </div>
                    </div>

                    {/* Contact row */}
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{phone ? `+91 ${waNum}` : '—'}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[s.locality, s.city].filter(Boolean).join(', ') || '—'}</span>
                      {s.referralCode && <span className="flex items-center gap-1 font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">ref: {s.referralCode}</span>}
                    </div>

                    {/* Action buttons */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {/* WhatsApp quick contact */}
                      {waNum.length === 10 && (
                        <a
                          href={`https://wa.me/91${waNum}?text=${encodeURIComponent(`Hi ${s.ownerName}, this is the ALIVE team regarding your store ${s.storeName}.`)}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/8 px-2.5 py-1.5 text-[11px] font-semibold text-[#25D366] hover:bg-[#25D366]/15 transition-colors"
                        >
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </a>
                      )}
                      {/* Open as partner */}
                      <button
                        type="button"
                        onClick={() => openAsPartner(s)}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                        title="Open this store's dashboard in a new tab"
                      >
                        <ExternalLink className="h-3 w-3" /> View dashboard
                      </button>
                      {/* Expand / collapse */}
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : s.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? 'Less' : 'Edit'}
                      </button>
                      {/* Delete */}
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

                {/* Expandable edit section */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    {/* Extra detail chips */}
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

const BRAND_COLORS: Record<string, string> = {
  parle: '#e53e3e', britannia: '#2b6cb0', amul: '#d69e2e', dabur: '#276749',
  itc: '#744210', tata: '#2c5282', marico: '#b7791f', nestlé: '#553c9a', nestle: '#553c9a',
};
function brandColor(name: string): string {
  const key = name.toLowerCase().split(' ')[0];
  return BRAND_COLORS[key] ?? '#64748b';
}

function CampaignsPanel() {
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [deleting,     setDeleting]     = useState<string | null>(null);
  const [offeringTrial, setOfferingTrial] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'completed' | 'trial' | 'paid' | 'pending'>('all');

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
  const maxAmount = Math.max(...campaigns.map((c) => c.totalAmount ?? 0), 1);

  const filtered = campaigns.filter((c) => {
    if (statusFilter === 'all')       return true;
    if (statusFilter === 'paid')      return c.paymentId && c.paymentId !== 'pending';
    if (statusFilter === 'pending')   return !c.paymentId || c.paymentId === 'pending';
    return c.status === statusFilter;
  });

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Page head */}
      <div className="mb-2">
        <p className="admin-font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-primary mb-0.5">Brand campaigns</p>
        <h1 className="admin-font-display text-3xl font-bold text-foreground tracking-tight">
          <em className="not-italic text-primary">{campaigns.length}</em> campaigns in flight.
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{paid} paid · {pending} pending payment · {fmt(total)} total revenue</p>
      </div>

      {/* Summary tiles */}
      <div className="admin-summary-row">
        {[
          { label: 'Total bookings',  value: String(campaigns.length), sub: 'all time'          },
          { label: 'Revenue',         value: fmt(total),                sub: 'gross booked'      },
          { label: 'Paid',            value: String(paid),              sub: 'payment confirmed'  },
          { label: 'Pending pmt',     value: String(pending),           sub: 'awaiting payment'  },
        ].map((s) => (
          <div key={s.label} className="admin-summary-tile">
            <div className="admin-summary-tile__label">{s.label}</div>
            <div className="admin-summary-tile__value">{s.value}</div>
            <div className="admin-summary-tile__sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="admin-chips">
        {(['all','active','upcoming','completed','trial','paid','pending'] as const).map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`admin-chip ${statusFilter === f ? 'admin-chip--active' : ''}`}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
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
              {filtered.map((c) => {
                const isPaid = c.paymentId && c.paymentId !== 'pending';
                const pct    = Math.round(((c.totalAmount ?? 0) / maxAmount) * 100);
                const bc     = brandColor(c.brandName || '');
                return (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white text-[10px] font-bold" style={{ background: bc }}>
                          {(c.brandName || '?')[0].toUpperCase()}
                        </div>
                        <span className="font-semibold text-foreground">{c.brandName || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground"><p>{c.contactName}</p><p className="text-[10px] text-muted-foreground/60">{c.email}</p></td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap admin-font-mono">{c.screens} × {c.months}mo</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="admin-font-mono font-semibold text-foreground">{fmt(c.totalAmount ?? 0)}</div>
                      <div className="admin-tbl-budget">
                        <div className="admin-tbl-budget__track"><div className="admin-tbl-budget__fill" style={{ width: `${pct}%` }} /></div>
                        <span className="admin-font-mono text-[9px] text-muted-foreground/50">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`admin-badge ${isPaid ? 'admin-badge--live' : 'admin-badge--paused'}`}>
                        {isPaid ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground/60 whitespace-nowrap admin-font-mono">{fmtDate(c.createdAt)}</td>
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

// ─── Overview / Dashboard ────────────────────────────────────────────────────

type OpsStats = {
  screens:   { online: number; offline: number; pending: number; total: number };
  schedules: { active: number; total: number };
  content:   { count: number; totalMB: number };
  stores:    { total: number; live: number };
  campaigns: { total: number; paid: number };
};

type DeviceRow = { id: string; storeName: string; status: string; lastSeen?: string | null; locality?: string | null };

// Minimal SVG sparkline
function Sparkline({ data, color = '#dc2626', w = 72, h = 24 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const max = Math.max(...data), min = Math.min(...data), span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 2) + 1;
    const y = h - 2 - ((v - min) / span) * (h - 4);
    return `${x},${y}`;
  });
  const path = 'M' + pts.join(' L');
  const area = path + ` L${w - 1},${h - 1} L1,${h - 1} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="admin-kpi__spark">
      <defs>
        <linearGradient id={`sg${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg${color.replace('#','')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="admin-section-label">
      <span className="admin-section-label__n">N°{String(n).padStart(2, '0')}</span>
      <span className="admin-section-label__rule" />
      <span className="admin-section-label__lbl">{label}</span>
    </div>
  );
}

function timeSinceShort(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function ProgressRing({ pct, label, sub, color = '#dc2626', size = 72 }: { pct: number; label: string; sub: string; color?: string; size?: number }) {
  const r   = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);
  return (
    <div className="admin-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f4f4f5" strokeWidth="7" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={dash}
          strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
        <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: "'Inter Tight', sans-serif", fontSize: 14, fontWeight: 700, fill: 'currentColor' }}>
          {pct}%
        </text>
      </svg>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: 'var(--foreground)', textAlign: 'center', lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--muted-foreground)', textAlign: 'center' }}>{sub}</div>
    </div>
  );
}

function OverviewPanel({ onNav }: { onNav: (t: Tab) => void }) {
  const [stats,   setStats]   = useState<OpsStats | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pw  = sessionStorage.getItem(SS_PW) ?? '';
    const h   = { 'admin-password': pw };
    const now = new Date().toISOString();
    Promise.all([
      fetch('/api/devices',         { headers: h }).then((r) => r.ok ? r.json() : { devices: [] }),
      fetch('/api/schedules',       { headers: h }).then((r) => r.ok ? r.json() : { schedules: [] }),
      fetch('/api/content',         { headers: h }).then((r) => r.ok ? r.json() : { content: [], totalBytes: 0 }),
      fetch('/api/stores/save',     { headers: h }).then((r) => r.ok ? r.json() : []),
      fetch('/api/campaigns/admin', { headers: h }).then((r) => r.ok ? r.json() : []),
    ]).then(([devR, schR, ctR, stR, cmR]) => {
      const devs = (devR.devices ?? []) as DeviceRow[];
      const schs = (schR.schedules ?? []) as { startAt: string; endAt: string }[];
      const cts  = (ctR.content ?? []) as unknown[];
      const sts  = Array.isArray(stR) ? stR : (stR?.data ?? []) as { onboardingStage?: string }[];
      const cms  = Array.isArray(cmR) ? cmR : [] as { paymentId?: string }[];
      setDevices(devs);
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

  const quickActions: { label: string; sub: string; tab: Tab; icon: React.ElementType }[] = [
    { label: 'Screens',     sub: 'View fleet status',    tab: 'screens',     icon: Tv2          },
    { label: 'Content',     sub: 'Upload media',         tab: 'content',     icon: ImageIcon    },
    { label: 'Programming', sub: 'Playlists & schedules',tab: 'programming', icon: CalendarClock},
    { label: 'Reports',     sub: 'Proof of play',        tab: 'reports',     icon: FileBarChart2},
    { label: 'Monitoring',  sub: 'Live heartbeat grid',  tab: 'monitoring',  icon: Activity     },
    { label: 'Stores',      sub: 'Partner network',      tab: 'stores',      icon: Store        },
  ];

  // Illustrative sparklines (trend shapes, real value is the last point)
  const screenSpark  = [6,7,7,8,8,8,9,9,9,10,10,11,11,12,stats?.screens.online ?? 12];
  const scheduleSpark= [0,1,1,2,2,3,3,3,4,4,4,4,5,5,stats?.schedules.active ?? 5];
  const contentSpark = [2,3,4,4,5,6,7,8,9,10,11,12,13,14,stats?.content.count ?? 14];
  const storeSpark   = [1,2,2,3,3,4,4,5,5,6,6,7,7,8,stats?.stores.total ?? 8];

  const insightText = stats
    ? stats.screens.offline > 0
      ? `${stats.screens.offline} screen${stats.screens.offline > 1 ? 's' : ''} offline · ${stats.schedules.active} schedule${stats.schedules.active !== 1 ? 's' : ''} active`
      : `All ${stats.screens.online} screens online · ${stats.schedules.active} active schedule${stats.schedules.active !== 1 ? 's' : ''}`
    : 'Loading network status…';

  return (
    <div>
      {/* Page head */}
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1 admin-font-mono">ALIVE Admin</p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight admin-font-display">
          <em className="not-italic text-primary">Good morning —</em> here&apos;s the network.
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">Kirana store digital advertising · Mangaluru, Karnataka</p>
      </div>

      {/* Insight card */}
      <div className="admin-insight mb-6">
        <div>
          <div className="admin-insight__label">Network status</div>
          <div className="admin-insight__text">{insightText}</div>
        </div>
      </div>

      {/* KPI row */}
      <SectionLabel n={1} label="Operations" />
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : stats ? (
        <div className="admin-kpi-row">
          {/* Screens */}
          <button onClick={() => onNav('screens')} className="admin-kpi text-left hover:opacity-90 transition-opacity">
            <div className="admin-kpi__icon"><Tv2 className="h-4 w-4" /></div>
            <div className="admin-kpi__label">Active screens</div>
            <div className="admin-kpi__value">{stats.screens.online}</div>
            <div className="admin-kpi__sub">/ {stats.screens.total} total</div>
            <div className="admin-kpi__foot">
              <span className={`admin-kpi__delta ${stats.screens.offline === 0 ? 'admin-kpi__delta--up' : 'admin-kpi__delta--down'}`}>
                {stats.screens.offline === 0 ? '✓ all up' : `${stats.screens.offline} down`}
              </span>
              <Sparkline data={screenSpark} />
            </div>
          </button>

          {/* Active schedules — feature card */}
          <button onClick={() => onNav('programming')} className="admin-kpi admin-kpi--feature text-left hover:opacity-90 transition-opacity">
            <div className="admin-kpi__icon"><CalendarClock className="h-4 w-4" /></div>
            <div className="admin-kpi__label">Active schedules</div>
            <div className="admin-kpi__value">{stats.schedules.active}</div>
            <div className="admin-kpi__sub">{stats.schedules.total} total configured</div>
            <div className="admin-kpi__foot">
              <span className="admin-kpi__delta">running now</span>
              <Sparkline data={scheduleSpark} color="#ffffff" />
            </div>
          </button>

          {/* Content */}
          <button onClick={() => onNav('content')} className="admin-kpi text-left hover:opacity-90 transition-opacity">
            <div className="admin-kpi__icon"><ImageIcon className="h-4 w-4" /></div>
            <div className="admin-kpi__label">Content items</div>
            <div className="admin-kpi__value">{stats.content.count}</div>
            <div className="admin-kpi__sub">{stats.content.totalMB.toFixed(0)} MB used</div>
            <div className="admin-kpi__foot">
              <span className="admin-kpi__delta admin-kpi__delta--up">in library</span>
              <Sparkline data={contentSpark} />
            </div>
          </button>

          {/* Store partners */}
          <button onClick={() => onNav('stores')} className="admin-kpi text-left hover:opacity-90 transition-opacity">
            <div className="admin-kpi__icon"><Store className="h-4 w-4" /></div>
            <div className="admin-kpi__label">Store partners</div>
            <div className="admin-kpi__value">{stats.stores.total}</div>
            <div className="admin-kpi__sub">{stats.stores.live} live · {stats.campaigns.total} campaigns</div>
            <div className="admin-kpi__foot">
              <span className="admin-kpi__delta admin-kpi__delta--up">{stats.stores.live} live</span>
              <Sparkline data={storeSpark} />
            </div>
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-4 text-center">Could not load stats</p>
      )}

      {/* Live network feed */}
      <SectionLabel n={2} label="Network" />
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Live screens</p>
          <button onClick={() => onNav('monitoring')} className="text-xs text-primary font-semibold hover:underline">View all →</button>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : devices.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No screens registered yet.</p>
        ) : (
          <div className="px-5 admin-feed">
            {devices.slice(0, 8).map((d) => {
              const st = d.status.toLowerCase() as 'online' | 'offline' | 'pending';
              return (
                <div key={d.id} className="admin-feed-item">
                  <span className={`admin-live-dot admin-live-dot--${st}`} />
                  <div className="admin-feed-item__info">
                    <div className="admin-feed-item__name">{d.storeName}</div>
                    {(d.locality || d.lastSeen) && (
                      <div className="admin-feed-item__meta">
                        {d.locality ? `${d.locality} · ` : ''}
                        {d.lastSeen ? timeSinceShort(d.lastSeen) : '—'}
                      </div>
                    )}
                  </div>
                  <span className={`admin-feed-item__badge admin-feed-item__badge--${st}`}>
                    {d.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick access */}
      <SectionLabel n={3} label="Quick access" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {quickActions.map((a) => (
          <button key={a.tab} onClick={() => onNav(a.tab)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:bg-primary/5 transition-all group">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
              <a.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{a.label}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5 admin-font-mono">{a.sub}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary/50 transition-colors shrink-0" />
          </button>
        ))}
      </div>

      {/* Platform map link */}
      <div className="mt-6 rounded-xl border border-border bg-card px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Platform Map</p>
          <p className="text-xs text-muted-foreground mt-0.5">54-item build tracker — features, APIs, Android player, T2 roadmap</p>
        </div>
        <button onClick={() => onNav('roadmap')}
          className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-colors shrink-0">
          View map <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Pilot benchmarks */}
      <SectionLabel n={4} label="Pilot benchmarks" />
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs text-muted-foreground mb-4 admin-font-mono">Mangaluru pilot · illustrative targets based on category benchmarks</p>
        <div className="admin-rings">
          <ProgressRing
            pct={stats ? Math.round((stats.screens.online / Math.max(stats.screens.total, 1)) * 100) : 0}
            label="Screens live" sub="of fleet" color="#16a34a"
          />
          <ProgressRing pct={68} label="Sales uplift" sub="vs control" color="#dc2626" />
          <ProgressRing pct={74} label="Brand recall" sub="aided recall" color="#b45309" />
          <ProgressRing pct={86} label="Slot fill" sub="inventory sold" color="#6d28d9" />
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
      <div className="px-5 py-5 border-b border-border/40">
        <a href="/" className="opacity-80 hover:opacity-100 transition-opacity block">
          <Logo />
        </a>
        <p className="admin-font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-primary mt-2">Admin Console</p>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
        {NAV.map((group) => (
          <div key={group.group}>
            <p className="admin-font-mono px-2 mb-1.5 text-[8.5px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">{group.group}</p>
            {group.items.map((item) => {
              const Icon   = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTab(item.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition-all ${
                    active
                      ? 'border-l-2 border-primary bg-primary/6 text-primary pl-2'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border-l-2 border-transparent'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border/40 space-y-1">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="admin-font-mono text-[9px] font-bold text-primary">AA</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">ALIVE Admin</p>
            <p className="admin-font-mono text-[9px] text-muted-foreground/60 truncate">Network Admin</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/8 hover:text-destructive transition-all"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
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
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border/40 bg-card/50 sticky top-0 h-screen overflow-hidden">
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
              className="fixed left-0 top-0 z-50 h-full w-60 bg-card border-r border-border/40 lg:hidden flex flex-col"
            >
              <SidebarNav tab={tab} onTab={handleNav} onSignOut={signOut} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border/30 bg-background/95 backdrop-blur-md">
          <div className="flex h-13 items-center gap-3 px-4 sm:px-5" style={{ height: 52 }}>
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="hidden sm:inline admin-font-mono text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Admin</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 hidden sm:block shrink-0" />
              <span className="admin-font-mono text-[10px] font-semibold text-foreground uppercase tracking-widest truncate">{meta.title}</span>
            </div>

            {/* Search — hidden on mobile */}
            <button
              className="hidden sm:flex flex-1 max-w-xs items-center gap-2 h-8 rounded-lg border border-border/60 bg-muted/30 px-3 text-left text-muted-foreground hover:border-border hover:bg-muted/50 transition-all"
              onClick={() => {}}
              title="Search (⌘K)"
            >
              <Eye className="h-3 w-3 shrink-0" />
              <span className="flex-1 text-xs">Search…</span>
              <span className="admin-font-mono text-[9px] border border-border/50 rounded px-1 py-0.5 text-muted-foreground/50">⌘K</span>
            </button>

            {/* Right: live pill + logo */}
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden sm:flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/8 px-2.5 py-1 admin-font-mono text-[9px] font-semibold text-green-700 uppercase tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                Live
              </span>
              <a href="/" className="opacity-60 hover:opacity-100 transition-opacity lg:hidden">
                <Logo />
              </a>
            </div>
          </div>
        </header>

        {/* Live ticker */}
        <div className="admin-ticker sticky top-[52px] z-20">
          <div className="admin-ticker__track">
            ALIVE NETWORK · ADMIN CONSOLE · MANGALURU, KARNATAKA &nbsp;·&nbsp; SCREEN NETWORK OPERATIONAL &nbsp;·&nbsp; ALIVE v4.12 &nbsp;·&nbsp; ALL SYSTEMS NORMAL &nbsp;·&nbsp; PROOF OF PLAY: ACTIVE &nbsp;·&nbsp; SCHEDULES: SYNCING &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            ALIVE NETWORK · ADMIN CONSOLE · MANGALURU, KARNATAKA &nbsp;·&nbsp; SCREEN NETWORK OPERATIONAL &nbsp;·&nbsp; ALIVE v4.12 &nbsp;·&nbsp; ALL SYSTEMS NORMAL &nbsp;·&nbsp; PROOF OF PLAY: ACTIVE &nbsp;·&nbsp; SCHEDULES: SYNCING &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {/* Page heading — suppress for overview (it renders its own) */}
              {tab !== 'overview' && (
                <div className="mb-5">
                  <p className="admin-font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-primary mb-0.5">{meta.eyebrow}</p>
                  <h1 className="admin-font-display text-2xl font-bold text-foreground tracking-tight">{meta.title}</h1>
                </div>
              )}

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
              {tab === 'programming'  && <ProgrammingTab />}
              {tab === 'compositions' && <CompositionsTab />}
              {tab === 'layouts'      && <LayoutsTab />}
              {tab === 'reports'    && <ReportsTab />}
              {tab === 'monitoring' && <MonitoringTab />}
              {tab === 'media'      && <SiteMediaTab adminPassword={adminPw} />}
              {tab === 'products'   && <ProductsTab adminPw={adminPw} />}
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
