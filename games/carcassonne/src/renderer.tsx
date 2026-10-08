// قلعه‌سازان renderer: an open map of square tiles drawn in SVG (wheat fields, sandstone cities with terracotta
// walls, cream roads, red-roofed monasteries). Legal spots for the drawn tile glow; tap one, rotate, choose where your
// follower stands (or none), then place. Board coordinates are module-defined, so the map itself is LTR.
import './renderer.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, TurnIndicator, type GameRendererProps } from '@bg/ui';
import { TILES, feature, groups, key, segments, type CarcView, type Placed } from './rules.ts';

const fa = (n: number) => n.toLocaleString('fa-IR');
export const SEAT_COLORS = ['#e0473c', '#2f7de1', '#f2c230', '#3aa65a', '#9b59d0'];
const DIRS = ['بالا', 'راست', 'پایین', 'چپ'];
const MID = [[50, 0], [100, 50], [50, 100], [0, 50]] as const;

/** City shape for one group of (unrotated) directions, as a canonical path plus a rotation. */
function cityShape(g: number[]): { d: string; rot: number } {
  if (g.length === 4) return { d: 'M0,0H100V100H0Z', rot: 0 };
  if (g.length === 1) return { d: 'M0,0H100Q88,10 76,22Q50,46 24,22Q12,10 0,0Z', rot: g[0]! };
  if (g.length === 3) { const miss = [0, 1, 2, 3].find((d) => !g.includes(d))!; return { d: 'M0,0H100V100Q50,62 0,100Z', rot: (miss + 2) % 4 }; }
  if ((g[0]! + 2) % 4 === g[1]) return { d: 'M0,0H100Q66,50 100,100H0Q34,50 0,0Z', rot: Math.min(g[0]!, g[1]!) };
  const a = g.includes(0) && g.includes(3) ? 3 : Math.min(g[0]!, g[1]!);
  return { d: 'M0,0H100V100Q50,50 0,0Z', rot: a };
}
/** Anchor point (in tile space, before rotation) where a follower on a segment stands. */
function anchor(t: string, seg: string): [number, number] {
  if (seg === 'm') return [50, 52];
  const tile = TILES[t]!;
  const g = (seg[0] === 'c' ? tile.cities : tile.roads)[Number(seg.slice(1))]!;
  if (seg[0] === 'c') {
    if (g.length >= 3) return [50, 40];
    const [x, y] = g.reduce(([ax, ay], d) => [ax + MID[d]![0], ay + MID[d]![1]], [0, 0]);
    const cx = x / g.length, cy = y / g.length;
    return g.length === 1 ? [cx + (50 - cx) * 0.3, cy + (50 - cy) * 0.3] : [cx + (50 - cx) * 0.35, cy + (50 - cy) * 0.35];
  }
  const d = g[0]!;
  return g.length === 2 && (g[0]! + 2) % 4 === g[1] ? [50 + (MID[d]![0] - 50) * 0.45, 50 + (MID[d]![1] - 50) * 0.45] : [50 + (MID[d]![0] - 50) * 0.55, 50 + (MID[d]![1] - 50) * 0.55];
}

export function Meeple({ color, x, y }: { color: string; x: number; y: number }) {
  return <path className="cc-meeple" transform={`translate(${x - 9} ${y - 10})`} fill={color} stroke="#1c140c" strokeWidth="1.4"
    d="M9 0a3.6 3.6 0 1 1 0 7.2a3.6 3.6 0 1 1 0-7.2ZM5 7.6h8l5 4.6-1.8 2-3.2-2 2.6 8H11L9 15l-2 5.2H3.4l2.6-8-3.2 2L1 12.2Z" />;
}

export function TileArt({ t, rot = 0, meeples = {}, title }: { t: string; rot?: number; meeples?: Record<string, number>; title?: string }) {
  const tile = TILES[t]!;
  const crossing = tile.roads.length >= 3;
  return (
    <svg viewBox="0 0 100 100" className="cc-tile" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g transform={`rotate(${rot * 90} 50 50)`}>
        <rect width="100" height="100" fill="url(#cc-field)" />
        <rect width="100" height="100" fill="url(#cc-furrow)" opacity="0.35" />
        {tile.roads.map((g, i) => {
          const [a, b] = g;
          const da = MID[a!]!;
          const p = b === undefined ? `M${da[0]},${da[1]} L50,50` : `M${da[0]},${da[1]} Q50,50 ${MID[b]![0]},${MID[b]![1]}`;
          return <g key={`r${i}`}><path d={p} className="cc-road-edge" /><path d={p} className="cc-road" /></g>;
        })}
        {crossing && <circle cx="50" cy="50" r="9" className="cc-well" />}
        {tile.cities.map((g, i) => {
          const s = cityShape(g);
          return <g key={`c${i}`} transform={`rotate(${s.rot * 90} 50 50)`}><path d={s.d} className="cc-city" /><path d={s.d} className="cc-wall" /></g>;
        })}
        {tile.shield && <path className="cc-shield" transform="translate(14 12)" d="M0 0h12v7c0 5-6 8-6 8s-6-3-6-8Z" />}
        {tile.monastery && (
          <g className="cc-abbey" transform={`rotate(${-rot * 90} 50 50)`}>
            <rect x="38" y="42" width="24" height="20" rx="2" />
            <path d="M34 44 50 30 66 44Z" className="cc-abbey__roof" />
            <rect x="47" y="52" width="6" height="10" className="cc-abbey__door" />
          </g>
        )}
        {Object.entries(meeples).map(([seg, seat]) => { const [x, y] = anchor(t, seg); return <g key={seg} transform={`rotate(${-rot * 90} ${x} ${y})`}><Meeple color={SEAT_COLORS[seat]!} x={x} y={y} /></g>; })}
      </g>
    </svg>
  );
}

/** Shared SVG gradients (rendered once per page section that shows tiles). */
export function TileDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <linearGradient id="cc-field" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a8c25d" /><stop offset="1" stopColor="#7fa443" /></linearGradient>
        <pattern id="cc-furrow" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V8" stroke="#5f7f2c" strokeWidth="1.2" /></pattern>
      </defs>
    </svg>
  );
}

const segLabel = (t: string, rot: number, seg: string) => {
  if (seg === 'm') return 'صومعه';
  const g = groups(t, rot, seg[0] as 'c' | 'r')[Number(seg.slice(1))]!;
  return `${seg[0] === 'c' ? 'شهر' : 'جاده'} (${g.map((d) => DIRS[d]).join('، ')})`;
};

export default function CarcassonneRenderer({ view, legalActions, mySeat, seatName, busy, onAction, expected }: GameRendererProps<CarcView>) {
  const place = legalActions.find((a) => a.type === 'place') as { options: { x: number; y: number; rot: number }[] } | undefined;
  const hint = expected as unknown as { x: number; y: number; rot: number; meeple?: string } | null;
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const [rot, setRot] = useState(0);
  const [meeple, setMeeple] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setSpot(null); setMeeple(null); }, [view.seq]);
  const who = (s: number) => (s === mySeat ? 'شما' : seatName(s));

  const tiles = Object.entries(view.board).map(([k, p]) => { const [x, y] = k.split(',').map(Number) as [number, number]; return { x, y, p }; });
  const xs = tiles.map((t) => t.x), ys = tiles.map((t) => t.y);
  const minX = Math.min(...xs) - 1, maxX = Math.max(...xs) + 1, minY = Math.min(...ys) - 1, maxY = Math.max(...ys) + 1;
  const spots = useMemo(() => { const m = new Map<string, number[]>(); for (const o of place?.options ?? []) m.set(key(o.x, o.y), [...(m.get(key(o.x, o.y)) ?? []), o.rot]); return m; }, [place]);
  const rots = spot ? spots.get(key(spot.x, spot.y)) ?? [] : [];
  const shownRot = spot && !rots.includes(rot) ? rots[0] ?? 0 : rot;

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const c = el.querySelector<HTMLElement>('[data-origin]');
    if (c) { el.scrollLeft = c.offsetLeft - el.clientWidth / 2 + c.offsetWidth / 2; el.scrollTop = c.offsetTop - el.clientHeight / 2 + c.offsetHeight / 2; }
  }, [zoom]);

  const choose = (x: number, y: number) => {
    const r = spots.get(key(x, y))!;
    setSpot({ x, y });
    setMeeple(null);
    if (!r.includes(rot)) setRot(hint && hint.x === x && hint.y === y && r.includes(hint.rot) ? hint.rot : r[0]!);
  };
  const rotate = () => {
    setMeeple(null);
    const pool = spot ? rots : [0, 1, 2, 3];
    const i = pool.indexOf(shownRot);
    setRot(pool[(i + 1) % pool.length] ?? 0);
  };
  const free = (seg: string) => {
    if (!spot || !view.tile || !(mySeat !== null && view.meeplesLeft[mySeat])) return false;
    if (seg === 'm') return true;
    const trial: Record<string, Placed> = { ...view.board, [key(spot.x, spot.y)]: { t: view.tile, rot: shownRot, meeples: {} } };
    return feature(trial, spot.x, spot.y, seg).meeples.length === 0;
  };
  const confirm = () => spot && onAction({ type: 'place', x: spot.x, y: spot.y, rot: shownRot, ...(meeple ? { meeple } : {}) });

  const status = view.outcome ? null
    : place ? { tone: 'mine' as const, text: spot ? 'بچرخانید، پیرو را انتخاب کنید و بگذارید' : 'یک جای روشن برای کاشی انتخاب کنید' }
      : { tone: 'wait' as const, text: `نوبت ${seatName(view.current)}` };
  const last = view.last;
  const cells = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const k = key(x, y);
      const p = view.board[k];
      const isLast = last && last.x === x && last.y === y;
      if (p) {
        cells.push(<div key={k} className={`cc-cell cc-cell--tile ${isLast ? 'cc-cell--last' : ''}`} {...(x === 0 && y === 0 ? { 'data-origin': true } : {})} style={isLast ? { ['--who' as string]: SEAT_COLORS[last.seat] } : undefined}><TileArt t={p.t} rot={p.rot} meeples={p.meeples} /></div>);
      } else if (spots.has(k)) {
        const on = spot?.x === x && spot.y === y;
        const fitsNow = spots.get(k)!.includes(rot);
        cells.push(
          <button key={k} type="button" disabled={busy} onClick={() => choose(x, y)} aria-pressed={on} aria-label={`جای کاشی ${fa(x)}، ${fa(y)}`}
            className={['cc-cell cc-spot', fitsNow ? 'cc-spot--fit' : '', on ? 'cc-spot--on' : '', hint && hint.x === x && hint.y === y && !on ? 'cc-hint' : ''].join(' ')}>
            {on && view.tile && <TileArt t={view.tile} rot={shownRot} meeples={meeple && mySeat !== null ? { [meeple]: mySeat } : {}} />}
          </button>
        );
      } else cells.push(<div key={k} className="cc-cell" />);
    }
  }

  return (
    <div className="cc" data-seq={view.seq}>
      <TileDefs />
      {status && <TurnIndicator tone={status.tone}>{status.text}</TurnIndicator>}

      <ul className="cc__players" aria-label="بازیکنان">
        {(view.outcome ? view.outcome.placements.map((x) => x.seat) : view.scores.map((_, k) => k)).map((s) => (
          <li key={s} className={['cc-player', s === view.current && !view.outcome ? 'cc-player--now' : '', view.outcome?.placements[0]?.seat === s ? 'cc-player--win' : ''].join(' ')} style={{ ['--who' as string]: SEAT_COLORS[s] }}>
            <svg viewBox="0 0 18 21" className="cc-player__meeple" aria-hidden><Meeple color={SEAT_COLORS[s]!} x={9} y={10} /></svg>
            <bdi className="cc-player__name">{who(s)}</bdi>
            <span className="cc-player__score" key={view.scores[s]}>{fa(view.scores[s]!)}</span>
            <span className="cc-player__left" aria-label={`${fa(view.meeplesLeft[s]!)} پیرو`}>×{fa(view.meeplesLeft[s]!)}</span>
          </li>
        ))}
      </ul>

      {last && last.scored.length > 0 && (
        <p className="cc__news" key={view.seq} role="status">
          {last.scored.map((x, i) => <span key={i} style={{ ['--who' as string]: SEAT_COLORS[x.seat] }}><bdi>{who(x.seat)}</bdi> +{fa(x.pts)} {x.kind === 'city' ? 'شهر' : x.kind === 'road' ? 'جاده' : 'صومعه'}</span>)}
        </p>
      )}

      <div className="cc__map" ref={mapRef} dir="ltr" style={{ ['--cell' as string]: `${zoom * 4}rem` }}>
        <div className="cc__grid" style={{ gridTemplateColumns: `repeat(${maxX - minX + 1}, var(--cell))` }}>{cells}</div>
      </div>

      <div className="cc__dock">
        <div className="cc__zoom">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} aria-label="کوچک‌نمایی">−</button>
          <button type="button" onClick={() => setZoom((z) => Math.min(1.6, z + 0.2))} aria-label="بزرگ‌نمایی">+</button>
        </div>
        {view.tile && (
          <div className="cc__drawn">
            <span className="cc__drawn-tile" key={view.seq}><TileArt t={view.tile} rot={shownRot} title="کاشی کشیده‌شده" /></span>
            <small>{fa(view.stackCount)} کاشی مانده</small>
            {place && <Button size="sm" variant="secondary" disabled={busy || (spot !== null && rots.length < 2)} onClick={rotate} className={hint && spot && hint.rot !== shownRot ? 'cc-hint' : ''}>چرخاندن ↻</Button>}
          </div>
        )}
        {place && spot && view.tile && (
          <div className="cc__follow" role="group" aria-label="پیرو">
            <button type="button" className={`cc-chip ${meeple === null ? 'cc-chip--on' : ''}`} aria-pressed={meeple === null} onClick={() => setMeeple(null)}>بدون پیرو</button>
            {segments(view.tile).map((seg) => (
              <button key={seg} type="button" disabled={!free(seg)} aria-pressed={meeple === seg} onClick={() => setMeeple(seg)}
                className={['cc-chip', meeple === seg ? 'cc-chip--on' : '', hint?.meeple === seg && meeple !== seg ? 'cc-hint' : ''].join(' ')}>{segLabel(view.tile!, shownRot, seg)}</button>
            ))}
            <Button size="sm" disabled={busy} onClick={confirm} className={hint && hint.rot === shownRot && (hint.meeple ?? null) === meeple ? 'cc-hint' : ''}>گذاشتن کاشی</Button>
          </div>
        )}
      </div>
      {view.discarded > 0 && <small className="cc__discard">{fa(view.discarded)} کاشی بی‌جا کنار رفت</small>}
    </div>
  );
}
