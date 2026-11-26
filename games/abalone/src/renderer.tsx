// ابلون renderer: hexagonal walnut tray with dimples, black glass and white pearl marbles (SVG, geometry LTR).
// Tap up to three of your marbles in a line; arrows appear for the legal directions; tap an arrow to move.
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, RailSlot, TurnIndicator, T, ZoomBoard, tx, useFlip, useInFrame, usePop, useTermsLang, type GameRendererProps } from '@bg/ui';
import marbleB from './art/abalone-black-marble.png';
import marbleW from './art/abalone-white-marble.png';
import marbleSel from './art/abalone-selected-marble.png';
import arrowArt from './art/abalone-move-arrow.png';
import boardArt from './art/abalone-board.png';
import { terms } from './terms.ts';
import { CELLS, DIRS, WIN, legalMoves, neighbor, tryMove, type AbaloneView, type Color } from './rules.ts';

type Board = (Color | null)[];
type Move = { marbles: number[]; dir: number };
/** The board after `mv` with every marble's id carried along (pushed-off marbles drop out). */
function shift(board: Board, ids: (string | null)[], color: Color, mv: Move) {
  const r = tryMove(board, color, mv.marbles, mv.dir);
  if (!r) return null;
  const out = ids.slice();
  const moving = [...mv.marbles, ...r.pushed];
  for (const c of moving) out[c] = null;
  for (const c of moving) { const to = neighbor(c, mv.dir); if (to !== null) out[to] = ids[c]!; }
  return { board: r.board, ids: out, pushed: r.pushed, lost: r.lost };
}

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const R = 40, SIZE = 760, CX = SIZE / 2, CY = SIZE / 2;
// Marbles and the board are the BGA Abalone client art (see DECISIONS.md). board.webp is 705 × 659 with the centre hole
// at (350.5, 330) and 54.4 px between holes; BOARD places it on our grid (R·√3 between cells).
const K = (R * Math.sqrt(3)) / 54.4;
const BOARD = { x: CX - 350.5 * K, y: CY - 330 * K, w: 705 * K, h: 659 * K };
const marbleImg = (c: Color, x: number, y: number, cls?: string) => (
  <image className={cls} href={c === 'b' ? marbleB : marbleW} x={x - R * 0.86} y={y - R * 0.86} width={R * 1.72} height={R * 1.72} />
);
const DIR_FA = ['راست', 'بالا راست', 'بالا چپ', 'چپ', 'پایین چپ', 'پایین راست'];

function Tray({ n, color }: { n: number; color: Color }) {
  const pop = usePop(n);
  return (
    <span className="abl-side__tray" aria-label={`${fa(n)} ${tx(terms.marble)} حریف بیرون انداخته`}>
      {Array.from({ length: WIN }, (_, k) => <i key={k === n - 1 ? `${k}-${n}` : k} className={`${k < n ? `is-${color}` : ''}${k === n - 1 && pop ? ` ${pop}` : ''}`} />)}
    </span>
  );
}

export default function AbaloneRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<AbaloneView>) {
  useTermsLang();
  const framed = useInFrame() !== null; // the shell draws players, ejected-marble trays and whose-turn
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
  const canMove = legalActions.some((a) => a.type === 'move') && !busy && !queued;
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
  // Sidestep: several marbles moved across their own line (green arrows in the design).
  const side = (d: number) => {
    if (sel.length < 2) return false;
    const [a, b] = [CELLS[sel[0]!]!, CELLS[sel[1]!]!], [dq, dr] = DIRS[d]!;
    const ax = b[0] - a[0], ay = b[1] - a[1], n = Math.max(Math.abs(ax), Math.abs(ay), Math.abs(ax + ay));
    return !((dq * n === ax && dr * n === ay) || (dq * n === -ax && dr * n === -ay));
  };
  const go = (d: number) => { onAction({ type: 'move', marbles: [...sel].sort((a, b) => a - b), dir: d }); setSel([]); };

  // Stable marble ids: each served move carries the ids along its line, so every marble glides one cell (FLIP).
  const base = useRef<{ ply: number; board: Board; ids: (string | null)[] } | null>(null);
  if (!base.current || base.current.ply !== view.ply) {
    const prev = base.current, h = view.history.at(-1);
    const next = prev && h && view.ply === prev.ply + 1 ? shift(prev.board, prev.ids, view.colors[h.seat]!, h) : null;
    base.current = { ply: view.ply, board: view.board, ids: next?.ids ?? view.board.map((c, i) => (c ? `m${view.ply}-${i}` : null)) };
  }
  // Undo-window preview: my queued move is already played on the board (fully known); undo slides it back.
  const qMove = queued?.type === 'move' ? (queued as unknown as Move) : null;
  const preview = qMove ? shift(view.board, base.current.ids, myColor, qMove) : null;
  const board = preview?.board ?? view.board;
  const ids = preview?.ids ?? base.current.ids;
  const off = preview ? { ...view.off, [myColor === 'b' ? 'w' : 'b']: view.off[myColor === 'b' ? 'w' : 'b'] + preview.lost } : view.off;
  const h = view.history.at(-1);
  const last = preview ? { ...qMove!, pushed: preview.pushed, lost: preview.lost, seat: me, ply: view.ply + 1 } : h ? { ...h, ply: view.ply } : null;
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.ply}|${qMove ? key(qMove.marbles) + qMove.dir : ''}`);
  const centroid = sel.length ? sel.map(xy).reduce((a, b) => ({ x: a.x + b.x / sel.length, y: a.y + b.y / sel.length }), { x: 0, y: 0 }) : null;
  const who = (c: Color) => (view.colors[0] === c ? (mySeat === 0 ? 'شما' : seatName(0)) : (mySeat === 1 ? 'شما' : seatName(1)));
  const status = view.outcome ? null
    : canMove ? { tone: 'mine' as const, text: sel.length ? `یک ${tx(terms.arrow)} را بزنید` : `${tx(terms.marblesYour)} را انتخاب کنید` }
      : { tone: 'wait' as const, text: `نوبت ${who(view.turn)}` };

  return (
    <div className="abl" data-ply={view.ply} ref={root}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          <p>۱ تا ۳ <T t={terms.marble} /> هم‌خط را انتخاب کنید. سه <T t={terms.marble} /> تا دو <T t={terms.marble} /> حریف و دو <T t={terms.marble} /> تا یک <T t={terms.marble} /> را <T t={terms.push} /> می‌دهد؛ <T t={terms.sidestep} /> فقط به خانهٔ خالی. اولین نفری که ۶ <T t={terms.marble} /> حریف را بیرون بیندازد برنده است.</p>
        </RailSlot>
      )}
      {!framed && <div className="abl__bar">
        {(['b', 'w'] as Color[]).map((c) => (
          <div key={c} className={['abl-side', view.turn === c && !view.outcome ? 'abl-side--turn' : ''].join(' ')}>
            <span className={`abl-side__m abl-side__m--${c}`} aria-hidden="true" />
            <bdi className="abl-side__name">{who(c)}</bdi>
            <Tray n={off[c === 'b' ? 'w' : 'b']} color={c === 'b' ? 'w' : 'b'} />
          </div>
        ))}
      </div>}

      <ZoomBoard label="صفحه ابلون">
        <svg className="abl-board" viewBox={`${BOARD.x} ${BOARD.y} ${BOARD.w} ${BOARD.h}`} role="grid" aria-label="صفحه ابلون" style={{ direction: 'ltr' }}>
          <defs>
            <filter id="abl-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity=".55" /></filter>
          </defs>
          <image href={boardArt} x={BOARD.x} y={BOARD.y} width={BOARD.w} height={BOARD.h} />
          {CELLS.map((_, i) => {
            const { x, y } = xy(i);
            const mine = board[i] === myColor && canMove;
            const isSel = sel.includes(i);
            const isHint = hint?.marbles.includes(i) && !isSel;
            return (
              <g key={i} role="gridcell" tabIndex={mine ? 0 : -1}
                aria-label={`خانه ${fa(i + 1)}: ${board[i] ? (board[i] === myColor ? `${tx(terms.marble)} شما` : `${tx(terms.marble)} حریف`) : 'خالی'}${isSel ? '، انتخاب‌شده' : ''}`}
                className={['abl-cell', mine ? 'abl-cell--mine' : '', isSel ? 'abl-cell--sel' : '', isHint ? 'abl-cell--hint' : ''].join(' ')}
                onClick={() => tap(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(i); } }}>
                <circle cx={x} cy={y} r={R * 0.86} fill="transparent" />
              </g>
            );
          })}
          {board.map((c, i) => {
            if (!c) return null;
            const { x, y } = xy(i);
            return (
              <g key={ids[i]!} data-flip={ids[i]!} pointerEvents="none" className={sel.includes(i) ? 'abl-m abl-m--sel' : 'abl-m'}>
                <g filter="url(#abl-shadow)">
                  {marbleImg(c, x, y)}
                </g>
                {sel.includes(i) && <image href={marbleSel} x={x - R * 0.96} y={y - R * 0.96} width={R * 1.92} height={R * 1.92} />}
              </g>
            );
          })}
          {last && last.lost > 0 && last.pushed.length > 0 && (() => {
            const edge = last.pushed[last.pushed.length - 1]!;
            const v = vec(last.dir);
            const { x, y } = xy(edge);
            return <g key={`lost${last.ply}`}>{marbleImg(view.colors[last.seat] === 'b' ? 'w' : 'b', x + v.x * R, y + v.y * R, 'abl-lost')}</g>;
          })()}
          {centroid && dirs.map((d) => {
            const v = vec(d);
            const ax = centroid.x + v.x * R * 1.45, ay = centroid.y + v.y * R * 1.45;
            const ang = (Math.atan2(v.y, v.x) * 180) / Math.PI;
            const isHint = hint && hint.dir === d && key(hint.marbles) === selKey;
            return (
              <g key={d} role="button" tabIndex={0} aria-label={`حرکت به ${DIR_FA[d]}`} className={isHint ? 'abl-arrow abl-arrow--hint' : 'abl-arrow'}
                onClick={() => go(d)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(d); } }}>
                <image href={arrowArt} x={ax - 26} y={ay - 26} width="52" height="52" transform={`rotate(${ang} ${ax} ${ay})`} className={side(d) ? 'abl-arrow__img abl-arrow__img--side' : 'abl-arrow__img'} />
              </g>
            );
          })}
        </svg>
      </ZoomBoard>
      <div className="abl__actions">
        {sel.length > 0 && !busy && <Button size="sm" variant="ghost" onClick={() => setSel([])}>انتخاب دوباره</Button>}
      </div>
      {!framed && view.end && <p className="abl__end" role="status">{{ six: `شش ${tx(terms.marble)} بیرون افتاد!`, limit: `۲۰۰ حرکت تمام شد؛ شمارش ${tx(terms.marblesEz)} بیرون‌افتاده`, resign: 'انصراف', timeout: 'اتمام زمان' }[view.end.kind]}</p>}
    </div>
  );
}
