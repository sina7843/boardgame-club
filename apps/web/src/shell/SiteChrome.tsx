import { useMemo, useState } from 'react';
import type { GameSummary } from '@bg/contracts';
import { AccountMenu, SiteFooter, SiteSearch, type SiteSearchResult } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { SITE_LINKS } from '../pages/SitePage.tsx';

/** Persian/Arabic letter variants, ZWNJ and case folded away so «كاتان» and «کاتان» meet. */
const fold = (s: string) => s.toLowerCase().replaceAll('ي', 'ی').replaceAll('ك', 'ک').replace(/[‌\s]+/g, '');

/** Games whose name starts with, contains or (latin) contains the query, in that order; at most six. */
export function searchGames(games: GameSummary[], q: string): GameSummary[] {
  const f = fold(q);
  if (!f) return [];
  const score = (g: GameSummary) => {
    const fa = fold(g.nameFa), en = fold(g.nameOriginal);
    return fa.startsWith(f) ? 0 : fa.includes(f) ? 1 : en.startsWith(f) ? 2 : en.includes(f) ? 3 : -1;
  };
  return games.map((g) => ({ g, s: score(g) })).filter((x) => x.s >= 0).sort((a, b) => a.s - b.s).slice(0, 6).map((x) => x.g);
}

const asResult = (g: GameSummary): SiteSearchResult => ({
  title: g.nameFa, latin: g.nameOriginal, cover: `/covers/${g.id}.webp?v=2`, href: `/games/${g.id}`, quickHref: `/play?game=${g.id}`,
  meta: [{ icon: 'users', text: `${faNum(g.minPlayers)}–${faNum(g.maxPlayers)} نفر` }, { icon: 'clock', text: `${faNum(g.minMinutes)}–${faNum(g.maxMinutes)} دقیقه` }]
});

/** Header search (and the phone sheet): games are loaded on first use and filtered here. */
export function HeaderSearch({ sheet, onClose }: { sheet?: boolean; onClose?: () => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const games = useApi<{ items: GameSummary[] }>(open || sheet ? '/games' : null);
  const all = useMemo(() => (games.data?.items ?? []).filter((g) => !g.isTestGame), [games.data]);
  const results = useMemo(() => (q ? searchGames(all, q) : all.slice(0, 6)).map(asResult), [all, q]);
  const empty = q !== '' && results.length === 0;
  return (
    <SiteSearch value={q} onChange={setQ} open={sheet ? true : open} onOpenChange={setOpen} results={results} state={q ? (empty ? 'empty' : 'results') : 'idle'}
      allHref="/games" {...(sheet ? { sheet: true, ...(onClose ? { onClose } : {}) } : {})}
      emptyTitle={`بازی‌ای با «${q}» پیدا نشد`} emptyText="نام فارسی یا لاتین بازی را امتحان کنید، یا فهرست همهٔ بازی‌ها را ببینید." />
  );
}

export interface AccountPopoverProps {
  name: string; sub?: string; initials: string; src?: string;
  coins?: number; unreadMessages: number; admin: boolean; staff: boolean;
  onLogout: () => void; onClose: () => void;
}

/** The avatar's menu: the design system's AccountMenu with this app's routes. «خروج» is a link to #logout, handled here. */
export function AccountPopover({ name, sub, initials, src, coins, unreadMessages, admin, staff, onLogout, onClose }: AccountPopoverProps) {
  const items: NonNullable<Parameters<typeof AccountMenu>[0]['items']> = [
    { icon: 'user', label: 'پروفایل من', href: '/me/profile' }, { icon: 'trophy', label: 'پیشرفت و رتبه', href: '/progress' },
    { icon: 'palette', label: 'استودیو پروفایل', href: '/me/studio' }, { icon: 'smile', label: 'ساخت آواتار', href: '/me/avatar' },
    { icon: 'shirt', label: 'کمد من', href: '/me/wardrobe' }, { icon: 'shopping-bag', label: 'فروشگاه کازمتیک', href: '/shop' },
    '-',
    { icon: 'message-circle', label: 'پیام‌ها و دوستان', href: '/messages', key: 'messages' }, { icon: 'users', label: 'باشگاه‌ها و گروه‌ها', href: '/clubs' },
    { icon: 'wallet', label: 'اشتراک و سکه', href: '/plans', key: 'wallet' }, { icon: 'settings', label: 'تنظیمات', href: '/settings' },
    '-',
    { icon: 'book-open', label: 'راهنما', href: '/guides' }, { icon: 'life-buoy', label: 'پشتیبانی', href: '/support' },
    '-',
    ...(staff ? [{ icon: 'shield' as const, label: 'نظارت', href: '/mod' }] : []),
    { icon: 'sliders-horizontal', label: 'پنل مدیریت', href: '/admin', key: 'admin', tag: 'فقط مدیران' },
    { icon: 'log-out', label: 'خروج', href: '#logout' }
  ];
  return (
    <div className="app-accountmenu" onClick={(e) => {
      const a = (e.target as HTMLElement).closest('a');
      if (!a) return;
      if (a.getAttribute('href') === '#logout') { e.preventDefault(); e.stopPropagation(); onLogout(); }
      onClose();
    }}>
      <AccountMenu user={{ name, ...(sub ? { sub } : {}), initials, ...(src ? { src } : {}) }} {...(coins !== undefined ? { coins, coinsHref: '/coins', buyHref: '/coins' } : {})}
        admin={admin} counts={{ messages: unreadMessages }} items={items} />
    </div>
  );
}

/** eNamad trust seal, markup as issued by enamad.ir (the img `code` attribute is part of their snippet). */
export function EnamadSeal() {
  return (
    <a className="app-page__seal" referrerPolicy="origin" target="_blank" rel="noopener" href="https://trustseal.enamad.ir/?id=8074182&Code=zujYLwMpxeZT6OPGu7uoy0mv35gZtFXi" aria-label="نماد اعتماد الکترونیکی (اینماد)">
      <img referrerPolicy="origin" src="https://trustseal.enamad.ir/logo.aspx?id=8074182&Code=zujYLwMpxeZT6OPGu7uoy0mv35gZtFXi" alt="نماد اعتماد الکترونیکی"
        {...{ code: 'zujYLwMpxeZT6OPGu7uoy0mv35gZtFXi' }} />
    </a>
  );
}

/** The Android app on Cafe Bazaar (apps/android, appId ir.boardgameverse.app). */
const BAZAAR_URL = 'https://cafebazaar.ir/app/ir.boardgameverse.app';

/** Footer for the public pages only (games, game page, wiki, support, guides, home); never on tables, messages or settings. */
export function PublicFooter() {
  return (
    <SiteFooter logo={{ src: '/brand/logo-fa-reversed.svg' }} storeHref={BAZAAR_URL} seal={<EnamadSeal />}
      columns={[
        { title: 'بازی‌های محبوب', links: [['کاتان آنلاین', '/games/catan'], ['آزول آنلاین', '/games/azul'], ['تیکت تو راید آنلاین', '/games/ticket-to-ride'],
          ['اونو آنلاین', '/games/uno'], ['شطرنج آنلاین', '/games/chess'], ['تخته‌نرد آنلاین', '/games/backgammon']] },
        { title: 'جامعه', links: [['تورنمنت‌ها', '/tournaments'], ['رتبه‌بندی', '/ranking'], ['باشگاه‌ها', '/clubs'], ['راهنما', '/guides']] },
        { title: 'پشتیبانی و قوانین', links: [['پشتیبانی', '/support'], ...SITE_LINKS.map(([s, label]): [string, string] => [label, `/${s}`])] }
      ]} />
  );
}

/** Pages that show the footer. */
export const hasFooter = (path: string) =>
  path === '/' || path === '/games' || /^\/games\/[^/]+$/.test(path) || path === '/wiki' || path === '/support' || path === '/guides';
