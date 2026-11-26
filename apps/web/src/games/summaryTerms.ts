import { useMemo } from 'react';
import { termText, useTermsLang, type Term, type TermsLang } from '@bg/ui';
import type { PublicSummaryView } from '@bg/contracts';

// The server's public summary carries Persian labels («پیپ», «بار», «کیش»). In «فارسی بردگیمی» the shell swaps every
// whole-word occurrence of one of the game's own terms (games/<slug>/src/terms.ts, longest first) for its Latin form.
const modules = import.meta.glob<Record<string, unknown>>('../../../../games/*/src/terms.ts', { eager: true });
const isTerm = (v: unknown): v is Term => typeof v === 'object' && v !== null && typeof (v as Term).fa === 'string' && typeof (v as Term).bg === 'string';
const byGame = new Map<string, { map: Map<string, Term>; re: RegExp }>();
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [path, m] of Object.entries(modules)) {
  const slug = /games\/([^/]+)\/src\/terms\.ts$/.exec(path)?.[1];
  const list = m.terms && typeof m.terms === 'object' ? Object.values(m.terms) : [];
  const own = list.filter(isTerm).filter((t) => t.bg !== t.fa && t.fa.trim());
  if (slug && own.length) {
    const words = [...new Set(own.map((t) => t.fa))].sort((a, b) => b.length - a.length);
    // Whole words only: no Persian letter or ZWNJ right before/after, so «پیپ» never matches inside another word.
    byGame.set(slug, { map: new Map(own.map((t) => [t.fa, t])), re: new RegExp(`(?<![\u0600-\u06FF\u200c])(?:${words.map(esc).join('|')})(?![\u0600-\u06FF\u200c])`, 'g') });
  }
}
// crew-deep-sea shares the-crew's table and terms.
const termsOf = (gameId: string) => byGame.get(gameId === 'crew-deep-sea' ? 'the-crew' : gameId);

export function localizeSummary(gameId: string, sum: PublicSummaryView, lang: TermsLang): PublicSummaryView {
  const terms = lang === 'fa-bg' ? termsOf(gameId) : undefined;
  if (!terms) return sum;
  const tr = (label: string) => label.replace(terms.re, (w) => { const t = terms.map.get(w); return t ? termText(t, lang) : w; });
  return {
    ...sum,
    seats: sum.seats.map((s) => ({
      ...s,
      ...(s.primary ? { primary: { ...s.primary, label: tr(s.primary.label) } } : {}),
      ...(s.stats ? { stats: s.stats.map((x) => ({ ...x, label: tr(x.label) })) } : {}),
      ...(s.badges ? { badges: s.badges.map((x) => ({ ...x, label: tr(x.label) })) } : {})
    })),
    ...(sum.shared ? { shared: sum.shared.map((x) => ({ ...x, label: tr(x.label) })) } : {})
  };
}

/** Summary for display in the current terms language (same object in «فارسی»). */
export function useLocalizedSummary<T extends PublicSummaryView | null | undefined>(gameId: string, sum: T): T {
  const lang = useTermsLang();
  return useMemo(() => (sum ? (localizeSummary(gameId, sum, lang) as T) : sum), [gameId, sum, lang]);
}
