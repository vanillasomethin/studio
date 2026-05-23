import { API_BASE_URL } from '@shared/constants';
import type { StoreSession, RegisterPayload } from '@shared/store-types';

export type { StoreSession, RegisterPayload };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
    return body as T;
  } catch (e) {
    const err = e as Error;
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

export async function storeLogin(
  whatsapp: string,
  password: string,
): Promise<{ store?: StoreSession; error?: string }> {
  return request('/api/stores/login', {
    method: 'POST',
    body: JSON.stringify({ phone: `+91${whatsapp}`, password }),
  });
}

export async function storeRegister(
  payload: RegisterPayload,
): Promise<{ success?: boolean; referralCode?: string; error?: string }> {
  return request('/api/stores/save', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getStoreMe(storeId?: string): Promise<StoreSession> {
  const qs = storeId ? `?storeId=${storeId}` : '';
  return request(`/api/stores/me${qs}`);
}

export async function requestPasswordReset(phone: string): Promise<void> {
  await request('/api/stores/reset-password', {
    method: 'POST',
    body: JSON.stringify({ action: 'request', phone }),
  });
}

export async function verifyPasswordReset(
  phone: string,
  otp: string,
  newPassword: string,
): Promise<{ ok?: boolean; error?: string }> {
  return request('/api/stores/reset-password', {
    method: 'POST',
    body: JSON.stringify({ action: 'verify', phone, otp, newPassword }),
  });
}

export async function updateStoreMe(
  patch: Partial<StoreSession>,
  storeId?: string,
): Promise<void> {
  const qs = storeId ? `?storeId=${storeId}` : '';
  await request(`/api/stores/me${qs}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
