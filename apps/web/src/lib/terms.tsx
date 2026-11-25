import type { ReactNode } from 'react';
import { usePrefs, type Prefs } from './prefs.tsx';

/** A game term in both display languages. `bg` = Latin board-game term shown in «فارسی بردگیمی». */
export interface Term { fa: string; bg: string }

/** Plain-text form (logs, aria-labels). */
export const termText = (t: Term, lang: Prefs['terms']): string => (lang === 'fa-bg' ? t.bg : t.fa);

/** Rendered form: Latin runs are isolated in <bdi> so they never reorder inside Persian sentences. */
export function renderTerm(t: Term, lang: Prefs['terms']): ReactNode {
  return lang === 'fa-bg' && t.bg !== t.fa ? <bdi>{t.bg}</bdi> : t.fa;
}

/** `<T t={terms.check} />` */
export function T({ t }: { t: Term }) {
  return <>{renderTerm(t, usePrefs().prefs.terms)}</>;
}

/** For string contexts: `const tx = useTermText(); tx(terms.check)`. */
export function useTermText(): (t: Term) => string {
  const lang = usePrefs().prefs.terms;
  return (t) => termText(t, lang);
}
