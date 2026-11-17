import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import type { PublicProfile } from '@bg/contracts';
import { PageTabs as BgvPageTabs } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';

/** Sibling pages that share one nav entry (e.g. پیشرفت / رتبه‌بندی): route links as the DS PageTabs, as the references list them. */
export const PAGE_GROUPS = {
  games: [['/games', 'بازی‌ها'], ['/wiki', 'دانشنامه']],
  tables: [['/tables/mine', 'میزهای من'], ['/tables', 'میزهای باز'], ['/play', 'بازی سریع'], ['/tournaments', 'تورنمنت‌ها']],
  progress: [['/progress', 'پیشرفت'], ['/ranking', 'رتبه‌بندی و لیگ']],
  social: [['/messages', 'پیام‌ها'], ['/friends', 'دوستان'], ['/clubs', 'باشگاه‌ها']],
  wallet: [['/plans', 'اشتراک'], ['/coins', 'سکه‌ها']],
  // Shop-Desktop: the four commerce pages; on the phone the shop and wardrobe have only the top bar (Shop-Mobile).
  shop: [['/plans', 'اشتراک پریمیوم'], ['/coins', 'سکه'], ['/shop', 'فروشگاه کازمتیک'], ['/me/wardrobe', 'کمد من']]
} as const satisfies Record<string, readonly (readonly [string, string])[]>;

export function PageTabs({ group }: { group: keyof typeof PAGE_GROUPS }) {
  const { pathname } = useLocation();
  const counts = useSocialCounts(group === 'social');
  const narrow = useNarrow();
  return <BgvPageTabs label="بخش‌های مرتبط" value={pathname} className={group === 'shop' ? 'app-hide-phone' : undefined}
    items={PAGE_GROUPS[group].map(([to, label]) => ({ value: to, label: narrow ? SHORT[to] ?? label : label, href: to, ...(counts[to] ? { count: counts[to] } : {}) }))} />;
}

/** Shell-Phone: under 600px the four «میزها» tabs must all fit, so the long label is shortened. */
const SHORT: Record<string, string> = { '/tournaments': 'تورنمنت' };
function useNarrow() {
  const q = '(max-width: 599px)';
  const [m, setM] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => { const l = matchMedia(q); const f = () => setM(l.matches); l.addEventListener('change', f); return () => l.removeEventListener('change', f); }, []);
  return m;
}

/** Friends-Mobile / DM-Desktop: unread messages and the number of friends next to their tabs. */
function useSocialCounts(on: boolean): Record<string, number> {
  const { me } = useSession();
  const unread = useApi<{ count: number }>(on && me ? '/me/conversations/unread' : null);
  const friends = useApi<{ friends: PublicProfile[] }>(on && me ? '/me/friends' : null);
  return { '/messages': unread.data?.count ?? 0, '/friends': friends.data?.friends.length ?? 0 };
}
