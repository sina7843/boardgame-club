// آبالون renderer: hexagonal walnut tray with dimples, black glass and white pearl marbles (SVG, geometry LTR).
// Tap up to three of your marbles in a line; arrows appear for the legal directions; tap an arrow to move.
import './renderer.css';
import { useEffect, useMemo, useState } from 'react';
import { Button, TurnIndicator, ZoomBoard, type GameRendererProps } from '@bg/ui';
import { CELLS, DIRS, WIN, legalMoves, neighbor, type AbaloneView, type Color } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const R = 40, SIZE = 760, CX = SIZE / 2, CY = SIZE / 2;
const DIR_FA = ['راست', 'بالا راست', 'بالا چپ', 'چپ', 'پایین چپ', 'پایین راست'];

export default function AbaloneRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<AbaloneView>) {
  const me = mySeat ?? 0;
  const myColor: Color = view.colors[me]!;
  const flip = myColor === 'w';
  const xy = (i: number) => {
    let [q, r] = CELLS[i]!;
    if (flip) { q = -q; r = -r; }
    return { x: CX + R * Math.sqrt(3) * (q + r / 2), y: CY + R * 1.5 * r };
  };
  const vec = (d: number) => {
    let [dq, dr] = DIRS[d]!;
    if (flip) { dq = -dq; dr = -dr; }
    return { x: Math.sqrt(3) * (dq + dr / 2), y: 1.5 * dr };
  };
  const canMove = legalActions.some((a) => a.type === 'move') && !busy;
  const moves = useMemo(() => (canMove ? legalMoves(view.board, myColor) : []), [canMove, view.board, myColor]);
  const [sel, setSel] = useState<number[]>([]);
  useEffect(() => { setSel([]); }, [view.ply]);
  const key = (ms: number[]) => [...ms].sort((a, b) => a - b).join(',');
  const selKey = key(sel);
  const dirs = moves.filter((mv) => key(mv.marbles) === selKey).map((mv) => mv.dir);
  const hint = expected?.type === 'move' ? (expected as unknown as { marbles: number[]; dir: number }) : null;

  const tap = (i: number) => {
    if (!canMove || view.board[i] !== myColor) return;
    if (sel.includes(i)) return setSel(sel.filter((x) => x !== i));
    const next = [...sel, i];
    // Keep the selection only if it is (part of) a movable line; otherwise start again from this marble.
    setSel(moves.some((mv) => next.every((x) => mv.marbles.includes(x)) && mv.marbles.length >= next.length) ? next : [i]);
  };
  const go = (d: number) => { onAction({ type: 'move', marbles: [...sel].sort((a, b) => a - b), dir: d }); setSel([]); };

  const last = view.history.at(-1);
  // Cells that received a marble in the last move, with where it came from (for the slide).
  const slides = new Map<number, number>();
  if (last) {
    for (const mcell of last.marbles) { const to = neighbor(mcell, last.dir); if (to !== null) slides.set(to, mcell); }
    for (const pcell of last.pushed) { const to = neighbor(pcell, last.dir); if (to !== null && !slides.has(to)) slides.set(to, pcell); }
  }
  const centroid = sel.length ? sel.map(xy).reduce((a, b) => ({ x: a.x + b.x / sel.length, y: a.y + b.y / sel.length }), { x: 0, y: 0 }) : null;
  const who = (c: Color) => (view.colors[0] === c ? (mySeat === 0 ? 'شما' : seatName(0)) : (mySeat === 1 ? 'شما' : seatName(1)));
  const status = view.outcome ? null
    : canMove ? { tone: 'mine' as const, text: sel.length ? 'یک فلش را بزنید' : 'گوی‌هایتان را انتخاب کنید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.turn)}` };
  // Flat-topped tray around the rows of cells (apothem ≈ 7.3 R → circumradius ≈ 8.4 R).
  const hexPts = Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k;
    return `${CX + Math.cos(a) * R * 8.4},${CY + Math.sin(a) * R * 8.4}`;
  }).join(' ');

  return (
    <div className="abl" data-ply={view.ply}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <div className="abl__bar">
        {(['b', 'w'] as Color[]).map((c) => (
          <div key={c} className={['abl-side', view.turn === c && !view.outcome ? 'abl-side--turn' : ''].join(' ')}>
            <span className={`abl-side__m abl-side__m--${c}`} aria-hidden="true" />
            <bdi className="abl-side__name">{who(c)}</bdi>
            <span className="abl-side__tray" aria-label={`${fa(view.off[c === 'b' ? 'w' : 'b'])} گوی حریف بیرون انداخته`}>
              {Array.from({ length: WIN }, (_, k) => <i key={k} className={k < view.off[c === 'b' ? 'w' : 'b'] ? `is-${c === 'b' ? 'w' : 'b'}` : ''} />)}
            </span>
          </div>
        ))}
      </div>

      <ZoomBoard label="صفحه آبالون">
        <svg className="abl-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label="صفحه آبالون" style={{ direction: 'ltr' }}>
          <defs>
            <radialGradient id="abl-tray" cx=".5" cy=".45" r=".7"><stop offset="0" stopColor="#6b4223" /><stop offset="1" stopColor="#2e1a0b" /></radialGradient>
            <radialGradient id="abl-dimple" cx=".5" cy=".6" r=".6"><stop offset="0" stopColor="#3a2412" /><stop offset="1" stopColor="#21130a" /></radialGradient>
            <radialGradient id="abl-b" cx=".33" cy=".28" r=".85"><stop offset="0" stopColor="#7c8290" /><stop offset=".35" stopColor="#262a33" /><stop offset="1" stopColor="#05060a" /></radialGradient>
            <radialGradient id="abl-w" cx=".33" cy=".28" r=".85"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#ece8df" /><stop offset="1" stopColor="#b8b0a0" /></radialGradient>
            <filter id="abl-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity=".55" /></filter>
          </defs>
          <polygon points={hexPts} fill="url(#abl-tray)" stroke="#c9a46a" strokeWidth="6" strokeLinejoin="round" />
          {CELLS.map((_, i) => {
            const { x, y } = xy(i);
            const mine = view.board[i] === myColor && canMove;
            const isSel = sel.includes(i);
            const isHint = hint?.marbles.includes(i) && !isSel;
            return (
              <g key={i} role="gridcell" tabIndex={mine ? 0 : -1}
                aria-label={`خانه ${fa(i + 1)}: ${view.board[i] ? (view.board[i] === myColor ? 'گوی شما' : 'گوی حریف') : 'خالی'}${isSel ? '، انتخاب‌شده' : ''}`}
                className={['abl-cell', mine ? 'abl-cell--mine' : '', isSel ? 'abl-cell--sel' : '', isHint ? 'abl-cell--hint' : ''].join(' ')}
                onClick={() => tap(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(i); } }}>
                <circle cx={x} cy={y} r={R * 0.86} fill="url(#abl-dimple)" />
              </g>
            );
          })}
          {view.board.map((c, i) => {
            if (!c) return null;
            const { x, y } = xy(i);
            const from = slides.get(i);
            const off = from !== undefined ? xy(from) : null;
            return (
              <g key={`${i}-${off ? view.ply : 0}`} pointerEvents="none" className={['abl-m', off ? 'abl-m--moved' : '', sel.includes(i) ? 'abl-m--sel' : ''].join(' ')}
                style={off ? { ['--dx' as string]: `${off.x - x}px`, ['--dy' as string]: `${off.y - y}px` } : undefined}>
                <g filter="url(#abl-shadow)">
                  <circle cx={x} cy={y} r={R * 0.8} fill={c === 'b' ? 'url(#abl-b)' : 'url(#abl-w)'} />
                  <ellipse cx={x - R * 0.25} cy={y - R * 0.3} rx={R * 0.25} ry={R * 0.13} fill="#fff" opacity={c === 'b' ? 0.35 : 0.7} transform={`rotate(-30 ${x - R * 0.25} ${y - R * 0.3})`} />
                </g>
                {sel.includes(i) && <circle cx={x} cy={y} r={R * 0.92} className="abl-ring" />}
              </g>
            );
          })}
          {last && last.lost > 0 && last.pushed.length > 0 && (() => {
            const edge = last.pushed[last.pushed.length - 1]!;
            const v = vec(last.dir);
            const { x, y } = xy(edge);
            return <circle key={`lost${view.ply}`} cx={x + v.x * R} cy={y + v.y * R} r={R * 0.8} className={`abl-lost abl-lost--${view.colors[last.seat] === 'b' ? 'w' : 'b'}`} />;
          })()}
          {centroid && dirs.map((d) => {
            const v = vec(d);
            const ax = centroid.x + v.x * R * 1.45, ay = centroid.y + v.y * R * 1.45;
            const ang = (Math.atan2(v.y, v.x) * 180) / Math.PI;
            const isHint = hint && hint.dir === d && key(hint.marbles) === selKey;
            return (
              <g key={d} role="button" tabIndex={0} aria-label={`حرکت به ${DIR_FA[d]}`} className={isHint ? 'abl-arrow abl-arrow--hint' : 'abl-arrow'}
                onClick={() => go(d)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(d); } }}>
                <circle cx={ax} cy={ay} r="26" />
                <path d="M-10 -9 L10 0 L-10 9 Z" transform={`translate(${ax} ${ay}) rotate(${ang})`} />
              </g>
            );
          })}
        </svg>
      </ZoomBoard>
      <div className="abl__actions">
        {sel.length > 0 && !busy && <Button size="sm" variant="ghost" onClick={() => setSel([])}>انتخاب دوباره</Button>}
      </div>
      {view.end && <p className="abl__end" role="status">{{ six: 'شش گوی بیرون افتاد!', limit: '۲۰۰ حرکت تمام شد؛ شمارش گوی‌های بیرون‌افتاده', resign: 'انصراف', timeout: 'اتمام زمان' }[view.end.kind]}</p>}
    </div>
  );
}
