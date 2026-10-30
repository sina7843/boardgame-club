// Home page, guest and member, built 1:1 on the designed markup (design/reference/html/play/Home-Guest.html and
// Home-Member.html; styles: styles/home-ref.css, generated from those files). Everything shown is real data:
// /home (live counts, tables to watch, the week's XP leaders, popularity), /games, /me/tables, /tables, /me/daily,
// /tournaments. A block whose data is empty keeps its place and says so instead of showing invented numbers.
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { DailyGame, GameSummary, HomeOverview, MyTableItem, OpenTableItem, TournamentSummary } from '@bg/contracts';
import { Avatar, Badge, Button, Icon, ModeTag, Skeleton, StateBlock } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliDateTime, PACE_FA } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { byUrgency, DeadlineClock, useMyTables } from './MyTables.tsx';

type Seat = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
const seatNo = (i: number) => ((i % 10) + 1) as Seat;
/** «۳ تا ۴ نفر» (the design's wording); one number when both ends match. */
const span = (a: number, b: number, unit: string) => (a === b ? `${faNum(a)} ${unit}` : `${faNum(a)} تا ${faNum(b)} ${unit}`);
const COMPETITION: Record<'friendly' | 'ranked', string> = { friendly: 'دوستانه', ranked: 'رتبه‌ای' };
const timeFa = (pace: 'live' | 'turn', sec: number | null) =>
  sec === null ? PACE_FA[pace] : sec >= 3600 ? `${faNum(Math.round(sec / 3600))} ساعت هر نوبت` : sec >= 60 && sec % 60 === 0 ? `${faNum(sec / 60)} دقیقه هر نوبت` : `${faNum(sec)} ثانیه هر نوبت`;
/** «با سارا» · «با آرش و نیما» · «با رضا، لیلا و ۲ نفر دیگر». */
const withNames = (names: string[]) => (names.length <= 2 ? `با ${names.join(' و ')}` : `با ${names.slice(0, 2).join('، ')} و ${faNum(names.length - 2)} نفر دیگر`);
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000));

/** A person as the design draws one: initial on a seat colour, or their avatar art. */
function Face({ name, avatarKey, seat, size = 'xs', you }: { name: string; avatarKey?: string; seat?: Seat; size?: 'xs' | 'sm' | 'md' | 'lg'; you?: boolean }) {
  const id = userIdentity({ displayName: name, avatarKey: avatarKey ?? 'meeple' });
  return <Avatar {...id.avatar} initials={id.initials} size={size} {...(seat ? { seat } : {})} {...(you ? { you: true } : {})} />;
}

function Faces({ people, max = 4, size = 'xs' }: { people: { name: string; avatarKey?: string }[]; max?: number; size?: 'xs' | 'sm' }) {
  return (
    <span className="bgv-avatars">
      {people.slice(0, max).map((p, i) => <Face key={i} name={p.name} avatarKey={p.avatarKey} seat={seatNo(i)} size={size} />)}
      {people.length > max && <span className="cx-b-more-av">+{faNum(people.length - max)}</span>}
    </span>
  );
}

/** Box photo on the shelf; our own games (no printed box) get the house box. */
function ShelfBox({ game }: { game: Pick<GameSummary, 'id' | 'nameFa'> }) {
  const [missing, setMissing] = useState(false);
  if (missing) return <span className="cx-housebox"><img src="/brand/symbol-reversed-small.svg" alt="" /><b>{game.nameFa}</b><i />ساخت بردگیم‌ورس</span>;
  return <img src={`/covers/box/${game.id}.webp`} alt="" loading="lazy" decoding="async" onError={() => setMissing(true)} />;
}

const Thumb = ({ gameId, small }: { gameId: string; small?: boolean }) => (
  <span className={small ? 'cx-b-thumb cx-b-thumb--sm' : 'cx-b-thumb'}>
    <img src={`/covers/box/${gameId}.webp`} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
  </span>
);

/** Shelf card: box, Persian name with the original, players and time; online/bot tag for games with a bot. */
function HomeCard({ game, tagsClass }: { game: GameSummary; tagsClass: 'cx-card__tags' | 'cx-flags' }) {
  return (
    <a className="cx-card" href={`/games/${game.id}`}>
      <span className="cx-shelf">
        {game.isTestGame && <span className="cx-flags"><Badge size="sm" tone="test">آزمایشی</Badge></span>}
        <ShelfBox game={game} />
      </span>
      <span className="cx-card__body">
        <span className="cx-card__name">{game.nameFa}<small dir="ltr">{game.nameOriginal}</small></span>
        {game.botAvailable && <span className={tagsClass}><ModeTag aria-label="بازی آنلاین یا با ربات" /></span>}
        <span className="cx-meta">{span(game.minPlayers, game.maxPlayers, 'نفر')}<span className="bgv-sep" />{span(game.minMinutes, game.maxMinutes, 'دقیقه')}</span>
      </span>
    </a>
  );
}

function Head({ title, icon, sub, more, extra, id }: { title: ReactNode; icon?: string; sub?: ReactNode; more?: [string, string]; extra?: ReactNode; id: string }) {
  return (
    <div className="cx-b-head">
      <div className="cx-b-headtxt">
        <h2 id={id} className="cx-b-h2">{icon && <Icon name={icon} />}{title}</h2>
        {sub && <p className="cx-b-sub">{sub}</p>}
      </div>
      {extra}
      {more && <a className="cx-b-more" href={more[1]}>{more[0]}<Icon name="arrow-left" size="sm" /></a>}
    </div>
  );
}

function Shelf({ id, icon, title, games, more, tagsClass }: { id: string; icon: string; title: string; games: GameSummary[]; more: [string, string]; tagsClass: 'cx-card__tags' | 'cx-flags' }) {
  if (!games.length) return null;
  return (
    <section className="cx-b-sec" aria-labelledby={id}>
      <Head id={id} icon={icon} title={title} more={more} />
      <div className="cx-b-shelf">{games.slice(0, 6).map((g) => <HomeCard key={g.id} game={g} tagsClass={tagsClass} />)}</div>
    </section>
  );
}

// ---------- categories ----------

type Facet = 'all' | 'duo' | 'party' | 'bot' | 'team';
const FACETS: [Facet, string, string][] = [['duo', 'دونفره', 'swords'], ['party', 'مهمانی', 'users'], ['bot', 'با ربات', 'bot'], ['team', 'تیمی', 'handshake']];
const inFacet = (g: GameSummary, f: Facet) => f === 'all' || (f === 'duo' && g.maxPlayers === 2) || (f === 'party' && (g.tags.includes('party') || g.maxPlayers >= 5))
  || (f === 'bot' && g.botAvailable) || (f === 'team' && g.tags.includes('cooperative'));

function Categories({ games, liveTables, value, onChange, member }: { games: GameSummary[]; liveTables: number | null; value: Facet; onChange: (f: Facet) => void; member: boolean }) {
  const btn = (key: Facet | 'live', label: string, icon: ReactNode, count: string) => {
    const on = key === value;
    const cls = member ? 'cx-d-pill' : 'cx-e-cat';
    const ic = <span className={member ? 'cx-d-pill__ic' : 'cx-e-cat__ic'}>{icon}</span>;
    if (key === 'live') return <a className={cls} href="/tables">{ic}{label}<small>{count}</small></a>;
    return <button type="button" className={cls} aria-pressed={on} onClick={() => onChange(key)}>{ic}{label}<small>{count}</small></button>;
  };
  const items = [
    btn('all', 'همه', <Icon name="layout-grid" />, faNum(games.length)),
    ...(liveTables !== null ? [btn('live', 'زنده الان', <span className="cx-b-dot" />, `${faNum(liveTables)} میز`)] : []),
    ...FACETS.map(([k, label, icon]) => btn(k, label, <Icon name={icon} />, faNum(games.filter((g) => inFacet(g, k)).length)))
  ];
  if (member) return <div className="cx-d-cats"><div className="cx-d-pills" role="group" aria-label="دسته‌بندی بازی‌ها">{items.map((x, i) => <span key={i} style={{ display: 'contents' }}>{x}</span>)}</div>
    <a className="cx-b-more cx-hide-phone" href="/games">همهٔ بازی‌ها<Icon name="arrow-left" size="sm" /></a></div>;
  return <nav className="cx-b-sec cx-e-catsec" aria-label="دسته‌بندی بازی‌ها"><ul className="cx-e-cats">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></nav>;
}

// ---------- shared blocks ----------

/** «همین حالا در حال بازی»: running public tables anyone may watch. */
function LiveTables({ data, member }: { data: HomeOverview | undefined; member: boolean }) {
  return (
    <section className="cx-b-sec" aria-labelledby="live-h">
      <Head id="live-h" icon="eye" title="همین حالا در حال بازی" sub="ببین چه بازی‌هایی در جریان است؛ هر وقت خواستی، سر میز بعدی بنشین." more={['همهٔ میزهای زنده', '/tables']} />
      {!data ? <Skeleton lines={3} /> : !data.live.length ? <StateBlock kind="empty" title="الان میز زنده‌ای در جریان نیست" text="میز بساز تا اولین بازی در جریان مال تو باشد." action={<Button href="/games">ساخت میز</Button>} /> : (
        <div className="cx-b-lives">
          {data.live.map((t) => (
            <article key={t.id} className="cx-b-tile cx-b-live cx-e-live" aria-label={`میز زندهٔ ${t.gameNameFa}`}>
              <div className="cx-b-row">
                <Thumb gameId={t.gameId} small />
                <div className="cx-b-id">
                  <b className="cx-b-name">{t.gameNameFa}</b>
                  <span className="cx-meta">{COMPETITION[t.competition]}<span className="bgv-sep" />{timeFa(t.pace, t.turnSeconds)}</span>
                </div>
                <span className="bgv-badge bgv-badge--danger bgv-badge--sm"><span className="cx-b-dot" />زنده</span>
              </div>
              <div className="cx-b-turnline">
                <Faces people={t.seats} />
                {t.turnName && <span>نوبت <b><bdi>{t.turnName}</bdi></b></span>}
                {t.deadline && <DeadlineClock iso={t.deadline} />}
              </div>
              <div className="cx-b-row cx-b-row--between">
                <span className="cx-e-watch">{faNum(t.spectators)} تماشاگر</span>
                <Button variant="secondary" icon="eye" href={member ? `/tables/${t.id}` : `/login?next=${encodeURIComponent(`/tables/${t.id}`)}`}>تماشا</Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/** Ordered by tables started this week, then the design's shelf order, then the catalogue. */
const SHOWCASE = ['catan', 'ticket-to-ride', 'azul', 'carcassonne', 'splendor', 'king-of-tokyo'];
function popularOrder(all: GameSummary[], popular: string[] | undefined) {
  const rank = (id: string) => { const p = popular?.indexOf(id) ?? -1; if (p >= 0) return p; const s = SHOWCASE.indexOf(id); return s >= 0 ? 100 + s : 1000; };
  // Test games (our own prototypes) never lead the shelf, whatever their table count.
  return [...all].sort((a, b) => Number(a.isTestGame) - Number(b.isTestGame) || rank(a.id) - rank(b.id));
}

function TournamentBand() {
  const t = useApi<{ items: TournamentSummary[] }>('/tournaments');
  const next = (t.data?.items ?? []).find((x) => x.status === 'open') ?? (t.data?.items ?? []).find((x) => x.status === 'running');
  if (!next) return null;
  const prize = next.prizes[0];
  return (
    <section className="bgv-hero cx-b-tour" aria-labelledby="tour-h">
      <img className="cx-b-tour__art" src={`/covers/${next.gameId}.webp?v=2`} alt="" loading="lazy" />
      <div className="cx-b-tour__body">
        <Badge icon="trophy">{next.status === 'open' ? 'تورنمنت این هفته' : 'تورنمنت در جریان'}</Badge>
        <h2 id="tour-h">{next.titleFa}</h2>
        <p>{faNum(next.maxEntrants)} بازیکن{prize && prize.coins > 0 ? `؛ جایزهٔ اول ${faNum(prize.coins)} سکه` : ''}.</p>
        <div className="cx-b-facts">
          <span className="bgv-felt-plate">{jalaliDateTime(next.startsAt)}</span>
          <span className="bgv-felt-plate"><strong>{faNum(next.entrants)}</strong> از {faNum(next.maxEntrants)} جا پر شده</span>
        </div>
        <div className="cx-b-ctas">
          <Button variant="secondary" size="lg" href={`/tournaments/${next.id}`}>{next.entryKind === 'free' ? 'ثبت‌نام رایگان' : 'جزئیات و ثبت‌نام'}</Button>
          <Button variant="ghost" size="lg" href="/tournaments">همهٔ تورنمنت‌ها</Button>
        </div>
      </div>
    </section>
  );
}

// ---------- guest ----------

/** The design's hero fan: five printed boxes, positions as drawn (desktop) and as a row (phone). */
const FAN: [string, string, boolean][] = [
  ['ticket-to-ride', '--x:4%;--y:12%;--w:32%;--r:6deg;--z:2;--pw:22%;--pr:9deg;--pty:14px;--zp:1', false],
  ['uno', '--x:80%;--y:4%;--w:18%;--r:9deg;--z:2;--pw:21%;--pr:4deg;--pty:4px;--zp:2', true],
  ['catan', '--x:34%;--y:2%;--w:44%;--r:-6deg;--z:3;--pw:36%;--pr:-1deg;--pty:0px;--zp:4', true],
  ['azul', '--x:13%;--y:46%;--w:33%;--r:-4deg;--z:4;--pw:25%;--pr:-4deg;--pty:4px;--zp:3', false],
  ['kingdomino', '--x:50%;--y:50%;--w:30%;--r:5deg;--z:4;--pw:22%;--pr:-9deg;--pty:14px;--zp:1', false]
];
const cssVars = (s: string) => Object.fromEntries(s.split(';').map((d) => d.split(':') as [string, string])) as CSSProperties;

function GuestHero({ count, playing }: { count: number; playing: number | null }) {
  return (
    <section className="bgv-felt cx-b-hero cx-e-hero" aria-labelledby="hello-h">
      <div className="cx-b-hero__txt">
        <h1 id="hello-h" className="cx-e-h1">
          <span className="cx-e-kicker"><img src="/brand/symbol-reversed-small.svg" alt="" />بردگیم آنلاین به فارسی</span>
          <span className="cx-e-display">امشب چی<br />بازی کنیم؟</span>
        </h1>
        <p className="cx-b-hero__sub">{faNum(count)} بردگیم محبوب؛ با دوستانت میز بساز یا حریف تازه پیدا کن</p>
        <div className="cx-b-hero__ctas">
          <Button variant="primary" size="lg" icon="zap" href="/play">بازی سریع</Button>
          <Button variant="secondary" size="lg" icon="user-plus" href="/games">ساخت میز با دوستان</Button>
        </div>
        <span className="cx-b-note"><Icon name="lock" size="sm" />ورود فقط وقتی پشت میز می‌نشینی</span>
        <ul className="cx-b-trust" aria-label="ویژگی‌ها">
          <li><Icon name="check" size="sm" />رایگان</li><li><span className="bgv-sep" /></li><li><Icon name="check" size="sm" />بدون نصب</li><li><span className="bgv-sep" /></li><li><Icon name="check" size="sm" />زنده و نوبتی</li>
        </ul>
      </div>
      <div className="cx-e-collage" aria-hidden>
        <div className="cx-e-fan">
          {FAN.map(([id, vars, pop]) => <span key={id} className={pop ? 'cx-e-box cx-e-box--pop' : 'cx-e-box'} style={cssVars(vars)}><img src={`/covers/box/${id}.webp`} alt="" /></span>)}
        </div>
        {playing !== null && playing > 0 && (
          <span className="cx-e-proof"><span className="cx-b-dot cx-b-dot--ok" /><span><b>{faNum(playing)}</b> نفر همین حالا در حال بازی</span></span>
        )}
      </div>
    </section>
  );
}

function Champions({ data, member }: { data: HomeOverview | undefined; member: boolean }) {
  const w = data?.weekly;
  const top = w?.top ?? [];
  const place = (i: number, cls: string, size: 'lg' | 'xl', label: string) => {
    const r = top[i];
    return (
      <div className="bgv-podium__place">
        {i === 0 && <span className="cx-e-crown"><Icon name="crown" /></span>}
        {r ? <span className={`cx-e-face cx-e-face--${size}${cls} seat-${i + 1}`}>{r.user.displayName.charAt(0)}</span> : <span className={`cx-e-face cx-e-face--${size}${cls}`}>؟</span>}
        <b>{r ? <bdi>{r.user.displayName}</bdi> : '—'}</b>
        <small>{r ? `${faNum(r.points)} امتیاز` : 'هنوز خالی'}</small>
        <span className="bgv-podium__step" aria-label={label}>{faNum(i + 1)}</span>
      </div>
    );
  };
  return (
    <section className="cx-b-sec" aria-labelledby="champs-h">
      <div className="cx-b-tile cx-e-board">
        <div className="cx-e-board__intro">
          <div className="cx-e-board__head">
            <h2 id="champs-h" className="cx-b-h2"><Icon name="trophy" />قهرمان‌های این هفته</h2>
            <a className="cx-b-more" href="/ranking">جدول کامل<Icon name="arrow-left" size="sm" /></a>
          </div>
          <p className="cx-b-sub">امتیاز هفتگی همهٔ بازی‌ها؛ هر شنبه از صفر.</p>
          {w && <span className="cx-e-week"><Icon name="timer" size="sm" />{faNum(daysLeft(w.endsAt))} روز تا پایان هفته</span>}
          <a className="cx-b-more cx-e-board__full" href="/ranking">جدول کامل رتبه‌بندی<Icon name="arrow-left" size="sm" /></a>
        </div>
        <div className="bgv-podium cx-e-podium" aria-label="سه نفر اول هفته">
          {place(1, ' cx-e-face--silver', 'lg', 'نفر دوم')}{place(0, '', 'xl', 'نفر اول')}{place(2, ' cx-e-face--bronze', 'lg', 'نفر سوم')}
        </div>
        <ol className="cx-e-ranks" aria-label="ادامهٔ جدول">
          {top.slice(3, 5).map((r) => (
            <li key={r.user.id} className="cx-e-rank">
              <span className="cx-e-rank__n">{faNum(r.rank)}</span>
              <span className={`cx-e-face seat-${r.rank}`}>{r.user.displayName.charAt(0)}</span>
              <span className="cx-e-rank__name"><bdi>{r.user.displayName}</bdi>{r.games.length > 0 && <small>{r.games.map((g, i) => <span key={g}>{i > 0 && <span className="bgv-sep" />}{g}</span>)}</small>}</span>
              <b>{faNum(r.points)}</b>
            </li>
          ))}
          {!member && (
            <li className="cx-e-rank cx-e-rank--you">
              <span className="cx-e-rank__n">؟</span><span className="cx-e-face cx-e-face--you"><Icon name="user" /></span>
              <span className="cx-e-rank__name">جای تو<small>با اولین بازی وارد جدول شو</small></span>
              <Button variant="secondary" size="sm" href="/login">ورود</Button>
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}

function HowItWorks({ count }: { count: number }) {
  const steps: [string, string, string][] = [
    ['بازی را پیدا کن', `میان ${faNum(count)} بازی جست‌وجو کن یا از قفسه‌ها یکی بردار؛ قوانین هر بازی در یک صفحه آمده است.`, 'search'],
    ['میز بساز یا بنشین', 'پشت یک میز باز بنشین یا میز خودت را بساز؛ ورود فقط همین‌جا لازم می‌شود.', 'armchair'],
    ['دوستانت را دعوت کن', 'لینک میز را در تلگرام یا واتس‌اپ بفرست؛ زنده بازی کنید یا نوبتی در چند روز.', 'user-plus']
  ];
  return (
    <section className="cx-b-sec" aria-labelledby="how-h">
      <Head id="how-h" icon="circle-help" title="چطور کار می‌کند" />
      <ol className="cx-b-steps">
        {steps.map(([title, text, icon], i) => (
          <li key={title} className="cx-b-tile cx-b-step"><span className="cx-b-step__num">{faNum(i + 1)}</span><h3><Icon name={icon} size="sm" />{title}</h3><p>{text}</p></li>
        ))}
      </ol>
    </section>
  );
}

function GuestHome({ all, home }: { all: GameSummary[]; home: HomeOverview | undefined }) {
  const [facet, setFacet] = useState<Facet>('all');
  const popular = popularOrder(all, home?.popular);
  const party = popular.filter((g) => inFacet(g, 'party'));
  return (
    <div className="cx-guest">
      <GuestHero count={all.length} playing={home?.playingNow ?? null} />
      <Categories games={all} liveTables={home?.liveTables ?? null} value={facet} onChange={setFacet} member={false} />
      {facet !== 'all'
        ? <Shelf id="facet-h" icon="layout-grid" title={`بازی‌های ${FACETS.find(([k]) => k === facet)![1]}`} games={popular.filter((g) => inFacet(g, facet))} more={['همه', '/games']} tagsClass="cx-card__tags" />
        : <>
          <LiveTables data={home} member={false} />
          <Shelf id="popular-h" icon="flame" title="محبوب این هفته" games={popular} more={['همه', '/games?sort=popular']} tagsClass="cx-card__tags" />
          <Shelf id="party-h" icon="users" title="مهمانی و جمعی" games={party} more={['همه', '/games?tag=party']} tagsClass="cx-card__tags" />
          <Champions data={home} member={false} />
          <HowItWorks count={all.length} />
        </>}
    </div>
  );
}

// ---------- member ----------

const urgency = (iso: string | null) => {
  if (!iso) return null;
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  return s < 3600 ? <Badge size="sm" tone="danger">فوری</Badge> : s < 21600 ? <Badge size="sm" tone="warning">کم‌وقت</Badge> : <Badge size="sm">سر فرصت</Badge>;
};

function TurnCard({ t }: { t: MyTableItem }) {
  const others = t.seats.filter((s) => s.seat !== t.mySeat);
  return (
    <article className="cx-b-tile cx-b-turn" aria-label={`${t.gameNameFa}، ${t.isMyTurn ? 'نوبت شماست' : 'منتظر دیگران'}`}>
      <Thumb gameId={t.gameId} />
      <div className="cx-b-id">
        <span className="cx-f-turnpill">{t.isMyTurn ? 'نوبت شما' : t.status === 'open' ? 'در انتظار بازیکن' : 'منتظر دیگران'}</span>
        <b className="cx-b-name">{t.isTutorial ? `آموزش ${t.gameNameFa}` : t.gameNameFa}</b>
        <span className="cx-meta">{faNum(t.capacity)} نفره<span className="bgv-sep" />{PACE_FA[t.pace]}</span>
      </div>
      {others.length > 0 && <div className="cx-b-turn__opp"><Faces people={others} max={3} /><span>{withNames(others.map((s) => s.name))}</span></div>}
      {t.lastMove && <p className="cx-b-last"><small>آخرین حرکت</small>{t.lastMove}</p>}
      {t.deadline && t.status === 'active' && <div className="cx-b-turn__clock"><DeadlineClock iso={t.deadline} />{urgency(t.deadline)}</div>}
      <Button variant="secondary" block icon="play" href={`/tables/${t.id}`}>{t.isMyTurn ? 'بازی کن' : 'باز کردن'}</Button>
    </article>
  );
}

function DailyTile({ games }: { games: GameSummary[] }) {
  const daily = useApi<DailyGame>('/me/daily');
  const d = daily.data;
  if (!d?.gameId) return null;
  const g = games.find((x) => x.id === d.gameId);
  const week = Math.min(d.streak, 7);
  return (
    <article className="cx-b-tile cx-f-daily" aria-label="بازی روز">
      <Thumb gameId={d.gameId} />
      <div className="cx-b-id">
        <span className="cx-f-label">بازی روز</span>
        <b className="cx-b-name">{d.gameNameFa}<Badge size="sm" tone="success"><bdi dir="ltr">+{faNum(d.bonusXp)} XP</bdi></Badge></b>
        <span className="cx-f-streak"><span className="cx-b-streak">{Array.from({ length: 7 }, (_, i) => <i key={i} className={i < week ? 'is-on' : undefined} />)}</span>رشتهٔ {faNum(d.streak)} روزه</span>
      </div>
      <p className="cx-f-daily__txt">{d.doneToday ? 'امروز انجام شد؛ فردا برگرد تا رشته‌ات ادامه پیدا کند.' : `هر روز یک بازی تازه؛ امروز یک دست ${g?.nameFa ?? d.gameNameFa} بزن تا رشته‌ات نشکند.`}</p>
      {!d.doneToday && <Button variant="secondary" block href={`/games/${d.gameId}`}>بازی کن</Button>}
    </article>
  );
}

function OpenTables({ items, online }: { items: OpenTableItem[]; online: number | null }) {
  const games = useApi<{ items: GameSummary[] }>('/games').data?.items ?? [];
  return (
    <section className="cx-b-sec" aria-labelledby="open-h">
      <Head id="open-h" icon="armchair" title="میزهای باز همین حالا" sub={`${faNum(items.length)} میز منتظر بازیکن؛ با یک لمس بنشین.`} more={['همهٔ میزها', '/tables']}
        extra={online !== null && online > 0 ? <span className="cx-d-proofchip"><span><strong>{faNum(online)}</strong> نفر همین حالا آنلاین</span></span> : undefined} />
      {!items.length ? <StateBlock kind="empty" title="الان میز بازی منتظر بازیکن نیست" text="میز خودت را بساز؛ دیگران همین‌جا آن را می‌بینند." action={<Button href="/games">ساخت میز</Button>} /> : (
        <div className="cx-b-opens">
          {items.slice(0, 3).map((t) => {
            const g = games.find((x) => x.id === t.gameId);
            return (
              <article key={t.id} className="cx-b-tile cx-b-open" aria-label={`میز ${t.gameNameFa}`}>
                <div className="cx-b-row">
                  <Thumb gameId={t.gameId} small />
                  <div className="cx-b-id">
                    <b className="cx-b-name">{t.gameNameFa}{g && <small dir="ltr">{g.nameOriginal}</small>}</b>
                    <span className="cx-meta">{PACE_FA[t.pace]}<span className="bgv-sep" />{timeFa(t.pace, t.turnSeconds)}</span>
                  </div>
                </div>
                <div className="cx-b-seats" aria-label={`${faNum(t.players)} از ${faNum(t.capacity)} صندلی پر`}>
                  <span className="bgv-avatars cx-d-stack">{t.seated.map((s, i) => <Face key={s.id} name={s.name} avatarKey={s.avatarKey} seat={seatNo(i)} size="sm" />)}</span>
                  {Array.from({ length: Math.max(0, t.capacity - t.players) }, (_, i) => <span key={i} className="cx-b-seat0" />)}
                  <span className="cx-b-seatcount">{faNum(t.players)} از {faNum(t.capacity)}</span>
                </div>
                <div className="cx-b-row cx-b-row--between">
                  <span className="cx-b-host">میزبان: <bdi>{t.host.displayName}</bdi></span>
                  <Button variant="secondary" icon="armchair" href={`/tables/${t.id}`}>بنشین</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WeekBoard({ data, meName }: { data: HomeOverview | undefined; meName: string }) {
  const w = data?.weekly;
  const top = w?.top ?? [];
  const place = (i: number, size?: 'lg') => {
    const r = top[i];
    return (
      <li className="bgv-podium__place">
        {r ? <Face name={r.user.displayName} avatarKey={r.user.avatarKey} seat={seatNo(i)} {...(size ? { size } : { size: 'md' })} /> : <Avatar initials="؟" />}
        <b>{r ? <bdi>{r.user.displayName}</bdi> : '—'}</b>
        <small>{r ? `${faNum(r.points)} امتیاز` : 'هنوز خالی'}</small>
        <span className="bgv-podium__step" aria-label={`رتبهٔ ${faNum(i + 1)}`}>{faNum(i + 1)}</span>
      </li>
    );
  };
  const me = w?.me;
  return (
    <section className="bgv-card cx-d-lb" aria-labelledby="lb-h">
      <div className="cx-d-lb__head"><h2 id="lb-h" className="cx-b-h2"><Icon name="trophy" />برترین‌های هفته</h2><a className="cx-b-more" href="/ranking">جدول کامل<Icon name="arrow-left" size="sm" /></a></div>
      {w && <p className="cx-b-muted" style={{ margin: '-8px 0 0' }}>امتیاز هفتگی همهٔ بازی‌ها<span className="bgv-sep" />{faNum(daysLeft(w.endsAt))} روز تا پایان هفته</p>}
      <ol className="bgv-podium cx-d-podium" aria-label="سه نفر برتر">{place(1)}{place(0, 'lg')}{place(2)}</ol>
      <div className="cx-d-me">
        <Face name={meName} you size="sm" />
        <span className="cx-d-me__id">
          <b>{me?.rank ? `رتبهٔ تو: ${faNum(me.rank)}` : 'هنوز امتیازی این هفته نداری'}</b>
          <small>{faNum(me?.points ?? 0)} امتیاز
            {me?.rank && me.rank > 10 && w?.tenth !== null && w?.tenth !== undefined && <><span className="bgv-sep" />{faNum(Math.max(0, w.tenth - (me.points ?? 0)))} تا رتبهٔ ۱۰</>}</small>
        </span>
      </div>
    </section>
  );
}

function MemberHero({ name, avatarKey, turns, last, all, home }: { name: string; avatarKey: string; turns: number; last: MyTableItem | undefined; all: GameSummary[]; home: HomeOverview | undefined }) {
  // The game to play now: the last one played, else the most popular this week.
  const game = (last && all.find((g) => g.id === last.gameId)) ?? popularOrder(all, home?.popular)[0];
  const q = game ? home?.queues[game.id] : undefined;
  return (
    <section className="bgv-felt cx-f-hero" aria-labelledby="hello-h">
      <div className="cx-f-hello">
        <span className="cx-d-greet"><Face name={name} avatarKey={avatarKey} size="sm" you /><span>سلام <bdi>{name}</bdi>، خوش برگشتی</span></span>
        <h1 id="hello-h" className="cx-d-display">امشب چی بازی کنیم؟</h1>
        <p className="cx-f-sub">{turns > 0 ? <><strong>{faNum(turns)} میز</strong> منتظر حرکت توست؛ یا همین حالا یک دست سریع بزن.</> : 'میزی منتظر حرکتت نیست؛ همین حالا یک دست سریع بزن یا میز بساز.'}</p>
      </div>
      {game && (
        <div className="cx-f-qp">
          <span className="cx-f-qp__art"><ShelfBox game={game} /></span>
          <div className="cx-f-qp__body">
            <span className="cx-f-eyebrow">بازی سریع<span className="bgv-sep" />{last ? 'آخرین بازی‌ات' : 'محبوب این هفته'}</span>
            <h2 className="cx-f-qp__name">{game.nameFa}<small dir="ltr">{game.nameOriginal}</small></h2>
            <span className="cx-f-qp__meta">{last ? `${faNum(last.capacity)} نفره` : span(game.minPlayers, game.maxPlayers, 'نفر')}<span className="bgv-sep" />{last ? PACE_FA[last.pace] : span(game.minMinutes, game.maxMinutes, 'دقیقه')}</span>
          </div>
          {q && (q.searching > 0 || q.seated > 0) && (
            <span className="cx-f-proof cx-d-proof"><span><strong>{faNum(q.searching || q.seated)}</strong> {q.searching > 0 ? `نفر همین حالا دنبال میز ${game.nameFa}‌اند` : `نفر همین حالا سر میز ${game.nameFa}‌اند`}</span></span>
          )}
          <div className="cx-f-qp__ctas">
            <Button variant="primary" size="lg" icon="zap" href={`/play?game=${game.id}`}>بازی سریع</Button>
            <Button variant="secondary" size="lg" icon="refresh-cw" href="/play">تغییر بازی</Button>
            <Button variant="ghost" size="lg" icon="plus" className="cx-f-create" href={`/games/${game.id}/new`}>ساخت میز</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function MemberHome({ all, home }: { all: GameSummary[]; home: HomeOverview | undefined }) {
  const { me } = useSession();
  const mine = useMyTables();
  const open = useApi<{ items: OpenTableItem[] }>('/tables');
  const [facet, setFacet] = useState<Facet>('all');
  const items = (mine.data?.items ?? []).filter((t) => t.status === 'active' || t.status === 'open').sort(byUrgency);
  const turns = items.filter((t) => t.isMyTurn).length;
  const played = [...new Set((mine.data?.items ?? []).map((t) => t.gameId))].map((id) => all.find((g) => g.id === id)).filter((g): g is GameSummary => !!g);
  const lastTable = (mine.data?.items ?? []).find((t) => !t.isTutorial);
  const popular = popularOrder(all, home?.popular);
  const duo = popular.filter((g) => g.maxPlayers === 2 && g.maxMinutes <= 30);
  if (!me) return null;
  return (
    <div className="cx-member">
      <MemberHero name={me.displayName} avatarKey={me.avatarKey} turns={turns} last={lastTable} all={all} home={home} />

      <section className="cx-b-sec" aria-labelledby="turn-h">
        <Head id="turn-h" icon="hourglass" title={<>نوبت شماست{turns > 0 && <span className="cx-f-turnpill cx-f-turnpill--count">{faNum(turns)}</span>}</>} more={['همهٔ میزهای من', '/tables/mine']} />
        <div className="cx-b-band cx-f-band">
          {mine.loading && !mine.data ? <Skeleton lines={3} />
            : items.length ? items.slice(0, 3).map((t) => <TurnCard key={t.id} t={t} />)
              : <article className="cx-b-tile"><StateBlock kind="empty" title="میزی منتظر شما نیست" text="میز بسازید یا به یک میز باز بپیوندید." action={<Button href="/games">شروع بازی تازه</Button>} /></article>}
          <DailyTile games={all} />
        </div>
      </section>

      <OpenTables items={open.data?.items ?? []} online={home?.onlineNow ?? null} />

      <div className="cx-d-browse">
        <Categories games={all} liveTables={home?.liveTables ?? null} value={facet} onChange={setFacet} member />
        {facet !== 'all'
          ? <Shelf id="facet-h" icon="layout-grid" title={`بازی‌های ${FACETS.find(([k]) => k === facet)![1]}`} games={popular.filter((g) => inFacet(g, facet))} more={['همه', '/games']} tagsClass="cx-flags" />
          : <>
            <Shelf id="recent-h" icon="history" title="بازی‌های اخیر تو" games={played} more={['همه', '/tables/mine']} tagsClass="cx-flags" />
            <Shelf id="popular-h" icon="flame" title="محبوب این هفته" games={popular} more={['همه', '/games?sort=popular']} tagsClass="cx-flags" />
            <Shelf id="duo-h" icon="swords" title="دونفره‌های سریع" games={duo} more={['همه', '/games?players=2']} tagsClass="cx-flags" />
          </>}
      </div>

      <div className="cx-b-feature">
        <TournamentBand />
        <WeekBoard data={home} meName={me.displayName} />
      </div>
    </div>
  );
}

export function Dashboard() {
  usePageTitle('خانه', 'بردگیم آنلاین به فارسی | بردگیم‌ورس');
  const { me, status } = useSession();
  const games = useApi<{ items: GameSummary[] }>('/games');
  const home = useApi<HomeOverview>('/home');
  const all = games.data?.items ?? [];
  if (status === 'loading' || (games.loading && !games.data)) return <Skeleton lines={6} />;
  if (games.error) return <StateBlock kind="error" title="بازی‌ها بارگذاری نشدند" text={games.error.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={games.reload}>تلاش دوباره</Button>} />;
  return me ? <MemberHome all={all} home={home.data} /> : <GuestHome all={all} home={home.data} />;
}
