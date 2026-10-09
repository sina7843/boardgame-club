// کوریدور renderer: oak-textured tiles with grooves (SVG); pawns and wood are cut from a generated sheet (see DECISIONS.md). The board is turned so the viewer's start edge is at the bottom.
// Move mode: tap a lit tile. Wall mode: tap a groove crossing to drop a wall there (preview on hover/focus).
import './renderer.css';
import { useEffect, useId, useState } from 'react';
import { Button, TurnIndicator, ZoomBoard, usePop, type GameRendererProps } from '@bg/ui';
import { PAWN_SRC, OAK } from './pieces.ts';
import { distance, N, wallOk, type Orient, type QuoridorView, type Side, type Wall } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const C = 84, G = 18, M = 34, SIZE = N * C + (N - 1) * G + 2 * M, P = C + G;
const SEAT_COLORS =['#d1495b', '#2f80c9', '#3fa34d', '#e0a526'];
const ROT: Record<Side, number> = { bottom: 0, top: 180, left: -90, right: 90 };
const cellX = (c: number) => M + c * P;
const cellY = (r: number) => M + (N - 1 - r) * P;
const wallRect = (w: Wall) => w.o === 'h'
  ? { x: cellX(w.c), y: cellY(w.r) - G, width: 2 * C + G, height: G }
  : { x: cellX(w.c) + C, y: cellY(w.r + 1), width: G, height: 2 * C + G };

function Walls({ n }: { n: number }) {
  return (
    <span key={n} className={`qd-pl__walls ${usePop(n)}`} aria-label={`${fa(n)} دیوار مانده`}>
      {Array.from({ length: n }, (_, k) => <i key={k} />)}
    </span>
  );
}

export default function QuoridorRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<QuoridorView>) {
  const me = mySeat ?? 0;
  const oak = `qd-oak-${useId()}`;
  const rot = ROT[view.sides[me] ?? 'bottom'];
  const sideways = Math.abs(rot) === 90;
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

  const place = (w: Wall) => { if (!busy) onAction({ type: 'wall', ...w }); setHover(null); };
  const lastWall = [...view.log].reverse().find((e) => e.t === 'wall');
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));

  const status = view.outcome ? null
    : myTurn ? { tone: 'mine' as const, text: mode === 'wall' ? 'یک نقطه طلایی را بزنید' : 'نوبت شما: حرکت یا دیوار' }
      : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };

  const goalLine = (side: Side) => {
    const len = N * C + (N - 1) * G;
    const t = 8;
    return side === 'bottom' ? { x: M, y: M - t - 6, width: len, height: t } : side === 'top' ? { x: M, y: SIZE - M + 6, width: len, height: t }
      : side === 'left' ? { x: SIZE - M + 6, y: M, width: t, height: len } : { x: M - t - 6, y: M, width: t, height: len };
  };

  return (
    <div className="qd" data-seq={seq}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <ul className="qd__players" aria-label="بازیکنان">
        {view.sides.map((_, s) => (
          <li key={s} className={['qd-pl', s === view.current && !view.outcome ? 'qd-pl--turn' : '', view.active[s] ? '' : 'qd-pl--out'].join(' ')} style={{ ['--pc' as string]: SEAT_COLORS[s] }}>
            <img className="qd-pl__pawn" src={PAWN_SRC[s]} alt="" />
            <bdi className="qd-pl__name">{who(s)}</bdi>
            <Walls n={view.wallsLeft[s]!} />
            {view.distances[s] !== null && <span className="qd-pl__dist">{fa(view.distances[s]!)} قدم تا هدف</span>}
          </li>
        ))}
      </ul>

      <ZoomBoard label="صفحه کوریدور">
        <svg className="qd-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label="صفحه کوریدور" style={{ direction: 'ltr' }}>
          <defs>
            <linearGradient id="qd-frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5b3a1e" /><stop offset="1" stopColor="#2e1c0e" /></linearGradient>
            <pattern id={oak} patternUnits="userSpaceOnUse" width={2 * C} height={2 * C}><image href={OAK} width={2 * C} height={2 * C} preserveAspectRatio="none" /></pattern>
            <linearGradient id="qd-wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b8622c" /><stop offset=".5" stopColor="#7c3a14" /><stop offset="1" stopColor="#4a210a" /></linearGradient>
            <filter id="qd-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity=".5" /></filter>
          </defs>
          <rect width={SIZE} height={SIZE} rx="24" fill="url(#qd-frame)" />
          <g transform={`rotate(${rot} ${SIZE / 2} ${SIZE / 2})`}>
            {view.sides.map((side, s) => view.active[s] && (
              <rect key={`goal${s}`} {...goalLine(side)} rx="4" fill={SEAT_COLORS[s]} className="qd-goal" />
            ))}
            {Array.from({ length: N * N }, (_, i) => {
              const r = Math.floor(i / N), c = i % N;
              const lit = moves.has(i) && mode === 'move' && !busy;
              const hint = expected?.type === 'move' && expected.to === i;
              return (
                <g key={i} role="gridcell" tabIndex={lit ? 0 : -1} data-d={lit ? distance(view.walls, i, view.sides[me]!) ?? 99 : undefined} aria-label={`ردیف ${fa(r + 1)}، ستون ${fa(c + 1)}${lit ? '، می‌توانید بروید' : ''}`}
                  className={['qd-tile', lit ? 'qd-tile--lit' : '', hint ? 'qd-tile--hint' : ''].join(' ')}
                  onClick={() => lit && onAction({ type: 'move', to: i })} onKeyDown={(e) => { if (lit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onAction({ type: 'move', to: i }); } }}>
                  <rect x={cellX(c)} y={cellY(r)} width={C} height={C} rx="10" fill={`url(#${oak})`} />
                  <rect x={cellX(c) + 5} y={cellY(r) + 5} width={C - 10} height={C - 10} rx="7" className="qd-tile__inset" />
                  {lit && <circle cx={cellX(c) + C / 2} cy={cellY(r) + C / 2} r="14" className="qd-step" style={{ fill: SEAT_COLORS[me] }} />}
                </g>
              );
            })}

            {view.walls.map((w) => {
              const isLast = lastWall?.t === 'wall' && lastWall.wall.r === w.r && lastWall.wall.c === w.c && lastWall.wall.o === w.o;
              return <rect key={`${w.r}-${w.c}-${w.o}`} {...wallRect(w)} rx="6" fill="url(#qd-wall)" stroke="#2a1205" strokeWidth="2" filter="url(#qd-shadow)" className={isLast ? 'qd-wall bg-land' : 'qd-wall'} />;
            })}
            {hover && <rect {...wallRect(hover)} rx="6" className="qd-wall--preview" />}

            {view.pawns.map((cellIdx, s) => view.active[s] && (
              <g key={`pawn${s}`} className="qd-pawn" style={{ transform: `translate(${cellX(cellIdx % N) + C / 2}px, ${cellY(Math.floor(cellIdx / N)) + C / 2}px)` }} pointerEvents="none">
                <g transform={`rotate(${-rot})`} filter="url(#qd-shadow)">
                  <image href={PAWN_SRC[s]} x="-54" y="-68" width="108" height="108" />
                </g>
              </g>
            ))}

            {mode === 'wall' && myTurn && !busy && Array.from({ length: 64 }, (_, k) => {
              const r = Math.floor(k / 8), c = k % 8;
              const w: Wall = { r, c, o: orient };
              const ok = wallOk(view, w);
              const hint = hintWall && hintWall.r === r && hintWall.c === c;
              const cx = cellX(c) + C + G / 2, cy = cellY(r) - G / 2;
              return (
                <g key={`x${k}`} className={['qd-x', ok ? 'qd-x--ok' : 'qd-x--no', hint ? 'qd-x--hint' : ''].join(' ')} role="button" tabIndex={ok ? 0 : -1}
                  aria-label={`دیوار ${orient === 'h' ? 'افقی' : 'عمودی'} در تقاطع ${fa(r + 1)}-${fa(c + 1)}${ok ? '' : ' (مجاز نیست)'}`}
                  onPointerEnter={() => ok && setHover(w)} onPointerLeave={() => setHover(null)} onFocus={() => ok && setHover(w)} onBlur={() => setHover(null)}
                  onClick={() => ok && place(w)} onKeyDown={(e) => { if (ok && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); place(w); } }}>
                  <circle cx={cx} cy={cy} r={P * 0.42} fill="transparent" />
                  <circle cx={cx} cy={cy} r="9" className="qd-x__dot" />
                </g>
              );
            })}
          </g>
        </svg>
      </ZoomBoard>

      {myTurn && !view.outcome && (
        <div className="qd__tools" role="toolbar" aria-label="نوع حرکت">
          <Button size="sm" variant={mode === 'move' ? 'primary' : 'secondary'} disabled={busy} onClick={() => setMode('move')}>حرکت مهره</Button>
          <Button size="sm" variant={mode === 'wall' ? 'primary' : 'secondary'} disabled={busy || !canWall} onClick={() => setMode('wall')}>دیوار ({fa(view.wallsLeft[me] ?? 0)})</Button>
          {mode === 'wall' && (
            <span className="qd__orient" role="group" aria-label="جهت دیوار">
              <button type="button" aria-pressed={look === 'h'} onClick={() => setLook('h')}>━ افقی</button>
              <button type="button" aria-pressed={look === 'v'} onClick={() => setLook('v')}>┃ عمودی</button>
            </span>
          )}
        </div>
      )}
      {view.winner !== null && <p className="qd__end" role="status">{view.winner === mySeat ? 'به هدف رسیدید!' : <><bdi>{seatName(view.winner)}</bdi> به هدف رسید</>}</p>}
    </div>
  );
}
