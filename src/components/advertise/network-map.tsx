'use client';

import { useEffect, useRef, useState } from 'react';
import { ALIVE_MAP_CSS, createAliveMap, fitToPins } from '@/lib/alive-map';
import { LOCALITY_TIP_CSS } from '@/lib/locality-boundaries';
import { brand, brandType } from '@/lib/brand';
import {
  NETWORK_STORES,
  TIER_META,
  TIER_ORDER,
  type NetworkStore,
  type SlotTier,
} from '@/lib/advertise-network';
import type { PotentialStore } from '@/app/api/advertise/prospects/route';

// Plain Leaflet, dynamically imported — no react-leaflet (it doesn't support the
// React version this app runs on). Leaflet's stylesheet is already imported by
// src/app/globals.css, so nothing is injected here.

type Props = {
  /** Stores currently chosen in the estimator; the same array the form receives. */
  selectedIds: string[];
  /** Clicking a pin toggles that store in the estimator selection. */
  onToggle: (id: string) => void;
};

/** Tier reads from the letter and the pin size, never from colour alone. */
const TIER_LETTER: Record<SlotTier, string> = { flagship: 'F', growth: 'G', standard: 'S' };
// Kept small on purpose: these shops sit within a couple of kilometres of each
// other, so at the zoom that fits them all, larger badges bury their neighbours.
// Markers also rise on hover, and the estimator's checkbox list is the
// authoritative way to pick a store.
const TIER_SIZE: Record<SlotTier, number> = { flagship: 28, growth: 24, standard: 20 };

// A location ALIVE is scouting but hasn't signed — greyed out, same idea as
// the "onboarded" grey on the homepage's own map, but here it means "ask us
// to prioritise this one" rather than "already a partner, coming soon".
const POTENTIAL_COLOR = '#9ca3af';
const POTENTIAL_SIZE = 20;

function potentialPinHtml(): string {
  return (
    `<span class="adv-pin adv-pin--potential" ` +
    `style="width:${POTENTIAL_SIZE}px;height:${POTENTIAL_SIZE}px;background:#fff;color:${POTENTIAL_COLOR};` +
    `border-color:${POTENTIAL_COLOR};font-size:${Math.round(POTENTIAL_SIZE * 0.42)}px">P</span>`
  );
}

function pinHtml(store: NetworkStore, selected: boolean): string {
  const size = TIER_SIZE[store.tier];
  const fill = selected ? 'var(--brand-accent)' : '#ffffff';
  const text = selected ? '#ffffff' : 'var(--brand-accent-strong)';
  return (
    `<span class="adv-pin${selected ? ' is-selected' : ''}" ` +
    `style="width:${size}px;height:${size}px;background:${fill};color:${text};font-size:${Math.round(size * 0.42)}px">` +
    `${TIER_LETTER[store.tier]}</span>`
  );
}

/** Store names are static config, but the popup is built as markup — escape anyway. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function NetworkMap({ selectedIds, onToggle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  // Surveyed pins from Store.lat/lng, keyed by curated store id. Empty until they
  // arrive, and empty forever if the fetch fails — the built-in coordinates in
  // advertise-network.ts are the fallback, so the map is never blank and never
  // waits on this.
  const [pins, setPins] = useState<Record<string, { lat: number; lng: number }>>({});
  const [prospects, setProspects] = useState<PotentialStore[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prospectMarkersRef = useRef<Map<string, any>>(new Map());
  // Non-null = the "ask ALIVE to onboard this" form is open for this pin.
  const [requestFor, setRequestFor] = useState<PotentialStore | null>(null);

  // The click handler has to see the latest onToggle without rebuilding markers.
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;

  useEffect(() => {
    let live = true;
    fetch('/api/advertise/network')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { pins?: Record<string, { lat: number; lng: number }> } | null) => {
        if (live && d?.pins) setPins(d.pins);
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    fetch('/api/advertise/prospects')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { prospects?: PotentialStore[] } | null) => {
        if (live && Array.isArray(d?.prospects)) setProspects(d.prospects);
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  /** The surveyed pin if ops has one for this shop, else the built-in fallback. */
  const positionOf = (store: NetworkStore): [number, number] => {
    const pin = pins[store.id];
    return pin ? [pin.lat, pin.lng] : [store.lat, store.lng];
  };
  // Read inside the Leaflet init effect, which must not re-run when pins arrive.
  const positionRef = useRef(positionOf);
  positionRef.current = positionOf;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // The guard above runs before the await below, so a double-fired effect
    // (Strict Mode, HMR) would otherwise get past it twice and Leaflet would
    // throw "Map container is already initialized".
    let cancelled = false;

    async function init() {
      const L = (await import('leaflet')).default;
      if (cancelled || mapRef.current || !containerRef.current) return;

      // The shared ALIVE map: same basemap, ward boundaries and controls as the
      // homepage and the onboarding picker. Only the first frame is set here —
      // fitToPins below, and again when the surveyed pins land, decides what
      // the map actually shows.
      const map = createAliveMap(
        L,
        containerRef.current,
        { center: [12.8797, 74.8465], zoom: 13 },
        () => mapRef.current === map,
      );

      NETWORK_STORES.forEach(store => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const marker = (L as any)
          .marker(positionRef.current(store), {
            title: `${store.name} — ${TIER_META[store.tier].label}`,
            keyboard: true,
            riseOnHover: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            icon: (L as any).divIcon({
              className: '',
              html: pinHtml(store, false),
              iconSize: [TIER_SIZE[store.tier], TIER_SIZE[store.tier]],
              iconAnchor: [TIER_SIZE[store.tier] / 2, TIER_SIZE[store.tier] / 2],
              popupAnchor: [0, -TIER_SIZE[store.tier] / 2],
            }),
          })
          .addTo(map)
          .bindPopup(
            `<p class="adv-popup-name">${esc(store.name)}</p>` +
              `<p class="adv-popup-tier">${esc(TIER_META[store.tier].label)}</p>` +
              `<p class="adv-popup-hint">Tap the pin to add or remove this store</p>`,
            { closeButton: false, className: 'adv-popup' }
          );

        marker.on('click', () => toggleRef.current(store.id));
        markersRef.current.set(store.id, marker);
      });

      fitToPins(L, map, Array.from(markersRef.current.values()));

      leafletRef.current = L;
      mapRef.current = map;
      setReady(true);
    }

    void init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      prospectMarkersRef.current.clear();
      setReady(false);
    };
  }, []);

  // Move every marker onto its surveyed position once the pins arrive, then
  // refit so the map frames where the shops actually are.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!ready || !map || !L || Object.keys(pins).length === 0) return;
    NETWORK_STORES.forEach(store => {
      const pin = pins[store.id];
      if (pin) markersRef.current.get(store.id)?.setLatLng([pin.lat, pin.lng]);
    });
    fitToPins(L, map, Array.from(markersRef.current.values()));
  }, [pins, ready]);

  // Add "potential" pins once the map is ready and the prospect fetch lands —
  // a separate effect because prospects arrive after the map-init effect (which
  // only runs once) has already built the store markers.
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!ready || !map || !L || prospects.length === 0) return;
    prospects.forEach(p => {
      if (prospectMarkersRef.current.has(p.id)) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const marker = (L as any)
        .marker([p.lat, p.lng], {
          title: `${p.label} — potential location`,
          keyboard: true,
          riseOnHover: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          icon: (L as any).divIcon({
            className: '',
            html: potentialPinHtml(),
            iconSize: [POTENTIAL_SIZE, POTENTIAL_SIZE],
            iconAnchor: [POTENTIAL_SIZE / 2, POTENTIAL_SIZE / 2],
            popupAnchor: [0, -POTENTIAL_SIZE / 2],
          }),
        })
        .addTo(map)
        .bindPopup(
          `<p class="adv-popup-name">${esc(p.label)}</p>` +
            `<p class="adv-popup-tier">Potential location</p>` +
            `<p class="adv-popup-hint">Tap the pin to ask ALIVE to onboard it</p>`,
          { closeButton: false, className: 'adv-popup' },
        );
      marker.on('click', () => setRequestFor(p));
      prospectMarkersRef.current.set(p.id, marker);
    });
  }, [prospects, ready]);

  // Repaint the pins whenever the estimator selection changes.
  useEffect(() => {
    const L = leafletRef.current;
    if (!ready || !L) return;
    NETWORK_STORES.forEach(store => {
      const marker = markersRef.current.get(store.id);
      if (!marker) return;
      const selected = selectedIds.includes(store.id);
      marker.setIcon(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (L as any).divIcon({
          className: '',
          html: pinHtml(store, selected),
          iconSize: [TIER_SIZE[store.tier], TIER_SIZE[store.tier]],
          iconAnchor: [TIER_SIZE[store.tier] / 2, TIER_SIZE[store.tier] / 2],
          popupAnchor: [0, -TIER_SIZE[store.tier] / 2],
        })
      );
      marker.setZIndexOffset(selected ? 500 : 0);
    });
  }, [selectedIds, ready]);

  return (
    <div>
      <div
        ref={containerRef}
        role="application"
        aria-label={`Map of ${NETWORK_STORES.length} stores across ${brand.city}. The same stores are listed as checkboxes in the estimator below.`}
        className="h-[300px] w-full rounded-lg border sm:h-[440px]"
        style={{ borderColor: 'var(--brand-line)', background: 'var(--brand-surface-muted)' }}
      />

      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" aria-hidden="true">
        {TIER_ORDER.map(tier => (
          <li key={tier} className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
            <span
              className="adv-pin"
              style={{
                width: TIER_SIZE[tier],
                height: TIER_SIZE[tier],
                background: '#fff',
                color: 'var(--brand-accent-strong)',
                fontSize: Math.round(TIER_SIZE[tier] * 0.42),
              }}
            >
              {TIER_LETTER[tier]}
            </span>
            {TIER_META[tier].label}
          </li>
        ))}
        <li className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
          <span
            className="adv-pin is-selected"
            style={{
              width: 26,
              height: 26,
              background: 'var(--brand-accent)',
              color: '#fff',
              fontSize: 11,
            }}
          >
            ✓
          </span>
          In your plan
        </li>
        {prospects.length > 0 && (
          <li className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
            <span
              className="adv-pin adv-pin--potential"
              style={{ width: POTENTIAL_SIZE, height: POTENTIAL_SIZE, background: '#fff', color: POTENTIAL_COLOR, borderColor: POTENTIAL_COLOR, fontSize: Math.round(POTENTIAL_SIZE * 0.42) }}
            >
              P
            </span>
            Potential — ask us to onboard it
          </li>
        )}
      </ul>

      {requestFor && (
        <ProspectRequestModal prospect={requestFor} onClose={() => setRequestFor(null)} />
      )}

      <style>{`
        ${LOCALITY_TIP_CSS}
        .adv-pin{display:inline-flex;align-items:center;justify-content:center;border-radius:9999px;
          border:2px solid var(--brand-accent);font-weight:700;line-height:1;
          font-family:${brandType.sans};box-shadow:0 1px 3px rgba(0,0,0,.22);
          transition:transform .15s ease;cursor:pointer;}
        .leaflet-marker-icon:hover .adv-pin,.leaflet-marker-icon:focus .adv-pin{transform:scale(1.12);}
        .leaflet-marker-icon:focus-visible{outline:3px solid var(--brand-accent-strong);outline-offset:2px;border-radius:9999px;}
        .adv-popup .leaflet-popup-content-wrapper{border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);}
        .adv-popup .leaflet-popup-content{margin:10px 14px;font-family:${brandType.sans};}
        .adv-popup-name{font-size:13px;font-weight:700;margin:0;color:#141414;}
        .adv-popup-tier{font-size:11px;margin:2px 0 0;color:#5A5A5A;text-transform:uppercase;letter-spacing:.08em;}
        .adv-popup-hint{font-size:11px;margin:6px 0 0;color:#5A5A5A;}
        .adv-pin--potential{border-style:dashed;}
        ${ALIVE_MAP_CSS}
      `}</style>
    </div>
  );
}

/** "Ask ALIVE to onboard this" — a brand's interest in a potential (not yet
 *  signed) location, posted to POST /api/advertise/prospect-request. Deliberately
 *  lighter than the full enquiry form below on the page: no agreement, no slot
 *  math, just enough for sales to follow up. */
function ProspectRequestModal({ prospect, onClose }: { prospect: PotentialStore; onClose: () => void }) {
  const [brandName, setBrandName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/advertise/prospect-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId: prospect.id, brandName, contactPerson, phone, notes }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,.5)', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, padding: 22, boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-ink)', margin: 0 }}>Request sent ✓</p>
            <p style={{ fontSize: 13, color: 'var(--brand-ink-muted)', marginTop: 8 }}>
              We&apos;ll reach out about {prospect.label}. In the meantime you can book from the stores already live above.
            </p>
            <button
              onClick={onClose}
              style={{ marginTop: 16, width: '100%', padding: '10px 0', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              Close
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-ink)', margin: 0 }}>Ask ALIVE to onboard {prospect.label}</p>
            <p style={{ fontSize: 12, color: 'var(--brand-ink-muted)', marginTop: 4 }}>
              {[prospect.locality, prospect.city].filter(Boolean).join(', ') || 'Potential location'} — not a partner yet. Tell us you&apos;re interested and we&apos;ll prioritise scouting it.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Brand name"
                style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--brand-line)', fontSize: 13 }} />
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Your name"
                style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--brand-line)', fontSize: 13 }} />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" inputMode="numeric"
                style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--brand-line)', fontSize: 13 }} />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else? (optional)" rows={2}
                style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid var(--brand-line)', fontSize: 13, resize: 'vertical' }} />
            </div>
            {error && <p style={{ fontSize: 12, color: 'var(--brand-accent-strong)', marginTop: 8 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={submit}
                disabled={submitting || !brandName.trim() || !contactPerson.trim() || !phone.trim()}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: 'var(--brand-accent)', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Sending…' : 'Send request'}
              </button>
              <button
                onClick={onClose}
                style={{ padding: '10px 16px', borderRadius: 8, background: 'transparent', color: 'var(--brand-ink-muted)', fontSize: 13, fontWeight: 600, border: '1px solid var(--brand-line)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
