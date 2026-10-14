import { useState } from 'react';
import { Badge, Banner, Card, DataTable, Identity, League, PageHead, Segmented, Select, StateBlock, Button } from '@bg/ui/bgv';
import type { League as LeagueTier } from '@bg/contracts';
import { useApi } from '../lib/api.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { faNum, jalaliDate } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { PageTabs } from '../shell/PageTabs.tsx';

interface Board { season: { id: string; nameFa: string; status: string } | null; rules: { minGames: number; maxSigma: number };
  items: { rank: number; user: { id: string; displayName: string; avatarKey: string }; rating: number; games: number; league: LeagueTier | null; winRate: number; weekDelta: number }[];
  total: number; me: { rank: number | null; rating: number; games: number; league: LeagueTier | null; gamesToEligible: number } | null;
  ladder: { league: LeagueTier; from: number }[] }
const LEAGUE_FA: Record<LeagueTier, string> = { bronze: 'برنز', silver: 'نقره', gold: 'طلا', platinum: 'پلاتین', diamond: 'الماس', master: 'استادان' };
const MEDAL = ['tier-gold', 'tier-silver', 'tier-bronze'];
const delta = (d: number) => (d === 0 ? <span className="bgv-muted">-</span>
  : <span className={d > 0 ? 'pf-up' : 'pf-down'}><bdi dir="ltr">{d > 0 ? '+' : '−'}{faNum(Math.abs(d))}</bdi></span>);

function YouCard({ b, me }: { b: Board; me: { displayName: string; avatarKey: string; titleKey?: string | null } }) {
  if (!b.me) return null;
  const m = b.me;
  const next = b.ladder.find((l) => l.from > m.rating);
  return (
    <Card className="pf-you" aria-label="جایگاه شما">
      <Identity {...userIdentity(me, { size: 'lg', you: true, ...(m.league ? { league: m.league } : {}) })} />
      <div className="pf-you__stats">
        <div><b>{m.rank ? `رتبهٔ ${faNum(m.rank)} از ${faNum(b.total)}` : `${faNum(m.gamesToEligible)} بازی تا ورود به جدول`}</b><span>جایگاه</span></div>
        <div><b className="bgv-num">{faNum(m.rating)}</b><span>امتیاز</span></div>
        <div><b>{faNum(m.games)}</b><span>بازی</span></div>
      </div>
      {next && <p className="t-caption bgv-muted" style={{ margin: 0 }}>{faNum(next.from - m.rating)} امتیاز تا لیگ {LEAGUE_FA[next.league]}</p>}
    </Card>
  );
}

function Ladder({ b }: { b: Board }) {
  return (
    <Card className="pf-ladder" aria-label="نردبان لیگ‌ها">
      <h2 className="ac-h3" style={{ margin: 0 }}>نردبان لیگ</h2>
      <ol className="pf-ladder__list">
        {[...b.ladder].reverse().map((l) => (
          <li key={l.league} className={b.me?.league === l.league ? 'is-you' : undefined}>
            <League tier={l.league} /><span>{LEAGUE_FA[l.league]}</span><span className="bgv-spacer" /><span className="bgv-muted bgv-num">{l.from ? `از ${faNum(l.from)}` : 'شروع'}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function History({ gameId, mode }: { gameId: string; mode: 'live' | 'turn' }) {
  const h = useApi<{ items: { at: string; place: number; fieldSize: number; before: number; after: number }[] }>(`/me/stats/history?gameId=${gameId}&mode=${mode}`);
  const t = useApi<{ weekly: { week: string; rating: number; games: number; firstPlaces: number }[]; seasons: { nameFa: string; league: string; rating: number }[] }>(`/me/stats/trends?gameId=${gameId}&mode=${mode}`);
  return (
    <div className="bgv-stack">
      <Card title="سابقه رتبه‌دار من (رایگان)">
        {h.data && (h.data.items.length === 0 ? <p className="bgv-muted">سابقه‌ای در این حالت ندارید.</p> : (
          <DataTable caption="سابقه" rowKey="at" rows={h.data.items} columns={[
            { key: 'at', label: 'تاریخ', render: (r) => jalaliDate(r.at) },
            { key: 'place', label: 'رتبه', render: (r) => `${faNum(r.place)} از ${faNum(r.fieldSize)}` },
            { key: 'delta', label: 'تغییر', render: (r) => <span className="bgv-num">{faNum(r.before)} ← {faNum(r.after)}</span> }
          ]} />
        ))}
      </Card>
      <Card title={<>روند و مقایسه فصل‌ها <Badge tone="premium" icon="crown">پریمیوم</Badge></>}>
        {t.error?.status === 403 ? (
          <p className="bgv-muted">تحلیل روند هفتگی و مقایسه فصل‌ها بخشی از <a href="/plans">اشتراک پریمیوم</a> است. نتیجه، رتبه و سابقه پایه برای همه رایگان است و پریمیوم هیچ مزیتی در بازی نمی‌دهد.</p>
        ) : t.data && (t.data.weekly.length === 0 ? <p className="bgv-muted">هنوز داده‌ای برای روند نیست.</p> : (
          <DataTable caption="روند هفتگی" rowKey="week" rows={t.data.weekly} columns={[
            { key: 'w', label: 'هفته', render: (r) => jalaliDate(r.week) },
            { key: 'r', label: 'رتبه پایان هفته', render: (r) => faNum(r.rating) },
            { key: 'g', label: 'بازی', render: (r) => faNum(r.games) },
            { key: 'f', label: 'رتبه اول', render: (r) => faNum(r.firstPlaces) }
          ]} />
        ))}
      </Card>
    </div>
  );
}

export function RankingPage() {
  usePageTitle('رتبه‌بندی');
  const { me } = useSession();
  const games = useApi<{ items: { id: string; nameFa: string; competitions: string[] }[] }>('/games');
  const seasons = useApi<{ items: { id: string; nameFa: string; status: string }[] }>('/seasons');
  const [gameId, setGameId] = useState('line-three');
  const [mode, setMode] = useState<'live' | 'turn'>('live');
  const [seasonId, setSeasonId] = useState('');
  const board = useApi<Board>(me ? `/games/${gameId}/leaderboard?mode=${mode}${seasonId ? `&seasonId=${seasonId}` : ''}` : null);
  if (!me) return <StateBlock kind="denied" title="برای دیدن رتبه‌بندی وارد شوید" action={<Button variant="primary" href="/login?next=/ranking">ورود</Button>} />;
  return (
    <>
      <PageTabs group="progress" />
      <PageHead title="رتبه‌بندی و لیگ" sub="رتبه هر بازی و هر حالت (زنده/نوبتی) جداست و فقط از بازی‌های رتبه‌دار حریف‌یابی ساخته می‌شود." />
      <div className="pf-filters">
        <Select label="بازی" value={gameId} onChange={(e) => setGameId(e.target.value)} options={(games.data?.items ?? []).map((g) => ({ value: g.id, label: g.nameFa }))} />
        <div className="bgv-stack" style={{ gap: 'var(--space-1)' }}>
          <span className="t-label">حالت</span>
          <Segmented label="حالت" value={mode} onChange={(v) => setMode(v as 'live' | 'turn')} options={[{ value: 'live', label: 'زنده' }, { value: 'turn', label: 'نوبتی' }]} />
        </div>
        <Select label="فصل" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}
          options={[{ value: '', label: 'فصل جاری / کلی' }, ...(seasons.data?.items ?? []).map((s) => ({ value: s.id, label: `${s.nameFa}${s.status === 'closed' ? ' (بسته)' : ''}` }))]} />
      </div>
      {board.error && <StateBlock kind="error" title="جدول دریافت نشد" text={board.error.messageFa} />}
      {board.data && (
        <section className="bgv-stack" aria-label="جدول رتبه‌بندی">
          {board.data.season && <p className="t-body-sm bgv-muted">{board.data.season.nameFa}{board.data.season.status === 'closed' ? ' (نتایج نهایی و ثابت)' : ''}</p>}
          <div className="pf-rankhead"><YouCard b={board.data} me={me} /><Ladder b={board.data} /></div>
          {board.data.items.length === 0 ? <StateBlock kind="empty" title="هنوز کسی واجد شرایط جدول نیست" /> : (
            <Card flush>
              <DataTable caption="رتبه‌بندی" rowKey="rank" rows={board.data.items} youRow={(r) => r.user.id === me.id} columns={[
                { key: 'rank', label: 'رتبه', strong: true, render: (r) => (r.rank <= 3 ? <span className={`pf-medal ${MEDAL[r.rank - 1]}`}>{faNum(r.rank)}</span> : faNum(r.rank)) },
                { key: 'user', label: 'بازیکن', render: (r) => <Identity {...userIdentity(r.user, { size: 'sm', you: r.user.id === me.id, name: <a href={`/users/${r.user.id}`}><bdi>{r.user.displayName}</bdi></a> })} /> },
                { key: 'rating', label: 'امتیاز', strong: true, render: (r) => <span className="bgv-num">{faNum(r.rating)}</span> },
                { key: 'league', label: 'لیگ', render: (r) => (r.league ? <League tier={r.league} /> : '-') },
                { key: 'games', label: 'بازی', render: (r) => faNum(r.games) },
                { key: 'win', label: 'نرخ برد', render: (r) => `${faNum(r.winRate)}٪` },
                { key: 'week', label: 'تغییر هفته', render: (r) => delta(r.weekDelta) }
              ]} />
              {board.data.me?.rank && !board.data.items.some((r) => r.user.id === me.id) && (
                <p className="pf-yourow"><b>{faNum(board.data.me.rank)}</b><bdi>{me.displayName}</bdi><span className="bgv-spacer" /><span className="bgv-num">{faNum(board.data.me.rating)}</span></p>
              )}
            </Card>
          )}
          <Banner tone="info" icon="info" text={`فقط بازیکنانی که حداقل ${faNum(board.data.rules.minGames)} بازی رتبه‌دار دارند و رتبه‌شان قطعیت کافی دارد در جدول هستند؛ تعداد بازی به‌تنهایی رتبه را بالا نمی‌برد.`} />
        </section>
      )}
      <History key={`${gameId}-${mode}`} gameId={gameId} mode={mode} />
    </>
  );
}
