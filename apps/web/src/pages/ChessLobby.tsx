// Chess «بازی جدید» (design/games/chess D01, P01, P02; CX-13): online / with a friend / with a bot, the grouped time
// picker (بولت، بلیتس، رپید; «زمان‌های بیشتر» for friends), «نوع رقابت: دوستانه / رتبه‌دار», then the opponent search.
// Online pairing goes through matchmaking with the clock (main row only, as the owner decided), so ranked games keep
// the skill window and the server's rule that ranked tables come only from ranked matchmaking.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { BOT_LEVEL_FA, type TicketView } from '@bg/contracts';
import { Button, GameBar, Icon, Segmented, StateBlock } from '@bg/ui/bgv';
import { api, ApiFailure } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';

type Mode = 'online' | 'friend' | 'bot';
type Cls = 'bullet' | 'blitz' | 'rapid';
/** data/time-controls.json: main row (quick pairing) and «زمان‌های بیشتر» (friends and tournaments only). */
const ROWS: { cls: Cls; fa: string; icon: string; main: string[]; more: string[] }[] = [
  { cls: 'bullet', fa: 'بولت', icon: 'zap', main: ['1+0'], more: ['1+1'] },
  { cls: 'blitz', fa: 'بلیتس', icon: 'flame', main: ['3+0', '5+0'], more: ['3+2', '5+3'] },
  { cls: 'rapid', fa: 'رپید', icon: 'timer', main: ['10+0'], more: ['10+5'] }
];
const CLS_FA: Record<Cls, string> = { bullet: 'بولت', blitz: 'بلیتس', rapid: 'رپید' };
const clsOf = (v: string) => ROWS.find((r) => r.main.includes(v) || r.more.includes(v))!.cls;
const isMore = (v: string) => ROWS.some((r) => r.more.includes(v));
const [mins, inc] = [(v: string) => Number(v.split('+')[0]), (v: string) => Number(v.split('+')[1])];
const tileFa = (v: string) => (inc(v) ? `${faNum(mins(v))} + ${faNum(inc(v))}` : `${faNum(mins(v))} دقیقه`);

export function ChessLobby() {
  const { me, status } = useSession();
  const navigate = useNavigate();
  usePageTitle('بازی جدید شطرنج');
  useEffect(() => { document.documentElement.dataset.immersive = 'true'; return () => { delete document.documentElement.dataset.immersive; }; }, []);
  const [mode, setMode] = useState<Mode>('online');
  const [clock, setClock] = useState('5+0');
  const [more, setMore] = useState(true);
  const [competition, setCompetition] = useState<'friendly' | 'ranked'>('ranked');
  const [color, setColor] = useState<'random' | 'host'>('random');
  const [level, setLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seek, setSeek] = useState<{ ticketId: string; since: number } | null>(null);
  const [now, setNow] = useState(Date.now());

  // An increment is only for friends: switching to online falls back to the main tile of the same class.
  useEffect(() => { if (mode === 'online' && isMore(clock)) setClock(ROWS.find((r) => r.cls === clsOf(clock))!.main[0]!); }, [mode, clock]);

  // While seeking: count up, and open the table as soon as someone sits down and the game starts.
  const seekRef = useRef(seek);
  seekRef.current = seek;
  useEffect(() => {
    if (!seek) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => {
      api<{ items: TicketView[] }>('/me/matchmaking').then(({ items }) => {
        const t = items.find((x) => x.id === seek.ticketId);
        if (!seekRef.current || !t) return;
        if (t.matchedTableId) navigate(`/tables/${t.matchedTableId}`); // the table's ready check takes it from here
        else if (t.status === 'expired' || t.status === 'cancelled') { setSeek(null); setError('حریفی پیدا نشد. دوباره امتحان کنید.'); }
      }, () => undefined);
    }, 2000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [seek, navigate]);

  if (status !== 'loading' && !me) {
    return <StateBlock kind="guest" title="برای بازی شطرنج وارد شوید" action={<Button variant="primary" href="/login?next=/games/chess/new">ورود / ثبت‌نام</Button>} />;
  }

  // A table made by hand is friendly (ranked tables come only from ranked matchmaking).
  const create = (visibility: 'public' | 'private', extra: Record<string, unknown> = {}) => api<{ id: string }>('/tables', {
    method: 'POST', body: { gameId: 'chess', pace: 'live', turnSeconds: 60, visibility, competition: 'friendly', capacity: 2, reminders: false, options: { clock, ...extra } }
  });
  const play = async () => {
    setBusy(true); setError(null);
    try {
      if (mode === 'bot') {
        const { id } = await api<{ id: string }>('/tables/bot', { method: 'POST', body: { gameId: 'chess', level, playerCount: 2 } });
        navigate(`/tables/${id}`);
      } else if (mode === 'friend') {
        const { id } = await create('private', { firstMove: color });
        navigate(`/tables/${id}`);
      } else {
        const r = await api<{ id?: string; tableId?: string }>('/matchmaking/tickets', {
          method: 'POST', body: { gameId: 'chess', pace: 'live', competition, playerCount: 2, turnSeconds: mins(clock) * 60, clock }
        });
        if (r.tableId) navigate(`/tables/${r.tableId}`);
        else if (r.id) { setSeek({ ticketId: r.id, since: Date.now() }); setNow(Date.now()); }
      }
    } catch (e) { setError(e instanceof ApiFailure ? e.messageFa : 'شروع بازی ممکن نشد.'); } finally { setBusy(false); }
  };
  const cancel = async () => {
    const s = seek;
    setSeek(null);
    if (s) await api(`/matchmaking/tickets/${s.ticketId}`, { method: 'DELETE' }).catch(() => undefined);
  };

  const cls = clsOf(clock);
  const tile = (v: string) => {
    const disabled = !!seek || (mode === 'online' && isMore(v));
    return <button key={v} type="button" className={isMore(v) ? 'chl-tile chl-tile--inc' : 'chl-tile'} aria-pressed={clock === v} disabled={disabled} onClick={() => setClock(v)}><b dir={inc(v) ? 'ltr' : undefined}>{tileFa(v)}</b></button>;
  };
  const search = seek && (
    <div className="chl-seek" role="status">
      <span className="chl-ring" aria-hidden="true" />
      <h3>دنبال حریف می‌گردیم…</h3>
      <p>{tileFa(clock)}، {CLS_FA[cls]}، {competition === 'ranked' ? 'رتبه‌دار' : 'دوستانه'}</p>
      <span className="chl-seek__t" dir="ltr">{faNum(Math.floor((now - seek.since) / 60000))}:{faNum(Math.floor(((now - seek.since) / 1000) % 60)).padStart(2, '۰')}</span>
      <span className="chl-seek__cancel"><Button variant="secondary" icon="x" block onClick={() => void cancel()}>لغو</Button></span>
    </div>
  );

  return (
    <div className={seek ? 'chl chl--seeking' : 'chl'}>
      <GameBar title="شطرنج" latin="Chess" onBack={() => navigate('/games/chess')} backLabel="بازگشت به صفحهٔ شطرنج" meta={['شطرنج', 'بازی جدید']} />
      <div className="chl__body">
        <section className="chl__side" aria-labelledby="chl-h">
          <span className="chl-handle" aria-hidden="true" />
          <div className="chl-row chl-row--between">
            <h1 id="chl-h" className="chl-h">بازی جدید شطرنج</h1>
            <span className="chl-close"><Button variant="ghost" iconOnly icon="x" onClick={() => navigate('/games/chess')}>بستن</Button></span>
          </div>
          <Segmented label="نوع بازی" block value={mode} onChange={(v) => !seek && setMode(v as Mode)}
            options={[{ value: 'online', label: 'آنلاین', icon: 'globe' }, { value: 'friend', label: 'با دوست', icon: 'users' }, { value: 'bot', label: 'با ربات', icon: 'bot' }]} />
          {mode !== 'bot' ? (
            <div className="chl-tc" role="group" aria-label="زمان بازی">
              {ROWS.map((r) => (
                <div key={r.cls} className="chl-tc__row">
                  <span className="chl-cat"><Icon name={r.icon as 'zap'} size={18} />{r.fa}</span>
                  <div className="chl-tc__grid">{r.main.map(tile)}{more && r.more.map(tile)}</div>
                </div>
              ))}
              <button type="button" className="chl-more" aria-expanded={more} onClick={() => setMore((m) => !m)}>
                <Icon name="chevron-down" size={18} className={more ? 'chl-more__up' : undefined} />{more ? 'زمان‌های کمتر' : 'زمان‌های بیشتر'}
              </button>
              {more && <p className="chl-hint">در «۳ + ۲» بعد از هر حرکت ۲ ثانیه به ساعت شما اضافه می‌شود. این زمان‌ها برای بازی با دوست و مسابقه است.</p>}
            </div>
          ) : (
            <div className="chl-row chl-row--between">
              <span className="chl-cat">سطح ربات</span>
              <Segmented label="سطح ربات" value={level} onChange={(v) => setLevel(v as typeof level)} options={(['easy', 'medium', 'hard'] as const).map((l) => ({ value: l, label: BOT_LEVEL_FA[l] }))} />
            </div>
          )}
          {mode === 'friend' && (
            <div className="chl-row chl-row--between">
              <span className="chl-cat">رنگ شما</span>
              <Segmented label="رنگ شما" value={color} onChange={(v) => setColor(v as typeof color)} options={[{ value: 'random', label: 'تصادفی' }, { value: 'host', label: 'سفید' }]} />
            </div>
          )}
          {mode === 'online' && (
            <>
              <div className="chl-row chl-row--between">
                <span className="chl-cat">نوع رقابت</span>
                <Segmented label="نوع رقابت" value={competition} onChange={(v) => !seek && setCompetition(v as typeof competition)} options={[{ value: 'friendly', label: 'دوستانه' }, { value: 'ranked', label: 'رتبه‌دار' }]} />
              </div>
              <p className="chl-hint">{competition === 'ranked' ? `نتیجه روی رتبهٔ ${CLS_FA[cls]} شما اثر دارد.${mode === 'online' ? ' حریف بر اساس مهارت انتخاب می‌شود.' : ''}` : 'نتیجه روی رتبهٔ شما اثری ندارد.'}</p>
            </>
          )}
          {error && <p className="chl-hint chl-hint--err" role="alert">{error}</p>}
          <div className="chl-cta">
            {seek
              ? <Button variant="secondary" size="lg" icon="x" block onClick={() => void cancel()}>لغو</Button>
              : <Button variant="primary" size="lg" icon="zap" block loading={busy} onClick={() => void play()}>بازی کن</Button>}
          </div>
        </section>
        <div className="chl__stage" aria-hidden={!seek}>{search}</div>
      </div>
    </div>
  );
}
