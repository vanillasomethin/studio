'use client';

import { useEffect, useRef, useState } from 'react';
import type { Device } from '@/lib/backend-api';

const TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const MANGALURU: [number, number] = [12.8698, 74.8431];

const STATUS_COLOR: Record<Device['status'], string> = {
  ONLINE:  '#22c55e',
  OFFLINE: '#ef4444',
  PENDING: '#eab308',
};

const STAGE_LABEL: Record<string, string> = {
  new:                  'New',
  contacted:            'Contacted',
  physically_onboarded: 'Physically onboarded',
  digitally_onboarded:  'Digitally onboarded',
  live:                 'Live',
};

/** An onboarded store as the admin store list returns it — enough to pin it. */
export type StoreLite = {
  id:              string;
  storeName:       string;
  locality?:       string | null;
  city?:           string | null;
  lat?:            number | null;
  lng?:            number | null;
  onboardingStage?: string | null;
};

// Popups are raw HTML and every name here was typed by a partner on the public
// registration form — escape before interpolating.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function markerHtml(status: Device['status']) {
  const color = STATUS_COLOR[status];
  return `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`;
}

// Hollow amber ring: a store that is on the map but has no screen yet.
const STORE_MARKER_HTML = '<div style="width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #f59e0b;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>';

/** Pinned stores with no screen of their own — the screen-less half of the map. */
function storesWithoutScreen(devices: Device[], stores: StoreLite[]): StoreLite[] {
  const screened = new Set(devices.map((d) => d.storeId));
  return stores.filter((s) =>
    !screened.has(s.id) && s.onboardingStage !== 'rejected'
    && Number.isFinite(s.lat) && Number.isFinite(s.lng)
    && Math.abs(s.lat!) <= 90 && Math.abs(s.lng!) <= 180);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function storeLayer(L: any, stores: StoreLite[]) {
  const layer = L.layerGroup();
  for (const s of stores) {
    const stage = s.onboardingStage ?? 'new';
    const area  = s.locality || s.city;
    const icon  = L.divIcon({ html: STORE_MARKER_HTML, className: '', iconSize: [12, 12], iconAnchor: [6, 6] });
    const popup = `
      <div style="font-size:12px;line-height:1.6;min-width:160px">
        <strong>${esc(s.storeName)}</strong><br/>
        <span style="color:#b45309;font-weight:600">No screen yet · ${esc(STAGE_LABEL[stage] ?? stage)}</span>
        ${area ? `<br/><span style="color:#888">${esc(area)}</span>` : ''}
      </div>
    `;
    L.marker([s.lat!, s.lng!], { icon, title: `${s.storeName} — no screen yet` }).bindPopup(popup).addTo(layer);
  }
  return layer;
}

type Props = { devices: Device[]; stores?: StoreLite[] };

export default function FleetMap({ devices, stores = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef    = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storeLayerRef = useRef<any>(null);
  // Flips once the map exists, so the store-layer effect below re-runs for a
  // list that arrived while the Leaflet chunk was still loading.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      // Leaflet CSS is loaded globally via app layout; no dynamic import needed.
      if (cancelled || !containerRef.current || mapRef.current) return;

      const withGeo = devices.filter((d) => d.lat != null && d.lng != null);
      const orphans = storesWithoutScreen(devices, stores);
      const pinned  = [...withGeo, ...orphans];
      const center: [number, number] = pinned.length
        ? [
            pinned.reduce((s, d) => s + d.lat!, 0) / pinned.length,
            pinned.reduce((s, d) => s + d.lng!, 0) / pinned.length,
          ]
        : MANGALURU;

      const map = L.map(containerRef.current, { zoomControl: true }).setView(center, pinned.length ? 13 : 12);
      L.tileLayer(TILE, { attribution: '© OpenStreetMap © CARTO', maxZoom: 19 }).addTo(map);
      mapRef.current     = map;
      leafletRef.current = L;

      for (const d of withGeo) {
        const icon = L.divIcon({ html: markerHtml(d.status), className: '', iconSize: [12, 12], iconAnchor: [6, 6] });
        const popup = `
          <div style="font-size:12px;line-height:1.6;min-width:160px">
            <strong>${esc(d.storeName)}</strong><br/>
            <span style="color:${STATUS_COLOR[d.status]};font-weight:600">${d.status}</span>
            ${d.city ? `<br/><span style="color:#888">${esc(d.locality ?? d.city)}</span>` : ''}
            ${d.groupName ? `<br/><span style="color:#888">Group: ${esc(d.groupName)}</span>` : ''}
            ${d.uptimePct != null ? `<br/>Uptime: <strong>${d.uptimePct.toFixed(1)}%</strong>` : ''}
          </div>
        `;
        L.marker([d.lat!, d.lng!], { icon }).addTo(map).bindPopup(popup);
      }
      setReady(true);
    })();

    return () => { cancelled = true; };
  }, []); // mount once

  // The store list comes from a second request and can land before or after
  // the map exists, so screen-less stores sit on their own layer, drawn from
  // the CURRENT props once the map is ready and redrawn whenever either list
  // changes — never from the closure the mount effect captured.
  useEffect(() => {
    const map = mapRef.current;
    const L   = leafletRef.current;
    if (!ready || !map || !L) return;
    storeLayerRef.current?.remove();
    storeLayerRef.current = storeLayer(L, storesWithoutScreen(devices, stores)).addTo(map);
  }, [ready, devices, stores]);

  // Update marker colours if devices change (status changes on refresh)
  useEffect(() => {
    if (!mapRef.current) return;
    // We re-render markers by removing + re-adding on device status changes.
    // For simplicity, trigger a full re-mount by clearing the ref.
    // This component is only shown in a view-toggle so re-mounts are infrequent.
  }, [devices]);

  return (
    <div
      ref={containerRef}
      className="rounded-xl overflow-hidden border border-border"
      style={{ height: 420 }}
    />
  );
}
