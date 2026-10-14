import type { DailyGame, GameSummary } from '@bg/contracts';
import { Badge, Button, Card, Icon, Skeleton, StateBlock } from '@bg/ui/bgv';
import { GameCard } from '../games/GameCard.tsx';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliToday, PACE_FA, range } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { InviteCard } from '../social/InviteCard.tsx';
import { byUrgency, Cover, DeadlineClock, tableMeta, tableTitle, useMyTables } from './MyTables.tsx';

/** Game of the day: picked and rewarded by the server; the card only shows it. */
function DailyCard({ games }: { games: GameSummary[] | undefined }) {
  const daily = useApi<DailyGame>('/me/daily');
  const d = daily.data;
  const g = d?.gameId ? games?.find((x) => x.id === d.gameId) : undefined;
  if (daily.loading && !d) return <Card aria-label="بازی روز"><Skeleton lines={3} /></Card>;
  if (daily.error) return <Card aria-label="بازی روز"><StateBlock kind="error" title="بازی روز بارگذاری نشد" text={daily.error.messageFa} action={<Button onClick={daily.reload}>تلاش دوباره</Button>} /></Card>;
  if (!d) return null;
  if (!d.gameId) return <Card aria-label="بازی روز"><StateBlock kind="empty" title="امروز بازی روزی در دسترس نیست" /></Card>;
  const week = Math.min(d.streak, 7);
  return (
    <Card flush as="section" aria-labelledby="daily-h">
      <div className="hm-daily__cover">
        <img src={`/covers/${d.gameId}.webp?v=2`} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        <span className="hm-daily__badge"><Badge tone="premium" icon="calendar">بازی روز</Badge></span>
      </div>
      <div className="hm-daily__body">
        <div className="bgv-row" style={{ justifyContent: 'space-between' }}>
          <h2 id="daily-h" className="hm-h2">{d.gameNameFa}{g && <span className="bgv-gamecard__latin">{g.nameOriginal}</span>}</h2>
          <Badge tone="success" icon="sparkles"><bdi dir="ltr">+{faNum(d.bonusXp)} XP</bdi></Badge>
        </div>
        {g && <p className="bgv-muted t-body-sm" style={{ margin: 0 }}>{g.summaryFa}</p>}
        {g && <div className="hm-meta">{range(g.minPlayers, g.maxPlayers, 'نفر')}<span className="bgv-sep" />{range(g.minMinutes, g.maxMinutes, 'دقیقه')}</div>}
        <div className="bgv-row" style={{ gap: '8px 10px' }} aria-label={`رشته: ${faNum(d.streak)} روز`}>
          <Icon name="flame" />
          <span className="hm-streak" aria-hidden>{Array.from({ length: 7 }, (_, i) => <i key={i} className={i < week ? 'is-on' : ''} />)}</span>
          <b className="t-body-sm">رشته‌ی {faNum(d.streak)} روزه</b>
        </div>
        {d.doneToday
          ? <Badge tone="success" icon="circle-check">امروز انجام شد؛ فردا برگردید</Badge>
          : <Button variant="primary" block href={`/games/${d.gameId}`}>بازی کن</Button>}
      </div>
    </Card>
  );
}

function TurnList({ tables, signedIn, loadingSession }: { tables: ReturnType<typeof useMyTables>; signedIn: boolean; loadingSession: boolean }) {
  const items = (tables.data?.items ?? []).filter((t) => t.status !== 'finished' && t.status !== 'cancelled').sort(byUrgency);
  const turns = items.filter((t) => t.isMyTurn).length;
  let body;
  if (loadingSession) body = <div style={{ padding: 20 }}><Skeleton lines={3} /></div>;
  else if (!signedIn) body = <StateBlock kind="denied" title="برای دیدن میزهای خود وارد شوید" text="میزهای نوبتی که منتظر حرکت شما هستند اینجا نمایش داده می‌شوند." action={<Button variant="primary" href="/login">ورود / ثبت‌نام</Button>} />;
  else if (tables.error) body = <StateBlock kind="error" title="میزهای شما دریافت نشد" text={tables.error.messageFa} action={<Button onClick={tables.reload}>تلاش دوباره</Button>} />;
  else if (!tables.data) body = <div style={{ padding: 20 }}><Skeleton lines={3} /></div>;
  else if (!items.length) body = <StateBlock kind="empty" title="میزی منتظر شما نیست" text="میز بسازید یا به یک میز باز بپیوندید." action={<Button href="/games">شروع بازی تازه</Button>} />;
  else body = (
    <ul className="hm-ul" aria-label="میزهای من">
      {items.slice(0, 6).map((t) => (
        <li key={t.id} className={`hm-turnrow${t.isMyTurn ? ' is-mine' : ''}`}>
          <Cover gameId={t.gameId} />
          <div className="hm-tr-info"><b>{tableTitle(t)}</b><span className="hm-meta">{tableMeta(t)}<span className="bgv-sep" />{PACE_FA[t.pace]}</span></div>
          <div className="hm-tr-status">
            <div className="bgv-row">
              {t.isMyTurn ? <Badge tone="you" icon="zap">نوبت شما</Badge> : t.status === 'open' ? <Badge icon="hourglass">در انتظار بازیکن</Badge> : <Badge icon="clock">منتظر دیگران</Badge>}
              {t.deadline && t.status === 'active' && <DeadlineClock iso={t.deadline} />}
            </div>
          </div>
          <Button variant={t.isMyTurn ? 'primary' : 'secondary'} href={`/tables/${t.id}`}>{t.isMyTurn ? 'بازی کن' : 'باز کردن'}</Button>
        </li>
      ))}
    </ul>
  );
  return (
    <Card flush as="section" aria-labelledby="my-turn-h">
      <div className="hm-turnhead">
        <h2 id="my-turn-h" className="hm-h2"><Icon name="hourglass" />نوبت شماست</h2>
        {turns > 0 && <Badge tone="you">{faNum(turns)} میز</Badge>}
        {signedIn && <a className="hm-link" href="/tables/mine">همه‌ی میزهای من<Icon name="chevron-left" size="sm" /></a>}
      </div>
      {body}
    </Card>
  );
}

export function Dashboard() {
  usePageTitle('داشبورد');
  const { me, status } = useSession();
  const games = useApi<{ items: GameSummary[] }>('/games');
  const mine = useMyTables();
  const running = me ? (mine.data?.items ?? []).filter((t) => t.status === 'active').sort(byUrgency) : [];
  const live = running[0];
  const turns = running.filter((t) => t.isMyTurn).length;

  return (
    <>
      <section className={`bgv-hero hm-hero${live ? '' : ' hm-hero--solo'}`} aria-labelledby="hello-h">
        <div className="hm-hero__text">
          <span className="bgv-hero__eyebrow">{jalaliToday()}</span>
          <h1 id="hello-h" className="t-page" style={{ margin: 0 }}>{me ? <>سلام <bdi>{me.displayName}</bdi>! امشب چی بازی کنیم؟</> : 'باشگاه بردگیم'}</h1>
          <p className="hm-hero__lead">{turns > 0 ? `${faNum(turns)} میز نوبتی منتظر حرکت شماست.` : 'میز خصوصی بسازید و دوستان را دعوت کنید، یا به یک میز عمومی بپیوندید.'}</p>
          <div className="hm-hero__ctas">
            <Button variant="primary" size="lg" icon="zap" href="/play">یه میز پیدا کن</Button>
            <Button size="lg" icon="plus" href="/games">میز بساز</Button>
          </div>
        </div>
        {live && (
          <div className="hm-plate">
            <div className="bgv-row" style={{ justifyContent: 'space-between' }}>
              <span className="bgv-hero__eyebrow">میز زنده‌ی شما</span>
              <Badge size="sm" icon="zap">{PACE_FA[live.pace]}</Badge>
            </div>
            <div className="hm-cell"><Cover gameId={live.gameId} /><div><b style={{ fontSize: 17 }}>{tableTitle(live)}</b><span className="hm-plate__sub">{tableMeta(live)}</span></div></div>
            <div className="bgv-row" style={{ justifyContent: 'space-between', gap: '8px 12px' }}>
              <span className="bgv-row">
                {live.isMyTurn ? <Badge tone="you" icon="zap">نوبت شماست</Badge> : <span className="hm-plate__sub">منتظر حرکت دیگران</span>}
                {live.deadline && <DeadlineClock iso={live.deadline} />}
              </span>
              <Button variant="primary" icon="play" href={`/tables/${live.id}`}>برگرد سر میز</Button>
            </div>
          </div>
        )}
      </section>

      <div className="bgv-cols">
        <TurnList tables={mine} signedIn={!!me} loadingSession={status === 'loading'} />
        {me && <DailyCard games={games.data?.items} />}
      </div>

      {me && <InviteCard />}

      <section className="bgv-stack" style={{ gap: 12 }} aria-labelledby="catalog-h">
        <div className="hm-sechead">
          <h2 id="catalog-h" className="hm-h2"><Icon name="sparkles" />بازی‌های کاتالوگ</h2>
          <a className="hm-link" href="/games">همه‌ی بازی‌ها<Icon name="chevron-left" size="sm" /></a>
        </div>
        {games.loading && !games.data && <Skeleton lines={3} />}
        {games.error && <StateBlock kind="error" title="بازی‌ها بارگذاری نشدند" text={games.error.messageFa} action={<Button onClick={games.reload}>تلاش دوباره</Button>} />}
        {games.data && (games.data.items.length === 0
          ? <StateBlock kind="empty" title="هنوز بازی‌ای منتشر نشده است" />
          : <div className="bgv-grid bgv-grid--sm">{games.data.items.slice(0, 4).map((g) => <GameCard key={g.id} game={g} />)}</div>)}
      </section>
    </>
  );
}
