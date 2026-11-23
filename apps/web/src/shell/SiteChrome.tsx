import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import type { ConversationItem, GameSummary, NotificationItem } from '@bg/contracts';
import { AccountMenu, Badge, Button, Conversation, Icon, NotificationItem as Notif, SiteFooter, SiteSearch, StateBlock, Tabs, type SiteSearchResult } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { SITE_LINKS } from '../pages/SitePage.tsx';

/** Persian/Arabic letter variants, ZWNJ and case folded away so «كاتان» and «کاتان» meet. */
const fold = (s: string) => s.toLowerCase().replaceAll('ي', 'ی').replaceAll('ك', 'ک').replace(/[‌\s]+/g, '');

/** Games whose name starts with, contains or (latin) contains the query, in that order; at most six. */
export function searchGames(games: GameSummary[], q: string): GameSummary[] {
  const f = fold(q);
  if (!f) return [];
  const score = (g: GameSummary) => {
    const fa = fold(g.nameFa), en = fold(g.nameOriginal);
    return fa.startsWith(f) ? 0 : fa.includes(f) ? 1 : en.startsWith(f) ? 2 : en.includes(f) ? 3 : -1;
  };
  return games.map((g) => ({ g, s: score(g) })).filter((x) => x.s >= 0).sort((a, b) => a.s - b.s).slice(0, 6).map((x) => x.g);
}

const asResult = (g: GameSummary): SiteSearchResult => ({
  title: g.nameFa, latin: g.nameOriginal, cover: `/covers/box/${g.id}.webp`, href: `/games/${g.id}`, quickHref: `/play?game=${g.id}`,
  meta: [{ icon: 'users', text: `${faNum(g.minPlayers)} تا ${faNum(g.maxPlayers)} نفر` }, { icon: 'clock', text: `${faNum(g.minMinutes)} تا ${faNum(g.maxMinutes)} دقیقه` }]
});

/** Header search (and the phone sheet): games are loaded on first use and filtered here. */
export function HeaderSearch({ sheet, onClose }: { sheet?: boolean; onClose?: () => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const games = useApi<{ items: GameSummary[] }>(open || sheet ? '/games' : null);
  const all = useMemo(() => (games.data?.items ?? []).filter((g) => !g.isTestGame), [games.data]);
  const results = useMemo(() => (q ? searchGames(all, q) : all.slice(0, 6)).map(asResult), [all, q]);
  const empty = q !== '' && results.length === 0;
  const allHref = q.trim() ? `/games?q=${encodeURIComponent(q.trim())}` : '/games';
  // The header popover closes on a click or focus outside it and after navigating (the DS component only closes on Esc).
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (sheet || !open) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('focusin', away);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('focusin', away); };
  }, [open, sheet]);
  // Enter (the phone keyboard's search key) with no row picked: the only match, else every match on the games page.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || !q.trim() || (e.target as HTMLElement).getAttribute('aria-activedescendant')) return;
    e.preventDefault();
    setOpen(false);
    navigate(results.length === 1 && results[0]!.href ? results[0]!.href : allHref);
  };
  return (
    <div ref={box} className="app-search" onKeyDown={onKeyDown}>
      <SiteSearch value={q} onChange={setQ} open={sheet ? true : open} onOpenChange={setOpen} results={results} state={q ? (empty ? 'empty' : 'results') : 'idle'}
        allHref={allHref} {...(sheet ? { sheet: true, ...(onClose ? { onClose } : {}) } : { expand: true })}
        emptyTitle={`بازی‌ای با «${q}» پیدا نشد`} emptyText="نام فارسی یا لاتین بازی را امتحان کنید، یا فهرست همهٔ بازی‌ها را ببینید." />
    </div>
  );
}

/** The DS SiteHeader has no merged inbox, so its messages/notifications icons are off and this one button is placed in the actions row, before the avatar. */
export function InboxButton({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  const [slot] = useState(() => { const el = document.createElement('span'); el.className = 'app-inboxslot'; return el; });
  // The header re-renders its row (quick-play, guest/member): re-attach the slot before the avatar after every render.
  useLayoutEffect(() => {
    const row = document.querySelector('.bgv-siteheader__actions');
    const avatar = row?.querySelector(':scope > .bgv-avatarbtn') ?? null;
    if (row && (slot.parentElement !== row || slot.nextElementSibling !== avatar)) row.insertBefore(slot, avatar);
  });
  useLayoutEffect(() => () => slot.remove(), [slot]);
  return slot && createPortal(
    <button type="button" className="bgv-btn bgv-btn--ghost bgv-btn--icon bgv-iconbtn-count app-inboxbtn" aria-haspopup="menu" aria-expanded={open}
      aria-label={`پیام‌ها و اعلان‌ها${count ? `، ${faNum(count)} خوانده‌نشده` : ''}`} onClick={onToggle} data-tour="nav-messages">
      <Icon name="bell" />{count ? <Badge tone="count">{faNum(count)}</Badge> : null}
    </button>, slot);
}

const hm = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' });
const dm = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', month: 'short', day: 'numeric' });
const stamp = (iso: string) => (Date.now() - new Date(iso).getTime() < 864e5 ? hm.format(new Date(iso)) : dm.format(new Date(iso)));

/** One inbox for the header: two tabs, the latest five of each, and a link to the full page. */
export function InboxPanel({ unreadMessages, unreadNotifications, onClose }: { unreadMessages: number; unreadNotifications: number; onClose: () => void }) {
  const [tab, setTab] = useState<'messages' | 'notifications'>(unreadMessages || !unreadNotifications ? 'messages' : 'notifications');
  const convs = useApi<{ items: ConversationItem[] }>('/me/conversations');
  const notes = useApi<{ items: NotificationItem[] }>('/me/notifications');
  const res = tab === 'messages' ? convs : notes;
  const more = tab === 'messages' ? { href: '/messages', label: 'همهٔ پیام‌ها' } : { href: '/notifications', label: 'همهٔ اعلان‌ها' };
  return (
    <div className="app-accountmenu app-inbox" role="dialog" aria-label="پیام‌ها و اعلان‌ها" onClick={(e) => { if ((e.target as HTMLElement).closest('a')) onClose(); }}>
      <div className="bgv-card app-inbox__card">
        <Tabs label="پیام‌ها و اعلان‌ها" value={tab} onChange={(v) => setTab(v as typeof tab)}
          items={[{ value: 'messages', label: 'پیام‌ها', ...(unreadMessages ? { count: unreadMessages } : {}) }, { value: 'notifications', label: 'اعلان‌ها', ...(unreadNotifications ? { count: unreadNotifications } : {}) }]} />
        <div className="app-inbox__list" role="tabpanel">
          {res.error ? <StateBlock kind="error" title="دریافت نشد" action={<Button size="sm" variant="secondary" icon="refresh-cw" onClick={res.reload}>تلاش دوباره</Button>} />
            : !res.data ? <StateBlock kind="loading" title="در حال بارگذاری…" />
            : tab === 'messages'
              ? (convs.data!.items.length === 0 ? <StateBlock kind="empty" title="هنوز گفت‌وگویی ندارید" />
                : convs.data!.items.slice(0, 5).map((c) => (
                  <Conversation key={c.id} href={`/messages/${c.id}`} name={<bdi>{c.title}</bdi>}
                    {...(c.other ? { initials: c.other.displayName.trim().charAt(0) } : { icon: c.kind === 'club' ? 'shield' : 'users' })}
                    preview={c.lastMessage ? c.lastMessage.body : 'بدون پیام'} time={c.lastMessage ? stamp(c.lastMessage.createdAt) : undefined} unread={c.unreadCount} />)))
              : (notes.data!.items.length === 0 ? <StateBlock kind="empty" title="اعلانی ندارید" />
                : <ul className="app-inbox__notes">{notes.data!.items.slice(0, 5).map((n) => (
                  <Notif key={n.id} as="li" icon="bell" unread={!n.read} title={n.textFa} actions={[{ label: 'باز کردن', variant: 'secondary', size: 'sm', href: n.href }]} />))}</ul>)}
        </div>
        <Button variant="secondary" href={more.href}>{more.label}</Button>
      </div>
    </div>
  );
}

export interface AccountPopoverProps {
  name: string; sub?: string; initials: string; src?: string;
  coins?: number; unreadMessages: number; admin: boolean; staff: boolean;
  onLogout: () => void; onClose: () => void;
}

/** The avatar's menu: the design system's AccountMenu with this app's routes. «خروج» is a link to #logout, handled here. */
export function AccountPopover({ name, sub, initials, src, coins, unreadMessages, admin, staff, onLogout, onClose }: AccountPopoverProps) {
  const items: NonNullable<Parameters<typeof AccountMenu>[0]['items']> = [
    { icon: 'user', label: 'پروفایل من', href: '/me/profile' }, { icon: 'trophy', label: 'پیشرفت و رتبه', href: '/progress' },
    { icon: 'palette', label: 'استودیو پروفایل', href: '/me/studio' }, { icon: 'smile', label: 'ساخت آواتار', href: '/me/avatar' },
    { icon: 'shirt', label: 'کمد من', href: '/me/wardrobe' }, { icon: 'shopping-bag', label: 'فروشگاه کازمتیک', href: '/shop' },
    '-',
    { icon: 'message-circle', label: 'پیام‌ها و دوستان', href: '/messages', key: 'messages' }, { icon: 'users', label: 'باشگاه‌ها و گروه‌ها', href: '/clubs' },
    { icon: 'wallet', label: 'اشتراک و سکه', href: '/plans', key: 'wallet' }, { icon: 'settings', label: 'تنظیمات', href: '/settings' },
    '-',
    { icon: 'book-open', label: 'راهنما', href: '/guides' }, { icon: 'life-buoy', label: 'پشتیبانی', href: '/support' },
    '-',
    ...(staff ? [{ icon: 'shield' as const, label: 'نظارت', href: '/mod' }] : []),
    { icon: 'sliders-horizontal', label: 'پنل مدیریت', href: '/admin', key: 'admin', tag: 'فقط مدیران' },
    { icon: 'log-out', label: 'خروج', href: '#logout' }
  ];
  return (
    <div className="app-accountmenu" onClick={(e) => {
      const a = (e.target as HTMLElement).closest('a');
      if (!a) return;
      if (a.getAttribute('href') === '#logout') { e.preventDefault(); e.stopPropagation(); onLogout(); }
      onClose();
    }}>
      <AccountMenu user={{ name, ...(sub ? { sub } : {}), initials, ...(src ? { src } : {}) }} {...(coins !== undefined ? { coins, coinsHref: '/coins', buyHref: '/coins' } : {})}
        admin={admin} counts={{ messages: unreadMessages }} items={items} />
    </div>
  );
}

/** eNamad trust seal, markup as issued by enamad.ir (the img `code` attribute is part of their snippet). */
export function EnamadSeal() {
  return (
    <a className="app-page__seal" referrerPolicy="origin" target="_blank" rel="noopener" href="https://trustseal.enamad.ir/?id=8074182&Code=zujYLwMpxeZT6OPGu7uoy0mv35gZtFXi" aria-label="نماد اعتماد الکترونیکی (اینماد)">
      <img referrerPolicy="origin" src="https://trustseal.enamad.ir/logo.aspx?id=8074182&Code=zujYLwMpxeZT6OPGu7uoy0mv35gZtFXi" alt="نماد اعتماد الکترونیکی" width={125} height={136} loading="lazy"
        {...{ code: 'zujYLwMpxeZT6OPGu7uoy0mv35gZtFXi' }} />
    </a>
  );
}

/** The Android app on Cafe Bazaar (apps/android, appId ir.boardgameverse.app). */
const BAZAAR_URL = 'https://cafebazaar.ir/app/ir.boardgameverse.app';

/**
 * «همراه ما باشید» in the footer: shown only once the real addresses are configured (VITE_SOCIAL_TELEGRAM /
 * VITE_SOCIAL_INSTAGRAM, full URLs). The design system's own default is a placeholder, which must never go live.
 */
const SOCIAL = ([['send', 'تلگرام', import.meta.env.VITE_SOCIAL_TELEGRAM], ['instagram', 'اینستاگرام', import.meta.env.VITE_SOCIAL_INSTAGRAM]] as [string, string, unknown][])
  .flatMap(([icon, label, href]) => (typeof href === 'string' && /^https:\/\//.test(href)
    ? [{ icon, label, href, handle: href.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '') }] : []));

/** Footer for the public pages only (games, game page, wiki, support, guides, home); never on tables, messages or settings. */
export function PublicFooter() {
  return (
    <SiteFooter logo={{ src: '/brand/logo-fa-reversed.svg' }} storeHref={BAZAAR_URL} seal={<EnamadSeal />} social={SOCIAL.length ? SOCIAL : false}
      columns={[
        { title: 'بازی‌های محبوب', links: [['کاتان آنلاین', '/games/catan'], ['آزول آنلاین', '/games/azul'], ['تیکت تو راید آنلاین', '/games/ticket-to-ride'],
          ['اونو آنلاین', '/games/uno'], ['شطرنج آنلاین', '/games/chess'], ['تخته‌نرد آنلاین', '/games/backgammon']] },
        { title: 'با بردگیم‌ورس', links: [['تورنمنت‌ها', '/tournaments'], ['رتبه‌بندی', '/ranking'], ['باشگاه‌ها', '/clubs'], ['راهنما', '/guides']] },
        { title: 'راهنما و پشتیبانی', links: [['پشتیبانی', '/support'], ...SITE_LINKS.filter(([s]) => s !== 'about').map(([s, label]): [string, string] => [label, `/${s}`])] }
      ]} />
  );
}

/** Pages that show the footer. */
export const hasFooter = (path: string) =>
  path === '/' || path === '/games' || /^\/games\/[^/]+$/.test(path) || path === '/wiki' || path === '/support' || path === '/guides';
