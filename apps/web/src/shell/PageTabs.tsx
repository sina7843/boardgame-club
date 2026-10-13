import { NavLink } from 'react-router';
import { cn } from '@bg/ui';

/** Sibling pages that share one nav entry (e.g. پیشرفت / رتبه‌بندی): route links styled like the Tabs segmented control. */
export const PAGE_GROUPS = {
  games: [['/games', 'بازی‌ها'], ['/wiki', 'دانشنامه']],
  tables: [['/tables', 'میزهای باز'], ['/play', 'حریف‌یابی سریع'], ['/tournaments', 'تورنمنت‌ها']],
  progress: [['/progress', 'پیشرفت'], ['/ranking', 'رتبه‌بندی']],
  social: [['/messages', 'پیام‌ها'], ['/friends', 'دوستان'], ['/groups', 'گروه‌ها'], ['/clubs', 'باشگاه‌ها']],
  wallet: [['/plans', 'اشتراک'], ['/coins', 'سکه‌ها']]
} as const satisfies Record<string, readonly (readonly [string, string])[]>;

export function PageTabs({ group }: { group: keyof typeof PAGE_GROUPS }) {
  return (
    <nav aria-label="بخش‌های مرتبط" className="mb-4">
      <ul className="m-0 inline-flex max-w-full list-none gap-1 overflow-x-auto rounded-[calc(var(--shape-control)+2px)] bg-muted p-1">
        {PAGE_GROUPS[group].map(([to, label]) => (
          <li key={to}>
            <NavLink to={to} end className={({ isActive }) => cn('flex h-10 shrink-0 items-center rounded-control px-4 text-sm whitespace-nowrap no-underline transition-all duration-(--motion) ease-motion',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              isActive ? 'bg-card font-bold text-foreground shadow-control' : 'text-muted-foreground hover:text-foreground')}>{label}</NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
