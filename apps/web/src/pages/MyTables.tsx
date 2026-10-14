import { useEffect, useState } from 'react';
import type { MyTableItem } from '@bg/contracts';
import { Badge, Button, Card, ChipGroup, Clock, PageHead, Skeleton, StateBlock, Tabs } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { faNum, PACE_FA, remainingFa } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

/** /me/tables, refreshed on every notification and every 30 s (deadlines move). */
export function useMyTables() {
  const tables = useApi<{ items: MyTableItem[] }>('/me/tables');
  const reload = tables.reload;
  useEffect(() => {
    const on = () => reload();
    window.addEventListener('bg:notification', on);
    const t = setInterval(on, 30_000);
    return () => { window.removeEventListener('bg:notification', on); clearInterval(t); };
  }, [reload]);
  return tables;
}

/** Most urgent first: my turn, then nearest deadline. */
export const byUrgency = (a: MyTableItem, b: MyTableItem) =>
  Number(b.isMyTurn) - Number(a.isMyTurn) || (a.deadline ?? '9').localeCompare(b.deadline ?? '9');

export const tableTitle = (t: MyTableItem) => (t.isTutorial ? `آموزش ${t.gameNameFa}` : t.gameNameFa);

/** Deadline as a DS clock chip (calm > 6 h, warn < 6 h, critical < 1 h). */
export function DeadlineClock({ iso }: { iso: string }) {
  const s = Math.max(0, (new Date(iso).getTime() - Date.now()) / 1000);
  return <Clock size="chip" state={s < 3600 ? 'critical' : s < 21600 ? 'warn' : 'calm'} p={Math.min(1, s / 86400)} time={remainingFa(iso)} />;
}

export function Cover({ gameId }: { gameId: string }) {
  return <img className="hm-thumb" src={`/covers/${gameId}.webp?v=2`} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />;
}

export const tableMeta = (t: MyTableItem) =>
  t.status === 'open' ? `${faNum(t.players)} از ${faNum(t.capacity)} نفر` : `${faNum(t.capacity)} نفر`;

function Status({ t }: { t: MyTableItem }) {
  return (
    <div className="bgv-row hm-status" style={{ gap: 8 }}>
      {t.isMyTurn ? <Badge tone="you" icon="zap">نوبت شما</Badge>
        : t.status === 'open' ? <Badge icon="hourglass">در انتظار بازیکن</Badge>
        : t.status === 'paused' ? <Badge icon="pause">متوقف</Badge>
        : t.status === 'finished' ? <Badge icon="flag">تمام‌شده</Badge>
        : <Badge icon="clock">منتظر دیگران</Badge>}
      {t.deadline && t.status === 'active' && <DeadlineClock iso={t.deadline} />}
    </div>
  );
}

type Tab = 'running' | 'finished';
type Filter = 'all' | 'turn' | 'live' | 'open';

export function MyTablesPage() {
  usePageTitle('میزهای من');
  const { me, status } = useSession();
  const tables = useMyTables();
  const [tab, setTab] = useState<Tab>('running');
  const [filter, setFilter] = useState<Filter>('all');

  const all = tables.data?.items ?? [];
  const running = all.filter((t) => t.status !== 'finished' && t.status !== 'cancelled').sort(byUrgency);
  const finished = all.filter((t) => t.status === 'finished');
  const turns = running.filter((t) => t.isMyTurn).length;
  const shown = tab === 'finished' ? finished : running.filter((t) => filter === 'all' || (filter === 'turn' ? t.isMyTurn : filter === 'live' ? t.pace === 'live' && t.status !== 'open' : t.status === 'open'));

  let body;
  if (status !== 'loading' && !me) {
    body = <StateBlock kind="denied" title="برای دیدن میزهای خود وارد شوید" action={<Button variant="primary" href="/login">ورود / ثبت‌نام</Button>} />;
  } else if (tables.error) {
    body = <StateBlock kind="error" title="میزهای شما دریافت نشد" text={tables.error.messageFa} action={<Button onClick={tables.reload}>تلاش دوباره</Button>} />;
  } else if (!tables.data) {
    body = <div style={{ padding: 20 }}><Skeleton lines={4} /></div>;
  } else if (!shown.length) {
    body = <StateBlock kind="empty" title={tab === 'finished' ? 'هنوز میز تمام‌شده‌ای ندارید' : 'میزی منتظر شما نیست'} text="میز بسازید یا به یک میز باز بپیوندید."
      action={<Button href="/games">شروع بازی تازه</Button>} />;
  } else {
    body = (
      <>
        <div className="hm-colhead" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1.5fr) 128px' }}><span>بازی</span><span>وضعیت (به ترتیب فوریت)</span><span /></div>
        <ul className="hm-ul" aria-label="میزهای من">
          {shown.map((t) => (
            <li key={t.id} className={`hm-myrow${t.isMyTurn ? ' is-mine' : ''}`}>
              <div className="hm-cell">
                <Cover gameId={t.gameId} />
                <div><b>{tableTitle(t)}</b><span className="hm-meta">{PACE_FA[t.pace]}<span className="bgv-sep" />{tableMeta(t)}</span></div>
              </div>
              <Status t={t} />
              <div className="hm-act"><Button variant={t.isMyTurn ? 'primary' : 'secondary'} href={`/tables/${t.id}`}>{t.isMyTurn ? 'بازی کن' : 'باز کردن'}</Button></div>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      <PageTabs group="tables" />
      <PageHead title="میزهای من" sub="همه‌ی میزهای در جریان شما، مرتب‌شده بر اساس فوریت؛ و تاریخچه‌ی بازی‌ها." />
      <div className="hm-tabsbar">
        <Tabs label="وضعیت میزها" value={tab} onChange={(v) => setTab(v as Tab)}
          items={[{ value: 'running', label: 'در جریان', count: running.length }, { value: 'finished', label: 'تمام‌شده', count: finished.length }]} />
        <span className="bgv-spacer" />
        {tab === 'running' && (
          <ChipGroup size="sm" label="فیلتر میزها" value={filter} onChange={(v) => setFilter(v as Filter)}
            options={[{ value: 'all', label: 'همه' }, { value: 'turn', label: 'نوبت من', count: turns }, { value: 'live', label: 'زنده' }, { value: 'open', label: 'در انتظار بازیکن' }]} />
        )}
      </div>
      <Card flush>{body}</Card>
    </>
  );
}
