import { useEffect } from 'react';
import { faNum } from './format.ts';

export const PAGE_TITLE_EVENT = 'bg:title';
/** Last title set: the page's effect runs before the shell's listener on first render, so the shell starts from this. */
export let lastPageTitle = 'بردگیم‌ورس';
let lastFocusPath: string | null = null;
let baseTitle = typeof document === 'undefined' ? '' : document.title;
let turnBadge = 0;
const applyTitle = () => { document.title = turnBadge ? `(${faNum(turnBadge)}) ${baseTitle}` : baseTitle; };

/** My-turn count (same source as the header badge): «(n)» before the tab title and the installed-app badge. */
export function setTurnBadge(n: number): void {
  turnBadge = n;
  applyTitle();
  try {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (n > 0) void nav.setAppBadge?.(n).catch(() => undefined);
    else void nav.clearAppBadge?.().catch(() => undefined);
  } catch { /* unsupported */ }
}

/** Sets document title and moves focus to <main> on route change, so screen readers announce the new page.
 *  `docTitle` replaces the whole tab/search title where it should carry a search phrase; `title` still labels the top bar. */
export function usePageTitle(title: string, docTitle?: string): void {
  useEffect(() => {
    baseTitle = docTitle ?? `${title} | بردگیم‌ورس`;
    applyTitle();
    // Canonical follows client-side navigation (prerendered pages ship it; the generic shell does not).
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
    canonical.href = location.origin + location.pathname;
    // The phone top bar of the app shell shows the page title.
    lastPageTitle = title;
    window.dispatchEvent(new CustomEvent(PAGE_TITLE_EVENT, { detail: title }));
    const main = document.getElementById('main');
    // Only a real route change may take focus from a control; a title that resolves later must not steal it (skip link, header).
    const moved = lastFocusPath !== null && lastFocusPath !== location.pathname;
    lastFocusPath = location.pathname;
    const idle = !document.activeElement || document.activeElement === document.body;
    if (main && !main.contains(document.activeElement) && (moved || idle)) main.focus({ preventScroll: true });
  }, [title, docTitle]);
}
