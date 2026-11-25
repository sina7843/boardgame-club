// Chess «بازی جدید» (design/games/chess D01, D18, D19, P01, P22, P23; CX-13): online / with a friend / with a bot, the grouped
// time picker (بولت، بلیتس، رپید; increments only for friends), «نوع رقابت», colour choice, and on the felt the faded starting
// position with the search / invite / bot card on top of it (CHESS-FIX-SPEC U2, U8, U9).
// Online pairing goes through matchmaking with the clock (main row only, as the owner decided), so ranked games keep
// the skill window and the server's rule that ranked tables come only from ranked matchmaking.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { BOT_LEVEL_FA, type TableSnapshot, type TicketView } from '@bg/contracts';
import { Avatar, Button, GameBar, Icon, Segmented, StateBlock } from '@bg/ui/bgv';
import type { PieceType } from '@bg/game-chess';
import { pieceSrc } from '@bg/game-chess/pieces';
import { api, ApiFailure } from '../lib/api.ts';
import { faNum } from '../lib/format.ts';
import { useSession } from '../lib/session.tsx';
import { usePageTitle } from '../lib/usePageTitle.ts';
import { BOT_RATING, clockLabelFa } from '../games/chessClock.ts';
import { useCopy } from '../social/InviteCard.tsx';

type Mode = 'online' | 'friend' | 'bot';
type Cls = 'bullet' | 'blitz' | 'rapid';
type Color = 'white' | 'random' | 'black';
type Level = 'easy' | 'medium' | 'hard';
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
const COLOR_FA: Record<Color, string> = { white: 'سفید', random: 'تصادفی', black: 'سیاه' };
// Who plays White when a friend table is made: `firstMove` option of the game (host = me White, guest = me Black).
const FIRST_MOVE: Record<Color, string> = { white: 'host', random: 'random', black: 'guest' };

/**
 * Approximate rating of each bot level. Estimated from games/chess/src/bot.ts (material + placement alpha-beta; easy: depth 1,
 * 35% random move; medium: depth 2, 15% second-best; hard: depth 4 capped at 8,000 nodes), NOT measured against rated players:
 * the design's 800 / 1,200 / 1,600 are higher than this engine plays. Replace with measured values when a bot-vs-rated run exists.
 */
const BOTS: Record<Level, { rating: number; initial: string; seat: 3 | 2 | 5 }> = {
  easy: { rating: BOT_RATING.easy, initial: 'آ', seat: 3 }, medium: { rating: BOT_RATING.medium, initial: 'م', seat: 2 }, hard: { rating: BOT_RATING.hard, initial: 'س', seat: 5 }
};
const botLine = (l: Level) => `حدود ${faNum(BOTS[l].rating)}`;

const START_RANKS = ['rnbqkbnr', 'pppppppp', '', '', '', '', 'PPPPPPPP', 'RNBQKBNR'];
const FILES = 'abcdefgh';

/** The starting position as a faded decoration (art from the renderer's piece set; the player's colour at the bottom). */
function GhostBoard({ black }: { black: boolean }) {
  const cells: { key: string; light: boolean; piece?: string; rank?: string; file?: string }[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const r = black ? 7 - row : row; // rank index from the top (0 = rank 8)
      const f = black ? 7 - col : col;
      const ch = START_RANKS[r]!.length ? START_RANKS[r]![f] : undefined;
      cells.push({
        key: `${f}${r}`, light: (f + r) % 2 === 0, ...(ch ? { piece: pieceSrc(ch.toUpperCase() as PieceType, ch === ch.toUpperCase() ? 'w' : 'b') } : {}),
        ...(col === 0 ? { rank: String(8 - r) } : {}), ...(row === 7 ? { file: FILES[f]! } : {})
      });
    }
  }
  return (
    <div className="chl-board" dir="ltr" aria-hidden="true" data-testid="chl-board" data-bottom={black ? 'black' : 'white'}>
      {cells.map((c) => (
        <span key={c.key} className={c.light ? 'chl-sq l' : 'chl-sq d'}>
          {c.piece && <img src={c.piece} alt="" draggable={false} />}
          {c.rank && <b className="chl-co chl-co--r">{c.rank}</b>}
          {c.file && <b className="chl-co chl-co--f">{c.file}</b>}
        </span>
      ))}
    </div>
  );
}

interface Invite { id: string; url: string }

export function ChessLobby() {
  const { me, status } = useSession();
  const navigate = useNavigate();
  const copy = useCopy();
  usePageTitle('بازی جدید شطرنج');
  useEffect(() => { document.documentElement.dataset.immersive = 'true'; return () => { delete document.documentElement.dataset.immersive; }; }, []);
  const [mode, setMode] = useState<Mode>('online');
  const [clock, setClock] = useState('5+0');
  const [more, setMore] = useState(true);
  const [competition, setCompetition] = useState<'friendly' | 'ranked'>('ranked');
  const [color, setColor] = useState<Color>('random');
  const [level, setLevel] = useState<Level>('medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seek, setSeek] = useState<{ ticketId: string; since: number } | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [now, setNow] = useState(Date.now());
  const waiting = !!seek || !!invite;

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

  // Waiting for a friend: open the table as soon as the second player has sat down (the server starts the game).
  useEffect(() => {
    if (!invite) return;
    const poll = setInterval(() => {
      api<TableSnapshot>(`/tables/${invite.id}`).then((s) => {
        if (s.table.status !== 'open' || s.table.seats.filter((x) => x.user).length >= 2) navigate(`/tables/${invite.id}`);
      }, () => undefined);
    }, 2000);
    return () => clearInterval(poll);
  }, [invite, navigate]);

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
        const { id } = await api<{ id: string }>('/tables/bot', { method: 'POST', body: { gameId: 'chess', level, playerCount: 2, ...(color !== 'random' ? { color } : {}) } });
        navigate(`/tables/${id}`);
      } else if (mode === 'friend') {
        const { id } = await create('private', { firstMove: FIRST_MOVE[color] });
        const { table } = await api<TableSnapshot>(`/tables/${id}`);
        const q = table.inviteCode ? `?invite=${table.inviteCode}` : '';
        // Invite links stay /tables/<id>?invite=… (DECISIONS 2026-11-13): /t/<code> never opens a private table to someone not seated.
        setInvite({ id, url: `${location.origin}/tables/${id}${q}` });
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
    const s = seek, i = invite;
    setSeek(null); setInvite(null);
    if (s) await api(`/matchmaking/tickets/${s.ticketId}`, { method: 'DELETE' }).catch(() => undefined);
    if (i) await api(`/tables/${i.id}/leave`, { method: 'POST', body: {} }).catch(() => undefined);
  };

  const cls = clsOf(clock);
  const showMore = mode === 'friend' && more; // increments: friends (and tournaments) only, never in «آنلاین»
  const tile = (v: string) => (
    <button key={v} type="button" className={isMore(v) ? 'chl-tile chl-tile--inc' : 'chl-tile'} aria-pressed={clock === v} disabled={waiting} onClick={() => setClock(v)}>
      <b dir={inc(v) ? 'ltr' : undefined}>{tileFa(v)}</b>
    </button>
  );
  const meta = `${clockLabelFa(clock)}، ${mode === 'friend' ? 'دوستانه' : competition === 'ranked' ? 'رتبه‌دار' : 'دوستانه'}`;
  const secs = seek ? Math.floor((now - seek.since) / 1000) : 0;
  const card = seek ? (
    <div className="chl-seek" role="status">
      <span className="chl-ring" aria-hidden="true" />
      <h3>دنبال حریف می‌گردیم…</h3>
      <p>{meta}</p>
      <span className="chl-seek__t" dir="ltr">{faNum(Math.floor(secs / 60))}:{faNum(secs % 60).padStart(2, '۰')}</span>
      <span className="chl-seek__cancel"><Button variant="secondary" icon="x" block onClick={() => void cancel()}>لغو</Button></span>
    </div>
  ) : invite ? (
    <div className="chl-seek chl-seek--invite" role="status">
      <span className="chl-ring" aria-hidden="true" />
      <h3>منتظر دوستتان هستیم…</h3>
      <p>لینک را بفرستید. وقتی دوستتان آن را باز کند، بازی خودش شروع می‌شود.</p>
      <div className="chl-link">
        <input className="bgv-input" readOnly dir="ltr" aria-label="لینک دعوت" value={invite.url} onFocus={(e) => e.currentTarget.select()} />
        <Button variant="primary" icon="copy" onClick={() => void copy(invite.url, 'لینک دعوت کپی شد.')}>کپی</Button>
      </div>
      <p className="chl-seek__meta">{meta}، رنگ {COLOR_FA[color]}</p>
      <span className="chl-seek__cancel"><Button variant="secondary" icon="x" block onClick={() => void cancel()}>لغو دعوت</Button></span>
    </div>
  ) : mode === 'bot' ? (
    <div className="chl-botcard">
      <Avatar name={`ربات ${BOT_LEVEL_FA[level]}`} initials={BOTS[level].initial} seat={BOTS[level].seat} size="lg" />
      <div><h3>ربات {BOT_LEVEL_FA[level]}</h3><p>{botLine(level)}</p></div>
    </div>
  ) : null;

  return (
    <div className={waiting ? (invite ? 'chl chl--seeking chl--invite' : 'chl chl--seeking') : 'chl'}>
      <GameBar title="شطرنج" latin="Chess" onBack={() => navigate('/games/chess')} backLabel="بازگشت به صفحهٔ شطرنج" meta={['شطرنج', 'بازی جدید']} />
      <div className="chl__body">
        <section className="chl__side" aria-labelledby="chl-h">
          <span className="chl-handle" aria-hidden="true" />
          <div className="chl-row chl-row--between">
            <h1 id="chl-h" className="chl-h">بازی جدید شطرنج</h1>
            <span className="chl-close"><Button variant="ghost" iconOnly icon="x" onClick={() => navigate('/games/chess')}>بستن</Button></span>
          </div>
          <Segmented label="نوع بازی" block value={mode} onChange={(v) => !waiting && setMode(v as Mode)}
            options={[{ value: 'online', label: 'آنلاین', icon: 'globe' }, { value: 'friend', label: 'با دوست', icon: 'users' }, { value: 'bot', label: 'با ربات', icon: 'bot' }]} />
          {mode !== 'bot' ? (
            <div className="chl-tc" role="group" aria-label="زمان بازی">
              {ROWS.map((r) => (
                <div key={r.cls} className="chl-tc__row">
                  <span className="chl-cat"><Icon name={r.icon as 'zap'} size={18} />{r.fa}</span>
                  <div className="chl-tc__grid">{r.main.map(tile)}{showMore && r.more.map(tile)}</div>
                </div>
              ))}
              {mode === 'friend' && (
                <>
                  <button type="button" className="chl-more" aria-expanded={more} onClick={() => setMore((m) => !m)}>
                    <Icon name="chevron-down" size={18} className={more ? 'chl-more__up' : undefined} />{more ? 'زمان‌های کمتر' : 'زمان‌های بیشتر'}
                  </button>
                  {more && <p className="chl-hint">در «۳ + ۲» بعد از هر حرکت ۲ ثانیه به ساعت شما اضافه می‌شود. این زمان‌ها برای بازی با دوست و مسابقه است.</p>}
                </>
              )}
            </div>
          ) : (
            <>
              <span className="chl-cat">سطح ربات</span>
              <div className="chl-bots" role="radiogroup" aria-label="سطح ربات">
                {(['easy', 'medium', 'hard'] as const).map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={level === l} className="chl-bot" onClick={() => setLevel(l)}>
                    <Avatar initials={BOTS[l].initial} seat={BOTS[l].seat} size="md" />
                    <b>{BOT_LEVEL_FA[l]}</b>
                    <small>{botLine(l)}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {mode !== 'online' && (
            <div className="chl-row chl-row--between">
              <span className="chl-cat" id="chl-color">رنگ شما</span>
              <div className="chl-colors" role="radiogroup" aria-labelledby="chl-color">
                {(['white', 'random', 'black'] as const).map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={COLOR_FA[c]} disabled={waiting} onClick={() => setColor(c)}>
                    {c === 'random' ? <Icon name="dices" size={22} /> : <img src={pieceSrc('K', c === 'white' ? 'w' : 'b')} alt="" draggable={false} />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mode === 'bot' && <p className="chl-hint">بازی با ربات دوستانه است، ساعت ندارد و روی رتبه اثری ندارد.</p>}
          {mode === 'online' && (
            <>
              <div className="chl-row chl-row--between">
                <span className="chl-cat">نوع رقابت</span>
                <Segmented label="نوع رقابت" value={competition} onChange={(v) => !waiting && setCompetition(v as typeof competition)} options={[{ value: 'friendly', label: 'دوستانه' }, { value: 'ranked', label: 'رتبه‌دار' }]} />
              </div>
              <p className="chl-hint">{competition === 'ranked' ? `نتیجه روی رتبهٔ ${CLS_FA[cls]} شما اثر دارد. حریف بر اساس مهارت انتخاب می‌شود.` : 'نتیجه روی رتبهٔ شما اثری ندارد.'}</p>
            </>
          )}
          {error && <p className="chl-hint chl-hint--err" role="alert">{error}</p>}
          <div className="chl-cta">
            {waiting
              ? <Button variant="secondary" size="lg" icon="x" block onClick={() => void cancel()}>{invite ? 'لغو دعوت' : 'لغو'}</Button>
              : <Button variant="primary" size="lg" icon="zap" block loading={busy} onClick={() => void play()}>بازی کن</Button>}
          </div>
        </section>
        <div className="chl__stage">
          <GhostBoard black={mode !== 'online' && color === 'black'} />
          {card && <div className="chl-stagecard">{card}</div>}
        </div>
      </div>
    </div>
  );
}
