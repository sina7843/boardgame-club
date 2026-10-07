// Ludo (منچ) renderer: classic cross board on an 11×11 grid. Pieces carry their colour, a number and a text label;
// movable pieces are buttons and their landing square is outlined. Board coordinates are literal (ltr).
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { TRACK, trackSquare, type LogEntry, type LudoView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const C = 50;
export const SLOT_COLORS = ['#d62f35', '#23843f', '#e0a400', '#1c63c9'];
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
    <svg className={rolling ? 'ld-die ld-die--roll' : 'ld-die'} viewBox="0 0 40 40" role="img" aria-label={value ? `تاس: ${fa(value)}` : 'تاس'}>
      <rect x="2" y="2" width="36" height="36" rx="8" />
      {(value ? pips[value]! : []).map(([x, y], i) => <circle key={i} cx={x * 10} cy={y * 10} r="3.6" />)}
    </svg>
  );
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
        <svg className="ld-board" viewBox="0 0 550 550" role="group" aria-label="صفحه منچ" style={{ direction: 'ltr' }}>
          <rect width="550" height="550" rx="18" className="ld-board__bg" />
          {YARD_XY.map((cells, slot) => (
            <rect key={slot} x={Math.min(...cells.map((c) => c[0])) * C + 2} y={Math.min(...cells.map((c) => c[1])) * C + 2} width={2 * C - 4} height={2 * C - 4} rx="14"
              fill={SLOT_COLORS[slot]} opacity={view.slots.includes(slot) ? 0.28 : 0.1} />
          ))}
          {TRACK_XY.map((xy, i) => {
            const startSlot = i % 10 === 0 ? i / 10 : -1;
            const [x, y] = px(xy);
            return <circle key={i} cx={x} cy={y} r="19" className="ld-cell" style={startSlot >= 0 ? { fill: SLOT_COLORS[startSlot], fillOpacity: 0.55 } : undefined} />;
          })}
          {GOAL_XY.map((cells, slot) => cells.map((xy, i) => { const [x, y] = px(xy); return <circle key={`${slot}${i}`} cx={x} cy={y} r="19" className="ld-cell" style={{ fill: SLOT_COLORS[slot], fillOpacity: 0.45 }} />; }))}
          {YARD_XY.map((cells, slot) => cells.map((xy, i) => { const [x, y] = px(xy); return <circle key={`y${slot}${i}`} cx={x} cy={y} r="17" className="ld-cell ld-cell--yard" />; }))}
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
                <circle r="16" fill={SLOT_COLORS[slot]} />
                <text y="6">{fa(i + 1)}</text>
              </g>
            );
          }))}
        </svg>

        <div className="ld-side">
          <div className="ld-roll">
            <Die key={lastRoll?.seq} value={view.die ?? (lastRoll && lastRoll.t === 'roll' ? lastRoll.die : null)} rolling={!!lastRoll} />
            {canRoll && <Button size="lg" disabled={busy} variant={expected?.type === 'roll' ? 'brand' : 'primary'} onClick={() => onAction({ type: 'roll' })}>تاس بریز</Button>}
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
