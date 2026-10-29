import type { Progression } from '@bg/contracts';
import { Button, Icon, Identity, MoreGroup } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { bestLeague, userIdentity } from '../lib/bgv.tsx';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

type Tile = { href: string; label: string; icon: string; count?: number; turns?: number };

/** Phone: every destination that is not in the dock (on desktop they are in the header and the account menu). */
export function MorePage() {
  usePageTitle('بیشتر');
  const { me, logout } = useSession();
  const prog = useApi<Progression>(me ? '/me/progression' : null);
  const league = prog.data ? bestLeague(prog.data.ratings) : null;
  const tables = useApi<{ items: { isMyTurn: boolean }[] }>(me ? '/me/tables' : null);
  const friends = useApi<{ incoming: unknown[] }>(me ? '/me/friends' : null);
  const turns = tables.data?.items.filter((t) => t.isMyTurn).length ?? 0;
  const invites = friends.data?.incoming.length ?? 0;
  const groups: [string, Tile[]][] = [
    ['بازی و میز', [
      { href: '/games', label: 'بازی‌ها', icon: 'layout-grid' }, { href: '/tables/mine', label: 'میزهای من', icon: 'dices', ...(turns ? { turns } : {}) },
      { href: '/tables', label: 'میزهای باز', icon: 'armchair' }, { href: '/play', label: 'بازی سریع', icon: 'zap' },
      { href: '/tournaments', label: 'تورنمنت‌ها', icon: 'trophy' }, { href: '/wiki', label: 'دانشنامه', icon: 'book-open' }]],
    ['پروفایل و پیشرفت', [
      { href: '/progress', label: 'پیشرفت', icon: 'star' }, { href: '/ranking', label: 'رتبه‌بندی و لیگ', icon: 'crown' },
      { href: '/me/studio', label: 'استودیو پروفایل', icon: 'palette' }, { href: '/me/avatar', label: 'ساخت آواتار', icon: 'smile' },
      { href: '/me/wardrobe', label: 'کمد من', icon: 'shirt' }]],
    ['اجتماعی', [
      { href: '/friends', label: 'دوستان', icon: 'users', ...(invites ? { count: invites } : {}) }, { href: '/groups', label: 'گروه‌ها', icon: 'message-circle' },
      { href: '/clubs', label: 'باشگاه‌ها', icon: 'flag' }, { href: '/friends?tab=invite', label: 'دعوت از دوستان', icon: 'user-plus' }]],
    ['حساب و کیف پول', [
      { href: '/plans', label: 'اشتراک پریمیوم', icon: 'gem' }, { href: '/coins', label: 'سکه‌ها', icon: 'coins' },
      { href: '/shop', label: 'فروشگاه کازمتیک', icon: 'shopping-bag' }, { href: '/settings', label: 'تنظیمات', icon: 'settings' }]],
    ['کمک', [{ href: '/guides', label: 'راهنما', icon: 'book-open' }, { href: '/support', label: 'پشتیبانی', icon: 'life-buoy' }]]
  ];
  if (me?.roles.some((r) => r === 'moderator' || r === 'admin')) {
    const staff: Tile[] = [{ href: '/mod', label: 'نظارت', icon: 'shield' }];
    if (me.roles.includes('admin')) staff.push({ href: '/admin', label: 'پنل مدیریت', icon: 'settings' });
    groups.push(['مدیریت', staff]);
  }
  return (
    <>
      <h1 className="bgv-sr">بیشتر</h1>
      {me && (
        <a href="/me/profile" className="bgv-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
          <Identity {...userIdentity(me, { size: 'lg', ...(league ? { league } : {}), ...(prog.data ? { level: prog.data.level } : {}) })} style={{ flex: 1 }} />
          <Icon name="chevron-left" />
        </a>
      )}
      {groups.map(([title, items]) => <MoreGroup key={title} title={title} items={items} />)}
      {me ? <Button variant="leave" block onClick={() => void logout()}>خروج از حساب</Button>
        : <Button variant="secondary" block href="/login?next=/more">ورود / ثبت‌نام</Button>}
    </>
  );
}
