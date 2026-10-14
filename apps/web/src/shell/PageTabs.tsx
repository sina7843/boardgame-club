import { useLocation } from 'react-router';
import { PageTabs as BgvPageTabs } from '@bg/ui/bgv';

/** Sibling pages that share one nav entry (e.g. پیشرفت / رتبه‌بندی): route links as the DS PageTabs. */
export const PAGE_GROUPS = {
  games: [['/games', 'بازی‌ها'], ['/wiki', 'دانشنامه']],
  tables: [['/tables', 'میزهای باز'], ['/tables/mine', 'میزهای من'], ['/play', 'حریف‌یابی سریع'], ['/tournaments', 'تورنمنت‌ها']],
  progress: [['/progress', 'پیشرفت'], ['/ranking', 'رتبه‌بندی']],
  social: [['/messages', 'پیام‌ها'], ['/friends', 'دوستان'], ['/groups', 'گروه‌ها'], ['/clubs', 'باشگاه‌ها']],
  wallet: [['/plans', 'اشتراک'], ['/coins', 'سکه‌ها'], ['/shop', 'فروشگاه'], ['/me/wardrobe', 'کمد']]
} as const satisfies Record<string, readonly (readonly [string, string])[]>;

export function PageTabs({ group }: { group: keyof typeof PAGE_GROUPS }) {
  const { pathname } = useLocation();
  return <BgvPageTabs label="بخش‌های مرتبط" value={pathname} items={PAGE_GROUPS[group].map(([to, label]) => ({ value: to, label, href: to }))} />;
}
