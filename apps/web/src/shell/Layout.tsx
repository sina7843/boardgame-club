import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import type { MyTableItem, NotificationItem, Progression } from '@bg/contracts';
import { useOnline, useToast } from '@bg/ui';
import { AppShell, Badge, Banner, Button, Coin, Icon, SiteHeader, StateBlock, TopBar } from '@bg/ui/bgv';
import { api, useApi } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';
import { useCoins } from '../lib/coins.tsx';
import { useLinkRouting } from '../lib/bgv.tsx';
import { faNum } from '../lib/format.ts';
import { lastPageTitle, PAGE_TITLE_EVENT } from '../lib/usePageTitle.ts';
import { Celebration } from './Celebration.tsx';
import { WelcomeGift } from './WelcomeGift.tsx';
import { OnboardingProvider } from './Onboarding.tsx';
import { AccountPopover, hasFooter, HeaderSearch, PublicFooter } from './SiteChrome.tsx';
import { TermsGate } from './Account.tsx';
import { PAGE_GROUPS } from './PageTabs.tsx';

const LOGO = {
  src: '/brand/logo-fa-primary.svg', srcDark: '/brand/logo-fa-reversed.svg',
  markSrc: '/brand/symbol-primary-small.svg', markSrcDark: '/brand/symbol-reversed-small.svg'
};

/** Full-screen routes (no shell), as the references show. A live game hides the shell itself (html[data-immersive], Table.tsx). */
const immersive = (path: string) => path === '/login' || path === '/payments/result' || path === '/dev-gateway' || path === '/search';

type Group = keyof typeof PAGE_GROUPS;

/** Phone top bar per the references: a shared title for sibling pages, and a back arrow (to the designed parent) on sub-pages. */
function phoneTop(path: string): { title?: string; back?: string } {
  if (path === '/progress' || path === '/ranking') return { title: 'پیشرفت و رتبه', back: '/more' };
  if (path === '/messages' || path === '/friends' || path === '/clubs') return { title: 'پیام‌ها و دوستان' };
  if (path === '/plans' || path === '/coins') return { title: 'اشتراک و سکه' };
  if (path === '/shop' || path === '/me/wardrobe' || path === '/me/studio') return { back: '/me/profile' };
  if (path === '/me/profile') return { back: '/more' };
  if (path === '/me/avatar') return { back: '/me/studio' };
  if (path.startsWith('/users/')) return { back: '/friends' };
  if (path.startsWith('/clubs/')) return { back: '/clubs' };
  if (path.startsWith('/messages/')) return { back: '/messages' };
  if (path.startsWith('/groups/')) return { back: '/groups' };
  return {};
}
const inGroup = (g: Group, path: string) => PAGE_GROUPS[g].some(([to]) => path === to || path.startsWith(`${to}/`));

export function Layout() {
  const { me, status, refresh, logout } = useSession();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const online = useOnline();
  // Connection back after an outage: one «دوباره وصل شدید» toast (states spec, offline).
  const toast = useToast();
  const wasOffline = useRef(false);
  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) { wasOffline.current = false; toast('success', 'دوباره وصل شدید.'); }
  }, [online, toast]);
  const { pathname } = useLocation();
  const route = useLinkRouting();
  const title = usePageTitleText();
  const signedIn = !!me;
  const unread = useUnreadMessages(signedIn);
  const notifications = useUnreadNotifications(signedIn);
  const turns = useTurns(signedIn, pathname);
  const coins = useCoins(signedIn);
  const progression = useApi<Progression>(signedIn ? '/me/progression' : null);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    const away = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.app-accountmenu, .bgv-avatarbtn')) setMenuOpen(false); };
    document.addEventListener('keydown', onEsc); document.addEventListener('mousedown', away);
    return () => { document.removeEventListener('keydown', onEsc); document.removeEventListener('mousedown', away); };
  }, [menuOpen]);
  // The onboarding guides point at these anchors; the design-system header cannot carry data-tour itself.
  useEffect(() => {
    const tag = (sel: string, target: string) => document.querySelector(sel)?.setAttribute('data-tour', target);
    tag('.bgv-sitenav a[href="/"]', 'nav-home'); tag('.bgv-sitenav a[href="/games"]', 'nav-games'); tag('.bgv-sitenav a[href="/tables"]', 'nav-tables');
    tag('.bgv-siteheader__actions a[href="/messages"]', 'nav-messages'); tag('.bgv-avatarbtn', 'nav-profile');
  }, [pathname, signedIn, status]);

  const at = (to: string, group?: Group) => (group ? inGroup(group, pathname) : pathname === to);
  const staff = !!me?.roles.some((r) => r === 'moderator' || r === 'admin');
  // The five header destinations; everything else lives in the account menu (desktop) and «بیشتر» (phone).
  const nav = [
    { label: 'خانه', href: '/', active: pathname === '/' },
    { label: 'بازی‌ها', href: '/games', active: at('/games', 'games') },
    { label: 'میزها', href: '/tables', active: (inGroup('tables', pathname) && !pathname.startsWith('/tournaments')) || pathname === '/tables/mine', ...(turns ? { turns } : {}) },
    { label: 'تورنمنت‌ها', href: '/tournaments', active: pathname === '/tournaments' || pathname.startsWith('/tournaments/') },
    { label: 'رتبه‌بندی', href: '/ranking', active: pathname === '/ranking' }
  ];
  const dockItems = [
    { icon: 'house', label: 'خانه', href: '/', active: pathname === '/', 'data-tour': 'nav-home' },
    { icon: 'dices', label: 'میزها', href: '/tables', active: inGroup('tables', pathname) || pathname === '/tables/mine', turns, 'data-tour': 'nav-tables' },
    { icon: 'message-circle', label: 'پیام‌ها', href: '/messages', active: inGroup('social', pathname), count: unread, 'data-tour': 'nav-messages' },
    { icon: 'menu', label: 'بیشتر', href: '/more', active: false, 'data-tour': 'nav-more' }
  ];
  // Pages without a dock slot (games, progress, settings, shop …) light up «بیشتر», where they are listed.
  dockItems[3]!.active = !dockItems.slice(0, 3).some((d) => d.active);

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

  const initials = me ? [...me.displayName.trim()][0] ?? '؟' : '';
  const level = progression.data ? `سطح ${faNum(progression.data.level)}` : undefined;
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;
  const header = (
    <SiteHeader logo={{ src: LOGO.src, srcDark: LOGO.srcDark }} nav={nav} guest={!signedIn} search={<HeaderSearch />}
      quickPlay={pathname === '/' ? false : { href: '/play' }} loginHref={loginHref}
      {...(me ? { user: { initials, name: me.displayName, current: menuOpen || inGroup('progress', pathname) || pathname.startsWith('/me/') }, onAvatar: () => setMenuOpen((o) => !o), menuOpen } : {})}
      messages={{ href: '/messages', count: unread, current: inGroup('social', pathname) }}
      notifications={{ href: '/notifications', count: notifications, current: pathname === '/notifications' }}>
      {menuOpen && me && (
        <AccountPopover name={me.displayName} {...(level ? { sub: level } : {})} initials={initials}
          {...(coins.data ? { coins: coins.data.balance } : {})} unreadMessages={unread} admin={me.roles.includes('admin')} staff={staff}
          onLogout={() => { void logout().then(() => navigate('/')); }} onClose={() => setMenuOpen(false)} />
      )}
    </SiteHeader>
  );

  const phone = phoneTop(pathname);
  const topbar = phone.back
    ? <TopBar className="bgv-app__top" title={phone.title ?? title} search={{ href: '/search' }}
        leading={<Button variant="ghost" iconOnly icon="arrow-right" href={phone.back}>بازگشت</Button>}
        actions={signedIn ? [
          coins.data ? <Coin key="c" chip size="sm" amount={coins.data.balance} href="/coins" /> : null,
          <a key="b" className="bgv-btn bgv-btn--ghost bgv-btn--icon bgv-iconbtn-count" href="/notifications"
            aria-label={`اعلان‌ها${notifications ? `، ${faNum(notifications)} خوانده‌نشده` : ''}`}>
            <Icon name="bell" />{notifications ? <Badge tone="count">{faNum(notifications)}</Badge> : null}</a>
        ] : [<Button key="l" size="sm" variant="secondary" href={loginHref}>ورود / ثبت‌نام</Button>]} />
    : undefined;

  return (
    <OnboardingProvider>
      <a className="app-skip" href="#main">پرش به محتوای اصلی</a>
      <div className="app-root" onClick={route}>
      <AppShell className="bgv" logo={LOGO} header={header} dockItems={dockItems} title={phone.title ?? title} {...(topbar ? { topbar } : {})} guest={!signedIn} loginHref={loginHref}
        {...(coins.data ? { coins: coins.data.balance, coinsHref: '/coins' } : {})}
        {...(signedIn ? { notifications, notificationsHref: '/notifications' } : {})}
        {...(hasFooter(pathname) ? { footer: <PublicFooter /> } : {})}>
        <div id="main" tabIndex={-1} className="app-page">
          {me?.suspended && <Banner tone="warning" icon="triangle-alert" title="حساب شما موقتاً تعلیق شده است"
            text="جزئیات و اعتراض در بخش پشتیبانی." action={<Button size="sm" href="/support">پشتیبانی</Button>} />}
          {!online && <Banner tone="warning" icon="wifi-off" title="اتصال اینترنت قطع است" text="اطلاعات نمایش‌داده‌شده ممکن است قدیمی باشد؛ ساعت‌ها آخرین زمان تأییدشده را نشان می‌دهند."
            action={<Button size="sm" icon="refresh-cw" onClick={() => window.location.reload()}>تلاش دوباره</Button>} />}
          {page}
        </div>
      </AppShell>
      </div>
      <Celebration />
      <WelcomeGift />
      <TermsGate />
    </OnboardingProvider>
  );
}

function usePageTitleText(): string {
  const [title, setTitle] = useState(lastPageTitle);
  useEffect(() => {
    setTitle(lastPageTitle);
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
