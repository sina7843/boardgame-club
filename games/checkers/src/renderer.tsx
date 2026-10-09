// چکرز renderer: an inlaid maple/walnut board (SVG, LTR geometry), seen from the viewer's side. Tap a ringed piece;
// if it has one move it plays at once, otherwise tap the highlighted squares (jump by jump) until the move is unique.
import './renderer.css';
import { useEffect, useId, useState } from 'react';
import { Button, TurnIndicator, ZoomBoard, useFresh, usePop, type GameRendererProps } from '@bg/ui';
import manD from './art/man-d.webp';
import kingD from './art/king-d.webp';
import manL from './art/man-l.webp';
import kingL from './art/king-l.webp';
import texWalnut from './art/tex-walnut.webp';
import texMaple from './art/tex-maple.webp';
import { colOf, rowOf, type CheckersView, type Color, type Piece } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const S = 100, M = 34, SIZE = 8 * S + 2 * M;
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

export default function CheckersRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<CheckersView>) {
  const myColor: Color = mySeat === null ? 'd' : view.colors[mySeat]!;
  const uid = useId().replace(/:/g, '');
  const flip = myColor === 'l';
  const xy = (i: number) => {
    const c = flip ? 7 - colOf(i) : colOf(i);
    const r = flip ? rowOf(i) : 7 - rowOf(i);
    return { x: M + c * S + S / 2, y: M + r * S + S / 2 };
  };
  const paths = legalActions.filter((a) => a.type === 'move').map((a) => a.path as number[]);
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

  const last = view.last;
  const movedTo = last ? last.path.at(-1)! : -1;
  const lastFrom = last ? xy(last.path[0]!) : null;
  const lastTo = last ? xy(movedTo) : null;
  const myTurn = paths.length > 0;
  const captured = { d: 12 - view.counts.d - view.counts.D, l: 12 - view.counts.l - view.counts.L };
  const seatOfColor = (c: Color) => (view.colors[0] === c ? 0 : 1);
  const who = (c: Color) => (seatOfColor(c) === mySeat ? 'شما' : seatName(seatOfColor(c)));

  let status: { tone: 'mine' | 'wait'; text: string } | null = null;
  if (!view.outcome) {
    const mustCapture = paths.some((p) => p.length > 2 || Math.abs(rowOf(p[0]!) - rowOf(p[1]!)) > 1);
    status = myTurn
      ? { tone: 'mine', text: prefix.length ? 'خانه روشن بعدی را بزنید' : mustCapture ? 'نوبت شماست: زدن اجباری است' : 'نوبت شماست: یک مهره را بزنید' }
      : { tone: 'wait', text: `نوبت ${view.current === null ? '' : seatName(view.current)}` };
  }
  const endText = view.end && {
    win: 'همه مهره‌ها زده شد', blocked: 'حریف حرکتی نداشت', resign: 'انصراف', timeout: 'اتمام زمان',
    draw: view.end.draw === 'repetition' ? 'تکرار سه‌باره — مساوی' : view.end.draw === 'quiet' ? '۴۰ حرکت بدون زدن — مساوی' : 'توافق — مساوی'
  }[view.end.kind];

  return (
    <div className="ck" data-moves={moveCount}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <div className="ck__bar">
        {(['d', 'l'] as Color[]).map((c) => (
          <div key={c} className={['ck-side', view.turn === c && !view.outcome ? 'ck-side--turn' : ''].join(' ')}>
            <span className={`ck-side__chip ck-side__chip--${c}`} aria-hidden="true" />
            <bdi className="ck-side__name">{who(c)}</bdi>
            <Stat n={view.counts[c] + view.counts[c.toUpperCase() as 'D' | 'L']}>{fa(view.counts[c] + view.counts[c.toUpperCase() as 'D' | 'L'])} مهره{view.counts[c.toUpperCase() as 'D' | 'L'] ? ` · ${fa(view.counts[c.toUpperCase() as 'D' | 'L'])} شاه` : ''}</Stat>
            <span className="ck-side__caps" aria-label={`${fa(captured[c === 'd' ? 'l' : 'd'])} مهره زده`}>
              <Caps n={captured[c === 'd' ? 'l' : 'd']} color={c === 'd' ? 'l' : 'd'} />
            </span>
          </div>
        ))}
        <span className="ck__variant">{view.variant === 'brazilian' ? 'قوانین برزیلی' : 'قوانین انگلیسی'}</span>
      </div>

      <ZoomBoard label="صفحه چکرز">
        <svg className="ck-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="grid" aria-label="صفحه چکرز" style={{ direction: 'ltr' }}>
          <defs>
            <linearGradient id="ck-frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6b4223" /><stop offset=".5" stopColor="#3f2511" /><stop offset="1" stopColor="#5d3a1d" /></linearGradient>
            {([['walnut', texWalnut], ['maple', texMaple]] as const).map(([id, src]) => (
              <pattern key={id} id={`ck-${id}-${uid}`} x={M} y={M} width={S * 2} height={S * 2} patternUnits="userSpaceOnUse"><image href={src} width={S * 2} height={S * 2} preserveAspectRatio="xMidYMid slice" /></pattern>
            ))}
            <filter id="ck-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="3.5" floodOpacity=".5" /></filter>
          </defs>
          <rect width={SIZE} height={SIZE} rx="20" fill="url(#ck-frame)" />
          <rect x={M - 6} y={M - 6} width={8 * S + 12} height={8 * S + 12} rx="6" fill="none" stroke="#c9a46a" strokeWidth="3" />

          {Array.from({ length: 64 }, (_, i) => {
            const { x, y } = xy(i);
            const dark = (rowOf(i) + colOf(i)) % 2 === 0;
            const isMovable = movable.has(i) && !busy;
            const isNext = nextSquares.has(i);
            const isHint = hint && (prefix.length ? hint[prefix.length] === i : hint[0] === i);
            const isLast = last && (last.path.includes(i));
            return (
              <g key={i} role="gridcell" aria-label={`${name(i)}${view.board[i] ? `: ${pieceFa(view.board[i]!, myColor)}` : ''}${isMovable ? '، قابل حرکت' : ''}${isNext ? '، مقصد' : ''}`}
                tabIndex={dark && (isMovable || isNext) ? 0 : -1}
                className={['ck-sq', isMovable ? 'ck-sq--movable' : '', isNext ? 'ck-sq--next' : '', prefix.includes(i) ? 'ck-sq--path' : '', isHint ? 'ck-sq--hint' : ''].join(' ')}
                onClick={() => dark && tap(i)} onKeyDown={(e) => { if (dark && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tap(i); } }}>
                <rect x={x - S / 2} y={y - S / 2} width={S} height={S} fill={`url(#ck-${dark ? 'walnut' : 'maple'}-${uid})`} />
                {isLast && <rect x={x - S / 2} y={y - S / 2} width={S} height={S} className="ck-last" />}
                {isNext && <circle cx={x} cy={y} r={S * 0.2} className="ck-dot" />}
              </g>
            );
          })}
          {/* Coordinates on the frame. */}
          {Array.from({ length: 8 }, (_, k) => {
            const file = flip ? 7 - k : k;
            const rank = flip ? k + 1 : 8 - k;
            return (
              <g key={k} className="ck-coord">
                <text x={M + k * S + S / 2} y={SIZE - 10}>{FILES[file]}</text>
                <text x={16} y={M + k * S + S / 2 + 6}>{rank}</text>
              </g>
            );
          })}

          {/* Pieces captured by the last move fade away. */}
          {last?.captured.map((i) => {
            const { x, y } = xy(i);
            const victim: Piece = view.colors[last.seat] === 'd' ? 'l' : 'd';
            return <g key={`ghost${moveCount}-${i}`} className="ck-ghost" pointerEvents="none"><Disc x={x} y={y} p={victim} /></g>;
          })}

          {view.board.map((p, i) => {
            if (!p) return null;
            const { x, y } = xy(i);
            const moved = i === movedTo && lastFrom && lastTo;
            const ring = movable.has(i) && !busy;
            return (
              <g key={`${i}-${moved ? moveCount : 0}`} pointerEvents="none"
                className={['ck-pc', moved ? 'ck-pc--moved' : '', moved && last!.crowned ? 'ck-pc--crowned' : ''].join(' ')}
                style={moved ? { ['--dx' as string]: `${lastFrom!.x - lastTo!.x}px`, ['--dy' as string]: `${lastFrom!.y - lastTo!.y}px` } : undefined}>
                <Disc x={x} y={y} p={p} />
                {ring && <circle cx={x} cy={y} r={S * 0.43} className={prefix[0] === i ? 'ck-ring ck-ring--sel' : 'ck-ring'} />}
              </g>
            );
          })}
        </svg>
      </ZoomBoard>

      <div className="ck__actions">
        {myTurn && !busy && (
          <label className="ck-offer"><input type="checkbox" checked={offer} onChange={(e) => setOffer(e.target.checked)} /> پیشنهاد تساوی همراه حرکت</label>
        )}
        {legalActions.some((a) => a.type === 'acceptDraw') && <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAction({ type: 'acceptDraw' })}>پذیرفتن تساوی</Button>}
        {view.drawOffer !== null && view.drawOffer === mySeat && !view.outcome && <span className="ck__note">پیشنهاد تساوی شما ارسال شد</span>}
        {prefix.length > 0 && !busy && <Button size="sm" variant="ghost" onClick={() => setPrefix([])}>انتخاب دوباره</Button>}
      </div>
      {endText && <p className="ck__end" role="status">{endText}</p>}
      <ol className="ck__history" aria-label="حرکت‌ها">
        {view.history.slice(-8).map((h, k) => (
          <li key={view.history.length - 8 + k}><bdi dir="ltr">{h.path.map(name).join(h.captured.length ? '×' : '-')}{h.crowned ? ' ♛' : ''}</bdi></li>
        ))}
      </ol>
    </div>
  );
}

const pieceFa = (p: Piece, mine: Color) => `${(p.toLowerCase() === mine) ? 'مهره شما' : 'مهره حریف'}${p === 'D' || p === 'L' ? ' (شاه)' : ''}`;

function Disc({ x, y, p }: { x: number; y: number; p: Piece }) {
  const w = S * 0.84;
  return (
    <g filter="url(#ck-shadow)">
      <image href={PIECE[p]} x={x - w / 2} y={y - w / 2} width={w} height={w} className={p === 'D' || p === 'L' ? 'ck-crown' : undefined} />
    </g>
  );
}
