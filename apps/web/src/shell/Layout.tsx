import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import type { MyTableItem, NotificationItem, Progression } from '@bg/contracts';
import { useOnline } from '@bg/ui';
import { AppShell, Banner, Button, StateBlock, type NavItemProps } from '@bg/ui/bgv';
import { api, useApi } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';
import { useCoins } from '../lib/coins.tsx';
import { bestLeague, useLinkRouting, userIdentity } from '../lib/bgv.tsx';
import { PAGE_TITLE_EVENT } from '../lib/usePageTitle.ts';
import { Celebration } from './Celebration.tsx';
import { WelcomeGift } from './WelcomeGift.tsx';
import { OnboardingProvider, WelcomeInvite } from './Onboarding.tsx';
import { SiteLinks } from '../pages/SitePage.tsx';
import { TermsGate } from './Account.tsx';
import { PAGE_GROUPS } from './PageTabs.tsx';

const LOGO = {
  src: '/brand/logo-fa-primary.svg', srcDark: '/brand/logo-fa-reversed.svg',
  markSrc: '/brand/symbol-primary-small.svg', markSrcDark: '/brand/symbol-reversed-small.svg'
};

/** Full-screen routes (no shell), as the references show. A live game hides the shell itself (html[data-immersive], Table.tsx). */
const immersive = (path: string) => path === '/login' || path === '/payments/result' || path === '/dev-gateway';

type Group = keyof typeof PAGE_GROUPS;
const inGroup = (g: Group, path: string) => PAGE_GROUPS[g].some(([to]) => path === to || path.startsWith(`${to}/`));

export function Layout() {
  const { me, status, refresh } = useSession();
  const online = useOnline();
  const { pathname } = useLocation();
  const route = useLinkRouting();
  const title = usePageTitleText();
  const signedIn = !!me;
  const unread = useUnreadMessages(signedIn);
  const notifications = useUnreadNotifications(signedIn);
  const turns = useTurns(signedIn, pathname);
  const coins = useCoins(signedIn);
  const progression = useApi<Progression>(signedIn ? '/me/progression' : null);

  const at = (to: string, group?: Group) => (group ? inGroup(group, pathname) : pathname === to);
  const nav: Array<NavItemProps | { group: string }> = [
    { group: 'بازی' },
    { icon: 'house', label: 'خانه', href: '/', active: pathname === '/', 'data-tour': 'nav-home' },
    { icon: 'layout-grid', label: 'بازی‌ها', href: '/games', active: at('/games', 'games'), 'data-tour': 'nav-games' },
    { icon: 'dices', label: 'میزها و حریف‌یابی', href: '/tables', active: at('/tables', 'tables') || pathname === '/tables/mine', turns, 'data-tour': 'nav-tables' },
    { group: 'من' },
    { icon: 'trophy', label: 'پیشرفت و رتبه', href: '/progress', active: at('/progress', 'progress'), 'data-tour': 'nav-progress' },
    { icon: 'message-circle', label: 'پیام‌ها و دوستان', href: '/messages', active: at('/messages', 'social') || pathname.startsWith('/users/'), count: unread, 'data-tour': 'nav-messages' },
    { icon: 'wallet', label: 'اشتراک و سکه', href: '/plans', active: at('/plans', 'wallet'), 'data-tour': 'nav-plans' },
    { group: 'کمک' },
    { icon: 'book-open', label: 'راهنما', href: '/guides', active: at('/guides') || pathname === '/wiki', 'data-tour': 'nav-guides' },
    { icon: 'life-buoy', label: 'پشتیبانی', href: '/support', active: at('/support'), 'data-tour': 'nav-support' },
    { icon: 'settings', label: 'تنظیمات', href: '/settings', active: at('/settings'), 'data-tour': 'nav-settings' }
  ];
  const staff = me?.roles.some((r) => r === 'moderator' || r === 'admin');
  if (staff) nav.push({ group: 'نقش‌ها' }, { icon: 'shield', label: 'نظارت', href: '/mod', active: at('/mod') });
  if (me?.roles.includes('admin')) nav.push({ icon: 'sliders-horizontal', label: 'مدیریت', href: '/admin', active: at('/admin') });
  const dockItems = [
    { icon: 'house', label: 'خانه', href: '/', active: pathname === '/' },
    { icon: 'layout-grid', label: 'بازی‌ها', href: '/games', active: inGroup('games', pathname) },
    { icon: 'dices', label: 'میزها', href: '/tables', active: inGroup('tables', pathname) || pathname === '/tables/mine', turns },
    { icon: 'message-circle', label: 'پیام‌ها', href: '/messages', active: inGroup('social', pathname), count: unread },
    { icon: 'menu', label: 'بیشتر', href: '/more', active: pathname === '/more' }
  ];

  const page = status === 'error'
    ? <StateBlock kind="error" title="ارتباط با سرور برقرار نشد" text="وضعیت حساب شما دریافت نشد. اتصال را بررسی کنید."
        action={<Button variant="primary" icon="refresh-cw" onClick={() => void refresh()}>تلاش دوباره</Button>} />
    : <Outlet />;

  if (immersive(pathname)) {
    return (
      <OnboardingProvider>
        <div className="app-immersive" onClick={route}>
          <main id="main" tabIndex={-1}>{page}</main>
          <Celebration />
          <TermsGate />
        </div>
      </OnboardingProvider>
    );
  }

  const league = progression.data ? bestLeague(progression.data.ratings) : null;
  const user = me ? {
    ...userIdentity(me, { ...(league ? { league } : {}), ...(progression.data ? { level: progression.data.level } : {}) }),
    href: '/me/profile', 'data-tour': 'nav-profile'
  } : undefined;

  return (
    <OnboardingProvider>
      <a className="app-skip" href="#main">پرش به محتوای اصلی</a>
      <div className="app-root" onClick={route}>
      <AppShell logo={LOGO} nav={nav} dockItems={dockItems} title={title}
        {...(user ? { user } : {})}
        {...(coins.data ? { coins: coins.data.balance, coinsHref: '/coins' } : {})}
        {...(signedIn ? { notifications, notificationsHref: '/notifications' } : {})}>
        <div id="main" tabIndex={-1} className="app-page">
          {!signedIn && status === 'ready' && (
            <Banner tone="info" icon="user" title="هنوز وارد نشده‌اید" text="برای بازی، میز ساختن و دیدن پیشرفت وارد شوید."
              action={<Button size="sm" variant="primary" href={`/login?next=${encodeURIComponent(pathname)}`}>ورود / ثبت‌نام</Button>} />
          )}
          {me?.suspended && <Banner tone="warning" icon="triangle-alert" title="حساب شما موقتاً تعلیق شده است"
            text="جزئیات و اعتراض در بخش پشتیبانی." action={<Button size="sm" href="/support">پشتیبانی</Button>} />}
          {pathname === '/' && <WelcomeInvite />}
          {!online && <Banner tone="warning" icon="wifi-off" title="اتصال اینترنت قطع است" text="اطلاعات نمایش‌داده‌شده ممکن است قدیمی باشد." />}
          {page}
          <footer className="app-page__foot"><SiteLinks /><EnamadSeal /></footer>
        </div>
      </AppShell>
      </div>
      <Celebration />
      <WelcomeGift />
      <TermsGate />
    </OnboardingProvider>
  );
}

/** eNamad trust seal, markup as issued by enamad.ir (the img `code` attribute is part of their snippet). */
function EnamadSeal() {
  return (
    <a className="app-page__seal" referrerPolicy="origin" target="_blank" rel="noopener" href="https://trustseal.enamad.ir/?id=8074182&Code=zujYLwMpxeZT6OPGu7uoy0mv35gZtFXi" aria-label="نماد اعتماد الکترونیکی (اینماد)">
      <img referrerPolicy="origin" src="https://trustseal.enamad.ir/logo.aspx?id=8074182&Code=zujYLwMpxeZT6OPGu7uoy0mv35gZtFXi" alt="نماد اعتماد الکترونیکی"
        {...{ code: 'zujYLwMpxeZT6OPGu7uoy0mv35gZtFXi' }} />
    </a>
  );
}

function usePageTitleText(): string {
  const [title, setTitle] = useState('بردگیم‌ورس');
  useEffect(() => {
    const on = (e: Event) => setTitle((e as CustomEvent<string>).detail);
    window.addEventListener(PAGE_TITLE_EVENT, on);
    return () => window.removeEventListener(PAGE_TITLE_EVENT, on);
  }, []);
  return title;
}

/** Re-reads `load` now, after the given window events (debounced) and when `key` changes. */
function useLiveCount(signedIn: boolean, load: () => Promise<number>, events: string[], key?: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!signedIn) { setCount(0); return; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => { void load().then(setCount, () => { /* keep last count */ }); };
    const later = () => { clearTimeout(timer); timer = setTimeout(run, 800); };
    run();
    for (const e of events) window.addEventListener(e, later);
    return () => { clearTimeout(timer); for (const e of events) window.removeEventListener(e, later); };
  }, [signedIn, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return count;
}

/** Unread private, group and club messages; refreshed on every pushed message or read marker. */
const useUnreadMessages = (signedIn: boolean) =>
  useLiveCount(signedIn, () => api<{ count: number }>('/me/conversations/unread').then((r) => r.count), ['bg:message', 'bg:read']);

/** Unread in-app notifications (bell). */
export const NOTIFICATIONS_READ = 'bg:notifications-read';
const useUnreadNotifications = (signedIn: boolean) =>
  useLiveCount(signedIn, () => api<{ items: NotificationItem[] }>('/me/notifications').then((r) => r.items.filter((n) => !n.read).length), ['bg:notification', NOTIFICATIONS_READ]);

/** Tables waiting for the viewer's move (coral «نوبت» count); re-read on navigation and pushed notifications. */
const useTurns = (signedIn: boolean, pathname: string) =>
  useLiveCount(signedIn, () => api<{ items: MyTableItem[] }>('/me/tables').then((r) => r.items.filter((t) => t.isMyTurn).length), ['bg:notification'], pathname);
