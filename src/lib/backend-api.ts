// Typed fetch wrapper for the in-Studio device/content/scheduling API.
// Calls relative /api/* paths — auth is handled by the same Next.js app session.

export type Device = {
  id:          string;
  hardwareKey: string;
  storeName:   string;
  storeId?:    string;
  status:      'online' | 'offline' | 'pending';
  lastSeen?:   string;
  uptimePct?:  number;
  claimedAt:   string;
};

export type PlayEvent = {
  id:         string;
  deviceId:   string;
  mediaId:    string;
  layoutId?:  string;
  startedAt:  string;
  endedAt:    string;
  durationMs: number;
  tag?:       string;
};

export type Content = {
  id:          string;
  name:        string;
  type:        'image' | 'video';
  url:         string;
  md5:         string;
  sizeBytes:   number;
  uploadedAt:  string;
};

export type PlaylistItem = { contentId: string; durationMs: number; order: number };

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
  deviceIds?:  string[];
  groupName?:  string;
  startAt:     string;
  endAt:       string;
  recurrence:  'once' | 'daily' | 'weekly';
  createdAt:   string;
};

export type BackendError = { message: string; status: number };

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
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

export const getDevices       = ()              => apiFetch<Device[]>('/api/devices');
export const getDeviceStatus  = (id: string)    => apiFetch<Device>(`/api/devices/${id}/status`);

// ─── Play Events (POP) ────────────────────────────────────────────────────────

export const getEvents = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch<PlayEvent[]>(`/api/events${qs}`);
};

export function getEventsExportUrl(params?: Record<string, string>): string {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return `/api/events/export/csv${qs}`;
}

// ─── Content ─────────────────────────────────────────────────────────────────

export const getContent    = ()           => apiFetch<Content[]>('/api/content');
export const deleteContent = (id: string) => apiFetch<void>(`/api/content/${id}`, { method: 'DELETE' });

// ─── Playlists ────────────────────────────────────────────────────────────────

export const getPlaylists    = ()                 => apiFetch<Playlist[]>('/api/playlists');
export const createPlaylist  = (body: Omit<Playlist, 'id' | 'createdAt'>) =>
  apiFetch<Playlist>('/api/playlists', { method: 'POST', body: JSON.stringify(body) });
export const deletePlaylist  = (id: string)      => apiFetch<void>(`/api/playlists/${id}`, { method: 'DELETE' });

// ─── Schedules ────────────────────────────────────────────────────────────────

export const getSchedules    = ()                 => apiFetch<Schedule[]>('/api/schedules');
export const createSchedule  = (body: Omit<Schedule, 'id' | 'createdAt'>) =>
  apiFetch<Schedule>('/api/schedules', { method: 'POST', body: JSON.stringify(body) });
export const deleteSchedule  = (id: string)      => apiFetch<void>(`/api/schedules/${id}`, { method: 'DELETE' });
