'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Trash2, Upload, ImageIcon, Store, BarChart3, FileImage,
  Phone, MapPin, Calendar, CheckCircle2, Clock, AlertCircle, X,
  TrendingUp, Users, IndianRupee, Eye,
} from 'lucide-react';
import { Logo } from '@/components/icons/logo';

// ─── Types ─────────────────────────────────────────────────────────────────

type Flyer = {
  id:          string;
  storeName:   string;
  title:       string;
  description: string;
  validUntil:  string;
  imageBase64: string;
  createdAt:   string;
};

type StoreReg = {
  id:        string;
  storeName: string;
  ownerName: string;
  phone:     string;
  whatsapp:  string;
  locality:  string;
  city:      string;
  pincode:   string;
  lat?:      string;
  lng?:      string;
  createdAt: string;
};

type Campaign = {
  id:             string;
  brandName:      string;
  contactName:    string;
  email:          string;
  phone:          string;
  screens:        number;
  months:         number;
  startDate:      string;
  pricePerScreen: number;
  totalAmount:    number;
  paymentId:      string;
  status:         'upcoming' | 'active' | 'completed';
  createdAt:      string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const SS_PW = 'alive_admin_pw';

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

function resolveImage(raw: string): string {
  if (!raw) return '';
  return raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`;
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN')}`; }

// Compress + resize image client-side using Canvas (keeps Redis under limits)
function compressImage(dataUrl: string, maxPx = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

// ─── Animations ────────────────────────────────────────────────────────────

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};

// ─── Shared input class ─────────────────────────────────────────────────────

const inp = 'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';
const lbl = 'block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1';

// ─── Tabs ──────────────────────────────────────────────────────────────────

type Tab = 'flyers' | 'stores' | 'campaigns';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'flyers',    label: 'Flyers',    icon: FileImage  },
  { id: 'stores',    label: 'Stores',    icon: Store      },
  { id: 'campaigns', label: 'Campaigns', icon: BarChart3  },
];

// ─── Flyer image modal ──────────────────────────────────────────────────────

function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Flyer preview"
        className="max-h-[90vh] max-w-full rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Upload Flyer Panel ─────────────────────────────────────────────────────

function UploadPanel({ onSaved }: { onSaved: () => void }) {
  const [form,    setForm]    = useState({ storeName: '', title: '', description: '', validUntil: '' });
  const [preview, setPreview] = useState('');
  const [imgB64,  setImgB64]  = useState('');
  const [busy,    setBusy]    = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [ok,      setOk]      = useState(false);
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
      const compressed = await compressImage(raw, 1200, 0.75);
      setImgB64(compressed);
      setCompressing(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.storeName || !form.title || !form.validUntil) return;
    setBusy(true); setError(null);
    try {
      const pw   = sessionStorage.getItem(SS_PW) ?? '';
      const res  = await fetch('/api/flyers/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'admin-password': pw },
        body:    JSON.stringify({ ...form, imageBase64: imgB64 }),
      });
      const body = await res.json() as { success?: boolean; id?: string; error?: string; note?: string };
      if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.note) {
        // Redis not configured — warn but still clear form
        setError(`Saved in memory only (Redis not configured). Flyers won't persist across deploys.`);
      }
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
        <div>
          <label className={lbl}>Store name</label>
          <input type="text" required value={form.storeName} onChange={(e) => set('storeName', e.target.value)} placeholder="Sharma General Store" className={inp} />
        </div>
        <div>
          <label className={lbl}>Offer title</label>
          <input type="text" required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="WOW Summer Offer — Up to 60% off" className={inp} />
        </div>
        <div>
          <label className={lbl}>Description <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
          <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Available at all affiliated Alive stores…" className={inp + ' resize-none'} />
        </div>
        <div>
          <label className={lbl}>Valid until</label>
          <input type="date" required value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} className={inp} />
        </div>

        {/* Image upload */}
        <div>
          <label className={lbl}>Flyer image {compressing && <span className="normal-case font-normal text-primary/60">(compressing…)</span>}</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="relative cursor-pointer rounded-xl border-2 border-dashed border-border bg-background hover:border-primary/40 transition-colors overflow-hidden"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview" className="w-full max-h-52 object-contain" />
            ) : (
              <div className="flex flex-col items-center justify-center h-28 gap-2 text-muted-foreground/50">
                <ImageIcon className="h-7 w-7" />
                <span className="text-xs font-semibold">Click to upload</span>
                <span className="text-[10px] text-muted-foreground/40">Auto-compressed for storage</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>

        {error && <p className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">{error}</p>}
        {ok    && <p className="text-xs text-green-600 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2">Flyer published ✓</p>}

        <button
          type="submit"
          disabled={busy || compressing || !form.storeName || !form.title || !form.validUntil}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> Publish flyer</>}
        </button>
      </form>
    </div>
  );
}

// ─── Flyer List ─────────────────────────────────────────────────────────────

function FlyersList({ refresh }: { refresh: number }) {
  const [flyers,  setFlyers]  = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [modal,   setModal]   = useState<string | null>(null);

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
      body: JSON.stringify({ id }),
    }).finally(() => {
      setDeleting(null);
      setFlyers((f) => f.filter((x) => x.id !== id));
    });
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
              <div
                className="relative cursor-pointer bg-muted overflow-hidden"
                onClick={() => img && setModal(img)}
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={f.title} className="w-full aspect-video object-cover hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                {img && (
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" />
                  </div>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-primary">{f.storeName}</span>
                <p className="text-xs font-semibold text-foreground line-clamp-1">{f.title}</p>
                <p className="text-[10px] text-muted-foreground/60">Valid until {fmtDate(f.validUntil)}</p>
                <div className="mt-auto pt-2 flex gap-2">
                  <button
                    onClick={() => del(f.id)}
                    disabled={deleting === f.id}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/15 transition-colors disabled:opacity-40"
                  >
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

// ─── Stores Panel ───────────────────────────────────────────────────────────

function StoresPanel() {
  const [stores,  setStores]  = useState<StoreReg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    const pw = sessionStorage.getItem(SS_PW) ?? '';
    fetch('/api/stores/save', { headers: { 'admin-password': pw } })
      .then((r) => r.json() as Promise<StoreReg[]>)
      .then(setStores).catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = stores.filter((s) =>
    !search ||
    s.storeName.toLowerCase().includes(search.toLowerCase()) ||
    s.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search) ||
    s.whatsapp?.includes(search),
  );

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total registrations', value: stores.length },
          { label: 'This week',           value: stores.filter((s) => Date.now() - new Date(s.createdAt).getTime() < 7*86400000).length },
          { label: 'Cities',              value: new Set(stores.map((s) => s.city)).size },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search stores, owners, cities…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={inp}
      />

      {/* List */}
      {!filtered.length ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          {search ? 'No stores match your search.' : 'No store registrations yet.'}
        </p>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
          {filtered.map((s) => (
            <motion.div key={s.id} variants={fadeIn} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-base">
                {s.storeName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.storeName}</p>
                    <p className="text-xs text-muted-foreground">{s.ownerName}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0">{fmtDate(s.createdAt)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone || (s.whatsapp ? `+91 ${s.whatsapp}` : '—')}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.locality || s.city}{s.pincode ? ` — ${s.pincode}` : ''}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ─── Campaigns Panel ────────────────────────────────────────────────────────

function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const pw = sessionStorage.getItem(SS_PW) ?? '';
    fetch('/api/campaigns/admin', { headers: { 'admin-password': pw } })
      .then((r) => r.json() as Promise<Campaign[]>)
      .then(setCampaigns).catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  const total  = campaigns.reduce((s, c) => s + (c.totalAmount ?? 0), 0);
  const paid   = campaigns.filter((c) => c.paymentId && c.paymentId !== 'pending').length;
  const pending= campaigns.filter((c) => !c.paymentId || c.paymentId === 'pending').length;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: BarChart3,    label: 'Total bookings', value: campaigns.length,  color: 'text-blue-500'  },
          { icon: IndianRupee,  label: 'Revenue',        value: fmt(total),        color: 'text-green-500' },
          { icon: CheckCircle2, label: 'Paid',           value: paid,              color: 'text-emerald-500' },
          { icon: Clock,        label: 'Pending payment',value: pending,           color: 'text-yellow-500' },
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
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {['Brand', 'Contact', 'Screens', 'Amount', 'Status', 'Date'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((c) => {
                const isPaid = c.paymentId && c.paymentId !== 'pending';
                return (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{c.brandName || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <p>{c.contactName}</p>
                      <p className="text-[10px] text-muted-foreground/60">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.screens} × {c.months}mo</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{fmt(c.totalAmount ?? 0)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isPaid
                          ? 'bg-green-500/10 text-green-600'
                          : 'bg-yellow-500/10 text-yellow-600'
                      }`}>
                        {isPaid ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                        {isPaid ? 'Paid' : 'Pay later'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground/60">{fmtDate(c.createdAt)}</td>
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

// ─── Password gate ──────────────────────────────────────────────────────────

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res  = await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      const body = await res.json() as { ok: boolean };
      if (body.ok) { sessionStorage.setItem('alive_admin', '1'); sessionStorage.setItem(SS_PW, pw); onAuth(); }
      else setError('Incorrect password.');
    } catch { setError('Failed to verify.'); }
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
          <input
            type="password" required autoFocus value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Admin password"
            className="w-full h-12 rounded-xl border border-border bg-card px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {error && <p className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">{error}</p>}
          <button type="submit" disabled={busy || !pw} className="w-full h-11 rounded-xl bg-primary text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enter dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main dashboard ─────────────────────────────────────────────────────────

function Dashboard() {
  const [tab,        setTab]        = useState<Tab>('flyers');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <a href="/" className="opacity-70 hover:opacity-100 transition-opacity"><Logo /></a>
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Admin</span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    tab === t.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => { sessionStorage.removeItem('alive_admin'); sessionStorage.removeItem(SS_PW); window.location.reload(); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          {tab === 'flyers' && (
            <motion.div key="flyers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Flyer management</p>
                <h1 className="text-2xl font-bold text-foreground">Published flyers</h1>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <UploadPanel onSaved={() => setRefreshKey((k) => k + 1)} />
                <div className="space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live flyers</h2>
                  <FlyersList refresh={refreshKey} />
                </div>
              </div>
            </motion.div>
          )}
          {tab === 'stores' && (
            <motion.div key="stores" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Store partners</p>
                <h1 className="text-2xl font-bold text-foreground">Registered stores</h1>
              </div>
              <StoresPanel />
            </motion.div>
          )}
          {tab === 'campaigns' && (
            <motion.div key="campaigns" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Brand campaigns</p>
                <h1 className="text-2xl font-bold text-foreground">All campaigns</h1>
              </div>
              <CampaignsPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-border/30 py-4 text-center">
        <p className="text-xs text-muted-foreground/30">© 2025 ALIVE Advertising Pvt. Ltd.</p>
      </footer>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => { setAuthed(sessionStorage.getItem('alive_admin') === '1'); }, []);
  if (authed === null) return null;
  return authed ? <Dashboard /> : <PasswordGate onAuth={() => setAuthed(true)} />;
}
