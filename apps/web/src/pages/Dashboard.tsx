// Home page, guest and member (DS v2.4 landing), built 1:1 on the designed markup (design/reference/html/play/Home-Guest.html
// and Home-Member.html; styles: styles/home-ref.css, generated from those files by scripts/home-ref-css.py). Everything shown
// is real data: /home (live and open tables, counts, the week's XP leaders, popularity), /games, /me/tables, /me/daily.
// A block whose data is empty keeps its place and says so instead of showing invented numbers.
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { DailyGame, GameSummary, HomeOverview, MyTableItem, OpenTableItem } from '@bg/contracts';
import { Avatar, Badge, Button, Icon, ModeTag, Skeleton, StateBlock } from '@bg/ui/bgv';
import { useApi } from '../lib/api.ts';
import { faNum, PACE_FA } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { byUrgency, DeadlineClock, useMyTables } from './MyTables.tsx';
import { TableCodeForm } from '../games/TableCode.tsx';

type Seat = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
const seatNo = (i: number) => ((i % 10) + 1) as Seat;
/** «۳ تا ۴ نفر» (the design's wording); one number when both ends match. */
const span = (a: number, b: number, unit: string) => (a === b ? `${faNum(a)} ${unit}` : `${faNum(a)} تا ${faNum(b)} ${unit}`);
const COMPETITION: Record<'friendly' | 'ranked', string> = { friendly: 'دوستانه', ranked: 'رتبه‌ای' };
const timeFa = (pace: 'live' | 'turn', sec: number | null) =>
  sec === null ? PACE_FA[pace] : sec >= 86400 && sec % 86400 === 0 ? `${faNum(sec / 86400)} روز هر نوبت` : sec >= 3600 ? `${faNum(Math.round(sec / 3600))} ساعت هر نوبت`
    : sec >= 60 && sec % 60 === 0 ? `${faNum(sec / 60)} دقیقه هر نوبت` : `${faNum(sec)} ثانیه هر نوبت`;
/** «با سارا» · «با آرش و نیما» · «با رضا، لیلا و ۲ نفر دیگر». */
const withNames = (names: string[]) => (names.length <= 2 ? `با ${names.join(' و ')}` : `با ${names.slice(0, 2).join('، ')} و ${faNum(names.length - 2)} نفر دیگر`);
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000));
const loginTo = (next: string) => `/login?next=${encodeURIComponent(next)}`;

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

/** The game's box (DS v2.4.3 img.bgv-box); our own games (no printed box) get the house box. */
function ShelfBox({ game, alt = '' }: { game: Pick<GameSummary, 'id' | 'nameFa'>; alt?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return <span className="cx-housebox"><img src="/brand/symbol-reversed-small.svg" alt="" /><b>{game.nameFa}</b><i />ساخت بردگیم‌ورس</span>;
  return <img className="bgv-box" src={`/covers/box/${game.id}.webp`} alt={alt} loading="lazy" decoding="async" onError={() => setMissing(true)} />;
}

const Thumb = ({ gameId, small }: { gameId: string; small?: boolean }) => (
  <span className={small ? 'cx-b-thumb cx-b-thumb--sm' : 'cx-b-thumb'}>
    <img className="bgv-box bgv-box--sm" src={`/covers/box/${gameId}.webp`} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
  </span>
);

/** Who can play, under the card (v2.4 tag row): with a bot it links to the new-table page, where «با ربات» is a mode. */
function ModeRow({ game }: { game: GameSummary }) {
  return (
    <div className="T-row">
      {game.botAvailable
        ? <a className="T-tag" href={`/games/${game.id}/new`} aria-label={`${game.nameFa} با ربات`}><ModeTag className="cx-mt" /></a>
        : <span className="T-tag T-tag--static"><ModeTag className="cx-mt" bot={false} /></span>}
    </div>
  );
}

/** Shelf card: box, Persian name with the original, players and time; the mode tag row under it. */
export function ShelfCard({ game, why }: { game: GameSummary; why?: string }) {
  return (
    <div className="T-wrap has-tag">
      <a className="cx-card" href={`/games/${game.id}`}>
        <span className="cx-shelf">
          {why && <span className="gd-why">{why}</span>}
          {game.isTestGame && <span className="cx-flags"><Badge size="sm" tone="test">آزمایشی</Badge></span>}
          <ShelfBox game={game} alt={`جعبهٔ ${game.nameFa}`} />
        </span>
        <span className="cx-card__body">
          <span className="cx-card__name">{game.nameFa}<small dir="ltr">{game.nameOriginal}</small></span>
          <span className="cx-meta"><Icon name="users" size="sm" />{span(game.minPlayers, game.maxPlayers, 'نفر')}<span className="bgv-sep" /><Icon name="clock" size="sm" />{span(game.minMinutes, game.maxMinutes, 'دقیقه')}</span>
        </span>
      </a>
      <ModeRow game={game} />
    </div>
  );
}

/** «بازی‌های دورهمی»: the hand of large boxes. */
function HandCard({ game }: { game: GameSummary }) {
  return (
    <li className="T-wrap has-tag">
      <a className="bv-gc" href={`/games/${game.id}`}>
        <span className="bv-gc__shelf"><ShelfBox game={game} alt={`جعبهٔ ${game.nameFa}`} /></span>
        <span className="bv-gc__body">
          <span className="bv-gc__name">{game.nameFa}<small dir="ltr">{game.nameOriginal}</small></span>
          <span className="bv-gc__meta"><Icon name="users" size="sm" />{span(game.minPlayers, game.maxPlayers, 'نفر')}</span>
          <span className="bv-gc__meta"><Icon name="clock" size="sm" />{span(game.minMinutes, game.maxMinutes, 'دقیقه')}</span>
        </span>
      </a>
      <ModeRow game={game} />
    </li>
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

/** Ordered by tables started this week, then the design's shelf order, then the catalogue. */
const SHOWCASE = ['catan', 'ticket-to-ride', 'azul', 'carcassonne', 'splendor', 'king-of-tokyo'];
export function popularOrder(all: GameSummary[], popular: string[] | undefined) {
  const rank = (id: string) => { const p = popular?.indexOf(id) ?? -1; if (p >= 0) return p; const s = SHOWCASE.indexOf(id); return s >= 0 ? 100 + s : 1000; };
  // Test games (our own prototypes) never lead the shelf, whatever their table count.
  return [...all].sort((a, b) => Number(a.isTestGame) - Number(b.isTestGame) || rank(a.id) - rank(b.id));
}
const isParty = (g: GameSummary) => g.tags.includes('party') || g.maxPlayers >= 5;

// ---------- shared sections ----------

function Popular({ games }: { games: GameSummary[] }) {
  return (
    <section className="cx-b-sec" id="popular" aria-labelledby="pop-h">
      <Head id="pop-h" icon="flame" title="بازی محبوب این هفته" more={['همهٔ بازی‌ها', '/games?sort=popular']} />
      <div className="cx-b-shelf">{games.slice(0, 6).map((g) => <ShelfCard key={g.id} game={g} />)}</div>
    </section>
  );
}

function Party({ games }: { games: GameSummary[] }) {
  if (!games.length) return null;
  return (
    <section className="cx-b-sec" aria-labelledby="party-h">
      <Head id="party-h" icon="users" title="بازی‌های دورهمی" more={['همهٔ بازی‌های دورهمی', '/games?tag=party']} />
      <ul className="bv-hand">{games.slice(0, 8).map((g) => <HandCard key={g.id} game={g} />)}</ul>
    </section>
  );
}

/** «میزهای در حال پر شدن»: public tables with a free seat, on the dark felt band. */
function OpenTables({ items, total, online, games, member }: { items: OpenTableItem[]; total: number; online: number | null; games: GameSummary[]; member: boolean }) {
  return (
    <div className="L-box L-band--felt" data-theme="dark">
      <section className="cx-b-sec" id="filling" aria-labelledby="open-h">
        <Head id="open-h" icon="armchair" title="میزهای در حال پر شدن" sub="این میزها جای خالی دارند؛ همین‌جا سر میز بشین."
          more={total > items.length ? ['همهٔ میزها', member ? '/tables' : loginTo('/tables')] : undefined}
          extra={online !== null && online > 0 ? <span className="cx-d-proofchip"><span><strong>{faNum(online)}</strong> نفر آنلاین</span></span> : undefined} />
        <TableCodeForm />
        {!items.length ? <StateBlock kind="empty" title="الان میزی منتظر بازیکن نیست" text="میز خودت را بساز؛ دیگران همین‌جا آن را می‌بینند." action={<Button href={member ? '/games' : loginTo('/games')}>ساخت میز</Button>} /> : (
          <div className="cx-b-opens">
            {items.map((t) => {
              const g = games.find((x) => x.id === t.gameId);
              return (
                <article key={t.id} className="cx-b-tile cx-b-open" aria-label={`میز ${t.gameNameFa}`}>
                  <div className="cx-b-row">
                    <Thumb gameId={t.gameId} small />
                    <div className="cx-b-id">
                      <b className="cx-b-name">{t.gameNameFa}{g && <small dir="ltr">{g.nameOriginal}</small>}</b>
                      <span className="cx-meta"><Icon name={t.pace === 'live' ? 'zap' : 'hourglass'} size="sm" />{PACE_FA[t.pace]}<span className="bgv-sep" />{timeFa(t.pace, t.turnSeconds)}</span>
                    </div>
                  </div>
                  <div role="group" className="cx-b-seats" aria-label={`${faNum(t.players)} از ${faNum(t.capacity)} صندلی پر`}>
                    <span className="bgv-avatars cx-d-stack">{t.seated.map((s, i) => <Face key={s.id} name={s.name} avatarKey={s.avatarKey} seat={seatNo(i)} size="sm" />)}</span>
                    {Array.from({ length: Math.max(0, t.capacity - t.players) }, (_, i) => <span key={i} className="cx-b-seat0" title="صندلی خالی"><Icon name="plus" size="sm" /></span>)}
                    <span className="cx-b-seatcount">{faNum(t.players)} از {faNum(t.capacity)}</span>
                  </div>
                  <div className="cx-b-row cx-b-row--between">
                    <span className="cx-b-host"><Icon name="crown" size="sm" />میزبان: <bdi>{t.host.displayName}</bdi></span>
                    <Button variant="secondary" icon="armchair" href={member ? `/tables/${t.id}` : loginTo(`/tables/${t.id}`)}>بشین</Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/** «بازی‌های در جریان»: running public tables anyone may watch. */
function LiveTables({ data, member }: { data: HomeOverview | undefined; member: boolean }) {
  return (
    <section className="cx-b-sec" id="live" aria-labelledby="live-h">
      <Head id="live-h" icon="eye" title="بازی‌های در جریان" sub="بازی بقیه را تماشا کن؛ هر وقت خواستی، خودت هم بشین." more={['همهٔ میزهای زنده', member ? '/tables' : loginTo('/tables')]} />
      {!data ? <Skeleton lines={3} /> : !data.live.length ? <StateBlock kind="empty" title="الان بازی‌ای در جریان نیست" text="میز بساز تا اولین بازی در جریان مال تو باشد." action={<Button href={member ? '/games' : loginTo('/games')}>ساخت میز</Button>} /> : (
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
                <Button variant="secondary" icon="eye" href={member ? `/tables/${t.id}` : loginTo(`/tables/${t.id}`)}>تماشا</Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

const TIERS: [string, string][] = [['bronze', 'برنز'], ['silver', 'نقره'], ['gold', 'طلا'], ['platinum', 'پلاتین'], ['diamond', 'الماس'], ['master', 'استاد']];

/** «از برنز تا استاد»: the league ladder and the week's top players (XP this week, all games). */
function LeagueBand({ data, member }: { data: HomeOverview | undefined; member: boolean }) {
  const w = data?.weekly;
  const top = w?.top ?? [];
  const place = (i: number, cls: string, size: 'lg' | 'xl', label: string) => {
    const r = top[i];
    return (
      <div className="bgv-podium__place" role="listitem">
        {i === 0 && <span className="cx-e-crown"><Icon name="crown" /></span>}
        <span className={`cx-e-face cx-e-face--${size}${cls}${r ? ` seat-${i + 1}` : ''}`}>{r ? r.user.displayName.charAt(0) : '؟'}</span>
        <b>{r ? <bdi>{r.user.displayName}</bdi> : '—'}</b>
        <small>{r ? `${faNum(r.points)} امتیاز` : 'هنوز خالی'}</small>
        <span role="img" className="bgv-podium__step" aria-label={label}>{faNum(i + 1)}</span>
      </div>
    );
  };
  const me = w?.me;
  return (
    <section className="L-box L-band--ink" data-theme="dark" aria-labelledby="league-h">
      <div className="L-league">
        <div className="L-league__txt">
          <span className="L-kicker"><Icon name="trophy" size="sm" /> رتبه‌بندی و لیگ</span>
          <h2 className="L-h2" id="league-h">از برنز تا استاد</h2>
          <p className="L-p">هر بازی رتبه‌ای امتیاز لیگ دارد و هر بازی لیگ جدای خودش را دارد. بعد از ۵ بازی رتبه‌ای در این فصل، نشان لیگ کنار اسمت می‌آید.</p>
          <ol className="L-ladder" aria-label="رده‌های لیگ">
            {TIERS.map(([k, fa]) => <li key={k} className={`L-tier L-tier--${k}`}><span className="L-tier__shield" aria-hidden="true" /><b>{fa}</b></li>)}
          </ol>
          <div className="L-ctas">
            <Button variant="primary" size="lg" icon="zap" href={member ? '/play' : loginTo('/play')}>اولین بازی رتبه‌ای</Button>
            <Button variant="secondary" size="lg" href="/ranking">جدول لیگ</Button>
          </div>
        </div>
        <div className="cx-b-tile cx-e-board L-board">
          <div className="L-board__head">
            <b>برترین‌های هفته</b>
            {w && <span className="cx-e-week">{faNum(daysLeft(w.endsAt))} روز تا پایان هفته</span>}
          </div>
          <div className="bgv-podium cx-e-podium" role="list" aria-label="برترین‌های هفته">
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
            <li className="cx-e-rank cx-e-rank--you">
              <span className="cx-e-rank__n">{me?.rank ? faNum(me.rank) : '؟'}</span>
              <span className="cx-e-face cx-e-face--you"><Icon name="user" /></span>
              {me?.rank
                ? <><span className="cx-e-rank__name">رتبهٔ تو<small>{faNum(me.points)} امتیاز این هفته</small></span><b>{faNum(me.points)}</b></>
                : <span className="cx-e-rank__name">جای تو<small>با اولین بازی وارد جدول شو</small></span>}
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function FinalBand({ count, member }: { count: number; member: boolean }) {
  return (
    <section className="L-box L-band--felt L-final" data-theme="dark" aria-labelledby="fin-h">
      <div className="L-final__in">
        <h2 className="L-h2 L-final__h" id="fin-h">میز بازی همیشه آماده است.</h2>
        <p className="L-p">{faNum(count)} بردگیم محبوب، زنده و نوبتی، با دوستانت یا با بقیه.</p>
        <div className="L-ctas">
          {member
            ? <Button variant="primary" size="lg" icon="user-plus" href="/games">ساخت میز با دوستان</Button>
            : <Button variant="primary" size="lg" href="/login">برای بازی همین الان ثبت نام کن</Button>}
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

function GuestHero({ count, home }: { count: number; home: HomeOverview | undefined }) {
  const jump: [string, string, string, string][] = [
    ['#filling', 'armchair', `${faNum(home?.openTables ?? 0)} میز در حال پر شدن`, 'همین الان سر میز بشین'],
    ['#live', 'eye', `${faNum(home?.liveTables ?? 0)} بازی در جریان`, 'ببین چه بازی‌هایی در جریان است'],
    ['#popular', 'flame', `${faNum(count)} بازی`, 'محبوب‌های این هفته']
  ];
  return (
    <section className="bgv-felt cx-b-hero cx-e-hero" aria-labelledby="g-h1">
      <div className="cx-b-hero__txt">
        <h1 id="g-h1" className="cx-e-h1">
          <span className="cx-e-kicker"><img src="/brand/symbol-reversed-small.svg" alt="" />بردگیم آنلاین به فارسی</span>
          <span className="cx-e-display">امشب چی<br />بازی کنیم؟</span>
        </h1>
        <p className="cx-b-hero__sub">{faNum(count)} بردگیم محبوب و آنلاین؛ با دوستانت میز بساز یا هم‌بازی پیدا کن.</p>
        <div className="cx-b-hero__ctas">
          <Button variant="primary" size="lg" icon="zap" href={loginTo('/play')}>بازی سریع</Button>
          <Button variant="secondary" size="lg" icon="user-plus" href={loginTo('/games')}>ساخت میز با دوستان</Button>
        </div>
      </div>
      <div className="cx-e-collage" aria-hidden="true">
        <div className="cx-e-fan">
          {FAN.map(([id, vars, pop]) => <span key={id} className={pop ? 'cx-e-box cx-e-box--pop' : 'cx-e-box'} style={cssVars(vars)}><img className="bgv-box" src={`/covers/box/${id}.webp`} alt="" /></span>)}
        </div>
        {home && home.playingNow > 0 && (
          <span className="cx-e-proof"><span className="cx-b-dot cx-b-dot--ok" /><span><b>{faNum(home.playingNow)}</b> نفر در حال بازی</span></span>
        )}
      </div>
      <nav className="J-row" aria-label="رفتن به بخش‌های صفحه">
        {jump.map(([href, icon, title, sub]) => (
          <a key={href} className="J-tile" href={href}>
            <span className="J-ic"><Icon name={icon} /></span>
            <span><b>{title}</b><small>{sub}</small></span>
            <Icon name="arrow-left" size="sm" />
          </a>
        ))}
      </nav>
    </section>
  );
}

function GuestHome({ all, home }: { all: GameSummary[]; home: HomeOverview | undefined }) {
  const popular = popularOrder(all, home?.popular);
  return (
    <div className="cx-guest">
      <GuestHero count={all.length} home={home} />
      <Popular games={popular} />
      <OpenTables items={home?.open ?? []} total={home?.openTables ?? 0} online={home?.onlineNow ?? null} games={all} member={false} />
      <LiveTables data={home} member={false} />
      <Party games={popular.filter(isParty)} />
      <LeagueBand data={home} member={false} />
      <FinalBand count={all.length} member={false} />
    </div>
  );
}

// ---------- member ----------

const urgency = (iso: string | null) => {
  if (!iso) return null;
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  return s < 3600 ? <Badge size="sm" tone="danger" icon="flame">فوری</Badge> : s < 21600 ? <Badge size="sm" tone="warning" icon="timer">کم‌وقت</Badge> : <Badge size="sm" icon="clock">سر فرصت</Badge>;
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
    <article className="cx-b-tile cx-f-daily" aria-labelledby="daily-h">
      <Thumb gameId={d.gameId} />
      <div className="cx-b-id">
        <span className="cx-f-label"><Icon name="calendar" size="sm" />بازی روز</span>
        <b className="cx-b-name" id="daily-h">{d.gameNameFa}<Badge size="sm" tone="success"><bdi dir="ltr">+{faNum(d.bonusXp)} XP</bdi></Badge></b>
        <span className="cx-f-streak"><span className="cx-b-streak" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <i key={i} className={i < week ? 'is-on' : undefined} />)}</span>{faNum(d.streak)} روز پشت سر هم</span>
      </div>
      <p className="cx-f-daily__txt">{d.doneToday ? 'امروز انجام شد؛ فردا برگرد تا رشته‌ات ادامه پیدا کند.' : `امروز هم یک دست ${g?.nameFa ?? d.gameNameFa} بزن تا رشته‌ات نشکند.`}</p>
      {!d.doneToday && <Button variant="secondary" block icon="play" href={`/games/${d.gameId}`}>بازی کن</Button>}
    </article>
  );
}

function MemberHero({ name, avatarKey, turns, last, all, home }: { name: string; avatarKey: string; turns: number; last: MyTableItem | undefined; all: GameSummary[]; home: HomeOverview | undefined }) {
  // The game to play now: the last one played, else the most popular this week.
  const game = (last && all.find((g) => g.id === last.gameId)) ?? popularOrder(all, home?.popular)[0];
  const q = game ? home?.queues[game.id] : undefined;
  return (
    <section className="bgv-felt cx-f-hero" aria-labelledby="hello-h">
      <div className="cx-f-hello">
        <span className="cx-d-greet"><Face name={name} avatarKey={avatarKey} size="sm" you />سلام <bdi>{name}</bdi>، خوش آمدی</span>
        <h1 id="hello-h" className="cx-d-display">امشب چی بازی کنیم؟</h1>
        <p className="cx-f-sub">{turns > 0 ? <><strong>{faNum(turns)} میز</strong> منتظر حرکت شماست؛ یا یک بازی جدید شروع کن.</> : 'میزی منتظر حرکت شما نیست؛ یک بازی جدید شروع کن.'}</p>
      </div>
      {game && (
        <div className="cx-f-qp" role="group" aria-labelledby="qp-h">
          <span className="cx-f-qp__art" aria-hidden="true"><ShelfBox game={game} /></span>
          <div className="cx-f-qp__body">
            <span className="cx-f-eyebrow">بازی سریع<span className="bgv-sep" />{last ? 'آخرین بازی‌ات' : 'محبوب این هفته'}</span>
            <h2 className="cx-f-qp__name" id="qp-h">{game.nameFa}<small dir="ltr">{game.nameOriginal}</small></h2>
            <span className="cx-f-qp__meta">{last ? `${faNum(last.capacity)} نفره` : span(game.minPlayers, game.maxPlayers, 'نفر')}<span className="bgv-sep" />{last ? PACE_FA[last.pace] : span(game.minMinutes, game.maxMinutes, 'دقیقه')}</span>
          </div>
          {q && (q.searching > 0 || q.seated > 0) && (
            <span className="cx-f-proof cx-d-proof"><span><strong>{faNum(q.searching || q.seated)}</strong> {q.searching > 0 ? `نفر الان دنبال میز ${game.nameFa}‌اند` : `نفر الان سر میز ${game.nameFa}‌اند`}</span></span>
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
  const items = (mine.data?.items ?? []).filter((t) => t.status === 'active' || t.status === 'open').sort(byUrgency);
  const turns = items.filter((t) => t.isMyTurn).length;
  const lastTable = (mine.data?.items ?? []).find((t) => !t.isTutorial);
  const popular = popularOrder(all, home?.popular);
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

      <OpenTables items={home?.open ?? []} total={home?.openTables ?? 0} online={home?.onlineNow ?? null} games={all} member />
      <LiveTables data={home} member />
      <Popular games={popular} />
      <Party games={popular.filter(isParty)} />
      <LeagueBand data={home} member />
      <FinalBand count={all.length} member />
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
