import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Per-device display preferences (localStorage). Game sounds read `muted` once they exist (DRAGON-01). */
export interface Prefs {
  theme: 'dark' | 'light' | 'system';
  motion: 'system' | 'reduce' | 'full';
  muted: boolean;
}

const KEY = 'bg.prefs';
const DEFAULTS: Prefs = { theme: 'dark', motion: 'system', muted: false };

export function readPrefs(raw: string | null): Prefs {
  try {
    const p = JSON.parse(raw ?? '{}') as Partial<Prefs>;
    return {
      theme: p.theme === 'light' || p.theme === 'system' ? p.theme : 'dark',
      motion: p.motion === 'reduce' || p.motion === 'full' ? p.motion : 'system',
      muted: p.muted === true
    };
  } catch {
    return DEFAULTS;
  }
}

function apply(p: Prefs): void {
  const root = document.documentElement;
  const light = p.theme === 'light' || (p.theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
  root.dataset.theme = light ? 'light' : 'dark';
  if (p.motion === 'system') delete root.dataset.motion;
  else root.dataset.motion = p.motion;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f3f4f9' : '#101522');
}

const Ctx = createContext<{ prefs: Prefs; update: (p: Partial<Prefs>) => void } | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try { return readPrefs(localStorage.getItem(KEY)); } catch { return DEFAULTS; }
  });
  useEffect(() => {
    apply(prefs);
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage unavailable: keep in memory */ }
    if (prefs.theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: light)');
    const on = () => apply(prefs);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [prefs]);
  const value = useMemo(() => ({ prefs, update: (p: Partial<Prefs>) => setPrefs((x) => ({ ...x, ...p })) }), [prefs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs outside PrefsProvider');
  return v;
}
