// Game page (DS v2.4 template, design/reference/html/play/GameDetail-Desktop.html; styles: styles/home-ref.css generated from
// it). Sections: hero, «بازی کن» (open and live tables of this game), «یاد بگیر» (about, how to play from the rules,
// tutorial, questions answered by the game's own policies), «شناسنامه» (numbers, time options, rule variants), «جامعه»
// (your record, the leaderboard, this game's tournaments) and «بازی‌های بیشتر». Everything comes from the code: no data
// from other sites. Blocks the design shows without a data source yet (reviews and ratings, screenshots, designer and
// publisher) are left out until the owner adds a content model (DECISIONS.md).
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { GAME_TAG_FA, type GameDetail, type GameSummary, type HomeOverview, type LiveTableItem, type OpenTableItem, type TournamentSummary } from '@bg/contracts';
import { Avatar, Banner, Breadcrumbs, Button, Icon, League, Skeleton, StateBlock } from '@bg/ui/bgv';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { useSession } from '../lib/session.tsx';
import { userIdentity } from '../lib/bgv.tsx';
import { defaultTime, DIFFICULTY_FA, durationFa, faNum, jalaliDateTime, PACE_FA } from '../lib/format.ts';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { ShelfCard } from './Dashboard.tsx';

type Seat = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
const seatNo = (i: number) => ((i % 10) + 1) as Seat;
const span = (a: number, b: number) => (a === b ? faNum(a) : `${faNum(a)} تا ${faNum(b)}`);
const loginTo = (next: string) => `/login?next=${encodeURIComponent(next)}`;

/** Rules lines; a line starting with "## " opens a titled section (Goal, Setup, Turn, Scoring, End, Tips). */
function sectionsOf(lines: string[]) {
  const out: { title: string | null; items: string[] }[] = [];
  for (const l of lines) {
    if (l.startsWith('## ')) out.push({ title: l.slice(3), items: [] });
    else (out.at(-1) ?? out[out.push({ title: null, items: [] }) - 1]!).items.push(l);
  }
  return out;
}

function Face({ name, avatarKey, seat, size = 'xs' }: { name: string; avatarKey?: string; seat?: Seat; size?: 'xs' | 'sm' | 'md' }) {
  const id = userIdentity({ displayName: name, avatarKey: avatarKey ?? 'meeple' });
  return <Avatar {...id.avatar} initials={id.initials} size={size} {...(seat ? { seat } : {})} />;
}

function BandHead({ id, icon, title, sub, more }: { id: string; icon: string; title: string; sub?: string; more?: [string, string] }) {
  return (
    <div className="gd-bandhead">
      <div className="gd-bandhead__t"><h2 id={id}><Icon name={icon} />{title}</h2>{sub && <p>{sub}</p>}</div>
      {more && <a className="cx-b-more" href={more[1]}>{more[0]}<Icon name="arrow-left" size="sm" /></a>}
    </div>
  );
}

function OpenTile({ t, member }: { t: OpenTableItem; member: boolean }) {
  return (
    <article className="cx-b-tile cx-b-open gd-open" aria-label={`میز ${t.host.displayName}`}>
      <div className="cx-b-row">
        <span className={`gd-mode gd-mode--${t.pace}`}><Icon name={t.pace === 'live' ? 'zap' : 'hourglass'} /></span>
        <div className="cx-b-id">
          <b className="cx-b-name">{PACE_FA[t.pace]}</b>
          <span className="cx-meta"><span className="gd-mi"><Icon name="clock" size="sm" />{durationFa(t.turnSeconds)} هر {t.pace === 'live' ? 'حرکت' : 'نوبت'}</span><span className="bgv-sep" /><span className="gd-mi"><Icon name="users" size="sm" />{faNum(t.capacity)} نفره</span></span>
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
}

function LiveTile({ t, gameId, member }: { t: { id: string; players: string[]; tournament?: string | null }; gameId: string; member: boolean }) {
  return (
    <article className="cx-b-tile cx-b-live cx-e-live gd-live" aria-label="میز زنده">
      <div className="cx-b-row">
        <span className="cx-b-thumb cx-b-thumb--sm"><img className="bgv-box bgv-box--sm" src={`/covers/box/${gameId}.webp`} alt="" loading="lazy" /></span>
        <div className="cx-b-id">
          <b className="cx-b-name">{t.tournament ?? 'میز در جریان'}</b>
          <span className="cx-meta"><span className="gd-mi"><Icon name="users" size="sm" />{faNum(t.players.length)} نفر</span></span>
        </div>
        <span className="bgv-badge bgv-badge--danger bgv-badge--sm"><span className="cx-b-dot" />زنده</span>
      </div>
      <div className="cx-b-turnline"><span className="bgv-avatars">{t.players.slice(0, 4).map((n, i) => <Face key={i} name={n} seat={seatNo(i)} />)}</span></div>
      <div className="cx-b-row cx-b-row--between">
        <Button variant="secondary" icon="eye" href={member ? `/tables/${t.id}` : loginTo(`/tables/${t.id}`)}>تماشا</Button>
      </div>
    </article>
  );
}

export function GameDetailPage() {
  const { id = '' } = useParams();
  const { data: g, error, loading, reload } = useApi<GameDetail>(`/games/${encodeURIComponent(id)}`);
  usePageTitle(g?.nameFa ?? 'صفحه بازی');
  const { me } = useSession();
  const member = !!me;
  const navigate = useNavigate();
  const home = useApi<HomeOverview>('/home');
  const all = useApi<{ items: GameSummary[] }>('/games');
  const openApi = useApi<{ items: OpenTableItem[] }>(me ? `/tables?gameId=${encodeURIComponent(id)}` : null);
  const liveApi = useApi<{ items: LiveTableItem[] }>(me ? `/tables/live?gameId=${encodeURIComponent(id)}` : null);
  const board = useApi<{ items: { rank: number; user: { id: string; displayName: string; avatarKey: string }; rating: number; games: number; league: string | null }[] }>(`/games/${encodeURIComponent(id)}/leaderboard`);
  const tours = useApi<{ items: TournamentSummary[] }>('/tournaments');
  const tutorials = useApi<{ items: { gameId: string; status: string }[] }>(me ? '/me/tutorials' : null);
  const prog = useApi<{ ratings: { gameId: string; mode: string; display: number; gamesPlayed?: number }[] }>(me ? '/me/progression' : null);
  const tutorialStatus = tutorials.data?.items.find((t) => t.gameId === id)?.status;
  const [tutorialBusy, setTutorialBusy] = useState(false);
  const [tutorialError, setTutorialError] = useState<string>();
  const [tab, setTab] = useState('play');
  const startTutorial = async () => {
    if (!me) { navigate(loginTo(`/games/${id}`)); return; }
    setTutorialBusy(true); setTutorialError(undefined);
    try { navigate(`/tables/${(await api<{ tableId: string }>(`/tutorials/${id}/start`, { method: 'POST', body: {} })).tableId}`); }
    catch (e) { setTutorialError(e instanceof ApiFailure ? e.messageFa : 'آموزش شروع نشد.'); }
    finally { setTutorialBusy(false); }
  };

  const crumbs = (last: string) => <Breadcrumbs className="gd-crumbs" items={[{ label: 'بازی‌ها', href: '/games' }, { label: last }]} />;
  if (loading && !g) return <>{crumbs('…')}<Skeleton height={320} radius="var(--radius-lg)" /><span className="bgv-sr" role="status">در حال بارگذاری صفحه بازی…</span></>;
  if (error?.status === 404) return <>{crumbs('بازی پیدا نشد')}<StateBlock kind="empty" title="این بازی پیدا نشد" text="ممکن است نشانی اشتباه باشد یا بازی هنوز منتشر نشده باشد." action={<Button href="/games">همه بازی‌ها</Button>} /></>;
  if (error || !g) return <>{crumbs('خطا')}<StateBlock kind="error" title="صفحه بازی بارگذاری نشد" text={error?.messageFa} action={<Button variant="primary" icon="refresh-cw" onClick={reload}>تلاش دوباره</Button>} /></>;

  const open = member ? openApi.data?.items ?? [] : (home.data?.open ?? []).filter((t) => t.gameId === g.id);
  const openCount = member ? open.length : home.data?.openByGame[g.id] ?? 0;
  const live = member
    ? (liveApi.data?.items ?? []).map((t) => ({ id: t.id, players: t.players, tournament: t.tournament ? `${t.tournament.titleFa}، دور ${faNum(t.tournament.round)}` : null }))
    : (home.data?.live ?? []).filter((t) => t.gameId === g.id).map((t) => ({ id: t.id, players: t.seats.map((s) => s.name), tournament: null }));
  const steps = sectionsOf(g.rulesFa).filter((s) => s.title).slice(0, 5);
  const about = sectionsOf(g.rulesFa)[0];
  const tutorialLabel = tutorialStatus === 'in_progress' ? 'ادامه آموزش تعاملی' : tutorialStatus === 'completed' ? 'اجرای دوباره آموزش' : 'آموزش تعاملی';
  const faqs: [string, string][] = [
    ['اگر وقتم تمام شود چه می‌شود؟', g.timeoutPolicyFa],
    ['اگر وسط بازی میز را ترک کنم؟', g.resignPolicyFa],
    ...(g.botAvailable ? [['می‌توانم با ربات بازی کنم؟', 'بله. در «میز بساز» حالت «با ربات» را انتخاب کنید؛ ربات در سه سطح آسان، متوسط و سخت بازی می‌کند.'] as [string, string]] : []),
    ...(g.competitions.includes('ranked') ? [['میز رتبه‌ای چه فرقی دارد؟', 'میز رتبه‌ای همیشه با قانون رسمی بازی می‌شود و نتیجه‌اش امتیاز لیگ این بازی را تغییر می‌دهد.'] as [string, string]] : [])
  ];
  const myRating = prog.data?.ratings.filter((r) => r.gameId === g.id).sort((a, b) => b.display - a.display)[0];
  const myRank = me ? board.data?.items.find((r) => r.user.id === me.id) : undefined;
  const gameTours = (tours.data?.items ?? []).filter((t) => t.gameId === g.id && t.status !== 'finished');
  const similar = (all.data?.items ?? []).filter((x) => x.id !== g.id && !x.isTestGame)
    .map((x) => ({ x, shared: x.tags.filter((t) => g.tags.includes(t)) })).filter((s) => s.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length).slice(0, 12);
  const TABS: [string, string, string, number | null][] = [
    ['play', 'zap', 'بازی کن', openCount || null], ['learn', 'book-open', 'یاد بگیر', null], ['data', 'list', 'شناسنامه', null],
    ['community', 'users', 'جامعه', board.data?.items.length || null], ['similar', 'layout-grid', 'بازی‌های بیشتر', null]
  ];

  return (
    <div className="cx-gamepage">
      {crumbs(g.nameFa)}
      <section className="L-box L-band--felt gd-a" data-theme="dark" aria-labelledby="gd-h1">
        <span className="gd-box"><img className="bgv-box bgv-box--lg" src={`/covers/box/${g.id}.webp`} alt={`جعبه ${g.nameFa}`} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /></span>
        <div className="gd-a__info">
          <div className="gd-modes" aria-label="حالت‌های بازی">
            {g.paces.map((p) => <span key={p}><Icon name={p === 'live' ? 'zap' : 'hourglass'} size="sm" />{PACE_FA[p]}</span>)}
            {g.competitions.includes('ranked') && <span><Icon name="trophy" size="sm" />رتبه‌ای</span>}
            {g.competitions.includes('friendly') && <span><Icon name="handshake" size="sm" />دوستانه</span>}
            {g.botAvailable && <span><Icon name="bot" size="sm" />با ربات</span>}
          </div>
          <h1 className="gd-name" id="gd-h1">{g.nameFa}<small dir="ltr">{g.nameOriginal}</small></h1>
          <p className="gd-desc gd-just">{g.summaryFa}</p>
          <ul className="gd-stats">
            <li><Icon name="users" /><b>{span(g.minPlayers, g.maxPlayers)}</b><small>نفر</small></li>
            <li><Icon name="clock" /><b>{span(g.minMinutes, g.maxMinutes)}</b><small>دقیقه</small></li>
            <li><Icon name="gauge" /><b>{DIFFICULTY_FA[g.difficulty]}</b><small>سختی</small></li>
            <li className="gd-statli"><a className="gd-statlink" href="#tables"><Icon name="armchair" /><b>{faNum(openCount)}</b><small>میز باز<Icon name="arrow-left" size="sm" /></small></a></li>
          </ul>
        </div>
        <div className="gd-a__acts" data-tour="game-actions">
          {g.acceptingNewTables && <>
            <Button variant="primary" size="lg" icon="zap" href={member ? `/play?game=${g.id}` : loginTo(`/play?game=${g.id}`)}>بازی سریع</Button>
            <Button variant="secondary" size="lg" icon="user-plus" href={member ? `/games/${g.id}/new` : loginTo(`/games/${g.id}/new`)}>میز بساز</Button>
          </>}
          <Button variant="secondary" size="lg" icon="armchair" className="gd-totables" href="#tables">میزهای باز ({faNum(openCount)})</Button>
          {g.tutorialEnabled && <Button variant="secondary" size="lg" icon="book-open" loading={tutorialBusy} onClick={startTutorial}>{tutorialLabel}</Button>}
          <a className="gd-tlink" href="#how"><Icon name="list" size="sm" />قوانین کامل</a>
        </div>
      </section>
      {tutorialError && <p className="bgv-hint bgv-hint--error" role="alert">{tutorialError}</p>}
      {g.isTestGame && <Banner tone="info" text="این بازی اختصاصی و برای آزمون موتور بازی ساخته شده است؛ جزو فهرست نهایی بازی‌های عرضه نیست." />}
      {g.access === 'premium' && <Banner tone="info" text={<>ساخت میز این بازی به اشتراک پریمیوم نیاز دارد. اگر میزبان پریمیوم باشد، دوستانی که دعوت می‌کند می‌توانند بدون اشتراک بازی کنند. <a href="/plans">اشتراک</a></>} />}
      {!g.acceptingNewTables && <Banner tone="warning" text="پذیرش میز جدید برای این بازی موقتاً متوقف است." />}

      <div className="gd-tabsbar">
        <nav className="bgv-tabs" aria-label="بخش‌های صفحه بازی">
          {TABS.map(([k, icon, label, n]) => (
            <a key={k} className={tab === k ? 'bgv-tab is-active' : 'bgv-tab'} href={`#${k}`} aria-current={tab === k ? 'true' : undefined} onClick={() => setTab(k)}>
              <Icon name={icon} size="sm" />{label}{n ? <span className="gd-count">{faNum(n)}</span> : null}
            </a>
          ))}
        </nav>
      </div>

      <section className="gd-band" id="play" aria-labelledby="play-h">
        <BandHead id="play-h" icon="zap" title="بازی کن" sub={`${faNum(openCount)} میز جای خالی دارد و ${faNum(live.length)} بازی همین حالا در جریان است.`} />
        <section className="L-box L-band--felt gd-tbox" id="tables" data-theme="dark" aria-labelledby="tables-h">
          <div className="cx-b-head">
            <div className="cx-b-headtxt">
              <h3 className="cx-b-h2" id="tables-h"><Icon name="armchair" />میزهای باز {g.nameFa}</h3>
              <p className="cx-b-sub">{openCount ? `${faNum(openCount)} میز جای خالی دارد؛ همین حالا سر میز بشینید.` : 'فعلاً میزی منتظر بازیکن نیست؛ میز خودتان را بسازید.'}</p>
            </div>
            <a className="cx-b-more" href={member ? '/tables' : loginTo('/tables')}>همه میزها<Icon name="arrow-left" size="sm" /></a>
          </div>
          <div className="gd-opens gd-opens--4">
            {open.slice(0, 3).map((t) => <OpenTile key={t.id} t={t} member={member} />)}
            {g.acceptingNewTables && (
              <a className="gd-new" href={member ? `/games/${g.id}/new` : loginTo(`/games/${g.id}/new`)}>
                <span className="gd-new__ic"><Icon name="plus" /></span>
                <b>میز خودتان را بسازید</b>
                <small>{g.paces.map((p) => PACE_FA[p]).join(' یا ')}، {span(g.minPlayers, g.maxPlayers)} نفر؛ دوستانتان را با یک لینک دعوت کنید.</small>
              </a>
            )}
          </div>
          {live.length > 0 && (
            <div className="gd-block">
              <div className="gd-subhead"><h3><Icon name="eye" />بازی‌های در جریان</h3><small>تماشا کنید و حرکت‌ها را یاد بگیرید.</small></div>
              <div className="gd-lives gd-lives--3">{live.slice(0, 3).map((t) => <LiveTile key={t.id} t={t} gameId={g.id} member={member} />)}</div>
            </div>
          )}
        </section>
      </section>

      <section className="gd-band" id="learn" aria-labelledby="learn-h">
        <BandHead id="learn-h" icon="book-open" title="یاد بگیر" sub={`${faNum(steps.length)} قدم تا اولین بازی.`} />
        <div className="gd-grid gd-grid--learn">
          <section className="gd-card gd-about">
            <div className="gd-cardhead"><h3 className="gd-h3"><Icon name="info" />درباره {g.nameFa}</h3></div>
            <p className="gd-desc gd-just gd-about__p">{g.summaryFa}</p>
            {about && !about.title && about.items.map((l) => <p key={l} className="gd-just">{l}</p>)}
          </section>
          <div className="gd-stackcol">
            <section className="gd-card" id="how">
              <div className="gd-cardhead"><h3 className="gd-h3"><Icon name="list" />چطور بازی کنیم</h3></div>
              <ol className="gd-steps">
                {steps.map((s, i) => (
                  <li key={s.title} className="gd-step"><span className="gd-step__n">{faNum(i + 1)}</span><b>{s.title}</b>{s.items[0] && <p className="gd-just">{s.items[0]}</p>}</li>
                ))}
              </ol>
            </section>
            {g.tutorialEnabled && (
              <section className="L-box L-band--felt gd-learn" data-theme="dark" aria-labelledby="learn-p">
                <div className="gd-learn__t">
                  <span className="L-kicker"><Icon name="sparkles" size="sm" />اولین بازی؟</span>
                  <h3 id="learn-p">یک دست آموزشی، قبل از میز واقعی</h3>
                  <p className="gd-just">{g.tutorialFa}</p>
                  {/* A link (not a second «آموزش تعاملی» button): the hero button is the one the tests and screen readers find first. */}
                  <div className="gd-ctas"><Button variant="primary" icon="book-open" href="#gd-h1" onClick={(e: React.MouseEvent) => { e.preventDefault(); void startTutorial(); }}>{tutorialLabel}</Button></div>
                </div>
              </section>
            )}
          </div>
        </div>
        <section className="gd-card gd-faq">
          <div className="gd-cardhead"><h3 className="gd-h3"><Icon name="circle-help" />سوال‌های رایج</h3></div>
          <div className="L-faq__list gd-faq2">
            {faqs.map(([q, a], i) => (
              <details key={q} className="L-q gd-q" open={i === 0}><summary>{q}<Icon name="chevron-down" size="sm" /></summary><p className="gd-just">{a}</p></details>
            ))}
          </div>
        </section>
      </section>

      <section className="gd-band" id="data" aria-labelledby="data-h">
        <BandHead id="data-h" icon="list" title="شناسنامه بازی" sub={`مشخصات و زمان‌بندی ${g.nameFa}.`} />
        <div className="gd-grid gd-grid--2">
          <section className="gd-card gd-speccard">
            <div className="gd-cardhead"><h3 className="gd-h3"><Icon name="gauge" />مشخصات بازی</h3></div>
            <dl className="gd-specs">
              <div><small>تعداد نفر</small><b>{span(g.minPlayers, g.maxPlayers)} نفر</b></div>
              <div><small>مدت</small><b>{span(g.minMinutes, g.maxMinutes)} دقیقه</b></div>
              <div><small>سختی</small><b>{DIFFICULTY_FA[g.difficulty]}</b></div>
            </dl>
          </section>
          <section className="gd-card">
            <div className="gd-cardhead"><h3 className="gd-h3"><Icon name="clock" />زمان و قانون‌ها</h3></div>
            <div className="gd-info gd-info--2">
              {g.paces.map((p) => (
                <p key={p} className="gd-just"><b>{PACE_FA[p]}: </b>{(p === 'live' ? g.liveSeconds : g.turnSeconds).map(durationFa).join('، ')}؛ پیش‌فرض {durationFa(defaultTime(p === 'live' ? g.liveSeconds : g.turnSeconds, p))} برای هر {p === 'live' ? 'حرکت' : 'نوبت'}.</p>
              ))}
              {g.options.map((o) => (
                <p key={o.key} className="gd-just"><b>{o.labelFa}: </b>{o.hostChooses && o.choices.length > 1 ? `به انتخاب میزبان (${o.choices.map((c) => c.labelFa).join('، ')})` : o.choices.find((c) => c.value === o.default)?.labelFa}</p>
              ))}
              {g.activeVersion && <p className="gd-just"><b>نسخه قوانین: </b><bdi className="bgv-latin" dir="ltr">{g.activeVersion.rulesVersion}</bdi></p>}
            </div>
          </section>
        </div>
      </section>

      <section className="gd-band" id="community" aria-labelledby="community-h">
        <BandHead id="community-h" icon="users" title="جامعه" sub={`بازیکن‌ها و تورنمنت‌های ${g.nameFa}.`} more={['رتبه‌بندی کامل', '/ranking']} />
        <div className="gd-grid gd-grid--comm">
          <div className="gd-stackcol">
            {me && (
              <section className="gd-card">
                <div className="gd-cardhead"><h3 className="gd-h3"><Icon name="user" />کارنامهٔ شما</h3></div>
                <div className="gd-me"><Face name={me.displayName} avatarKey={me.avatarKey} size="md" /><span className="gd-me__t"><b><bdi>{me.displayName}</bdi></b>{myRank?.league && <League tier={myRank.league as never} />}</span></div>
                <div className="gd-rec gd-rec--2">
                  <div><b>{myRating ? faNum(myRating.display) : '—'}</b><small>امتیاز شما</small></div>
                  <div><b>{myRank ? faNum(myRank.rank) : '—'}</b><small>رتبه شما در {g.nameFa}</small></div>
                </div>
              </section>
            )}
            <section className="gd-card gd-tour">
              <div className="gd-cardhead"><h3 className="gd-h3"><Icon name="trophy" />تورنمنت‌ها</h3></div>
              {gameTours.length ? gameTours.slice(0, 2).map((t) => (
                <p key={t.id} className="gd-just"><a href={`/tournaments/${t.id}`}><b>{t.titleFa}</b></a><span className="bgv-sep" />{jalaliDateTime(t.startsAt)}<span className="bgv-sep" />{faNum(t.entrants)} از {faNum(t.maxEntrants)}</p>
              )) : (
                <div className="gd-empty"><span className="gd-empty__ic"><Icon name="trophy" /></span><span className="gd-empty__t"><b>فعلاً تورنمنت {g.nameFa} نداریم</b><small>تورنمنت‌های همهٔ بازی‌ها در صفحهٔ تورنمنت‌ها هست.</small></span></div>
              )}
              <Button variant="secondary" href="/tournaments">همه تورنمنت‌ها</Button>
            </section>
          </div>
          <section className="gd-card" id="ranking">
            <div className="gd-cardhead"><h3 className="gd-h3"><Icon name="trophy" />برترین‌های {g.nameFa}</h3><span className="gd-unit">امتیاز لیگ</span></div>
            {!board.data ? <Skeleton lines={5} /> : !board.data.items.length ? <p className="gd-just bgv-muted">هنوز کسی به حد نصاب بازی رتبه‌ای در این بازی نرسیده است.</p> : (
              <ol className="gd-lb">
                {board.data.items.slice(0, 6).map((r) => (
                  <li key={r.user.id} className={me && r.user.id === me.id ? 'is-you' : undefined}>
                    <span className="gd-lb__n">{faNum(r.rank)}</span>
                    <span className={`cx-e-face seat-${seatNo(r.rank - 1)}`}>{r.user.displayName.charAt(0)}</span>
                    <span className="gd-lb__name"><bdi>{r.user.displayName}</bdi>{r.league && <League tier={r.league as never} />}</span>
                    <b>{faNum(r.rating)}</b>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </section>

      {similar.length > 0 && (
        <section className="gd-band" id="similar" aria-labelledby="similar-h">
          <BandHead id="similar-h" icon="layout-grid" title="بازی‌های بیشتر" sub="بازی‌های دیگر بردگیم‌ورس که شاید دوست داشته باشید." more={['همه بازی‌ها', '/games']} />
          <div className="gd-similar gd-similar--12">{similar.map(({ x, shared }) => <ShelfCard key={x.id} game={x} why={GAME_TAG_FA[shared[0]!]} />)}</div>
        </section>
      )}
    </div>
  );
}
