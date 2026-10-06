import { useEffect } from 'react';

/** Sets document title and moves focus to <main> on route change, so screen readers announce the new page. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} | باشگاه بردگیم`;
    const main = document.getElementById('main');
    if (main && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
  }, [title]);
}
