// کندو renderer: hexagonal tiles with drawn bugs on a felt table; the view fits the hive as it grows.
// Place: tap a bug in your reserve, then a lit spot. Move: tap one of your pieces, then a lit destination.
import './renderer.css';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { TurnIndicator, ZoomBoard, useFlip, useFresh, usePieceIds, usePop, type GameRendererProps } from '@bg/ui';
import bugQ from './art/bug-Q.webp';
import bugS from './art/bug-S.webp';
import bugB from './art/bug-B.webp';
import bugG from './art/bug-G.webp';
import bugA from './art/bug-A.webp';
import texFelt from './art/tex-felt.webp';
import { DIRS, START_RESERVE, destinations, key, parse, placements, type Bug, type Color, type Hex, type HiveView, type Piece } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
const R = 46;
const BUG_FA: Record<Bug, string> = { Q: 'ملکه زنبور', S: 'عنکبوت', B: 'سوسک', G: 'ملخ', A: 'مورچه' };
// Bug and felt art are cut from a generated sheet (see DECISIONS.md).
const BUG_IMG: Record<Bug, string> = { Q: bugQ, S: bugS, B: bugB, G: bugG, A: bugA };
const px = ([q, r]: Hex) => ({ x: R * Math.sqrt(3) * (q + r / 2), y: R * 1.5 * r });
const hexPoints = (x: number, y: number, rr: number) => Array.from({ length: 6 }, (_, k) => {
  const a = (Math.PI / 3) * k + Math.PI / 6;
  return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
}).join(' ');

type Queued = { type: string; bug?: Bug; from?: Hex; to?: Hex };

/** My queued place/move applied to the board at once (all of it is already known on the client). */
function preview(v: HiveView, q: Queued | null | undefined, c: Color): HiveView {
  if (!q?.to) return v;
  const stacks = { ...v.stacks }, to = key(q.to);
  if (q.type === 'place' && q.bug) {
    stacks[to] = [...(stacks[to] ?? []), { c, t: q.bug }];
    return { ...v, stacks, reserve: { ...v.reserve, [c]: { ...v.reserve[c], [q.bug]: v.reserve[c][q.bug] - 1 } } };
  }
  if (q.type === 'move' && q.from) {
    const from = key(q.from), src = stacks[from] ?? [], top = src.at(-1);
    if (!top) return v;
    if (src.length > 1) stacks[from] = src.slice(0, -1); else delete stacks[from];
    stacks[to] = [...(stacks[to] ?? []), top];
    return { ...v, stacks };
  }
  return v;
}

const hexDist = (a: string, b: string) => {
  const [aq, ar, al] = a.split(/[,#]/).map(Number), [bq, br, bl] = b.split(/[,#]/).map(Number);
  const dq = aq! - bq!, dr = ar! - br!;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2 + Math.abs(al! - bl!);
};

export default function HiveRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<HiveView>) {
  const felt = `${useId()}-felt`;
  const me = mySeat ?? 0;
  const myColor: Color = served.colors[me]!;
  const q = queued as Queued | null | undefined;
  const view = mySeat === null ? served : preview(served, q, myColor);
  // Every tile keeps one motion id while it moves (matched cell to cell by bug and colour, nearest first); slots are
  // "q,r#level" in a list that only grows, so indexes stay stable. Moves glide, placements fly in from the reserve,
  // and undo of my queued move glides the tile back.
  const slots = useRef<string[]>([]);
  for (const [k, st] of Object.entries(view.stacks)) st.forEach((_, l) => { if (!slots.current.includes(`${k}#${l}`)) slots.current.push(`${k}#${l}`); });
  const pieceIds = usePieceIds(slots.current.map((sl) => { const [k, l] = sl.split('#'); const pc = view.stacks[k!]?.[Number(l)]; return pc ? pc.c + pc.t : null; }),
    (a, b) => hexDist(slots.current[a]!, slots.current[b]!));
  const idAt = (k: string, l: number) => pieceIds[slots.current.indexOf(`${k}#${l}`)] ?? undefined;
  const placed = useFresh(pieceIds.filter((x): x is string => !!x)); // new tiles come from the reserve; a tile uncovered by a beetle does not
  const root = useRef<HTMLDivElement>(null);
  useFlip(root, `${view.history.length}|${q ? JSON.stringify(q) : ''}`);
  const canPlace = legalActions.some((a) => a.type === 'place') && !busy;
  const canMove = legalActions.some((a) => a.type === 'move') && !busy;
  const [bug, setBug] = useState<Bug | null>(null);
  const [from, setFrom] = useState<Hex | null>(null);
  useEffect(() => { setBug(null); setFrom(null); }, [view.turnNo, view.history.length]);
  const mustQueen = view.reserve[myColor].Q > 0 && view.placed[myColor] === 3;
  const hint = expected as unknown as ({ type: 'place'; bug: Bug; to: Hex } | { type: 'move'; from: Hex; to: Hex }) | null;
  useEffect(() => { if (hint?.type === 'place') setBug(hint.bug); }, [hint?.type === 'place' ? hint.bug : null]); // eslint-disable-line react-hooks/exhaustive-deps

  const spots = useMemo(() => (canPlace && bug ? placements(view, myColor) : []), [canPlace, bug, view, myColor]);
  const dests = useMemo(() => (canMove && from ? destinations(view, from) : []), [canMove, from, view]);
  const targets = new Map<string, Hex>([...spots, ...dests].map((h) => [key(h), h]));

  // Fit the view: every occupied hex, every target, and one ring around.
  const cells = Object.keys(view.stacks).map(parse);
  const all = [...cells, ...targets.values(), ...cells.flatMap((c) => DIRS.map(([dq, dr]) => [c[0] + dq, c[1] + dr] as Hex))];
  if (!all.length) all.push([0, 0]);
  const pts = all.map(px);
  const minX = Math.min(...pts.map((p) => p.x)) - R * 1.4, maxX = Math.max(...pts.map((p) => p.x)) + R * 1.4;
  const minY = Math.min(...pts.map((p) => p.y)) - R * 1.4, maxY = Math.max(...pts.map((p) => p.y)) + R * 1.4;
  const w = Math.max(maxX - minX, R * 8), h = Math.max(maxY - minY, R * 6);
  const vb = `${(minX + maxX) / 2 - w / 2} ${(minY + maxY) / 2 - h / 2} ${w} ${h}`;

  const tapCell = (hx: Hex) => {
    if (busy) return;
    const t = targets.get(key(hx));
    if (t) {
      if (bug && spots.some((s) => key(s) === key(hx))) onAction({ type: 'place', bug, to: hx });
      else if (from) onAction({ type: 'move', from, to: hx });
      return;
    }
    const topPiece = view.stacks[key(hx)]?.at(-1);
    if (canMove && topPiece?.c === myColor) { setBug(null); setFrom(from && key(from) === key(hx) ? null : hx); }
  };

  const last = view.history.at(-1);
  const surrounded = new Set(view.end?.surrounded ?? []);
  const who = (c: Color) => (view.colors[0] === c ? (mySeat === 0 ? 'شما' : seatName(0)) : (mySeat === 1 ? 'شما' : seatName(1)));
  const lastPass = last?.t === 'pass' ? last : null;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : canPlace || canMove ? { tone: 'mine' as const, text: mustQueen ? 'نوبت چهارم: باید ملکه را بگذارید' : bug ? `جای ${BUG_FA[bug]} را انتخاب کنید` : from ? 'مقصد را بزنید' : 'نوبت شما: بگذارید یا حرکت دهید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.turn)}` };

  return (
    <div className="hv" data-turn={view.turnNo} ref={root}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      <Reserve view={view} color={myColor === 'w' ? 'b' : 'w'} label={`ذخیره ${who(myColor === 'w' ? 'b' : 'w')}`} small />

      <ZoomBoard label="کندو">
        <svg className="hv-board" viewBox={vb} role="grid" aria-label="کندو" style={{ direction: 'ltr' }}>
          <defs>
            <pattern id={felt} patternUnits="userSpaceOnUse" width="256" height="256"><image href={texFelt} width="256" height="256" /></pattern>
            <linearGradient id="hv-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffaf0" /><stop offset="1" stopColor="#ddd2bc" /></linearGradient>
            <linearGradient id="hv-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#77716a" /><stop offset="1" stopColor="#45403a" /></linearGradient>
            <filter id="hv-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="5" stdDeviation="3.5" floodOpacity=".5" /></filter>
          </defs>
          <rect x={(minX + maxX) / 2 - w / 2} y={(minY + maxY) / 2 - h / 2} width={w} height={h} fill={`url(#${felt})`} />
          {[...targets.values()].map((hx) => {
            const { x, y } = px(hx);
            const isHint = hint && key(hint.to) === key(hx);
            return (
              <g key={`t${key(hx)}`} role="button" tabIndex={0} aria-label={`خانه ${key(hx)}، ${bug ? 'جای گذاشتن' : 'مقصد'}`}
                className={isHint ? 'hv-target hv-target--hint' : 'hv-target'} onClick={() => tapCell(hx)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapCell(hx); } }}>
                <polygon points={hexPoints(x, y, R * 0.92)} />
              </g>
            );
          })}
          {Object.entries(view.stacks).map(([k, stack]) => {
            const hx = parse(k);
            const { x, y } = px(hx);
            const topPiece = stack.at(-1)!;
            const mine = topPiece.c === myColor && canMove;
            const isSel = from && key(from) === k;
            const isHint = hint?.type === 'move' && !from && key(hint.from) === k;
            return (
              <g key={k} role="gridcell" tabIndex={mine ? 0 : -1}
                aria-label={`${BUG_FA[topPiece.t]} ${topPiece.c === myColor ? 'شما' : 'حریف'}${stack.length > 1 ? `، ${fa(stack.length)} مهره روی هم` : ''}${isSel ? '، انتخاب‌شده' : ''}`}
                className={['hv-cell', mine ? 'hv-cell--mine' : '', isSel ? 'hv-cell--sel' : '', isHint ? 'hv-cell--hint' : '',
                  topPiece.t === 'Q' && surrounded.has(topPiece.c) ? 'hv-cell--trapped' : ''].join(' ')}
                onClick={() => tapCell(hx)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapCell(hx); } }}>
                {stack.length > 1 && <polygon points={hexPoints(x + 5, y + 7, R * 0.9)} className={`hv-under hv-under--${stack.at(-2)!.c}`} />}
                <g data-flip={idAt(k, stack.length - 1)} data-flip-from={placed.has(idAt(k, stack.length - 1) ?? '') ? `res-${topPiece.c}-${topPiece.t}` : undefined}>
                  <Tile x={x} y={y} p={topPiece} />
                  {stack.length > 1 && <text x={x + R * 0.55} y={y - R * 0.45} className="hv-height">{fa(stack.length)}</text>}
                </g>
              </g>
            );
          })}
        </svg>
      </ZoomBoard>

      <Reserve view={view} color={myColor} label="ذخیره شما" selected={bug} onPick={canPlace ? (b) => { setFrom(null); setBug(bug === b ? null : b); } : undefined}
        only={mustQueen ? 'Q' : undefined} hint={hint?.type === 'place' ? hint.bug : undefined} />
      {lastPass && !view.outcome && <p className="hv__note" role="status">{lastPass.seat === mySeat ? 'کاری نداشتید؛ نوبتتان رد شد' : `${seatName(lastPass.seat)} کاری نداشت و نوبتش رد شد`}</p>}
      {view.end && <p className="hv__end" role="status">{{ queen: 'ملکه محاصره شد!', draw: 'مساوی', resign: 'انصراف', timeout: 'اتمام زمان', limit: '۳۰۰ نوبت بدون نتیجه — مساوی' }[view.end.kind]}</p>}
    </div>
  );
}

function Reserve({ view, color, label, selected, onPick, only, hint, small }: { view: HiveView; color: Color; label: string; selected?: Bug | null; onPick?: (b: Bug) => void; only?: Bug; hint?: Bug; small?: boolean }) {
  return (
    <div className={small ? 'hv-reserve hv-reserve--small' : 'hv-reserve'} role="group" aria-label={label}>
      {(Object.keys(START_RESERVE) as Bug[]).map((b) => {
        const n = view.reserve[color][b];
        const enabled = !!onPick && n > 0 && (!only || only === b);
        const body = (
          <>
            <svg viewBox="-50 -50 100 100" aria-hidden="true" data-flip-anchor={`res-${color}-${b}`}><Tile x={0} y={0} p={{ c: color, t: b }} /></svg>
            <Count n={n} />
          </>
        );
        return onPick
          ? <button key={b} type="button" disabled={!enabled} aria-pressed={selected === b} aria-label={`${BUG_FA[b]}، ${fa(n)} عدد`} className={['hv-reserve__item', hint === b ? 'hv-reserve__item--hint' : ''].join(' ')} onClick={() => onPick(b)}>{body}</button>
          : <span key={b} className="hv-reserve__item" aria-label={`${BUG_FA[b]}، ${fa(n)} عدد`}>{body}</span>;
      })}
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span key={n} className={`hv-reserve__n ${usePop(n)}`}>{fa(n)}</span>;
}

function Tile({ x, y, p }: { x: number; y: number; p: Piece }) {
  return (
    <g filter="url(#hv-shadow)">
      <polygon points={hexPoints(x, y, R * 0.9)} fill={p.c === 'w' ? 'url(#hv-w)' : 'url(#hv-b)'} stroke={p.c === 'w' ? '#a99b80' : '#000'} strokeWidth="2.5" strokeLinejoin="round" />
      <image href={BUG_IMG[p.t]} x={x - 33} y={y - 33} width="66" height="66" />
    </g>
  );
}
