// چکرز renderer: an inlaid maple/walnut board (SVG, LTR geometry), seen from the viewer's side. Tap a ringed piece;
// if it has one move it plays at once, otherwise tap the highlighted squares (jump by jump) until the move is unique.
import './renderer.css';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button, DockSlot, MOTION, RailSlot, TurnIndicator, ZoomBoard, motionOff, useFresh, useInFrame, usePop, useTermsLang, tx, type GameRendererProps } from '@bg/ui';
import { Button as DsButton } from '@bg/ui/bgv';
import manD from './art/checkers-black-man.png';
import kingD from './art/checkers-black-king.png';
import manL from './art/checkers-white-man.png';
import kingL from './art/checkers-white-king.png';
import boardArt from './art/checkers-board.png';
import { terms } from './terms.ts';
import { colOf, notation, rowOf, type CheckersView, type Color, type Move, type Piece } from './rules.ts';

/** My queued move applied locally (undo window): the path is mine, captures are the pieces jumped, a man ending on the last row crowns. */
function previewMove(v: CheckersView, path: number[]): { board: (Piece | null)[]; last: Move } | null {
  const board = v.board.slice();
  const p = board[path[0]!];
  if (!p) return null;
  const captured: number[] = [];
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1]!, b = path[k]!;
    const dr = Math.sign(rowOf(b) - rowOf(a)), dc = Math.sign(colOf(b) - colOf(a));
    for (let r = rowOf(a) + dr, c = colOf(a) + dc; r !== rowOf(b); r += dr, c += dc) if (board[r * 8 + c]) { captured.push(r * 8 + c); board[r * 8 + c] = null; break; }
  }
  const end = path.at(-1)!;
  const crowned = (p === 'd' && rowOf(end) === 7) || (p === 'l' && rowOf(end) === 0);
  board[path[0]!] = null;
  board[end] = crowned ? (p.toUpperCase() as Piece) : p;
  return { board, last: { path, captured, crowned } };
}
const HOP = 380;
/** Desktop (≥900): game buttons sit in the rail; on phones the rail is folded away, so they go to the dock. */
const WIDE = '(min-width: 900px)';
const useWide = () => useSyncExternalStore((f) => { const q = matchMedia(WIDE); q.addEventListener('change', f); return () => q.removeEventListener('change', f); }, () => matchMedia(WIDE).matches, () => true);

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
// The board PNG has a 2.67 % frame; 8 squares of S fill the rest (SIZE = 8·S / (1 − 2·0.0267)).
const S = 100, M = 22.5, SIZE = 8 * S + 2 * M;
// Pieces and board woods are cut from a generated sheet (see DECISIONS.md).
const PIECE: Record<Piece, string> = { d: manD, D: kingD, l: manL, L: kingL };
const FILES = 'abcdefgh';
const name = (i: number) => `${FILES[colOf(i)]}${rowOf(i) + 1}`;

// Captured-count readout: the number bumps and each new captured disc lands.
function Caps({ n, color }: { n: number; color: Color }) {
  const fresh = useFresh(Array.from({ length: n }, (_, k) => String(k)));
  return <>{Array.from({ length: n }, (_, k) => <i key={k} className={`ck-cap ck-cap--${color}${fresh.has(String(k)) ? ' bg-land' : ''}`} />)}</>;
}
function Stat({ n, children }: { n: number; children: React.ReactNode }) {
  const pop = usePop(n);
  return <span key={n} className={`ck-side__stat ${pop}`}>{children}</span>;
}

export default function CheckersRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<CheckersView>) {
  useTermsLang(); // re-render when the terms language changes
  const framed = useInFrame() !== null; // the shell draws players, piece counts, turn and the move list
  const wide = useWide();
  const myColor: Color = mySeat === null ? 'd' : view.colors[mySeat]!;
  const flip = myColor === 'l';
  const xy = (i: number) => {
    const c = flip ? 7 - colOf(i) : colOf(i);
    const r = flip ? rowOf(i) : 7 - rowOf(i);
    return { x: M + c * S + S / 2, y: M + r * S + S / 2 };
  };
  // Undo window: my move is shown at once (hop by hop, captures fading); undo slides it back.
  const pv = queued?.type === 'move' ? previewMove(view, queued.path as number[]) : null;
  const board = pv?.board ?? view.board;
  const paths = pv ? [] : legalActions.filter((a) => a.type === 'move').map((a) => a.path as number[]);
  const [prefix, setPrefix] = useState<number[]>([]);
  const [offer, setOffer] = useState(false);
  const moveCount = view.history.length;
  useEffect(() => { setPrefix([]); }, [moveCount]);
  const hint = expected?.type === 'move' ? (expected.path as number[]) : null;

  const matching = paths.filter((p) => prefix.every((s, k) => p[k] === s));
  const movable = new Set(paths.map((p) => p[0]!));
  const nextSquares = new Set(prefix.length ? matching.filter((p) => p.length > prefix.length).map((p) => p[prefix.length]!) : []);

  const play = (path: number[]) => { onAction({ type: 'move', path, ...(offer ? { offerDraw: true } : {}) }); setPrefix([]); setOffer(false); };
  const tap = (i: number) => {
    if (busy) return;
    if (prefix.length && nextSquares.has(i)) {
      const pre = [...prefix, i];
      const left = paths.filter((p) => pre.every((s, k) => p[k] === s));
      return left.length === 1 ? play(left[0]!) : setPrefix(pre);
    }
    if (movable.has(i)) {
      const mine = paths.filter((p) => p[0] === i);
      if (mine.length === 1) return play(mine[0]!);
      return setPrefix(prefix[0] === i && prefix.length === 1 ? [] : [i]);
    }
    setPrefix([]);
  };

  const last = pv?.last ?? view.last;
  const movedTo = last ? last.path.at(-1)! : -1;
  // One key per move shown: the preview and the server's copy of the same move share it, so confirming never replays.
  const shownKey = `${moveCount + (pv ? 1 : 0)}:${last?.path.join('.') ?? ''}`;
  const svg = useRef<SVGSVGElement>(null);
  const shown = useRef<{ key: string; pv: boolean; path: number[] } | null>(null);
  const undone = !!shown.current && shown.current.pv && !pv && shown.current.key !== shownKey && Number(shown.current.key.split(':')[0]) > moveCount;
  useLayoutEffect(() => {
    const prev = shown.current;
    shown.current = { key: shownKey, pv: !!pv, path: last?.path ?? [] };
    if (!prev || prev.key === shownKey || motionOff() || !svg.current) return;
    // Undo: the previewed piece goes back along its path; otherwise the moved piece travels its path hop by hop.
    const back = prev.pv && !pv && Number(prev.key.split(':')[0]) > moveCount;
    const path = back ? [...prev.path].reverse() : last?.path;
    if (!path || path.length < 2) return;
    const el = svg.current.querySelector(`[data-sq="${path.at(-1)}"]`);
    if (!el) return;
    const end = xy(path.at(-1)!);
    const frames: Keyframe[] = [];
    path.forEach((sq, k) => {
      const at = xy(sq);
      const t = `translate(${at.x - end.x}px, ${at.y - end.y}px)`;
      frames.push({ transform: `${t} scale(1)`, offset: k / (path.length - 1) });
      if (k < path.length - 1) {
        const nx = xy(path[k + 1]!);
        frames.push({ transform: `translate(${(at.x + nx.x) / 2 - end.x}px, ${(at.y + nx.y) / 2 - end.y}px) scale(1.14)`, offset: (k + 0.5) / (path.length - 1) });
      }
    });
    el.animate(frames, { duration: HOP * (path.length - 1) + MOTION.move - HOP, easing: 'ease-in-out', fill: 'backwards' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per shown move
  }, [shownKey]);
  const myTurn = paths.length > 0;
  const captured = { d: 12 - view.counts.d - view.counts.D, l: 12 - view.counts.l - view.counts.L };
  const seatOfColor = (c: Color) => (view.colors[0] === c ? 0 : 1);
  const who = (c: Color) => (seatOfColor(c) === mySeat ? 'شما' : seatName(seatOfColor(c)));

  let status: { tone: 'mine' | 'wait'; text: string } | null = null;
  if (!view.outcome) {
    const mustCapture = paths.some((p) => p.length > 2 || Math.abs(rowOf(p[0]!) - rowOf(p[1]!)) > 1);
    status = queued ? { tone: 'wait', text: 'حرکت شما در حال ثبت است…' } : myTurn
      ? { tone: 'mine', text: prefix.length ? 'خانه روشن بعدی را بزنید' : mustCapture ? `نوبت شماست: ${tx(terms.capture)} اجباری است` : `نوبت شماست: یک ${tx(terms.piece)} را بزنید` }
      : { tone: 'wait', text: `نوبت ${view.current === null ? '' : seatName(view.current)}` };
  }
  const endText = view.end && {
    win: `همه ${tx(terms.pieces)} زده شد`, blocked: 'حریف حرکتی نداشت', resign: 'انصراف', timeout: 'اتمام زمان',
    draw: view.end.draw === 'repetition' ? `${tx(terms.threefold)} — ${tx(terms.draw)}` : view.end.draw === 'quiet' ? `۴۰ حرکت بدون ${tx(terms.capture)} — ${tx(terms.draw)}` : `توافق — ${tx(terms.draw)}`
  }[view.end.kind];

  // Draw offer travels with my next move (the engine has no stand-alone offer), so «مساوی» is a toggle.
  const drawBtn = myTurn && !busy && !view.outcome
    ? <DsButton key="draw" className="ck-drawbtn" variant="secondary" icon="handshake" pressed={offer} onClick={() => setOffer(!offer)}>{offer ? `${tx(terms.draw)} با حرکت بعد` : tx(terms.draw)}</DsButton>
    : view.drawOffer !== null && view.drawOffer === mySeat && !view.outcome ? <span key="draw" className="ck-ml__note">پیشنهاد {tx(terms.draw)} شما ارسال شد</span> : null;
  const acceptBtn = legalActions.some((a) => a.type === 'acceptDraw') ? <DsButton key="acc" disabled={busy} icon="handshake" onClick={() => onAction({ type: 'acceptDraw' })}>پذیرفتن {tx(terms.draw)}</DsButton> : null;
  const redoBtn = prefix.length > 0 && !busy ? <DsButton key="redo" variant="ghost" onClick={() => setPrefix([])}>انتخاب دوباره</DsButton> : null;

  return (
    <div className="ck" data-moves={moveCount}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          <p>{view.variant === 'brazilian' ? <><b>قوانین برزیلی:</b> {tx(terms.piece)} و {tx(terms.king)} به عقب هم می‌زنند و {tx(terms.flyingKing)} است؛ {tx(terms.capture)} بیشترین {tx(terms.piece)} اجباری است.</> : <><b>قوانین انگلیسی: {tx(terms.jump)} اجباری است.</b> {tx(terms.piece)} فقط به جلو و مورب می‌رود. {tx(terms.pieceIndef)} که به {tx(terms.kingRow)} برسد {tx(terms.king)} می‌شود و نوبت تمام می‌شود.</>}</p>
          <section className="ck-ml" aria-label="حرکت‌ها">
            <h3>حرکت‌ها<span className="ck-ml__note">شمارهٔ خانه‌ها ۱ تا ۳۲</span></h3>
            <div className="ck-ml__grid" role="list">
              <span className="ck-ml__h">#</span><span className="ck-ml__h">سیاه</span><span className="ck-ml__h">سفید</span>
              {Array.from({ length: Math.ceil(moveCount / 2) }, (_, r) => [
                <span key={`n${r}`} className="ck-ml__n">{fa(r + 1)}.</span>,
                ...[0, 1].map((k) => { const h = view.history[r * 2 + k]; return <bdi key={`${r}-${k}`} role="listitem" dir="ltr" className={r * 2 + k === moveCount - 1 ? 'ck-ml__m is-cur' : 'ck-ml__m'}>{h ? notation(h) : ''}</bdi>; })
              ]).flat().slice(-90)}
            </div>
            {!moveCount && <p className="ck-ml__note">هنوز حرکتی ثبت نشده است.</p>}
          </section>
          {wide && drawBtn}
        </RailSlot>
      )}
      {framed && (!wide ? <DockSlot>{drawBtn}{acceptBtn}{redoBtn}</DockSlot> : <DockSlot>{acceptBtn}{redoBtn}</DockSlot>)}
      {!framed && <div className="ck__bar">
        {(['d', 'l'] as Color[]).map((c) => (
          <div key={c} className={['ck-side', view.turn === c && !view.outcome ? 'ck-side--turn' : ''].join(' ')}>
            <span className={`ck-side__chip ck-side__chip--${c}`} aria-hidden="true" />
            <bdi className="ck-side__name">{who(c)}</bdi>
            <Stat n={view.counts[c] + view.counts[c.toUpperCase() as 'D' | 'L']}>{fa(view.counts[c] + view.counts[c.toUpperCase() as 'D' | 'L'])} {tx(terms.piece)}{view.counts[c.toUpperCase() as 'D' | 'L'] ? `، ${fa(view.counts[c.toUpperCase() as 'D' | 'L'])} ${tx(terms.king)}` : ''}</Stat>
            <span className="ck-side__caps" aria-label={`${fa(captured[c === 'd' ? 'l' : 'd'])} ${tx(terms.piece)} زده`}>
              <Caps n={captured[c === 'd' ? 'l' : 'd']} color={c === 'd' ? 'l' : 'd'} />
            </span>
          </div>
        ))}
        <span className="ck__variant">{view.variant === 'brazilian' ? 'قوانین برزیلی' : 'قوانین انگلیسی'}</span>
      </div>}

      <ZoomBoard label="صفحه چکرز">
        <svg ref={svg} className="ck-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label="صفحه چکرز" style={{ direction: 'ltr' }}>
          <defs>
            <filter id="ck-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="3.5" floodOpacity=".5" /></filter>
          </defs>
          <image href={boardArt} width={SIZE} height={SIZE} />

          {Array.from({ length: 64 }, (_, i) => {
            const { x, y } = xy(i);
            const dark = (rowOf(i) + colOf(i)) % 2 === 0;
            const isMovable = movable.has(i) && !busy;
            const isNext = nextSquares.has(i);
            const isHint = hint && (prefix.length ? hint[prefix.length] === i : hint[0] === i);
            const isLast = last && (last.path.includes(i));
            return (
              <g key={i} role="gridcell" aria-label={`${name(i)}${board[i] ? `: ${pieceFa(board[i]!, myColor)}` : ''}${isMovable ? '، قابل حرکت' : ''}${isNext ? '، مقصد' : ''}`}
                tabIndex={dark && (isMovable || isNext) ? 0 : -1}
                className={['ck-sq', isMovable ? 'ck-sq--movable' : '', isNext ? 'ck-sq--next' : '', prefix.includes(i) ? 'ck-sq--path' : '', isHint ? 'ck-sq--hint' : ''].join(' ')}
                onClick={() => dark && tap(i)} onKeyDown={(e) => { if (dark && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tap(i); } }}>
                <rect x={x - S / 2} y={y - S / 2} width={S} height={S} fill="transparent" />
                {isLast && <rect x={x - S / 2} y={y - S / 2} width={S} height={S} className="ck-last" />}
                {isNext && <circle cx={x} cy={y} r={S * 0.15} className="ck-dot" />}
              </g>
            );
          })}
          {/* Coordinates on the frame. */}
          {!framed && Array.from({ length: 8 }, (_, k) => {
            const file = flip ? 7 - k : k;
            const rank = flip ? k + 1 : 8 - k;
            return (
              <g key={k} className="ck-coord">
                <text x={M + k * S + S / 2} y={SIZE - 6}>{FILES[file]}</text>
                <text x={6} y={M + k * S + S / 2 + 6}>{rank}</text>
              </g>
            );
          })}

          {/* Pieces captured by the last move fade away. */}
          {!undone && last?.captured.map((i, k) => {
            const { x, y } = xy(i);
            const victim: Piece = board[movedTo]?.toLowerCase() === 'd' ? 'l' : 'd';
            return <g key={`ghost${shownKey}-${i}`} className="ck-ghost" style={{ animationDelay: `${(k + 0.6) * HOP}ms` }} pointerEvents="none"><Disc x={x} y={y} p={victim} /></g>;
          })}

          {board.map((p, i) => {
            if (!p) return null;
            const { x, y } = xy(i);
            const moved = i === movedTo && !undone;
            const ring = movable.has(i) && !busy;
            return (
              <g key={`${i}-${moved ? shownKey : 0}`} pointerEvents="none" data-sq={i}
                className={['ck-pc', moved && last!.crowned ? 'ck-pc--crowned' : ''].join(' ')}
                style={moved && last!.crowned ? { ['--hops' as string]: last!.path.length - 1 } : undefined}>
                <Disc x={x} y={y} p={p} />
                {ring && <circle cx={x} cy={y} r={S * 0.43} className={prefix[0] === i ? 'ck-ring ck-ring--sel' : 'ck-ring'} />}
              </g>
            );
          })}
        </svg>
      </ZoomBoard>

      {!framed && <div className="ck__actions">
        {myTurn && !busy && (
          <label className="ck-offer"><input type="checkbox" checked={offer} onChange={(e) => setOffer(e.target.checked)} /> پیشنهاد {tx(terms.drawAlt)} همراه حرکت</label>
        )}
        {legalActions.some((a) => a.type === 'acceptDraw') && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'acceptDraw' })}>پذیرفتن {tx(terms.drawAlt)}</Button>}
        {view.drawOffer !== null && view.drawOffer === mySeat && !view.outcome && <span className="ck__note">پیشنهاد {tx(terms.drawAlt)} شما ارسال شد</span>}
        {prefix.length > 0 && !busy && <Button size="sm" variant="ghost" onClick={() => setPrefix([])}>انتخاب دوباره</Button>}
      </div>}
      {!framed && endText && <p className="ck__end" role="status">{endText}</p>}
      {!framed && <ol className="ck__history" aria-label="حرکت‌ها">
        {view.history.slice(-8).map((h, k) => (
          <li key={view.history.length - 8 + k}><bdi dir="ltr">{h.path.map(name).join(h.captured.length ? '×' : '-')}{h.crowned ? ' ♛' : ''}</bdi></li>
        ))}
      </ol>}
    </div>
  );
}

const pieceFa = (p: Piece, mine: Color) => `${(p.toLowerCase() === mine) ? `${tx(terms.piece)} شما` : `${tx(terms.piece)} حریف`}${p === 'D' || p === 'L' ? ` (${tx(terms.king)})` : ''}`;

function Disc({ x, y, p }: { x: number; y: number; p: Piece }) {
  const w = S * 0.82;
  return (
    <g filter="url(#ck-shadow)">
      <image href={PIECE[p]} x={x - w / 2} y={y - w / 2} width={w} height={w} className={p === 'D' || p === 'L' ? 'ck-crown' : undefined} />
    </g>
  );
}
