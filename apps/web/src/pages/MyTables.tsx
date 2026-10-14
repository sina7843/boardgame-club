import { useEffect, useState } from 'react';
import type { MyTableItem } from '@bg/contracts';
import { Avatar, Badge, Button, Card, ChipGroup, Clock, Icon, PageHead, Skeleton, StateBlock, Tabs } from '@bg/ui/bgv';
import { AvatarArt } from '../lib/bgv.tsx';
import { useOnline } from '@bg/ui';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliDate, PACE_FA, remainingFa } from '../lib/format.ts';
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
  const online = useOnline();
  const s = Math.max(0, (new Date(iso).getTime() - Date.now()) / 1000);
  // Offline: the list is not refreshed, so the clock shows the stale state instead of an urgency it cannot confirm.
  return <Clock size="chip" state={!online ? 'stale' : s < 3600 ? 'critical' : s < 21600 ? 'warn' : 'calm'} p={Math.min(1, s / 86400)} time={remainingFa(iso)} />;
}

export function Cover({ gameId }: { gameId: string }) {
  return <img className="hm-thumb" src={`/covers/${gameId}.webp?v=2`} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />;
}

export const tableMeta = (t: MyTableItem) =>
  t.status === 'open' ? `${faNum(t.players)} از ${faNum(t.capacity)} نفر` : `${faNum(t.capacity)} نفر`;

/** My turn with under an hour left: the row turns red and carries «فوری». */
export const isUrgent = (t: MyTableItem) => t.isMyTurn && !!t.deadline && new Date(t.deadline).getTime() - Date.now() < 3600_000;

const seatClass = (seat: number) => `seat-${(seat % 10) + 1}`;
function SeatAvatar({ s, you }: { s: MyTableItem['seats'][number]; you?: boolean }) {
  return <Avatar size="xs" name={s.name} initials={s.name.trim().charAt(0)} className={`${seatClass(s.seat)}${you ? ' is-you' : ''}`}><AvatarArt avatarKey={s.avatarKey} /></Avatar>;
}

export function Players({ t }: { t: MyTableItem }) {
  return (
    <span className="bgv-avatars" aria-label={`بازیکنان: ${t.seats.map((s) => s.name).join('، ')}`}>
      {t.seats.map((s) => <SeatAvatar key={s.seat} s={s} you={s.seat === t.mySeat} />)}
    </span>
  );
}

function Status({ t }: { t: MyTableItem }) {
  const other = !t.isMyTurn && t.status === 'active' ? t.seats.find((s) => t.turnSeats.includes(s.seat)) : undefined;
  return (
    <div className="bgv-row hm-status" style={{ gap: 8 }}>
      {isUrgent(t) && <Badge tone="danger" icon="alarm-clock">فوری</Badge>}
      {t.isMyTurn ? <Badge tone="you" icon="zap">نوبت شما</Badge>
        : t.status === 'open' ? <Badge icon="hourglass">در انتظار بازیکن، {faNum(t.players)} از {faNum(t.capacity)}</Badge>
        : t.status === 'paused' ? <Badge icon="pause">متوقف</Badge>
        : t.status === 'finished' ? <Badge icon="flag">تمام‌شده</Badge>
        : other ? <span className="hm-meta hm-turnof"><SeatAvatar s={other} />نوبت <bdi>{other.name}</bdi></span>
        : <Badge icon="clock">منتظر دیگران</Badge>}
      {t.deadline && t.status === 'active' && (t.isMyTurn || t.pace === 'live')
        ? <DeadlineClock iso={t.deadline} />
        : t.deadline && t.status === 'active' && <Clock size="chip" state="paused" p={1} time={remainingFa(t.deadline)} />}
    </div>
  );
}

const PLACE_FA = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'];
function ResultCell({ r }: { r: NonNullable<MyTableItem['result']> }) {
  const won = r.place === 1;
  const last = r.place === r.fieldSize && r.fieldSize > 1;
  return (
    <div className="hm-res">
      <Badge tone={won ? 'success' : last ? 'danger' : undefined} icon={won ? 'trophy' : last ? 'x' : 'trophy'}>
        {won ? 'برد' : last ? 'باخت' : `نفر ${PLACE_FA[r.place - 1] ?? faNum(r.place)}`}
      </Badge>
      <span className="hm-meta">نفر {faNum(r.place)} از {faNum(r.fieldSize)}</span>
    </div>
  );
}
function Delta({ d }: { d: number | null }) {
  if (d === null) return <span className="hm-delta">بدون اثر بر رتبه</span>;
  return <span className={`hm-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`}><Icon name={d >= 0 ? 'arrow-up-right' : 'arrow-down-right'} size="sm" /><bdi dir="ltr">{d > 0 ? '+' : d < 0 ? '−' : ''}{faNum(Math.abs(d))}</bdi></span>;
}

function History({ items }: { items: MyTableItem[] }) {
  return (
    <section className="hm-hist" aria-labelledby="hist-h">
      <h2 id="hist-h" className="ac-h3 bgv-row" style={{ gap: 8 }}><Icon name="history" />اخیراً تمام‌شده</h2>
      <Card flush>
        <div className="hm-colhead hm-histrow--head"><span>بازی</span><span>نتیجه</span><span>امتیاز رتبه‌ای</span><span>تاریخ</span><span /></div>
        <ul className="hm-ul" aria-label="بازی‌های اخیراً تمام‌شده">
          {items.map((t) => (
            <li key={t.id} className="hm-histrow">
              <div className="hm-cell"><Cover gameId={t.gameId} /><div><b>{tableTitle(t)}</b><span className="hm-meta">{PACE_FA[t.pace]}<span className="bgv-sep" />{faNum(t.capacity)} نفر</span></div></div>
              {t.result ? <ResultCell r={t.result} /> : <span className="hm-meta">بدون نتیجه</span>}
              <Delta d={t.result?.ratingDelta ?? null} />
              <span className="hm-meta">{t.finishedAt ? jalaliDate(t.finishedAt) : ''}</span>
              <div className="bgv-row hm-acts" style={{ gap: 8 }}>
                <Button size="sm" icon="history" href={`/tables/${t.id}`}>بازبینی</Button>
                <Button size="sm" variant="primary" icon="rotate-ccw" href={`/games/${t.gameId}/new`}>یه دست دیگه</Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </section>
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
        <div className="hm-colhead hm-myrow--players"><span>بازی</span><span>بازیکنان</span><span>وضعیت (به ترتیب فوریت)</span><span /></div>
        <ul className="hm-ul" aria-label="میزهای من">
          {shown.map((t) => (
            <li key={t.id} className={`hm-myrow hm-myrow--players${t.isMyTurn ? ' is-mine' : ''}${isUrgent(t) ? ' is-urgent' : ''}`}>
              <div className="hm-cell">
                <Cover gameId={t.gameId} />
                <div><b>{tableTitle(t)}</b><span className="hm-meta">{PACE_FA[t.pace]}<span className="bgv-sep" />{tableMeta(t)}</span></div>
              </div>
              <div className="hm-players"><Players t={t} /></div>
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
      {tab === 'running' && finished.length > 0 && <History items={finished.slice(0, 5)} />}
    </>
  );
}
