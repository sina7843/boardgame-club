import { useState } from 'react';
import type { DailyGame, GameSummary, OpenTableItem, Presence, PublicProfile } from '@bg/contracts';
import { Badge, Button, Card, Icon, Identity, Skeleton, StateBlock } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliToday, PACE_FA, range } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { presenceLine, usePresence } from '../lib/presence.ts';
import { CoverCollage, FACETS, FacetChips, HowItWorks, inFacet, OpenTablesRow, popularGames, Shelf, TournamentBanner, type Facet } from './HomeSections.tsx';
import { byUrgency, Cover, DeadlineClock, tableMeta, tableTitle, useMyTables } from './MyTables.tsx';

/** «ادامه‌ی یادگیری»: tutorials in progress first, then games not tried yet (up to three cards). */
function KeepLearning({ games }: { games: GameSummary[] | undefined }) {
  const t = useApi<{ items: { gameId: string; status: 'in_progress' | 'completed' | 'skipped' }[] }>('/me/tutorials');
  if (!games || !t.data) return null;
  const status = new Map(t.data.items.map((x) => [x.gameId, x.status]));
  const withTutorial = games.filter((g) => g.tutorialEnabled);
  const picks = [...withTutorial.filter((g) => status.get(g.id) === 'in_progress'), ...withTutorial.filter((g) => !status.has(g.id))].slice(0, 3);
  if (!picks.length) return null;
  return (
    <section className="bgv-stack" style={{ gap: 12 }} aria-labelledby="learn-h">
      <div className="hm-sechead">
        <h2 id="learn-h" className="hm-h2"><Icon name="book-open" />ادامه‌ی یادگیری</h2>
        <a className="hm-link" href="/wiki">دانشنامه<Icon name="chevron-left" size="sm" /></a>
      </div>
      <div className="bgv-grid bgv-grid--sm">
        {picks.map((g) => {
          const going = status.get(g.id) === 'in_progress';
          return (
            <Card key={g.id} className="hm-learn">
              <Cover gameId={g.id} />
              <Badge size="sm">{going ? 'در حال انجام' : 'شروع‌نشده'}</Badge>
              <b>آموزش تعاملی {g.nameFa}</b>
              <Button size="sm" variant={going ? 'primary' : 'secondary'} block href={`/games/${g.id}`}>{going ? 'ادامه' : 'شروع'}</Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

/** «دوستان آنلاین»: online friends first, with watch / invite / message. */
function OnlineFriends({ friends, presence, loaded }: { friends: PublicProfile[]; presence: Record<string, Presence>; loaded: boolean }) {
  if (!loaded) return null;
  const online = friends.filter((x) => presence[x.id]?.online);
  const shown = [...online, ...friends.filter((x) => !presence[x.id]?.online)].slice(0, 5);
  return (
    <Card aria-labelledby="online-h" className="bgv-stack" style={{ gap: 8 }}>
      <div className="hm-sechead"><h2 id="online-h" className="hm-h2"><Icon name="users" />دوستان آنلاین</h2>
        <span className="t-caption bgv-muted">{faNum(online.length)} از {faNum(friends.length)}</span></div>
      {shown.length === 0 ? <StateBlock kind="empty" title="هنوز دوستی ندارید" action={<Button size="sm" href="/friends?tab=find">یافتن بازیکن</Button>} />
        : <ul className="hm-ul">{shown.map((x) => {
          const p = presence[x.id];
          return (
            <li key={x.id} className="hm-friend">
              <Identity {...userIdentity(x, { size: 'sm', ...(p ? { status: p.online ? 'online' as const : 'offline' as const } : {}), ...(presenceLine(p) ? { sub: presenceLine(p) } : {}) })} />
              {p?.playing ? <Button size="sm" variant="ghost" icon="eye" href={`/tables/${p.playing.tableId}`}>تماشا</Button>
                : p?.online ? <Button size="sm" variant="ghost" icon="user-plus" href="/games">دعوت</Button>
                : <Button size="sm" variant="ghost" icon="message-circle" href={`/users/${x.id}`}>پیام</Button>}
            </li>
          );
        })}</ul>}
    </Card>
  );
}

/** Game of the day: picked and rewarded by the server; the card only shows it. */
function DailyCard({ games }: { games: GameSummary[] | undefined }) {
  const daily = useApi<DailyGame>('/me/daily');
  const d = daily.data;
  const g = d?.gameId ? games?.find((x) => x.id === d.gameId) : undefined;
  if (daily.loading && !d) return <Card aria-label="بازی روز"><Skeleton lines={3} /></Card>;
  if (daily.error) return <Card aria-label="بازی روز"><StateBlock kind="error" title="بازی روز بارگذاری نشد" text={daily.error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={daily.reload}>تلاش دوباره</Button>} /></Card>;
  if (!d) return null;
  if (!d.gameId) return <Card aria-label="بازی روز"><StateBlock kind="empty" title="امروز بازی روزی در دسترس نیست" /></Card>;
  const week = Math.min(d.streak, 7);
  return (
    <Card flush as="section" aria-labelledby="daily-h">
      <div className="hm-daily__cover">
        <img src={`/covers/${d.gameId}.webp?v=2`} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        <span className="hm-daily__badge"><Badge tone="info" icon="calendar">بازی روز</Badge></span>
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
  else if (tables.error) body = <StateBlock kind="error" title="میزهای شما دریافت نشد" text={tables.error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={tables.reload}>تلاش دوباره</Button>} />;
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
  usePageTitle('خانه', 'بردگیم آنلاین به فارسی | بردگیم‌ورس');
  const { me, status } = useSession();
  const games = useApi<{ items: GameSummary[] }>('/games');
  const mine = useMyTables();
  const open = useApi<{ items: OpenTableItem[] }>(me ? '/tables' : null);
  const [facet, setFacet] = useState<Facet>('all');
  const running = me ? (mine.data?.items ?? []).filter((t) => t.status === 'active').sort(byUrgency) : [];
  const live = running[0];
  const turns = running.filter((t) => t.isMyTurn).length;
  const fr = useApi<{ friends: PublicProfile[] }>(me ? '/me/friends' : null);
  const friends = fr.data?.friends ?? [];
  const presence = usePresence(friends.map((x) => x.id));
  const all = games.data?.items ?? [];
  const playedIds = [...new Set((mine.data?.items ?? []).map((t) => t.gameId))];
  const playedGames = playedIds.map((id) => all.find((g) => g.id === id)).filter((g) => !!g);
  const last = playedGames[0];
  const popular = popularGames(all, open.data?.items ?? []);
  const quickDuo = all.filter((g) => g.maxPlayers === 2 && g.maxMinutes <= 30);
  const party = all.filter((g) => inFacet(g, 'party'));
  const filtered = all.filter((g) => inFacet(g, facet));
  const facetLabel = FACETS.find(([k]) => k === facet)![1];

  return (
    <>
      <section className={`bgv-hero hm-hero${me && (live || last) ? '' : me ? ' hm-hero--solo' : ''}`} aria-labelledby="hello-h">
        <div className="hm-hero__text">
          {me
            ? <span className="bgv-hero__eyebrow">سلام <bdi>{me.displayName}</bdi>، خوش برگشتی · {jalaliToday()}</span>
            : <span className="bgv-hero__eyebrow">بردگیم آنلاین به فارسی</span>}
          <h1 id="hello-h" className="t-page" style={{ margin: 0 }}>امشب چی بازی کنیم؟</h1>
          <p className="hm-hero__lead">
            {me
              ? (turns > 0 ? `${faNum(turns)} میز منتظر حرکت توست؛ یا همین حالا یک دست سریع بزن.` : 'میز خصوصی بساز و دوستانت را دعوت کن، یا به یک میز عمومی بپیوند.')
              : `${faNum(all.length)} بردگیم محبوب! با دوستانت میز بساز یا حریف تازه پیدا کن.`}
          </p>
          <div className="hm-hero__ctas">
            <Button variant="primary" size="lg" icon="zap" href="/play">بازی سریع</Button>
            <Button size="lg" icon={me ? 'plus' : 'user-plus'} href="/games">{me ? 'ساخت میز' : 'ساخت میز با دوستان'}</Button>
          </div>
          {!me && (
            <>
              <p className="hm-hero__lead" style={{ margin: 0, fontSize: 13 }}><Icon name="lock" size="sm" /> ورود فقط وقتی پشت میز می‌نشینی.</p>
              <ul className="hm-trust"><li><Icon name="check" size="sm" />رایگان</li><li><Icon name="check" size="sm" />بدون نصب</li><li><Icon name="check" size="sm" />زنده و نوبتی</li></ul>
            </>
          )}
        </div>
        {me && live && (
          <div className="hm-plate">
            <div className="bgv-row" style={{ justifyContent: 'space-between' }}>
              <span className="bgv-hero__eyebrow">میز زندهٔ تو</span>
              <Badge size="sm" icon="zap">{PACE_FA[live.pace]}</Badge>
            </div>
            <div className="hm-cell"><Cover gameId={live.gameId} /><div><b style={{ fontSize: 17 }}>{tableTitle(live)}</b><span className="hm-plate__sub">{tableMeta(live)}</span></div></div>
            <div className="bgv-row" style={{ justifyContent: 'space-between', gap: '8px 12px' }}>
              <span className="bgv-row">
                {live.isMyTurn ? <Badge tone="you" icon="zap">نوبت توست</Badge> : <span className="hm-plate__sub">منتظر حرکت دیگران</span>}
                {live.deadline && <DeadlineClock iso={live.deadline} />}
              </span>
              <Button variant="primary" icon="play" href={`/tables/${live.id}`}>برگرد سر میز</Button>
            </div>
          </div>
        )}
        {me && !live && last && (
          <div className="hm-plate hm-last">
            <span className="bgv-hero__eyebrow">بازی سریع · آخرین بازی تو</span>
            <div className="hm-cell"><Cover gameId={last.id} /><div><b style={{ fontSize: 17 }}>{last.nameFa}</b><span className="hm-plate__sub">{range(last.minPlayers, last.maxPlayers, 'نفر')}</span></div></div>
            <div className="bgv-row" style={{ gap: 8 }}>
              <Button variant="primary" icon="zap" href={`/play?game=${last.id}`}>بازی سریع</Button>
              <Button icon="refresh-cw" href="/play">تغییر بازی</Button>
            </div>
          </div>
        )}
        {!me && all.length >= 4 && <CoverCollage games={popular} />}
      </section>

      {me && (
        <div className="bgv-cols">
          <TurnList tables={mine} signedIn loadingSession={status === 'loading'} />
          <DailyCard games={games.data?.items} />
        </div>
      )}

      {me && <OpenTablesRow items={open.data?.items ?? []} />}

      {games.loading && !games.data && <Skeleton lines={3} />}
      {games.error && <StateBlock kind="error" title="بازی‌ها بارگذاری نشدند" text={games.error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={games.reload}>تلاش دوباره</Button>} />}
      {games.data && all.length === 0 && <StateBlock kind="empty" title="هنوز بازی‌ای منتشر نشده است" />}
      {all.length > 0 && (
        <>
          <FacetChips games={all} value={facet} onChange={setFacet} />
          {facet !== 'all'
            ? <Shelf id="facet-h" icon="layout-grid" title={`بازی‌های ${facetLabel}`} games={filtered} limit={12} />
            : (
              <>
                {me && <Shelf id="recent-h" icon="history" title="بازی‌های اخیر تو" games={playedGames} href="/tables/mine" />}
                <Shelf id="popular-h" icon="flame" title="محبوب این هفته" games={popular} />
                {me ? <Shelf id="duo-h" icon="swords" title="دونفره‌های سریع" games={quickDuo} /> : <Shelf id="party-h" icon="users" title="مهمانی و جمعی" games={party} />}
              </>
            )}
        </>
      )}

      <TournamentBanner />

      {me && (
        <div className="bgv-cols">
          <KeepLearning games={games.data?.items} />
          <OnlineFriends friends={friends} presence={presence} loaded={!!fr.data} />
        </div>
      )}

      {!me && <HowItWorks />}
    </>
  );
}
