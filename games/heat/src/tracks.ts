// Heat tracks: the four base-game circuits as closed curves. Rules only need each track's length (spaces per lap),
// corner positions/speed limits and the heat/stress setup numbers; the renderer also uses the geometry. Corner positions
// are derived from the control points (a corner sits at the bend it is named after), with pure arithmetic only, so the
// result is identical on server and client.

export type TrackId = 'usa' | 'italy' | 'france' | 'gb';
export const TRACK_IDS: TrackId[] = ['usa', 'italy', 'france', 'gb'];

interface TrackDef {
  id: TrackId;
  nameFa: string;
  /** Spaces per lap. Space 0 is the first space after the start/finish line. */
  length: number;
  /** Heat cards in each engine at the start of a race. */
  heat: number;
  /** Stress cards shuffled into each deck at the start of a race. */
  stress: number;
  /** Closed curve control points in a 1000×620 box (direction of travel = point order). Point 0 is on the start/finish line. */
  points: [number, number][];
  /** [control point index, speed limit] of each corner. */
  cornerPts: [number, number][];
}

const DEFS: TrackDef[] = [
  {
    id: 'usa', nameFa: 'آمریکا', length: 54, heat: 6, stress: 3,
    points: [[500, 560], [800, 560], [925, 470], [900, 320], [935, 160], [800, 70], [600, 120], [430, 70], [190, 90], [75, 250], [150, 410], [270, 545]],
    cornerPts: [[2, 5], [4, 4], [6, 3], [8, 6], [10, 4]]
  },
  {
    id: 'italy', nameFa: 'ایتالیا', length: 58, heat: 6, stress: 3,
    points: [[480, 570], [790, 565], [940, 470], [870, 330], [690, 300], [640, 170], [830, 80], [520, 50], [300, 120], [110, 170], [80, 410], [220, 550]],
    cornerPts: [[2, 4], [4, 3], [6, 6], [9, 2], [11, 5]]
  },
  {
    id: 'france', nameFa: 'فرانسه', length: 56, heat: 5, stress: 4,
    points: [[500, 565], [840, 545], [935, 400], [810, 260], [900, 110], [700, 60], [520, 210], [330, 70], [110, 120], [80, 320], [240, 380], [130, 520]],
    cornerPts: [[2, 4], [4, 5], [6, 3], [8, 4], [10, 3]]
  },
  {
    id: 'gb', nameFa: 'بریتانیا', length: 60, heat: 6, stress: 4,
    points: [[520, 575], [860, 560], [950, 420], [880, 300], [940, 150], [760, 60], [560, 150], [400, 60], [170, 80], [60, 240], [210, 330], [90, 470], [240, 570]],
    cornerPts: [[2, 5], [4, 4], [6, 3], [8, 6], [9, 4], [11, 3]]
  }
];

export interface Corner { at: number; limit: number }
export interface Track extends TrackDef {
  corners: Corner[];
  /** Dense closed polyline of the centre line and cumulative arc length (renderer). */
  path: [number, number][];
  cum: number[];
  total: number;
}

const PER = 24;
function catmull(points: [number, number][]): [number, number][] {
  const n = points.length;
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]!, p1 = points[i]!, p2 = points[(i + 1) % n]!, p3 = points[(i + 2) % n]!;
    for (let k = 0; k < PER; k++) {
      const t = k / PER, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

const cache = new Map<TrackId, Track>();
export function trackOf(id: TrackId): Track {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = DEFS.find((d) => d.id === id)!;
  const path = catmull(def.points);
  const cum = [0];
  for (let i = 1; i <= path.length; i++) {
    const a = path[i - 1]!, b = path[i % path.length]!;
    cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[path.length]!;
  const corners = def.cornerPts.map(([p, limit]) => ({ at: Math.round((cum[p * PER]! / total) * def.length), limit }));
  const t: Track = { ...def, corners, path, cum, total };
  cache.set(id, t);
  return t;
}

/** Point and heading at a fraction (0..1) of the lap. */
export function pointAt(t: Track, frac: number): { x: number; y: number; a: number } {
  const d = (((frac % 1) + 1) % 1) * t.total;
  let lo = 0, hi = t.path.length;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (t.cum[mid]! <= d) lo = mid; else hi = mid; }
  const a = t.path[lo]!, b = t.path[(lo + 1) % t.path.length]!;
  const seg = t.cum[lo + 1]! - t.cum[lo]! || 1;
  const k = (d - t.cum[lo]!) / seg;
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
