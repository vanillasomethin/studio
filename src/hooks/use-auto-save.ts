'use client';
import { useEffect, useRef, useCallback, useState } from 'react';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'offline';

type Options<T> = {
  key: string;              // localStorage key for draft
  debounceMs?: number;      // default 1200
  saveFn?: (value: T) => Promise<void>;   // if provided, also saves to server
  onError?: (err: Error) => void;
};

export function useAutoSave<T>(value: T, opts: Options<T>) {
  const { key, debounceMs = 1200, saveFn, onError } = opts;
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Restore draft from localStorage on mount
  const restore = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : null;
    } catch { return null; }
  }, [key]);

  // Always persist draft locally
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);

  // Debounced server save
  useEffect(() => {
    if (!saveFn) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('pending');

    timerRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await saveFn(valueRef.current);
        setStatus('saved');
        setLastSaved(new Date());
        // Auto-clear "saved" after 4s
        setTimeout(() => setStatus(s => s === 'saved' ? 'idle' : s), 4000);
      } catch (e) {
        const isNetwork = (e as Error)?.message?.toLowerCase().includes('network') ||
                          !(navigator.onLine);
        setStatus(isNetwork ? 'offline' : 'error');
        onError?.(e as Error);
      }
    }, debounceMs);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, saveFn, debounceMs]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(key); } catch {}
  }, [key]);

  const lastSavedText = lastSaved ? relativeTime(lastSaved) : null;

  return { status, lastSaved, lastSavedText, restore, clearDraft };
}

function relativeTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
