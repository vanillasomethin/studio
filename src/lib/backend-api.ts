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
  storePhotoUrl?:   string | null;
  status:           'ONLINE' | 'OFFLINE' | 'PENDING';
  lastSeen?:        string | null;
  lastPlayAt?:      string | null;
  groupName?:       string | null;
  orientation?:     'LANDSCAPE' | 'PORTRAIT' | 'PORTRAIT_FLIPPED' | 'AUTO' | null;
  playsOriginal?:   boolean;   // serve original uploads instead of the safe H.264 rendition
  uptimePct?:       number | null;
  claimedAt:        string;
  pairedAt?:        string | null;
  lat?:             number | null;
  lng?:             number | null;
  city?:            string | null;
  locality?:        string | null;
  slotMode?:        boolean;   // store sells fixed ad slots — schedules only play as fallback
  currentSchedule?: {
    id:           string;
    name:         string;
    playlistName: string | null;
    endsAt:       string;
  } | null;
};

export type ZoneDefinition = {
  id:           string;
  label:        string;
  x:            number;   // 0–100 (% of screen width)
  y:            number;   // 0–100 (% of screen height)
  w:            number;   // 0–100
  h:            number;   // 0–100
  playlistId?:  string | null;
  playlistName?: string | null;
};

export type Composition = {
  id:          string;
  name:        string;
  description?: string | null;
  zones:       ZoneDefinition[];
  isPreset:    boolean;
  createdAt:   string;
  updatedAt:   string;
};

export type DeviceGroup = {
  name:    string;
  total:   number;
  online:  number;
  offline: number;
  pending: number;
};

export type StoreSearchResult = {
  id:             string;
  storeName:      string;
  city:           string | null;
  locality:       string | null;
  screenCount:    number;
  loopSlotCount?: number | null;   // non-null = slot mode; its screens ignore schedules
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
  // Intrinsic pixel size — images measured in-browser at upload; videos filled by the
  // transcode callback. Absent for legacy uploads.
  width?:      number;
  height?:     number;
  createdAt:   string;
  tags:        string[];
  folder?:     string;
  transcodeStatus?: 'pending' | 'done' | 'error' | null;
  transcodeError?:  string | null;
};

export type PlaylistItem = {
  id:         string;
  // Exactly one of contentId / childPlaylistId is set: media item vs nested playlist
  // (SMIL Master → Internal, plays fully per visit; max depth 3, cycles rejected).
  contentId:       string | null;
  childPlaylistId?: string | null;
  durationMs: number;
  order:      number;
  content:        Content | null;
  childPlaylist?: { id: string; name: string } | null;
};

export type Playlist = {
  id:         string;
  name:       string;
  transition: 'NONE' | 'FADE' | 'SLIDE';
  items:      PlaylistItem[];
  createdAt:  string;
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
  if (res.status === 401 && typeof window !== 'undefined') {
    // The admin session is gone (expired cookie, or a sign-in that never got
    // one). Showing a raw {"error":"Unauthorized"} in the middle of a panel
    // leaves no way forward, so drop the stale flag and go back to the gate —
    // same behaviour as lib/admin-fetch.ts.
    sessionStorage.removeItem('alive_admin');
    sessionStorage.removeItem('alive_admin_pw');
    window.location.reload();
  }
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

export const updateDevice = (id: string, body: { storeName?: string; groupName?: string; storeId?: string | null; orientation?: string; playsOriginal?: boolean }) =>
  apiFetch<{ device: Device }>(`/api/devices/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
  .then((r) => r.device);

export const confirmPairing = (code: string) =>
  apiFetch<{ device: { id: string; name: string; hardwareKey: string } }>('/api/admin/confirm-pairing', {
    method: 'POST', body: JSON.stringify({ code }),
  }).then((r) => r.device);

export const bulkUpdateDevices = (body: { ids: string[]; action: 'group' | 'delete'; groupName?: string }) =>
  apiFetch<{ updated?: number; deleted?: number }>('/api/devices/bulk', { method: 'POST', body: JSON.stringify(body) });

export const bulkPushSchedule = (body: { deviceIds: string[]; playlistId: string; durationMins: number; name?: string }) =>
  apiFetch<{ schedule: { id: string; name: string; endsAt: string } }>('/api/devices/bulk-schedule', { method: 'POST', body: JSON.stringify(body) });

export const getDeviceGroups = () =>
  apiFetch<{ groups: DeviceGroup[] }>('/api/devices/groups').then((r) => r.groups);

// ─── Player config (fleet-wide behavior knobs, no APK rebuild required) ──────

export type PlayerConfig = {
  retryIntervalMs:          number;
  transitionDurationMs:     number;
  kioskKeyLockEnabled:      boolean;
  downloadConnectTimeoutMs: number;
  downloadReadTimeoutMs:    number;
  fallbackPlaylistId:       string | null;
  testPlaylistId:           string | null;
  updatedAt:                string;
};

// ─── Screen liveness test ────────────────────────────────────────────────────
// Device.status can read ONLINE while the screen is frozen or black, because a stuck
// player keeps heartbeating. These push known content and wait for proof-of-play,
// which is the only evidence the screen is genuinely rendering.

export type TestPlayStart  = { scheduleId: string; playlistId: string; startedAt: string; expiresAt: string };
export type TestPlayStatus = {
  confirmed:       boolean;
  playedAt:        string | null;
  durationMs:      number | null;
  lastSeen:        string | null;
  playbackAliveAt: string | null;
  lastStallReason: string | null;
  lastStallAt:     string | null;
};

export const startScreenTest = (deviceId: string) =>
  apiFetch<TestPlayStart>(`/api/devices/${deviceId}/test-play`, { method: 'POST' });

export const checkScreenTest = (deviceId: string, since: string) =>
  apiFetch<TestPlayStatus>(`/api/devices/${deviceId}/test-play?since=${encodeURIComponent(since)}`);

export const getPlayerConfig = () =>
  apiFetch<{ config: PlayerConfig }>('/api/admin/player-config').then((r) => r.config);

export const updatePlayerConfig = (body: Partial<Omit<PlayerConfig, 'updatedAt'>>) =>
  apiFetch<{ config: PlayerConfig }>('/api/admin/player-config', { method: 'PATCH', body: JSON.stringify(body) })
    .then((r) => r.config);

export const searchStores = (params?: { q?: string; city?: string }) => {
  const qs = params && Object.keys(params).filter(k => params[k as keyof typeof params]).length
    ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return apiFetch<{ stores: StoreSearchResult[]; cities: string[] }>(`/api/stores/search${qs}`);
};

// ─── Play Events (POP) ────────────────────────────────────────────────────────

// GET /api/events paginates (default page size 500, capped 2000) — follow nextCursor
// until exhausted so callers always get the full matching set, not just the first page.
export const getEvents = async (params?: Record<string, string>): Promise<PlayEvent[]> => {
  const all: PlayEvent[] = [];
  let cursor: string | undefined;
  for (;;) {
    const qs = new URLSearchParams({ ...params, limit: '2000', ...(cursor ? { cursor } : {}) }).toString();
    const { events, nextCursor } = await apiFetch<{ events: PlayEvent[]; nextCursor: string | null }>(`/api/events?${qs}`);
    all.push(...events);
    if (!nextCursor) break;
    cursor = nextCursor;
  }
  return all;
};

// /api/events/export/csv only checks the admin-password HEADER (see route.ts), so a
// plain <a href> download can never authenticate — the browser never attaches custom
// headers to a bare navigation. Fetch with the header instead and trigger the download
// from the resulting blob.
export async function downloadEventsCsv(params?: Record<string, string>, filename = 'alive-pop-report.csv'): Promise<void> {
  const qs  = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`/api/events/export/csv${qs}`, { headers: adminHeaders(), credentials: 'same-origin' });
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Proof-of-Play reports (By Screen / By Ad / By Groups) ─────────────────────

export type PlayRow = {
  id:          string;
  deviceId:    string;
  screenName:  string;
  groupName:   string | null;
  mediaId:     string;
  contentName: string | null;
  contentType: 'image' | 'video' | null;
  startedAt:   string;
  endedAt:     string;
  durationMs:  number;
};

export type PlaysSummary = {
  totalPlays:   number;
  totalMs:      number;
  screens:      number;
  contentCount: number;
  byScreen:  { deviceId: string; screenName: string; groupName: string | null; plays: number; totalMs: number; lastPlayedAt: string }[];
  byContent: { mediaId: string; contentName: string; contentType: string | null; plays: number; totalMs: number; screens: number; lastPlayedAt: string }[];
  byGroup:   { groupName: string; plays: number; totalMs: number; screens: number }[];
};

export type PlaysResponse = {
  matchedCount:  number;
  rowsTruncated: boolean;
  rows:          PlayRow[];
  nextCursor:    string | null;
  summary:       PlaysSummary;
};

// Filters: from, to (ISO, UTC), deviceId, mediaId, groupNames (comma-separated), limit, cursor.
export const getPlays = (params?: Record<string, string>) => {
  const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch<PlaysResponse>(`/api/reports/plays${qs}`);
};

// CSV export of the full matching set (auth is header-only, so fetch → blob, same as downloadEventsCsv).
export async function downloadPlaysCsv(params?: Record<string, string>, filename = 'alive-proof-of-play.csv'): Promise<void> {
  const qs  = '?' + new URLSearchParams({ ...(params ?? {}), format: 'csv' }).toString();
  const res = await fetch(`/api/reports/plays${qs}`, { headers: adminHeaders(), credentials: 'same-origin' });
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
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
  width?: number; height?: number;
}) =>
  apiFetch<{ id: string; uploadUrl: string; objectKey: string }>('/api/content', {
    method: 'POST',
    body:   JSON.stringify(body),
  });

// Fire-and-forget: queues a background re-encode to H.264 Main@4.1 so the clip
// hardware-decodes reliably on budget Android TV SoCs. See transcode-lambda/.
export const transcodeVideo = (contentId: string) =>
  apiFetch<{ ok: boolean }>('/api/admin/transcode', {
    method: 'POST',
    body:   JSON.stringify({ contentId }),
  });

// ─── Playlists ────────────────────────────────────────────────────────────────

export const getPlaylists = () =>
  apiFetch<{ playlists: Playlist[] }>('/api/playlists').then((r) => r.playlists);

// An item targets either content (media) or another playlist (nested — see PlaylistItem).
export type PlaylistItemWrite = { contentId?: string; childPlaylistId?: string; durationMs: number };

export const createPlaylist = (body: { name: string; items?: PlaylistItemWrite[]; transition?: Playlist['transition'] }) =>
  apiFetch<{ playlist: Playlist }>('/api/playlists', { method: 'POST', body: JSON.stringify(body) })
    .then((r) => r.playlist);

export const updatePlaylist = (id: string, body: { name?: string; items?: PlaylistItemWrite[]; transition?: Playlist['transition'] }) =>
  apiFetch<{ playlist: Playlist }>(`/api/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    .then((r) => r.playlist);

export const deletePlaylist = (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/playlists/${id}`, { method: 'DELETE' });

// ─── Schedules ────────────────────────────────────────────────────────────────

export const getSchedules = () =>
  apiFetch<{ schedules: Schedule[] }>('/api/schedules').then((r) => r.schedules);

export const createSchedule = (
  body: Omit<Schedule, 'id' | 'createdAt' | 'playlist' | 'priority'> &
    { priority?: number; replaceScheduleIds?: string[] },
) =>
  apiFetch<{ schedule: Schedule }>('/api/schedules', { method: 'POST', body: JSON.stringify(body) })
    .then((r) => r.schedule);

// An existing schedule whose window + screens overlap one being created — shown
// in the Schedules tab's "replace the old playlist?" confirmation. Confirmed ids
// go back to createSchedule as replaceScheduleIds (deleted atomically with the create).
export type ScheduleConflict = {
  id:                 string;
  name:               string;
  playlistName:       string;
  startAt:            string;
  endAt:              string;
  overlapCount:       number;
  overlapDeviceNames: string[]; // first 5
  extraCount:         number;   // screens only the old schedule serves — they lose content if replaced
};

export const getScheduleConflicts = (body: {
  deviceIds?: string[]; groupName?: string | null; storeIds?: string[]; cityFilter?: string | null;
  startAt: string; endAt: string; excludeId?: string;
}) =>
  apiFetch<{ conflicts: ScheduleConflict[] }>('/api/schedules/conflicts', { method: 'POST', body: JSON.stringify(body) })
    .then((r) => r.conflicts);

export const updateSchedule = (id: string, body: Partial<Omit<Schedule, 'id' | 'createdAt' | 'playlist'>>) =>
  apiFetch<{ schedule: Schedule }>(`/api/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    .then((r) => r.schedule);

export const deleteSchedule = (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/schedules/${id}`, { method: 'DELETE' });

// ─── Store photo (storefront shot used to identify a store in the admin) ──────

/** Uploads the bytes to R2 through the admin proxy, then records the URL on the store. */
export async function uploadStorePhoto(storeId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const form = new FormData();
  form.append('file', file);
  form.append('key', `stores/${storeId}/storefront-${Date.now()}.${ext}`);

  // Not apiFetch: FormData must set its own multipart Content-Type boundary.
  const res = await fetch('/api/admin/r2-upload', { method: 'POST', headers: adminHeaders(), body: form });
  if (!res.ok) throw new Error((await res.text().catch(() => '')) || `HTTP ${res.status}`);
  const { publicUrl } = await res.json() as { publicUrl: string };

  await setStorePhoto(storeId, publicUrl);
  return publicUrl;
}

export const setStorePhoto = (storeId: string, photoUrl: string | null) =>
  apiFetch<{ photoUrl: string | null }>('/api/admin/store-photo', {
    method: 'PATCH', body: JSON.stringify({ storeId, photoUrl }),
  });

// ─── Force sync ───────────────────────────────────────────────────────────────

export const forceSyncDevice = (id: string) =>
  apiFetch<{ ok: boolean; forceSyncAt: string | null }>(`/api/devices/${id}/force-sync`, { method: 'POST' });

// ─── Remote commands (reboot / health ping) ────────────────────────────────────

export const sendDeviceCommand = (id: string, type: 'reboot' | 'health_ping') =>
  apiFetch<{ ok: boolean }>(`/api/devices/${id}/command`, { method: 'POST', body: JSON.stringify({ type }) });

// ─── Slot-loop inventory ──────────────────────────────────────────────────────
// Fixed loop of N 10s ad slots per store, sold by loop position + date. Availability
// is always sold-count based — filler/bonus fill is never "sold out". See lib/slots.ts.

export type SlotStore = {
  id: string; storeName: string; city: string | null;
  loopSlotCount: number | null; openDays: number;
  hoursStart: string; hoursEnd: string;
  fillerCampaignId: string | null;
  slotPricingTier: string; // 'standard' | 'growth' | 'flagship' — see lib/slot-pricing.ts
  sold: Record<string, number | null> | null; // date → sold count; null = closed that day
};

export type SlotAvailability = {
  dates: string[];
  defaultFillerCampaignId: string | null;
  stores: SlotStore[];
};

export type SlotBookingRow = {
  id: string; slotPosition: number;
  campaignId: string; campaignName: string; hasCreative: boolean;
  creativeCount: number;   // >1 = slot playlist rotating this many creatives
  // Multi-slot placement (an ad longer than 10s): every row of one placement
  // shares spanId; spanSlots is the window size and isSpanHead marks its lowest
  // position. Plain 10s bookings: spanId null, spanSlots 1, isSpanHead true.
  spanId: string | null;
  spanSlots: number;
  isSpanHead: boolean;
};

export type SlotLoopEntry = {
  slotPosition: number; campaignId: string; contentId: string; isFiller: boolean;
  spanSlots: number;    // >1 = one play covering this many consecutive positions
};

export const getSlotAvailability = (from: string, to: string) =>
  apiFetch<SlotAvailability>(`/api/slots/availability?from=${from}&to=${to}`);

export const getSlotBookings = (storeId: string, date: string) =>
  apiFetch<{ loopSlotCount: number; bookings: SlotBookingRow[]; playableLoop: SlotLoopEntry[] }>(
    `/api/slots/bookings?storeId=${storeId}&date=${date}`);

export const assignSlot = (body: { storeId: string; date: string; slotPosition: number; campaignId: string }) =>
  apiFetch<{ booking: { id: string } }>('/api/slots/bookings', { method: 'POST', body: JSON.stringify(body) });

export const unassignSlot = (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/slots/bookings?id=${id}`, { method: 'DELETE' });

// Shrinking a loop auto-packs stranded bookings into free lower positions; `reassigned`
// reports what moved (1-based slot numbers) so the admin isn't left guessing.
export type SlotSettingsResult = {
  store?: { id: string; loopSlotCount: number | null };
  reassigned?: { date: string; from: number; to: number; campaignName: string }[];
  warning?: string;   // slot mode saved without a playable filler campaign
};

export const updateSlotSettings = (body: {
  storeId?: string; loopSlotCount?: number | null; openDays?: number;
  hoursStart?: string; hoursEnd?: string; fillerCampaignId?: string | null;
  slotPricingTier?: string;
  defaultFillerCampaignId?: string | null;
  campaignId?: string; slotContentId?: string | null; slotPlaylistId?: string | null;
}) => apiFetch<SlotSettingsResult>('/api/slots/settings', { method: 'PATCH', body: JSON.stringify(body) });

// ─── Bulk slot booking ────────────────────────────────────────────────────────
// One request instead of hundreds of per-position clicks. Policy: book what fits,
// report the gaps; existing bookings by the same campaign count toward the target,
// so re-running is idempotent and nothing is ever overwritten.

// All counters are PLAYS: one play of a 30s ad = one unit but 3 slot rows.
// For 10s ads (span 1, the common case) plays and slots are the same number.
export type BulkAssignResult = {
  booked: number;            // plays actually created
  planned: number;           // plays the planner wanted to create
  requested: number;         // plays the admin asked for across all open store-days
  alreadySatisfied: number;  // covered by pre-existing bookings of the same campaign
  raced: number;             // planned plays lost to a concurrent booking (rare)
  missed: number;            // requested minus satisfied — the gap total
  slotSpan?: number;         // assign mode: consecutive slots one play occupies
  rowsBooked?: number;       // underlying slot rows created (booked × span, minus races)
  gaps: { storeId: string; storeName: string; date: string; missed: number; reason: 'full' | 'partial' }[];
  gapsTruncated: boolean;    // true = gaps capped at 500 rows; `missed` stays exact
  skippedStores: { storeId: string; storeName: string; reason: 'not-found' | 'not-slot-mode' }[];
  closedSkipped: number;     // store-days skipped because the store is closed
};

export const bulkAssignSlots = (body: {
  campaignId: string; storeIds: string[]; from: string; to: string;
  daysOfWeek?: number; slotsPerDay: number;
}) => apiFetch<BulkAssignResult>('/api/slots/bookings/bulk', { method: 'POST', body: JSON.stringify(body) });

export const copySlotDay = (body: {
  sourceStoreId: string; sourceDate: string; storeIds?: string[];
  from: string; to: string; daysOfWeek?: number;
}) => apiFetch<BulkAssignResult>('/api/slots/bookings/bulk', {
  method: 'POST', body: JSON.stringify({ mode: 'copy-day', ...body }),
});

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

// ─── Compositions ─────────────────────────────────────────────────────────────

export const getCompositions = () =>
  apiFetch<{ compositions: Composition[] }>('/api/compositions').then((r) => r.compositions);

export const createComposition = (body: { name: string; description?: string; zones: ZoneDefinition[]; isPreset?: boolean }) =>
  apiFetch<{ composition: Composition }>('/api/compositions', { method: 'POST', body: JSON.stringify(body) })
    .then((r) => r.composition);

export const updateComposition = (id: string, body: { name?: string; description?: string; zones?: ZoneDefinition[] }) =>
  apiFetch<{ composition: Composition }>(`/api/compositions/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    .then((r) => r.composition);

export const deleteComposition = (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/compositions/${id}`, { method: 'DELETE' });

// ─── Footfall & Screen Presence ────────────────────────────────────────────────

export type FootfallHourlyPoint = {
  hourBucket:       string;
  customerCount:    number;
  unconfirmedCount: number;
  avgConfidence:    number | null;
  excludedCount:    number;
};

export type FootfallPresenceByCampaign = {
  campaignId:   string;
  campaignName: string;
  total:        number;
  confirmed:    number;
  presenceRate: number | null;
};

export type FootfallResponse = {
  storeId: string;
  from:    string;
  to:      string;
  totals:  { customerCount: number; unconfirmedCount: number; excludedCount: number };
  hourly:  FootfallHourlyPoint[];
  presenceByCampaign: FootfallPresenceByCampaign[];
};

export type FootfallAuditResponse = {
  storeId: string;
  from:    string;
  to:      string;
  breakdown: { reason: string; count: number }[];
  events: {
    id: string;
    timestamp: string;
    exclusionReason: string | null;
    zoneId: string | null;
    confidenceScore: number | null;
    detectionMethod: string | null;
  }[];
};

export type SensorHealthResponse = {
  storeId: string;
  calibrationStatus: string;
  firmwareVersion: string | null;
  ruview:     { lastSeen: string | null; uptime: number | null; status: 'online' | 'offline' | 'unknown' };
  espresense: { lastSeen: string | null; uptime: number | null; status: 'online' | 'offline' | 'unknown' };
};

export const getFootfall = (storeId: string, params?: { from?: string; to?: string }) => {
  const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return apiFetch<FootfallResponse>(`/api/footfall/${storeId}${qs}`);
};

export const getFootfallAudit = (storeId: string, params?: { from?: string; to?: string }) => {
  const qs = params && Object.keys(params).length ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return apiFetch<FootfallAuditResponse>(`/api/footfall/${storeId}/audit${qs}`);
};

export const getSensorHealth = (storeId: string) =>
  apiFetch<SensorHealthResponse>(`/api/health/${storeId}`);

export function getFootfallExportUrl(storeId: string, params?: { from?: string; to?: string }): string {
  const p  = { ...(params ?? {}) } as Record<string, string>;
  const pw = typeof window !== 'undefined' ? (sessionStorage.getItem('alive_admin_pw') ?? '') : '';
  if (pw) p['admin-password'] = pw;
  const qs = Object.keys(p).length ? '?' + new URLSearchParams(p).toString() : '';
  return `/api/footfall/${storeId}/export/csv${qs}`;
}
