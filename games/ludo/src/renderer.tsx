// Ludo (منچ) renderer: classic cross board on an 11×11 grid. Pieces carry their colour, a number and a text label;
// movable pieces are buttons and their landing square is outlined. Board coordinates are literal (ltr).
// Visuals: wooden frame, painted carpet under a semi-opaque printed board, vector squares and yards, painted pawns
// (WebP cut from a generated sheet, see DECISIONS.md).
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, ZoomBoard, type GameRendererProps } from '@bg/ui';
import carpet from './art/bd-carpet.webp';
import dieArt from './art/die.webp';
import pawnRed from './art/pawn-red.webp';
import pawnGreen from './art/pawn-green.webp';
import pawnYellow from './art/pawn-yellow.webp';
import pawnBlue from './art/pawn-blue.webp';
import { TRACK, trackSquare, type LogEntry, type LudoView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const C = 50;
export const SLOT_COLORS = ['#d62f35', '#23843f', '#e0a400', '#1c63c9'];
const PAWN_ART = [pawnRed, pawnGreen, pawnYellow, pawnBlue]; // same order as SLOT_COLORS
export const SLOT_FA = ['قرمز', 'سبز', 'زرد', 'آبی'];
const TRACK_XY: [number, number][] = [
  [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0],
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [10, 5],
  [10, 6], [9, 6], [8, 6], [7, 6], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [5, 10],
  [4, 10], [4, 9], [4, 8], [4, 7], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 5]
];
const GOAL_XY: [number, number][][] = [
  [[1, 5], [2, 5], [3, 5], [4, 5]], [[5, 1], [5, 2], [5, 3], [5, 4]], [[9, 5], [8, 5], [7, 5], [6, 5]], [[5, 9], [5, 8], [5, 7], [5, 6]]
];
const YARD_XY: [number, number][][] = [
  [[0, 0], [1, 0], [0, 1], [1, 1]], [[9, 0], [10, 0], [9, 1], [10, 1]], [[9, 9], [10, 9], [9, 10], [10, 10]], [[0, 9], [1, 9], [0, 10], [1, 10]]
];
const px = ([x, y]: [number, number]): [number, number] => [x * C + C / 2, y * C + C / 2];

/** Board position of a piece. */
function where(slot: number, piece: number, progress: number): [number, number] {
  if (progress < 0) return px(YARD_XY[slot]![piece]!);
  if (progress >= TRACK) return px(GOAL_XY[slot]![progress - TRACK]!);
  return px(TRACK_XY[trackSquare(slot, progress)]!);
}
const placeFa = (p: number) => (p < 0 ? 'در لانه' : p >= TRACK ? `در خانه (${fa(p - TRACK + 1)})` : `${fa(p + 1)} خانه از شروع`);

function describe(e: LogEntry, name: (s: number) => string) {
  switch (e.t) {
    case 'roll': return `${name(e.seat)} ${fa(e.die)} آورد.`;
    case 'move': return `${name(e.seat)} مهره ${fa(e.piece + 1)} را ${e.from < 0 ? 'از لانه بیرون آورد' : e.to >= TRACK ? 'به خانه برد' : 'جلو برد'}${e.captured ? ` و مهره ${name(e.captured.seat)} را زد!` : ''}.`;
    case 'noMove': return `${name(e.seat)} حرکتی نداشت.`;
    case 'again': return `${name(e.seat)} ۶ آورد و دوباره تاس می‌ریزد.`;
    case 'finished': return `${name(e.seat)} همه مهره‌هایش را به خانه رساند!`;
    case 'left': return `${name(e.seat)} ${e.reason === 'resign' ? 'انصراف داد' : 'به‌دلیل غیبت کنار گذاشته شد'}.`;
    case 'timeout': return `زمان ${name(e.seat)} تمام شد؛ نوبتش خودکار بازی شد.`;
  }
}

function Die({ value, rolling }: { value: number | null; rolling?: boolean }) {
  const pips: Record<number, [number, number][]> = {
    1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]],
    5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]]
  };
  return (
    <svg className={rolling ? 'ld-die ld-die--roll' : 'ld-die'} viewBox="0 0 48 48" role="img" aria-label={value ? `تاس: ${fa(value)}` : 'تاس'}>
      <defs>
        <linearGradient id="ldd-face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="0.6" stopColor="#f6efdc" /><stop offset="1" stopColor="#d8cdb0" /></linearGradient>
        <radialGradient id="ldd-pip" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#5a4a3c" /><stop offset="1" stopColor="#120c06" /></radialGradient>
        <filter id="ldd-shadow" x="-30%" y="-30%" width="170%" height="170%"><feGaussianBlur stdDeviation="1.6" /></filter>
      </defs>
      <rect x="6" y="8" width="38" height="38" rx="9" fill="#000" opacity="0.35" filter="url(#ldd-shadow)" aria-hidden="true" />
      <rect className="ld-die__body" x="4" y="4" width="38" height="38" rx="9" fill="url(#ldd-face)" />
      <rect x="6" y="6" width="34" height="34" rx="7" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.2" aria-hidden="true" />
      {(value ? pips[value]! : []).map(([x, y], i) => <circle key={i} cx={x * 10 + 2} cy={y * 10 + 2} r="3.7" fill="url(#ldd-pip)" />)}
    </svg>
  );
}

const CELL = 19;
const ROT = [0, 90, 180, 270];
const STAR = '0,-9 2.6,-2.6 9,0 2.6,2.6 0,9 -2.6,2.6 -9,0 -2.6,-2.6';
const HOME = 28;

/** One bevelled printed square; `tint` marks start and goal squares in the player's colour. */
function Cell({ xy, tint }: { xy: [number, number]; tint?: string }) {
  const [x, y] = px(xy);
  return (
    <g>
      <rect x={x - CELL} y={y - CELL} width={CELL * 2} height={CELL * 2} rx="8" className="ld-cell" fill="url(#ldg-cell)" />
      {tint && <rect x={x - CELL} y={y - CELL} width={CELL * 2} height={CELL * 2} rx="8" className="ld-cell__tint" fill={tint} />}
      <rect x={x - CELL + 2} y={y - CELL + 2} width={CELL * 2 - 4} height={CELL * 2 - 4} rx="6" className="ld-cell__hi" />
    </g>
  );
}

/** Painted pawn, centred on the origin (aria-hidden: the piece group carries the label). */
function Pawn({ slot }: { slot: number }) {
  return <image className="ld-pawn" href={PAWN_ART[slot]} x="-24" y="-26" width="48" height="48" aria-hidden="true" />;
}

export default function LudoRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<LudoView>) {
  const canRoll = legalActions.some((a) => a.type === 'roll');
  const moves = legalActions.filter((a) => a.type === 'move') as unknown as { piece: number; to: number }[];
  const latest = view.log.at(-1);
  const [announce, setAnnounce] = useState('');
  const seen = useRef(latest?.seq ?? 0);
  useEffect(() => {
    if (latest && latest.seq > seen.current) setAnnounce(describe(latest, seatName));
    seen.current = latest?.seq ?? 0;
  }, [latest, seatName]);
  const lastRoll = [...view.log].reverse().find((e) => e.t === 'roll');

  const mine = mySeat !== null ? view.slots[mySeat]! : null;
  const status = view.outcome ? null : canRoll
    ? { tone: 'mine' as const, text: view.tries > 1 ? `نوبت شماست: تاس بریزید (${fa(view.tries)} فرصت برای ۶)` : 'نوبت شماست: تاس بریزید' }
    : moves.length ? { tone: 'mine' as const, text: `${fa(view.die ?? 0)} آوردید: مهره‌ای را که می‌خواهید حرکت دهید بزنید` }
      : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)} (${SLOT_FA[view.slots[view.current]!]})` };

  return (
    <div className="ld">
      <p className="visually-hidden" role="status" aria-live="polite">{announce}</p>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <div className="ld-main">
        <ZoomBoard label="صفحه منچ">
        <svg className="ld-board" viewBox="-16 -16 582 582" role="group" aria-label="صفحه منچ" style={{ direction: 'ltr' }}>
          <defs>
            <linearGradient id="ldg-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a8754a" /><stop offset="0.5" stopColor="#8a5a32" /><stop offset="1" stopColor="#5e3a1e" /></linearGradient>
            <pattern id="ldg-grain" width="90" height="9" patternUnits="userSpaceOnUse">
              <path d="M0 2 Q22 0 45 2 T90 2 M0 6 Q30 8 60 6 T90 6" fill="none" stroke="#2a1608" strokeOpacity="0.18" strokeWidth="0.8" />
              <path d="M0 4 H90" stroke="#fff" strokeOpacity="0.05" strokeWidth="0.8" />
            </pattern>
            <pattern id="ldg-linen" width="6" height="6" patternUnits="userSpaceOnUse">
              <path d="M0 0 H6 M0 3 H6" stroke="#8a6a3a" strokeOpacity="0.07" strokeWidth="0.6" /><path d="M0 0 V6 M3 0 V6" stroke="#8a6a3a" strokeOpacity="0.05" strokeWidth="0.6" />
            </pattern>
            <linearGradient id="ldg-paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#f2e6c8" /></linearGradient>
            <linearGradient id="ldg-edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="0.5" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.55" /></linearGradient>
            <linearGradient id="ldg-inner" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#000" stopOpacity="0.5" /><stop offset="0.5" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="0.5" /></linearGradient>
            <linearGradient id="ldg-cell" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e6dbc0" /></linearGradient>
            <linearGradient id="ldg-well" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b3a487" /><stop offset="1" stopColor="#fffdf7" /></linearGradient>
            <linearGradient id="ldg-tri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.4" /><stop offset="1" stopColor="#000" stopOpacity="0.3" /></linearGradient>
            <radialGradient id="ldg-gold" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#fff2b0" /><stop offset="1" stopColor="#b8860b" /></radialGradient>
            <filter id="ldg-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
          </defs>
          {/* wooden frame, bevelled, with grain */}
          <g aria-hidden="true">
            <rect x="-16" y="-16" width="582" height="582" rx="22" fill="url(#ldg-wood)" />
            <rect x="-16" y="-16" width="582" height="582" rx="22" fill="url(#ldg-grain)" />
            <rect x="-15" y="-15" width="580" height="580" rx="21" fill="none" stroke="url(#ldg-edge)" strokeWidth="2.5" />
            {/* printed card board inset into the frame */}
            <image href={carpet} width="550" height="550" preserveAspectRatio="xMidYMid slice" />
            <rect width="550" height="550" rx="6" className="ld-board__bg" fill="url(#ldg-paper)" fillOpacity="0.6" />
            <rect width="550" height="550" rx="6" fill="url(#ldg-linen)" />
            <rect x="-1" y="-1" width="552" height="552" rx="7" fill="none" stroke="url(#ldg-inner)" strokeWidth="3" />
          </g>
          {YARD_XY.map((cells, slot) => {
            const x = Math.min(...cells.map((c) => c[0])) * C + 2, y = Math.min(...cells.map((c) => c[1])) * C + 2;
            const inGame = view.slots.includes(slot);
            const turn = !view.outcome && view.slots[view.current] === slot;
            return (
              <g key={slot} className={turn ? 'ld-yard ld-yard--turn' : 'ld-yard'} style={{ color: SLOT_COLORS[slot] }} opacity={inGame ? 1 : 0.45} aria-hidden="true">
                <rect x={x} y={y} width={2 * C - 4} height={2 * C - 4} rx="14" fill={SLOT_COLORS[slot]} />
                <rect x={x} y={y} width={2 * C - 4} height={2 * C - 4} rx="14" fill="url(#ldg-tri)" />
                <rect x={x + 8} y={y + 8} width={2 * C - 20} height={2 * C - 20} rx="10" fill="#fffaf0" fillOpacity="0.88" />
                <rect x={x + 8} y={y + 8} width={2 * C - 20} height={2 * C - 20} rx="10" fill="none" stroke="url(#ldg-inner)" strokeWidth="2.5" />
                <rect x={x} y={y} width={2 * C - 4} height={2 * C - 4} rx="14" fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1.5" />
              </g>
            );
          })}
          <g className="ld-track" aria-hidden="true">
            {TRACK_XY.map((xy, i) => <Cell key={i} xy={xy} {...(i % 10 === 0 ? { tint: SLOT_COLORS[i / 10]! } : {})} />)}
            {GOAL_XY.map((cells, slot) => cells.map((xy, i) => <Cell key={`${slot}${i}`} xy={xy} tint={SLOT_COLORS[slot]!} />))}
          </g>
          <g aria-hidden="true">
            {TRACK_XY.map((xy, i) => { if (i % 10) return null; const [x, y] = px(xy); return <polygon key={`s${i}`} points={STAR} transform={`translate(${x} ${y})`} className="ld-start" />; })}
            {GOAL_XY.map((cells, slot) => cells.map((xy, i) => { const [x, y] = px(xy); return <g key={`a${slot}${i}`} transform={`translate(${x} ${y}) rotate(${ROT[slot]})`}><polyline points="-5,-7 4,0 -5,7" className="ld-arrow ld-arrow--under" /><polyline points="-5,-7 4,0 -5,7" className="ld-arrow" /></g>; }))}
            {SLOT_COLORS.map((color, slot) => {
              const [cx, cy] = px([5, 5]), h = HOME;
              const pts = [[[-h, -h], [-h, h]], [[-h, -h], [h, -h]], [[h, -h], [h, h]], [[-h, h], [h, h]]][slot]!;
              const d = `${cx},${cy} ${cx + pts[0]![0]!},${cy + pts[0]![1]!} ${cx + pts[1]![0]!},${cy + pts[1]![1]!}`;
              return <g key={`h${slot}`}><polygon points={d} fill={color} /><polygon points={d} fill="url(#ldg-tri)" stroke="#3a2a1a" strokeWidth="1.5" strokeLinejoin="round" /></g>;
            })}
            <g transform="translate(275 275)"><circle r="10" fill="url(#ldg-gold)" stroke="#3a2a1a" strokeWidth="1.5" /><polygon points={STAR} transform="scale(0.55)" fill="#fff" fillOpacity="0.9" /></g>
            {YARD_XY.map((cells, slot) => cells.map((xy, i) => { const [x, y] = px(xy); return <circle key={`y${slot}${i}`} cx={x} cy={y} r="17" className="ld-cell ld-cell--yard" fill="url(#ldg-well)" />; }))}
          </g>
          {moves.map((m) => { const [x, y] = where(mine!, m.piece, m.to); return <circle key={`t${m.piece}`} cx={x} cy={y} r="23" className="ld-target" />; })}
          {view.pieces.flatMap((ps, seat) => !view.active[seat] ? [] : ps.map((p, i) => {
            const slot = view.slots[seat]!;
            const [x, y] = where(slot, i, p);
            const move = seat === mySeat ? moves.find((m) => m.piece === i) : undefined;
            const label = `مهره ${fa(i + 1)} ${SLOT_FA[slot]} (${seatName(seat)})، ${placeFa(p)}${move ? '، حرکت دادن' : ''}`;
            const hint = expected?.type === 'move' && expected.piece === i && seat === mySeat;
            const act = () => !busy && onAction({ type: 'move', piece: i });
            return (
              <g key={`${seat}-${i}`} className={['ld-piece', move ? 'ld-piece--movable' : '', hint ? 'ld-piece--hint' : ''].join(' ')} style={{ transform: `translate(${x}px, ${y}px)` }}
                {...(move ? { role: 'button', tabIndex: 0, 'aria-label': label, onClick: act, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } } } : { role: 'img', 'aria-label': label })}>
                <circle r="22" className="ld-piece__ring" />
                <ellipse cx="2.5" cy="5.5" rx="16" ry="12" className="ld-piece__shadow" filter="url(#ldg-blur)" aria-hidden="true" />
                <Pawn slot={slot} />
                <text y="6" aria-hidden="true">{fa(i + 1)}</text>
              </g>
            );
          }))}
        </svg>
        </ZoomBoard>

        <div className="ld-side">
          <div className="ld-roll">
            <Die key={lastRoll?.seq} value={view.die ?? (lastRoll && lastRoll.t === 'roll' ? lastRoll.die : null)} rolling={!!lastRoll} />
            {canRoll && <Button size="lg" disabled={busy} variant={expected?.type === 'roll' ? 'brand' : 'primary'} onClick={() => onAction({ type: 'roll' })}><img className="ld-btn-die" src={dieArt} alt="" aria-hidden="true" />تاس بریز</Button>}
          </div>
          {moves.length > 0 && (
            <div className="ld-choices" role="group" aria-label="مهره‌های قابل حرکت">
              {moves.map((m) => <Button key={m.piece} variant="secondary" disabled={busy} onClick={() => onAction({ type: 'move', piece: m.piece })}>مهره {fa(m.piece + 1)}: {placeFa(view.pieces[mySeat!]![m.piece]!)} ← {placeFa(m.to)}</Button>)}
            </div>
          )}
          <ul className="ld-players" aria-label="بازیکنان">
            {view.slots.map((slot, seat) => (
              <li key={seat} className={[view.current === seat && !view.outcome ? 'ld-player--turn' : '', view.active[seat] ? '' : 'ld-player--out'].join(' ')}>
                <span className="ld-dot" style={{ background: SLOT_COLORS[slot] }} aria-hidden="true" />
                <bdi>{seatName(seat)}</bdi>{seat === mySeat ? ' (شما)' : ''}
                <span className="ld-players__info">{SLOT_FA[slot]} · در خانه {fa(view.pieces[seat]!.filter((p) => p >= TRACK).length)}/۴{view.active[seat] ? '' : ' · بیرون'}</span>
              </li>
            ))}
          </ul>
          <details className="ld-log" open>
            <summary>رویدادها</summary>
            <ol>{view.log.slice(-6).reverse().map((e) => <li key={e.seq}>{describe(e, seatName)}</li>)}</ol>
          </details>
        </div>
      </div>
    </div>
  );
}
