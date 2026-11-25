// Full public rules of one game (Phase F): one lazy chunk per game, generated at build time by scripts/rules.ts.
import { useEffect, useState } from 'react';

const files = import.meta.glob<string>('../generated/rules/*.md', { query: '?raw', import: 'default' });
const loaderFor = (slug: string) => files[`../generated/rules/${slug}.md`];

export const hasRules = (slug: string) => !!loaderFor(slug);

export type RulesState = { status: 'loading' } | { status: 'missing' } | { status: 'error'; retry: () => void } | { status: 'ready'; text: string };

export function useGameRules(slug: string, enabled = true): RulesState {
  const [state, setState] = useState<RulesState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const load = loaderFor(slug);
    if (!load) { setState({ status: 'missing' }); return; }
    let live = true;
    setState({ status: 'loading' });
    load().then((text) => { if (live) setState({ status: 'ready', text }); },
      () => { if (live) setState({ status: 'error', retry: () => setAttempt((n) => n + 1) }); });
    return () => { live = false; };
  }, [slug, enabled, attempt]);
  return state;
}
