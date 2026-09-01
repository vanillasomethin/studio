'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertCircle, ArrowRight, Camera, Check, CheckCircle2, ChevronLeft, Loader2,
  MapPin, MapPinOff, Monitor, RefreshCw, Search, Tv2,
} from 'lucide-react';
import { Logo } from '@/components/icons/logo';
import { adminGet, adminGetArray, adminPw } from '@/lib/admin-fetch';

const SS_AUTH  = 'alive_admin';
const SS_PW    = 'alive_admin_pw';
// Every install is its own draft in sessionStorage, keyed by draft id. A kirana
// shop's network is the commonest reason an install overruns its budget
// (SOP §5.1) — a dropped connection or an accidental tab reload must never cost
// a re-typed serial. Nor must a mis-scan: the TVs sit in one box, so loading a
// different ?code= opens a SECOND draft BESIDE the first. Nothing this file
// writes ever overwrites or deletes a draft that still has work in it.
const SS_DRAFT_PREFIX = 'alive_pair_draft:';
const SS_DRAFT_LEGACY = 'alive_pair_wizard';   // pre-keyed single-draft entry
const MAX_IDLE_DRAFTS = 6;

// ─── Shared UI atoms (phone-first: 16px text so iOS doesn't zoom on focus) ────

const inp = 'w-full h-12 rounded-xl border border-border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';
const btn = 'w-full h-14 rounded-xl bg-primary text-white text-base font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2';
const btnQuiet = 'h-12 rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2';

// ─── Types ───────────────────────────────────────────────────────────────────

type PhotoKind = 'install' | 'serial' | 'plug' | 'shop';
type Photo = { url: string; lat: number | null; lng: number | null; at: string | null };

type StoreRow = {
  id: string; storeName: string; ownerName?: string | null;
  locality?: string | null; city?: string | null; whatsapp?: string | null;
  onboardingStage?: string | null; deviceCount?: number;
  tvBrand?: string | null; tvModel?: string | null; tvSizeInches?: number | null;
  tvTag?: string | null; tvSerial?: string | null;
  espPlugId?: string | null; espSwitchName?: string | null;
  wifiSsid?: string | null; wifiAuthType?: string | null;
  wifiPassword?: string | null; wifiUsername?: string | null;
  installNotes?: string | null;
  shopPhotoUrl?: string | null; installPhotoUrl?: string | null;
  serialPhotoUrl?: string | null; plugPhotoUrl?: string | null;
  shopPhotoLat?: number | null;    shopPhotoLng?: number | null;    shopPhotoAt?: string | null;
  installPhotoLat?: number | null; installPhotoLng?: number | null; installPhotoAt?: string | null;
  serialPhotoLat?: number | null;  serialPhotoLng?: number | null;  serialPhotoAt?: string | null;
  plugPhotoLat?: number | null;    plugPhotoLng?: number | null;    plugPhotoAt?: string | null;
};

/** A screen already on the fleet — GET /api/devices. `storeName` is the DEVICE
 *  name; the store it is linked to is `linkedStoreName`. */
type FleetDevice = {
  id: string; storeName: string | null; hardwareKey: string | null;
  storeId: string | null; linkedStoreName: string | null;
  status?: string | null; lastSeen?: string | null;
  city?: string | null; locality?: string | null;
};

type Draft = {
  /** Storage key for this draft. Stable for the life of the install. */
  id: string;
  code: string;
  deviceId: string | null;
  /** Shown instead of the pairing code when the screen was picked off the fleet. */
  deviceLabel: string;
  storeId: string | null;
  storeLabel: string;
  stage: string | null;
  position: string;
  orientation: 'PORTRAIT' | 'PORTRAIT_FLIPPED';
  linked: boolean;
  tvSerial: string; tvBrand: string; tvModel: string; tvSizeInches: string; tvTag: string;
  wifiSsid: string; wifiAuthType: string; wifiPassword: string; wifiUsername: string;
  espPlugId: string; espSwitchName: string; installNotes: string;
  photos: Partial<Record<PhotoKind, Photo>>;
  /** 1–7 are the wizard steps; 8 is the done screen. */
  step: number;
};

/** Accepts a function so concurrent writers (two photo uploads at once) each
 *  merge into the LATEST draft instead of the one captured when they started. */
type UpdateFn = (patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => void;

const STEPS = ['Pair', 'Store', 'TV', 'Network', 'Smart plug', 'Photos', 'Finish'];

const AUTH_TYPES = [
  { v: 'wpa_psk', label: 'WPA — normal password', hint: 'Ordinary home / shop router' },
  { v: 'pppoe',   label: 'PPPoE — ISP login',     hint: 'Router asks for a username too' },
  { v: 'portal',  label: 'Captive portal',        hint: 'A login page opens before internet works' },
  { v: 'open',    label: 'Open — no password',    hint: 'Joins without any password' },
];

const PHOTO_COPY: Record<PhotoKind, { title: string; hint: string }> = {
  install: { title: 'The installed TV',   hint: 'Mounted, powered on, showing content.' },
  serial:  { title: 'The serial plate',   hint: 'The sticker on the back of the panel. Numbers must be readable.' },
  plug:    { title: 'The smart plug',     hint: 'The plug in its socket, with the TV cable in it.' },
  shop:    { title: 'The shop front',     hint: 'Standing outside, whole storefront in frame.' },
};

// Which step fixes each label the server can return in a 409 `missing[]`.
const MISSING_STEP: Record<string, number> = {
  'TV serial number': 3, 'TV company': 3, 'TV model': 3, 'TV size': 3, 'TV number / tag': 3,
  'WiFi network name': 4, 'WiFi security type': 4, 'WiFi password': 4, 'WiFi username': 4,
  'Smart plug ID': 5,
  'Photo of the installed TV': 6, 'Photo of the serial plate': 6,
  'Photo of the smart plug': 6, 'Photo of the shop front': 6,
};

const newDraftId = (): string => {
  try {
    const c = globalThis.crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch { /* older WebView */ }
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
};

const emptyDraft = (code: string): Draft => ({
  id: newDraftId(),
  code, deviceId: null, deviceLabel: '',
  storeId: null, storeLabel: '', stage: null, position: '', orientation: 'PORTRAIT', linked: false,
  tvSerial: '', tvBrand: '', tvModel: '', tvSizeInches: '', tvTag: '',
  wifiSsid: '', wifiAuthType: '', wifiPassword: '', wifiUsername: '',
  espPlugId: '', espSwitchName: '', installNotes: '',
  photos: {}, step: 1,
});

// ─── Draft storage: one sessionStorage entry per install ─────────────────────

type StoredDraft = Draft & { savedAt?: number };

/** True once this draft holds anything a re-type would cost. */
function hasProgress(d: Draft): boolean {
  return d.step > 1 || !!d.deviceId || !!d.storeId;
}

/** Every draft in this tab, newest first. Corrupt entries are skipped. */
function loadDrafts(): StoredDraft[] {
  const out: StoredDraft[] = [];
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k || !k.startsWith(SS_DRAFT_PREFIX)) continue;
      try {
        const d = JSON.parse(sessionStorage.getItem(k) ?? 'null') as StoredDraft | null;
        if (d && typeof d.id === 'string' && typeof d.step === 'number') out.push(d);
      } catch { /* corrupt entry — leave it alone rather than crash the restore */ }
    }
  } catch { /* private mode */ }
  return out.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
}

function saveDraft(d: Draft) {
  try {
    const key   = SS_DRAFT_PREFIX + d.id;
    const isNew = sessionStorage.getItem(key) === null;
    sessionStorage.setItem(key, JSON.stringify({ ...d, savedAt: Date.now() } satisfies StoredDraft));
    // This runs on every keystroke, so sweep only when a draft was just added —
    // and even then, only ever remove drafts with nothing in them.
    if (!isNew) return;
    const all = loadDrafts();
    if (all.length > MAX_IDLE_DRAFTS) {
      for (const old of all.slice(MAX_IDLE_DRAFTS)) if (old.id !== d.id && !hasProgress(old)) dropDraft(old.id);
    }
  } catch { /* private mode / quota */ }
}

function dropDraft(id: string) {
  try { sessionStorage.removeItem(SS_DRAFT_PREFIX + id); } catch { /* ignore */ }
}

/** One-time move of the pre-keyed single-draft entry into the keyed store. */
function migrateLegacyDraft() {
  try {
    const raw = sessionStorage.getItem(SS_DRAFT_LEGACY);
    if (!raw) return;
    sessionStorage.removeItem(SS_DRAFT_LEGACY);
    const old = JSON.parse(raw) as Partial<Draft> | null;
    if (!old || typeof old.step !== 'number') return;
    saveDraft({ ...emptyDraft(typeof old.code === 'string' ? old.code : ''), ...old, id: newDraftId() });
  } catch { /* nothing worth keeping */ }
}

/** One line describing an unfinished install, for the "which one?" prompt. */
function draftSummary(d: Draft): string {
  return [
    d.code ? `Code ${d.code}` : d.deviceLabel || 'No code yet',
    d.storeLabel || 'No store picked',
    `Step ${Math.min(d.step, 7)} of 7`,
  ].join(' · ');
}

// ─── Onboarding stages ───────────────────────────────────────────────────────
// Mirrors STAGE_RANK in PATCH /api/admin/stores/[id]. That gate guards FORWARD
// crossings only — a backward write sails straight through — so the wizard is
// the only thing standing between a panel swap at a live store and that store
// being silently demoted to physically_onboarded.

const STAGE_RANK: Record<string, number> = {
  new: 0, contacted: 1, physically_onboarded: 2, digitally_onboarded: 3, live: 4,
};
const STAGE_LABEL: Record<string, string> = {
  new: 'New', contacted: 'Contacted', physically_onboarded: 'Physically onboarded',
  digitally_onboarded: 'Digitally onboarded', live: 'Live', rejected: 'Rejected',
};
/** physically_onboarded — the stage this wizard is allowed to move a store to. */
const INSTALL_RANK = 2;

const stageRank  = (s?: string | null) => STAGE_RANK[s ?? 'new'] ?? 0;
const stageLabel = (s?: string | null) => STAGE_LABEL[s ?? 'new'] ?? (s ?? 'new').replace(/_/g, ' ');

// ─── Validation (client side is the FIRST line of feedback; the server gate is
// the backstop). Mirrors the required-at-install set enforced by PATCH
// /api/admin/stores/[id] so the executive never meets a 409 they could have
// been warned about while still standing at the counter. ─────────────────────

function needsUsername(authType: string) {
  return authType === 'pppoe' || authType === 'portal';
}

/** Photo kinds this store must have before it can cross into physically_onboarded. */
function requiredPhotos(d: Draft, forceShop: boolean): PhotoKind[] {
  const base: PhotoKind[] = ['install', 'serial', 'plug'];
  // The shop-front gate only fires when the store is still at `new`, i.e. this
  // crossing skips a stage. Server ranks a missing stage as `new` too.
  const stillNew = stageRank(d.stage) < 1;
  return stillNew || forceShop ? [...base, 'shop'] : base;
}

function stepErrors(step: number, d: Draft, forceShop: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 2) {
    if (!d.storeId) e.storeId = 'Pick the store this screen is installed in.';
    if (!d.position.trim()) e.position = 'Where in the shop is it? e.g. Counter.';
  }
  if (step === 3) {
    if (!d.tvSerial.trim()) e.tvSerial = 'Copy it from the plate on the back of the panel.';
    if (!d.tvBrand.trim()) e.tvBrand = 'Required.';
    if (!d.tvModel.trim()) e.tvModel = 'Required — it decides which player build this panel gets.';
    const n = Number(d.tvSizeInches);
    if (!d.tvSizeInches.trim()) e.tvSizeInches = 'Required.';
    else if (!Number.isFinite(n) || n <= 0 || n > 200) e.tvSizeInches = 'Size in inches, e.g. 43.';
    if (!d.tvTag.trim()) e.tvTag = 'The ALIVE number written on the unit.';
  }
  if (step === 4) {
    if (!d.wifiSsid.trim()) e.wifiSsid = 'Exact network name, including capitals.';
    if (!d.wifiAuthType) e.wifiAuthType = 'Pick how this network is secured.';
    if (d.wifiAuthType && d.wifiAuthType !== 'open' && !d.wifiPassword.trim()) e.wifiPassword = 'Required. Type it exactly — nobody can fetch it remotely later.';
    if (needsUsername(d.wifiAuthType) && !d.wifiUsername.trim()) e.wifiUsername = 'Required for this network type.';
  }
  if (step === 5) {
    if (!d.espPlugId.trim()) e.espPlugId = 'The ID printed on the plug’s own label.';
  }
  if (step === 6) {
    for (const k of requiredPhotos(d, forceShop)) {
      if (!d.photos[k]?.url) e[k] = `${PHOTO_COPY[k].title} is required.`;
    }
  }
  return e;
}

function stepComplete(step: number, d: Draft, forceShop: boolean): boolean {
  if (step === 1) return !!d.deviceId;
  // `linked` is set only by a 2xx from PATCH /api/devices/[id]. Without it the
  // screen belongs to no store, however complete the rest of the form looks.
  if (step === 2) return !!d.storeId && d.linked;
  if (step === 7) return d.step > 7;
  return Object.keys(stepErrors(step, d, forceShop)).length === 0;
}

/** Anything on this draft a store switch would discard. */
function hasCaptured(d: Draft): boolean {
  return !!(d.tvSerial || d.tvBrand || d.tvModel || d.tvSizeInches || d.tvTag
    || d.wifiSsid || d.wifiAuthType || d.wifiPassword || d.wifiUsername
    || d.espPlugId || d.espSwitchName || d.installNotes
    || Object.values(d.photos).some((p) => p?.url));
}

/**
 * The first step before `n` that is not genuinely done, or null. Picking a store
 * pre-loads whatever ops already recorded, so steps 3–6 can read "complete" on a
 * revisit while step 2 has never run its link — which is exactly how the
 * progress dots used to let an executive skip linking and still be told the
 * install succeeded.
 */
function firstIncompleteBefore(n: number, d: Draft, forceShop: boolean): number | null {
  for (let i = 1; i < n; i++) if (!stepComplete(i, d, forceShop)) return i;
  return null;
}

/**
 * A rotated ADMIN_PASSWORD would otherwise dead-end the wizard on "Unauthorized"
 * with no way back to the gate. Bounce instead — the draft lives in
 * sessionStorage, so the reload lands the executive on the same step.
 */
function bounceIfUnauthorized(res: Response): boolean {
  if (res.status !== 401) return false;
  sessionStorage.removeItem(SS_AUTH);
  sessionStorage.removeItem(SS_PW);
  window.location.reload();
  return true;
}

// Downscale to ≤1920px JPEG. Vercel caps a function's request body at ~4.5 MB
// and a modern phone camera clears that on a single frame, so the upload has to
// shrink before it leaves the handset.
async function downscaleImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el); el.onerror = () => reject(new Error('bad image'));
      el.src = url;
    });
    const scale  = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width  = Math.max(1, Math.round(img.naturalWidth  * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('encode failed');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * A fix for THIS capture, or null. Never reuse an older one: a shop-front shot
 * taken twenty minutes later outdoors used to be stamped with the indoor fix
 * from the moment step 6 opened, and Ops reads those as real coordinates.
 * `maximumAge` is one capture's worth of staleness, not the whole site visit.
 */
function currentFix(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: { lat: number; lng: number } | null) => { if (!settled) { settled = true; resolve(v); } };
    // Some Android WebViews fire neither callback; this timer is the floor so a
    // photo is never held hostage to a fix that will not arrive.
    const timer = setTimeout(() => done(null), 9000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(timer); done({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      ()  => { clearTimeout(timer); done(null); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
    );
  });
}

// ─── Small presentational pieces ─────────────────────────────────────────────

/** `group` renders a plain div — a <label> wrapping buttons hijacks their names. */
function Field({ label, hint, error, group, children }: {
  label: string; hint?: string; error?: string; group?: boolean; children: React.ReactNode;
}) {
  const Wrap = group ? 'div' : 'label';
  return (
    <Wrap className="block">
      <span className="text-sm font-bold text-foreground">{label}</span>
      {hint && <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">{hint}</span>}
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </Wrap>
  );
}

// Bullets are drawn, not list-styled — the global reset strips list markers.
function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-bold text-foreground">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((t) => (
          <li key={t} className="flex gap-2 text-sm text-muted-foreground">
            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
            <span className="flex-1">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepHeader({ step, draft, forceShop, onJump }: {
  step: number; draft: Draft; forceShop: boolean; onJump: (n: number) => void;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Step {step} of 7</p>
        <p className="text-xs font-bold text-muted-foreground">{STEPS[step - 1]}</p>
      </div>
      <div className="flex gap-1">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = stepComplete(n, draft, forceShop);
          // Backwards is always allowed — it claims no progress. Forwards needs
          // every earlier step genuinely done, or the wizard would report a
          // finished install for a screen step 2 never linked.
          const locked  = n > step && firstIncompleteBefore(n, draft, forceShop) !== null;
          const canJump = n !== step && !locked;
          return (
            <button key={label} type="button" disabled={!canJump} onClick={() => onJump(n)}
              aria-label={`Step ${n}: ${label}${done ? ' (done)' : locked ? ' (locked)' : ''}`}
              className="flex-1 py-2.5 disabled:cursor-default">
              <span className={`block h-1.5 rounded-full transition-colors ${
                n === step ? 'bg-primary' : done ? 'bg-green-500' : 'bg-border'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhotoTile({ kind, photo, busy, error, pendingUrl, onPick, onRetry }: {
  kind: PhotoKind; photo?: Photo; busy: boolean; error?: string; pendingUrl?: string;
  onPick: (file: File) => void; onRetry?: () => void;
}) {
  const copy   = PHOTO_COPY[kind];
  const hasFix = typeof photo?.lat === 'number' && typeof photo?.lng === 'number';
  return (
    <div className={`rounded-xl border bg-card p-3 ${error ? 'border-red-300' : 'border-border'}`}>
      <div className="flex items-start gap-3">
        {photo?.url ? (
          <a href={photo.url} target="_blank" rel="noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={copy.title} className="h-16 w-16 rounded-lg object-cover border border-border" />
          </a>
        ) : pendingUrl ? (
          // The shot the phone just took, held locally until it is on R2 — on
          // iOS `capture="environment"` never saves it to Photos, so losing it
          // here means unmounting the panel to shoot the serial plate again.
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={pendingUrl} alt={copy.title} className="h-16 w-16 shrink-0 rounded-lg object-cover border border-dashed border-border opacity-70" />
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-lg border border-dashed border-border flex items-center justify-center">
            <Camera className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
            {copy.title}
            {photo?.url && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{copy.hint}</p>
          {photo?.url && (hasFix ? (
            <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" /> {photo.lat!.toFixed(5)}, {photo.lng!.toFixed(5)}
            </p>
          ) : (
            // Said plainly rather than left blank: a photo with no coordinates
            // is evidence Ops cannot place, and they must know which ones.
            <p className="mt-1 text-[11px] font-medium text-amber-700 flex items-start gap-1">
              <MapPinOff className="h-3 w-3 shrink-0 mt-[2px]" /> <span className="flex-1">No location saved with this photo</span>
            </p>
          ))}
          {!photo?.url && busy && (
            <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" /> Reading location…
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {onRetry && !busy && (
          <button type="button" onClick={onRetry} className={`${btnQuiet} flex-1 min-w-0`}>
            <RefreshCw className="h-4 w-4 shrink-0" /> Retry
          </button>
        )}
        <label className={`${btnQuiet} flex-1 min-w-0 ${busy ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
          {busy
            ? <><Loader2 className="h-4 w-4 animate-spin shrink-0" /> Uploading…</>
            : <><Camera className="h-4 w-4 shrink-0" /> {photo?.url || onRetry ? 'Retake' : 'Open camera'}</>}
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPick(f); }} />
        </label>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

// ─── The wizard ──────────────────────────────────────────────────────────────

function PairInner() {
  const params    = useSearchParams();
  const urlCode   = (params.get('code') ?? '').trim().toUpperCase();
  const wantFresh = params.get('fresh') === '1';

  const [authed,   setAuthed]   = useState(false);
  const [pw,       setPw]       = useState('');
  const [authErr,  setAuthErr]  = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [draft, setDraft] = useState<Draft | null>(null);
  // An unfinished install this load did NOT open — offered, never overwritten.
  const [other, setOther] = useState<Draft | null>(null);
  const restored = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(SS_AUTH) === '1') setAuthed(true);
  }, []);

  // Restore once. A code in the URL opens ITS draft; a code we have never seen
  // opens a NEW draft alongside the others. Nothing is thrown away: if there is
  // an unfinished install we did not open, the executive is asked which one to
  // continue rather than discovering the loss after a mis-scanned QR.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    migrateLegacyDraft();
    const all   = loadDrafts();
    const mine  = urlCode ? all.find((x) => x.code === urlCode) : (wantFresh ? undefined : all[0]);
    const start = mine ?? emptyDraft(urlCode);
    setDraft(start);
    if (!mine) {
      const unfinished = all.filter((x) => x.id !== start.id && hasProgress(x));
      if (unfinished.length) setOther(unfinished[0]);
    }
  }, [urlCode, wantFresh]);

  useEffect(() => {
    if (draft) saveDraft(draft);
  }, [draft]);

  const update = useCallback<UpdateFn>((patch) => {
    setDraft((d) => (d ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d));
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true); setAuthErr(null);
    try {
      const res  = await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      const body = await res.json() as { ok: boolean };
      if (body.ok) {
        sessionStorage.setItem(SS_AUTH, '1');
        sessionStorage.setItem(SS_PW, pw);
        setAuthed(true);
      } else {
        setAuthErr('Incorrect password.');
      }
    } catch {
      setAuthErr('Failed to verify.');
    } finally {
      setAuthBusy(false);
    }
  };

  if (!authed) {
    return (
      <div className="w-full max-w-sm space-y-6 mt-12">
        <div>
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity inline-block mb-8"><Logo /></a>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-1">Admin</p>
          <h1 className="text-3xl font-bold text-foreground">Connect this screen</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to pair the screen you just scanned.</p>
        </div>
        <form onSubmit={login} className="space-y-3">
          <input type="password" required autoFocus value={pw} onChange={(e) => setPw(e.target.value)}
            placeholder="Admin password"
            className="w-full h-12 rounded-xl border border-border bg-card px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
          {authErr && <p className="text-xs text-red-500">{authErr}</p>}
          <button type="submit" disabled={authBusy}
            className="w-full h-12 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {authBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
          </button>
        </form>
      </div>
    );
  }

  if (!draft) return <Loader2 className="h-6 w-6 text-primary animate-spin mt-12" />;

  if (other) {
    return (
      <div className="w-full max-w-md space-y-4 mt-8">
        <AlertCircle className="h-10 w-10 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">You have an unfinished install</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This phone is part-way through another screen. Nothing is deleted either way — pick which one to carry on with.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-sm font-bold text-foreground">Carry on with</p>
          <p className="text-xs text-muted-foreground mt-0.5 break-words">{draftSummary(other)}</p>
        </div>
        <button type="button" className={btn}
          onClick={() => { if (!hasProgress(draft)) dropDraft(draft.id); setDraft(other); setOther(null); }}>
          Continue that install <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setOther(null)} className={`${btnQuiet} w-full`}>
          {urlCode ? `Start the new screen (${urlCode})` : 'Start a new install'}
        </button>
      </div>
    );
  }

  return <Wizard key={draft.id} draft={draft} update={update} />;
}

function Wizard({ draft, update }: { draft: Draft; update: UpdateFn }) {
  const d = draft;

  const [pairState, setPairState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [pairErr,   setPairErr]   = useState<string | null>(null);
  const [manualCode, setManualCode] = useState(() => draft.code);

  // Step 1 fallback: a screen already on the fleet shows no pairing code.
  const [pickFleet, setPickFleet] = useState(false);
  const [fleet,     setFleet]     = useState<FleetDevice[] | null>(null);
  const [fleetErr,  setFleetErr]  = useState<string | null>(null);
  const [fleetQ,    setFleetQ]    = useState('');

  const [stores,     setStores]     = useState<StoreRow[] | null>(null);
  const [storesErr,  setStoresErr]  = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [changing,   setChanging]   = useState(false);
  const [confirmStore, setConfirmStore] = useState<StoreRow | null>(null);
  const [linkBusy,   setLinkBusy]   = useState(false);
  const [linkErr,    setLinkErr]    = useState<string | null>(null);

  // Per kind, not one shared value: two tiles can be uploading at once, and a
  // shared flag made the second render as idle (and red) while still in flight,
  // so a second tap fired a duplicate upload and orphaned an R2 object.
  const [photoBusy, setPhotoBusy] = useState<Partial<Record<PhotoKind, boolean>>>({});
  const [photoErr,  setPhotoErr]  = useState<Partial<Record<PhotoKind, string>>>({});
  // The chosen file is kept so "Retry" re-uploads the SAME shot.
  const [pending, setPending] = useState<Partial<Record<PhotoKind, { file: File; url: string }>>>({});
  const pendingRef = useRef<Partial<Record<PhotoKind, { file: File; url: string }>>>({});

  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [gate,    setGate]    = useState<{ error: string; missing: string[] } | null>(null);
  const [navErr,  setNavErr]  = useState<string | null>(null);
  // Set when the server's 409 names the shop-front photo — the store's stage was
  // further back than the list said, so that tile becomes required.
  const [forceShop, setForceShop] = useState(false);

  // Errors are recomputed every render once the executive has tried to advance,
  // so a message clears the moment the field is fixed rather than on the next tap.
  const [showErrors, setShowErrors] = useState(false);
  const live: Record<string, string> = showErrors ? stepErrors(d.step, d, forceShop) : {};

  // Forwards only when everything behind it is genuinely done; backwards always.
  const goto = (n: number) => {
    if (n > d.step) {
      const blocked = firstIncompleteBefore(n, d, forceShop);
      if (blocked !== null) {
        setNavErr(`Finish step ${blocked} — ${STEPS[blocked - 1]} — first.`);
        setShowErrors(true);
        return;
      }
    }
    setNavErr(null); setShowErrors(false); setGate(null); update({ step: n });
  };

  const next = () => {
    if (Object.keys(stepErrors(d.step, d, forceShop)).length) { setShowErrors(true); return; }
    goto(d.step + 1);
  };

  // ── Step 1: pairing. Idempotent server-side, so a reload mid-install is safe.
  useEffect(() => {
    if (d.deviceId || pairState !== 'idle' || d.code.length !== 6) return;
    setPairState('busy'); setPairErr(null);
    fetch('/api/admin/confirm-pairing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'admin-password': adminPw() },
      body: JSON.stringify({ code: d.code }),
    })
      .then(async (res) => {
        if (bounceIfUnauthorized(res)) return;
        const body = await res.json().catch(() => null) as { device?: { id: string }; error?: string } | null;
        if (!res.ok || !body?.device) throw new Error(body?.error ?? `HTTP ${res.status}`);
        update({ deviceId: body.device.id });
        setPairState('idle');
      })
      .catch((e: Error) => { setPairErr(e.message); setPairState('error'); });
  }, [d.code, d.deviceId, pairState, update]);

  // ── Step 1 fallback: the fleet. A screen that is already paired shows no code
  // on the TV, so the QR and the 6-character box are both dead ends for a
  // revisit — a Wi-Fi change, a panel swap, or a store frozen by the new gate.
  useEffect(() => {
    if (!pickFleet || fleet !== null || fleetErr !== null) return;
    adminGet<{ devices?: FleetDevice[] }>('/api/devices?take=200')
      .then((b) => setFleet(Array.isArray(b?.devices) ? b.devices : []))
      .catch(() => setFleetErr('Could not load the fleet. Check the connection and retry.'));
  }, [pickFleet, fleet, fleetErr]);

  const fleetMatches = useMemo(() => {
    if (!fleet) return [];
    const q = fleetQ.trim().toLowerCase();
    if (!q) return fleet.slice(0, 25);
    return fleet.filter((x) => [x.storeName, x.linkedStoreName, x.hardwareKey, x.locality, x.city, x.id]
      .some((v) => (v ?? '').toLowerCase().includes(q))).slice(0, 25);
  }, [fleet, fleetQ]);

  const useFleetDevice = (dev: FleetDevice) => {
    setPairState('idle'); setPairErr(null); setPickFleet(false);
    // Its store is only a search hint — step 2 still picks and re-links, so the
    // device name, position and orientation are re-confirmed on every visit.
    if (dev.linkedStoreName) setSearch(dev.linkedStoreName);
    update({ deviceId: dev.id, deviceLabel: dev.storeName || dev.hardwareKey || 'Screen on the fleet' });
  };

  // ── Step 2: the store list. Hundreds of rows, so fetch once and filter locally.
  useEffect(() => {
    if (d.step !== 2 || stores !== null || storesErr !== null) return;
    adminGetArray<StoreRow>('/api/stores/save')
      .then(setStores)
      .catch(() => setStoresErr('Could not load the store list. Check the connection and retry.'));
  }, [d.step, stores, storesErr]);

  const matches = useMemo(() => {
    if (!stores) return [];
    const q = search.trim().toLowerCase();
    if (!q) return stores.slice(0, 25);
    return stores.filter((s) => [s.storeName, s.ownerName, s.locality, s.city, s.whatsapp]
      .some((v) => (v ?? '').toLowerCase().includes(q))).slice(0, 25);
  }, [stores, search]);

  // Picking a store pre-loads whatever ops already recorded for it, so an
  // install resumed on a second visit does not start from a blank form.
  const applyStore = (s: StoreRow) => {
    const seed = (url?: string | null, lat?: number | null, lng?: number | null, at?: string | null): Photo | undefined =>
      (url ? { url, lat: lat ?? null, lng: lng ?? null, at: at ?? null } : undefined);
    update({
      storeId: s.id, storeLabel: s.storeName, stage: s.onboardingStage ?? 'new', linked: false,
      tvSerial: s.tvSerial ?? '', tvBrand: s.tvBrand ?? '', tvModel: s.tvModel ?? '',
      tvSizeInches: s.tvSizeInches != null ? String(s.tvSizeInches) : '', tvTag: s.tvTag ?? '',
      wifiSsid: s.wifiSsid ?? '', wifiAuthType: s.wifiAuthType ?? '',
      wifiPassword: s.wifiPassword ?? '', wifiUsername: s.wifiUsername ?? '',
      espPlugId: s.espPlugId ?? '', espSwitchName: s.espSwitchName ?? '', installNotes: s.installNotes ?? '',
      photos: {
        install: seed(s.installPhotoUrl, s.installPhotoLat, s.installPhotoLng, s.installPhotoAt),
        serial:  seed(s.serialPhotoUrl,  s.serialPhotoLat,  s.serialPhotoLng,  s.serialPhotoAt),
        plug:    seed(s.plugPhotoUrl,    s.plugPhotoLat,    s.plugPhotoLng,    s.plugPhotoAt),
        shop:    seed(s.shopPhotoUrl,    s.shopPhotoLat,    s.shopPhotoLng,    s.shopPhotoAt),
      },
    });
    setConfirmStore(null); setChanging(false); setNavErr(null);
  };

  const pickStore = (s: StoreRow) => {
    // Re-picking the store already captured must change NOTHING. "Change" sits
    // one tap from the store name, and a mis-tap used to reset all 13 install
    // fields and the photos with it.
    if (s.id === d.storeId) { setChanging(false); setConfirmStore(null); return; }
    // A different store either discards typed work or is a panel swap at a store
    // that is already onboarded. Both deserve a deliberate second tap.
    if (hasCaptured(d) || stageRank(s.onboardingStage) >= INSTALL_RANK) { setConfirmStore(s); return; }
    applyStore(s);
  };

  const deviceName = `${d.storeLabel} - ${d.position.trim()}`;

  const linkDevice = async () => {
    if (Object.keys(stepErrors(2, d, forceShop)).length) { setShowErrors(true); return; }
    setLinkBusy(true); setLinkErr(null);
    try {
      const res = await fetch(`/api/devices/${d.deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'admin-password': adminPw() },
        body: JSON.stringify({ storeId: d.storeId, storeName: deviceName, orientation: d.orientation }),
      });
      if (bounceIfUnauthorized(res)) return;
      const body = await res.json().catch(() => null) as { device?: { storeId?: string | null }; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      // `linked` is what the rest of the wizard trusts, so set it only from the
      // store id the server echoes back.
      if (body?.device && body.device.storeId !== d.storeId) throw new Error('link mismatch');
      update({ linked: true, step: 3 });
      setShowErrors(false); setNavErr(null);
    } catch {
      setLinkErr('Could not link the screen. Check the connection and try again — nothing you typed is lost.');
    } finally {
      setLinkBusy(false);
    }
  };

  /** Does the screen really point at this store? Never claim an install is done
   *  on the strength of a local flag alone. */
  const checkDeviceLink = async (): Promise<'linked' | 'unlinked' | 'bounced' | 'unknown'> => {
    try {
      const res = await fetch(`/api/devices?all=true&take=5&q=${encodeURIComponent(d.deviceId ?? '')}`,
        { headers: { 'admin-password': adminPw() } });
      if (bounceIfUnauthorized(res)) return 'bounced';
      if (!res.ok) return 'unknown';
      const body = await res.json().catch(() => null) as { devices?: FleetDevice[] } | null;
      const row  = body?.devices?.find((x) => x.id === d.deviceId);
      if (!row) return 'unknown';
      return row.storeId === d.storeId ? 'linked' : 'unlinked';
    } catch {
      return 'unknown';
    }
  };

  /** The store's stage as the SERVER sees it right now, or null if it can't be
   *  read. d.stage is only a snapshot taken when the store was picked, and a
   *  draft can sit open on a phone for an hour — long enough for Ops to advance
   *  the store from a desk. Deciding the forward-only guard on that snapshot
   *  would still let a stale draft walk a now-live store backwards. */
  const liveStage = async (): Promise<string | null> => {
    try {
      const rows = await adminGetArray<StoreRow>('/api/stores/save');
      return rows.find((s) => s.id === d.storeId)?.onboardingStage ?? null;
    } catch {
      return null;
    }
  };

  // ── Step 6: photos. Arriving here asks for location once so the OS permission
  // prompt is out of the way before the camera opens. The answer is deliberately
  // NOT kept: every capture takes its own fix (see currentFix).
  useEffect(() => {
    if (d.step !== 6 || typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => { /* permission primed; the fix itself belongs to a capture, not to a step */ },
      () => { /* denied or no fix — photos still upload, just without coordinates */ },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, [d.step]);

  // The File is held in state, not just in the upload closure: on iOS
  // `capture="environment"` never saves the shot to Photos, so a failed upload
  // used to mean unmounting the panel to re-shoot the serial plate.
  const holdPhoto = (kind: PhotoKind, file: File) => {
    const prev = pendingRef.current[kind];
    if (prev) URL.revokeObjectURL(prev.url);
    const next = { ...pendingRef.current, [kind]: { file, url: URL.createObjectURL(file) } };
    pendingRef.current = next;
    setPending(next);
  };

  const releasePhoto = (kind: PhotoKind) => {
    const prev = pendingRef.current[kind];
    if (!prev) return;
    URL.revokeObjectURL(prev.url);
    const next = { ...pendingRef.current };
    delete next[kind];
    pendingRef.current = next;
    setPending(next);
  };

  useEffect(() => () => { for (const v of Object.values(pendingRef.current)) URL.revokeObjectURL(v.url); }, []);

  const uploadPhoto = async (kind: PhotoKind, file: File) => {
    if (pendingRef.current[kind]?.file !== file) holdPhoto(kind, file);
    setPhotoBusy((p) => ({ ...p, [kind]: true }));
    setPhotoErr((p) => ({ ...p, [kind]: undefined }));
    try {
      // Ask for the fix and shrink the frame at the same time: both are slow and
      // neither needs the other, so the wait is one of them, not both.
      const fixPromise = currentFix();
      const SERVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
      let blob: Blob = file;
      if (file.size > 3.5 * 1024 * 1024 || !SERVER_TYPES.includes(file.type)) blob = await downscaleImage(file);

      const fix = await fixPromise;
      const fd = new FormData();
      fd.append('file', blob, `${kind}.jpg`);
      fd.append('kind', kind);
      if (fix) {
        fd.append('lat', String(fix.lat));
        fd.append('lng', String(fix.lng));
        fd.append('source', 'device');
      }
      const res  = await fetch(`/api/admin/stores/${d.storeId}/photo`, { method: 'POST', headers: { 'admin-password': adminPw() }, body: fd });
      if (bounceIfUnauthorized(res)) return;
      const body = await res.json().catch(() => null) as { url?: string; lat?: number | null; lng?: number | null; at?: string | null; error?: string } | null;
      if (!res.ok || !body?.url) throw new Error(body?.error ?? `HTTP ${res.status}`);
      const url = body.url;
      // Functional patch: the other tile may have finished while this one was in
      // flight, and a stale `d.photos` would drop its result.
      update((cur) => ({ photos: { ...cur.photos, [kind]: { url, lat: body.lat ?? null, lng: body.lng ?? null, at: body.at ?? null } } }));
      releasePhoto(kind);
    } catch {
      setPhotoErr((p) => ({ ...p, [kind]: 'Upload failed. The photo is still here — check the connection and tap Retry.' }));
    } finally {
      setPhotoBusy((p) => ({ ...p, [kind]: false }));
    }
  };

  // ── Step 7: save, then cross the stage gate.
  const finish = async () => {
    if (!d.storeId || !d.deviceId) {
      setSaveErr('This install is missing its screen or its store. Go back to steps 1 and 2.');
      return;
    }
    setSaving(true); setSaveErr(null); setGate(null);
    try {
      // The screen must genuinely point at this store before anything here can
      // claim the install is done — a local flag is not evidence.
      const link = await checkDeviceLink();
      if (link === 'bounced') return;
      if (link === 'unlinked' || (link === 'unknown' && !d.linked)) {
        setLinkErr(`This screen is not linked to ${d.storeLabel || 'the store'} yet. Link it here and then save again — nothing you typed is lost.`);
        update({ linked: false, step: 2 });
        return;
      }
      if (link === 'linked' && !d.linked) update({ linked: true });

      // Two calls on purpose. The stage gate returns 409 BEFORE writing anything,
      // so bundling the fields with the stage would throw away a full form of
      // typing every time the gate fires. Fields first: they persist regardless.
      const fields = await fetch(`/api/admin/stores/${d.storeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'admin-password': adminPw() },
        body: JSON.stringify({
          tvSerial: d.tvSerial.trim(), tvBrand: d.tvBrand.trim(), tvModel: d.tvModel.trim(),
          tvSizeInches: Number(d.tvSizeInches), tvTag: d.tvTag.trim(),
          espPlugId: d.espPlugId.trim(), espSwitchName: d.espSwitchName.trim() || null,
          wifiSsid: d.wifiSsid.trim(), wifiAuthType: d.wifiAuthType,
          wifiPassword: d.wifiAuthType === 'open' ? null : d.wifiPassword,
          wifiUsername: needsUsername(d.wifiAuthType) ? d.wifiUsername.trim() : null,
          installNotes: d.installNotes.trim() || null,
        }),
      });
      if (bounceIfUnauthorized(fields)) return;
      if (!fields.ok) {
        const body = await fields.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${fields.status}`);
      }

      // FORWARD only. The server gate guards forward crossings only, so an
      // unconditional 'physically_onboarded' walks a live store BACKWARDS: the
      // admin live count drops and the partner's dashboard timeline regresses
      // (isLive reads `stage === 'live' || liveAt`, and liveAt is null for most
      // stores). Swapping a dead panel must never cost a store its stage.
      // Re-read the stage rather than trusting the draft's snapshot; fall back to
      // the snapshot only when the server is unreachable, since the alternative
      // is stranding a genuine install over a dropped request.
      const serverStage = await liveStage();
      if (stageRank(serverStage ?? d.stage) < INSTALL_RANK) {
        const staged = await fetch(`/api/admin/stores/${d.storeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'admin-password': adminPw() },
          body: JSON.stringify({ onboardingStage: 'physically_onboarded' }),
        });
        if (bounceIfUnauthorized(staged)) return;
        if (staged.status === 409) {
          const body = await staged.json().catch(() => null) as { error?: string; missing?: string[] } | null;
          const missing = body?.missing ?? [];
          if (missing.includes('Photo of the shop front')) setForceShop(true);
          setGate({ error: body?.error ?? 'The screen record is incomplete.', missing });
          return;
        }
        if (!staged.ok) {
          const body = await staged.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${staged.status}`);
        }
        update({ stage: 'physically_onboarded', step: 8 });
        return;
      }
      // Already at or past physically_onboarded: the install record is updated
      // and the stage is left exactly where Ops put it. Carry the server's value
      // into the draft so the done screen names the stage the store is really at.
      update({ stage: serverStage ?? d.stage, step: 8 });
    } catch (e) {
      setSaveErr(`${(e as Error).message}. Everything you entered is still saved on this phone — try again.`);
    } finally {
      setSaving(false);
    }
  };

  const startAnother = () => {
    // Only THIS install is cleared. Any other unfinished draft on the phone is
    // left for the resume prompt to offer.
    dropDraft(d.id);
    window.location.href = '/admin/pair?fresh=1';
  };

  const wanted = requiredPhotos(d, forceShop);
  const summary: { label: string; value: string; step: number }[] = [
    { label: 'Store',    value: d.storeLabel, step: 2 },
    { label: 'Screen',   value: deviceName, step: 2 },
    { label: 'Rotation', value: d.orientation === 'PORTRAIT' ? 'Portrait' : 'Portrait flipped', step: 2 },
    { label: 'TV',       value: [d.tvBrand, d.tvModel, d.tvSizeInches && `${d.tvSizeInches}"`].filter(Boolean).join(' · '), step: 3 },
    { label: 'Serial',   value: d.tvSerial, step: 3 },
    { label: 'Tag',      value: d.tvTag, step: 3 },
    { label: 'Wi-Fi',    value: [d.wifiSsid, AUTH_TYPES.find((a) => a.v === d.wifiAuthType)?.label].filter(Boolean).join(' · '), step: 4 },
    { label: 'Plug',     value: d.espPlugId, step: 5 },
    { label: 'Photos',   value: `${wanted.filter((k) => d.photos[k]?.url).length} of ${wanted.length} uploaded`, step: 6 },
  ];

  // ── Screens ────────────────────────────────────────────────────────────────

  // Done — outside the stepper, so no progress bar.
  if (d.step === 8) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="w-full max-w-md space-y-4 mt-8">
        <CheckCircle2 className="h-12 w-12 text-green-600" />
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Install recorded</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-bold text-foreground">{deviceName}</span> is on the fleet and{' '}
            <span className="font-bold text-foreground">{d.storeLabel}</span>{' '}
            {stageRank(d.stage) > INSTALL_RANK ? (
              <>stays at stage <span className="font-bold text-foreground">{stageLabel(d.stage).toLowerCase()}</span> — a re-visit never moves a store backwards.</>
            ) : (
              <>is now at stage <span className="font-bold text-foreground">physically onboarded</span>.</>
            )}
          </p>
        </div>
        <Checklist title="Before you leave the shop" items={[
          'Confirm the screen is playing and the remote can’t escape the player.',
          'Check proof-of-play rows appear in Admin → Reports. Nothing after 10 minutes of confirmed playback is a P0 — call the Ops Lead before leaving, not after.',
        ]} />
        {stageRank(d.stage) <= INSTALL_RANK && (
          <Checklist title="Ops takes it from here" items={[
            'KYC documents reviewed and approved',
            'Payout method captured and verified',
            'Stage set to live, which starts the partner’s earning clock',
          ]} />
        )}
        <a href="/admin?tab=screens" className={btn}>Go to Screens <ArrowRight className="h-4 w-4" /></a>
        <button type="button" onClick={startAnother} className={`${btnQuiet} w-full`}>Start another install</button>
      </motion.div>
    );
  }

  return (
    <div className="w-full max-w-md mt-4">
      <StepHeader step={d.step} draft={d} forceShop={forceShop} onJump={goto} />

      {navErr && (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{navErr}</p>
      )}

      <motion.div key={d.step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
        className="space-y-4">

        {/* ── 1. Pair ─────────────────────────────────────────────────────── */}
        {d.step === 1 && (
          <>
            {d.deviceId ? (
              <>
                <CheckCircle2 className="h-10 w-10 text-green-600" />
                <div>
                  {/* deviceLabel is set only by the already-paired path, so it
                      decides the wording — a stale code from a failed scan must
                      not claim the TV just paired. */}
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    {d.deviceLabel ? 'Screen selected' : 'Screen paired'}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {d.deviceLabel ? (
                      <><span className="font-bold text-foreground break-words">{d.deviceLabel}</span> is already on the fleet. Carry on to record or correct its install.</>
                    ) : (
                      <>Code <span className="font-mono font-bold text-foreground">{d.code}</span> is on the fleet. The TV should have left the pairing view — check it before you continue.</>
                    )}
                  </p>
                </div>
                <button type="button" onClick={next} className={btn}>Continue <ArrowRight className="h-4 w-4" /></button>
              </>
            ) : pickFleet ? (
              // A screen already on the fleet shows no pairing code, so neither
              // the QR nor the 6-character box can start a re-visit: a Wi-Fi
              // fix, a panel swap, or a store frozen by the install gate.
              <>
                <Monitor className="h-10 w-10 text-muted-foreground" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">Find the screen</h1>
                  <p className="text-sm text-muted-foreground mt-1">Pick the screen you are standing in front of. Newest first — search by store, screen name or hardware key.</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input value={fleetQ} onChange={(e) => setFleetQ(e.target.value)} autoCorrect="off"
                    placeholder="Search screen, store or hardware key" className={`${inp} pl-10`} />
                </div>
                {fleetErr && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-700">{fleetErr}</p>
                    <button type="button" onClick={() => setFleetErr(null)} className="mt-2 text-sm font-bold text-red-700 underline underline-offset-2 flex items-center gap-1">
                      <RefreshCw className="h-3.5 w-3.5" /> Retry
                    </button>
                  </div>
                )}
                {!fleet && !fleetErr && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading the fleet…</p>}
                {fleet && (
                  <div className="space-y-2">
                    {fleetMatches.map((x) => (
                      <button key={x.id} type="button" onClick={() => useFleetDevice(x)}
                        className="w-full rounded-xl border border-border bg-card p-3 text-left hover:border-primary transition-colors">
                        <p className="text-sm font-bold text-foreground break-words">{x.storeName || x.hardwareKey || x.id}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">
                          {x.linkedStoreName ?? 'Not linked to a store'}
                          {x.locality ? ` · ${x.locality}` : ''}
                          {x.status ? ` · ${x.status.toLowerCase()}` : ''}
                        </p>
                      </button>
                    ))}
                    {!fleetMatches.length && <p className="text-sm text-muted-foreground">No screen matches that. Try the store name or the hardware key.</p>}
                    {!fleetQ.trim() && fleet.length > fleetMatches.length && <p className="text-xs text-muted-foreground">Showing the {fleetMatches.length} newest — search to find an older one.</p>}
                  </div>
                )}
                <button type="button" onClick={() => setPickFleet(false)}
                  className="text-sm font-bold text-muted-foreground underline underline-offset-2">Enter a pairing code instead</button>
              </>
            ) : pairState === 'busy' || (pairState === 'idle' && d.code.length === 6) ? (
              // 'idle' with a usable code is the frame before the effect fires —
              // show the spinner, not a flash of the manual-entry form.
              <>
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Connecting screen…</h1>
                <p className="text-sm text-muted-foreground">Code <span className="font-mono font-bold text-foreground">{d.code}</span></p>
              </>
            ) : (
              <>
                <Tv2 className="h-10 w-10 text-muted-foreground" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    {pairState === 'error' ? 'Couldn’t connect this screen' : 'Enter the pairing code'}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {pairState === 'error'
                      ? pairErr
                      : 'The TV shows a 6-character code under the QR. Type it here if the QR will not scan.'}
                  </p>
                </div>
                <Field label="Pairing code">
                  <input value={manualCode} inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                    maxLength={6} placeholder="ABC123"
                    onChange={(e) => setManualCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    className={`${inp} font-mono tracking-[0.3em] text-center`} />
                </Field>
                <button type="button" disabled={manualCode.length !== 6}
                  onClick={() => { setPairState('idle'); setPairErr(null); update({ code: manualCode }); }}
                  className={btn}>Connect screen</button>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-sm font-bold text-foreground">No code on the screen?</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">A screen that is already on the fleet never shows one. Pick it from the fleet instead — the rest of the wizard is the same.</p>
                  <button type="button" onClick={() => setPickFleet(true)} className={`${btnQuiet} w-full mt-3`}>
                    <Monitor className="h-4 w-4 shrink-0" /> This screen is already paired
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── 2. Store ────────────────────────────────────────────────────── */}
        {d.step === 2 && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Which store?</h1>
              <p className="text-sm text-muted-foreground mt-1">Link this screen to the partner it is installed in.</p>
            </div>

            {d.storeId && (
              <div className={`rounded-xl border p-3 ${stageRank(d.stage) >= INSTALL_RANK ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                <div className="flex items-center gap-2">
                  <Check className={`h-4 w-4 shrink-0 ${stageRank(d.stage) >= INSTALL_RANK ? 'text-amber-700' : 'text-green-700'}`} />
                  <p className={`text-sm font-bold flex-1 min-w-0 truncate ${stageRank(d.stage) >= INSTALL_RANK ? 'text-amber-900' : 'text-green-800'}`}>{d.storeLabel}</p>
                  {/* "Change" no longer clears the store: nulling it made the
                      same-store guard in pickStore dead, so one mis-tap here
                      wiped all 13 install fields and the photos. */}
                  <button type="button" onClick={() => { setChanging(true); setConfirmStore(null); }}
                    className={`text-xs font-bold underline underline-offset-2 shrink-0 ${stageRank(d.stage) >= INSTALL_RANK ? 'text-amber-900' : 'text-green-800'}`}>Change</button>
                </div>
                <p className={`text-xs mt-1 ${stageRank(d.stage) >= INSTALL_RANK ? 'text-amber-800' : 'text-green-700'}`}>
                  Stage: <span className="font-bold">{stageLabel(d.stage)}</span>
                  {stageRank(d.stage) >= INSTALL_RANK && ' — already onboarded, so this visit will not change its stage.'}
                </p>
              </div>
            )}

            {(!d.storeId || changing) && (
              <>
                {confirmStore && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-900 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="flex-1 min-w-0 break-words">Check before you switch to {confirmStore.storeName}</span>
                    </p>
                    <ul className="mt-2 space-y-2">
                      {stageRank(confirmStore.onboardingStage) >= INSTALL_RANK && (
                        <li className="flex gap-2 text-sm text-amber-900">
                          <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                          <span className="flex-1">This store is already at <span className="font-bold">{stageLabel(confirmStore.onboardingStage).toLowerCase()}</span>. Only continue if you are swapping or adding a panel — its stage will be left as it is.</span>
                        </li>
                      )}
                      {hasCaptured(d) && (
                        <li className="flex gap-2 text-sm text-amber-900">
                          <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                          <span className="flex-1">The install details on this phone{d.storeLabel ? ` for ${d.storeLabel}` : ''} will be cleared and re-loaded from the new store.</span>
                        </li>
                      )}
                    </ul>
                    <button type="button" onClick={() => applyStore(confirmStore)} className={`${btn} mt-3`}>Use this store</button>
                    <button type="button" onClick={() => setConfirmStore(null)} className={`${btnQuiet} w-full mt-2`}>Cancel</button>
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} autoCorrect="off"
                    placeholder="Search store, owner or locality" className={`${inp} pl-10`} />
                </div>
                {storesErr && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-sm text-red-700">{storesErr}</p>
                    <button type="button" onClick={() => setStoresErr(null)} className="mt-2 text-sm font-bold text-red-700 underline underline-offset-2 flex items-center gap-1">
                      <RefreshCw className="h-3.5 w-3.5" /> Retry
                    </button>
                  </div>
                )}
                {!stores && !storesErr && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading stores…</p>}
                {stores && (
                  <div className="space-y-2">
                    {matches.map((s) => (
                      <button key={s.id} type="button" onClick={() => pickStore(s)}
                        className={`w-full rounded-xl border bg-card p-3 text-left transition-colors ${
                          s.id === d.storeId ? 'border-primary' : 'border-border hover:border-primary'}`}>
                        <p className="text-sm font-bold text-foreground break-words">{s.storeName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 break-words">
                          {[s.locality, s.city].filter(Boolean).join(', ') || 'No locality'}
                          {s.deviceCount ? ` · ${s.deviceCount} screen${s.deviceCount > 1 ? 's' : ''}` : ''}
                        </p>
                        {/* The stage is the difference between a first install
                            and a panel swap — it belongs on the row, not buried
                            in a run-on line of meta text. */}
                        <span className={`inline-block mt-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          stageRank(s.onboardingStage) >= INSTALL_RANK ? 'bg-amber-100 text-amber-900' : 'bg-muted text-muted-foreground'}`}>
                          {stageLabel(s.onboardingStage)}
                          {s.id === d.storeId ? ' · picked' : ''}
                        </span>
                      </button>
                    ))}
                    {!matches.length && <p className="text-sm text-muted-foreground">No store matches that. Try the owner&apos;s name or the locality.</p>}
                    {!search && stores.length > matches.length && <p className="text-xs text-muted-foreground">Showing the {matches.length} newest — search to find an older one.</p>}
                  </div>
                )}
                {live.storeId && <p className="text-xs font-medium text-red-600">{live.storeId}</p>}
                {changing && (
                  <button type="button" onClick={() => { setChanging(false); setConfirmStore(null); }}
                    className={`${btnQuiet} w-full`}>Keep the store already picked</button>
                )}
              </>
            )}

            {d.storeId && !changing && (
              <>
                <Field label="Where in the shop" hint={`The screen will be named "${d.storeLabel} - ${d.position.trim() || 'Counter'}".`} error={live.position}>
                  <input value={d.position} onChange={(e) => update({ position: e.target.value, linked: false })}
                    placeholder="Counter" className={inp} />
                </Field>
                <div className="flex gap-2">
                  {['Counter', 'Entrance', 'Billing'].map((p) => (
                    <button key={p} type="button" onClick={() => update({ position: p, linked: false })}
                      className={`${btnQuiet} flex-1 px-2`}>{p}</button>
                  ))}
                </div>

                <Field group label="Orientation" hint="The panel is mounted rotated 90°. If content comes out upside-down, switch to flipped — never remount the panel.">
                  <div className="grid grid-cols-2 gap-2">
                    {([['PORTRAIT', 'Portrait'], ['PORTRAIT_FLIPPED', 'Portrait flipped']] as const).map(([v, label]) => (
                      <button key={v} type="button" onClick={() => update({ orientation: v, linked: false })}
                        className={`h-12 rounded-xl border text-sm font-bold transition-colors ${
                          d.orientation === v ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-foreground'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>

                {linkErr && <p className="text-xs font-medium text-red-600">{linkErr}</p>}
                <button type="button" onClick={linkDevice} disabled={linkBusy} className={btn}>
                  {linkBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Linking…</> : <>Link screen &amp; continue <ArrowRight className="h-4 w-4" /></>}
                </button>
              </>
            )}
          </>
        )}

        {/* ── 3. TV ───────────────────────────────────────────────────────── */}
        {d.step === 3 && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">The TV</h1>
              <p className="text-sm text-muted-foreground mt-1">All five are required. Read the serial and model off the plate on the back before you mount the cable tidy.</p>
            </div>
            <Field label="Serial number" hint="Manufacturer serial from the back-panel plate." error={live.tvSerial}>
              <input value={d.tvSerial} onChange={(e) => update({ tvSerial: e.target.value })}
                autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                placeholder="e.g. FSK43A2401234" className={`${inp} font-mono`} />
            </Field>
            <Field label="Company" error={live.tvBrand}>
              <input value={d.tvBrand} onChange={(e) => update({ tvBrand: e.target.value })} placeholder="e.g. Foxsky" className={inp} />
            </Field>
            <Field label="Model number" error={live.tvModel}>
              <input value={d.tvModel} onChange={(e) => update({ tvModel: e.target.value })}
                autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                placeholder="e.g. 43FS-VS" className={`${inp} font-mono`} />
            </Field>
            <Field label="Size (inches)" error={live.tvSizeInches}>
              <input value={d.tvSizeInches} onChange={(e) => update({ tvSizeInches: e.target.value.replace(/[^0-9]/g, '') })}
                inputMode="numeric" placeholder="43" className={inp} />
            </Field>
            <Field label="ALIVE number / tag" hint="The number we wrote on the unit — not the manufacturer serial." error={live.tvTag}>
              <input value={d.tvTag} onChange={(e) => update({ tvTag: e.target.value })} placeholder="e.g. TV-014" className={inp} />
            </Field>
            <button type="button" onClick={next} className={btn}>Continue <ArrowRight className="h-4 w-4" /></button>
          </>
        )}

        {/* ── 4. Network ──────────────────────────────────────────────────── */}
        {d.step === 4 && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">The network</h1>
              <p className="text-sm text-muted-foreground mt-1">Nobody can read these off the router remotely. If they are wrong, the next Wi-Fi change costs a site visit.</p>
            </div>
            <Field label="Network name (SSID)" hint="Exactly as shown on the TV, capitals included." error={live.wifiSsid}>
              <input value={d.wifiSsid} onChange={(e) => update({ wifiSsid: e.target.value })}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="SharmaKirana_5G" className={inp} />
            </Field>
            <Field group label="Security type" error={live.wifiAuthType}>
              <div className="space-y-2">
                {AUTH_TYPES.map((a) => (
                  <button key={a.v} type="button" onClick={() => update({ wifiAuthType: a.v })}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      d.wifiAuthType === a.v ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                    <p className={`text-sm font-bold ${d.wifiAuthType === a.v ? 'text-primary' : 'text-foreground'}`}>{a.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.hint}</p>
                  </button>
                ))}
              </div>
            </Field>
            {d.wifiAuthType === 'portal' && (
              <div className="rounded-xl border border-border bg-muted p-3">
                <p className="text-sm font-bold text-foreground">A captive portal will break the player</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">The screen cannot tap through a login page after every reboot. Ask the shop to whitelist the screen&apos;s MAC, or move it to a different network before you leave.</p>
              </div>
            )}
            {d.wifiAuthType !== 'open' && (
              <Field label="Password" hint="Shown as you type on purpose — check it against the router sticker." error={live.wifiPassword}>
                <input value={d.wifiPassword} onChange={(e) => update({ wifiPassword: e.target.value })}
                  autoCapitalize="none" autoCorrect="off" spellCheck={false} className={`${inp} font-mono`} />
              </Field>
            )}
            {needsUsername(d.wifiAuthType) && (
              <Field label="Username" hint="The ISP or portal login this network asks for." error={live.wifiUsername}>
                <input value={d.wifiUsername} onChange={(e) => update({ wifiUsername: e.target.value })}
                  autoCapitalize="none" autoCorrect="off" spellCheck={false} className={inp} />
              </Field>
            )}
            <button type="button" onClick={next} className={btn}>Continue <ArrowRight className="h-4 w-4" /></button>
          </>
        )}

        {/* ── 5. Smart plug ───────────────────────────────────────────────── */}
        {d.step === 5 && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">The smart plug</h1>
              <p className="text-sm text-muted-foreground mt-1">This is how the screen gets power-cycled remotely. Without the ID nobody can find it later.</p>
            </div>
            <Field label="Plug ID" hint="Printed on the plug's own label — read it before you push the plug into the socket." error={live.espPlugId}>
              <input value={d.espPlugId} onChange={(e) => update({ espPlugId: e.target.value })}
                autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                placeholder="e.g. 10021f3c9a" className={`${inp} font-mono`} />
            </Field>
            <Field label="Switch name (optional)" hint="The label on the switch board, if there is one.">
              <input value={d.espSwitchName} onChange={(e) => update({ espSwitchName: e.target.value })} placeholder="Counter socket" className={inp} />
            </Field>
            <Field label="Notes (optional)" hint="Anything the next technician needs: mount height, which socket, whose permission.">
              <textarea value={d.installNotes} onChange={(e) => update({ installNotes: e.target.value })} rows={3}
                className={`${inp} h-auto py-3 resize-none`} />
            </Field>
            <button type="button" onClick={next} className={btn}>Continue <ArrowRight className="h-4 w-4" /></button>
          </>
        )}

        {/* ── 6. Photos ───────────────────────────────────────────────────── */}
        {d.step === 6 && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Photos</h1>
              <p className="text-sm text-muted-foreground mt-1">Field evidence — Ops cannot sign the install off without them. Each one uploads as soon as you take it.</p>
            </div>
            {requiredPhotos(d, forceShop).map((k) => {
              const busy = !!photoBusy[k];
              return (
                <PhotoTile key={k} kind={k} photo={d.photos[k]} busy={busy}
                  pendingUrl={pending[k]?.url}
                  // A tile that is uploading is neither idle nor "required" —
                  // flagging it red invited the second tap that duplicated the
                  // upload and orphaned an R2 object.
                  error={busy ? undefined : (photoErr[k] ?? live[k])}
                  onPick={(f) => uploadPhoto(k, f)}
                  onRetry={!busy && pending[k] ? () => uploadPhoto(k, pending[k]!.file) : undefined} />
              );
            })}
            <button type="button" onClick={next} className={btn}>Continue <ArrowRight className="h-4 w-4" /></button>
          </>
        )}

        {/* ── 7. Finish ───────────────────────────────────────────────────── */}
        {d.step === 7 && (
          <>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Check and save</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {stageRank(d.stage) >= INSTALL_RANK
                  ? `One save records everything. ${d.storeLabel} is already at ${stageLabel(d.stage).toLowerCase()}, so its stage is left alone.`
                  : 'One save records everything and moves the store to physically onboarded.'}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {summary.map(({ label, value, step }) => (
                <button key={label} type="button" onClick={() => goto(step)} className="w-full flex items-baseline gap-3 p-3 text-left">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground w-16 shrink-0">{label}</span>
                  <span className="text-sm text-foreground flex-1 min-w-0 break-words">{value || '—'}</span>
                  <span className="text-xs font-bold text-primary shrink-0">Edit</span>
                </button>
              ))}
            </div>

            {gate && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {gate.error}
                </p>
                <div className="mt-3 space-y-1.5">
                  {gate.missing.map((m) => (
                    <div key={m} className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded border border-red-400 shrink-0" />
                      <span className="text-sm text-red-800 flex-1 min-w-0">{m}</span>
                      {MISSING_STEP[m] && (
                        <button type="button" onClick={() => goto(MISSING_STEP[m])}
                          className="text-xs font-bold text-red-800 underline underline-offset-2 shrink-0">Fix</button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-red-700">Everything else was saved — fix these and press save again.</p>
              </div>
            )}
            {saveErr && <p className="text-sm font-medium text-red-600">{saveErr}</p>}

            <button type="button" onClick={finish} disabled={saving} className={btn}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : gate ? 'Save again' : 'Save & finish install'}
            </button>
          </>
        )}
      </motion.div>

      {d.step > 1 && d.step < 8 && (
        <button type="button" onClick={() => goto(d.step - 1)}
          className="mt-4 flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
      )}
    </div>
  );
}

export default function PairScreenPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-6 pb-16">
      <Suspense fallback={<Loader2 className="h-6 w-6 text-primary animate-spin mt-12" />}>
        <PairInner />
      </Suspense>
    </div>
  );
}
