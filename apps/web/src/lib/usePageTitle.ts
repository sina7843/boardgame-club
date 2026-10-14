import { useEffect } from 'react';

export const PAGE_TITLE_EVENT = 'bg:title';

/** Sets document title and moves focus to <main> on route change, so screen readers announce the new page. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} | بردگیم‌ورس`;
    // The phone top bar of the app shell shows the page title.
    window.dispatchEvent(new CustomEvent(PAGE_TITLE_EVENT, { detail: title }));
    const main = document.getElementById('main');
    if (main && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
  }, [title]);
}
