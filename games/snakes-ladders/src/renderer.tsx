// Snakes and Ladders renderer: 10×10 vector board (square 1 bottom-left, alternating rows), ladders and snakes drawn
// over it on a painted jungle backdrop (WebP cut from a generated sheet, see DECISIONS.md), numbered player tokens (colour + number, never colour alone), die and roll button.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, ZoomBoard, useFlip, type GameRendererProps } from '@bg/ui';
import jungle from './art/bd-jungle.webp';
import dieArt from './art/die.webp';
import { BoardDefs, LadderArt, PawnArt, SnakeArt, pipsOf } from './art.tsx';
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

export function Die({ value, rolling }: { value: number | null; rolling?: boolean }) {
  return (
    <svg className={rolling ? 'sl-die bg-roll' : 'sl-die'} viewBox="0 0 44 44" role="img" aria-label={value ? `تاس: ${fa(value)}` : 'تاس هنوز ریخته نشده'}>
      <rect x="5" y="7" width="36" height="36" rx="9" className="sl-die__shadow" />
      <rect x="3" y="3" width="36" height="36" rx="9" fill="url(#sl-die-face)" stroke="#8f7f58" strokeWidth="1.2" />
      <rect x="5" y="5" width="32" height="32" rx="7" fill="none" stroke="url(#sl-bevel)" strokeWidth="2" />
      {pipsOf(value).map(([x, y], i) => (
        <g key={i}><circle cx={x * 9 + 3} cy={y * 9 + 3} r="3.5" fill="url(#sl-pip)" /><circle cx={x * 9 + 2} cy={y * 9 + 2} r="0.9" fill="#fff" opacity="0.5" /></g>
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

export default function SnakesRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<SnakesView>) {
  const canRoll = legalActions.some((a) => a.type === 'roll');
  const latest = view.log.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(latest?.seq ?? 0);
  useEffect(() => {
    if (latest && latest.seq > seen.current) setAnnounce(describe(latest, seatName));
    seen.current = latest?.seq ?? 0;
  }, [latest, seatName]);

  const root = useRef<HTMLDivElement>(null);
  useFlip(root, latest?.seq ?? 0);

  const status = view.outcome ? null : canRoll
    ? { tone: 'mine' as const, text: 'نوبت شماست: تاس بریزید' }
    : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };

  // Tokens on the same square fan out around its centre.
  const bySquare = new Map<number, number[]>();
  view.pos.forEach((p, seat) => { if (view.active[seat] && p > 0) bySquare.set(p, [...(bySquare.get(p) ?? []), seat]); });
  const offBoard = view.pos.map((p, seat) => ({ p, seat })).filter((x) => view.active[x.seat] && x.p === 0);

  return (
    <div className="sl" ref={root}>
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <div className="sl-main">
        <ZoomBoard label="صفحه مارپله">
        <svg className="sl-board" viewBox="-18 -18 636 636" role="img" aria-label={`صفحه مارپله؛ ${view.pos.map((p, s) => `${seatName(s)} روی ${p ? `خانه ${fa(p)}` : 'شروع'}`).join('، ')}`} style={{ direction: 'ltr' }}>
          <BoardDefs />
          <rect x="-18" y="-18" width="636" height="636" rx="16" fill="url(#sl-wood)" className="sl-frame" />
          <rect x="-18" y="-18" width="636" height="636" rx="16" fill="url(#sl-grain)" />
          <rect x="-4" y="-4" width="608" height="608" rx="5" className="sl-frame__lip" />
          <image href={jungle} width="600" height="600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" />
          {Array.from({ length: 100 }, (_, i) => {
            const n = i + 1;
            const [cx, cy] = center(n);
            const [x, y] = [cx - CELL / 2, cy - CELL / 2];
            return (
              <g key={n}>
                <rect x={x} y={y} width={CELL} height={CELL} className={`sl-cell sl-cell--${(Math.floor(i / 10) + 2 * (i % 10)) % 4}`} />
                <rect x={x + 1.5} y={y + 1.5} width={CELL - 3} height={CELL - 3} rx="2" fill="none" stroke="url(#sl-bevel)" strokeWidth="2" />
                <text x={x + 5} y={y + 15} className="sl-cell__n">{fa(n)}</text>
              </g>
            );
          })}
          <rect width="600" height="600" fill="url(#sl-paper)" pointerEvents="none" />
          <rect width="600" height="600" fill="url(#sl-vignette)" pointerEvents="none" />
          <g aria-hidden="true" className="sl-cell__tag">
            <text x={center(1)[0]} y={center(1)[1] + 22}>شروع</text>
            <text x={center(100)[0]} y={center(100)[1] + 22}>پایان ★</text>
          </g>
          {Object.entries(LADDERS).map(([a, b]) => { const [x1, y1] = center(Number(a)), [x2, y2] = center(b); return <LadderArt key={a} x1={x1} y1={y1} x2={x2} y2={y2} />; })}
          {Object.entries(SNAKES).map(([a, b], i) => { const [x1, y1] = center(Number(a)), [x2, y2] = center(b); return <SnakeArt key={a} x1={x1} y1={y1} x2={x2} y2={y2} hue={i % 5} />; })}
          {[...bySquare.entries()].flatMap(([sq, seats]) => seats.map((seat, k) => {
            const [cx, cy] = center(sq);
            const angle = (k / seats.length) * Math.PI * 2;
            const r = seats.length > 1 ? 12 : 0;
            return (
              <g key={seat} className="sl-token" style={{ transform: `translate(${cx + Math.cos(angle) * r}px, ${cy + Math.sin(angle) * r}px)` }}>
                <g data-flip={`token-${seat}`}><PawnArt color={TOKEN_COLORS[seat]!} label={fa(seat + 1)} dark={seat === 3} /></g>
              </g>
            );
          }))}
          {[[-9, -9], [609, -9], [-9, 609], [609, 609]].map(([x, y]) => <circle key={`${x}${y}`} className="sl-stud" cx={x} cy={y} r="5" fill="url(#sl-brass)" aria-hidden="true" />)}
        </svg>
        </ZoomBoard>

        <div className="sl-side">
          <div className="sl-roll">
            <Die key={latest?.seq} value={view.lastDie} rolling={!!latest} />
            {canRoll && (
              <Button size="lg" disabled={busy} variant={expected?.type === 'roll' ? 'brand' : 'primary'} onClick={() => onAction({ type: 'roll' })}><img className="sl-btn-die" src={dieArt} alt="" aria-hidden="true" />تاس بریز</Button>
            )}
          </div>
          <ul className="sl-players" aria-label="بازیکنان">
            {view.pos.map((p, seat) => (
              <li key={seat} className={[view.current === seat && !view.outcome ? 'sl-player--turn' : '', view.active[seat] ? '' : 'sl-player--out'].join(' ')}>
                <span className="sl-dot" style={{ background: TOKEN_COLORS[seat], ...(seat === 3 ? { color: '#1b1300' } : {}) }} aria-hidden="true">{fa(seat + 1)}</span>
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
