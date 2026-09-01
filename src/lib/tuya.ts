// Tuya Cloud OpenAPI client — the backend behind Aziot / Smart Life devices.
//
// Aziot smart plugs pair into the Smart Life app, which rides Tuya's cloud. A
// Tuya IoT Platform "cloud project" linked to that app account exposes every
// device over a signed REST API. This module holds the whole protocol: HMAC
// signing, token caching, and the four endpoints the plug feature needs
// (token, device list, device detail, specification).
//
// Setup (one-time, https://platform.tuya.com):
//   1. Cloud → Create Cloud Project, data center **India** (Smart Life accounts
//      registered in India live there).
//   2. Devices → Link App Account → scan the QR with the Smart Life app that
//      owns the Aziot plugs.
//   3. Copy the project's Access ID / Access Secret into TUYA_CLIENT_ID /
//      TUYA_CLIENT_SECRET. TUYA_API_BASE only if not the India data center.
//
// Fail-closed guard style per admin-auth.ts / cron-auth.ts: no configured
// credentials means every caller gets a clean "not configured" answer, never a
// half-signed request. Secrets are read lazily inside functions — never at
// module level (CLAUDE.md Redis rule).

import { createHash, createHmac, randomUUID } from 'crypto';

const DEFAULT_BASE = 'https://openapi.tuyain.com'; // India data center

export class TuyaError extends Error {
  code: number;
  constructor(code: number, msg: string) {
    super(`Tuya ${code}: ${msg}`);
    this.name = 'TuyaError';
    this.code = code;
  }
}

export function isTuyaConfigured(): boolean {
  return !!process.env.TUYA_CLIENT_ID && !!process.env.TUYA_CLIENT_SECRET;
}

function apiBase(): string {
  return (process.env.TUYA_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
}

// ─── Request signing (Tuya sign v2, HMAC-SHA256) ─────────────────────────────
//
// stringToSign = METHOD \n sha256(body) \n <signed-headers, none here> \n path
// where path INCLUDES the query string exactly as sent — callers must build
// query params in alphabetical order or the signature won't match.
// sign = HMAC-SHA256(clientId + [accessToken] + t + nonce + stringToSign,
//                    secret).hex.toUpperCase()

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function sign(parts: { method: string; pathWithQuery: string; body?: string; accessToken?: string; t: string; nonce: string }): string {
  const clientId = process.env.TUYA_CLIENT_ID ?? '';
  const secret = process.env.TUYA_CLIENT_SECRET ?? '';
  const stringToSign = [parts.method.toUpperCase(), sha256Hex(parts.body ?? ''), '', parts.pathWithQuery].join('\n');
  return createHmac('sha256', secret)
    .update(clientId + (parts.accessToken ?? '') + parts.t + parts.nonce + stringToSign)
    .digest('hex')
    .toUpperCase();
}

// ─── Token ───────────────────────────────────────────────────────────────────
//
// In-memory cache only: Tuya returns the SAME token for repeated grant_type=1
// calls until it nears expiry, so a cold serverless instance re-fetching is one
// cheap extra call, not a token churn. No DB row needed (unlike the removed
// eWeLink OAuth singleton — Tuya's client-credentials flow has no user consent
// to preserve).

type TokenEnvelope = { access_token: string; expire_time: number };
let tokenCache: { token: string; expiresAtMs: number } | null = null;

async function tuyaRequest<T>(pathWithQuery: string, accessToken?: string): Promise<T> {
  const t = String(Date.now());
  const nonce = randomUUID();
  const headers: Record<string, string> = {
    client_id: process.env.TUYA_CLIENT_ID ?? '',
    sign: sign({ method: 'GET', pathWithQuery, accessToken, t, nonce }),
    t,
    sign_method: 'HMAC-SHA256',
    nonce,
  };
  if (accessToken) headers.access_token = accessToken;

  const res = await fetch(`${apiBase()}${pathWithQuery}`, { headers, cache: 'no-store' });
  const body = await res.json().catch(() => null) as
    | { success: true; result: T }
    | { success: false; code?: number; msg?: string }
    | null;
  if (!body) throw new TuyaError(res.status, 'unparseable response');
  if (!body.success) throw new TuyaError(body.code ?? res.status, body.msg ?? 'request failed');
  return body.result;
}

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 60_000) return tokenCache.token;
  const result = await tuyaRequest<TokenEnvelope>('/v1.0/token?grant_type=1');
  tokenCache = { token: result.access_token, expiresAtMs: Date.now() + result.expire_time * 1000 };
  return result.access_token;
}

/** Signed business GET. Retries once on an expired/invalid token (1010/1011). */
export async function tuyaGet<T>(pathWithQuery: string): Promise<T> {
  if (!isTuyaConfigured()) throw new TuyaError(0, 'TUYA_CLIENT_ID / TUYA_CLIENT_SECRET not configured');
  try {
    return await tuyaRequest<T>(pathWithQuery, await getToken());
  } catch (e) {
    if (e instanceof TuyaError && (e.code === 1010 || e.code === 1011)) {
      tokenCache = null;
      return await tuyaRequest<T>(pathWithQuery, await getToken());
    }
    throw e;
  }
}

// ─── Devices ─────────────────────────────────────────────────────────────────

export type TuyaStatus = { code: string; value: unknown };

export type TuyaDevice = {
  id: string;
  name: string;
  online: boolean;
  category?: string; // "pc" = power strip, "cz" = socket, "kg" = switch
  product_name?: string;
  status?: TuyaStatus[];
};

/**
 * Every device on the linked Smart Life account, status snapshots included —
 * one call serves both the admin link-picker and the whole cron sweep.
 */
export async function listTuyaDevices(): Promise<TuyaDevice[]> {
  const devices: TuyaDevice[] = [];
  let lastRowKey = '';
  for (let page = 0; page < 10; page++) {
    const qs = lastRowKey
      ? `?last_row_key=${encodeURIComponent(lastRowKey)}&size=100`
      : '?size=100';
    const result = await tuyaGet<{ devices?: TuyaDevice[]; has_more?: boolean; last_row_key?: string }>(
      `/v1.0/iot-01/associated-users/devices${qs}`,
    );
    devices.push(...(result.devices ?? []));
    if (!result.has_more || !result.last_row_key) break;
    lastRowKey = result.last_row_key;
  }
  return devices;
}

/** One device's live detail — online flag plus full status array. */
export async function getTuyaDevice(deviceId: string): Promise<TuyaDevice> {
  return tuyaGet<TuyaDevice>(`/v1.0/devices/${encodeURIComponent(deviceId)}`);
}

/**
 * Raw-value → SI-unit multipliers from the device's specification, keyed by
 * status code (e.g. cur_power reports deci-watts → { cur_power: 0.1 }). Values
 * come as `10^-scale`, with mA/mV normalised to A/V. Returns {} when the spec
 * call fails or reveals nothing — parsePlugStatus falls back to the defaults
 * every Tuya metering plug ships with.
 */
export async function getTuyaScales(deviceId: string): Promise<Record<string, number>> {
  try {
    const spec = await tuyaGet<{ status?: { code: string; values?: string }[] }>(
      `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/specification`,
    );
    const scales: Record<string, number> = {};
    for (const entry of spec.status ?? []) {
      try {
        const v = JSON.parse(entry.values ?? '{}') as { scale?: number; unit?: string };
        if (typeof v.scale !== 'number') continue;
        const milli = v.unit === 'mA' || v.unit === 'mV' ? 0.001 : 1;
        scales[entry.code] = Math.pow(10, -v.scale) * milli;
      } catch { /* one unparseable code shouldn't lose the rest */ }
    }
    return scales;
  } catch {
    return {};
  }
}

// ─── Status parsing ──────────────────────────────────────────────────────────

// Defaults per Tuya's standard electricity-monitoring status set: cur_power is
// deci-watts, cur_voltage deci-volts, cur_current milliamps.
const DEFAULT_SCALES: Record<string, number> = {
  cur_power: 0.1,
  cur_voltage: 0.1,
  cur_current: 0.001,
};

export type ParsedPlugStatus = {
  switchOn: boolean;
  socketsOn: number;
  socketCount: number;
  powerW: number | null;
  voltageV: number | null;
  currentA: number | null;
};

/**
 * Distils a Tuya status array into the numbers the plug feature stores. The
 * Aziot 4-node exposes switch_1..switch_4 booleans plus one shared
 * cur_power/cur_voltage/cur_current set for the whole strip.
 */
export function parsePlugStatus(
  status: TuyaStatus[] | undefined,
  scales?: Record<string, number> | null,
): ParsedPlugStatus {
  const switches = (status ?? []).filter(
    (s) => typeof s.value === 'boolean' && /^switch(_\d+|_usb\d*)?$/.test(s.code),
  );
  const metric = (code: string): number | null => {
    const entry = (status ?? []).find((s) => s.code === code);
    if (!entry || typeof entry.value !== 'number' || !isFinite(entry.value)) return null;
    return entry.value * (scales?.[code] ?? DEFAULT_SCALES[code] ?? 1);
  };
  return {
    switchOn: switches.some((s) => s.value === true),
    socketsOn: switches.filter((s) => s.value === true).length,
    socketCount: switches.length,
    powerW: metric('cur_power'),
    voltageV: metric('cur_voltage'),
    currentA: metric('cur_current'),
  };
}
