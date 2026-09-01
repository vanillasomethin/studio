'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, Trash2, Upload, ImageIcon, Store, BarChart3, FileImage,
  Phone, MapPin, CheckCircle2, Clock, X, MessageCircle, ExternalLink,
  IndianRupee, Eye, EyeOff, Package, Ticket, Star, Copy,
  Tv2, CalendarClock, FileBarChart2, Activity,
  ChevronRight, LogOut, LayoutDashboard, LayoutGrid, Images, Map, Layers,
  // New icons for the redesign
  MonitorPlay,
  Search, Bell, LifeBuoy, Download, Plus,
  Megaphone, Image, Radar, Grid3x3, Zap, ImagePlus, QrCode, Camera, ShieldCheck, Users,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { signIn, signOut as authSignOut } from 'next-auth/react';
import { QRCodeSVG } from 'qrcode.react';
import { Badge } from '@/components/ui/badge';
import './admin.css';

const ScreensTab      = dynamic(() => import('@/components/admin/screens-tab'),       { ssr: false });
const ReportsTab      = dynamic(() => import('@/components/admin/reports-tab'),       { ssr: false });
const ProofOfPlayTab  = dynamic(() => import('@/components/admin/proof-of-play-tab'), { ssr: false });
const ContentTab      = dynamic(() => import('@/components/admin/content-tab'),       { ssr: false });
const ProgrammingTab  = dynamic(() => import('@/components/admin/programming-tab'),  { ssr: false });
const SlotsTab        = dynamic(() => import('@/components/admin/slots-tab'),        { ssr: false });
const PowerTab        = dynamic(() => import('@/components/admin/power-tab'),        { ssr: false });
const QrTab           = dynamic(() => import('@/components/admin/qr-tab'),           { ssr: false });
const CompositionsTab = dynamic(() => import('@/components/admin/compositions-tab'), { ssr: false });
const LayoutsTab      = dynamic(() => import('@/components/admin/layouts-tab'),       { ssr: false });
const MonitoringTab   = dynamic(() => import('@/components/admin/monitoring-tab'),   { ssr: false });
const FootfallTab     = dynamic(() => import('@/components/admin/footfall-tab'),     { ssr: false });
const StorePaymentsTab = dynamic(() => import('@/components/admin/store-payments-tab'), { ssr: false });
const SiteMediaTab     = dynamic(() => import('@/components/admin/site-media-tab'),     { ssr: false });
const RoadmapTab       = dynamic(() => import('@/components/admin/roadmap-tab'),        { ssr: false });
const ProductsTab      = dynamic(() => import('@/components/admin/products-tab'),       { ssr: false });
const AlertsTab        = dynamic(() => import('@/components/admin/alerts-tab'),         { ssr: false });
const AutoFlyerPanel   = dynamic(() => import('@/components/admin/auto-flyer-panel'),   { ssr: false });
const AppPreviewCard   = dynamic(() => import('@/components/admin/app-preview-card'),   { ssr: false });
const CouponsTab       = dynamic(() => import('@/components/admin/coupons-tab'),         { ssr: false });
const TeamTab          = dynamic(() => import('@/components/admin/team-tab'),            { ssr: false });
import { Logo } from '@/components/icons/logo';
import OfflineAlertWatcher from '@/components/admin/offline-alert-watcher';
import { adminGetArray, adminGetObject } from '@/lib/admin-fetch';

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
  tier?: string | null; monthlyCompensationPaise?: number | null;
  bankAccountName?: string; bankAccountNo?: string; bankIfsc?: string; bankName?: string;
  payoutLastPaidAt?: string | null; payoutNotes?: string | null;
  referralCode?: string; referredBy?: string | null; agreedAt?: string | null; liveAt?: string | null;
  deviceCount?: number;
  // GPS-verified onboarding photos — shop/install are partner-captured,
  // serial/plug are captured by ops during the install visit.
  shopPhotoUrl?: string | null; shopPhotoLat?: number | null; shopPhotoLng?: number | null; shopPhotoSource?: string | null; shopPhotoAt?: string | null;
  installPhotoUrl?: string | null; installPhotoLat?: number | null; installPhotoLng?: number | null; installPhotoSource?: string | null; installPhotoAt?: string | null;
  serialPhotoUrl?: string | null; serialPhotoLat?: number | null; serialPhotoLng?: number | null; serialPhotoSource?: string | null; serialPhotoAt?: string | null;
  plugPhotoUrl?: string | null; plugPhotoLat?: number | null; plugPhotoLng?: number | null; plugPhotoSource?: string | null; plugPhotoAt?: string | null;
  // Installation & hardware (ops-recorded at the site visit)
  tvBrand?: string | null; tvModel?: string | null; tvSerial?: string | null;
  tvSizeInches?: number | null; tvTag?: string | null; tvInstalledAt?: string | null;
  espSwitchName?: string | null; espPlugId?: string | null;
  wifiSsid?: string | null; wifiUsername?: string | null; wifiPassword?: string | null;
  wifiAuthType?: string | null; installNotes?: string | null;
};
type Campaign = {
  id: string; brandId: string | null; brandName: string; contactName: string; email: string;
  phone: string; screens: number; months: number; startDate: string;
  pricePerScreen: number; totalAmount: number; paymentId: string;
  status: 'upcoming' | 'active' | 'completed' | 'trial'; createdAt: string;
  trialOfferedAt: string | null; trialUsedAt: string | null;
  preferredStores?: { id: string; storeName: string; locality: string | null }[];
};

// ─── Nav config ──────────────────────────────────────────────────────────────

type Tab = 'overview' | 'flyers' | 'stores' | 'campaigns' | 'slots' | 'power' | 'qr' | 'payments' | 'coupons' | 'screens' | 'content' | 'programming' | 'compositions' | 'layouts' | 'reports' | 'pop' | 'monitoring' | 'footfall' | 'alerts' | 'media' | 'roadmap' | 'products' | 'team';
type DeviceRow = { id: string; storeName: string; status: string; lastSeen?: string | null; locality?: string | null };

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
      { id: 'coupons',    label: 'Coupons',     icon: Ticket      },
    ],
  },
  {
    group: 'Screen Network',
    items: [
      { id: 'screens',    label: 'Screens',     icon: Tv2         },
      { id: 'content',    label: 'Content',     icon: ImageIcon   },
      { id: 'programming',  label: 'Programming',  icon: LayoutGrid    },
      { id: 'slots',        label: 'Slot inventory', icon: Grid3x3     },
      { id: 'power',        label: 'Power',         icon: Zap         },
      { id: 'compositions', label: 'Compositions', icon: CalendarClock },
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
      { id: 'team',       label: 'Team',         icon: Users      },
      { id: 'alerts',     label: 'Alerts',       icon: Bell       },
      { id: 'roadmap',    label: 'Platform Map', icon: Map        },
    ],
  },
];

const PAGE_META: Record<Tab, { eyebrow: string; title: string }> = {
  overview:   { eyebrow: 'ALIVE Admin',        title: 'Dashboard'          },
  flyers:     { eyebrow: 'Flyer management',   title: 'Published flyers'   },
  stores:     { eyebrow: 'Store partners',     title: 'Registered stores'  },
  campaigns:  { eyebrow: 'Brand campaigns',    title: 'All campaigns'      },
  slots:      { eyebrow: 'Slot inventory',     title: 'Loop slots by day'  },
  power:      { eyebrow: 'Electricity',        title: 'Screen power'       },
  qr:         { eyebrow: 'Scan tracking',      title: 'QR codes'           },
  payments:   { eyebrow: 'Store payouts',      title: 'Partner payments'   },
  coupons:    { eyebrow: 'Brand discounts',    title: 'Coupons'            },
  screens:    { eyebrow: 'Screen fleet',       title: 'Registered screens' },
  content:    { eyebrow: 'Media library',      title: 'Content'            },
  programming:  { eyebrow: 'Screen programming', title: 'Programming'        },
  compositions: { eyebrow: 'Content delivery',   title: 'Compositions'       },
  layouts:    { eyebrow: 'On-screen overlays', title: 'Layouts & tickers'  },
  reports:    { eyebrow: 'Proof of play',      title: 'Play reports'       },
  pop:        { eyebrow: 'Proof of play',      title: 'Proof of Play'      },
  monitoring: { eyebrow: 'Live network',       title: 'Monitoring'         },
  footfall:   { eyebrow: 'In-store presence',  title: 'Footfall'           },
  media:      { eyebrow: 'Site management',    title: 'Homepage media'     },
  products:   { eyebrow: 'Product catalogue',  title: 'Master Products'    },
  alerts:     { eyebrow: 'System status',      title: 'Alerts'             },
  team:       { eyebrow: 'Access & audit',     title: 'Team'               },
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
  new: 'New', contacted: 'Contacted', physically_onboarded: 'Physically onboarded',
  digitally_onboarded: 'Digitally onboarded', live: 'Live', rejected: 'Rejected',
};
// Pastel-on-white in light mode; translucent tint on dark so the chips sit in
// the card instead of glowing on top of it.
const STAGE_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-600 dark:bg-neutral-700/50 dark:text-neutral-300',
  contacted: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  physically_onboarded: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  digitally_onboarded: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  live: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  rejected: 'bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-300',
};
const PAYOUT_LABELS: Record<string, string> = {
  pending_setup: 'Setup pending', ready: 'Ready', paid: 'Paid', on_hold: 'On hold',
};

async function openAsPartner(s: StoreReg) {
  // Open the tab synchronously (inside the click gesture) so popup blockers
  // don't eat it while we mint the impersonation token.
  const win = window.open('about:blank', '_blank');
  const session: Record<string, unknown> = {
    storeName: s.storeName, ownerName: s.ownerName,
    whatsapp: s.whatsapp, phone: s.phone || s.whatsapp,
    address: s.address, locality: s.locality, city: s.city, pincode: s.pincode,
    lat: s.lat, lng: s.lng, gstin: s.gstin || null,
    referralCode: s.referralCode, referredBy: s.referredBy || null,
    agreedAt: s.agreedAt || null, liveAt: s.liveAt || null,
    upiId: s.upiId || null, payoutMethod: s.payoutMethod || null,
    onboardingStage: s.onboardingStage || null, deviceCount: s.deviceCount ?? 0,
    tier: s.tier || 'standard', monthlyCompensationPaise: s.monthlyCompensationPaise ?? 50000,
    id: s.id,
  };
  // Store-partner APIs no longer trust a bare storeId — without this token the
  // impersonated dashboard renders from the cached payload but can't write.
  try {
    const pw = sessionStorage.getItem(SS_PW) ?? '';
    const res = await fetch(`/api/admin/store-token?storeId=${encodeURIComponent(s.id)}`, { headers: { 'admin-password': pw } });
    if (res.ok) {
      const d = await res.json() as { token?: string };
      if (d.token) session.token = d.token;
    }
  } catch { /* fall through to the warning below */ }
  if (!session.token) {
    // Without the token every write from the impersonated tab (GPS photos,
    // payout edits) silently 401s — say so instead of losing the uploads.
    alert('Could not get partner access — the dashboard will open read-only. Sign out of the admin panel, log back in, and try again before uploading photos or editing details.');
  }
  localStorage.setItem('alive_store_session', JSON.stringify(session));
  if (win) win.location.href = '/store-dashboard';
  else window.open('/store-dashboard', '_blank');
}

function PremiumLinkCard() {
  const [data, setData] = useState<{ configured: boolean; link: string | null; monthlyRupees: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // On failure render nothing rather than the "Not configured — set
    // PREMIUM_SIGNUP_KEY" banner: a 401/5xx used to land here and send the admin
    // off to fix an env var that was already correct.
    adminGetObject<{ configured: boolean; link: string | null; monthlyRupees: number }>('/api/admin/premium-link')
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return null;

  const copy = () => {
    if (!data.link) return;
    navigator.clipboard.writeText(data.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <Star className="h-4 w-4 text-amber-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Premium store onboarding link · ₹{data.monthlyRupees}/mo</p>
          {data.configured ? (
            <p className="text-xs text-muted-foreground truncate">{data.link}</p>
          ) : (
            <p className="text-xs text-red-600">Not configured — set PREMIUM_SIGNUP_KEY in the Vercel env vars.</p>
          )}
        </div>
      </div>
      {data.configured && (
        <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted shrink-0">
          <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy link'}
        </button>
      )}
    </div>
  );
}

// ─── Gated per-tier signup links ──────────────────────────────────────────────
// Each link carries the secret that fixes the new store's pricing tier, so this
// panel is admin-only and the URLs are never rendered anywhere public.

type SignupLink = {
  tier: string; label: string; envVar: string;
  monthlyMinimumRupees: number; configured: boolean; url: string | null;
};

function SignupLinksPanel() {
  const [links,  setLinks]  = useState<SignupLink[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const pw = sessionStorage.getItem(SS_PW) ?? '';
    fetch('/api/admin/signup-links', { headers: { 'admin-password': pw } })
      .then((r) => r.ok ? r.json() : { links: [] })
      .then((b) => setLinks(b.links ?? []))
      .catch(() => setLinks([]));
  }, []);

  const copy = (l: SignupLink) => {
    if (!l.url) return;
    navigator.clipboard.writeText(l.url)
      .then(() => { setCopied(l.tier); setTimeout(() => setCopied(null), 2000); })
      .catch(() => {});
  };

  if (!links || links.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      <p className="text-sm font-bold text-foreground">Store signup links</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
        One per pricing tier — the link decides the store&apos;s tier, so share the right one. Keep these private.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {links.map((l) => (
          <div key={l.tier} className="rounded-lg border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-foreground">{l.label}</span>
              <span className="text-[10px] text-muted-foreground">₹{l.monthlyMinimumRupees.toLocaleString('en-IN')}/mo min</span>
            </div>
            {l.configured ? (
              <button
                onClick={() => copy(l)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                {copied === l.tier ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                {copied === l.tier ? 'Copied' : 'Copy link'}
              </button>
            ) : (
              <p className="mt-2 text-[10px] text-amber-600">
                Set <code className="font-mono">{l.envVar}</code> to enable
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GPS verification photos (admin view) ────────────────────────────────────

/** Metres between two WGS-84 points (haversine). */
function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type PhotoKind = 'shop' | 'install' | 'serial' | 'plug';

/** Best-effort device fix. Resolves null on denial, no fix, or an unanswered
 *  permission prompt — install photos are shot inside shops that often have no
 *  usable GPS at all, and a missing coordinate must never cost us the photo. */
function currentFix(timeoutMs = 6000): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: { lat: number; lng: number } | null) => { if (!settled) { settled = true; resolve(v); } };
    // Our own timer as well as the option: a permission prompt left sitting on
    // screen fires neither callback, and the upload can't wait on a human.
    setTimeout(() => finish(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (p) => finish({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => finish(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

/** The five columns one photo kind writes. Spelled out per kind so the
 *  optimistic patch stays type-checked against the row shape. */
function photoPatch(kind: PhotoKind, p: { url: string; lat: number | null; lng: number | null; source: string | null; at: string | null }): Partial<StoreReg> {
  switch (kind) {
    case 'shop':    return { shopPhotoUrl:    p.url, shopPhotoLat:    p.lat, shopPhotoLng:    p.lng, shopPhotoSource:    p.source, shopPhotoAt:    p.at };
    case 'install': return { installPhotoUrl: p.url, installPhotoLat: p.lat, installPhotoLng: p.lng, installPhotoSource: p.source, installPhotoAt: p.at };
    case 'serial':  return { serialPhotoUrl:  p.url, serialPhotoLat:  p.lat, serialPhotoLng:  p.lng, serialPhotoSource:  p.source, serialPhotoAt:  p.at };
    case 'plug':    return { plugPhotoUrl:    p.url, plugPhotoLat:    p.lat, plugPhotoLng:    p.lng, plugPhotoSource:    p.source, plugPhotoAt:    p.at };
  }
}

/** data: URL → Blob by hand rather than via fetch(): the CSP's connect-src
 *  lists no `data:`, and it is report-only today but one config flip from
 *  enforcing — at which point fetch(dataUrl) would start failing here. */
function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const mime  = /:(.*?);/.exec(dataUrl.slice(0, comma))?.[1] ?? 'image/jpeg';
  const bin   = atob(dataUrl.slice(comma + 1));
  const buf   = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/** Shrinks anything the upload route would refuse — it caps at 4 MB and takes
 *  only JPEG/PNG/WebP, while a phone camera hands us 8 MB of HEIC. Falls back
 *  to the original bytes if the browser can't decode it, so the route gets to
 *  answer with its own message instead of the upload dying here. */
async function prepareUpload(file: File): Promise<Blob> {
  const SERVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  if (file.size <= 3.5 * 1024 * 1024 && SERVER_TYPES.includes(file.type)) return file;
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('read failed'));
      r.readAsDataURL(file);
    });
    // compressImage never settles on an image the browser can't decode, so it
    // gets a deadline rather than leaving the card spinning forever.
    const small = await Promise.race([
      compressImage(dataUrl, 1600, 0.8),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (!small) return file;
    return dataUrlToBlob(small);
  } catch {
    return file;
  }
}

function AdminPhotoCard({ label, kind, storeId, url, lat, lng, source, at, storeLat, storeLng, onUploaded }: {
  label: string; kind: PhotoKind; storeId: string;
  url?: string | null; lat?: number | null; lng?: number | null;
  source?: string | null; at?: string | null; storeLat?: number | null; storeLng?: number | null;
  onUploaded: (patch: Partial<StoreReg>) => void;
}) {
  // Every card is an uploader, not just a viewer. The pair wizard can only
  // reach a screen that is still displaying a pairing code, so for the whole
  // already-paired fleet this is the ONLY way to supply the serial/plug photos
  // the install gate demands — without it those stores freeze at 'contacted'.
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true); setError(null);
    try {
      // Fix and downscale run together: the GPS lookup is usually done by the
      // time the canvas has re-encoded, so ops waits for neither.
      const fixP = currentFix();
      const blob = await prepareUpload(file);
      const fix  = await fixP;

      const fd = new FormData();
      fd.append('file', blob, `${kind}.jpg`);
      fd.append('kind', kind);
      if (fix) {
        fd.append('lat', String(fix.lat));
        fd.append('lng', String(fix.lng));
        fd.append('source', 'device');
      }
      const pw   = sessionStorage.getItem(SS_PW) ?? '';
      const res  = await fetch(`/api/admin/stores/${storeId}/photo`, { method: 'POST', headers: { 'admin-password': pw }, body: fd });
      if (res.status === 401) throw new Error('Admin session expired — reload the panel and sign in again.');
      const body = await res.json().catch(() => null) as { url?: string; lat?: number | null; lng?: number | null; at?: string | null; error?: string } | null;
      if (!res.ok || !body?.url) throw new Error(body?.error ?? `Upload failed (HTTP ${res.status})`);
      // Straight into the card's store row so the thumbnail — and the gate's
      // view of what's collected — updates without a re-read.
      onUploaded(photoPatch(kind, {
        url:    body.url,
        lat:    body.lat ?? null,
        lng:    body.lng ?? null,
        source: body.lat != null ? 'device' : null,
        at:     body.at ?? null,
      }));
    } catch (e) {
      setError((e as Error).message || 'Upload failed. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  // `capture` opens the phone camera straight away — ops is standing in the
  // shop, and the point of the photo is that it was taken there.
  const picker = (
    <label className={`shrink-0 inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground ${busy ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
      {busy
        ? <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
        : <><Camera className="h-3 w-3" /> {url ? 'Replace' : 'Upload'}</>}
      <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
    </label>
  );

  if (!url) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ImagePlus className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-foreground/70">{label}</p>
            <p className="text-[10px] text-muted-foreground">Not uploaded yet — stage is gated on it</p>
          </div>
          {picker}
        </div>
        {error && <p className="mt-1.5 text-[10px] font-medium text-red-600">{error}</p>}
      </div>
    );
  }
  const hasCoords = typeof lat === 'number' && typeof lng === 'number';
  // Flag photos taken suspiciously far from the registered map pin (the 200 m
  // exclusivity radius is a natural threshold for "same shop").
  const dist = hasCoords && typeof storeLat === 'number' && typeof storeLng === 'number'
    ? distanceMetres(lat!, lng!, storeLat, storeLng) : null;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Square box + landscape photo means object-cover crops HORIZONTALLY, so
            object-top alone leaves the burnt-in GPS banner on screen (measured:
            100% of image height visible at 48x48). The top-anchored 1.5x zoom
            pushes the bottom third out of the clip box whatever the aspect, so
            the stamp is gone here too. Stored file untouched — click opens it. */}
        <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border">
          <img src={url} alt={label} className="h-full w-full origin-top scale-150 object-cover object-top" />
        </span>
        </a>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-foreground">{label}{at ? ` · ${fmtDate(at)}` : ''}{source === 'device' ? ' · device GPS' : ''}</p>
          {hasCoords ? (
            <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer"
              className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">
              {lat!.toFixed(6)}, {lng!.toFixed(6)}
            </a>
          ) : <p className="text-[10px] text-muted-foreground">No coordinates</p>}
          {dist != null && (
            <p className={`text-[10px] font-semibold ${dist > 200 ? 'text-amber-600' : 'text-green-700'}`}>
              {dist > 200 ? '⚠ ' : ''}{dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`} from registered pin
            </p>
          )}
        </div>
        {picker}
      </div>
      {error && <p className="mt-1.5 text-[10px] font-medium text-red-600">{error}</p>}
    </div>
  );
}

const fieldCls = 'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';

/** Red asterisk on fields the install gate refuses to advance a store without. */
function ReqMark({ on }: { on?: boolean }) {
  return on ? <span className="text-primary" title="Required before Physically onboarded"> *</span> : null;
}

/** Compact labelled field for the store card's hardware grid. */
function LabelledInput({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  // Secrets start masked: this panel is worked on a shared ops laptop, usually
  // with the shopkeeper and whoever else standing over the screen.
  const [revealed, setRevealed] = useState(false);
  const secret = type === 'password';
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}<ReqMark on={required} /></span>
      <div className="relative">
        <input
          type={secret ? (revealed ? 'text' : 'password') : type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldCls} ${secret ? 'pr-8' : ''}`}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </label>
  );
}

/** Same shape as LabelledInput, for the fixed-choice hardware fields. */
function LabelledSelect({ label, value, onChange, required, children }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}<ReqMark on={required} /></span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls}>{children}</select>
    </label>
  );
}

/** Reads the partner list. Returns null when the admin session bounced — that
 *  case is handled in place, so callers just stop. Throws on anything else. */
async function fetchStores(): Promise<StoreReg[] | null> {
  const pw = sessionStorage.getItem(SS_PW) ?? '';
  const r  = await fetch('/api/stores/save', { headers: { 'admin-password': pw } });
  if (r.status === 401) {
    // The password in sessionStorage no longer matches ADMIN_PASSWORD (rotated
    // in Vercel, or a restored tab) — back to the gate rather than crashing
    // every panel with an error-envelope payload.
    sessionStorage.removeItem('alive_admin');
    sessionStorage.removeItem(SS_PW);
    window.location.reload();
    return null;
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const body = await r.json();
  const arr  = Array.isArray(body) ? body : body?.data;
  if (!Array.isArray(arr)) throw new Error('Unexpected response shape');
  return arr as StoreReg[];
}

function StoresPanel() {
  const [stores,   setStores]   = useState<StoreReg[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search,   setSearch]   = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving,   setSaving]   = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Rejected save, shown on the card it belongs to. The install gate answers 409
  // with the exact list of what ops still has to collect — far more actionable
  // than one sentence in an alert() they have to dismiss before they can act.
  const [saveError, setSaveError] = useState<{ id: string; error: string; missing: string[] } | null>(null);
  // Last stage the SERVER acknowledged, per store: the dropdown edits local
  // state immediately, so a refused stage change must be put back from here.
  const serverStage = useRef<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true); setLoadError(null);
    fetchStores()
      .then((arr) => {
        if (!arr) return;
        setStores(arr);
        serverStage.current = Object.fromEntries(arr.map((s) => [s.id, s.onboardingStage ?? 'new']));
      })
      .catch(() => setLoadError('Could not load partners. Check your connection and retry.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // The route rewrites part of what it stored — blanks become NULL, the TV size
  // is rounded, and tvInstalledAt is stamped on a successful crossing — so a
  // saved card has to be read back. Merge ONLY that card, and within it only
  // the fields whose local value is still exactly what this save sent: a
  // keystroke typed while the PATCH was in flight is the newer intent and has
  // to survive. Re-reading the whole list into state (what this used to do)
  // silently threw those keystrokes away.
  const resyncStore = async (id: string, sent: Partial<StoreReg>) => {
    const arr   = await fetchStores().catch(() => null);
    const fresh = arr?.find((x) => x.id === id);
    if (!fresh) return;
    serverStage.current[id] = fresh.onboardingStage ?? 'new';
    setStores((all) => all.map((x) => {
      if (x.id !== id) return x;
      const merged = { ...x } as Record<string, unknown>;
      for (const key of Object.keys(sent) as (keyof StoreReg)[]) {
        // `?? null` so an absent local field and a sent null count as equal.
        if ((x[key] ?? null) === (sent[key] ?? null)) merged[key] = fresh[key];
      }
      return merged as StoreReg;
    }));
  };

  const saveStore = async (store: StoreReg) => {
    setSaving(store.id);
    setSaveError(null);
    try {
      const pw = sessionStorage.getItem(SS_PW) ?? '';
      // Kept as a value so the re-sync below can tell which fields this save is
      // actually responsible for, and which the admin has typed over since.
      const sent: Partial<StoreReg> = {
        onboardingStage: store.onboardingStage,
        payoutStatus: store.payoutStatus,
        payoutNotes: store.payoutNotes || null,
        // Installation & hardware — sent as-is; the route normalises blanks to
        // NULL and validates the size/date, so clearing a field really clears it.
        tvBrand:       store.tvBrand ?? null,
        tvModel:       store.tvModel ?? null,
        tvSerial:      store.tvSerial ?? null,
        tvSizeInches:  store.tvSizeInches ?? null,
        tvTag:         store.tvTag ?? null,
        tvInstalledAt: store.tvInstalledAt ?? null,
        espSwitchName: store.espSwitchName ?? null,
        espPlugId:     store.espPlugId ?? null,
        wifiSsid:      store.wifiSsid ?? null,
        wifiAuthType:  store.wifiAuthType ?? null,
        wifiUsername:  store.wifiUsername ?? null,
        wifiPassword:  store.wifiPassword ?? null,
        installNotes:  store.installNotes ?? null,
      };
      const res = await fetch(`/api/admin/stores/${store.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'admin-password': pw },
        body: JSON.stringify(sent),
      });
      if (!res.ok) {
        // Nothing was written — a gate 409 rejects the whole PATCH. Put the
        // stage back to what the server still holds so the card stops badging a
        // stage the DB never took; the typed fields stay so ops can fix and retry.
        const body = await res.json().catch(() => null) as { error?: string; missing?: string[] } | null;
        patchLocal(store.id, { onboardingStage: serverStage.current[store.id] ?? store.onboardingStage });
        setSaveError({
          id: store.id,
          error: body?.error ?? 'Save failed',
          missing: Array.isArray(body?.missing) ? body.missing : [],
        });
        return;
      }
      // Recorded before the re-read so a failed one can't leave the rollback
      // baseline pointing at the pre-save stage.
      serverStage.current[store.id] = store.onboardingStage ?? 'new';
      await resyncStore(store.id, sent);
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

  // Expanding a card gives it `sm:col-span-2`, and CSS grid cannot keep a
  // two-column item in a row where only one column is free — so a card in the
  // right-hand column is re-placed onto the next row the moment you hit Edit.
  // In a long list that lands it below the fold and it reads as "the card
  // vanished". Follow it with the viewport once the new layout is committed.
  // Two frames: the first lands after React's commit, the second after the
  // browser has re-run grid layout, so we scroll to the card's final position.
  const expandStore = (id: string | null) => {
    setExpanded(id);
    if (!id) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById(`store-card-${id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }));
  };

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
  const premium  = stores.filter((s) => s.tier === 'premium').length;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <button onClick={() => load()} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Registered',  value: stores.length },
          { label: 'Live',        value: live },
          { label: 'Pending',     value: pending },
          { label: 'With screen', value: screened },
          { label: 'Premium',     value: premium },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <SignupLinksPanel />
      <PremiumLinkCard />

      <input type="search" placeholder="Search by name, owner, city, phone, referral code…" value={search} onChange={(e) => setSearch(e.target.value)} className={inp} />

      {!filtered.length ? (
        <p className="text-sm text-muted-foreground text-center py-10">{search ? 'No stores match.' : 'No store registrations yet.'}</p>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          {filtered.map((s) => {
            const stage      = s.onboardingStage ?? 'new';
            const isRejected = stage === 'rejected';
            const isExpanded = expanded === s.id;
            const phone      = s.phone || s.whatsapp;
            const waNum      = (phone ?? '').replace(/\D/g, '').slice(-10);
            // GPS-verified shop photo shown as a clean banner — coordinates and
            // capture metadata stay inside the Edit section, photo only here.
            const photo      = s.shopPhotoUrl || s.installPhotoUrl;
            return (
              <motion.div
                key={s.id}
                id={`store-card-${s.id}`}
                variants={fadeIn}
                className={`group overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-lg ${isRejected ? 'border-red-200 opacity-70' : 'border-border'} ${isExpanded ? 'sm:col-span-2 scroll-mt-24' : ''}`}
              >
                {/* Photo banner */}
                <div className="relative h-44 w-full overflow-hidden bg-muted">
                  {photo ? (
                    <a href={photo} target="_blank" rel="noreferrer" title="Open full-size photo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {/* object-top, not the default centre: GPS camera apps burn a
                          map/coordinates banner into the BOTTOM of the frame, and this
                          box is far wider than it is tall, so anchoring to the top makes
                          the container clip that banner away — the card shows the
                          shopfront, not the stamp. Nothing is altered on disk; the full
                          stamped photo is still the evidence and opens on click.
                          origin-top keeps the hover zoom from walking it back into view. */}
                      <img src={photo} alt={`${s.storeName} — shop photo`} loading="lazy"
                        className="h-44 w-full object-cover object-top origin-top transition-transform duration-500 group-hover:scale-[1.04]" />
                    </a>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 via-muted/60 to-muted">
                      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black ${isRejected ? 'bg-red-50 text-red-400 dark:bg-red-500/15 dark:text-red-300' : 'bg-primary/10 text-primary'}`}>
                        {s.storeName[0]?.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">No shop photo yet</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />
                  <span className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STAGE_LABELS[stage] ?? stage}
                  </span>
                  <div className="absolute right-3 top-3 flex items-center gap-1.5">
                    {s.tier === 'premium' && (
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
                        <Star className="h-2.5 w-2.5" /> Premium
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${(s.deviceCount ?? 0) > 0 ? 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300' : 'bg-white/90 text-gray-500 dark:bg-neutral-800/90 dark:text-neutral-300'}`}>
                      <Tv2 className="h-2.5 w-2.5" /> {s.deviceCount ?? 0} screen{(s.deviceCount ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  {/* Name + owner */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-foreground">{s.storeName}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.ownerName}</p>
                    </div>
                    <span className="shrink-0 pt-0.5 text-[10px] text-muted-foreground/50">{fmtDate(s.createdAt)}</span>
                  </div>

                  {/* At-a-glance data */}
                  <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/40 sm:grid-cols-4">
                    {[
                      { label: 'Phone',    value: phone ? `+91 ${waNum}` : '—' },
                      { label: 'Area',     value: [s.locality, s.city].filter(Boolean).join(', ') || '—' },
                      { label: 'Payout',   value: PAYOUT_LABELS[s.payoutStatus ?? 'pending_setup'] ?? s.payoutStatus },
                      s.tier === 'premium'
                        ? { label: 'Comp',   value: `₹${Math.round((s.monthlyCompensationPaise ?? 100000) / 100).toLocaleString('en-IN')}/mo` }
                        : s.liveAt
                          ? { label: 'Live since', value: fmtDate(s.liveAt) }
                          : { label: 'Referral',   value: s.referralCode || '—' },
                    ].map((cell) => (
                      <div key={cell.label} className="bg-card px-2.5 py-2 min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{cell.label}</p>
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-foreground" title={String(cell.value)}>{cell.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
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
                        onClick={() => void openAsPartner(s)}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> View dashboard
                      </button>
                      <button
                        type="button"
                        onClick={() => expandStore(isExpanded ? null : s.id)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${isExpanded ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                      >
                        {isExpanded ? 'Less' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteStore(s.id, s.storeName)}
                        disabled={deleting === s.id}
                        className="ml-auto flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/15"
                      >
                        {deleting === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
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

                    {/* GPS verification photos — evidence behind the stage gates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <AdminPhotoCard label="Shop front" kind="shop" storeId={s.id} onUploaded={(p) => patchLocal(s.id, p)}
                        url={s.shopPhotoUrl} lat={s.shopPhotoLat} lng={s.shopPhotoLng}
                        source={s.shopPhotoSource} at={s.shopPhotoAt}
                        storeLat={s.lat != null ? Number(s.lat) : null} storeLng={s.lng != null ? Number(s.lng) : null} />
                      <AdminPhotoCard label="Installed TV" kind="install" storeId={s.id} onUploaded={(p) => patchLocal(s.id, p)}
                        url={s.installPhotoUrl} lat={s.installPhotoLat} lng={s.installPhotoLng}
                        source={s.installPhotoSource} at={s.installPhotoAt}
                        storeLat={s.lat != null ? Number(s.lat) : null} storeLng={s.lng != null ? Number(s.lng) : null} />
                      <AdminPhotoCard label="Serial plate" kind="serial" storeId={s.id} onUploaded={(p) => patchLocal(s.id, p)}
                        url={s.serialPhotoUrl} lat={s.serialPhotoLat} lng={s.serialPhotoLng}
                        source={s.serialPhotoSource} at={s.serialPhotoAt}
                        storeLat={s.lat != null ? Number(s.lat) : null} storeLng={s.lng != null ? Number(s.lng) : null} />
                      <AdminPhotoCard label="Smart plug" kind="plug" storeId={s.id} onUploaded={(p) => patchLocal(s.id, p)}
                        url={s.plugPhotoUrl} lat={s.plugPhotoLat} lng={s.plugPhotoLng}
                        source={s.plugPhotoSource} at={s.plugPhotoAt}
                        storeLat={s.lat != null ? Number(s.lat) : null} storeLng={s.lng != null ? Number(s.lng) : null} />
                    </div>

                    {/* Installation & hardware — what ops records at the site visit.
                        Saved by the same Save button as the dropdowns below. */}
                    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Installation &amp; hardware</p>
                        {s.tvTag && <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">TV #{s.tvTag}</span>}
                      </div>

                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">TV</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <LabelledInput required label="TV number / tag" value={s.tvTag ?? ''} placeholder="e.g. 27"
                          onChange={(v) => patchLocal(s.id, { tvTag: v })} />
                        <LabelledInput required label="TV company" value={s.tvBrand ?? ''} placeholder="e.g. Foxsky"
                          onChange={(v) => patchLocal(s.id, { tvBrand: v })} />
                        <LabelledInput required label="TV model" value={s.tvModel ?? ''} placeholder="e.g. 43FS-4K"
                          onChange={(v) => patchLocal(s.id, { tvModel: v })} />
                        <LabelledInput required label="TV size (in)" value={s.tvSizeInches != null ? String(s.tvSizeInches) : ''} placeholder="43" type="number"
                          onChange={(v) => patchLocal(s.id, { tvSizeInches: v === '' ? null : Number(v) })} />
                        <LabelledInput required label="TV serial number" value={s.tvSerial ?? ''} placeholder="Back-panel plate"
                          onChange={(v) => patchLocal(s.id, { tvSerial: v })} />
                        <LabelledInput label="Installed on" value={s.tvInstalledAt ? s.tvInstalledAt.slice(0, 10) : ''} type="date"
                          onChange={(v) => patchLocal(s.id, { tvInstalledAt: v || null })} />
                      </div>

                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Network</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <LabelledInput required label="WiFi network name" value={s.wifiSsid ?? ''} placeholder="Shop WiFi"
                          onChange={(v) => patchLocal(s.id, { wifiSsid: v })} />
                        <LabelledSelect required label="WiFi security type" value={s.wifiAuthType ?? ''}
                          onChange={(v) => patchLocal(s.id, { wifiAuthType: v || null })}>
                          <option value="">Select…</option>
                          <option value="wpa_psk">WPA/WPA2 (normal)</option>
                          <option value="pppoe">PPPoE / ISP login</option>
                          <option value="portal">Captive portal</option>
                          <option value="open">Open — no password</option>
                        </LabelledSelect>
                        {/* Only PPPoE and portal networks have a login name; on a
                            plain WPA shop router the field is dead weight. */}
                        {(s.wifiAuthType === 'pppoe' || s.wifiAuthType === 'portal') && (
                          <LabelledInput required label="WiFi username" value={s.wifiUsername ?? ''} placeholder="ISP login id"
                            onChange={(v) => patchLocal(s.id, { wifiUsername: v })} />
                        )}
                        {s.wifiAuthType !== 'open' && (
                          <LabelledInput required label="WiFi password" type="password" value={s.wifiPassword ?? ''} placeholder="••••••"
                            onChange={(v) => patchLocal(s.id, { wifiPassword: v })} />
                        )}
                      </div>

                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Smart plug</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <LabelledInput required label="Smart plug ID" value={s.espPlugId ?? ''} placeholder="Printed on the plug"
                          onChange={(v) => patchLocal(s.id, { espPlugId: v })} />
                        <LabelledInput label="ESP switch name" value={s.espSwitchName ?? ''} placeholder="Sonoff label"
                          onChange={(v) => patchLocal(s.id, { espSwitchName: v })} />
                        <LabelledInput label="Install notes" value={s.installNotes ?? ''} placeholder="Mount, socket…"
                          onChange={(v) => patchLocal(s.id, { installNotes: v })} />
                      </div>

                      <p className="text-[10px] text-muted-foreground/70">
                        <span className="text-primary">*</span> required, with all four photos, before the store can be marked Physically onboarded.
                        Partners can also record the TV number with the installed-TV photo from the app. WiFi credentials are visible to admins only.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <select value={s.onboardingStage ?? 'new'} onChange={(e) => patchLocal(s.id, { onboardingStage: e.target.value })} className={inp}>
                        <option value="new">New</option>
                        <option value="contacted">Contacted / verified</option>
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
                    {saveError?.id === s.id && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
                        <p className="text-[11px] font-semibold text-red-700 dark:text-red-300">{saveError.error}</p>
                        {!!saveError.missing.length && (
                          <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                            {saveError.missing.map((m) => (
                              <li key={m} className="flex items-center gap-1.5 text-[11px] text-red-700 dark:text-red-300">
                                <X className="h-3 w-3 shrink-0" /> {m}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
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
    // adminGetArray, not a bare r.json(): a 401 body parses fine, and letting it
    // reach setCampaigns made the reduce/filter below throw and take the whole
    // dashboard down with "Something went wrong".
    adminGetArray<Campaign>('/api/campaigns/admin')
      .then(setCampaigns)
      .catch(() => setCampaigns([]))
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
  const pending = campaigns.filter((c) => (!c.paymentId || c.paymentId === 'pending') && c.status !== 'trial').length;

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
                const isPaid  = c.paymentId && c.paymentId !== 'pending';
                const isTrial = c.status === 'trial';
                return (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{c.brandName || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground"><p>{c.contactName}</p><p className="text-[10px] text-muted-foreground/60">{c.email}</p></td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {c.screens} × {c.months}mo
                      {(c.preferredStores?.length ?? 0) > 0 && (
                        <p
                          className="text-[10px] text-primary/80 mt-0.5 max-w-[160px] truncate"
                          title={c.preferredStores!.map((s) => `${s.storeName}${s.locality ? ` (${s.locality})` : ''}`).join(', ')}
                        >
                          📍 {c.preferredStores!.map((s) => s.storeName).join(', ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{fmt(c.totalAmount ?? 0)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={isPaid ? 'success' : isTrial ? 'info' : 'warning'} className="text-[10px] py-0.5 px-2 font-bold whitespace-nowrap">
                        {isPaid ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                        {isPaid ? 'Paid' : isTrial ? 'Trial' : 'Pay later'}
                      </Badge>
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
  // Today's slot occupancy across every slot-mode store. capacity 0 = none configured.
  slots:     { sold: number; capacity: number };
};

/** Today's IST calendar date — slot inventory is keyed by IST day, not UTC. */
const istToday = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Network-wide slot occupancy for today, from /api/slots/availability.
 * `sold` is per store per date; a null entry means the store is closed that day
 * and contributes no capacity.
 */
function slotTotals(res: unknown): { sold: number; capacity: number } {
  const stores = (res as { stores?: { loopSlotCount: number | null; sold: Record<string, number | null> | null }[] })?.stores ?? [];
  const day = istToday();
  let sold = 0, capacity = 0;
  for (const s of stores) {
    if (s.loopSlotCount == null) continue;      // not a slot-mode store
    const n = s.sold?.[day];
    if (n == null) continue;                    // closed today
    sold += n;
    capacity += s.loopSlotCount;
  }
  return { sold, capacity };
}

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

// ─── KPI Row ──────────────────────────────────────────────────────────────────

function KpiRow({ stats, onNav }: { stats: OpsStats | null; onNav: (t: Tab) => void }) {
  if (!stats) return (
    <div className="kpi-row">
      {[0,1,2,3].map((i) => (
        <div key={i} className="kpi">
          <div className="kpi__head"><span className="kpi__label" style={{ background: 'var(--neutral-100)', borderRadius: 4, width: 80, height: 12, display: 'inline-block' }}></span></div>
          <div className="kpi__value" style={{ background: 'var(--neutral-100)', borderRadius: 4, width: 60, height: 32, display: 'inline-block' }}></div>
        </div>
      ))}
    </div>
  );

  // What an operator actually needs off the landing screen: what is broken, what
  // is earning, who is live, what is running. Library file counts are inventory
  // trivia and belong in Creatives, not here.
  const dark = stats.screens.offline + stats.screens.pending;
  const slotPct = stats.slots.capacity > 0
    ? Math.round((stats.slots.sold / stats.slots.capacity) * 100)
    : null;

  const cards: {
    label: string; icon: React.ReactNode; value: string; sub?: string; note: string;
    tab: Tab; alarm?: boolean;
  }[] = [
    {
      label: 'Screens dark', icon: <MonitorPlay className="h-4 w-4" />,
      value: dark.toLocaleString(),
      sub: `/ ${stats.screens.total}`,
      note: stats.screens.pending > 0
        ? `${stats.screens.offline} offline · ${stats.screens.pending} pending`
        : dark > 0 ? 'needs attention' : 'all screens live',
      tab: 'screens',
      alarm: dark > 0,
    },
    {
      label: 'Slots filled today', icon: <Grid3x3 className="h-4 w-4" />,
      value: slotPct == null ? '—' : `${slotPct}%`,
      sub: slotPct == null ? undefined : `${stats.slots.sold} / ${stats.slots.capacity}`,
      note: slotPct == null ? 'no slot-mode stores' : 'sold across the network',
      tab: 'programming',
    },
    {
      label: 'Stores live', icon: <Store className="h-4 w-4" />,
      value: stats.stores.live.toLocaleString(),
      sub: `/ ${stats.stores.total}`,
      note: 'partners running',
      tab: 'stores',
    },
    {
      label: 'Campaigns paid', icon: <Megaphone className="h-4 w-4" />,
      value: stats.campaigns.paid.toLocaleString(),
      sub: `/ ${stats.campaigns.total}`,
      note: 'booked and paid',
      tab: 'campaigns',
    },
  ];

  return (
    <div className="kpi-row">
      {cards.map((k) => (
        <button
          key={k.label}
          onClick={() => onNav(k.tab)}
          className={`kpi kpi--link${k.alarm ? ' kpi--alarm' : ''}`}
        >
          <div className="kpi__head">
            <span className="kpi__icon">{k.icon}</span>
            <span className="kpi__label">{k.label}</span>
          </div>
          <div>
            <span className="kpi__value">{k.value}</span>
            {k.sub && <span className="kpi__value-sub"> {k.sub}</span>}
          </div>
          <div className="kpi__foot">
            <span className="kpi__period">{k.note}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Device Feed Card ─────────────────────────────────────────────────────────

type DeviceRow2 = { id: string; name?: string; storeName?: string; status: string; lastSeen?: string | null; locality?: string | null };

function DeviceFeedCard({ devices }: { devices: DeviceRow2[] }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? devices : devices.filter((d) => d.status.toUpperCase() === filter.toUpperCase());
  const online  = devices.filter((d) => d.status === 'ONLINE').length;
  const offline = devices.filter((d) => d.status === 'OFFLINE').length;
  const pending = devices.filter((d) => d.status === 'PENDING').length;

  function statusDot(s: string) {
    if (s === 'ONLINE')  return 'feed-item__dot feed-item__dot--live';
    if (s === 'OFFLINE') return 'feed-item__dot feed-item__dot--offline';
    return 'feed-item__dot feed-item__dot--idle';
  }

  function lastSeenLabel(iso: string | null | undefined) {
    if (!iso) return 'never seen';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 2) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  if (!devices.length) return (
    <div className="card">
      <div className="card__head"><h3 className="card__title">Screen network</h3></div>
      <p className="muted" style={{ padding: '24px 0', textAlign: 'center', fontSize: 13 }}>No screens registered yet.</p>
    </div>
  );

  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h3 className="card__title">Screen network</h3>
          <p className="card__sub">{devices.length} registered · real-time status</p>
        </div>
      </div>
      <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className={`chip${filter === 'all' ? ' chip--active' : ''}`} onClick={() => setFilter('all')}>All · {devices.length}</button>
        {online  > 0 && <button className={`chip${filter === 'ONLINE'  ? ' chip--active' : ''}`} onClick={() => setFilter('ONLINE')}>Online · {online}</button>}
        {offline > 0 && <button className={`chip${filter === 'OFFLINE' ? ' chip--active' : ''}`} onClick={() => setFilter('OFFLINE')}>Offline · {offline}</button>}
        {pending > 0 && <button className={`chip${filter === 'PENDING' ? ' chip--active' : ''}`} onClick={() => setFilter('PENDING')}>Pending · {pending}</button>}
      </div>
      <div className="feed">
        {filtered.slice(0, 10).map((d) => (
          <div key={d.id} className="feed-item">
            <span className={statusDot(d.status)}></span>
            <div className="feed-item__main">
              <div className="feed-item__name">{d.storeName || d.name || d.id.slice(0, 8)}{d.locality ? <span className="feed-item__area"> · {d.locality}</span> : null}</div>
              <div className="feed-item__sub">Last seen {lastSeenLabel(d.lastSeen)}</div>
            </div>
            <div>
              <div className={`feed-item__val`} style={{ fontSize: 11, fontWeight: 600, color: d.status === 'ONLINE' ? '#16a34a' : d.status === 'OFFLINE' ? '#dc2626' : '#b45309' }}>
                {d.status.toLowerCase()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ticker ───────────────────────────────────────────────────────────────────

function Ticker({ stats }: { stats: OpsStats | null }) {
  if (!stats) return null;
  const items = [
    stats.screens.online > 0 ? `${stats.screens.online} screens online` : null,
    stats.screens.offline > 0 ? `${stats.screens.offline} screens offline` : null,
    stats.schedules.active > 0 ? `${stats.schedules.active} active schedule${stats.schedules.active !== 1 ? 's' : ''}` : null,
    stats.stores.total > 0 ? `${stats.stores.total} store partner${stats.stores.total !== 1 ? 's' : ''} registered` : null,
    stats.campaigns.total > 0 ? `${stats.campaigns.total} campaign${stats.campaigns.total !== 1 ? 's' : ''} · ${stats.campaigns.paid} paid` : null,
    stats.content.count > 0 ? `${stats.content.count} content files in library` : null,
  ].filter(Boolean) as string[];

  if (!items.length) return null;

  return (
    <div className="ticker">
      <div className="ticker__pill">Live wire</div>
      {/* The track is translateX-animated; without this clipping viewport it
          slides straight over the pill on its way left. */}
      <div className="ticker__viewport">
        <div className="ticker__track">
          {[...items, ...items].map((text, i) => (
            <span key={i} className="ticker__item">
              <span>{text}</span>
              <span className="ticker__dot">●</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Command Palette ──────────────────────────────────────────────────────────

// Every item carries its own action — a tab to switch to or an href to open in
// a new tab — so an entry can't ship as dead chrome (the old external tabMap
// silently no-opped any label it didn't know about).
const PALETTE_GROUPS: {
  label: string;
  items: { icon: React.ElementType; label: string; hint?: string; tab?: Tab; href?: string }[];
}[] = [
  {
    label: 'Pages',
    items: [
      { icon: LayoutDashboard, label: 'Go to Overview',       hint: 'G then O', tab: 'overview'  },
      { icon: Megaphone,       label: 'Go to Campaigns',      hint: 'G then C', tab: 'campaigns' },
      { icon: Store,           label: 'Go to Store partners', hint: 'G then K', tab: 'stores'    },
      { icon: IndianRupee,     label: 'Go to Payouts',        hint: 'G then P', tab: 'payments'  },
    ],
  },
  {
    label: 'Actions',
    items: [
      { icon: Plus,        label: 'New campaign',             hint: '⌘N',  href: '/brand-onboarding' },
      { icon: Upload,      label: 'Upload 8-second creative', hint: '⌘U',  tab: 'content'            },
      { icon: Store,       label: 'Onboard a kirana',         hint: '⌘⇧K', href: '/store'            },
      { icon: IndianRupee, label: 'Release monthly payouts',  tab: 'payments'                        },
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
                      if (it.tab) onNav(it.tab);
                      else if (it.href) window.open(it.href, '_blank');
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

// ─── New Sidebar Nav ──────────────────────────────────────────────────────────

const NAV_DESIGN: { group: string | null; items: { id: Tab; label: string; icon: React.ElementType; count: number | null }[] }[] = [
  {
    group: null,
    items: [
      { id: 'overview' as Tab,   label: 'Overview',         icon: LayoutDashboard, count: null },
      { id: 'campaigns' as Tab,  label: 'Campaigns',        icon: Megaphone,       count: null },
      { id: 'compositions' as Tab, label: 'Compositions',     icon: CalendarClock,   count: null },
    ],
  },
  {
    group: 'Network',
    items: [
      { id: 'stores' as Tab,     label: 'Store partners',  icon: Store,           count: null },
      { id: 'screens' as Tab,    label: 'Screens',          icon: Tv2,             count: null },
      { id: 'programming' as Tab, label: 'Programming',      icon: LayoutGrid,      count: null },
      { id: 'power' as Tab,      label: 'Power',            icon: Zap,             count: null },
      { id: 'monitoring' as Tab, label: 'Monitoring',       icon: Activity,        count: null },
      { id: 'footfall' as Tab,   label: 'Footfall',         icon: Radar,           count: null },
      { id: 'qr' as Tab,         label: 'QR codes',         icon: QrCode,          count: null },
    ],
  },
  {
    group: 'Finance',
    items: [
      { id: 'payments' as Tab,   label: 'Payouts',          icon: IndianRupee,     count: null },
      { id: 'coupons' as Tab,    label: 'Coupons',          icon: Ticket,          count: null },
      { id: 'reports' as Tab,    label: 'Reports',          icon: FileBarChart2,   count: null },
      { id: 'pop' as Tab,        label: 'Proof of Play',    icon: MonitorPlay,     count: null },
    ],
  },
  {
    group: 'Admin',
    items: [
      { id: 'flyers' as Tab,     label: 'Flyers',           icon: FileImage,       count: null },
      { id: 'layouts' as Tab,    label: 'Layouts',          icon: Layers,          count: null },
      { id: 'media' as Tab,      label: 'Media',            icon: Images,          count: null },
      { id: 'products' as Tab,   label: 'Products',         icon: Package,         count: null },
      { id: 'team' as Tab,       label: 'Team',             icon: Users,           count: null },
      { id: 'alerts' as Tab,     label: 'Alerts',           icon: Bell,            count: null },
      { id: 'roadmap' as Tab,    label: 'Platform',         icon: Map,             count: null },
    ],
  },
];

function SidebarNav({ tab, onTab, onSignOut, liveCount, email }: {
  tab: Tab; onTab: (t: Tab) => void; onSignOut: () => void; liveCount: number; email: string | null;
}) {
  return (
    <aside className="sb">
      <div className="sb__logo">
        <Logo />
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
        {/* Named logins are the point of the current auth model, so this says who
            you actually are — a generic "ALIVE Admin" gives an operator no way to
            notice they are signed in as a colleague. */}
        <button className="sb__user" onClick={onSignOut} title={email ? `Sign out ${email}` : 'Sign out'}>
          <div className="sb__avatar">{(email?.[0] ?? 'A').toUpperCase()}</div>
          <div className="sb__user-meta">
            <div className="sb__user-name">{email?.split('@')[0] ?? 'ALIVE Admin'}</div>
            <div className="sb__user-role">{email ? 'Sign out' : 'Network Admin'}</div>
          </div>
          <LogOut className="h-3.5 w-3.5" style={{ color: 'var(--neutral-400)', marginLeft: 'auto' }} />
        </button>
      </div>
    </aside>
  );
}

// ─── New Topbar ───────────────────────────────────────────────────────────────

function Topbar({ section, liveCount, onOpenCmd, onOpenNotif, unread, stats, onNav }: {
  section: string; liveCount: number; onOpenCmd: () => void; onOpenNotif: () => void;
  unread: number; stats: OpsStats | null; onNav: (t: Tab) => void;
}) {
  const exportSnapshot = () => {
    if (!stats) return;
    const rows: [string, number][] = [
      ['Screens online', stats.screens.online],
      ['Screens offline', stats.screens.offline],
      ['Active schedules', stats.schedules.active],
      ['Store partners', stats.stores.total],
      ['Campaigns', stats.campaigns.total],
      ['Campaigns paid', stats.campaigns.paid],
      ['Content files', stats.content.count],
    ];
    const csv = ['Metric,Value', ...rows.map(([k, v]) => `${k},${v}`)].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `alive-snapshot-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <header className="tb">
      <div className="tb__crumbs">
        <span>Network 027</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <strong>{section}</strong>
      </div>
      <button className="tb__search" onClick={onOpenCmd}>
        <Search className="h-3.5 w-3.5" />
        <span className="tb__search-label">
          Search stores, brands, campaigns, screens…
        </span>
        <span className="tb__kbd">⌘K</span>
      </button>
      <div className="tb__spacer"></div>
      <span className="live-pill">Live · {liveCount} screens</span>
      <div className="tb__divider"></div>
      <button className="tb__icon-btn" title="Network status" onClick={() => onNav('monitoring')}><Activity className="h-4 w-4" /></button>
      <button
        className={`tb__icon-btn${unread > 0 ? ' tb__icon-btn--dot' : ''}`}
        title="Notifications"
        onClick={onOpenNotif}
      >
        <Bell className="h-4 w-4" />
      </button>
      <button className="tb__icon-btn" title="Help" onClick={() => onNav('roadmap')}><LifeBuoy className="h-4 w-4" /></button>
      <div className="tb__divider"></div>
      <button className="btn btn--outline btn--sm" onClick={exportSnapshot} disabled={!stats} title="Download today's network snapshot as CSV">
        <Download className="h-3 w-3" /> Export
      </button>
      {/* Opens the booking flow, not the Campaigns tab: the tab is a read-only
          list with no create UI (campaigns are only born through brand-onboarding,
          booked on behalf of the brand), so navigating there looked like a no-op. */}
      <button
        className="btn btn--primary btn--sm"
        onClick={() => window.open('/brand-onboarding', '_blank')}
      >
        <Plus className="h-3 w-3" /> New Campaign
      </button>
    </header>
  );
}

// ─── Overview Panel ───────────────────────────────────────────────────────────

function OverviewPanel({ onNav }: { onNav: (t: Tab) => void }) {
  const [stats,   setStats]   = useState<OpsStats | null>(null);
  const [devices, setDevices] = useState<DeviceRow2[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pw = sessionStorage.getItem(SS_PW) ?? '';
    const h  = { 'admin-password': pw };
    const now = new Date().toISOString();
    Promise.all([
      fetch('/api/devices',        { headers: h }).then((r) => r.ok ? r.json() : { devices: [] }),
      fetch('/api/schedules',      { headers: h }).then((r) => r.ok ? r.json() : { schedules: [] }),
      fetch('/api/content',        { headers: h }).then((r) => r.ok ? r.json() : { content: [], totalBytes: 0 }),
      fetch('/api/stores/save',    { headers: h }).then((r) => r.ok ? r.json() : []),
      fetch('/api/campaigns/admin',{ headers: h }).then((r) => r.ok ? r.json() : []),
      fetch(`/api/slots/availability?from=${istToday()}&to=${istToday()}`, { headers: h })
        .then((r) => r.ok ? r.json() : { stores: [] }),
    ]).then(([devR, schR, ctR, stR, cmR, slR]) => {
      const devs = (devR.devices ?? []) as DeviceRow2[];
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
        stores:    { total: sts.length, live: sts.filter((s: { onboardingStage?: string }) => s.onboardingStage === 'live').length },
        campaigns: { total: cms.length, paid: cms.filter((c: { paymentId?: string }) => c.paymentId && c.paymentId !== 'pending').length },
        slots:     slotTotals(slR),
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title">
            <span className="red">Dashboard</span>
          </h1>
          <p className="page__sub">
            {loading ? 'Loading network status…' : stats
              ? `${stats.screens.online} of ${stats.screens.total} screens online · ${stats.schedules.active} active schedule${stats.schedules.active !== 1 ? 's' : ''} · ${stats.stores.total} store partner${stats.stores.total !== 1 ? 's' : ''}`
              : 'ALIVE network · Mangaluru'}
          </p>
        </div>
      </div>

      <SectionLabel n={1} label="Performance" />
      <KpiRow stats={stats} onNav={onNav} />

      <SectionLabel n={2} label="Network" />
      <DeviceFeedCard devices={devices} />

      <SectionLabel n={3} label="Store app" />
      <AppPreviewCard />
    </>
  );
}

// ─── Admin sign-in ────────────────────────────────────────────────────────────
//
// Two doors, deliberately unequal.
//
// "Staff account" is the real one: a named ADMIN/OPS user + password + TOTP,
// which mints a next-auth session. Every action downstream then carries a user
// id and can be attributed, and offboarding someone is a role change rather than
// a fleet-wide secret rotation.
//
// "Shared password" is the legacy door, kept working only until the last route
// stops reading ADMIN_PASSWORD. It is second and de-emphasised on purpose: it
// authenticates a secret, not a person, so nothing done through it can ever be
// pinned to anyone.

const FIELD =
  'w-full h-12 rounded-xl border border-border bg-card px-4 text-sm ' +
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';

const ERR_BOX =
  'text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2';

function AdminLogin({ onAuth }: { onAuth: () => void }) {
  // 'legacy' (shared-password) mode is GONE — the console is named-accounts only.
  const [mode,     setMode]     = useState<'account' | 'link'>('account');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [totp,     setTotp]     = useState('');
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState<string | null>(null);

  // Self-service access: type a work address, get a one-time link that sets a
  // password. No admin has to invite anyone.
  //
  // The response is deliberately the same whether the address is known, new, or
  // rate-limited — the server refuses to be an oracle for which staff addresses
  // exist. So this shows one confirmation and does NOT branch on the outcome.
  const submitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setLinkNote(null);
    try {
      const res  = await fetch('/api/admin/login-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json() as { ok?: boolean; message?: string; error?: string; devLink?: string };
      if (!res.ok || body.error) setErr(body.error ?? 'Could not send the link.');
      // devLink is only ever present on a dev server with no mail configured —
      // the route refuses to include it in production. Surfaced so the flow can
      // be walked end-to-end before SMTP exists.
      else if (body.devLink) setLinkNote(`No mail configured (dev only) — open this link: ${body.devLink}`);
      else setLinkNote(body.message ?? 'Check your inbox.');
    } catch { setErr('Could not send the link. Try again.'); }
    finally   { setBusy(false); }
  };

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await signIn('admin-mfa', { email, password, totp, redirect: false });
      // `ok` alone is NOT sufficient. Auth.js v5 resolves a rejected credentials
      // sign-in with ok:true AND error:'CredentialsSignin' — so trusting ok by
      // itself marked the operator as signed in while the server had created no
      // session at all. The console then rendered normally and every single API
      // call returned 401, which reads like a broken backend rather than a failed
      // login. Both conditions, always.
      if (res?.ok && !res.error) {
        // Only the "I'm past the gate" flag is stored — never a credential. The
        // session cookie is what authorizes every admin API call now (requireAdmin
        // reads it directly); the browser holds no shared secret.
        sessionStorage.setItem('alive_admin', '1');
        onAuth();
      } else {
        // One message for every failure. Naming the wrong factor would confirm
        // that an address belongs to an admin, and would tell someone holding a
        // stolen password that a code is all they still need.
        setErr('Incorrect email, password, or 2FA code.');
      }
    } catch { setErr('Sign-in failed. Try again.'); }
    finally   { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity inline-block mb-8"><Logo /></a>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-1">Admin</p>
          <h1 className="text-3xl font-bold text-foreground">
            {mode === 'account' ? 'Sign in' : 'Get a sign-in link'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Restricted to Alive staff.</p>
        </div>

        {mode === 'account' ? (
          <form onSubmit={submitAccount} className="space-y-3">
            <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@wearealive.in" autoComplete="username" className={FIELD} />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Password" autoComplete="current-password" className={FIELD} />
            <input
              type="text" value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="2FA code" inputMode="numeric" autoComplete="one-time-code"
              className={FIELD + ' tracking-[0.3em] font-mono'} />
            <p className="text-xs text-muted-foreground">
              Leave the code blank if you haven&apos;t set up 2FA yet — you&apos;ll be asked to on the next screen.
            </p>
            {err && <p className={ERR_BOX}>{err}</p>}
            <button type="submit" disabled={busy || !email || !password}
              className="w-full h-11 rounded-xl bg-primary text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </button>
            <button type="button" onClick={() => { setMode('link'); setErr(null); }}
              className="w-full text-xs font-semibold text-primary hover:underline pt-1">
              First time here, or forgotten your password? Email me a sign-in link
            </button>
          </form>
        ) : (
          <form onSubmit={submitLink} className="space-y-3">
            <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@wearealive.in" autoComplete="username" className={FIELD} />
            <p className="text-xs text-muted-foreground">
              Enter your <strong>@wearealive.in</strong> work address. We&apos;ll email you a
              one-time link to set a password — it arrives within a few seconds and
              works once.
            </p>
            {err && <p className={ERR_BOX}>{err}</p>}
            {linkNote && (
              <p className="text-xs text-green-700 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                {linkNote}
              </p>
            )}
            <button type="submit" disabled={busy || !email}
              className="w-full h-11 rounded-xl bg-primary text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Email me a link'}
            </button>
            <button type="button" onClick={() => { setMode('account'); setErr(null); setLinkNote(null); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors pt-1">
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Forced 2FA enrolment ─────────────────────────────────────────────────────
//
// Shown to a signed-in named admin with no active second factor. There is no
// "skip" — an ADMIN/OPS account protected by a password alone is exactly what
// this work exists to remove, and an optional prompt is one nobody finishes.
//
// The seed is written by POST but stays untrusted until PUT verifies a live
// code, so abandoning this screen leaves the account exactly as it was.

function MfaEnrolment({ email, onDone }: { email: string | null; onDone: () => void }) {
  const [uri,    setUri]    = useState<string | null>(null);
  const [secret, setSecret] = useState('');
  const [code,   setCode]   = useState('');
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Shown once, after activation. Holding the screen here rather than calling
  // onDone() immediately is the whole point: these are the only way back in if
  // the authenticator is lost, and the server keeps no plaintext copy.
  const [codes,      setCodes]      = useState<string[] | null>(null);
  const [codesSaved, setCodesSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/admin/mfa', { method: 'POST' });
        const b = await r.json() as { secret?: string; otpauthUri?: string; error?: string };
        if (cancelled) return;
        if (!r.ok || !b.otpauthUri) { setErr(b.error ?? 'Could not start enrolment.'); return; }
        setSecret(b.secret ?? '');
        setUri(b.otpauthUri);
      } catch { if (!cancelled) setErr('Could not start enrolment.'); }
    })();
    return () => { cancelled = true; };
  }, []);

  const activate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/admin/mfa', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code }),
      });
      const b = await r.json() as { ok?: boolean; error?: string; backupCodes?: string[] };
      if (r.ok && b.ok) {
        // 2FA is active from here. Show the recovery codes before leaving —
        // they are never retrievable again.
        if (b.backupCodes?.length) setCodes(b.backupCodes);
        else onDone();
      }
      else setErr(b.error ?? 'That code is not valid.');
    } catch { setErr('Could not verify the code.'); }
    finally   { setBusy(false); }
  };

  // ── Recovery codes — shown once, immediately after activation ──────────────
  if (codes) {
    const asText = codes.join('\n');
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <a href="/" className="opacity-70 hover:opacity-100 transition-opacity inline-block mb-8"><Logo /></a>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-1 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Save your recovery codes
            </p>
            <h1 className="text-2xl font-black tracking-tight">2FA is on</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Each code signs you in once if you lose your phone. Store them somewhere
              you can reach without this console. <strong>They are shown only now</strong> —
              we keep no copy.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-gray-50 p-4 font-mono text-sm">
            {codes.map((c) => <div key={c} className="tracking-wider">{c}</div>)}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { void navigator.clipboard.writeText(asText); setCopied(true); }}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                `ALIVE admin 2FA recovery codes\n${email ?? ''}\nGenerated ${new Date().toISOString()}\n\n${asText}\n`,
              )}`}
              download="alive-2fa-recovery-codes.txt"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-center hover:bg-gray-50"
            >
              Download
            </a>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={codesSaved} onChange={(e) => setCodesSaved(e.target.checked)} className="mt-1" />
            <span>I have saved these codes somewhere safe.</span>
          </label>

          <button
            type="button"
            disabled={!codesSaved}
            onClick={onDone}
            className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Continue to the console
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity inline-block mb-8"><Logo /></a>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-1 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Set up 2FA
          </p>
          <h1 className="text-3xl font-bold text-foreground">One more step</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {email ? <>Securing <span className="font-medium text-foreground">{email}</span>. </> : null}
            Scan this with Google Authenticator, 1Password, or any TOTP app.
          </p>
        </div>

        {!uri && !err && (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {uri && (
          <>
            <div className="flex justify-center rounded-xl border border-border bg-white p-4">
              <QRCodeSVG value={uri} size={168} level="M" />
            </div>
            <button type="button"
              onClick={() => { navigator.clipboard.writeText(secret).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {}); }}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-center font-mono text-xs tracking-wider text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
              {copied ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-700" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> {secret}</>}
            </button>
            <form onSubmit={activate} className="space-y-3">
              <input
                type="text" required autoFocus value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" inputMode="numeric" autoComplete="one-time-code"
                className={FIELD + ' text-center tracking-[0.4em] font-mono text-base'} />
              {err && <p className={ERR_BOX}>{err}</p>}
              <button type="submit" disabled={busy || code.length !== 6}
                className="w-full h-11 rounded-xl bg-primary text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Turn on 2FA'}
              </button>
            </form>
          </>
        )}

        {err && !uri && <p className={ERR_BOX}>{err}</p>}

        <button type="button"
          onClick={() => { authSignOut({ redirect: false }).finally(() => { sessionStorage.removeItem('alive_admin'); window.location.reload(); }); }}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function Dashboard({ email }: { email: string | null }) {
  const [tab,         setTab]         = useState<Tab>('overview');
  const [refreshKey,  setRefreshKey]  = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen,     setCmdOpen]     = useState(false);
  const [adminPw,     setAdminPw]     = useState('');
  const [liveCount,   setLiveCount]   = useState(0);
  const [alertCount,  setAlertCount]  = useState(0);
  // Device-offline alerts are server-side now (DeviceAlert rows). They're kept
  // separate from the derived count below so the two can't double-count the
  // same offline screen.
  const [offlineAlertCount, setOfflineAlertCount] = useState(0);
  const [tickerStats, setTickerStats] = useState<OpsStats | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Prefetch alert count + live network stats for the ticker
  useEffect(() => {
    const pw = sessionStorage.getItem(SS_PW) ?? '';
    setAdminPw(pw);
    // Quick count of unread alerts (offline devices + pending campaigns/stores)
    const h = { 'admin-password': pw };
    const dismissed: string[] = (() => {
      try { return JSON.parse(localStorage.getItem('alive_admin_dismissed_alerts') ?? '[]') as string[]; }
      catch { return []; }
    })();
    const now = new Date().toISOString();
    Promise.all([
      fetch('/api/devices',         { headers: h }).then((r) => r.ok ? r.json() : { devices: [] }),
      fetch('/api/schedules',       { headers: h }).then((r) => r.ok ? r.json() : { schedules: [] }),
      fetch('/api/content',         { headers: h }).then((r) => r.ok ? r.json() : { content: [], totalBytes: 0 }),
      fetch('/api/stores/save',     { headers: h }).then((r) => r.ok ? r.json() : []),
      fetch('/api/campaigns/admin', { headers: h }).then((r) => r.ok ? r.json() : []),
    ]).then(([devR, schR, ctR, stR, cmR]) => {
      const devs = (devR.devices ?? []) as { id: string; status: string }[];
      const schs = (schR.schedules ?? []) as { startAt: string; endAt: string }[];
      const cts  = (ctR.content ?? []) as unknown[];
      const cms  = Array.isArray(cmR) ? cmR : [] as { paymentId?: string; status?: string }[];
      const sts  = Array.isArray(stR) ? stR : (stR?.data ?? []) as { id: string; createdAt: string; onboardingStage?: string }[];
      let count = 0;
      // Offline screens are counted by OfflineAlertWatcher from /api/admin/alerts.
      const pendingDevs = devs.filter((d) => d.status === 'PENDING');
      if (pendingDevs.length > 0 && !dismissed.includes('devices-pending')) count++;
      const pendingCms = cms.filter((c) => (c as { paymentId?: string }).paymentId === 'pending' || (c as { status?: string }).status === 'upcoming');
      if (pendingCms.length > 0 && !dismissed.includes('campaigns-pending-payment')) count++;
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const newSts = sts.filter((s) => s.createdAt > cutoff && (!s.onboardingStage || s.onboardingStage === 'new'));
      if (newSts.length > 0) {
        const id = `stores-new-${newSts.map((s: { id: string }) => s.id).join('-')}`;
        if (!dismissed.includes(id)) count++;
      }
      setAlertCount(count);
      setLiveCount(devs.filter((d) => d.status === 'ONLINE').length);
      setTickerStats({
        screens:   {
          online:  devs.filter((d) => d.status === 'ONLINE').length,
          offline: devs.filter((d) => d.status === 'OFFLINE').length,
          pending: pendingDevs.length,
          total:   devs.length,
        },
        schedules: {
          active: schs.filter((s) => s.startAt <= now && s.endAt >= now).length,
          total:  schs.length,
        },
        content:   { count: cts.length, totalMB: ctR.totalBytes ? ctR.totalBytes / (1024 * 1024) : 0 },
        stores:    { total: sts.length, live: sts.filter((s: { onboardingStage?: string }) => s.onboardingStage === 'live').length },
        campaigns: { total: cms.length, paid: cms.filter((c: { paymentId?: string }) => c.paymentId && c.paymentId !== 'pending').length },
        slots:     { sold: 0, capacity: 0 },
      });
    }).catch(() => {});
  }, []);

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
  // Stable identity so OfflineAlertWatcher's effect doesn't re-subscribe (and
  // re-prime, losing its seen-set) on every render of this shell.
  const openAlertsTab = useCallback(() => { setTab('alerts'); setSidebarOpen(false); }, []);
  const signOut = () => {
    sessionStorage.removeItem('alive_admin');
    sessionStorage.removeItem(SS_PW);
    // Also drop the next-auth cookie. Without this a named admin "signs out",
    // reloads, and the session probe walks them straight back in — the session,
    // not sessionStorage, is what actually authorises them now. Harmless no-op
    // for a legacy shared-password login.
    authSignOut({ redirect: false }).finally(() => window.location.reload());
  };

  const sectionName: Record<Tab, string> = {
    overview:   'Overview',
    campaigns:  'Campaigns',
    slots:      'Slot inventory',
    power:      'Power',
    qr:         'QR codes',
    content:    'Creatives',
    compositions: 'Compositions',
    stores:       'Store Partners',
    screens:      'Screens',
    programming:  'Programming',
    monitoring: 'Monitoring',
    footfall:   'Footfall',
    payments:   'Payouts',
    coupons:    'Coupons',
    reports:    'Reports',
    pop:        'Proof of Play',
    flyers:     'Flyers',
    layouts:    'Layouts',
    media:      'Media',
    products:   'Products',
    alerts:     'Alerts',
    team:       'Team',
    roadmap:    'Platform',
  };

  return (
    // Light-only: the theme toggle was removed, so this is fixed rather than
    // stateful. The dark rules in admin.css stay keyed on data-theme="dark" and
    // are simply unreachable — set this back to a theme state to re-enable.
    <div className="adm app" ref={containerRef} data-theme="light">
      {/* Pops a toast the moment a screen drops, and keeps the bell count live */}
      <OfflineAlertWatcher
        onUnreadChange={setOfflineAlertCount}
        onOpenAlerts={openAlertsTab}
      />
      <SidebarNav tab={tab} onTab={handleNav} onSignOut={signOut} liveCount={liveCount} email={email} />

      <main className="main">
        <Topbar
          section={sectionName[tab] ?? tab}
          liveCount={liveCount}
          onOpenCmd={() => setCmdOpen(true)}
          onOpenNotif={() => handleNav('alerts')}
          unread={alertCount + offlineAlertCount}
          stats={tickerStats}
          onNav={handleNav}
        />
        <Ticker stats={tickerStats} />

        <div className="page">
          {/* No AnimatePresence here: mode="wait" deadlocks under React Strict
              Mode's double-mount in dev (exit never completes, so the next tab
              never mounts — the sidebar highlights but content stays frozen).
              A keyed motion.div gives the same enter fade with instant swap. */}
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {tab === 'overview'   && <OverviewPanel onNav={handleNav} />}
              {tab === 'flyers'     && (
                <div className="grid-2">
                  <div className="space-y-4">
                    <AutoFlyerPanel adminPassword={adminPw} onSaved={() => setRefreshKey((k) => k + 1)} />
                    <UploadPanel onSaved={() => setRefreshKey((k) => k + 1)} />
                  </div>
                  <FlyersList refresh={refreshKey} />
                </div>
              )}
              {tab === 'stores'     && <StoresPanel />}
              {tab === 'campaigns'  && <CampaignsPanel />}
              {tab === 'payments'   && <StorePaymentsTab adminPassword={adminPw} />}
              {tab === 'coupons'    && <CouponsTab />}
              {tab === 'team'       && <TeamTab />}
              {tab === 'screens'    && <ScreensTab />}
              {tab === 'content'    && <ContentTab />}
              {tab === 'programming'   && <ProgrammingTab />}
              {tab === 'slots'      && <SlotsTab />}
              {tab === 'power'      && <PowerTab />}
              {tab === 'qr'         && <QrTab />}
              {tab === 'compositions' && <CompositionsTab />}
              {tab === 'layouts'    && <LayoutsTab />}
              {tab === 'reports'    && <ReportsTab />}
              {tab === 'pop'        && <ProofOfPlayTab />}
              {tab === 'monitoring' && <MonitoringTab />}
              {tab === 'footfall'   && <FootfallTab />}
              {tab === 'alerts'    && <AlertsTab onNav={(t) => handleNav(t as Tab)} />}
              {tab === 'media'      && <SiteMediaTab adminPassword={adminPw} />}
              {tab === 'products'   && <ProductsTab adminPw={adminPw} />}
              {tab === 'roadmap'    && <RoadmapTab />}
            </motion.div>
        </div>
      </main>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onNav={handleNav} />
    </div>
  );
}

// ─── Root export ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [state, setState] = useState<'checking' | 'login' | 'enrol' | 'ready'>('checking');
  const [email, setEmail] = useState<string | null>(null);

  // GET /api/admin/mfa answers only for a *named* session. A 200 means "real
  // account", and its `enrolled` flag decides whether 2FA setup is still owed.
  // Anything else means no valid session → the login screen.
  //
  // This USED TO fall back to `sessionStorage.alive_admin === '1'` when the probe
  // failed. That flag was set by the shared-password login, which is now retired —
  // so the fallback had become a stale lie: a browser still holding the flag (an
  // old shared-password session, or an expired named one) rendered the entire
  // console shell while carrying no session, and every /api/* call 401'd. That is
  // exactly the "the screens page is broke" report — the shell loads, the data
  // never does. A named session is the only authority now, so the flag is gone
  // from the decision entirely and this fails closed to the login screen.
  const probe = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/mfa');
      if (r.ok) {
        const b = await r.json() as { enrolled: boolean; email: string | null };
        setEmail(b.email);
        setState(b.enrolled ? 'ready' : 'enrol');
        return;
      }
    } catch {
      // A transport error is not proof of a session — fail closed to login. A
      // genuinely signed-in operator simply re-authenticates; the cookie may even
      // still be valid, so the account form succeeds immediately.
    }
    setState('login');
  }, []);

  useEffect(() => { void probe(); }, [probe]);

  if (state === 'checking') return null;
  // onAuth re-probes rather than assuming success means "done": a fresh sign-in
  // by an unenrolled admin has to land on enrolment, not the dashboard.
  if (state === 'login') return <AdminLogin onAuth={probe} />;
  if (state === 'enrol') return <MfaEnrolment email={email} onDone={probe} />;
  return <Dashboard email={email} />;
}
