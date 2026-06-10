import { useState, useEffect, useCallback } from 'react';
import { loadSession, saveSession, clearSession } from '../lib/storage';
import type { StoreSession } from '../lib/api';

export function useStoreSession() {
  const [session, setSession] = useState<StoreSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (s: StoreSession) => {
    await saveSession(s);
    setSession(s);
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setSession(null);
  }, []);

  const updateSession = useCallback(async (patch: Partial<StoreSession>) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      saveSession(updated);
      return updated;
    });
  }, []);

  return { session, loading, login, logout, updateSession };
}
