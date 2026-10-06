import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Me } from '@bg/contracts';
import { api, ApiFailure } from './api.ts';

interface SessionValue {
  me: Me | null;
  status: 'loading' | 'ready' | 'error';
  refresh: () => Promise<Me | null>;
  logout: () => Promise<void>;
  setMe: (me: Me) => void;
}

const SessionCtx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<SessionValue['status']>('loading');

  const refresh = useCallback(async () => {
    try {
      const m = await api<Me>('/me');
      setMe(m);
      setStatus('ready');
      return m;
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 401) {
        setMe(null);
        setStatus('ready');
        return null;
      }
      setStatus('error');
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setMe(null);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo(() => ({ me, status, refresh, logout, setMe }), [me, status, refresh, logout]);
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionCtx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
