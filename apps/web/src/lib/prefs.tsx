import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_ALERT_PREFS, type AlertPrefs } from '@bg/contracts';
import { api } from './api.ts';

/** Per-device display preferences (localStorage). Game sounds read `muted` once they exist (DRAGON-01). */
export interface Prefs {
  theme: 'dark' | 'light' | 'system';
  motion: 'system' | 'reduce' | 'full';
  muted: boolean;
  /** Undo window for a move before it is sent (ms as text); 'off' sends at once. */
  undo: 'off' | '500' | '1000' | '2000';
}

const KEY = 'bg.prefs';
const DEFAULTS: Prefs = { theme: 'system', motion: 'system', muted: false, undo: '500' };
const THEME_COLOR = { light: '#173A2D', dark: '#191B1A' }; // ds-check-ignore: <meta theme-color> needs literal hex (design/brand/LOGO-USAGE.md)
const DARK = '(prefers-color-scheme: dark)';

export function readPrefs(raw: string | null): Prefs {
  try {
    const p = JSON.parse(raw ?? '{}') as Partial<Prefs>;
    return {
      theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : 'system',
      motion: p.motion === 'reduce' || p.motion === 'full' ? p.motion : 'system',
      muted: p.muted === true,
      undo: p.undo === 'off' || p.undo === '1000' || p.undo === '2000' ? p.undo : '500'
    };
  } catch {
    return DEFAULTS;
  }
}

function apply(p: Prefs): void {
  const root = document.documentElement;
  // BGV tokens switch only on data-theme, so "system" resolves the device scheme (kept live by PrefsProvider).
  root.dataset.theme = p.theme === 'system' ? (matchMedia(DARK).matches ? 'dark' : 'light') : p.theme;
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
  useEffect(() => {
    if (prefs.theme !== 'system') return;
    const mq = matchMedia(DARK);
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

// ---------- Turn-alert preferences: stored on the account (sound, volume, vibration, quiet hours); theme/motion stay per device ----------
let alertPrefs: AlertPrefs = DEFAULT_ALERT_PREFS;
let alertLoaded: Promise<void> | null = null;
const alertListeners = new Set<() => void>();
const setAlertPrefs = (p: AlertPrefs) => { alertPrefs = p; alertListeners.forEach((f) => f()); };
/** Current account alert prefs (defaults until loaded or when signed out). */
export const getAlertPrefs = () => alertPrefs;
export function loadAlertPrefs(): Promise<void> {
  alertLoaded ??= api<AlertPrefs>('/me/alert-prefs').then(setAlertPrefs, () => { alertLoaded = null; });
  return alertLoaded;
}
export async function saveAlertPrefs(next: AlertPrefs): Promise<void> {
  setAlertPrefs(await api<AlertPrefs>('/me/alert-prefs', { method: 'PUT', body: next }));
}
export function useAlertPrefs(): AlertPrefs {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    alertListeners.add(f);
    void loadAlertPrefs();
    return () => { alertListeners.delete(f); };
  }, []);
  return alertPrefs;
}
