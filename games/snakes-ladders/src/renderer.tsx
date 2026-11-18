// Snakes and Ladders renderer: 10×10 vector board (square 1 bottom-left, alternating rows), ladders and snakes drawn
// over it on a painted jungle backdrop (WebP cut from a generated sheet, see DECISIONS.md), numbered player tokens (colour + number, never colour alone), die and roll button.
import './renderer.css';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Icon, MOTION, RailSlot, TurnIndicator, ZoomBoard, motionOff, useFlip, useInFrame, usePop, type GameRendererProps, DockSlot } from '@bg/ui';
import board from './art/board.png';
import dieArt from './art/die-6.png';
import pawn1 from './art/pawn-1.png';
import pawn2 from './art/pawn-2.png';
import pawn3 from './art/pawn-3.png';
import pawn4 from './art/pawn-4.png';

const PAWNS = [pawn1, pawn2, pawn3, pawn4]; // numbered pawn discs for seats 1–4 (design art); seats 5–6 get a labelled disc
import { BoardDefs, PawnArt, pipsOf } from './art.tsx';
import { type LogEntry, type SnakesView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
export const TOKEN_COLORS = ['#d62f35', '#1c63c9', '#23843f', '#e0a400', '#7a3fa0', '#e06a1b'];
const CELL = 60;

/** Centre of square n (1..100) in board pixels. */
function center(n: number): [number, number] {
  const row = Math.floor((n - 1) / 10);
  const inRow = (n - 1) % 10;
  const col = row % 2 === 0 ? inRow : 9 - inRow;
  return [col * CELL + CELL / 2, (9 - row) * CELL + CELL / 2];
}

/** Board points a token passes: square by square from `from` to `landed` (bouncing off 100), then the ladder/snake slide. */
function walk(e: Extract<LogEntry, { t: 'roll' }>): { pts: [number, number][]; units: number[] } {
  const pts: [number, number][] = [e.from ? center(e.from) : [center(1)[0] - CELL, center(1)[1]]];
  const units: number[] = [];
  const squares: number[] = [];
  if (e.via === 'bounce') { for (let n = e.from + 1; n <= 100; n++) squares.push(n); for (let n = 99; n >= e.landed; n--) squares.push(n); }
  else if (e.via !== 'stay') for (let n = e.from + 1; n <= e.landed; n++) squares.push(n);
  for (const n of squares) { pts.push(center(n)); units.push(1); }
  if (e.to !== e.landed) { pts.push(center(e.to)); units.push(3); }
  return { pts, units };
}

export function Die({ value, rolling, pending }: { value: number | null; rolling?: boolean; pending?: boolean }) {
  return (
    <svg className={pending ? 'sl-die bg-tumble' : rolling ? 'sl-die bg-roll' : 'sl-die'} viewBox="0 0 44 44" role="img" aria-label={value ? `تاس: ${fa(value)}` : 'تاس هنوز ریخته نشده'}>
      <rect x="5" y="7" width="36" height="36" rx="9" className="sl-die__shadow" />
      <rect x="3" y="3" width="36" height="36" rx="9" fill="#fbf5e4" stroke="#8f7f58" strokeWidth="1.2" />
      <rect x="5" y="5" width="32" height="32" rx="7" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" />
      {pipsOf(value).map(([x, y], i) => (
        <g key={i}><circle cx={x * 9 + 3} cy={y * 9 + 3} r="3.5" fill="#1b130b" /><circle cx={x * 9 + 2} cy={y * 9 + 2} r="0.9" fill="#fff" opacity="0.5" /></g>
      ))}
    </svg>
  );
}

function describe(e: LogEntry, name: (s: number) => string) {
  switch (e.t) {
    case 'roll': {
      const base = `${name(e.seat)} ${fa(e.die)} آورد`;
      if (e.via === 'stay') return `${base} ولی برای رسیدن به ۱۰۰ عدد دقیق لازم بود؛ روی ${fa(e.from)} ماند.`;
      if (e.via === 'ladder') return `${base}، به ${fa(e.landed)} رسید و با نردبان تا ${fa(e.to)} بالا رفت!`;
      if (e.via === 'snake') return `${base}، روی سر مار (${fa(e.landed)}) رفت و تا ${fa(e.to)} پایین آمد.`;
      if (e.via === 'bounce') return `${base} و از ۱۰۰ برگشت تا ${fa(e.to)}.`;
      return `${base} و به خانه ${fa(e.to)} رفت.`;
    }
    case 'again': return `${name(e.seat)} ۶ آورد و دوباره تاس می‌ریزد.`;
    case 'left': return `${name(e.seat)} ${e.reason === 'resign' ? 'انصراف داد' : 'به‌دلیل غیبت کنار گذاشته شد'}.`;
    case 'timeout': return `زمان ${name(e.seat)} تمام شد؛ تاس به‌جای او ریخته شد.`;
  }
}

export default function SnakesRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<SnakesView>) {
  const canRoll = legalActions.some((a) => a.type === 'roll');
  const latest = view.log.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(latest?.seq ?? 0);
  useEffect(() => {
    if (latest && latest.seq > seen.current) setAnnounce(describe(latest, seatName));
    seen.current = latest?.seq ?? 0;
  }, [latest, seatName]);

  const root = useRef<HTMLDivElement>(null);
  // The die tumbles without pips while the own roll waits in the undo window or for the server (a roll is random, so
  // nothing else can be previewed); it is thrown once the result lands, then the token walks square by square.
  const [rollSent, setRollSent] = useState(-1);
  const rollPending = queued?.type === 'roll' || (busy && rollSent === (latest?.seq ?? 0));
  useFlip(root, `${latest?.seq ?? 0}|${rollPending}`);
  const lastRoll = [...view.log].reverse().find((e): e is Extract<SnakesView['log'][number], { t: 'roll' }> => e.t === 'roll');
  const thrown = useRef(lastRoll?.seq);
  const rolling = !!lastRoll && lastRoll.seq !== thrown.current;
  useEffect(() => { if (!rollPending) thrown.current = lastRoll?.seq; });
  const posSig = view.pos.join(',');
  const before = useRef({ pos: view.pos, seq: lastRoll?.seq });
  useLayoutEffect(() => {
    const prev = before.current;
    before.current = { pos: view.pos, seq: lastRoll?.seq };
    const host = root.current;
    if (!host || motionOff() || prev.seq === lastRoll?.seq) return;
    const fresh = view.log.filter((e) => e.t === 'roll' && e.seq > (prev.seq ?? 0));
    for (const e of fresh) {
      if (e.t !== 'roll' || e.to === e.from || prev.pos[e.seat] !== e.from || view.pos[e.seat] !== e.to) continue;
      const el = host.querySelector<SVGGElement>(`[data-token="${e.seat}"]`);
      if (!el) continue;
      const { pts, units } = walk(e);
      const [fx, fy] = center(e.to), total = units.reduce((a, b) => a + b, 0);
      let acc = 0;
      el.animate(pts.map(([x, y], k) => {
        if (k) acc += units[k - 1]!;
        return { transform: `translate(${x - fx}px, ${y - fy}px) scale(${k && k < pts.length - 1 ? 1.08 : 1})`, offset: acc / total };
      }), { duration: Math.min(300 + total * 170, 3200), delay: MOTION.roll * 0.8, easing: 'linear', fill: 'backwards' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posSig, lastRoll?.seq]);

  const status = view.outcome ? null : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' } : canRoll
    ? { tone: 'mine' as const, text: 'نوبت شماست: تاس بریزید' }
    : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };

  const framed = useInFrame() !== null;

  // Tokens on the same square fan out around its centre.
  const bySquare = new Map<number, number[]>();
  view.pos.forEach((p, seat) => { if (view.active[seat] && p > 0) bySquare.set(p, [...(bySquare.get(p) ?? []), seat]); });
  const offBoard = view.pos.map((p, seat) => ({ p, seat })).filter((x) => view.active[x.seat] && x.p === 0);

  return (
    <div className="sl" ref={root}>
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
      {framed && (
        <RailSlot>
          {mySeat !== null && (() => {
            const at = view.pos[mySeat]!;
            const ahead = view.pos.filter((p, s) => s !== mySeat && view.active[s] && p > at).length;
            return (
              <section className="sl-rail" aria-label="مسیر شما">
                <h3>مسیر شما<span className="sl-rail__note">مهرهٔ {fa(mySeat + 1)}</span></h3>
                <div className="sl-rail__pills">
                  <span className="bgv-chip">الان: {at ? fa(at) : 'شروع'}</span>
                  <span className="bgv-chip">تا ۱۰۰: {fa(100 - at)} خانه</span>
                  <span className="bgv-chip">{ahead === 0 ? 'جلوتر از همه' : `${fa(ahead)} نفر جلوتر`}</span>
                </div>
              </section>
            );
          })()}
          <p className="sl-rail__tip"><Icon name="book" size={18} />
            <span>فقط جایی که حرکت تمام می‌شود مهم است: پای نردبان بالا می‌برد و سر مار پایین. {view.finish === 'bounce' ? 'اگر تاس از ۱۰۰ بگذرد، اضافه‌ها به عقب شمرده می‌شود.' : 'برای ۱۰۰ عدد دقیق لازم است؛ تاس بزرگ‌تر یعنی این نوبت حرکت نمی‌کنید.'}</span>
          </p>
        </RailSlot>
      )}
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <div className="sl-main">
        <ZoomBoard label="صفحه مارپله">
        <svg className="sl-board" viewBox="-24 -24 648 648" role="img" aria-label={`صفحه مارپله؛ ${view.pos.map((p, s) => `${seatName(s)} روی ${p ? `خانه ${fa(p)}` : 'شروع'}`).join('، ')}`} style={{ direction: 'ltr' }}>
          <BoardDefs />
          <image href={board} x="-24" y="-24" width="648" height="648" aria-hidden="true" />
          {[...bySquare.entries()].flatMap(([sq, seats]) => seats.map((seat, k) => {
            const [cx, cy] = center(sq);
            const angle = (k / seats.length) * Math.PI * 2;
            const r = seats.length > 1 ? 12 : 0;
            return (
              <g key={seat} className="sl-token" style={{ transform: `translate(${cx + Math.cos(angle) * r}px, ${cy + Math.sin(angle) * r}px)` }}>
                <g data-token={seat} className={seat === mySeat ? 'sl-walk is-me' : 'sl-walk'}>
                  {/* Pawn discs from the design art carry their number (1–4); seats 5–6 have no art: a labelled disc. */}
                  {seat < PAWNS.length
                    ? <image href={PAWNS[seat]} x="-42" y="-56" width="83" height="95" aria-hidden="true" />
                    : <g transform="scale(1.4)"><PawnArt color={TOKEN_COLORS[seat]!} label={fa(seat + 1)} /></g>}
                </g>
              </g>
            );
          }))}
        </svg>
        </ZoomBoard>

        <div className="sl-side">
          {framed ? (
            // Frame: one turn card in the dock row (die, what the last roll did, the roll button); no empty die before the first roll.
            (rollPending || view.lastDie || canRoll) && (
              <DockSlot>
                <div className="sl-turn">
                  {rollPending ? <Die key="pending" value={null} pending /> : view.lastDie ? <Die key={lastRoll?.seq ?? 0} value={view.lastDie} rolling={rolling} /> : null}
                  {lastRoll && !rollPending && <p className="sl-turn__t">{describe(lastRoll, (x) => (x === mySeat ? 'شما' : seatName(x)))}</p>}
                  {canRoll && <Button icon="turn" disabled={busy} variant={expected?.type === 'roll' ? 'brand' : 'primary'} onClick={() => { setRollSent(latest?.seq ?? 0); onAction({ type: 'roll' }); }}>ریختن تاس</Button>}
                </div>
              </DockSlot>
            )
          ) : (
            <div className="sl-roll">
              {rollPending ? <Die key="pending" value={null} pending /> : <Die key={lastRoll?.seq ?? 0} value={view.lastDie} rolling={rolling} />}
              {canRoll && (
                <DockSlot><Button size="lg" disabled={busy} variant={expected?.type === 'roll' ? 'brand' : 'primary'} onClick={() => { setRollSent(latest?.seq ?? 0); onAction({ type: 'roll' }); }}><img className="sl-btn-die" src={dieArt} alt="" aria-hidden="true" />تاس بریز</Button></DockSlot>
              )}
            </div>
          )}
          {!framed && <ul className="sl-players" aria-label="بازیکنان">
            {view.pos.map((p, seat) => (
              <li key={seat} className={[view.current === seat && !view.outcome ? 'sl-player--turn' : '', view.active[seat] ? '' : 'sl-player--out'].join(' ')}>
                <span className="sl-dot" style={{ background: TOKEN_COLORS[seat], ...(seat === 3 ? { color: '#1b1300' } : {}) }} aria-hidden="true">{fa(seat + 1)}</span>
                <bdi>{seatName(seat)}</bdi>{seat === mySeat ? ' (شما)' : ''}
                <Pos p={p} active={view.active[seat]!} />
              </li>
            ))}
          </ul>}
          {!framed && offBoard.length > 0 && <p className="sl-help">بیرون صفحه: {offBoard.map((x) => seatName(x.seat)).join('، ')}</p>}
          {!framed && <details className="sl-log" open>
            <summary>رویدادها</summary>
            <ol>{view.log.slice(-6).reverse().map((e) => <li key={e.seq}>{describe(e, seatName)}</li>)}</ol>
          </details>}
        </div>
      </div>
    </div>
  );
}

// The square a player is on, bumping when it changes.
function Pos({ p, active }: { p: number; active: boolean }) {
  return <span key={p} className={`sl-players__pos ${usePop(p)}`}>{active ? (p ? `خانه ${fa(p)}` : 'شروع') : 'بیرون'}</span>;
}
