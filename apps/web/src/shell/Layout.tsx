import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  Bell, Compass, CreditCard, Dices, House, LayoutGrid, LifeBuoy, LogIn, LogOut, MessageCircle, Settings, Shield, ShieldCheck,
  Trophy, Castle, type LucideIcon
} from 'lucide-react';
import { Avatar, Button, GirihBackground, StateBlock, buttonClass, cn, useOnline, useToast } from '@bg/ui';
import { api } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';
import { Celebration } from './Celebration.tsx';
import { WelcomeGift } from './WelcomeGift.tsx';
import { CoinChip } from '../lib/coins.tsx';
import { OnboardingProvider, WelcomeInvite } from './Onboarding.tsx';
import { SiteLinks } from '../pages/SitePage.tsx';
import { TermsGate } from './Account.tsx';
import { PAGE_GROUPS } from './PageTabs.tsx';

const APP_NAME = 'باشگاه بردگیم';

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: number; group?: keyof typeof PAGE_GROUPS }
/** Active when the path is any page of the entry's group (or below it, e.g. /games/:id). */
const inGroup = (i: NavItem, path: string) => !!i.group && PAGE_GROUPS[i.group].some(([to]) => path === to || path.startsWith(`${to}/`));
/** Guide anchor for a nav link (contracts/onboarding.ts targets), e.g. /games → nav-games. */
const tourId = (to: string) => `nav-${to.slice(1) || 'home'}`;

const navClass = (isActive: boolean) => cn(
  'flex h-11 items-center gap-3 rounded-control px-4 text-sm font-medium no-underline transition-all duration-(--motion) ease-motion',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
  isActive ? 'bg-primary font-bold text-primary-foreground shadow-control' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
);

/** Brand mark: dice on a felt-green clay tile. */
function Brand({ compact }: { compact?: boolean }) {
  return (
    <NavLink to="/" className="flex items-center gap-3 text-foreground no-underline">
      <span className={cn('flex items-center justify-center rounded-field bg-primary text-primary-foreground shadow-control', compact ? 'size-10' : 'size-12')}>
        <Dices className={compact ? 'size-5' : 'size-6'} strokeWidth={2} aria-hidden />
      </span>
      <span className="grid leading-tight">
        <span className={cn('font-display font-extrabold', compact ? 'text-base' : 'text-lg')}>{APP_NAME}</span>
        {!compact && <span className="text-xs text-muted-foreground">کافه‌بازی آنلاین</span>}
      </span>
    </NavLink>
  );
}

export function Layout() {
  const { me, status, logout, refresh } = useSession();
  const online = useOnline();
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const unread = useUnreadMessages(!!me);
  // Sibling pages share one entry; PageTabs switches between them on the page.
  const items: NavItem[] = [
    { to: '/', label: 'داشبورد', icon: House, end: true },
    { to: '/games', label: 'بازی‌ها', icon: LayoutGrid, group: 'games' },
    { to: '/tables', label: 'میزها و حریف‌یابی', icon: Castle, group: 'tables' },
    { to: '/progress', label: 'پیشرفت و رتبه', icon: Trophy, group: 'progress' },
    { to: '/messages', label: 'پیام و دوستان', icon: MessageCircle, badge: unread, group: 'social' },
    { to: '/plans', label: 'اشتراک و سکه', icon: CreditCard, group: 'wallet' },
    { to: '/guides', label: 'راهنما', icon: Compass },
    { to: '/support', label: 'پشتیبانی', icon: LifeBuoy },
    { to: '/settings', label: 'تنظیمات', icon: Settings }
  ];
  if (me?.roles.some((r) => r === 'moderator' || r === 'admin')) items.push({ to: '/mod', label: 'نظارت', icon: Shield });
  if (me?.roles.includes('admin')) items.push({ to: '/admin', label: 'مدیریت', icon: ShieldCheck });
  // Bottom dock on phones: five slots, the rest lives under «بیشتر».
  const mobileItems: NavItem[] = [items[0]!, items[1]!, { ...items[2]!, label: 'میزها' }, { ...items[4]!, label: 'پیام‌ها' }, { to: '/more', label: 'بیشتر', icon: Bell }];

  const onLogout = async () => {
    try {
      await logout();
      toast('success', 'از حساب خارج شدید.');
      navigate('/');
    } catch {
      toast('error', 'خروج انجام نشد؛ دوباره تلاش کنید.');
    }
  };
  const login = () => navigate(`/login?next=${encodeURIComponent(pathname)}`);

  return (
    <OnboardingProvider>
    <div className="shell relative isolate min-h-dvh lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
      {/* Signature: a faint Persian girih tile pattern behind the whole café. */}
      <GirihBackground size={64} className="fixed -z-10 opacity-60" />
      <a className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-primary focus:px-5 focus:py-2 focus:text-primary-foreground" href="#main">پرش به محتوای اصلی</a>

      <aside aria-label="ناوبری اصلی" className="shell-nav sticky top-4 m-4 hidden h-[calc(100dvh-2rem)] flex-col gap-5 rounded-surface border-line border-border bg-card p-4 shadow-surface lg:flex">
        <div className="px-1 pt-1"><Brand /></div>
        <nav className="-me-2 flex-1 overflow-y-auto pe-2">
          <ul className="grid gap-1">
            {items.map((i) => (
              <li key={i.to}><NavLink to={i.to} end={i.end ?? false} className={({ isActive }) => navClass(isActive || inGroup(i, pathname))} data-tour={tourId(i.to)}><i.icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />{i.label}<NavBadge n={i.badge} /></NavLink></li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-2 border-t border-border pt-4">
          {me ? (
            <>
              <div className="flex min-w-0 items-center gap-3 px-1">
                <NavLink to="/me/profile" aria-label="پروفایل من" className="shrink-0 rounded-full" data-tour="nav-profile"><Avatar avatarKey={me.avatarKey} name={me.displayName} size={40} /></NavLink>
                <span className="truncate font-semibold">{me.displayName}</span>
                <span className="ms-auto"><CoinChip /></span>
              </div>
              <Button variant="ghost" size="sm" onClick={onLogout} className="justify-start"><LogOut aria-hidden />خروج</Button>
            </>
          ) : status !== 'loading' && (
            <Button block onClick={login}><LogIn aria-hidden />ورود / ثبت‌نام</Button>
          )}
        </div>
      </aside>

      <header className="shell-nav sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 backdrop-blur-md lg:hidden">
        <Brand compact />
        {me ? <div className="flex items-center gap-2"><CoinChip /><NavLink to="/me/profile" aria-label="پروفایل من" className="rounded-full" data-tour="nav-profile"><Avatar avatarKey={me.avatarKey} name={me.displayName} size={40} /></NavLink></div>
          : status !== 'loading' && <NavLink className={buttonClass('primary', 'sm')} to={`/login?next=${encodeURIComponent(pathname)}`}>ورود</NavLink>}
      </header>

      <main id="main" tabIndex={-1} className="shell-main mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] outline-none lg:px-8 lg:pb-12">
        {me?.suspended && <Banner tone="warn">حساب شما موقتاً تعلیق شده است. جزئیات و اعتراض در <NavLink to="/support" className="font-bold underline">پشتیبانی</NavLink>.</Banner>}
        {pathname === '/' && <WelcomeInvite />}
        {!online && <Banner tone="warn">اتصال اینترنت قطع است؛ اطلاعات نمایش‌داده‌شده ممکن است قدیمی باشد.</Banner>}
        {status === 'error'
          ? <StateBlock kind="error" title="ارتباط با سرور برقرار نشد" action={<Button onClick={() => void refresh()}>تلاش دوباره</Button>}>
              وضعیت حساب شما دریافت نشد. اتصال را بررسی کنید.
            </StateBlock>
          : <div key={pathname} className="page-enter animate-fade-up"><Outlet /></div>}
        <footer className="shell-foot mt-8 flex flex-wrap items-center justify-between gap-4 [&_img]:h-11 [&_img]:w-auto">
          <SiteLinks />
          {/* eNamad trust seal, markup as issued by enamad.ir (the img `code` attribute is part of their snippet). */}
          <a className="opacity-40 transition-opacity duration-(--motion) hover:opacity-100 focus-visible:opacity-100" referrerPolicy="origin" target="_blank" rel="noopener" href="https://trustseal.enamad.ir/?id=8074182&Code=zujYLwMpxeZT6OPGu7uoy0mv35gZtFXi" aria-label="نماد اعتماد الکترونیکی (اینماد)">
            <img referrerPolicy="origin" src="https://trustseal.enamad.ir/logo.aspx?id=8074182&Code=zujYLwMpxeZT6OPGu7uoy0mv35gZtFXi" alt="نماد اعتماد الکترونیکی" style={{ cursor: 'pointer' }}
              {...{ code: 'zujYLwMpxeZT6OPGu7uoy0mv35gZtFXi' }} />
          </a>
        </footer>
      </main>

      <nav aria-label="ناوبری اصلی" className="shell-nav fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-5 gap-1 rounded-control border-line border-border bg-card/95 p-1.5 shadow-overlay backdrop-blur-md lg:hidden">
        {mobileItems.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end ?? false} data-tour={tourId(i.to)}
            className={({ isActive }) => cn('flex h-14 flex-col items-center justify-center gap-0.5 rounded-control text-[11px] font-semibold no-underline transition-all duration-(--motion) ease-motion',
              isActive || inGroup(i, pathname) ? 'bg-primary text-primary-foreground shadow-control' : 'text-muted-foreground')}>
            <span className="relative"><i.icon className="size-5" strokeWidth={1.75} aria-hidden /><NavBadge n={i.badge} dock /></span><span>{i.label}</span>
          </NavLink>
        ))}
      </nav>
      <Celebration />
      <WelcomeGift />
      <TermsGate />
    </div>
    </OnboardingProvider>
  );
}

/** Unread private, group and club messages; refreshed on every pushed message or read marker. */
function useUnreadMessages(signedIn: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!signedIn) { setCount(0); return; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => { void api<{ count: number }>('/me/conversations/unread').then((r) => setCount(r.count), () => { /* keep last count */ }); };
    const later = () => { clearTimeout(timer); timer = setTimeout(load, 800); };
    load();
    window.addEventListener('bg:message', later);
    window.addEventListener('bg:read', later);
    return () => { clearTimeout(timer); window.removeEventListener('bg:message', later); window.removeEventListener('bg:read', later); };
  }, [signedIn]);
  return count;
}

function NavBadge({ n, dock }: { n?: number | undefined; dock?: boolean }) {
  if (!n) return null;
  return <span className={cn('chatbadge', dock && 'absolute -top-1.5 -end-2.5 m-0')} aria-label={`${n.toLocaleString('fa-IR')} پیام خوانده‌نشده`}>{n > 99 ? '۹۹+' : n.toLocaleString('fa-IR')}</span>;
}

export function Banner({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) {
  return (
    <div role={tone === 'warn' ? 'alert' : 'status'}
      className={cn('banner mb-4 flex items-center gap-3 rounded-surface border-line px-5 py-3 text-sm shadow-surface animate-fade-up',
        tone === 'warn' ? 'banner--warn border-warning/40 bg-warning/10' : 'banner--info border-primary/30 bg-primary/8')}>
      {children}
    </div>
  );
}
