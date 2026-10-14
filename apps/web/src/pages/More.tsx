import type { Progression } from '@bg/contracts';
import { Badge, Button, Icon, Identity } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { bestLeague, userIdentity } from '../lib/bgv.tsx';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

type Tile = [href: string, label: string, icon: string];
const GROUPS: [string, Tile[]][] = [
  ['بازی و میز', [['/tables/mine', 'میزهای من', 'dices'], ['/play', 'حریف‌یابی سریع', 'zap'], ['/tournaments', 'تورنمنت‌ها', 'trophy'], ['/wiki', 'دانشنامه', 'book-open']]],
  ['پیشرفت', [['/progress', 'پیشرفت', 'star'], ['/ranking', 'رتبه‌بندی', 'crown']]],
  ['اجتماعی', [['/friends', 'دوستان', 'users'], ['/groups', 'گروه‌ها', 'message-circle'], ['/clubs', 'باشگاه‌ها', 'flag'], ['/friends?tab=invite', 'دعوت از دوستان', 'user-plus']]],
  ['حساب و کیف پول', [['/plans', 'اشتراک ویژه', 'gem'], ['/coins', 'سکه‌ها', 'coins'], ['/shop', 'فروشگاه ظاهر', 'shopping-bag'], ['/settings', 'تنظیمات', 'settings']]],
  ['کمک', [['/guides', 'راهنما', 'book-open'], ['/support', 'پشتیبانی', 'life-buoy']]]
];

/** Mobile overflow navigation: everything that does not fit the five dock slots. */
export function MorePage() {
  usePageTitle('بیشتر');
  const { me, logout } = useSession();
  const groups = [...GROUPS];
  const staff: Tile[] = [];
  if (me?.roles.some((r) => r === 'moderator' || r === 'admin')) staff.push(['/mod', 'نظارت', 'shield']);
  if (me?.roles.includes('admin')) staff.push(['/admin', 'مدیریت', 'settings']);
  if (staff.length) groups.push(['مدیریت', staff]);
  const prog = useApi<Progression>(me ? '/me/progression' : null);
  const league = prog.data ? bestLeague(prog.data.ratings) : null;
  const tables = useApi<{ items: { isMyTurn: boolean }[] }>(me ? '/me/tables' : null);
  const friends = useApi<{ incoming: unknown[] }>(me ? '/me/friends' : null);
  const badge: Record<string, number> = { '/tables/mine': tables.data?.items.filter((t) => t.isMyTurn).length ?? 0, '/friends': friends.data?.incoming.length ?? 0 };
  return (
    <>
      <h1 className="bgv-sr">بیشتر</h1>
      {me && (
        <a href="/me/profile" className="bgv-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
          <Identity {...userIdentity(me, { size: 'lg', ...(league ? { league } : {}), ...(prog.data ? { level: prog.data.level } : {}) })} style={{ flex: 1 }} />
          <Icon name="chevron-left" />
        </a>
      )}
      {groups.map(([title, tiles]) => (
        <section key={title} className="bgv-stack" style={{ gap: 8 }} aria-label={title}>
          <h2 className="bgv-sidebar__group" style={{ padding: '0 4px', margin: 0 }}>{title}</h2>
          <div className="hm-moregrid">
            {tiles.map(([href, label, icon]) => (
              <a key={href} href={href} className="bgv-card hm-moretile"><span className="hm-iconbox"><Icon name={icon} /></span><span>{label}</span>
                {badge[href] ? <Badge tone={href === '/tables/mine' ? 'you' : 'danger'} size="sm" className="hm-moretile__badge">{faNum(badge[href]!)}</Badge> : null}</a>
            ))}
          </div>
        </section>
      ))}
      {me && <Button variant="leave" block onClick={() => void logout()}>خروج از حساب</Button>}
    </>
  );
}
