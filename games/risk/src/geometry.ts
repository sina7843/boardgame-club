// World map geometry for the renderer and cover (no React, no rules). Landmasses are hand-drawn outlines smoothed
// with Catmull-Rom splines; each landmass is split between its territories by a weighted Voronoi (power) diagram of
// hand-placed seeds, so borders follow the coastlines. Computed once at import; viewBox is 0 0 1000 600.
import { ADJ, T, type ContinentId, type TerritoryId } from './board.ts';

export type Pt = [number, number];
export const MAP_W = 1000, MAP_H = 600;

interface Landmass { outline: Pt[]; seeds: Partial<Record<TerritoryId, [number, number, number?]>> }

// [x, y, weight]: a larger weight grows that territory's region.
export const LANDMASSES: Landmass[] = [
  { // North America
    outline: [[38, 74], [72, 52], [122, 58], [170, 44], [228, 50], [262, 66], [252, 96], [292, 104], [330, 118], [344, 150],
      [318, 174], [292, 190], [282, 218], [276, 246], [270, 272], [256, 262], [240, 254], [218, 262], [222, 296], [248, 312],
      [264, 336], [250, 342], [226, 326], [196, 306], [172, 282], [152, 252], [128, 216], [116, 172], [108, 132], [84, 112],
      [58, 116], [34, 102]],
    seeds: { alaska: [62, 86], northwestTerritory: [160, 82], alberta: [150, 136], ontario: [214, 144], quebec: [292, 146],
      westernUS: [160, 202], easternUS: [240, 210], centralAmerica: [214, 290] }
  },
  { outline: [[286, 36], [340, 18], [402, 24], [398, 54], [368, 92], [336, 114], [314, 92], [300, 62]], seeds: { greenland: [350, 60] } },
  { // South America
    outline: [[262, 346], [300, 334], [340, 350], [376, 372], [388, 396], [372, 432], [346, 466], [320, 502], [302, 540], [290, 562],
      [282, 540], [280, 500], [274, 462], [260, 422], [248, 390], [248, 364]],
    seeds: { venezuela: [290, 358], peru: [274, 418], brazil: [340, 400], argentina: [298, 492] }
  },
  { outline: [[424, 80], [446, 70], [464, 78], [458, 94], [432, 96]], seeds: { iceland: [444, 84] } },
  { outline: [[452, 118], [468, 110], [478, 134], [482, 158], [464, 170], [448, 162], [456, 140]], seeds: { greatBritain: [466, 142] } },
  { // Eurasia
    outline: [[470, 232], [490, 252], [516, 244], [532, 228], [548, 242], [560, 266], [572, 262], [564, 238], [582, 240], [592, 262],
      [604, 250], [626, 244], [644, 248], [652, 264], [672, 300], [700, 296], [716, 274], [740, 282], [762, 318], [776, 344],
      [792, 310], [812, 284], [830, 300], [842, 336], [852, 322], [862, 288], [886, 262], [906, 232], [918, 202], [934, 172],
      [952, 138], [976, 112], [990, 88], [972, 58], [930, 44], [860, 38], [780, 28], [700, 34], [640, 48], [602, 58],
      [576, 40], [546, 42], [520, 64], [514, 96], [530, 116], [550, 108], [560, 86], [576, 98], [582, 122], [560, 132],
      [530, 136], [510, 150], [494, 170], [478, 186], [468, 206]],
    seeds: { scandinavia: [546, 80], northernEurope: [545, 166], westernEurope: [500, 214], southernEurope: [572, 222],
      ukraine: [616, 149, 2650], ural: [686, 113, 750], siberia: [749, 98, -1750], yakutsk: [830, 58], kamchatka: [924, 90],
      irkutsk: [828, 109, -1200], mongolia: [841, 165, 850], afghanistan: [690, 202, -300], china: [799, 216, 1950],
      middleEast: [650, 262], india: [755, 290, 2550], siam: [845, 322, -400] }
  },
  { outline: [[934, 160], [950, 168], [960, 200], [946, 228], [932, 218], [940, 192]], seeds: { japan: [946, 194] } },
  { // Africa
    outline: [[470, 304], [500, 290], [540, 292], [580, 296], [620, 292], [636, 304], [656, 336], [690, 340], [682, 366], [664, 398],
      [650, 448], [626, 490], [602, 510], [580, 504], [566, 470], [556, 422], [540, 382], [520, 352], [490, 348], [470, 326]],
    seeds: { northAfrica: [540, 334, 800], egypt: [610, 305, -400], eastAfrica: [645, 375, 200], congo: [570, 412], southAfrica: [600, 466] }
  },
  { outline: [[680, 430], [694, 438], [688, 480], [672, 480], [670, 452]], seeds: { madagascar: [682, 456] } },
  { outline: [[818, 360], [860, 354], [882, 368], [872, 390], [836, 392], [814, 378]], seeds: { indonesia: [848, 374] } },
  { outline: [[900, 368], [946, 364], [972, 384], [940, 398], [904, 392]], seeds: { newGuinea: [936, 381] } },
  { // Australia
    outline: [[850, 440], [890, 420], [930, 424], [960, 450], [966, 490], [940, 520], [900, 516], [870, 504], [846, 480]],
    seeds: { westernAustralia: [880, 470], easternAustralia: [936, 470] }
  }
];

/** Closed Catmull-Rom spline through the outline, sampled as a polygon. */
export function smooth(pts: Pt[], steps = 6): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!, p1 = pts[i]!, p2 = pts[(i + 1) % n]!, p3 = pts[(i + 2) % n]!;
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

/** Sutherland–Hodgman clip against the half-plane a·x + b·y <= c. */
function clip(poly: Pt[], a: number, b: number, c: number): Pt[] {
  const out: Pt[] = [];
  const inside = (p: Pt) => a * p[0] + b * p[1] <= c + 1e-9;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
    const pi = inside(p), qi = inside(q);
    if (pi) out.push(p);
    if (pi !== qi) {
      const dp = a * p[0] + b * p[1] - c, dq = a * q[0] + b * q[1] - c;
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

export function centroid(poly: Pt[]): Pt {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
    const k = p[0] * q[1] - q[0] * p[1];
    a += k; x += (p[0] + q[0]) * k; y += (p[1] + q[1]) * k;
  }
  return a === 0 ? poly[0]! : [x / (3 * a), y / (3 * a)];
}

export const pathOf = (poly: Pt[]) => `M${poly.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;

const distToSeg = (p: Pt, a: Pt, b: Pt) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const inside = (p: Pt, poly: Pt[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};
/** Interior point farthest from the border (grid search): where the army token sits. */
function labelPoint(poly: Pt[]): Pt {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  let best: Pt = centroid(poly), bestD = -1;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 2.5) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 2.5) {
      if (!inside([x, y], poly)) continue;
      const d = Math.min(...poly.map((a, i) => distToSeg([x, y], a, poly[(i + 1) % poly.length]!)));
      if (d > bestD) { bestD = d; best = [x, y]; }
    }
  }
  return best;
}

export interface Region { id: TerritoryId; poly: Pt[]; d: string; center: Pt; land: number }

/** Region polygon per territory (index-aligned with TERRITORY_IDS), plus which adjacent pairs share a land border. */
const built = (() => {
  const regions: Region[] = [];
  const touching = new Set<string>();
  LANDMASSES.forEach((lm, land) => {
    const shape = smooth(lm.outline);
    const seeds = Object.entries(lm.seeds) as [TerritoryId, [number, number, number?]][];
    // Power-diagram bisector of s and o: |p-s|² - w <= |p-o|² - ow  ⇔  a·x + b·y <= c
    const bisector = ([x, y, w = 0]: [number, number, number?], [ox, oy, ow = 0]: [number, number, number?]) =>
      [2 * (ox - x), 2 * (oy - y), ox * ox + oy * oy - x * x - y * y + w - ow] as const;
    for (const [id, s] of seeds) {
      let poly = shape;
      for (const [other, o] of seeds) if (other !== id) poly = clip(poly, ...bisector(s, o));
      regions[T[id]] = { id, poly, d: pathOf(poly), center: labelPoint(poly), land };
      // A border exists where this region has an edge lying on the bisector with the other seed.
      for (const [other, o] of seeds) {
        if (other === id) continue;
        const [a, b, c] = bisector(s, o), n = Math.hypot(a, b);
        const on = (p: Pt) => Math.abs(a * p[0] + b * p[1] - c) / n < 0.01;
        const len = poly.reduce((acc, p, i) => { const q = poly[(i + 1) % poly.length]!; return acc + (on(p) && on(q) ? Math.hypot(q[0] - p[0], q[1] - p[1]) : 0); }, 0);
        if (len > 2) touching.add([T[id], T[other]].sort((x, y) => x - y).join('-'));
      }
    }
  });
  return { regions, touching };
})();
export const REGIONS: Region[] = built.regions;
/** True when two territories share a drawn land border. */
export const touches = (a: number, b: number) => built.touching.has([a, b].sort((x, y) => x - y).join('-'));

/** Coastline path per landmass (drawn under the regions). */
export const COASTS: string[] = LANDMASSES.map((lm) => pathOf(smooth(lm.outline)));

export const WRAP_LANE: [number, number] = [T.alaska, T.kamchatka];
/** Adjacent pairs without a shared land border, drawn as dashed sea lanes between the nearest coast points. */
export const SEA_LANES: { a: number; b: number; p: Pt; q: Pt }[] = ADJ.flatMap((ns, a) => ns
  .filter((b) => b > a && !touches(a, b) && !(a === WRAP_LANE[0] && b === WRAP_LANE[1]))
  .map((b) => {
    let p: Pt = REGIONS[a]!.center, q: Pt = REGIONS[b]!.center, d = Infinity;
    for (const x of REGIONS[a]!.poly) for (const y of REGIONS[b]!.poly) {
      const k = Math.hypot(x[0] - y[0], x[1] - y[1]);
      if (k < d) { d = k; p = x; q = y; }
    }
    return { a, b, p, q };
  }));

/** Where each continent's name and bonus banner sits (in the ocean next to it). */
export const CONTINENT_LABEL: Record<ContinentId, Pt> = {
  na: [98, 300], sa: [196, 470], eu: [430, 196], af: [488, 452], as: [880, 22], au: [792, 520]
};
