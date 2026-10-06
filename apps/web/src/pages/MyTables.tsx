import { useEffect } from 'react';
import { Link } from 'react-router';
import type { MyTableItem, NotificationItem } from '@bg/contracts';
import { Badge, Button, StateBlock } from '@bg/ui';
import { api, useApi } from '../lib/api.ts';
import { faNum, PACE_FA, remainingFa } from '../lib/format.ts';

/** «نوبت من»: tables waiting on me first, then other running/open tables. Refreshes on notifications. */
export function MyTurnPanel() {
  const tables = useApi<{ items: MyTableItem[] }>('/me/tables');
  const reload = tables.reload;
  useEffect(() => {
    const on = () => reload();
    window.addEventListener('bg:notification', on);
    const t = setInterval(on, 30_000);
    return () => { window.removeEventListener('bg:notification', on); clearInterval(t); };
  }, [reload]);

  if (tables.loading && !tables.data) return <StateBlock kind="loading" title="در حال بارگذاری میزها…" />;
  if (tables.error) return <StateBlock kind="error" title="میزهای شما دریافت نشد" action={<Button onClick={reload}>تلاش دوباره</Button>}>{tables.error.messageFa}</StateBlock>;
  const items = (tables.data?.items ?? []).filter((t) => t.status !== 'finished');
  if (!items.length) {
    return <StateBlock kind="empty" title="میزی منتظر شما نیست" action={<Link className="btn btn--secondary" to="/games">شروع بازی تازه</Link>}>میز بسازید یا به یک میز باز بپیوندید.</StateBlock>;
  }
  const sorted = [...items].sort((a, b) => Number(b.isMyTurn) - Number(a.isMyTurn) || (a.deadline ?? '').localeCompare(b.deadline ?? ''));
  return (
    <ul className="list" aria-label="میزهای من">
      {sorted.map((t) => (
        <li key={t.id} className={`list__item list__item--compact ${t.isMyTurn ? 'list__item--mine' : ''}`}>
          <div style={{ flex: 1, minInlineSize: 0 }}>
            <strong>{t.isTutorial ? `آموزش ${t.gameNameFa}` : t.gameNameFa}</strong>
            <div className="muted">
              {t.status === 'open' ? `در انتظار بازیکن (${faNum(t.players)} از ${faNum(t.capacity)})` : PACE_FA[t.pace]}
              {t.deadline && ` · مهلت: ${remainingFa(t.deadline)}`}
            </div>
          </div>
          {t.isMyTurn ? <Badge tone="success" icon="play">نوبت شما</Badge> : t.status === 'active' ? <Badge icon="clock">منتظر دیگران</Badge> : null}
          <Link className={`btn btn--sm ${t.isMyTurn ? 'btn--primary' : 'btn--secondary'}`} to={`/tables/${t.id}`}>{t.isMyTurn ? 'بازی کنید' : 'باز کردن'}</Link>
        </li>
      ))}
    </ul>
  );
}

export function NotificationsPanel() {
  const n = useApi<{ items: NotificationItem[] }>('/me/notifications');
  const reload = n.reload;
  useEffect(() => {
    window.addEventListener('bg:notification', reload);
    return () => window.removeEventListener('bg:notification', reload);
  }, [reload]);
  const items = n.data?.items ?? [];
  const unread = items.filter((i) => !i.read).length;
  if (n.error) return <p className="muted">اعلان‌ها دریافت نشدند.</p>;
  if (!items.length) return <p className="muted" style={{ margin: 0 }}>اعلانی ندارید.</p>;
  return (
    <div className="stack" style={{ gap: 'var(--sp-2)' }}>
      <ul className="list">
        {items.slice(0, 6).map((i) => (
          <li key={i.id} className="list__item list__item--compact">
            <span style={{ flex: 1, fontWeight: i.read ? 400 : 700 }}>{i.textFa}</span>
            <Link className="btn btn--ghost btn--sm" to={i.href} onClick={() => { void api(`/me/notifications/${i.id}/read`, { method: 'POST' }); }}>باز کردن</Link>
          </li>
        ))}
      </ul>
      {unread > 0 && <Button size="sm" variant="ghost" onClick={async () => { await api('/me/notifications/read', { method: 'POST' }); reload(); }}>علامت‌گذاری همه به‌عنوان خوانده‌شده</Button>}
    </div>
  );
}
