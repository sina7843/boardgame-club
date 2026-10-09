// Zoo-map geometry. Every zoo map is the same 58-space grid of flat-top hexes: 9 columns (x = 0..8, left to right),
// y = 0..12 top to bottom in "doubled" rows (x + y is always odd). Cell ids are "x_y" (the reference data's ids).
// Even columns hold y = 1,3,..,11 (6 spaces), odd columns y = 0,2,..,12 (7 spaces).
// Axial coordinates for shapes/rotation: q = x, r = (y - x - 1) / 2.

export type Cell = string;
export const cellId = (x: number, y: number): Cell => `${x}_${y}`;
export const xy = (c: Cell): [number, number] => { const [x, y] = c.split('_').map(Number) as [number, number]; return [x, y]; };
export const toAxial = (c: Cell): [number, number] => { const [x, y] = xy(c); return [x, (y - x - 1) / 2]; };
export const fromAxial = (q: number, r: number): Cell => cellId(q, 2 * r + q + 1);

export const CELLS: Cell[] = [];
for (let x = 0; x <= 8; x++) for (let y = x % 2 === 0 ? 1 : 0; y <= 12; y += 2) CELLS.push(cellId(x, y));
const SET = new Set(CELLS);
export const inGrid = (c: Cell) => SET.has(c);

const DIRS: [number, number][] = [[0, -2], [1, -1], [1, 1], [0, 2], [-1, 1], [-1, -1]];
const NB = new Map<Cell, Cell[]>(CELLS.map((c) => {
  const [x, y] = xy(c);
  return [c, DIRS.map(([dx, dy]) => cellId(x + dx, y + dy)).filter((n) => SET.has(n))];
}));
export const neighbors = (c: Cell): Cell[] => NB.get(c) ?? [];
/** Border space: fewer than 6 neighbouring spaces on the map. */
export const isBorder = (c: Cell) => neighbors(c).length < 6;
export function hexDistance(a: Cell, b: Cell): number {
  const [q1, r1] = toAxial(a); const [q2, r2] = toAxial(b);
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2;
}
/** Distinct cells adjacent to (and not part of) a set of cells. */
export function around(cells: readonly Cell[]): Cell[] {
  const own = new Set(cells);
  const out = new Set<Cell>();
  for (const c of cells) for (const n of neighbors(c)) if (!own.has(n)) out.add(n);
  return [...out];
}

/** Axial shapes of every building kind (the anchor is irrelevant; all rotations are tried). */
export const SHAPES: Record<string, [number, number][]> = {
  e1: [[0, 0]],
  e2: [[0, 0], [1, 0]],
  e3: [[0, 0], [1, 0], [0, 1]],
  e4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  e5: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]],
  kiosk: [[0, 0]],
  pavilion: [[0, 0]],
  pz: [[0, 0], [0, -1], [1, -2]],
  rh: [[0, 0], [0, -1], [1, -1], [2, -2], [2, -1]],
  ba: [[0, 0], [0, -1], [1, -2], [1, -1], [2, -1]]
};
/** Special enclosures are the same on both sides, so they may also be placed mirrored. */
const MIRROR = new Set(['pz', 'rh', 'ba']);

function orientations(shape: [number, number][], mirror: boolean): [number, number][][] {
  const out: [number, number][][] = [];
  const seen = new Set<string>();
  const bases = mirror ? [shape, shape.map(([q, r]) => [r, q] as [number, number])] : [shape];
  for (const base of bases) {
    let cur = base;
    for (let k = 0; k < 6; k++) {
      const minQ = Math.min(...cur.map((p) => p[0])); const minR = Math.min(...cur.map((p) => p[1]));
      const norm = cur.map(([q, r]) => [q - minQ, r - minR] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const key = JSON.stringify(norm);
      if (!seen.has(key)) { seen.add(key); out.push(norm); }
      cur = cur.map(([q, r]) => [-r, q + r] as [number, number]);
    }
  }
  return out;
}

const cache = new Map<string, Cell[][]>();
/** Every way to lay a shape on the grid (cells sorted). Cached per shape key. */
export function placementsOf(key: string, shape: [number, number][], mirror = MIRROR.has(key)): Cell[][] {
  const hit = cache.get(key);
  if (hit) return hit;
  const out: Cell[][] = [];
  const seen = new Set<string>();
  for (const o of orientations(shape, mirror)) {
    for (const anchor of CELLS) {
      const [aq, ar] = toAxial(anchor);
      const cells = o.map(([q, r]) => fromAxial(aq + q, ar + r));
      if (!cells.every(inGrid)) continue;
      cells.sort();
      const k = cells.join(',');
      if (!seen.has(k)) { seen.add(k); out.push(cells); }
    }
  }
  cache.set(key, out);
  return out;
}
export const sameCells = (a: readonly Cell[], b: readonly Cell[]) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');
