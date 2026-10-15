import { useEffect } from 'react';

export const PAGE_TITLE_EVENT = 'bg:title';

/** Sets document title and moves focus to <main> on route change, so screen readers announce the new page.
 *  `docTitle` replaces the whole tab/search title where it should carry a search phrase; `title` still labels the top bar. */
export function usePageTitle(title: string, docTitle?: string): void {
  useEffect(() => {
    document.title = docTitle ?? `${title} | بردگیم‌ورس`;
    // Canonical follows client-side navigation (prerendered pages ship it; the generic shell does not).
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
    canonical.href = location.origin + location.pathname;
    // The phone top bar of the app shell shows the page title.
    window.dispatchEvent(new CustomEvent(PAGE_TITLE_EVENT, { detail: title }));
    const main = document.getElementById('main');
    if (main && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
  }, [title, docTitle]);
}
