import { Link } from 'react-router';
import { Icon, type IconName } from '@bg/ui';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

/** Mobile overflow navigation: everything that does not fit the five bottom-bar slots. */
export function MorePage() {
  usePageTitle('بیشتر');
  const { me } = useSession();
  const links: [string, string, IconName][] = [
    ['/tables', 'میزهای باز', 'players'], ['/progress', 'پیشرفت', 'star'], ['/ranking', 'رتبه‌بندی', 'crown'], ['/plans', 'اشتراک', 'card'], ['/friends', 'دوستان', 'user'], ['/groups', 'گروه‌ها', 'players'], ['/clubs', 'باشگاه‌ها', 'crown'],
    ['/settings', 'تنظیمات', 'settings'], ['/support', 'پشتیبانی', 'shield']
  ];
  if (me?.roles.some((r) => r === 'moderator' || r === 'admin')) links.push(['/mod', 'نظارت', 'shield']);
  if (me?.roles.includes('admin')) links.push(['/admin', 'مدیریت', 'settings']);
  return (
    <>
      <div className="page-head"><h1 className="page-title">بیشتر</h1></div>
      <ul className="list">{links.map(([to, label, icon]) => (
        <li key={to}><Link to={to} className="convo"><Icon name={icon} />{label}</Link></li>
      ))}</ul>
    </>
  );
}
