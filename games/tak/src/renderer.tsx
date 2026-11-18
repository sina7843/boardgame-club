// تاک renderer: walnut board, birch and ebony stones drawn as stacks (SVG, LTR geometry).
// Place: pick flat / wall / capstone and tap an empty square. Move: tap your stack, choose how many to lift, then tap
// squares along one line — tap the current square again to drop another stone there; the move is sent when the
// hand is empty.
import './renderer.css';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, RailSlot, TurnIndicator, ZoomBoard, useFlip, useFresh, useInFrame, usePieceIds, usePop, type GameRendererProps } from '@bg/ui';
// Board and stones: design/games/group-a/art/tak, copied as-is.
import bF from './art/tak-b-F.png';
import bS from './art/tak-b-S.png';
import bC from './art/tak-b-C.png';
import wF from './art/tak-w-F.png';
import wS from './art/tak-w-S.png';
import wC from './art/tak-w-C.png';
import board4 from './art/tak-board-4.png';
import board5 from './art/tak-board-5.png';
import board6 from './art/tak-board-6.png';
import { allMoves, step, type Color, type Dir, type Kind, type Stone, type TakView } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
// Geometry in the board art's own pixels (652x652): the n x n grid is inset 5.75% on every side.
const W = 652, X0 = 0.0575 * W;
const BOARD: Record<number, string> = { 4: board4, 5: board5, 6: board6 };
const K = 48; // stone slots per square for identity tracking (ponytail: a taller stack is not tracked above this)
const STONE: Record<Color, Record<Kind, string>> = { w: { F: wF, S: wS, C: wC }, b: { F: bF, S: bS, C: bC } };
const KIND_FA: Record<Kind, string> = { F: 'سنگ تخت', S: 'دیوار', C: 'سرستون' };

type Queued = { type: string; at?: number; kind?: Kind; from?: number; dir?: Dir; drops?: number[] };

/** My queued placement or stack move applied at once (same steps as the rules; nothing in Tak is hidden). */
function preview(v: TakView, q: Queued | null | undefined): TakView {
  if (!q) return v;
  const board = v.board.map((st) => st.map((x) => ({ ...x })));
  if (q.type === 'place' && q.at !== undefined && q.kind) {
    const color: Color = v.ply < 2 ? (v.turn === 'w' ? 'b' : 'w') : v.turn;
    board[q.at] = [{ c: color, t: q.kind }];
    const r = { ...v.reserve[color] };
    if (q.kind === 'C') r.caps -= 1; else r.stones -= 1;
    return { ...v, board, reserve: { ...v.reserve, [color]: r } };
  }
  if (q.type !== 'move' || q.from === undefined || !q.dir || !q.drops) return v;
  const stack = board[q.from]!, lift = q.drops.reduce((a, b) => a + b, 0);
  const carried = stack.splice(stack.length - lift, lift);
  let at = q.from;
  for (const d of q.drops) {
    at = step(at, q.dir, v.size)!;
    const t = board[at]!.at(-1);
    if (t?.t === 'S') t.t = 'F'; // flattened by the capstone
    board[at]!.push(...carried.splice(0, d));
  }
  return { ...v, board };
}

export default function TakRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<TakView>) {
  const framed = useInFrame() !== null; // the shell draws players, reserves and the move log
  const q = queued as Queued | null | undefined;
  const view = preview(served, q);
  const n = view.size;
  const S = (W - 2 * X0) / n; // one square
  const me = mySeat ?? 0;
  const myColor: Color = view.colors[me]!;
  const flip = myColor === 'b';
  const xy = (i: number) => {
    const r = Math.floor(i / n), c = i % n;
    return { x: X0 + (flip ? n - 1 - c : c) * S + S / 2, y: X0 + (flip ? r : n - 1 - r) * S + S / 2 };
  };
  const canPlace = legalActions.some((a) => a.type === 'place') && !busy;
  const canMove = legalActions.some((a) => a.type === 'move') && !busy;
  const opening = view.ply < 2;
  const reserve = view.reserve[opening ? (myColor === 'w' ? 'b' : 'w') : myColor];
  const [kind, setKind] = useState<Kind>('F');
  const [sel, setSel] = useState<{ from: number; lift: number; dir: Dir | null; drops: number[] } | null>(null);
  const plyKey = view.ply;
  useEffect(() => { setSel(null); }, [plyKey]);
  const hint = expected?.type === 'place' ? (expected as unknown as { at: number; kind: Kind }) : null;
  useEffect(() => { if (hint) setKind(hint.kind); }, [hint?.at, hint?.kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if ((kind === 'C' && !reserve.caps) || (kind !== 'C' && !reserve.stones)) setKind(reserve.stones ? 'F' : 'C'); }, [reserve.caps, reserve.stones, kind]);

  const moves = useMemo(() => (canMove ? allMoves(view, myColor) : []), [canMove, view, myColor]);
  const movable = new Set(moves.map((m) => m.from));
  const cands = sel ? moves.filter((m) => m.from === sel.from && m.drops.reduce((a, b) => a + b, 0) === sel.lift && (!sel.dir || m.dir === sel.dir)) : [];
  const fits = (drops: number[], dir: Dir) => cands.some((m) => m.dir === dir && drops.every((d, k) => (k < drops.length - 1 ? m.drops[k] === d : (m.drops[k] ?? 0) >= d)));
  // Squares that continue the current move.
  const cursor = sel ? sel.drops.reduce((at) => step(at, sel.dir!, n)!, sel.from) : null;
  const moveTargets = new Map<number, () => void>();
  if (sel) {
    if (!sel.dir) {
      for (const d of ['n', 's', 'e', 'w'] as Dir[]) {
        const j = step(sel.from, d, n);
        if (j !== null && fits([1], d)) moveTargets.set(j, () => drop(d, [1]));
      }
    } else {
      const here = [...sel.drops.slice(0, -1), sel.drops.at(-1)! + 1];
      if (fits(here, sel.dir) && sel.drops.reduce((a, b) => a + b, 0) < sel.lift) moveTargets.set(cursor!, () => drop(sel.dir!, here));
      const nxt = step(cursor!, sel.dir, n);
      if (nxt !== null && fits([...sel.drops, 1], sel.dir) && sel.drops.reduce((a, b) => a + b, 0) < sel.lift) moveTargets.set(nxt, () => drop(sel.dir!, [...sel.drops, 1]));
    }
  }
  function drop(dir: Dir, drops: number[]) {
    if (!sel) return;
    if (drops.reduce((a, b) => a + b, 0) === sel.lift) { onAction({ type: 'move', from: sel.from, dir, drops }); setSel(null); return; }
    setSel({ ...sel, dir, drops });
  }

  const tap = (i: number) => {
    if (busy) return;
    const target = moveTargets.get(i);
    if (target) return target();
    if (sel && i === sel.from) return setSel(null);
    if (canMove && movable.has(i) && !sel) return setSel({ from: i, lift: 1, dir: null, drops: [] });
    if (canPlace && !view.board[i]!.length && !sel) onAction({ type: 'place', at: i, kind: opening ? 'F' : kind });
  };

  // Every physical stone gets a stable id (matched between consecutive boards), so lifted stones glide along the move
  // (my queued move at once, undo glides them back), a lifted stack rises, and a stone that has just appeared lands.
  const root = useRef<HTMLDivElement>(null);
  const ids = usePieceIds(
    view.board.flatMap((stack) => Array.from({ length: K }, (_, k) => (stack[k] ? `${stack[k]!.c}${stack[k]!.t}` : null))),
    (a, b) => { const p = Math.floor(a / K), q = Math.floor(b / K); return Math.hypot((p % n) - (q % n), Math.floor(p / n) - Math.floor(q / n)) * 100 + Math.abs((a % K) - (b % K)); }
  );
  const fresh = useFresh(ids.filter((x): x is string => !!x));
  useFlip(root, `${view.ply}|${q ? JSON.stringify(q) : ''}|${sel ? `${sel.from}:${sel.lift}` : ''}`);

  const road = new Set(view.end?.road ?? []);
  const last = view.history.at(-1);
  const who = (c: Color) => (view.colors[0] === c ? (mySeat === 0 ? 'شما' : seatName(0)) : (mySeat === 1 ? 'شما' : seatName(1)));
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : canPlace ? { tone: 'mine' as const, text: opening ? 'اولین نوبت: یک سنگ تخت حریف را بگذارید' : sel ? (sel.dir ? `${fa(sel.lift - sel.drops.reduce((a, b) => a + b, 0))} سنگ در دست؛ خانه بعدی را بزنید` : 'تعداد را انتخاب کنید و جهت را بزنید') : 'نوبت شما: بگذارید یا پشته‌ای را جابه‌جا کنید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.turn)}` };

  // Piece-type bar (reference: «گذاشتن» تخت / دیوار / سرستون and «برداشتن» ۱…n) is always shown, disabled when it does not
  // apply, so the reserve split and the choice stay in view; it sits directly under the board (reference).
  const kindsOn = canPlace && !opening && !sel;
  const firstTurn = canPlace && opening; // the opening placement is always the opponent's flat: only «تخت» is lit
  const tools = (
    <div className="tak__tools" role="toolbar" aria-label="نوع سنگ و تعداد برداشتن">
      <span className="tak__kinds" role="group" aria-label="گذاشتن">
        {(['F', 'S', 'C'] as Kind[]).map((k) => (
          <button key={k} type="button" aria-pressed={(kindsOn && kind === k) || (firstTurn && k === 'F')} disabled={firstTurn ? k !== 'F' : !kindsOn || (k === 'C' ? !reserve.caps : !reserve.stones)} onClick={() => setKind(k)}>
            <img className="tak-kind" src={STONE[myColor][k]} alt="" aria-hidden="true" />{KIND_FA[k]}
            <span className="tak__left">{fa(k === 'C' ? reserve.caps : reserve.stones)}</span>
          </button>
        ))}
      </span>
      {sel && !sel.dir && (
        <span className="tak__lift" role="group" aria-label="برداشتن از پشته">
          برداشتن
          {Array.from({ length: Math.min(view.board[sel.from]!.length, n) }, (_, k) => k + 1).filter((k) => moves.some((m) => m.from === sel.from && m.drops.reduce((a, b) => a + b, 0) === k)).map((k) => (
            <button key={k} type="button" aria-pressed={sel.lift === k} onClick={() => setSel({ ...sel, lift: k })}>{fa(k)}</button>
          ))}
        </span>
      )}
      {sel && <Button size="sm" variant="ghost" onClick={() => setSel(null)}>انصراف</Button>}
    </div>
  );

  return (
    <div className="tak" data-ply={view.ply} ref={root}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          <p>{opening ? <>اولین نوبت: یک <b>سنگ تخت حریف</b> را بگذارید.</>
            : sel ? <>سنگ‌ها را در یک خط پخش کنید؛ <b>هر خانه دست‌کم یک سنگ</b> می‌گیرد.</>
              : <>جاده‌ای از دو لبهٔ روبه‌رو با سنگ‌های تخت و سرستون بسازید. دیوار جاده نیست و روی آن فقط سرستون می‌نشیند.</>}</p>
        </RailSlot>
      )}
      {!framed && (
        <div className="tak__bar">
          {(['w', 'b'] as Color[]).map((c) => (
            <div key={c} className={['tak-side', view.turn === c && !view.outcome ? 'tak-side--turn' : ''].join(' ')}>
              <img className="tak-side__chip" src={STONE[c].F} alt="" aria-hidden="true" />
              <bdi className="tak-side__name">{who(c)}</bdi>
              <Stat n={view.reserve[c].stones * 100 + view.reserve[c].caps}>{fa(view.reserve[c].stones)} سنگ{view.reserve[c].caps ? <><span className="bgv-sep" />{fa(view.reserve[c].caps)} سرستون</> : null}</Stat>
            </div>
          ))}
        </div>
      )}

      <ZoomBoard label="صفحه تاک">
        <svg className="tak-board" viewBox={`0 0 ${W} ${W}`} role="grid" aria-label="صفحه تاک" style={{ direction: 'ltr' }}>
          <image href={BOARD[n] ?? board5} x="0" y="0" width={W} height={W} />
          {view.board.map((stack, i) => {
            const { x, y } = xy(i);
            const lit = moveTargets.has(i) || (!sel && ((canPlace && !stack.length) || (canMove && movable.has(i))));
            const isHint = hint?.at === i;
            return (
              <g key={i} role="gridcell" tabIndex={lit ? 0 : -1}
                aria-label={`${'abcdef'[i % n]}${Math.floor(i / n) + 1}: ${stack.length ? `${fa(stack.length)} سنگ، بالایی ${KIND_FA[stack.at(-1)!.t]} ${stack.at(-1)!.c === myColor ? 'شما' : 'حریف'}` : 'خالی'}${moveTargets.has(i) ? '، گذاشتن سنگ اینجا' : ''}`}
                className={['tak-sq', lit ? 'tak-sq--lit' : '', moveTargets.has(i) ? 'tak-sq--drop' : '', sel?.from === i ? 'tak-sq--sel' : '', road.has(i) ? 'tak-sq--road' : '', isHint ? 'tak-sq--hint' : '',
                  last && ((last.t === 'place' && last.at === i) || (last.t === 'move' && last.from === i)) ? 'tak-sq--last' : ''].join(' ')}
                onClick={() => tap(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(i); } }}>
                <rect x={x - S / 2 + 0.03 * S} y={y - S / 2 + 0.03 * S} width={0.94 * S} height={0.94 * S} rx="8" className="tak-sq__bg" />
                <StackShape x={x} y={y} sz={0.94 * S} stack={stack} ids={ids.slice(i * K, i * K + K)} fresh={fresh} lifted={sel?.from === i ? sel.lift : 0} />
                {!stack.length && lit && !sel && <circle cx={x} cy={y} r={S * 0.1} className="tak-dot" />}
                {stack.length > 1 && <text x={x - S / 2 + 0.12 * S} y={y - S / 2 + 0.22 * S} className="tak-height">{fa(stack.length)}</text>}
              </g>
            );
          })}
        </svg>
      </ZoomBoard>

      {tools}
      {view.end && <p className="tak__end" role="status">{view.end.kind === 'road' ? 'جاده کامل شد!' : view.end.kind === 'flats' ? `شمارش سنگ‌های تخت: سفید ${fa(view.end.flats!.w)} — سیاه ${fa(view.end.flats!.b)}` : view.end.kind === 'resign' ? 'انصراف' : 'اتمام زمان'}</p>}
    </div>
  );
}

function Stat({ n, children }: { n: number; children: ReactNode }) {
  return <span key={n} className={`tak-side__stat ${usePop(n)}`}>{children}</span>;
}

function StackShape({ x, y, sz, stack, ids, fresh, lifted }: { x: number; y: number; sz: number; stack: Stone[]; ids: (string | null)[]; fresh: ReadonlySet<string>; lifted: number }) {
  if (!stack.length) return null;
  const shown = stack.slice(-7);
  const base = stack.length - shown.length;
  return (
    <g className="tak-stack" pointerEvents="none">
      {shown.map((st, k) => {
        const idx = base + k;
        // Each layer sits a little higher so the stack reads as a pile.
        const up = k * 0.09 * sz + (idx >= stack.length - lifted ? 0.16 * sz : 0);
        const cy = y - up;
        const isTop = k === shown.length - 1;
        // Only the top stone shows its kind; everything beneath reads as a flat.
        const id = ids[idx] ?? `s${idx}`;
        return <g key={id} data-flip={id} data-flip-enter="none"><image href={STONE[st.c][isTop ? st.t : 'F']} x={x - sz / 2} y={cy - sz / 2} width={sz} height={sz} className={fresh.has(id) ? 'bg-land' : undefined} /></g>;
      })}
    </g>
  );
}
