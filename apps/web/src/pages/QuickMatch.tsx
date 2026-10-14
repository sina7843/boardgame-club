import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { GameSummary, TicketView } from '@bg/contracts';
import { Avatar, Badge, Banner, Button, Card, Icon, PageHead, Segmented, Select, Skeleton, StateBlock } from '@bg/ui/bgv';
import { useToast } from '@bg/ui';
import { BotPlay } from '../games/BotPlay.tsx';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { defaultTime, durationFa, faNum, PACE_FA } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { userIdentity } from '../lib/bgv.tsx';
import { PageTabs } from '../shell/PageTabs.tsx';

/** After this wait without an opponent, playing against a bot is offered (the ticket is cancelled if accepted). */
const BOT_OFFER_SECONDS = 30;

const mmss = (s: number) => `${faNum(Math.floor(s / 60))}:${(s % 60).toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}`;

function TicketStatus({ t, onChange, game }: { t: TicketView; onChange: () => void; game?: GameSummary }) {
  const toast = useToast();
  const { me } = useSession();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const cancel = async () => {
    try { await api(`/matchmaking/tickets/${t.id}`, { method: 'DELETE' }); onChange(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'لغو نشد.'); }
  };
  const waited = Math.floor((now - new Date(t.createdAt).getTime()) / 1000);
  const summary = (
    <Card>
      <div className="bgv-row">
        <img className="pg-thumb" style={{ inlineSize: 64, blockSize: 36 }} src={`/covers/${t.gameId}.webp?v=2`} alt="" />
        <div className="pg-stack" style={{ gap: 0 }}>
          <b className="t-title">{t.gameNameFa}</b>
          <span className="pg-meta">{t.competition === 'ranked' ? 'رتبه‌دار' : 'دوستانه'}<span className="bgv-sep" />{PACE_FA[t.pace]}<span className="bgv-sep" />{faNum(t.playerCount)} نفر<span className="bgv-sep" />{durationFa(t.turnSeconds)} برای هر نوبت</span>
        </div>
      </div>
    </Card>
  );
  if (t.status === 'queued') {
    return (
      <section className="pg-stack" aria-labelledby="q-h">
        {summary}
        <div className="pg-center">
          <div className="pg-radar" aria-hidden><i /><i /><i /><b /><em /><span><Avatar size="lg" you initials={me?.displayName.charAt(0)} {...(me ? userIdentity(me).avatar : {})} /></span></div>
          <span className="t-num-xl bgv-num" role="timer" aria-label="زمان انتظار">{mmss(waited)}</span>
          <h2 id="q-h" className="t-title" style={{ margin: 0 }}>در صف «{t.gameNameFa}»، دنبال حریف هم‌سطح می‌گردیم</h2>
        </div>
        <Card>
          <div className="bgv-row"><b className="t-label" style={{ flex: 1 }}>دامنه مهارت</b><Badge tone="info" icon="arrow-up-right">در حال باز شدن</Badge></div>
          <p className="t-body-sm" style={{ margin: 0 }}>الان <bdi dir="ltr">± {faNum(t.window)}</bdi> امتیاز. هرچه بیشتر منتظر بمانید، دامنه مهارت تا سقف مشخص بازتر می‌شود. بازیکن تازه با امتیاز پایه ۱۵۰۰ سنجیده می‌شود.</p>
        </Card>
        {game?.botAvailable && waited >= BOT_OFFER_SECONDS && (
          <Card raised title="بازی با ربات">
            <p className="t-body-sm bgv-muted">حریف آنلاین پیدا نشد. می‌خواهید تا آن موقع با ربات بازی کنید؟ با شروع بازی، از صف خارج می‌شوید.</p>
            <BotPlay gameId={t.gameId} minPlayers={t.playerCount} maxPlayers={t.playerCount} players={t.playerCount} />
          </Card>
        )}
        <Button variant="leave" block onClick={cancel}>لغو جست‌وجو</Button>
      </section>
    );
  }
  if (t.status === 'matched' && t.matchedTableId) {
    const left = t.readyDeadline ? Math.max(0, Math.floor((new Date(t.readyDeadline).getTime() - now) / 1000)) : 0;
    return (
      <section className="pg-stack" aria-labelledby="m-h">
        {summary}
        <div className="pg-center">
          <Badge tone="warning" icon="circle-check" size="md">حریف پیدا شد!</Badge>
          <span className="t-num-xl bgv-num" role="timer" aria-label="زمان باقی‌مانده برای پذیرش">{mmss(left)}</span>
          <h2 id="m-h" className="t-title" style={{ margin: 0 }}>«{t.gameNameFa}»: آمادگی خود را اعلام کنید</h2>
          <span className="bgv-muted t-body-sm">اگر رد کنید یا زمان تمام شود، از صف خارج می‌شوید.</span>
        </div>
        <Button variant="primary" icon="check" block onClick={() => navigate(`/tables/${t.matchedTableId}`)}>رفتن به میز و اعلام آمادگی</Button>
        <Button block onClick={cancel}>رد کردن</Button>
      </section>
    );
  }
  return (
    <div role="status"><Banner tone="info" icon="info"
      text={t.status === 'expired' ? 'زمان پذیرش یا انتظار تمام شد؛ از صف خارج شدید.' : t.status === 'cancelled' ? 'جست‌وجو لغو شد.' : 'بازی شروع شد.'}
      action={t.status === 'started' && t.matchedTableId ? <Button size="sm" href={`/tables/${t.matchedTableId}`}>رفتن به میز</Button> : undefined} /></div>
  );
}

export function QuickMatch() {
  usePageTitle('حریف‌یابی');
  const { me, status } = useSession();
  const [params] = useSearchParams();
  const toast = useToast();
  const games = useApi<{ items: GameSummary[] }>('/games');
  const tickets = useApi<{ items: TicketView[] }>(me ? '/me/matchmaking' : null);
  const [gameId, setGameId] = useState(params.get('game') ?? '');
  const [pace, setPace] = useState<'live' | 'turn'>('live');
  const [competition, setCompetition] = useState<'friendly' | 'ranked'>('friendly');
  const [players, setPlayers] = useState(2);
  const [turnSeconds, setTurnSeconds] = useState<number>(60);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const reload = tickets.reload;

  useEffect(() => { const i = setInterval(reload, 2000); return () => clearInterval(i); }, [reload]);
  useEffect(() => { if (!gameId && games.data?.items[0]) setGameId(games.data.items[0].id); }, [games.data, gameId]);
  const game = games.data?.items.find((g) => g.id === gameId);
  useEffect(() => { if (game) setPlayers((p) => Math.min(Math.max(p, game.minPlayers), game.maxPlayers)); }, [game]);
  useEffect(() => { if (game && !game.paces.includes(pace)) setPace(game.paces[0]!); }, [game, pace]);
  useEffect(() => { if (game) setTurnSeconds(defaultTime(pace === 'live' ? game.liveSeconds : game.turnSeconds, pace)); }, [pace, game]);

  if (status !== 'loading' && !me) return <StateBlock kind="denied" title="برای حریف‌یابی وارد شوید" action={<Button variant="primary" href="/login?next=/play">ورود</Button>} />;
  if (games.error) return <StateBlock kind="error" title="فهرست بازی‌ها دریافت نشد" action={<Button onClick={games.reload}>تلاش دوباره</Button>} />;
  if (!games.data || !tickets.data) return <><Skeleton height={240} radius="var(--radius-lg)" /><span className="pg-sr" role="status">در حال بارگذاری…</span></>;

  const active = tickets.data.items.find((t) => t.status === 'queued' || t.status === 'matched');
  const recent = tickets.data.items[0];
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ id?: string; tableId?: string }>('/matchmaking/tickets', { method: 'POST', body: { gameId, pace, competition, playerCount: players, turnSeconds } });
      // A matching open table had a free seat: we are already sitting there, ready.
      if (r.tableId) { toast('success', 'به یک میز باز با همین تنظیمات اضافه شدید.'); navigate(`/tables/${r.tableId}`); }
      else reload();
    }
    catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'ورود به صف ممکن نشد.'); }
    finally { setBusy(false); }
  };
  const playerCounts = game ? Array.from({ length: game.maxPlayers - game.minPlayers + 1 }, (_, i) => game.minPlayers + i) : [];

  return (
    <>
      <PageTabs group="tables" />
      <PageHead title="حریف‌یابی" sub="بازی و حالت را انتخاب کنید؛ «زنده» یعنی همه هم‌زمان آنلاین‌اند و «نوبتی» یعنی هر کس در مهلت خودش حرکت می‌کند. قبل از شروع هر دو طرف آمادگی را تأیید می‌کنند." />
      <div className="pg-stack" style={{ maxInlineSize: 640 }}>
        {active ? <TicketStatus t={active} onChange={reload} game={games.data.items.find((g) => g.id === active.gameId)} /> : (
          <>
            {recent && <TicketStatus t={recent} onChange={reload} />}
            <form onSubmit={submit}><Card>
              <div className="pg-stack">
                <Select label="بازی" value={gameId} onChange={(e) => setGameId(e.target.value)} options={games.data.items.map((g) => ({ value: g.id, label: g.nameFa }))} />
                {game && (
                  <div className="pg-field"><span className="bgv-label">حالت</span>
                    <Segmented label="حالت" value={pace} onChange={(v) => setPace(v as 'live' | 'turn')} options={game.paces.map((p) => ({ value: p, label: PACE_FA[p] }))} />
                  </div>
                )}
                {game && playerCounts.length > 1 && (
                  <Select label="تعداد بازیکن" value={String(players)} onChange={(e) => setPlayers(Number(e.target.value))}
                    options={playerCounts.map((n) => ({ value: String(n), label: `${faNum(n)} نفر` }))} />
                )}
                <Select label={pace === 'live' ? 'زمان هر حرکت' : 'مهلت هر نوبت'} value={String(turnSeconds)} onChange={(e) => setTurnSeconds(Number(e.target.value))}
                  options={(game ? (pace === 'live' ? game.liveSeconds : game.turnSeconds) : []).map((s) => ({ value: String(s), label: durationFa(s) }))} />
                {game?.competitions.includes('ranked') && (
                  <div className="pg-field"><span className="bgv-label">نوع رقابت</span>
                    <Segmented label="نوع رقابت" value={competition} onChange={(v) => setCompetition(v as 'friendly' | 'ranked')} options={[{ value: 'friendly', label: 'دوستانه' }, { value: 'ranked', label: 'رتبه‌دار' }]} />
                  </div>
                )}
                <p className="bgv-hint"><Icon name="shield" size="sm" />{competition === 'ranked' ? 'نتیجه روی رتبه مهارتی همین بازی و حالت اثر دارد. حریف بر اساس مهارت انتخاب می‌شود؛ اشتراک اولویتی نمی‌دهد.' : 'میز دوستانه روی رتبه اثری ندارد.'}</p>
                <Button type="submit" variant="primary" icon="zap" block loading={busy} disabled={!gameId}>شروع جست‌وجو</Button>
              </div>
            </Card>
            </form>
          </>
        )}
      </div>
    </>
  );
}
