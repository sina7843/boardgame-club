import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** Per-device display preferences (localStorage). Game sounds read `muted` once they exist (DRAGON-01). */
export interface Prefs {
  theme: 'dark' | 'light' | 'system';
  motion: 'system' | 'reduce' | 'full';
  muted: boolean;
}

const KEY = 'bg.prefs';
const DEFAULTS: Prefs = { theme: 'system', motion: 'system', muted: false };
const THEME_COLOR = { light: '#efeeea', dark: '#15120f' };

export function readPrefs(raw: string | null): Prefs {
  try {
    const p = JSON.parse(raw ?? '{}') as Partial<Prefs>;
    return {
      theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : 'system',
      motion: p.motion === 'reduce' || p.motion === 'full' ? p.motion : 'system',
      muted: p.muted === true
    };
  } catch {
    return DEFAULTS;
  }
}

function apply(p: Prefs): void {
  const root = document.documentElement;
  // "system": no data-theme, so tokens.css follows prefers-color-scheme live without JavaScript.
  if (p.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = p.theme;
  if (p.motion === 'system') delete root.dataset.motion;
  else root.dataset.motion = p.motion;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const scheme = m.getAttribute('media')?.includes('dark') ? 'dark' : 'light';
    m.setAttribute('content', THEME_COLOR[p.theme === 'system' ? scheme : p.theme]);
  });
}

const Ctx = createContext<{ prefs: Prefs; update: (p: Partial<Prefs>) => void } | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try { return readPrefs(localStorage.getItem(KEY)); } catch { return DEFAULTS; }
  });
  useEffect(() => {
    apply(prefs);
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage unavailable: keep in memory */ }
  }, [prefs]);
  const value = useMemo(() => ({ prefs, update: (p: Partial<Prefs>) => setPrefs((x) => ({ ...x, ...p })) }), [prefs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs outside PrefsProvider');
  return v;
}
