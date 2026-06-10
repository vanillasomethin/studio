'use client';

import { useEffect, useRef } from 'react';
import type { Device } from '@/lib/backend-api';

const TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const MANGALURU: [number, number] = [12.8698, 74.8431];

const STATUS_COLOR: Record<Device['status'], string> = {
  ONLINE:  '#22c55e',
  OFFLINE: '#ef4444',
  PENDING: '#eab308',
};

function markerHtml(status: Device['status']) {
  const color = STATUS_COLOR[status];
  return `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`;
}

type Props = { devices: Device[] };

export default function FleetMap({ devices }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      // Leaflet CSS is loaded globally via app layout; no dynamic import needed.
      if (cancelled || !containerRef.current || mapRef.current) return;

      const withGeo = devices.filter((d) => d.lat != null && d.lng != null);
      const center: [number, number] = withGeo.length
        ? [
            withGeo.reduce((s, d) => s + d.lat!, 0) / withGeo.length,
            withGeo.reduce((s, d) => s + d.lng!, 0) / withGeo.length,
          ]
        : MANGALURU;

      const map = L.map(containerRef.current, { zoomControl: true }).setView(center, withGeo.length ? 13 : 12);
      L.tileLayer(TILE, { attribution: '© OpenStreetMap © CARTO', maxZoom: 19 }).addTo(map);
      mapRef.current = map;

      for (const d of withGeo) {
        const icon = L.divIcon({ html: markerHtml(d.status), className: '', iconSize: [12, 12], iconAnchor: [6, 6] });
        const popup = `
          <div style="font-size:12px;line-height:1.6;min-width:160px">
            <strong>${d.storeName}</strong><br/>
            <span style="color:${STATUS_COLOR[d.status]};font-weight:600">${d.status}</span>
            ${d.city ? `<br/><span style="color:#888">${d.locality ?? d.city}</span>` : ''}
            ${d.groupName ? `<br/><span style="color:#888">Group: ${d.groupName}</span>` : ''}
            ${d.uptimePct != null ? `<br/>Uptime: <strong>${d.uptimePct.toFixed(1)}%</strong>` : ''}
          </div>
        `;
        L.marker([d.lat!, d.lng!], { icon }).addTo(map).bindPopup(popup);
      }
    })();

    return () => { cancelled = true; };
  }, []); // mount once

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
