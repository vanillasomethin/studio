// Typed fetch wrapper for the in-Studio device/content/scheduling API.
// Calls relative /api/* paths — auth is handled via admin-password header from env.

function adminHeaders(): Record<string, string> {
  // In browser: read from sessionStorage (set by admin page login gate).
  // Server-side: use ADMIN_PASSWORD env var (e.g. internal server-to-server calls).
  const pw = typeof window !== 'undefined'
    ? (sessionStorage.getItem('alive_admin_pw') ?? '')
    : (process.env.ADMIN_PASSWORD ?? '');
  return pw ? { 'admin-password': pw } : {};
}

export type Device = {
  id:               string;
  hardwareKey:      string;
  storeName:        string;
  storeId?:         string | null;
  linkedAt?:        string | null;
  linkedStoreName?: string | null;
  status:           'ONLINE' | 'OFFLINE' | 'PENDING';
  lastSeen?:        string | null;
  lastPlayAt?:      string | null;
  groupName?:       string | null;
  uptimePct?:       number | null;
  claimedAt:        string;
  lat?:             number | null;
  lng?:             number | null;
  city?:            string | null;
  locality?:        string | null;
  currentSchedule?: {
    id:           string;
    name:         string;
    playlistName: string | null;
    endsAt:       string;
  } | null;
};

export type DeviceGroup = {
  name:    string;
  total:   number;
  online:  number;
  offline: number;
  pending: number;
};

export type StoreSearchResult = {
  id:          string;
  storeName:   string;
  city:        string | null;
  locality:    string | null;
  screenCount: number;
};

export type PlayEvent = {
  id:          string;
  deviceId:    string;
  mediaId:     string;
  layoutId?:   string;
  campaignId?: string;
  startedAt:   string;
  endedAt:     string;
  durationMs:  number;
  tag?:        string;
  impressions: number;
  costPaise:   number;
};

export type Content = {
  id:          string;
  name:        string;
  type:        'image' | 'video';
  objectKey:   string;
  url:         string;
  md5:         string;
  sizeBytes:   number;
  durationMs?: number;
  createdAt:   string;
  tags:        string[];
  folder?:     string;
};

export type PlaylistItem = {
  id:         string;
  contentId:  string;
  durationMs: number;
  order:      number;
  content:    Content;
};

export type Playlist = {
  id:        string;
  name:      string;
  items:     PlaylistItem[];
  createdAt: string;
};

export type Schedule = {
  id:           string;
  name:         string;
  playlistId:   string;
  playlist?:    { name: string };
  deviceIds?:   string[];
  groupName?:   string | null;
  storeIds?:    string[];
  cityFilter?:  string | null;
  startAt:      string;
  endAt:        string;
  recurrence:   'once' | 'daily' | 'weekly';
  dailyStart?:  string;
  dailyEnd?:    string;
  orientation:  'landscape' | 'portrait' | 'any';
  intervalMins: number | null;
  priority:     number;
  createdAt:    string;
};

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...adminHeaders(),
      ...(opts?.headers ?? {}),
    },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw Object.assign(new Error(msg || `HTTP ${res.status}`), { status: res.status });
  }
  return res.json() as Promise<T>;
}

// ─── Devices ─────────────────────────────────────────────────────────────────

export type DevicesResponse = { devices: Device[]; nextCursor: string | null; total: number };

export const getDevices = (params?: Record<string, string>) => {
  const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch<DevicesResponse>(`/api/devices${qs}`);
};

export const updateDevice = (id: string, body: { storeName?: string; groupName?: string; storeId?: string | null }) =>
  apiFetch<{ device: Device }>(`/api/devices/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    .then((r) => r.device);

export const bulkUpdateDevices = (body: { ids: string[]; action: 'group' | 'delete'; groupName?: string }) =>
  apiFetch<{ updated?: number; deleted?: number }>('/api/devices/bulk', { method: 'POST', body: JSON.stringify(body) });

export const bulkPushSchedule = (body: { deviceIds: string[]; playlistId: string; durationMins: number; name?: string }) =>
  apiFetch<{ schedule: { id: string; name: string; endsAt: string } }>('/api/devices/bulk-schedule', { method: 'POST', body: JSON.stringify(body) });

export const getDeviceGroups = () =>
  apiFetch<{ groups: DeviceGroup[] }>('/api/devices/groups').then((r) => r.groups);

export const searchStores = (params?: { q?: string; city?: string }) => {
  const qs = params && Object.keys(params).filter(k => params[k as keyof typeof params]).length
    ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return apiFetch<{ stores: StoreSearchResult[]; cities: string[] }>(`/api/stores/search${qs}`);
};

// ─── Play Events (POP) ────────────────────────────────────────────────────────

export const getEvents = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch<{ events: PlayEvent[]; nextCursor: string | null }>(`/api/events${qs}`)
    .then((r) => r.events);
};

export function getEventsExportUrl(params?: Record<string, string>): string {
  const base = '/api/events/export/csv';
  if (!params || Object.keys(params).length === 0) return base;
  const pw = typeof window !== 'undefined' && (process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? '');
  const p  = { ...params, ...(pw ? { 'admin-password': pw } : {}) };
  return `${base}?${new URLSearchParams(p).toString()}`;
}

// ─── Content ─────────────────────────────────────────────────────────────────

export const getContent = () =>
  apiFetch<{ content: Content[]; totalBytes: number }>('/api/content').then((r) => r);

export const deleteContent = (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/content/${id}`, { method: 'DELETE' });

export const updateContentMeta = (id: string, body: { tags?: string[]; folder?: string | null }) =>
  apiFetch<{ id: string; tags: string[]; folder?: string | null }>('/api/content', {
    method: 'PATCH',
    body:   JSON.stringify({ id, ...body }),
  });

export const initiateUpload = (body: {
  name: string; type: 'image' | 'video'; sizeBytes: number; md5: string; mimeType?: string; durationMs?: number;
}) =>
  apiFetch<{ id: string; uploadUrl: string; objectKey: string }>('/api/content', {
    method: 'POST',
    body:   JSON.stringify(body),
  });

// ─── Playlists ────────────────────────────────────────────────────────────────

export const getPlaylists = () =>
  apiFetch<{ playlists: Playlist[] }>('/api/playlists').then((r) => r.playlists);

export const createPlaylist = (body: { name: string; items?: { contentId: string; durationMs: number }[] }) =>
  apiFetch<{ playlist: Playlist }>('/api/playlists', { method: 'POST', body: JSON.stringify(body) })
    .then((r) => r.playlist);

export const updatePlaylist = (id: string, body: { name?: string; items?: { contentId: string; durationMs: number }[] }) =>
  apiFetch<{ playlist: Playlist }>(`/api/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    .then((r) => r.playlist);

export const deletePlaylist = (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/playlists/${id}`, { method: 'DELETE' });

// ─── Schedules ────────────────────────────────────────────────────────────────

export const getSchedules = () =>
  apiFetch<{ schedules: Schedule[] }>('/api/schedules').then((r) => r.schedules);

export const createSchedule = (body: Omit<Schedule, 'id' | 'createdAt' | 'playlist' | 'priority'> & { priority?: number }) =>
  apiFetch<{ schedule: Schedule }>('/api/schedules', { method: 'POST', body: JSON.stringify(body) })
    .then((r) => r.schedule);

export const updateSchedule = (id: string, body: Partial<Omit<Schedule, 'id' | 'createdAt' | 'playlist'>>) =>
  apiFetch<{ schedule: Schedule }>(`/api/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    .then((r) => r.schedule);

export const deleteSchedule = (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/schedules/${id}`, { method: 'DELETE' });

// ─── Force sync ───────────────────────────────────────────────────────────────

export const forceSyncDevice = (id: string) =>
  apiFetch<{ ok: boolean; forceSyncAt: string | null }>(`/api/devices/${id}/force-sync`, { method: 'POST' });

// ─── Overlays (on-screen layouts) ─────────────────────────────────────────────

export type OverlayType     = 'TICKER' | 'NEWS_TICKER' | 'BANNER' | 'INFO_BAR';
export type OverlayPosition = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';

export type Overlay = {
  id:            string;
  name:          string;
  type:          OverlayType;
  enabled:       boolean;
  text:          string | null;
  feedUrl:       string | null;
  imageUrl:      string | null;
  feedItems:     unknown;
  feedFetchedAt: string | null;
  position:      OverlayPosition;
  bgColor:       string | null;
  fgColor:       string | null;
  speedPxSec:    number;
  heightPct:     number;
  deviceIds:     string[];
  groupName:     string | null;
  storeIds:      string[];
  cityFilter:    string | null;
  startAt:       string | null;
  endAt:         string | null;
  dailyStart:    string | null;
  dailyEnd:      string | null;
  requireWifi:   boolean;
  priority:      number;
  createdAt:     string;
  updatedAt:     string;
};

export const getOverlays = () =>
  apiFetch<{ overlays: Overlay[] }>('/api/overlays').then((r) => r.overlays);

export const createOverlay = (body: Partial<Overlay> & { name: string; type: OverlayType }) =>
  apiFetch<{ overlay: Overlay }>('/api/overlays', { method: 'POST', body: JSON.stringify(body) })
    .then((r) => r.overlay);

export const updateOverlay = (id: string, body: Partial<Overlay>) =>
  apiFetch<{ overlay: Overlay }>(`/api/overlays/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    .then((r) => r.overlay);

export const deleteOverlay = (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/overlays/${id}`, { method: 'DELETE' });

export const previewFeed = (url: string) =>
  apiFetch<{ items: { title: string; link: string; pubDate: string | null }[]; cached: boolean }>(`/api/feed/proxy?url=${encodeURIComponent(url)}`);
