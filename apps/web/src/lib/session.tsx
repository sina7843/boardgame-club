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

// Per-device hint only (not auth): lets the home page choose its first render before /me answers.
const HINT = 'bgv.signedIn';
export function wasSignedIn(): boolean {
  try { return localStorage.getItem(HINT) === '1'; } catch { return false; }
}
function rememberSignedIn(on: boolean) {
  try { if (on) localStorage.setItem(HINT, '1'); else localStorage.removeItem(HINT); } catch { /* storage blocked */ }
}

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
  useEffect(() => { if (status === 'ready') rememberSignedIn(me !== null); }, [me, status]);

  const value = useMemo(() => ({ me, status, refresh, logout, setMe }), [me, status, refresh, logout]);
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionCtx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
