// Snakes and Ladders renderer: 10×10 vector board (square 1 bottom-left, alternating rows), ladders and snakes drawn
// over it, numbered player tokens (colour + number, never colour alone), die and roll button.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { LADDERS, SNAKES, type LogEntry, type SnakesView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const TOKEN_COLORS = ['#d62f35', '#1c63c9', '#23843f', '#e0a400', '#7a3fa0', '#e06a1b'];
const CELL = 60;

/** Centre of square n (1..100) in board pixels. */
function center(n: number): [number, number] {
  const row = Math.floor((n - 1) / 10);
  const inRow = (n - 1) % 10;
  const col = row % 2 === 0 ? inRow : 9 - inRow;
  return [col * CELL + CELL / 2, (9 - row) * CELL + CELL / 2];
}

function Ladder({ from, to }: { from: number; to: number }) {
  const [x1, y1] = center(from);
  const [x2, y2] = center(to);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const [nx, ny] = [(-(y2 - y1) / len) * 9, ((x2 - x1) / len) * 9];
  const rungs = Math.max(2, Math.floor(len / 22));
  return (
    <g className="sl-ladder">
      <line x1={x1 + nx} y1={y1 + ny} x2={x2 + nx} y2={y2 + ny} />
      <line x1={x1 - nx} y1={y1 - ny} x2={x2 - nx} y2={y2 - ny} />
      {Array.from({ length: rungs }, (_, i) => {
        const t = (i + 0.5) / rungs;
        const [x, y] = [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
        return <line key={i} className="sl-ladder__rung" x1={x + nx} y1={y + ny} x2={x - nx} y2={y - ny} />;
      })}
    </g>
  );
}

function Snake({ head, tail, i }: { head: number; tail: number; i: number }) {
  const [x1, y1] = center(head);
  const [x2, y2] = center(tail);
  const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
  const len = Math.hypot(x2 - x1, y2 - y1);
  const [nx, ny] = [(-(y2 - y1) / len) * 34, ((x2 - x1) / len) * 34];
  const d = `M ${x1} ${y1} C ${(x1 + mx) / 2 + nx} ${(y1 + my) / 2 + ny}, ${(mx + x2) / 2 - nx} ${(my + y2) / 2 - ny}, ${x2} ${y2}`;
  const hue = ['#2f8f4e', '#7a3fa0', '#c0392b', '#1c63c9', '#b7791f'][i % 5];
  return (
    <g className="sl-snake">
      <path d={d} stroke={hue} className="sl-snake__body" />
      <path d={d} className="sl-snake__pattern" />
      <circle cx={x1} cy={y1} r="11" fill={hue} />
      <circle cx={x1 - 4} cy={y1 - 3} r="2.4" fill="#fff" /><circle cx={x1 + 4} cy={y1 - 3} r="2.4" fill="#fff" />
    </g>
  );
}

export function Die({ value, rolling }: { value: number | null; rolling?: boolean }) {
  const pips: Record<number, [number, number][]> = {
    1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]],
    5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]]
  };
  return (
    <svg className={rolling ? 'sl-die sl-die--roll' : 'sl-die'} viewBox="0 0 40 40" role="img" aria-label={value ? `تاس: ${fa(value)}` : 'تاس هنوز ریخته نشده'}>
      <rect x="2" y="2" width="36" height="36" rx="8" />
      {(value ? pips[value]! : []).map(([x, y], i) => <circle key={i} cx={x * 10} cy={y * 10} r="3.6" />)}
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

export default function SnakesRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<SnakesView>) {
  const canRoll = legalActions.some((a) => a.type === 'roll');
  const latest = view.log.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(latest?.seq ?? 0);
  useEffect(() => {
    if (latest && latest.seq > seen.current) setAnnounce(describe(latest, seatName));
    seen.current = latest?.seq ?? 0;
  }, [latest, seatName]);

  const status = view.outcome ? null : canRoll
    ? { tone: 'mine' as const, text: 'نوبت شماست: تاس بریزید' }
    : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };

  // Tokens on the same square fan out around its centre.
  const bySquare = new Map<number, number[]>();
  view.pos.forEach((p, seat) => { if (view.active[seat] && p > 0) bySquare.set(p, [...(bySquare.get(p) ?? []), seat]); });
  const offBoard = view.pos.map((p, seat) => ({ p, seat })).filter((x) => view.active[x.seat] && x.p === 0);

  return (
    <div className="sl">
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <div className="sl-main">
        <svg className="sl-board" viewBox="0 0 600 600" role="img" aria-label={`صفحه مارپله؛ ${view.pos.map((p, s) => `${seatName(s)} روی ${p ? `خانه ${fa(p)}` : 'شروع'}`).join('، ')}`} style={{ direction: 'ltr' }}>
          {Array.from({ length: 100 }, (_, i) => {
            const n = i + 1;
            const [cx, cy] = center(n);
            return (
              <g key={n}>
                <rect x={cx - CELL / 2} y={cy - CELL / 2} width={CELL} height={CELL} className={(Math.floor(i / 10) + (i % 10)) % 2 ? 'sl-cell sl-cell--a' : 'sl-cell sl-cell--b'} />
                <text x={cx - CELL / 2 + 5} y={cy - CELL / 2 + 15} className="sl-cell__n">{fa(n)}</text>
              </g>
            );
          })}
          {Object.entries(LADDERS).map(([a, b]) => <Ladder key={a} from={Number(a)} to={b} />)}
          {Object.entries(SNAKES).map(([a, b], i) => <Snake key={a} head={Number(a)} tail={b} i={i} />)}
          {[...bySquare.entries()].flatMap(([sq, seats]) => seats.map((seat, k) => {
            const [cx, cy] = center(sq);
            const angle = (k / seats.length) * Math.PI * 2;
            const r = seats.length > 1 ? 12 : 0;
            return (
              <g key={seat} className="sl-token" style={{ transform: `translate(${cx + Math.cos(angle) * r}px, ${cy + Math.sin(angle) * r}px)` }}>
                <circle r="13" fill={TOKEN_COLORS[seat]} />
                <text y="5">{fa(seat + 1)}</text>
              </g>
            );
          }))}
        </svg>

        <div className="sl-side">
          <div className="sl-roll">
            <Die key={latest?.seq} value={view.lastDie} rolling={!!latest} />
            {canRoll && (
              <Button size="lg" disabled={busy} variant={expected?.type === 'roll' ? 'brand' : 'primary'} onClick={() => onAction({ type: 'roll' })}>تاس بریز</Button>
            )}
          </div>
          <ul className="sl-players" aria-label="بازیکنان">
            {view.pos.map((p, seat) => (
              <li key={seat} className={[view.current === seat && !view.outcome ? 'sl-player--turn' : '', view.active[seat] ? '' : 'sl-player--out'].join(' ')}>
                <span className="sl-dot" style={{ background: TOKEN_COLORS[seat] }} aria-hidden="true">{fa(seat + 1)}</span>
                <bdi>{seatName(seat)}</bdi>{seat === mySeat ? ' (شما)' : ''}
                <span className="sl-players__pos">{view.active[seat] ? (p ? `خانه ${fa(p)}` : 'شروع') : 'بیرون'}</span>
              </li>
            ))}
          </ul>
          {offBoard.length > 0 && <p className="sl-help">بیرون صفحه: {offBoard.map((x) => seatName(x.seat)).join('، ')}</p>}
          <details className="sl-log" open>
            <summary>رویدادها</summary>
            <ol>{view.log.slice(-6).reverse().map((e) => <li key={e.seq}>{describe(e, seatName)}</li>)}</ol>
          </details>
        </div>
      </div>
    </div>
  );
}
