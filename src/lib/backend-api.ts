// Typed fetch wrapper for ALIVE-Backend REST calls.
// Reads NEXT_PUBLIC_BACKEND_URL + BACKEND_ADMIN_TOKEN at call time.

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

function base(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const b = base();
  if (!b) throw Object.assign(new Error('Backend URL not configured. Set NEXT_PUBLIC_BACKEND_URL.'), { status: 0 });
  const res = await fetch(`${b}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${process.env.NEXT_PUBLIC_BACKEND_ADMIN_TOKEN ?? ''}`,
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw Object.assign(new Error(msg || `HTTP ${res.status}`), { status: res.status });
  }
  return res.json() as Promise<T>;
}

// ─── Devices ─────────────────────────────────────────────────────────────────

export const getDevices       = ()   => apiFetch<Device[]>('/devices');
export const getDeviceStatus  = (id: string) => apiFetch<Device>(`/devices/${id}/status`);

// ─── Play Events (POP) ────────────────────────────────────────────────────────

export const getEvents = (params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch<PlayEvent[]>(`/events${qs}`);
};

export function getEventsExportUrl(params?: Record<string, string>): string {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return `${base()}/events/export/csv${qs}`;
}

// ─── Content ─────────────────────────────────────────────────────────────────

export const getContent    = ()         => apiFetch<Content[]>('/content');
export const deleteContent = (id: string) => apiFetch<void>(`/content/${id}`, { method: 'DELETE' });

// ─── Playlists ────────────────────────────────────────────────────────────────

export const getPlaylists    = ()                 => apiFetch<Playlist[]>('/playlists');
export const createPlaylist  = (body: Omit<Playlist, 'id' | 'createdAt'>) =>
  apiFetch<Playlist>('/playlists', { method: 'POST', body: JSON.stringify(body) });
export const deletePlaylist  = (id: string)      => apiFetch<void>(`/playlists/${id}`, { method: 'DELETE' });

// ─── Schedules ────────────────────────────────────────────────────────────────

export const getSchedules    = ()                 => apiFetch<Schedule[]>('/schedules');
export const createSchedule  = (body: Omit<Schedule, 'id' | 'createdAt'>) =>
  apiFetch<Schedule>('/schedules', { method: 'POST', body: JSON.stringify(body) });
export const deleteSchedule  = (id: string)      => apiFetch<void>(`/schedules/${id}`, { method: 'DELETE' });
