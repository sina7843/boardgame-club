import { Link } from 'react-router';
import { Icon, type IconName } from '@bg/ui';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { SITE_LINKS } from './SitePage.tsx';

/** Mobile overflow navigation: everything that does not fit the five bottom-bar slots. */
export function MorePage() {
  usePageTitle('بیشتر');
  const { me } = useSession();
  const links: [string, string, IconName][] = [
    ['/progress', 'پیشرفت و رتبه', 'star'], ['/plans', 'اشتراک و سکه', 'card'],
    ['/me/profile', 'پروفایل من', 'user'], ['/settings', 'تنظیمات', 'settings'], ['/guides', 'راهنما', 'book'], ['/support', 'پشتیبانی', 'shield'],
    ...SITE_LINKS.map(([s, label]): [string, string, IconName] => [`/${s}`, label, 'book'])
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
