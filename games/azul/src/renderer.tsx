// Tile art is cut from a generated sheet (see DECISIONS.md).
// کاشی‌کار renderer: Isfahan tile-work. Factories are round kiln plates, the centre a brass tray; each player's
// board has a stepped set of pattern lines, the 5×5 wall with faint glazes for empty spots, and the floor with its
// penalties. Tap a tile group, then the line (or floor) to put it on.
import './renderer.css';
import { useEffect, useRef, useState } from 'react';
import { TurnIndicator, useFlip, usePrevious, type GameRendererProps } from '@bg/ui';
import tileBlue from './art/tile-blue.webp';
import tileYellow from './art/tile-yellow.webp';
import tileRed from './art/tile-red.webp';
import tileBlack from './art/tile-black.webp';
import tileTeal from './art/tile-teal.webp';
import tileFirst from './art/tile-first.webp';
import { FLOOR, wallColor, type AzulView, type Color } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const COLOR_FA: Record<Color, string> = { b: 'لاجوردی', y: 'زعفرانی', r: 'اناری', k: 'مشکی', w: 'فیروزه‌ای' };

/* Painted glaze per colour, cut from a generated sprite sheet (see DECISIONS.md). */
const TILE_ART: Record<Color | 'first', string> = { b: tileBlue, y: tileYellow, r: tileRed, k: tileBlack, w: tileTeal, first: tileFirst };

export function Tile({ c, size = 'md', ghost, flip, from, land, exit }: { c: Color | 'first'; size?: 'sm' | 'md'; ghost?: boolean; flip?: string; from?: string; land?: boolean; exit?: string }) {
  return (
    <span className={['az-tile', `az-tile--${size}`, ghost ? 'az-tile--ghost' : '', land ? 'bg-land' : ''].join(' ')} style={land ? { ['--i' as string]: 8 } : undefined} aria-hidden="true" data-flip={flip} data-flip-from={from} data-flip-exit={exit}>
      <img src={TILE_ART[c]} alt="" draggable={false} />
    </span>
  );
}

type Pick = { from: number | 'center'; color: Color };
type Take = Pick & { line: number | 'floor' };

/** One stable id per physical tile, so a tile keeps its identity factory → centre / line → floor → wall. */
interface Ids { fac: string[][]; center: string[]; lines: string[][][]; floor: string[][] }
let idSeq = 0;
const newId = () => `t${idSeq++}`;

/** The view and tile ids after `seat` takes `t` — deterministic, used for the server's take and the undo-window preview. */
function applyTake(v: AzulView, ids: Ids, t: Take, seat: number): { v: AzulView; ids: Ids } {
  const n = structuredClone(v);
  const m: Ids = structuredClone(ids);
  const b = n.boards[seat]!;
  const fl = m.floor[seat]!;
  let taken: string[];
  if (t.from === 'center') {
    taken = m.center.filter((_, k) => v.center[k] === t.color);
    m.center = m.center.filter((_, k) => v.center[k] !== t.color);
    n.center = v.center.filter((c) => c !== t.color);
    if (v.firstInCenter) { n.firstInCenter = false; b.floor.push('first'); fl.push('first'); }
  } else {
    const f = v.factories[t.from]!;
    taken = m.fac[t.from]!.filter((_, k) => f[k] === t.color);
    m.center.push(...m.fac[t.from]!.filter((_, k) => f[k] !== t.color));
    n.center.push(...f.filter((c) => c !== t.color));
    n.factories[t.from] = [];
    m.fac[t.from] = [];
  }
  if (t.line !== 'floor') {
    const l = b.lines[t.line]!;
    const put = Math.min(taken.length, t.line + 1 - l.n);
    l.color = t.color; l.n += put;
    m.lines[seat]![t.line]!.push(...taken.splice(0, put));
  }
  for (const id of taken) if (b.floor.length < FLOOR.length) { b.floor.push(t.color); fl.push(id); }
  n.last = { seat, color: t.color, count: 0, from: t.from, line: t.line };
  return { v: n, ids: m };
}

/** Ids for `v`, keeping the id of every tile that sits where a same-coloured tile sat in `p` (or new ones). */
function keepIds(v: AzulView, p?: AzulView, pi?: Ids): Ids {
  const same = <T,>(a: readonly T[] | undefined, b: readonly T[], ids: readonly string[] | undefined) => b.map((c, k) => (a && ids?.[k] && a[k] === c ? ids[k]! : newId()));
  const lineCells = (l: { color: Color | null; n: number }) => Array<Color | null>(l.n).fill(l.color);
  return {
    fac: v.factories.map((f, i) => f.map((_, k) => `r${v.round}f${i}k${k}`)),
    center: same(p?.center, v.center, pi?.center),
    lines: v.boards.map((b, s) => b.lines.map((l, r) => same(p && lineCells(p.boards[s]!.lines[r]!), lineCells(l), pi?.lines[s]?.[r]))),
    floor: v.boards.map((b, s) => b.floor.map((c, k) => (c === 'first' ? 'first' : same(p?.boards[s]!.floor, b.floor, pi?.floor[s])[k]!)))
  };
}

/** Follow the tiles from the previous view to `v`: replay the take when it is known, else keep what stayed in place. */
function useTileIds(v: AzulView, sent: { seq: number; seat: number; take: Take } | null): Ids {
  const r = useRef<{ v: AzulView; ids: Ids } | null>(null);
  const p = r.current;
  if (p?.v === v) return p.ids;
  let ids: Ids;
  if (p && v.seq === p.v.seq + 1 && v.last && !('kind' in v.last)) ids = applyTake(p.v, p.ids, v.last, v.last.seat).ids;
  else if (p && v.seq > p.v.seq && sent?.seq === p.v.seq) { const b = applyTake(p.v, p.ids, sent.take, sent.seat); ids = keepIds(v, b.v, b.ids); }
  else ids = keepIds(v, p?.v, p?.ids);
  r.current = { v, ids };
  return ids;
}

export default function AzulRenderer({ view: real, legalActions, mySeat, seatName, busy, onAction, expected, queued }: GameRendererProps<AzulView>) {
  const takes = legalActions.filter((a) => a.type === 'take') as unknown as (Pick & { lines: number[] })[];
  const [pick, setPick] = useState<Pick | null>(null);
  // My last take (remembered after the undo window closes) lets tile ids survive a reply that lands in the same update.
  const sentRef = useRef<{ seq: number; seat: number; take: Take } | null>(null);
  const q = queued?.type === 'take' && mySeat !== null ? (queued as unknown as Take) : null;
  if (q && mySeat !== null) sentRef.current = { seq: real.seq, seat: mySeat, take: q };
  const realIds = useTileIds(real, sentRef.current);
  // Undo-window preview: the taken tiles already lie on the chosen line (the rest slides to the centre); undo moves them back.
  const pv = q ? applyTake(real, realIds, q, mySeat!) : null;
  const view = pv?.v ?? real;
  const ids = pv?.ids ?? realIds;
  const root = useRef<HTMLDivElement>(null);
  const fk = `${real.seq}|${q ? `${q.from}${q.color}${q.line}` : ''}`;
  useFlip(root, fk);
  const before = usePrevious(fk, view.boards);
  const prevIds = usePrevious(fk, ids);
  useEffect(() => { setPick(null); }, [view.seq, q]);
  const hint = expected as unknown as (Pick & { type: string; line: number | 'floor' }) | null;
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));
  const myTurn = takes.length > 0;
  const chosen = pick ? takes.find((t) => t.from === pick.from && t.color === pick.color) : undefined;
  const status = view.outcome ? null
    // My own move is queued or in flight: the legal actions are stale, so it is not "my turn" until the result.
    : queued ? { tone: 'wait' as const, text: 'حرکت شما در حال ثبت است…' }
    : myTurn ? { tone: 'mine' as const, text: chosen ? 'ردیف یا کف را انتخاب کنید' : 'یک دسته کاشی هم‌رنگ انتخاب کنید' }
      : { tone: 'wait' as const, text: `نوبت ${who(view.current)}` };
  const isPicked = (from: number | 'center', c: Color) => pick?.from === from && pick.color === c;
  const isHint = (from: number | 'center', c: Color) => !pick && hint?.type === 'take' && hint.from === from && hint.color === c;
  const tap = (from: number | 'center', c: Color) => { if (!myTurn || busy) return; setPick(isPicked(from, c) ? null : { from, color: c }); };
  const send = (line: number | 'floor') => { if (pick && !busy) onAction({ type: 'take', from: pick.from, color: pick.color, line }); };
  const order = mySeat === null ? view.boards.map((_, k) => k) : [mySeat, ...view.boards.map((_, k) => k).filter((k) => k !== mySeat)];
  const roundGains = view.last && 'kind' in view.last ? view.last.gains : null;
  const lastTake = view.last && !('kind' in view.last) ? view.last : null;

  const src = lastTake ? (lastTake.from === 'center' ? 'center' : `fac-${lastTake.from}`) : undefined;
  const group = (from: number | 'center', tiles: Color[]) => {
    const byColor = [...new Set(tiles)];
    return byColor.map((c) => {
      const n = tiles.filter((t) => t === c).length;
      return (
        <button key={c} type="button" disabled={!myTurn || busy} onClick={() => tap(from, c)} aria-pressed={isPicked(from, c)}
          className={['az-grp', isPicked(from, c) ? 'az-grp--on' : '', isHint(from, c) ? 'az-hint' : ''].join(' ')} aria-label={`${fa(n)} کاشی ${COLOR_FA[c]}`}>
          {ids.center.filter((_, k) => tiles[k] === c).map((id) => <Tile key={id} c={c} flip={id} from={src} />)}
        </button>
      );
    });
  };

  return (
    <div className="az" data-seq={real.seq} ref={root}>
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}
      {!view.outcome && <p className="az__round" data-flip-anchor="bag">دور {fa(view.round)}، کیسه: {fa(view.bagCount)} کاشی</p>}

      {!view.outcome && (
        <section className="az__market" aria-label="کارگاه‌ها">
          {view.factories.map((f, i) => (
            <div key={i} data-flip-anchor={`fac-${i}`} className={`az-factory ${f.length ? '' : 'az-factory--empty'}`} role="group" aria-label={`کارگاه ${fa(i + 1)}`}>
              {f.map((c, k) => (
                <button key={k} type="button" disabled={!myTurn || busy} onClick={() => tap(i, c)} aria-pressed={isPicked(i, c)}
                  className={['az-grp', 'az-ftile', isPicked(i, c) ? 'az-grp--on' : '', isHint(i, c) && f.indexOf(c) === k ? 'az-hint' : ''].join(' ')}
                  aria-label={`${fa(f.filter((x) => x === c).length)} کاشی ${COLOR_FA[c]}`}><Tile c={c} flip={ids.fac[i]?.[k]} from="bag" /></button>
              ))}
            </div>
          ))}
          <div className="az-center" aria-label="وسط میز" data-flip-anchor="center">
            {view.firstInCenter && <Tile c="first" flip="first" />}
            {group('center', view.center)}
            {!view.center.length && !view.firstInCenter && <span className="az-center__empty">وسط خالی</span>}
          </div>
        </section>
      )}

      {roundGains && !view.outcome && (
        <p className="az__gains" role="status" key={view.seq}>پایان دور: {roundGains.map((g, k) => <span key={k}><bdi>{who(k)}</bdi> {g.length ? g.map((x) => (x > 0 ? `+${fa(x)}` : `−${fa(-x)}`)).join(' ') : '۰'}</span>)}</p>
      )}

      <ul className="az__boards" aria-label="تخته‌ها">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : order).map((s) => {
          const b = view.boards[s]!;
          const mine = s === mySeat && !!chosen;
          const was = before?.[s];
          const hurt = !!was && b.floor.length > was.floor.length;
          const place = view.outcome?.placements.find((x) => x.seat === s)?.place;
          return (
            <li key={s} className={['az-board', s === mySeat ? 'az-board--me' : '', view.current === s && !view.outcome ? 'az-board--turn' : '', place === 1 ? 'az-board--win' : ''].join(' ')}>
              <div className="az-board__head">
                {place && <b className="az-board__place">{fa(place)}</b>}
                <bdi className="az-board__name">{who(s)}</bdi>
                <span className={`az-board__score ${before && before[s]!.score !== b.score ? 'bg-pop' : ''}`} key={b.score}>{fa(b.score)}</span>
              </div>
              <div className="az-board__body">
                <div className="az-lines">
                  {b.lines.map((l, r) => {
                    const ok = mine && chosen!.lines.includes(r);
                    const cells = Array.from({ length: r + 1 }, (_, k) => (k < l.n ? <Tile key={k} c={l.color!} size="sm" flip={ids.lines[s]![r]![k]} from={lastTake?.seat === s && lastTake.line === r ? src : undefined} exit="drop" /> : <span key={k} className="az-cell" />));
                    return ok
                      ? <button key={r} type="button" data-flip-anchor={`line-${s}-${r}`} className={`az-line az-line--ok ${hint?.line === r ? 'az-hint' : ''}`} onClick={() => send(r)} aria-label={`ردیف ${fa(r + 1)}`}>{cells}</button>
                      : <div key={r} className="az-line" data-flip-anchor={`line-${s}-${r}`}>{cells}</div>;
                  })}
                </div>
                <div className="az-wall" aria-label="دیوار">
                  {b.wall.map((row, r) => row.map((on, c) => {
                    const fresh = on && !!was && !was.wall[r]![c];
                    // The tile from the finished line moves onto the wall (the rest of that line goes to the lid).
                    const lid = fresh ? prevIds?.lines[s]?.[r]?.[0] : undefined;
                    const moved = !!lid && !ids.lines[s]![r]!.includes(lid);
                    return <Tile key={`${r}-${c}`} c={wallColor(r, c)} size="sm" ghost={!on} flip={fresh ? (moved ? lid : `wl-${s}-${r}-${c}`) : undefined} from={fresh && !moved ? `line-${s}-${r}` : undefined} land={fresh && !moved} />;
                  }))}
                </div>
              </div>
              {mine
                ? <button type="button" className={`az-floor az-floor--ok ${hint?.line === 'floor' ? 'az-hint' : ''} ${hurt ? 'bg-hit' : ''}`} onClick={() => send('floor')} aria-label="کف">{floorCells(b.floor, ids.floor[s]!, hurt ? src : undefined)}</button>
                : <div className={`az-floor ${hurt ? 'bg-hit' : ''}`}>{floorCells(b.floor, ids.floor[s]!, hurt ? src : undefined)}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function floorCells(floor: (Color | 'first')[], ids: string[], from?: string) {
  return FLOOR.map((pen, i) => (
    <span key={i} className="az-floor__slot"><small>{fa(pen).replace('-', '−')}</small>{floor[i] ? <Tile c={floor[i]!} size="sm" flip={ids[i]} from={from} exit={floor[i] === 'first' ? undefined : 'drop'} /> : <span className="az-cell" />}</span>
  ));
}

