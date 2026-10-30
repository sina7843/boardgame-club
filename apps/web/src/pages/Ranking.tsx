import { useState } from 'react';
import { Avatar, Badge, Button, Chip, DataTable, Icon, Identity, League, PageHead, Segmented, Select, StateBlock, TextField } from '@bg/ui/bgv';
import { RATING_MODE_FA, type League as LeagueTier, type PublicProfile, type RatingMode } from '@bg/contracts';
import { useApi } from '../lib/api.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { faNum, jalaliDate } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

interface Board { season: { id: string; nameFa: string; status: string } | null; rules: { minGames: number; maxSigma: number };
  items: { rank: number; user: { id: string; displayName: string; avatarKey: string; titleKey?: string | null }; rating: number; games: number; league: LeagueTier | null; winRate: number; weekDelta: number }[];
  total: number; me: { rank: number | null; rating: number; games: number; league: LeagueTier | null; gamesToEligible: number } | null;
  ladder: { league: LeagueTier; from: number }[] }
const LEAGUE_FA: Record<LeagueTier, string> = { bronze: 'برنز', silver: 'نقره', gold: 'طلا', platinum: 'پلاتین', diamond: 'الماس', master: 'استاد' };
const ORDINAL = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
const placeFa = (place: number, field: number) => `${ORDINAL[place - 1] ?? faNum(place)} از ${faNum(field)}`;
const delta = (d: number) => (d === 0 ? <span className="bgv-muted">-</span>
  : <span className={d > 0 ? 'pf-up' : 'pf-down'}><Icon name={d > 0 ? 'arrow-up-right' : 'arrow-down-right'} size="sm" /><bdi dir="ltr">{d > 0 ? '+' : '−'}{faNum(Math.abs(d))}</bdi></span>);

/** Ranking-Desktop: the league tiles (mine outlined, with progress to the next) above the table. */
function Leagues({ b, title }: { b: Board; title: string }) {
  const m = b.me;
  const at = m?.league ? b.ladder.findIndex((l) => l.league === m.league) : -1;
  const next = at >= 0 ? b.ladder[at + 1] : undefined;
  const cur = at >= 0 ? b.ladder[at]! : undefined;
  return (
    <>
      <div className="bgv-row"><h2 className="pf-h2"><span className="app-hide-phone">{title}</span><span className="app-phone-only">{b.season?.nameFa ?? title}</span></h2>
        <span className="t-caption bgv-muted app-hide-phone">{faNum(b.total)} بازیکن واجد شرایط</span>
        {m && next && <span className="t-caption bgv-muted app-phone-only">{faNum(next.from - m.rating)} امتیاز تا {LEAGUE_FA[next.league]}</span>}</div>
      <div role="group" className="pf-steps" aria-label="نردبان لیگ">
        {b.ladder.map((l, i) => {
          const mine = m?.league === l.league;
          const next = b.ladder[i + 1];
          const pct = mine && next ? Math.max(0, Math.min(1, (m.rating - l.from) / Math.max(1, next.from - l.from))) : null;
          return (
            <div key={l.league} className={mine ? 'pf-step is-current' : 'pf-step'}>
              <span className="pf-step__name"><League tier={l.league} />{mine && <Badge size="sm" tone="you">شما</Badge>}</span>
              <span className="t-caption bgv-muted bgv-num">از {faNum(l.from)}</span>
              {pct !== null && next && <span className="pf-step__bar" role="img" aria-label={`${faNum(Math.round(pct * 100))}٪ تا ${LEAGUE_FA[next.league]}`}><i style={{ inlineSize: `${pct * 100}%` }} /></span>}
            </div>
          );
        })}
      </div>
      {/* Ranking-Mobile: one bar under the tiles instead of one inside my tile. */}
      {m && cur && next && <span className="pf-step__bar app-phone-only" role="img" aria-label={`تا ${LEAGUE_FA[next.league]}`}>
        <i style={{ inlineSize: `${Math.max(0, Math.min(1, (m.rating - cur.from) / Math.max(1, next.from - cur.from))) * 100}%` }} /></span>}
    </>
  );
}

function MyRank({ b, me }: { b: Board; me: { displayName: string; avatarKey: string; titleKey?: string | null } }) {
  const m = b.me;
  const id = userIdentity(me, { you: true });
  return (
    <section className="bgv-card pf-myrank" aria-label="جایگاه شما">
      <Avatar {...id.avatar} initials={id.initials} size="xl" you />
      {!m ? <><b className="t-title">هنوز در این حالت رتبه ندارید</b><span className="t-caption bgv-muted">در «بازی سریع» حالت رتبه‌دار را انتخاب کنید.</span></>
        : <>
          <b className="t-title">{m.rank ? `رتبهٔ ${faNum(m.rank)} از ${faNum(b.total)}` : `${faNum(m.gamesToEligible)} بازی تا ورود به جدول`}</b>
          <span className="t-caption bgv-muted pf-myrank__meta">{m.league && <League tier={m.league} />}<span className="bgv-sep" /><span className="bgv-num">{faNum(m.rating)}</span>&nbsp;امتیاز
            {m.rank && b.total > 1 && <><span className="bgv-sep" />بالاتر از {faNum(Math.round((1 - m.rank / b.total) * 100))}٪</>}</span>
        </>}
    </section>
  );
}

function History({ gameId, mode }: { gameId: string; mode: RatingMode }) {
  const h = useApi<{ items: { at: string; place: number; fieldSize: number; before: number; after: number }[] }>(`/me/stats/history?gameId=${gameId}&mode=${mode}`);
  const t = useApi<{ weekly: { week: string; rating: number; games: number; firstPlaces: number }[]; seasons: { nameFa: string; league: string; rating: number }[] }>(`/me/stats/trends?gameId=${gameId}&mode=${mode}`);
  return (
    <>
      <section className="bgv-card pf-pcard" aria-labelledby="rh-h">
        <div className="bgv-row"><h2 id="rh-h" className="pf-h2">سابقهٔ رتبه‌دار من</h2><Badge>رایگان</Badge></div>
        {h.data && (h.data.items.length === 0 ? <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>سابقه‌ای در این حالت ندارید.</p> : (
          <ul className="pf-ul pf-rows">{h.data.items.slice(0, 6).map((r) => (
            <li key={r.at} className="pf-lrow">
              <div className="pf-mrow__text"><b>{placeFa(r.place, r.fieldSize)}</b><span className="t-caption bgv-muted">{jalaliDate(r.at)}</span></div>
              <span className="bgv-num t-caption bgv-muted">{faNum(r.before)} ← <b className="pf-hist__after">{faNum(r.after)}</b></span>
            </li>))}</ul>
        ))}
      </section>
      <section className="bgv-card bgv-card--raised pf-pcard" aria-labelledby="trend-h">
        <div className="bgv-row"><h2 id="trend-h" className="pf-h2">روند و مقایسهٔ فصل‌ها</h2><Badge tone="premium" icon="crown">پریمیوم</Badge></div>
        {t.error?.status === 403 ? (<>
          <p className="t-body-sm" style={{ margin: 0 }}>نمودار هفتگی و مقایسهٔ فصل‌ها بخشی از اشتراک پریمیوم است. رتبه و سابقهٔ پایه برای همه رایگان است و اشتراک هیچ برتری در بازی نمی‌دهد.</p>
          <Button variant="secondary" href="/plans" className="pf-selfstart">دربارهٔ اشتراک پریمیوم</Button>
        </>) : t.data && (t.data.weekly.length === 0 ? <p className="t-body-sm bgv-muted" style={{ margin: 0 }}>هنوز داده‌ای برای روند نیست.</p> : (
          <DataTable caption="روند هفتگی" rowKey="week" rows={t.data.weekly} columns={[
            { key: 'w', label: 'هفته', render: (r) => jalaliDate(r.week) },
            { key: 'r', label: 'امتیاز', render: (r) => faNum(r.rating) },
            { key: 'g', label: 'بازی', render: (r) => faNum(r.games) },
            { key: 'f', label: 'اول', render: (r) => faNum(r.firstPlaces) }
          ]} />
        ))}
      </section>
    </>
  );
}

export function RankingPage() {
  usePageTitle('رتبه‌بندی');
  const { me } = useSession();
  const games = useApi<{ items: { id: string; nameFa: string; competitions: string[] }[] }>('/games');
  const seasons = useApi<{ items: { id: string; nameFa: string; status: string }[] }>('/seasons');
  const [gameId, setGameId] = useState(() => new URLSearchParams(location.search).get('game') ?? 'line-three');
  const [mode, setMode] = useState<RatingMode>('live');
  const [seasonId, setSeasonId] = useState('');
  const [q, setQ] = useState('');
  const [friendsOnly, setFriendsOnly] = useState(false);
  const detail = useApi<{ options: { key: string }[] }>(`/games/${gameId}`);
  const friends = useApi<{ friends: PublicProfile[] }>(me && friendsOnly ? '/me/friends' : null);
  // Games with a clock option keep a rating per time class as well.
  const modes: RatingMode[] = detail.data?.options.some((o) => o.key === 'clock') ? ['live', 'turn', 'bullet', 'blitz', 'rapid', 'classical'] : ['live', 'turn'];
  const board = useApi<Board>(me ? `/games/${gameId}/leaderboard?mode=${mode}${seasonId ? `&seasonId=${seasonId}` : ''}` : null);
  if (!me) return <StateBlock kind="denied" title="برای دیدن رتبه‌بندی وارد شوید" action={<Button variant="primary" href="/login?next=/ranking">ورود</Button>} />;
  const gameFa = games.data?.items.find((g) => g.id === gameId)?.nameFa ?? '';
  // Search and «فقط دوستان» narrow the loaded board (top 100 plus your own row).
  const friendIds = new Set([me.id, ...(friends.data?.friends.map((f) => f.id) ?? [])]);
  const rows = (board.data?.items ?? []).filter((r) => (!q.trim() || r.user.displayName.includes(q.trim())) && (!friendsOnly || friendIds.has(r.user.id)));
  return (
    <>
      <PageTabs group="progress" />
      <PageHead className="app-hide-phone" title="رتبه‌بندی و لیگ" sub="رتبهٔ هر بازی و هر حالت جداست و فقط از میزهای رتبه‌دار بازی سریع ساخته می‌شود." />
      <div className="pf-rankbar">
        <Select label="بازی" value={gameId} onChange={(e) => { setGameId(e.target.value); setMode('live'); }} options={(games.data?.items ?? []).map((g) => ({ value: g.id, label: g.nameFa }))} />
        <div className="pf-rankbar__mode"><span className="t-label">حالت</span>
          <Segmented label="حالت" value={mode} onChange={(v) => setMode(v as RatingMode)} options={modes.map((m) => ({ value: m, label: RATING_MODE_FA[m] }))} /></div>
        <Select className="app-hide-phone" label="فصل" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}
          options={[{ value: '', label: 'فصل جاری / کلی' }, ...(seasons.data?.items ?? []).map((s) => ({ value: s.id, label: `${s.nameFa}${s.status === 'closed' ? ' (بسته)' : ' (جاری)'}` }))]} />
        <span className="bgv-spacer app-hide-phone" />
        <TextField className="app-hide-phone" icon="search" type="search" aria-label="جست‌وجوی بازیکن" placeholder="جست‌وجوی بازیکن" value={q} onChange={(e) => setQ(e.target.value)} />
        <Chip className="app-hide-phone" icon="users" selected={friendsOnly} onClick={() => setFriendsOnly(!friendsOnly)}>فقط دوستان</Chip>
      </div>
      {board.error && <StateBlock kind="error" title="جدول دریافت نشد" text={board.error.messageFa} action={<Button variant="primary" onClick={board.reload}>تلاش دوباره</Button>} />}
      {!board.data && !board.error && <StateBlock kind="loading" title="در حال بارگذاری…" />}
      {board.data && (
        <div className="bgv-cols pf-rankcols">
          <section className="bgv-card pf-pcard" aria-label="جدول رتبه‌بندی">
            <Leagues b={board.data} title={`لیگ‌های ${gameFa} ${RATING_MODE_FA[mode]}`} />
            {board.data.season?.status === 'closed' && <p className="t-caption bgv-muted" style={{ margin: 0 }}>{board.data.season.nameFa}: نتایج نهایی و ثابت</p>}
            {rows.length === 0 ? <StateBlock kind="empty" title={board.data.items.length ? 'بازیکنی با این فیلتر نیست' : 'هنوز کسی واجد شرایط جدول نیست'} />
              : <DataTable caption="رتبه‌بندی" rowKey="rank" rows={rows} youRow={(r) => r.user.id === me.id} columns={[
                { key: 'rank', label: 'رتبه', strong: true, render: (r) => (r.rank === 1 ? <span className="pf-rank1" aria-label="رتبهٔ ۱"><Icon name="crown" size="sm" /></span> : faNum(r.rank)) },
                { key: 'user', label: 'بازیکن', render: (r) => <Identity {...userIdentity(r.user, { size: 'sm', you: r.user.id === me.id, name: <a href={`/users/${r.user.id}`}><bdi>{r.user.displayName}</bdi></a> })} /> },
                { key: 'league', label: 'لیگ', render: (r) => (r.league ? <League tier={r.league} /> : '-') },
                { key: 'rating', label: 'امتیاز', strong: true, render: (r) => <span className="bgv-num">{faNum(r.rating)}</span> },
                { key: 'games', label: 'بازی', render: (r) => faNum(r.games) },
                { key: 'win', label: 'نرخ برد', render: (r) => `${faNum(r.winRate)}٪` },
                { key: 'week', label: 'این هفته', render: (r) => delta(r.weekDelta) }
              ]} />}
            {board.data.me?.rank && !rows.some((r) => r.user.id === me.id) && !q && !friendsOnly && (
              <p className="pf-yourow"><b>{faNum(board.data.me.rank)}</b><bdi>{me.displayName}</bdi><Badge size="sm" tone="you">شما</Badge><span className="bgv-spacer" /><span className="bgv-num">{faNum(board.data.me.rating)}</span></p>
            )}
          </section>
          <aside className="pf-rankside app-hide-phone" aria-label="جایگاه و سابقهٔ من">
            <MyRank b={board.data} me={me} />
            <History key={`${gameId}-${mode}`} gameId={gameId} mode={mode} />
          </aside>
        </div>
      )}
      {board.data && <p className="t-caption bgv-muted pf-ranknote"><Icon name="info" size="sm" />فقط بازیکنانی که دست‌کم {faNum(board.data.rules.minGames)} بازی رتبه‌دار دارند و رتبه‌شان قطعیت کافی دارد در جدول هستند؛ تعداد بازی به‌تنهایی رتبه را بالا نمی‌برد.</p>}
    </>
  );
}
