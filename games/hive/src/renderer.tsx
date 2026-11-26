// کندو renderer: hexagonal tiles with drawn bugs on a felt table; the view fits the hive as it grows.
// Place: tap a bug in your reserve, then a lit spot. Move: tap one of your pieces, then a lit destination.
import './renderer.css';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { RailSlot, TurnIndicator, ZoomBoard, useFlip, useFresh, useInFrame, usePieceIds, usePop, useTermsLang, tx, type Term, type GameRendererProps } from '@bg/ui';
import { terms } from './terms.ts';
import tileWQ from './art/hive-white-queen.png';
import iconWQ from './art/hive-white-queen-icon.png';
import tileWS from './art/hive-white-spider.png';
import iconWS from './art/hive-white-spider-icon.png';
import tileWB from './art/hive-white-beetle.png';
import iconWB from './art/hive-white-beetle-icon.png';
import tileWG from './art/hive-white-grasshopper.png';
import iconWG from './art/hive-white-grasshopper-icon.png';
import tileWA from './art/hive-white-ant.png';
import iconWA from './art/hive-white-ant-icon.png';
import tileBQ from './art/hive-black-queen.png';
import iconBQ from './art/hive-black-queen-icon.png';
import tileBS from './art/hive-black-spider.png';
import iconBS from './art/hive-black-spider-icon.png';
import tileBB from './art/hive-black-beetle.png';
import iconBB from './art/hive-black-beetle-icon.png';
import tileBG from './art/hive-black-grasshopper.png';
import iconBG from './art/hive-black-grasshopper-icon.png';
import tileBA from './art/hive-black-ant.png';
import iconBA from './art/hive-black-ant-icon.png';
import possibleArt from './art/hive-possible-placement.png';
import selectedArt from './art/hive-selected-placement.png';
import { DIRS, START_RESERVE, destinations, key, parse, placements, type Bug, type Color, type Hex, type HiveView, type Piece } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR').replace(/٬/g, ',');
const R = 46;
const BUG_T: Record<Bug, Term> = { Q: terms.queen, S: terms.spider, B: terms.beetle, G: terms.grasshopper, A: terms.ant };
const bugName = (b: Bug) => tx(BUG_T[b]);
const TILE: Record<Color, Record<Bug, string>> = { w: { Q: tileWQ, S: tileWS, B: tileWB, G: tileWG, A: tileWA }, b: { Q: tileBQ, S: tileBS, B: tileBB, G: tileBG, A: tileBA } };
const ICON: Record<Color, Record<Bug, string>> = { w: { Q: iconWQ, S: iconWS, B: iconWB, G: iconWG, A: iconWA }, b: { Q: iconBQ, S: iconBS, B: iconBB, G: iconBG, A: iconBA } };
// Tile art is 130 px with the hexagon ≈ 0.585 of it wide; neighbours are √3·R apart, so the image is √3·R / 0.585 across.
const TILE_PX = (R * Math.sqrt(3)) / 0.585;
const px = ([q, r]: Hex) => ({ x: R * Math.sqrt(3) * (q + r / 2), y: R * 1.5 * r });
/** Corners of the pointy-top hexagon centred on (x, y): the tap area of a piece. */
const hexPoints = (x: number, y: number) => [0, 1, 2, 3, 4, 5].map((k) => { const a = Math.PI / 3 * k - Math.PI / 2; return `${x + R * Math.cos(a)},${y + R * Math.sin(a)}`; }).join(' ');

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

/** Desktop (≥900): both reserves sit in the rail card (reference); on phones only mine stays on the felt under the board. */
const WIDE = '(min-width: 900px)';
const useWide = () => useSyncExternalStore((f) => { const q = matchMedia(WIDE); q.addEventListener('change', f); return () => q.removeEventListener('change', f); }, () => matchMedia(WIDE).matches, () => true);

export default function HiveRenderer({ view: served, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<HiveView>) {
  useTermsLang(); // re-render when the terms language changes
  const framed = useInFrame() !== null; // the shell draws players, the opponent's reserve count, turn number and whose-turn
  const wide = useWide();
  const inRail = framed && wide;
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
    : canPlace || canMove ? { tone: 'mine' as const, text: mustQueen ? `نوبت چهارم: باید ${tx(terms.queenShort)} را بگذارید` : bug ? `جای ${bugName(bug)} را انتخاب کنید` : from ? 'مقصد را بزنید' : 'نوبت شما: بگذارید یا حرکت دهید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.turn)}` };

  const myReserve = <Reserve view={view} color={myColor} label={`${tx(terms.reserve)} شما`} selected={bug} onPick={canPlace ? (b) => { setFrom(null); setBug(bug === b ? null : b); } : undefined}
    only={mustQueen ? 'Q' : undefined} hint={hint?.type === 'place' ? hint.bug : undefined} />;
  const left = (c: Color) => (Object.values(view.reserve[c]) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className="hv" data-turn={view.turnNo} ref={root}>
      {!framed && status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {framed && (
        <RailSlot>
          {status && <p><b>{status.text}</b></p>}
          <p>{mustQueen ? `نوبت چهارم شماست: ${tx(terms.queenShort)} را باید همین حالا بگذارید.` : `هر نوبت یا یک ${tx(terms.pieceEz)} تازه می‌گذارید (کنار ${tx(terms.pieces)} خودتان، نه کنار حریف) یا یک ${tx(terms.piece)} را حرکت می‌دهید؛ ${tx(terms.hive)} نباید دو تکه شود، و تا ${tx(terms.queenShort)} روی میز نیست ${tx(terms.pieceIndef)} حرکت نمی‌کند.`}</p>
          {lastPass && !view.outcome && <p role="status">{lastPass.seat === mySeat ? 'کاری نداشتید؛ نوبتتان رد شد' : `${seatName(lastPass.seat)} کاری نداشت؛ نوبتش رد شد`}</p>}
          {inRail && <div className="hv-rres">
            <div className="hv-rres__row"><span className="hv-rres__lab">{tx(terms.reserveEz)} شما <b>{fa(left(myColor))}</b></span>{myReserve}</div>
            <div className="hv-rres__row"><span className="hv-rres__lab"><bdi>{who(myColor === 'w' ? 'b' : 'w')}</bdi> <b>{fa(left(myColor === 'w' ? 'b' : 'w'))}</b></span>
              <Reserve view={view} color={myColor === 'w' ? 'b' : 'w'} label={`ذخیره ${who(myColor === 'w' ? 'b' : 'w')}`} small /></div>
          </div>}
        </RailSlot>
      )}
      {!framed && <Reserve view={view} color={myColor === 'w' ? 'b' : 'w'} label={`ذخیره ${who(myColor === 'w' ? 'b' : 'w')}`} small />}

      <ZoomBoard label={tx(terms.hive)}>
        <svg className="hv-board" viewBox={vb} role="grid" aria-label={tx(terms.hive)} style={{ direction: 'ltr' }}>
          <defs>
            <filter id="hv-shadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="5" stdDeviation="3.5" floodOpacity=".5" /></filter>
          </defs>
          {[...targets.values()].map((hx) => {
            const { x, y } = px(hx);
            const isHint = hint && key(hint.to) === key(hx);
            return (
              <g key={`t${key(hx)}`} data-hex={key(hx)} role="button" tabIndex={0} aria-label={`خانه ${key(hx)}، ${bug ? 'جای گذاشتن' : 'مقصد'}`}
                className={isHint ? 'hv-target hv-target--hint' : 'hv-target'} onClick={() => tapCell(hx)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapCell(hx); } }}>
                <image href={isHint ? selectedArt : possibleArt} x={x - R * 0.86} y={y - R * 0.86} width={R * 1.72} height={R * 1.72} transform={`rotate(30 ${x} ${y})`} />
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
              <g key={k} data-hex={k} role="gridcell" tabIndex={mine ? 0 : -1}
                aria-label={`${bugName(topPiece.t)} ${topPiece.c === myColor ? 'شما' : 'حریف'}${stack.length > 1 ? `، ${fa(stack.length)} ${tx(terms.piece)} روی هم` : ''}${isSel ? '، انتخاب‌شده' : ''}`}
                className={['hv-cell', mine ? 'hv-cell--mine' : '', isSel ? 'hv-cell--sel' : '', isHint ? 'hv-cell--hint' : '',
                  topPiece.t === 'Q' && surrounded.has(topPiece.c) ? 'hv-cell--trapped' : ''].join(' ')}
                onClick={() => tapCell(hx)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapCell(hx); } }}>
                <polygon className="hv-hit" points={hexPoints(x, y)} />
                {stack.length > 1 && <image href={TILE[stack.at(-2)!.c][stack.at(-2)!.t]} x={x + 5 - TILE_PX / 2} y={y + 7 - TILE_PX / 2} width={TILE_PX} height={TILE_PX} className="hv-under" />}
                <g data-flip={idAt(k, stack.length - 1)} data-flip-from={placed.has(idAt(k, stack.length - 1) ?? '') ? `res-${topPiece.c}-${topPiece.t}` : undefined}>
                  <Tile x={x} y={y} p={topPiece} />
                  {stack.length > 1 && <text x={x + R * 0.55} y={y - R * 0.45} className="hv-height">{fa(stack.length)}</text>}
                </g>
              </g>
            );
          })}
        </svg>
      </ZoomBoard>

      {!inRail && myReserve}
      {!framed && lastPass && !view.outcome && <p className="hv__note" role="status">{lastPass.seat === mySeat ? 'کاری نداشتید؛ نوبتتان رد شد' : `${seatName(lastPass.seat)} کاری نداشت و نوبتش رد شد`}</p>}
      {!framed && view.end && <p className="hv__end" role="status">{{ queen: `${tx(terms.queenShort)} ${tx(terms.surrounded)}!`, draw: tx(terms.draw), resign: 'انصراف', timeout: 'اتمام زمان', limit: `۳۰۰ نوبت بدون نتیجه — ${tx(terms.draw)}` }[view.end.kind]}</p>}
    </div>
  );
}

function Reserve({ view, color, label, selected, onPick, only, hint, small }: { view: HiveView; color: Color; label: string; selected?: Bug | null; onPick?: (b: Bug) => void; only?: Bug; hint?: Bug; small?: boolean }) {
  useTermsLang();
  return (
    <div className={small ? 'hv-reserve hv-reserve--small' : 'hv-reserve'} role="group" aria-label={label}>
      {(Object.keys(START_RESERVE) as Bug[]).map((b) => {
        const n = view.reserve[color][b];
        const enabled = !!onPick && n > 0 && (!only || only === b);
        const body = (
          <>
            <svg viewBox="-50 -50 100 100" aria-hidden="true" data-flip-anchor={`res-${color}-${b}`}><image href={ICON[color][b]} x="-50" y="-50" width="100" height="100" /></svg>
            <Count n={n} />
          </>
        );
        return onPick
          ? <button key={b} type="button" disabled={!enabled} aria-pressed={selected === b} aria-label={`${bugName(b)}، ${fa(n)} عدد`} className={['hv-reserve__item', hint === b ? 'hv-reserve__item--hint' : ''].join(' ')} onClick={() => onPick(b)}>{body}</button>
          : <span key={b} className="hv-reserve__item" aria-label={`${bugName(b)}، ${fa(n)} عدد`}>{body}</span>;
      })}
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span key={n} className={`hv-reserve__n ${usePop(n)}`}>{fa(n)}</span>;
}

function Tile({ x, y, p }: { x: number; y: number; p: Piece }) {
  return (
    <g filter="url(#hv-shadow)" className="hv-tile">
      <image href={TILE[p.c][p.t]} x={x - TILE_PX / 2} y={y - TILE_PX / 2} width={TILE_PX} height={TILE_PX} />
    </g>
  );
}
