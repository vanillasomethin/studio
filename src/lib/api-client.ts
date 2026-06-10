// Smart API client — retry logic, error categorisation, session handling.
// Use apiFetch() instead of raw fetch() throughout the app.

import { emitSessionExpired } from '@/lib/session-events';

export type ErrorCategory =
  | 'network'
  | 'timeout'
  | 'session_expired'
  | 'server'
  | 'not_found'
  | 'rate_limited'
  | 'maintenance'
  | 'validation'
  | 'conflict'
  | 'unknown';

// Human-readable messages — calm, never alarming
export const ERROR_COPY: Record<ErrorCategory, { title: string; body: string; action?: string }> = {
  network:         { title: "You're offline",            body: "We'll keep trying in the background. Your changes are saved locally.",                    action: "Working offline" },
  timeout:         { title: "Taking longer than usual",  body: "Retrying automatically — you don't need to do anything.",                                  action: "Retrying…" },
  session_expired: { title: "Your session ended",        body: "Sign back in to continue — everything you were working on is still here.",                 action: "Sign in again" },
  server:          { title: "Something went wrong",      body: "We've logged the issue and are looking into it. Trying again in a moment.",                action: "Retrying automatically…" },
  not_found:       { title: "Can't find this",           body: "This page or item may have been moved or deleted.",                                         action: "Go back" },
  rate_limited:    { title: "Slow down a bit",           body: "Too many requests at once. We'll retry automatically.",                                     action: "Retrying…" },
  maintenance:     { title: "Quick upgrade in progress", body: "We'll be back in just a few minutes. No data has been lost.",                               action: "Check back soon" },
  validation:      { title: "Check your details",        body: "Something doesn't look right. Review the highlighted fields and try again.",               action: "Review and retry" },
  conflict:        { title: "Updated elsewhere",         body: "This was changed on another device. Refresh to see the latest version.",                    action: "Refresh" },
  unknown:         { title: "Unexpected error",          body: "Something unusual happened. We've noted it — please try again.",                            action: "Try again" },
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly status?: number,
    public readonly retryAfter?: number,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get copy() { return ERROR_COPY[this.category]; }
  get isRetryable() { return RETRYABLE.has(this.category); }
}

const RETRYABLE = new Set<ErrorCategory>(['network', 'timeout', 'server', 'rate_limited', 'unknown']);

function categorise(status: number, headers: Headers): ErrorCategory {
  if (status === 401) return 'session_expired';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422 || status === 400) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status === 503 && headers.get('retry-after')) return 'maintenance';
  if (status >= 500) return 'server';
  return 'unknown';
}

function parseRetryAfter(headers: Headers): number | undefined {
  const val = headers.get('retry-after');
  if (!val) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function backoff(attempt: number, retryAfterSec?: number): number {
  if (retryAfterSec) return retryAfterSec * 1000;
  return Math.min(800 * (2 ** attempt) + Math.random() * 400, 30_000);
}

export type FetchOptions = RequestInit & {
  retries?: number;       // default 2
  timeout?: number;       // ms, default 15000
  onRetry?: (attempt: number, delayMs: number, error: ApiError) => void;
  skipRetry?: boolean;
};

export async function apiFetch<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { retries = 2, timeout = 15_000, onRetry, skipRetry, ...fetchOpts } = opts;
  const maxAttempts = skipRetry ? 1 : retries + 1;

  let lastError!: ApiError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort('timeout'), timeout);

    try {
      const res = await fetch(url, { ...fetchOpts, signal: controller.signal });
      clearTimeout(tid);

      if (!res.ok) {
        const category = categorise(res.status, res.headers);
        const retryAfter = parseRetryAfter(res.headers);
        const correlationId = res.headers.get('x-correlation-id') ?? undefined;
        lastError = new ApiError(`HTTP ${res.status}`, category, res.status, retryAfter, correlationId);

        if (category === 'session_expired') {
          emitSessionExpired();
          throw lastError;
        }
        if (!lastError.isRetryable || attempt >= maxAttempts - 1) throw lastError;
      } else {
        // Success — try to parse JSON, fall back to null
        const text = await res.text();
        return (text ? JSON.parse(text) : null) as T;
      }
    } catch (e) {
      clearTimeout(tid);
      if (e instanceof ApiError) {
        lastError = e;
        if (!lastError.isRetryable || attempt >= maxAttempts - 1) throw lastError;
      } else {
        const isTimeout = (e as Error)?.message?.includes('timeout') || (e as Error)?.name === 'AbortError';
        const category: ErrorCategory = isTimeout ? 'timeout' : 'network';
        lastError = new ApiError((e as Error).message, category);
        if (attempt >= maxAttempts - 1) throw lastError;
      }
    }

    const delay = backoff(attempt, lastError?.retryAfter);
    onRetry?.(attempt + 1, delay, lastError);
    await sleep(delay);
  }

  throw lastError;
}
