import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Avatar, Button, Icon, StateBlock, useOnline, useToast, type IconName } from '@bg/ui';
import { useSession } from '../lib/session.tsx';

const APP_NAME = 'باشگاه بردگیم';

interface NavItem { to: string; label: string; icon: IconName; end?: boolean }

export function Layout() {
  const { me, status, logout, refresh } = useSession();
  const online = useOnline();
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const items: NavItem[] = [
    { to: '/', label: 'داشبورد', icon: 'home', end: true },
    { to: '/games', label: 'بازی‌ها', icon: 'grid' },
    { to: '/play', label: 'حریف‌یابی', icon: 'play' },
    { to: '/tables', label: 'میزها', icon: 'players' },
    { to: '/progress', label: 'پیشرفت', icon: 'star' },
    { to: '/ranking', label: 'رتبه‌بندی', icon: 'crown' },
    { to: '/messages', label: 'پیام‌ها', icon: 'card' },
    { to: '/friends', label: 'دوستان', icon: 'user' },
    { to: '/groups', label: 'گروه‌ها', icon: 'players' },
    { to: '/clubs', label: 'باشگاه‌ها', icon: 'crown' },
    { to: '/plans', label: 'اشتراک', icon: 'card' },
    { to: '/support', label: 'پشتیبانی', icon: 'shield' },
    { to: '/settings', label: 'تنظیمات', icon: 'settings' }
  ];
  if (me?.roles.some((r) => r === 'moderator' || r === 'admin')) items.push({ to: '/mod', label: 'نظارت', icon: 'shield' });
  if (me?.roles.includes('admin')) items.push({ to: '/admin', label: 'مدیریت', icon: 'settings' });
  // Bottom bar on phones: five slots, the rest lives under «بیشتر».
  const mobileItems: NavItem[] = [items[0]!, items[1]!, items[2]!, items.find((i) => i.to === '/messages')!, { to: '/more', label: 'بیشتر', icon: 'grid' }];

  const onLogout = async () => {
    try {
      await logout();
      toast('success', 'از حساب خارج شدید.');
      navigate('/');
    } catch {
      toast('error', 'خروج انجام نشد؛ دوباره تلاش کنید.');
    }
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main">پرش به محتوای اصلی</a>
      <aside className="sidenav wood" aria-label="ناوبری اصلی">
        <NavLink to="/" className="brand"><Icon name="meeple" size={28} /><span>{APP_NAME}</span></NavLink>
        <nav>
          <ul>
            {items.map((i) => (
              <li key={i.to}><NavLink to={i.to} end={i.end ?? false} className="sidenav__link"><Icon name={i.icon} />{i.label}</NavLink></li>
            ))}
          </ul>
        </nav>
        <div className="sidenav__account">
          {me ? (
            <>
              <div className="account-chip">
                <Avatar avatarKey={me.avatarKey} name={me.displayName} size={36} />
                <span className="account-chip__name">{me.displayName}</span>
              </div>
              <Button variant="ghost" size="sm" icon="logout" onClick={onLogout}>خروج</Button>
            </>
          ) : status !== 'loading' && (
            <Button variant="secondary" block icon="user" onClick={() => navigate(`/login?next=${encodeURIComponent(pathname)}`)}>ورود / ثبت‌نام</Button>
          )}
        </div>
      </aside>

      <header className="topbar wood">
        <NavLink to="/" className="brand"><Icon name="meeple" size={24} /><span>{APP_NAME}</span></NavLink>
        {me ? <NavLink to="/settings" aria-label="حساب و تنظیمات"><Avatar avatarKey={me.avatarKey} name={me.displayName} size={36} /></NavLink>
          : status !== 'loading' && <NavLink className="btn btn--secondary btn--sm" to={`/login?next=${encodeURIComponent(pathname)}`}>ورود</NavLink>}
      </header>

      <main id="main" className="main" tabIndex={-1}>
        {me?.suspended && <div className="banner banner--warn" role="alert"><Icon name="lock" />حساب شما موقتاً تعلیق شده است. جزئیات و اعتراض در <NavLink to="/support">پشتیبانی</NavLink>.</div>}
        {!online && <div className="banner banner--warn" role="status"><Icon name="offline" />اتصال اینترنت قطع است؛ اطلاعات نمایش‌داده‌شده ممکن است قدیمی باشد.</div>}
        {status === 'error'
          ? <StateBlock kind="error" title="ارتباط با سرور برقرار نشد" action={<Button onClick={() => void refresh()}>تلاش دوباره</Button>}>
              وضعیت حساب شما دریافت نشد. اتصال را بررسی کنید.
            </StateBlock>
          : <Outlet />}
      </main>

      <nav className="bottomnav" aria-label="ناوبری اصلی">
        {mobileItems.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end ?? false} className="bottomnav__link"><Icon name={i.icon} size={22} /><span>{i.label}</span></NavLink>
        ))}
      </nav>
    </div>
  );
}
