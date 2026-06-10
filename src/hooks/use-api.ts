'use client';
import { useState, useCallback, useRef } from 'react';
import { apiFetch, ApiError, FetchOptions } from '@/lib/api-client';

export type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  retryCount: number;
  retryIn: number | null;   // countdown seconds before next retry
};

export function useApi<T = unknown>() {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: false, error: null, retryCount: 0, retryIn: null });
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  };

  const startCountdown = (delayMs: number) => {
    clearCountdown();
    let remaining = Math.ceil(delayMs / 1000);
    setState(s => ({ ...s, retryIn: remaining }));
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) { clearCountdown(); setState(s => ({ ...s, retryIn: null })); }
      else setState(s => ({ ...s, retryIn: remaining }));
    }, 1000);
  };

  const execute = useCallback(async (url: string, opts: FetchOptions = {}) => {
    clearCountdown();
    setState(s => ({ ...s, loading: true, error: null, retryIn: null }));

    try {
      const data = await apiFetch<T>(url, {
        ...opts,
        onRetry: (attempt, delayMs, err) => {
          setState(s => ({ ...s, retryCount: attempt, error: err }));
          startCountdown(delayMs);
        },
      });
      setState({ data, loading: false, error: null, retryCount: 0, retryIn: null });
      return data;
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e as ApiError }));
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    clearCountdown();
    setState({ data: null, loading: false, error: null, retryCount: 0, retryIn: null });
  }, []);

  return { ...state, execute, reset };
}
