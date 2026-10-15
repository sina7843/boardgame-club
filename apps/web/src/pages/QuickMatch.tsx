import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { GameSummary, TableSnapshot, TicketView } from '@bg/contracts';
import { Avatar, Badge, Banner, Button, Card, Icon, PageHead, ReadyCheck, Segmented, Select, Skeleton, StateBlock, type SeatNo } from '@bg/ui/bgv';
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
  if (t.status === 'matched' && t.matchedTableId) return <><>{summary}</><MatchedCheck tableId={t.matchedTableId} gameNameFa={t.gameNameFa} readyDeadline={t.readyDeadline} now={now} onDecline={cancel} /></>;
  return (
    <div role="status"><Banner tone="info" icon="info"
      text={t.status === 'expired' ? 'زمان پذیرش یا انتظار تمام شد؛ از صف خارج شدید.' : t.status === 'cancelled' ? 'جست‌وجو لغو شد.' : 'بازی شروع شد.'}
      action={t.status === 'started' && t.matchedTableId ? <Button size="sm" href={`/tables/${t.matchedTableId}`}>رفتن به میز</Button> : undefined} /></div>
  );
}

/**
 * «حریف پیدا شد»: the ready check happens here (players and their ready state, «آماده‌ام» / «رد کردن»); after accepting,
 * a «در حال پیوستن» step shows the table and its progress, and the page moves to the table once the game starts.
 */
function MatchedCheck({ tableId, gameNameFa, readyDeadline, now, onDecline }: { tableId: string; gameNameFa: string; readyDeadline: string | null; now: number; onDecline: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const snap = useApi<TableSnapshot>(`/tables/${tableId}`);
  const reload = snap.reload;
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setInterval(reload, 2000); return () => clearInterval(t); }, [reload]);
  const status = snap.data?.table.status;
  useEffect(() => { if (status === 'active') navigate(`/tables/${tableId}`); }, [status, tableId, navigate]);
  if (!snap.data) return <StateBlock kind="loading" title="در حال باز کردن میز…" />;
  const tb = snap.data.table;
  const mine = tb.seats.find((x) => x.seat === tb.mySeat);
  const name = (x: (typeof tb.seats)[number]) => x.user?.displayName ?? x.bot?.nameFa ?? 'بازیکن';
  const left = readyDeadline ? Math.max(0, Math.floor((new Date(readyDeadline).getTime() - now) / 1000)) : 0;
  const ready = async () => {
    setBusy(true);
    try { await api(`/tables/${tableId}/ready`, { method: 'POST', body: { ready: true } }); reload(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'اعلام آمادگی انجام نشد.'); }
    finally { setBusy(false); }
  };
  const players = tb.seats.map((x) => ({ name: <bdi>{name(x)}</bdi>, seat: ((x.seat % 10) + 1) as SeatNo, initials: name(x).charAt(0), you: x.seat === tb.mySeat, bot: !!x.bot, ready: x.ready }));
  if (mine?.ready) {
    const all = tb.seats.every((x) => x.ready);
    return (
      <section className="pg-stack" aria-labelledby="j-h">
        <div className="pg-center">
          <Badge tone="success" icon="circle-check" size="md">آماده‌اید</Badge>
          <h2 id="j-h" className="t-title" style={{ margin: 0 }}>در حال پیوستن به میز «{gameNameFa}»</h2>
          <span className="bgv-muted t-body-sm">صندلی شما: رنگ {mine.seat + 1}؛ نفر اول را سرور به‌صورت تصادفی تعیین می‌کند.</span>
        </div>
        <Card>
          <ol className="pg-steps">
            <li className="is-done"><Icon name="check" size="sm" />حریف پیدا شد</li>
            <li className={all ? 'is-done' : 'is-now'}><Icon name={all ? 'check' : 'hourglass'} size="sm" />آمادگی همه ({tb.seats.filter((x) => x.ready).length.toLocaleString('fa-IR')} از {tb.seats.length.toLocaleString('fa-IR')})</li>
            <li className={all ? 'is-now' : ''}><Icon name="armchair" size="sm" />چیدن میز و شروع بازی</li>
          </ol>
        </Card>
        <ReadyCheck title="بازیکنان" players={players} />
      </section>
    );
  }
  return (
    <section className="pg-stack" aria-labelledby="m-h">
      <ReadyCheck title={<span id="m-h">حریف پیدا شد! «{gameNameFa}»</span>} players={players}
        text={<>همه باید آمادگی را تأیید کنند؛ زمان باقی‌مانده: <span className="bgv-num" role="timer">{mmss(left)}</span>. اگر رد کنید یا زمان تمام شود، از صف خارج می‌شوید.</>}
        actions={<><Button variant="primary" icon="check" block loading={busy} onClick={ready}>آماده‌ام</Button><Button block onClick={onDecline}>رد کردن</Button></>} />
    </section>
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
  // The ready check unmounts as soon as the ticket leaves «matched»; a ticket seen matched that has now started moves us to its table.
  const matchedSeen = useRef<string | null>(null);
  useEffect(() => {
    const t = tickets.data?.items[0];
    if (t?.status === 'matched') matchedSeen.current = t.id;
    else if (t?.status === 'started' && t.matchedTableId && matchedSeen.current === t.id) { matchedSeen.current = null; navigate(`/tables/${t.matchedTableId}`); }
  }, [tickets.data, navigate]);
  useEffect(() => { if (!gameId && games.data?.items[0]) setGameId(games.data.items[0].id); }, [games.data, gameId]);
  const game = games.data?.items.find((g) => g.id === gameId);
  useEffect(() => { if (game) setPlayers((p) => Math.min(Math.max(p, game.minPlayers), game.maxPlayers)); }, [game]);
  useEffect(() => { if (game && !game.paces.includes(pace)) setPace(game.paces[0]!); }, [game, pace]);
  useEffect(() => { if (game) setTurnSeconds(defaultTime(pace === 'live' ? game.liveSeconds : game.turnSeconds, pace)); }, [pace, game]);

  if (status !== 'loading' && !me) return <StateBlock kind="denied" title="برای حریف‌یابی وارد شوید" action={<Button variant="primary" href="/login?next=/play">ورود</Button>} />;
  if (games.error) return <StateBlock kind="error" title="فهرست بازی‌ها دریافت نشد" action={<Button variant="primary" icon="refresh-cw" onClick={games.reload}>تلاش دوباره</Button>} />;
  if (!games.data || !tickets.data) return <><Skeleton height={240} radius="var(--radius-lg)" /><span className="bgv-sr" role="status">در حال بارگذاری…</span></>;

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
