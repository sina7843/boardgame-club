// Map layout for the renderer and cover: projects city longitude/latitude to an SVG plane of width MAP_W, bends a
// route away from cities it would cross, splits each route into its car slots and offsets the two lanes of a double
// route. Pure functions over board.ts data, memoised per map.
import { BOARDS, type Board, type MapId } from './board.ts';
import { GEO, type LL } from './geo.ts';

export type Pt = [number, number];
export const MAP_W = 1000;
const PAD = 46;
const CITY_R = 9;
const LANE = 7.5;
const CAR_H = 10;

export interface Slot { x: number; y: number; angle: number; len: number }
export interface RouteShape { d: string; slots: Slot[]; mid: Pt }
export interface Terrain {
  land: string;
  water: string;
  islands: string;
  borders: string[];
  mountains: { x: number; y: number; s: number }[];
  trees: { x: number; y: number; s: number }[];
  dunes: { x: number; y: number; s: number }[];
  seas: { x: number; y: number; text: string }[];
  /** Even-odd path: the map rectangle minus the playing country (empty when the map has none). */
  outside: string;
}
export interface Layout {
  w: number; h: number; cities: Pt[]; routes: RouteShape[];
  /** City name plaque centre (above or below the station). */
  labels: Pt[];
  /** Score track: 100 spaces around the map edge (0 at the top-left corner, clockwise). */
  track: Pt[];
  terrain: Terrain;
}

const quad = (p: Pt, c: Pt, q: Pt, t: number): Pt => [
  (1 - t) ** 2 * p[0] + 2 * (1 - t) * t * c[0] + t * t * q[0],
  (1 - t) ** 2 * p[1] + 2 * (1 - t) * t * c[1] + t * t * q[1]
];

function distToSegment(p: Pt, a: Pt, b: Pt): { d: number; side: number } {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  const x = a[0] + t * dx, y = a[1] + t * dy;
  return { d: Math.hypot(p[0] - x, p[1] - y), side: Math.sign(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) || 1 };
}

function build(board: Board): Layout {
  const lats = board.cities.map((c) => c.lat), lons = board.cities.map((c) => c.lon);
  const k = Math.cos((((Math.max(...lats) + Math.min(...lats)) / 2) * Math.PI) / 180);
  const x0 = Math.min(...lons) * k, x1 = Math.max(...lons) * k, y0 = -Math.max(...lats), y1 = -Math.min(...lats);
  const s = (MAP_W - PAD * 2) / (x1 - x0);
  const cities = board.cities.map((c) => [PAD + (c.lon * k - x0) * s, PAD + (-c.lat - y0) * s] as Pt);
  const h = Math.round(PAD * 2 + (y1 - y0) * s);

  const routes = board.routes.map((r, i) => {
    const a = cities[r.a]!, b = cities[r.b]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    // Bend away from the nearest city lying on the straight line.
    let bend = 0;
    cities.forEach((c, j) => {
      if (j === r.a || j === r.b) return;
      const { d, side } = distToSegment(c, a, b);
      if (d < CITY_R + LANE * 2 + 4 && Math.abs(bend) < 1) bend = -side * Math.min(L * 0.22, 34);
    });
    // Double routes: the first lane on one side, its sibling on the other.
    const lane = r.sib === null ? 0 : r.sib > i ? -LANE : LANE;
    const p: Pt = [a[0] + nx * lane, a[1] + ny * lane], q: Pt = [b[0] + nx * lane, b[1] + ny * lane];
    const c: Pt = [(p[0] + q[0]) / 2 + nx * bend, (p[1] + q[1]) / 2 + ny * bend];
    // Arc-length samples along the curve.
    const N = 80;
    const pts = Array.from({ length: N + 1 }, (_, t) => quad(p, c, q, t / N));
    const cum = [0];
    for (let t = 1; t <= N; t++) cum.push(cum[t - 1]! + Math.hypot(pts[t]![0] - pts[t - 1]![0], pts[t]![1] - pts[t - 1]![1]));
    const total = cum[N]!;
    const at = (dist: number): { pt: Pt; angle: number } => {
      let t = cum.findIndex((v) => v >= dist);
      if (t <= 0) t = 1;
      const f = (dist - cum[t - 1]!) / ((cum[t]! - cum[t - 1]!) || 1);
      const u = pts[t - 1]!, v = pts[t]!;
      return { pt: [u[0] + (v[0] - u[0]) * f, u[1] + (v[1] - u[1]) * f], angle: (Math.atan2(v[1] - u[1], v[0] - u[0]) * 180) / Math.PI };
    };
    const start = CITY_R + 3, usable = total - start * 2, gap = 2.4, len = Math.max(4, (usable - gap * (r.len - 1)) / r.len);
    const slots = Array.from({ length: r.len }, (_, n) => {
      const { pt, angle } = at(start + n * (len + gap) + len / 2);
      return { x: pt[0], y: pt[1], angle, len };
    });
    const f = (v: number) => v.toFixed(1);
    return { d: `M${f(p[0])} ${f(p[1])} Q${f(c[0])} ${f(c[1])} ${f(q[0])} ${f(q[1])}`, slots, mid: at(total / 2).pt };
  });

  const proj = (ll: LL): Pt => [PAD + (ll[0] * k - x0) * s, PAD + (-ll[1] - y0) * s];
  return { w: MAP_W, h, cities, routes, labels: labels(cities), track: track(MAP_W, h), terrain: terrain(board.id, proj, MAP_W, h) };
}

const f1 = (v: number) => v.toFixed(1);
const ring = (pts: Pt[]) => `M${pts.map((q) => `${f1(q[0])} ${f1(q[1])}`).join(' L')} Z`;
/** Smooth closed path through the points (Catmull-Rom → cubic Bézier). */
function smooth(pts: Pt[], closed = true): string {
  const n = pts.length;
  if (n < 3) return ring(pts);
  const at = (i: number) => (closed ? pts[(i + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
  let d = `M${f1(pts[0]![0])} ${f1(pts[0]![1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

function inside(p: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
/** Deterministic jitter in [0, 1). */
const hash = (a: number, b: number) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

function terrain(id: MapId, proj: (ll: LL) => Pt, w: number, h: number): Terrain {
  const g = GEO[id];
  const land = g.land.map((r) => r.map(proj));
  const water = g.water.map((r) => r.map(proj));
  const islands = (g.islands ?? []).map((r) => r.map(proj));
  const onLand = (p: Pt) => (land.some((r) => inside(p, r)) && !water.some((r) => inside(p, r))) || islands.some((r) => inside(p, r));
  const visible = (p: Pt) => p[0] > 8 && p[1] > 8 && p[0] < w - 8 && p[1] < h - 8;

  const mountains: Terrain['mountains'] = [];
  for (const line of g.mountains) {
    const pts = line.map(proj);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!, b = pts[i + 1]!, L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 13));
      for (let k = 0; k < n; k++) {
        const t = k / n, j = hash(a[0] + k, a[1]);
        const p: Pt = [a[0] + (b[0] - a[0]) * t + (j - 0.5) * 8, a[1] + (b[1] - a[1]) * t + (hash(k, a[0]) - 0.5) * 8];
        if (visible(p) && onLand(p)) mountains.push({ x: p[0], y: p[1], s: 0.8 + j * 0.5 });
      }
    }
  }
  mountains.sort((a, b) => a.y - b.y);
  const scatter = (boxes: [number, number, number, number][], step: number) => {
    const out: { x: number; y: number; s: number }[] = [];
    for (const [lo0, la0, lo1, la1] of boxes) {
      const [x0, y1] = proj([lo0, la0]), [x1, y0] = proj([lo1, la1]);
      for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
        const j = hash(x, y), p: Pt = [x + (j - 0.5) * step * 0.8, y + (hash(y, x) - 0.5) * step * 0.8];
        if (visible(p) && onLand(p) && hash(p[0], p[1]) > 0.45) out.push({ x: p[0], y: p[1], s: 0.75 + j * 0.5 });
      }
    }
    return out.sort((a, b) => a.y - b.y);
  };
  return {
    land: land.map((r) => smooth(r)).join(' '),
    water: water.map((r) => smooth(r)).join(' '),
    islands: islands.map((r) => smooth(r)).join(' '),
    borders: g.borders.map((l) => smooth(l.map(proj), false)),
    mountains,
    trees: scatter(g.forests, 15),
    dunes: scatter(g.deserts, 19),
    seas: g.seas.map(([lo, la, text]) => { const [x, y] = proj([lo, la]); return { x, y, text }; }),
    outside: g.country ? `M-50 -50 H${w + 50} V${h + 50} H-50 Z ${smooth(g.country.map(proj))}` : ''
  };
}

/** Name plaques sit above the station unless another station is close above it. */
function labels(cities: Pt[]): Pt[] {
  return cities.map(([x, y], i) => {
    const crowdedAbove = cities.some(([cx, cy], j) => j !== i && Math.abs(cx - x) < 46 && cy < y && y - cy < 34);
    return [x, crowdedAbove ? y + CITY_R + 11 : y - CITY_R - 11];
  });
}

function track(w: number, h: number): Pt[] {
  const per = 2 * (w + h), out: Pt[] = [];
  for (let i = 0; i < 100; i++) {
    let d = (i / 100) * per;
    if (d < w) { out.push([d, -8]); continue; } d -= w;
    if (d < h) { out.push([w + 8, d]); continue; } d -= h;
    if (d < w) { out.push([w - d, h + 8]); continue; } d -= w;
    out.push([-8, h - d]);
  }
  return out;
}

const cache = new Map<MapId, Layout>();
export function layoutOf(map: MapId): Layout {
  let l = cache.get(map);
  if (!l) { l = build(BOARDS[map]); cache.set(map, l); }
  return l;
}
export { CAR_H, CITY_R };
