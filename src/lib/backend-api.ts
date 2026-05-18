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
  id:          string;
  hardwareKey: string;
  storeName:   string;
  storeId?:    string | null;
  status:      'ONLINE' | 'OFFLINE' | 'PENDING';
  lastSeen?:   string | null;
  lastPlayAt?: string | null;
  groupName?:  string | null;
  uptimePct?:  number | null;
  claimedAt:   string;
  currentSchedule?: {
    id:           string;
    name:         string;
    playlistName: string | null;
    endsAt:       string;
  } | null;
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
  id:          string;
  name:        string;
  playlistId:  string;
  playlist?:   { name: string };
  deviceIds?:  string[];
  groupName?:  string;
  startAt:     string;
  endAt:       string;
  recurrence:  'once' | 'daily' | 'weekly';
  dailyStart?: string;
  dailyEnd?:   string;
  createdAt:   string;
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

export const getDevices = () =>
  apiFetch<{ devices: Device[] }>('/api/devices').then((r) => r.devices);

export const updateDevice = (id: string, body: { storeName?: string; groupName?: string }) =>
  apiFetch<{ device: Device }>(`/api/devices/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    .then((r) => r.device);

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

export const createSchedule = (body: Omit<Schedule, 'id' | 'createdAt' | 'playlist'>) =>
  apiFetch<{ schedule: Schedule }>('/api/schedules', { method: 'POST', body: JSON.stringify(body) })
    .then((r) => r.schedule);

export const deleteSchedule = (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/schedules/${id}`, { method: 'DELETE' });
