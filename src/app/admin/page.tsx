'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Trash2, Upload, ImageIcon } from 'lucide-react';
import { Logo } from '@/components/icons/logo';
import { Button } from '@/components/ui/button';
import type { Flyer } from '@/app/api/flyers/save/route';

// ─── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06, delayChildren: 0.03 } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';

const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function resolveImage(raw: string): string {
  if (!raw) return '';
  return raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`;
}

// ─── Session storage keys ──────────────────────────────────────────────────────

const SS_AUTH = 'alive_admin';
const SS_PW   = 'alive_admin_pw';

// ─── Upload flyer form ─────────────────────────────────────────────────────────

type FlyerForm = {
  storeName:   string;
  title:       string;
  description: string;
  validUntil:  string;
  imageBase64: string;
};

const EMPTY_FORM: FlyerForm = {
  storeName:   '',
  title:       '',
  description: '',
  validUntil:  '',
  imageBase64: '',
};

function UploadPanel({ onSaved }: { onSaved: () => void }) {
  const [form,    setForm]    = useState<FlyerForm>(EMPTY_FORM);
  const [preview, setPreview] = useState<string>('');
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [ok,      setOk]      = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof FlyerForm, v: string) => setForm((p: FlyerForm) => ({ ...p, [k]: v }));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
      set('imageBase64', result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.storeName || !form.title || !form.validUntil) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/flyers/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to save flyer');
      setForm(EMPTY_FORM);
      setPreview('');
      if (fileRef.current) fileRef.current.value = '';
      setOk(true);
      setTimeout(() => setOk(false), 3000);
      onSaved();
    } catch (e) {
      setError((e as Error).message ?? 'Error saving flyer');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="space-y-0.5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Upload flyer
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Store name */}
        <div>
          <label className={labelCls}>Store name</label>
          <input
            type="text" required value={form.storeName}
            onChange={(e) => set('storeName', e.target.value)}
            placeholder="Sharma General Store"
            className={inputCls}
          />
        </div>

        {/* Offer title */}
        <div>
          <label className={labelCls}>Offer title</label>
          <input
            type="text" required value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="20% off on all pulses"
            className={inputCls}
          />
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Description <span className="normal-case font-normal text-muted-foreground/60">(optional)</span></label>
          <textarea
            rows={3} value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Additional details about the offer…"
            className={inputCls + ' resize-none'}
          />
        </div>

        {/* Valid until */}
        <div>
          <label className={labelCls}>Valid until</label>
          <input
            type="date" required value={form.validUntil}
            onChange={(e) => set('validUntil', e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Image upload */}
        <div>
          <label className={labelCls}>Flyer image</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="relative cursor-pointer rounded-xl border-2 border-dashed border-border bg-background hover:border-primary/40 transition-colors overflow-hidden"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview" className="w-full h-48 object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground/50">
                <ImageIcon className="h-8 w-8" />
                <span className="text-xs font-semibold">Click to upload image</span>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        {error && (
          <p className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            {error}
          </p>
        )}
        {ok && (
          <p className="text-xs text-green-600 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2.5">
            Flyer published successfully.
          </p>
        )}

        <Button
          type="submit"
          disabled={busy || !form.storeName || !form.title || !form.validUntil}
          className="w-full gap-2 h-11 text-sm font-bold"
        >
          {busy
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><Upload className="h-4 w-4" /> Publish flyer</>
          }
        </Button>
      </form>
    </div>
  );
}

// ─── Published flyers panel ───────────────────────────────────────────────────

function FlyersList({ refresh }: { refresh: number }) {
  const [flyers,  setFlyers]  = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchFlyers = () => {
    setLoading(true);
    fetch('/api/flyers/save')
      .then((r) => r.json() as Promise<Flyer[]>)
      .then(setFlyers)
      .catch(() => setFlyers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchFlyers(); }, [refresh]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this flyer?')) return;
    setDeleting(id);
    try {
      const pw = sessionStorage.getItem(SS_PW) ?? '';
      await fetch('/api/flyers/delete', {
        method:  'POST',
        headers: {
          'Content-Type':   'application/json',
          'admin-password': pw,
        },
        body: JSON.stringify({ id }),
      });
      fetchFlyers();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Published flyers
      </h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : flyers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No flyers yet.</p>
      ) : (
        <div className="space-y-3">
          {flyers.map((flyer) => {
            const imgSrc = resolveImage(flyer.imageBase64);
            return (
              <div
                key={flyer.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
              >
                {/* Thumbnail */}
                <div className="shrink-0 h-12 w-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                  {imgSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgSrc} alt={flyer.title} className="h-12 w-12 object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{flyer.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{flyer.storeName}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    Valid until {formatDate(flyer.validUntil)}
                  </p>
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDelete(flyer.id)}
                  disabled={deleting === flyer.id}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/15 transition-colors disabled:opacity-40"
                >
                  {deleting === flyer.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />
                  }
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Password gate ────────────────────────────────────────────────────────────

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [pw,    setPw]    = useState('');
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res  = await fetch('/api/admin/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password: pw }),
      });
      const body = await res.json() as { ok: boolean };
      if (body.ok) {
        sessionStorage.setItem(SS_AUTH, '1');
        sessionStorage.setItem(SS_PW,   pw);
        onAuth();
      } else {
        setError('Incorrect password.');
      }
    } catch {
      setError('Failed to verify. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/30 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4 sm:px-6">
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity"><Logo /></a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-7">
            <motion.div variants={fadeUp} className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Admin</p>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Enter password.</h1>
              <p className="text-sm text-muted-foreground">This area is restricted to Alive staff.</p>
            </motion.div>

            <motion.form variants={fadeUp} onSubmit={handleSubmit} className="space-y-4">
              <input
                type="password"
                required
                autoFocus
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Admin password"
                className="w-full h-12 rounded-xl border border-border bg-card px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />

              {error && (
                <p className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={busy || !pw} className="w-full h-11 font-bold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enter dashboard'}
              </Button>
            </motion.form>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity"><Logo /></a>
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
            Admin
          </span>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem(SS_AUTH);
              sessionStorage.removeItem(SS_PW);
              window.location.reload();
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-10">
        <motion.div
          variants={stagger} initial="hidden" animate="show"
          className="space-y-2 mb-8"
        >
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Admin dashboard
          </motion.p>
          <motion.h1 variants={fadeUp} className="text-3xl font-bold tracking-tight text-foreground">
            Flyer management
          </motion.h1>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <UploadPanel onSaved={bump} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <FlyersList refresh={refreshKey} />
          </motion.div>
        </div>
      </main>

      <footer className="border-t border-border/30 py-5 text-center">
        <p className="text-xs text-muted-foreground/40">
          © 2025 Alive Advertising Solutions Pvt. Ltd.
        </p>
      </footer>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    // null during SSR/hydration; read sessionStorage only on client
    const stored = sessionStorage.getItem(SS_AUTH);
    setAuthed(stored === '1');
  }, []);

  // Avoid flash before sessionStorage is read
  if (authed === null) return null;

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />;
  }

  return <Dashboard />;
}
