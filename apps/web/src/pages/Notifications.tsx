import { useEffect, useState } from 'react';
import type { NotificationItem } from '@bg/contracts';
import { Button, Card, ChipGroup, NotificationItem as Notif, PageHead, Skeleton, StateBlock, Switch } from '@bg/ui/bgv';
import { useToast } from '@bg/ui';
import { api, useApi } from '../lib/api.ts';
import { jalaliDate, jalaliDateTime, faNum } from '../lib/format.ts';
import { browserNotificationsEnabled, setBrowserNotifications } from '../lib/realtime.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

type Kind = NotificationItem['kind'];
type Cat = 'all' | 'turn' | 'invite' | 'message' | 'result' | 'social';
const CAT: Record<Kind, Exclude<Cat, 'all'>> = {
  turn: 'turn', reminder: 'turn', invite: 'invite', match: 'invite', message: 'message', mention: 'message', finished: 'result',
  friend_request: 'social', club: 'social', tournament: 'social', gift: 'social'
};
const ICON: Record<Kind, string> = {
  turn: 'zap', reminder: 'alarm-clock', invite: 'user-plus', match: 'swords', message: 'message-circle', mention: 'message-circle', finished: 'trophy',
  friend_request: 'users', club: 'users', tournament: 'calendar', gift: 'gift'
};
const TONE: Partial<Record<Kind, 'turn' | 'urgent' | 'reward'>> = { turn: 'turn', reminder: 'urgent', finished: 'reward', gift: 'reward' };
const ACTION: Record<Kind, string> = {
  turn: 'ورود به میز', reminder: 'ورود به میز', invite: 'پذیرفتن', match: 'ورود به میز', message: 'پاسخ', mention: 'پاسخ', finished: 'بازبینی',
  friend_request: 'دیدن درخواست', club: 'باز کردن', tournament: 'دیدن تورنمنت', gift: 'دیدن کمد'
};

const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' });
function groupOf(iso: string): string {
  const d = new Date(iso), now = new Date();
  if (day.format(d) === day.format(now)) return 'امروز';
  if (day.format(d) === day.format(new Date(now.getTime() - 86_400_000))) return 'دیروز';
  return 'قدیمی‌تر';
}

const NOTIFICATIONS_READ = 'bg:notifications-read';
const readEvent = () => window.dispatchEvent(new Event(NOTIFICATIONS_READ));

export function NotificationsPage() {
  usePageTitle('اعلان‌ها');
  const toast = useToast();
  const n = useApi<{ items: NotificationItem[] }>('/me/notifications');
  const reload = n.reload;
  const [cat, setCat] = useState<Cat>('all');
  const [browser, setBrowser] = useState(browserNotificationsEnabled());
  useEffect(() => {
    window.addEventListener('bg:notification', reload);
    return () => window.removeEventListener('bg:notification', reload);
  }, [reload]);

  const items = n.data?.items ?? [];
  const unread = items.filter((i) => !i.read).length;
  const count = (c: Cat) => items.filter((i) => c === 'all' || CAT[i.kind] === c).length;
  const shown = items.filter((i) => cat === 'all' || CAT[i.kind] === cat);
  const markRead = async (id: string) => { try { await api(`/me/notifications/${id}/read`, { method: 'POST' }); readEvent(); reload(); } catch { /* the link still works */ } };
  const markAll = async () => { try { await api('/me/notifications/read', { method: 'POST' }); readEvent(); reload(); } catch { toast('error', 'انجام نشد؛ دوباره تلاش کنید.'); } };

  const groups: [string, NotificationItem[]][] = [];
  for (const i of shown) {
    const g = groupOf(i.createdAt);
    const last = groups[groups.length - 1];
    if (last?.[0] === g) last[1].push(i); else groups.push([g, [i]]);
  }

  let list;
  if (n.error) list = <StateBlock kind="error" title="اعلان‌ها دریافت نشدند" text={n.error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={reload}>تلاش دوباره</Button>} />;
  else if (!n.data) list = <div style={{ padding: 20 }}><Skeleton lines={4} /></div>;
  else if (!shown.length) list = <StateBlock kind="empty" icon="bell" title="اعلانی ندارید" text="وقتی نوبت شما شود یا دعوتی برسد، اینجا می‌بینید." action={<Button icon="settings" href="/settings?tab=alerts">تنظیمات اعلان‌ها</Button>} />;
  else list = (
    <ul className="hm-ul">
      {groups.map(([g, rows]) => [
        <li key={`g-${g}`} className="hm-group" role="presentation">{g}</li>,
        ...rows.map((i) => (
          <Notif key={i.id} as="li" className="hm-notif" kind={TONE[i.kind] ?? 'default'} icon={ICON[i.kind]} unread={!i.read}
            title={i.textFa}
            time={<span title={jalaliDate(i.createdAt)}>{jalaliDateTime(i.createdAt)}</span>}
            actions={[
              { label: ACTION[i.kind], variant: i.kind === 'turn' || i.kind === 'reminder' || i.kind === 'invite' ? 'primary' : 'secondary', href: i.href, onClick: () => { if (!i.read) void markRead(i.id); } },
              // Second action per kind (design): decline an invite here, or start the rematch vote from a result.
              ...(i.kind === 'invite' && !i.read ? [{ label: 'رد', variant: 'ghost' as const, onClick: () => void markRead(i.id) }] : []),
              ...(i.kind === 'finished' ? [{ label: 'یه دست دیگه', variant: 'ghost' as const, href: i.href, onClick: () => { if (!i.read) void markRead(i.id); } }] : [])
            ]} />
        ))
      ])}
    </ul>
  );

  return (
    <>
      <PageHead title="اعلان‌ها" sub={unread ? `${faNum(unread)} اعلان خوانده‌نشده` : 'همه‌ی اعلان‌ها خوانده شده‌اند'}
        actions={<>
          <Button variant="ghost" icon="check-check" disabled={!unread} onClick={() => void markAll()}>همه را خوانده کن</Button>
          <Button variant="secondary" icon="settings" href="/settings?tab=alerts">تنظیمات اعلان</Button>
        </>} />
      <ChipGroup scroll label="نوع اعلان" value={cat} onChange={(v) => setCat(v as Cat)}
        options={([['all', 'همه'], ['turn', 'نوبت'], ['invite', 'دعوت'], ['message', 'پیام'], ['result', 'نتیجه'], ['social', 'اجتماعی']] as const).map(([value, label]) => ({ value, label, count: count(value) }))} />
      <div className="bgv-cols">
        <Card flush style={{ overflow: 'hidden' }}>{list}</Card>
        <aside className="bgv-stack">
          <Card title="چطور خبردار شوید">
            <Switch label="اعلان مرورگر" hint="وقتی برگه باز است ولی در پس‌زمینه است. اجازه مرورگر فقط با همین کلید درخواست می‌شود."
              checked={browser} onChange={async (v) => {
                const ok = await setBrowserNotifications(v);
                setBrowser(v && ok);
                if (v && !ok) toast('error', 'مرورگر اجازه اعلان نداد یا پشتیبانی نمی‌کند.');
              }} />
          </Card>
        </aside>
      </div>
    </>
  );
}
