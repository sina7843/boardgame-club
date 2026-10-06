import { useState } from 'react';
import { Link } from 'react-router';
import { Avatar, Badge, DataTable, LeagueBadge, Segmented, Select, StateBlock } from '@bg/ui';
import { useApi } from '../lib/api.ts';
import { faNum, jalaliDate } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

type League = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';
interface Board { season: { id: string; nameFa: string; status: string } | null; rules: { minGames: number; maxSigma: number };
  items: { rank: number; user: { id: string; displayName: string; avatarKey: string }; rating: number; games: number; league: League | null }[] }

function History({ gameId, mode }: { gameId: string; mode: 'live' | 'turn' }) {
  const h = useApi<{ items: { at: string; place: number; fieldSize: number; before: number; after: number }[] }>(`/me/stats/history?gameId=${gameId}&mode=${mode}`);
  const t = useApi<{ weekly: { week: string; rating: number; games: number; firstPlaces: number }[]; seasons: { nameFa: string; league: string; rating: number }[] }>(`/me/stats/trends?gameId=${gameId}&mode=${mode}`);
  return (
    <div className="stack">
      <section className="panel stack" aria-labelledby="hist-h">
        <h2 id="hist-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}>سابقه رتبه‌دار من (رایگان)</h2>
        {h.data && (h.data.items.length === 0 ? <p className="muted" style={{ margin: 0 }}>سابقه‌ای در این حالت ندارید.</p> : (
          <DataTable caption="سابقه" rowKey={(r) => r.at} rows={h.data.items} columns={[
            { key: 'at', title: 'تاریخ', render: (r) => jalaliDate(r.at) },
            { key: 'place', title: 'رتبه', render: (r) => `${faNum(r.place)} از ${faNum(r.fieldSize)}` },
            { key: 'delta', title: 'تغییر', render: (r) => <span className="num">{faNum(r.before)} → {faNum(r.after)}</span> }
          ]} />
        ))}
      </section>
      <section className="panel stack" aria-labelledby="trend-h">
        <h2 id="trend-h" className="section-title" style={{ fontSize: 'var(--fs-md)' }}>روند و مقایسه فصل‌ها <Badge tone="premium">پریمیوم</Badge></h2>
        {t.error?.status === 403 ? (
          <p className="muted" style={{ margin: 0 }}>تحلیل روند هفتگی و مقایسه فصل‌ها بخشی از <Link to="/plans">اشتراک پریمیوم</Link> است. نتیجه، رتبه و سابقه پایه برای همه رایگان است و پریمیوم هیچ مزیتی در بازی نمی‌دهد.</p>
        ) : t.data && (t.data.weekly.length === 0 ? <p className="muted" style={{ margin: 0 }}>هنوز داده‌ای برای روند نیست.</p> : (
          <DataTable caption="روند هفتگی" rowKey={(r) => r.week} rows={t.data.weekly} columns={[
            { key: 'w', title: 'هفته', render: (r) => jalaliDate(r.week) },
            { key: 'r', title: 'رتبه پایان هفته', render: (r) => faNum(r.rating) },
            { key: 'g', title: 'بازی', render: (r) => faNum(r.games) },
            { key: 'f', title: 'رتبه اول', render: (r) => faNum(r.firstPlaces) }
          ]} />
        ))}
      </section>
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
  if (!me) return <StateBlock kind="denied" title="برای دیدن رتبه‌بندی وارد شوید" action={<Link className="btn btn--primary" to="/login?next=/ranking">ورود</Link>} />;
  return (
    <>
      <div className="page-head"><div><h1 className="page-title">رتبه‌بندی و لیگ</h1><p className="page-sub">رتبه هر بازی و هر حالت (زنده/نوبتی) جداست و فقط از بازی‌های رتبه‌دار حریف‌یابی ساخته می‌شود.</p></div></div>
      <div className="filters" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Select label="بازی" value={gameId} onChange={(e) => setGameId(e.target.value)} options={(games.data?.items ?? []).map((g) => ({ value: g.id, label: g.nameFa }))} />
        <Segmented legend="حالت" name="mode" value={mode} onChange={setMode} options={[{ value: 'live', label: 'زنده' }, { value: 'turn', label: 'نوبتی' }]} />
        <Select label="فصل" value={seasonId} onChange={(e) => setSeasonId(e.target.value)}
          options={[{ value: '', label: 'فصل جاری / کلی' }, ...(seasons.data?.items ?? []).map((s) => ({ value: s.id, label: `${s.nameFa}${s.status === 'closed' ? ' (بسته)' : ''}` }))]} />
      </div>
      {board.error && <StateBlock kind="error" title="جدول دریافت نشد">{board.error.messageFa}</StateBlock>}
      {board.data && (
        <section className="stack" aria-label="جدول رتبه‌بندی">
          <p className="muted" style={{ margin: 0 }}>
            {board.data.season ? `${board.data.season.nameFa}${board.data.season.status === 'closed' ? ' — نتایج نهایی و ثابت' : ''}. ` : ''}
            فقط بازیکنانی که حداقل {faNum(board.data.rules.minGames)} بازی رتبه‌دار دارند و رتبه‌شان قطعیت کافی دارد نمایش داده می‌شوند؛ تعداد بازی به‌تنهایی رتبه را بالا نمی‌برد.
          </p>
          {board.data.items.length === 0 ? <StateBlock kind="empty" title="هنوز کسی واجد شرایط جدول نیست" /> : (
            <DataTable caption="رتبه‌بندی" rowKey={(r) => r.user.id} rows={board.data.items} columns={[
              { key: 'rank', title: 'رتبه', render: (r) => faNum(r.rank) },
              { key: 'user', title: 'بازیکن', render: (r) => <span className="row" style={{ gap: 8 }}><Avatar avatarKey={r.user.avatarKey} name={r.user.displayName} size={28} /><Link to={`/users/${r.user.id}`}><bdi>{r.user.displayName}</bdi></Link></span> },
              { key: 'rating', title: 'امتیاز', render: (r) => <span className="num">{faNum(r.rating)}</span> },
              { key: 'league', title: 'لیگ', render: (r) => (r.league ? <LeagueBadge league={r.league} /> : '—') },
              { key: 'games', title: 'بازی', render: (r) => faNum(r.games) }
            ]} />
          )}
        </section>
      )}
      <div style={{ marginBlockStart: 'var(--sp-5)' }}><History key={`${gameId}-${mode}`} gameId={gameId} mode={mode} /></div>
    </>
  );
}
