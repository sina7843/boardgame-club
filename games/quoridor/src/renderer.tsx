// کوریدور renderer: the design's board art with pawns and walls laid on it (SVG overlay in the art's own pixels). The board is turned so the viewer's start edge is at the bottom.
// Move mode: tap a lit tile. Wall mode: tap a groove crossing to drop a wall there (preview on hover/focus).
import './renderer.css';
import { Segmented } from '@bg/ui/bgv';
import { useEffect, useState } from 'react';
import { DockSlot, RailSlot, T, TurnIndicator, ZoomBoard, tx, useInFrame, usePop, useTermsLang, type GameRendererProps } from '@bg/ui';
import { terms } from './terms.ts';
import { BOARD, PAWN_SRC, WALL_H, WALL_V } from './pieces.ts';
import { distance, N, wallOk, type Orient, type QuoridorView, type Side, type Wall } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
// Geometry in the board art's own pixels (628x603): cell centres on a 61.3 x 59.7 pitch, grooves between them.
const W = 628, H = 603, CELL = 48, GROOVE = 12;
const SEAT_COLORS = ['var(--qd-c0)', 'var(--qd-c1)', 'var(--qd-c2)', 'var(--qd-c3)'];
const ROT: Record<Side, number> = { bottom: 0, top: 180, left: -90, right: 90 };
const cx = (c: number) => 65 + 61.3 * c;
const cy = (r: number) => 53 + 59.7 * (N - 1 - r); // r = 0 is the bottom row
const wallBox = (w: Wall) => w.o === 'h'
  ? { x: (cx(w.c) + cx(w.c + 1)) / 2 - (CELL + GROOVE / 2 + 1), y: cy(w.r) - 29.85 - 5, width: 2 * CELL + GROOVE + 2, height: 10 }
  : { x: (cx(w.c) + cx(w.c + 1)) / 2 - 5, y: cy(w.r) - 29.85 - (CELL + GROOVE / 2 + 1), width: 10, height: 2 * CELL + GROOVE + 2 };

function Walls({ n }: { n: number }) {
  return (
    <span key={n} className={`qd-pl__walls ${usePop(n)}`} aria-label={`${fa(n)} ${tx(terms.wall)} مانده`}>
      {Array.from({ length: n }, (_, k) => <i key={k} />)}
    </span>
  );
}

/** My queued step or wall shown at once (both fully known to me); undo drops `queued` and the pawn slides back. */
function preview(v: QuoridorView, q: { type: string; to?: number; r?: number; c?: number; o?: Orient } | null | undefined, me: number | null): QuoridorView {
  if (!q || me === null) return v;
  if (q.type === 'move' && q.to !== undefined) return { ...v, pawns: v.pawns.map((p, s) => (s === me ? q.to! : p)) };
  if (q.type === 'wall' && q.o) return { ...v, walls: [...v.walls, { r: q.r!, c: q.c!, o: q.o }], wallsLeft: v.wallsLeft.map((n, s) => (s === me ? n - 1 : n)) };
  return v;
}

export default function QuoridorRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<QuoridorView>) {
  useTermsLang(); // re-render when the terms language changes
  const view = preview(served, queued as Parameters<typeof preview>[1], mySeat);
  const framed = useInFrame() !== null; // the shell draws players, walls left, distances and the move log
  const me = mySeat ?? 0;
  const rot = ROT[view.sides[me] ?? 'bottom'];
  const sideways = Math.abs(rot) === 90;
  const VW = sideways ? H : W, VH = sideways ? W : H;
  const moves = new Set(legalActions.filter((a) => a.type === 'move').map((a) => a.to as number));
  const canWall = legalActions.some((a) => a.type === 'wall');
  const myTurn = moves.size > 0 || canWall;
  const [mode, setMode] = useState<'move' | 'wall'>('move');
  // Orientation as the viewer sees it; on a board turned sideways, horizontal means a vertical wall in board terms.
  const [look, setLook] = useState<Orient>('h');
  const orient: Orient = sideways ? (look === 'h' ? 'v' : 'h') : look;
  const [hover, setHover] = useState<Wall | null>(null);
  const hintWall = expected?.type === 'wall' ? (expected as unknown as Wall) : null;
  useEffect(() => { if (hintWall) { setMode('wall'); setLook(sideways ? (hintWall.o === 'h' ? 'v' : 'h') : hintWall.o); } }, [hintWall?.r, hintWall?.c, hintWall?.o, sideways]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!canWall) setMode('move'); }, [canWall]);
  const seq = view.log.at(-1)?.seq ?? 0;
  // Each turn starts in move mode (the tutorial switches to wall mode when it expects a wall).
  useEffect(() => { setHover(null); if (!hintWall) setMode('move'); }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // R turns the wall (horizontal / vertical) on my turn; typing in the chat is left alone.
  useEffect(() => {
    if (!canWall || busy) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
      setMode('wall'); setLook((l) => (l === 'h' ? 'v' : 'h'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canWall, busy]);

  const place = (w: Wall) => { if (!busy) onAction({ type: 'wall', ...w }); setHover(null); };
  const qw = queued?.type === 'wall' ? (queued as unknown as Wall) : null;
  const lastWall = qw ? { t: 'wall' as const, wall: qw } : [...view.log].reverse().find((e) => e.t === 'wall');
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));

  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: mode === 'wall' ? 'یک نقطه طلایی را بزنید' : `نوبت شما: حرکت یا ${tx(terms.wall)}` }
      : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };

  // Goal edge of each seat's side, drawn in the frame margin of the art.
  const goalLine = (side: Side) => {
    const t = 6, x0 = cx(0) - CELL / 2, x1 = cx(N - 1) + CELL / 2, y0 = cy(N - 1) - CELL / 2, y1 = cy(0) + CELL / 2;
    return side === 'bottom' ? { x: x0, y: y0 - t - 8, width: x1 - x0, height: t } : side === 'top' ? { x: x0, y: y1 + 6, width: x1 - x0, height: t }
      : side === 'left' ? { x: x1 + 6, y: y0, width: t, height: y1 - y0 } : { x: x0 - t - 8, y: y0, width: t, height: y1 - y0 };
  };

  // Mode bar (reference): ONE segmented control «مهره | دیوار افقی | دیوار عمودی», navy selection, plus the R-key hint.
  const off = !myTurn || busy;
  const segValue = mode === 'move' ? 'move' : look === 'h' ? 'wh' : 'wv';
  const pick = (v: string) => { if (v === 'move') setMode('move'); else { setMode('wall'); setLook(v === 'wh' ? 'h' : 'v'); } };
  const wallsLabel = `(${fa(view.wallsLeft[me] ?? 0)})`;
  const tools = (
    <div className="qd__tools" role="toolbar" aria-label="نوع حرکت">
      <Segmented label="نوع حرکت" value={segValue} onChange={pick} options={[
        { value: 'move', label: tx(terms.pawn), disabled: off },
        { value: 'wh', label: <><T t={terms.wallH} /> <span className="qd__left">{wallsLabel}</span></>, disabled: off || !canWall },
        { value: 'wv', label: <><T t={terms.wallV} /> <span className="qd__left">{wallsLabel}</span></>, disabled: off || !canWall }
      ]} />
      <span className="qd__hint">کلید R: چرخاندن دیوار</span>
    </div>
  );

  // Walls left as tick marks (reference seat display), one row per seat.
  const ticks = (
    <ul className="qd-ticks" aria-label={`${tx(terms.walls)} باقی‌مانده`}>
      {view.wallsLeft.map((n, seat) => (
        <li key={seat}><bdi>{who(seat)}</bdi>
          <span className="qd-ticks__row" role="img" aria-label={`${fa(n)} ${tx(terms.wall)}`}>{Array.from({ length: n }, (_, k) => <i key={k} />)}</span>
          <b>{fa(n)}</b></li>
      ))}
    </ul>
  );

  return (
    <div className="qd" data-seq={seq}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          <p>{mode === 'wall' && myTurn
            ? <>نقطهٔ روی شیار را بزنید تا <b><T t={terms.wallTwo} /></b> بیفتد؛ <T t={terms.wall} /> نباید همهٔ راه‌های یک <T t={terms.pawn} /> را ببندد.</>
            : <>هر نوبت یا <b>یک خانه</b> حرکت کنید یا یک <T t={terms.wall} /> بگذارید. اگر پشت <T t={terms.pawnEz} /> حریف <T t={terms.wall} /> باشد، <b>کناری</b> <T t={terms.jump} />.</>}</p>
          {ticks}
        </RailSlot>
      )}
      {!framed && (
        <ul className="qd__players" aria-label="بازیکنان">
          {view.sides.map((_, s) => (
            <li key={s} className={['qd-pl', s === view.current && !view.outcome ? 'qd-pl--turn' : '', view.active[s] ? '' : 'qd-pl--out'].join(' ')} style={{ ['--pc' as string]: SEAT_COLORS[s] }}>
              <img className="qd-pl__pawn" src={PAWN_SRC[s]} alt="" />
              <bdi className="qd-pl__name">{who(s)}</bdi>
              <Walls n={view.wallsLeft[s]!} />
              {view.distances[s] !== null && <span className="qd-pl__dist">{fa(view.distances[s]!)} قدم تا <T t={terms.goal} /></span>}
            </li>
          ))}
        </ul>
      )}

      <ZoomBoard label="صفحه کوریدور">
        <svg className="qd-board" viewBox={`0 0 ${VW} ${VH}`} role="grid" aria-label="صفحه کوریدور" style={{ direction: 'ltr' }}>
          <g transform={`translate(${VW / 2} ${VH / 2}) rotate(${rot}) translate(${-W / 2} ${-H / 2})`}>
            <image href={BOARD} x="0" y="0" width={W} height={H} preserveAspectRatio="none" />
            {view.sides.map((side, s) => view.active[s] && (
              <rect key={`goal${s}`} {...goalLine(side)} rx="2" className="qd-goal" style={{ fill: SEAT_COLORS[s] }} />
            ))}
            {Array.from({ length: N * N }, (_, i) => {
              const r = Math.floor(i / N), c = i % N;
              const lit = moves.has(i) && mode === 'move' && !busy;
              const hint = expected?.type === 'move' && expected.to === i;
              return (
                <g key={i} role="gridcell" tabIndex={lit ? 0 : -1} data-d={lit ? distance(view.walls, i, view.sides[me]!) ?? 99 : undefined} aria-label={`${tx(terms.row)} ${fa(r + 1)}، ${tx(terms.column)} ${fa(c + 1)}${lit ? '، می‌توانید بروید' : ''}`}
                  className={['qd-tile', lit ? 'qd-tile--lit' : '', hint ? 'qd-tile--hint' : ''].join(' ')}
                  onClick={() => lit && onAction({ type: 'move', to: i })} onKeyDown={(e) => { if (lit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAction({ type: 'move', to: i }); } }}>
                  <rect x={cx(c) - 30} y={cy(r) - 29.5} width="60" height="59" className="qd-tile__hit" />
                  {lit && <circle cx={cx(c)} cy={cy(r)} r="9" className="qd-step" />}
                </g>
              );
            })}

            {view.walls.map((w) => {
              const isLast = lastWall?.t === 'wall' && lastWall.wall.r === w.r && lastWall.wall.c === w.c && lastWall.wall.o === w.o;
              const b = wallBox(w);
              return (
                <g key={`${w.r}-${w.c}-${w.o}`} className={isLast ? 'qd-wall bg-land' : 'qd-wall'}>
                  <image href={w.o === 'h' ? WALL_H : WALL_V} {...b} preserveAspectRatio="none" />
                  {isLast && <rect {...b} rx="2" className="qd-wall__ring" />}
                </g>
              );
            })}
            {hover && (
              <g className="qd-wall--preview">
                <image href={hover.o === 'h' ? WALL_H : WALL_V} {...wallBox(hover)} preserveAspectRatio="none" />
                <rect {...wallBox(hover)} rx="2" className="qd-wall__ring qd-wall__ring--prev" />
              </g>
            )}

            {view.pawns.map((cellIdx, s) => view.active[s] && (
              <g key={`pawn${s}`} className="qd-pawn" style={{ transform: `translate(${cx(cellIdx % N)}px, ${cy(Math.floor(cellIdx / N))}px)` }} pointerEvents="none">
                <g transform={`rotate(${-rot})`}>
                  <image href={PAWN_SRC[s]} x="-23" y="-27" width="46" height="46" className="qd-pawn__img" />
                </g>
              </g>
            ))}

            {mode === 'wall' && myTurn && !busy && Array.from({ length: 64 }, (_, k) => {
              const r = Math.floor(k / 8), c = k % 8;
              const w: Wall = { r, c, o: orient };
              const ok = wallOk(view, w);
              const hint = hintWall && hintWall.r === r && hintWall.c === c;
              const wb = wallBox(w), px = wb.x + wb.width / 2, py = wb.y + wb.height / 2;
              // Crossing point of the grooves: the wall's centre.
              return (
                <g key={`x${k}`} className={['qd-x', ok ? 'qd-x--ok' : 'qd-x--no', hint ? 'qd-x--hint' : ''].join(' ')} role="button" tabIndex={ok ? 0 : -1}
                  aria-label={`${tx(terms.wall)} ${orient === 'h' ? 'افقی' : 'عمودی'} در تقاطع ${fa(r + 1)}-${fa(c + 1)}${ok ? '' : ' (مجاز نیست)'}`}
                  onPointerEnter={() => ok && setHover(w)} onPointerLeave={() => setHover(null)} onFocus={() => ok && setHover(w)} onBlur={() => setHover(null)}
                  onClick={() => ok && place(w)} onKeyDown={(e) => { if (ok && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); place(w); } }}>
                  <circle cx={px} cy={py} r="26" fill="transparent" />
                  <circle cx={px} cy={py} r="6" className="qd-x__dot" />
                </g>
              );
            })}
          </g>
        </svg>
      </ZoomBoard>

      {/* Mode bar stays in view on the opponent's turn too (disabled), in the frame's dock row so it never pushes the board below the stage. */}
      {!view.outcome && (framed ? <DockSlot>{tools}</DockSlot> : tools)}
      {view.winner !== null && !framed && <p className="qd__end" role="status">{view.winner === mySeat ? <>به <T t={terms.goal} /> رسیدید!</> : <><bdi>{seatName(view.winner)}</bdi> به <T t={terms.goal} /> رسید</>}</p>}
    </div>
  );
}
