import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  Bell, CreditCard, Dices, House, LayoutGrid, LifeBuoy, LogIn, LogOut, MessageCircle, Settings, Shield, ShieldCheck, Sparkles,
  Swords, Trophy, UserRound, Users, UsersRound, Castle, type LucideIcon
} from 'lucide-react';
import { Avatar, Button, GirihBackground, StateBlock, buttonClass, cn, useOnline, useToast } from '@bg/ui';
import { useSession } from '../lib/session.tsx';

const APP_NAME = 'باشگاه بردگیم';

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

const navClass = ({ isActive }: { isActive: boolean }) => cn(
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

  const items: NavItem[] = [
    { to: '/', label: 'داشبورد', icon: House, end: true },
    { to: '/games', label: 'بازی‌ها', icon: LayoutGrid },
    { to: '/play', label: 'حریف‌یابی', icon: Swords },
    { to: '/tables', label: 'میزها', icon: Castle },
    { to: '/progress', label: 'پیشرفت', icon: Sparkles },
    { to: '/ranking', label: 'رتبه‌بندی', icon: Trophy },
    { to: '/messages', label: 'پیام‌ها', icon: MessageCircle },
    { to: '/friends', label: 'دوستان', icon: UserRound },
    { to: '/groups', label: 'گروه‌ها', icon: UsersRound },
    { to: '/clubs', label: 'باشگاه‌ها', icon: Users },
    { to: '/plans', label: 'اشتراک', icon: CreditCard },
    { to: '/support', label: 'پشتیبانی', icon: LifeBuoy },
    { to: '/settings', label: 'تنظیمات', icon: Settings }
  ];
  if (me?.roles.some((r) => r === 'moderator' || r === 'admin')) items.push({ to: '/mod', label: 'نظارت', icon: Shield });
  if (me?.roles.includes('admin')) items.push({ to: '/admin', label: 'مدیریت', icon: ShieldCheck });
  // Bottom dock on phones: five slots, the rest lives under «بیشتر».
  const mobileItems: NavItem[] = [items[0]!, items[1]!, items[2]!, items.find((i) => i.to === '/messages')!, { to: '/more', label: 'بیشتر', icon: Bell }];

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
    <div className="relative isolate min-h-dvh lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
      {/* Signature: a faint Persian girih tile pattern behind the whole café. */}
      <GirihBackground size={64} className="fixed -z-10 opacity-60" />
      <a className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-primary focus:px-5 focus:py-2 focus:text-primary-foreground" href="#main">پرش به محتوای اصلی</a>

      <aside aria-label="ناوبری اصلی" className="sticky top-4 m-4 hidden h-[calc(100dvh-2rem)] flex-col gap-5 rounded-surface border-line border-border bg-card p-4 shadow-surface lg:flex">
        <div className="px-1 pt-1"><Brand /></div>
        <nav className="-me-2 flex-1 overflow-y-auto pe-2">
          <ul className="grid gap-1">
            {items.map((i) => (
              <li key={i.to}><NavLink to={i.to} end={i.end ?? false} className={navClass}><i.icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />{i.label}</NavLink></li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-2 border-t border-border pt-4">
          {me ? (
            <>
              <div className="flex min-w-0 items-center gap-3 px-1">
                <Avatar avatarKey={me.avatarKey} name={me.displayName} size={40} />
                <span className="truncate font-semibold">{me.displayName}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={onLogout} className="justify-start"><LogOut aria-hidden />خروج</Button>
            </>
          ) : status !== 'loading' && (
            <Button block onClick={login}><LogIn aria-hidden />ورود / ثبت‌نام</Button>
          )}
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 backdrop-blur-md lg:hidden">
        <Brand compact />
        {me ? <NavLink to="/settings" aria-label="حساب و تنظیمات" className="rounded-full"><Avatar avatarKey={me.avatarKey} name={me.displayName} size={40} /></NavLink>
          : status !== 'loading' && <NavLink className={buttonClass('primary', 'sm')} to={`/login?next=${encodeURIComponent(pathname)}`}>ورود</NavLink>}
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] outline-none lg:px-8 lg:pb-12">
        {me?.suspended && <Banner tone="warn">حساب شما موقتاً تعلیق شده است. جزئیات و اعتراض در <NavLink to="/support" className="font-bold underline">پشتیبانی</NavLink>.</Banner>}
        {!online && <Banner tone="warn">اتصال اینترنت قطع است؛ اطلاعات نمایش‌داده‌شده ممکن است قدیمی باشد.</Banner>}
        {status === 'error'
          ? <StateBlock kind="error" title="ارتباط با سرور برقرار نشد" action={<Button onClick={() => void refresh()}>تلاش دوباره</Button>}>
              وضعیت حساب شما دریافت نشد. اتصال را بررسی کنید.
            </StateBlock>
          : <div key={pathname} className="page-enter animate-fade-up"><Outlet /></div>}
      </main>

      <nav aria-label="ناوبری اصلی" className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-5 gap-1 rounded-control border-line border-border bg-card/95 p-1.5 shadow-overlay backdrop-blur-md lg:hidden">
        {mobileItems.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end ?? false}
            className={({ isActive }) => cn('flex h-14 flex-col items-center justify-center gap-0.5 rounded-control text-[11px] font-semibold no-underline transition-all duration-(--motion) ease-motion',
              isActive ? 'bg-primary text-primary-foreground shadow-control' : 'text-muted-foreground')}>
            <i.icon className="size-5" strokeWidth={1.75} aria-hidden /><span>{i.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
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
