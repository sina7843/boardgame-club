import { useSyncExternalStore, type ReactNode } from 'react';

/** A game term in both display languages. `bg` = Latin board-game term shown in «فارسی بردگیمی» (`fa-bg`). */
export interface Term { fa: string; bg: string }
export type TermsLang = 'fa' | 'fa-bg';

// Per-device setting. apps/web PrefsProvider owns the stored value and pushes it here; the first read falls back to the
// same `bg.prefs` record so a renderer mounted before the provider effect still starts in the right language.
let lang: TermsLang | null = null;
const listeners = new Set<() => void>();
function current(): TermsLang {
  if (lang) return lang;
  try { lang = (JSON.parse(localStorage.getItem('bg.prefs') ?? '{}') as { terms?: string }).terms === 'fa-bg' ? 'fa-bg' : 'fa'; } catch { lang = 'fa'; }
  return lang;
}
export function setTermsLang(next: TermsLang): void {
  if (current() === next) return;
  lang = next;
  listeners.forEach((f) => f());
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useTermsLang = (): TermsLang => useSyncExternalStore(subscribe, current, () => 'fa');

/** Plain text (aria-labels, logs, template strings). Prefer inside components via `useTermText`. */
export const termText = (t: Term, l: TermsLang): string => (l === 'fa-bg' ? t.bg : t.fa);
/** Latin runs are isolated in <bdi> so they never reorder inside Persian sentences. */
export const renderTerm = (t: Term, l: TermsLang): ReactNode => (l === 'fa-bg' && t.bg !== t.fa ? <bdi>{t.bg}</bdi> : t.fa);

/** `<T t={terms.check} />` */
export function T({ t }: { t: Term }) { return <>{renderTerm(t, useTermsLang())}</>; }
/** For string contexts: `const tx = useTermText(); tx(terms.check)`. */
export function useTermText(): (t: Term) => string { const l = useTermsLang(); return (t) => termText(t, l); }
/** Non-hook form for module-level helpers. The component that renders the result must call `useTermsLang()` once so it re-renders on change. */
export const getTermsLang = (): TermsLang => current();
export const tx = (t: Term): string => termText(t, current());
