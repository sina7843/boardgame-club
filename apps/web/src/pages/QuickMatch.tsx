import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { TIME_OPTIONS, type GameSummary, type TicketView } from '@bg/contracts';
import { Button, Icon, Segmented, Select, StateBlock, TurnIndicator, useToast } from '@bg/ui';
import { api, ApiFailure, useApi } from '../lib/api.ts';
import { durationFa, faNum, PACE_FA } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

const mmss = (s: number) => `${faNum(Math.floor(s / 60))}:${(s % 60).toLocaleString('fa-IR', { minimumIntegerDigits: 2 })}`;

function TicketStatus({ t, onChange }: { t: TicketView; onChange: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const cancel = async () => {
    try { await api(`/matchmaking/tickets/${t.id}`, { method: 'DELETE' }); onChange(); }
    catch (e) { toast('error', e instanceof ApiFailure ? e.messageFa : 'لغو نشد.'); }
  };
  const waited = Math.floor((now - new Date(t.createdAt).getTime()) / 1000);
  if (t.status === 'queued') {
    return (
      <section className="panel stack" aria-labelledby="q-h">
        <h2 id="q-h" className="section-title"><span className="spinner" aria-hidden />در صف «{t.gameNameFa}»</h2>
        <p className="muted" style={{ margin: 0 }}>{t.competition === 'ranked' ? 'رتبه‌دار' : 'دوستانه'} · {PACE_FA[t.pace]} · {faNum(t.playerCount)} نفر · {durationFa(t.turnSeconds)} برای هر نوبت</p>
        <dl className="facts">
          <div><dt>زمان انتظار</dt><dd className="num" role="timer">{mmss(waited)}</dd></div>
          <div><dt>دامنه مهارت</dt><dd>± {faNum(t.window)}</dd></div>
        </dl>
        <p className="muted" style={{ margin: 0 }}>هرچه بیشتر منتظر بمانید، دامنه مهارت تا سقف مشخص بازتر می‌شود. بازیکن تازه با امتیاز پایه ۱۵۰۰ سنجیده می‌شود.</p>
        <div><Button variant="secondary" onClick={cancel}>لغو جست‌وجو</Button></div>
      </section>
    );
  }
  if (t.status === 'matched' && t.matchedTableId) {
    const left = t.readyDeadline ? Math.max(0, Math.floor((new Date(t.readyDeadline).getTime() - now) / 1000)) : 0;
    return (
      <section className="panel stack cta-panel" aria-labelledby="m-h">
        <TurnIndicator tone="mine">حریف پیدا شد!</TurnIndicator>
        <h2 id="m-h" className="section-title">«{t.gameNameFa}» — آمادگی خود را اعلام کنید</h2>
        <p style={{ margin: 0 }}>زمان باقی‌مانده برای پذیرش: <strong className="num" role="timer">{mmss(left)}</strong></p>
        <div className="row">
          <Button onClick={() => navigate(`/tables/${t.matchedTableId}`)}>رفتن به میز و اعلام آمادگی</Button>
          <Button variant="ghost" onClick={cancel}>رد کردن</Button>
        </div>
      </section>
    );
  }
  return (
    <div className="banner banner--info" role="status">
      {t.status === 'expired' ? 'زمان پذیرش یا انتظار تمام شد؛ از صف خارج شدید.' : t.status === 'cancelled' ? 'جست‌وجو لغو شد.' : 'بازی شروع شد.'}
      {t.status === 'started' && t.matchedTableId && <Link className="btn btn--sm btn--secondary" to={`/tables/${t.matchedTableId}`}>رفتن به میز</Link>}
    </div>
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
  const [turnSeconds, setTurnSeconds] = useState<number>(TIME_OPTIONS.live[2]);
  const [busy, setBusy] = useState(false);
  const reload = tickets.reload;

  useEffect(() => { const i = setInterval(reload, 2000); return () => clearInterval(i); }, [reload]);
  useEffect(() => { if (!gameId && games.data?.items[0]) setGameId(games.data.items[0].id); }, [games.data, gameId]);
  const game = games.data?.items.find((g) => g.id === gameId);
  useEffect(() => { if (game) setPlayers((p) => Math.min(Math.max(p, game.minPlayers), game.maxPlayers)); }, [game]);
  useEffect(() => { setTurnSeconds(pace === 'live' ? TIME_OPTIONS.live[2] : TIME_OPTIONS.turn[1]); }, [pace]);

  if (status !== 'loading' && !me) return <StateBlock kind="denied" title="برای حریف‌یابی وارد شوید" action={<Link className="btn btn--primary" to="/login?next=/play">ورود</Link>} />;
  if (games.error) return <StateBlock kind="error" title="فهرست بازی‌ها دریافت نشد" action={<Button onClick={games.reload}>تلاش دوباره</Button>} />;
  if (!games.data || !tickets.data) return <StateBlock kind="loading" title="در حال بارگذاری…" />;

  const active = tickets.data.items.find((t) => t.status === 'queued' || t.status === 'matched');
  const recent = tickets.data.items[0];
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await api('/matchmaking/tickets', { method: 'POST', body: { gameId, pace, competition, playerCount: players, turnSeconds } }); reload(); }
    catch (err) { toast('error', err instanceof ApiFailure ? err.messageFa : 'ورود به صف ممکن نشد.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-head"><div><h1 className="page-title">حریف‌یابی</h1><p className="page-sub">میز دوستانه با بازیکنی هم‌سطح؛ قبل از شروع هر دو طرف آمادگی را تأیید می‌کنند.</p></div></div>
      <div className="stack" style={{ maxInlineSize: 640 }}>
        {active ? <TicketStatus t={active} onChange={reload} /> : (
          <>
            {recent && <TicketStatus t={recent} onChange={reload} />}
            <form className="panel stack" onSubmit={submit}>
              <Select label="بازی" value={gameId} onChange={(e) => setGameId(e.target.value)} options={games.data.items.map((g) => ({ value: g.id, label: g.nameFa }))} />
              {game && <Segmented legend="حالت" name="pace" value={pace} onChange={setPace} options={game.paces.map((p) => ({ value: p, label: PACE_FA[p] }))} />}
              {game && game.maxPlayers > game.minPlayers && (
                <Select label="تعداد بازیکن" value={String(players)} onChange={(e) => setPlayers(Number(e.target.value))}
                  options={Array.from({ length: game.maxPlayers - game.minPlayers + 1 }, (_, i) => game.minPlayers + i).map((n) => ({ value: String(n), label: `${faNum(n)} نفر` }))} />
              )}
              <Select label={pace === 'live' ? 'زمان هر حرکت' : 'مهلت هر نوبت'} value={String(turnSeconds)} onChange={(e) => setTurnSeconds(Number(e.target.value))}
                options={TIME_OPTIONS[pace].map((s) => ({ value: String(s), label: durationFa(s) }))} />
              {game?.competitions.includes('ranked') && <Segmented legend="نوع رقابت" name="competition" value={competition} onChange={setCompetition} options={[{ value: 'friendly', label: 'دوستانه' }, { value: 'ranked', label: 'رتبه‌دار' }]} />}
              <p className="muted" style={{ margin: 0 }}><Icon name="shield" size={16} /> {competition === 'ranked' ? 'نتیجه روی رتبه مهارتی همین بازی و حالت اثر دارد. حریف بر اساس مهارت انتخاب می‌شود؛ اشتراک اولویتی نمی‌دهد.' : 'میز دوستانه روی رتبه اثری ندارد.'}</p>
              <div><Button type="submit" busy={busy} disabled={!gameId}>شروع جست‌وجو</Button></div>
            </form>
          </>
        )}
      </div>
    </>
  );
}
