// Catan board geometry (19 land hexes, radius 2, pointy-top) and the two map layouts from the rulebook:
// "Starting Map for Beginners" (Illustration A) and the variable set-up. Ids are stable: hexes row by row from the
// top, vertices (intersections) and edges (paths) sorted by screen position. Pure data, shared by rules and renderer.

export const RESOURCES = ['brick', 'lumber', 'wool', 'grain', 'ore'] as const;
export type Res = (typeof RESOURCES)[number];
export type Terrain = 'hills' | 'forest' | 'pasture' | 'fields' | 'mountains' | 'desert';

export const TERRAIN_RES: Record<Terrain, Res | null> = {
  hills: 'brick', forest: 'lumber', pasture: 'wool', fields: 'grain', mountains: 'ore', desert: null
};
export const RES_FA: Record<Res, string> = { brick: 'آجر', lumber: 'چوب', wool: 'پشم', grain: 'گندم', ore: 'سنگ' };
export const TERRAIN_FA: Record<Terrain, string> = {
  hills: 'تپه', forest: 'جنگل', pasture: 'مرتع', fields: 'مزرعه', mountains: 'کوهستان', desert: 'بیابان'
};

/** Axial coordinates, rows top to bottom (3-4-5-4-3). */
export const HEX_COORDS: readonly [number, number][] = [
  [0, -2], [1, -2], [2, -2],
  [-1, -1], [0, -1], [1, -1], [2, -1],
  [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
  [-2, 1], [-1, 1], [0, 1], [1, 1],
  [-2, 2], [-1, 2], [0, 2]
];

export const HEX_SIZE = 60;
const SQ3 = Math.sqrt(3);
export const hexCenter = (i: number) => {
  const [q, r] = HEX_COORDS[i]!;
  return { x: SQ3 * HEX_SIZE * (q + r / 2), y: 1.5 * HEX_SIZE * r };
};
export const hexCorners = (i: number) => {
  const c = hexCenter(i);
  return Array.from({ length: 6 }, (_, k) => {
    const a = ((-90 + 60 * k) * Math.PI) / 180;
    return { x: c.x + HEX_SIZE * Math.cos(a), y: c.y + HEX_SIZE * Math.sin(a) };
  });
};

export interface Vertex { x: number; y: number; hexes: number[]; adj: number[]; edges: number[] }
export interface Edge { a: number; b: number; hexes: number[] }

function buildGeometry() {
  const key = (p: { x: number; y: number }) => `${Math.round(p.x * 10)},${Math.round(p.y * 10)}`;
  const pts = new Map<string, { x: number; y: number; hexes: number[] }>();
  const corners = HEX_COORDS.map((_, h) => hexCorners(h).map((p) => {
    const k = key(p);
    if (!pts.has(k)) pts.set(k, { x: p.x, y: p.y, hexes: [] });
    pts.get(k)!.hexes.push(h);
    return k;
  }));
  const order = [...pts.keys()].sort((a, b) => {
    const pa = pts.get(a)!, pb = pts.get(b)!;
    return Math.round(pa.y - pb.y) || pa.x - pb.x;
  });
  const id = new Map(order.map((k, i) => [k, i]));
  const vertices: Vertex[] = order.map((k) => ({ ...pts.get(k)!, adj: [], edges: [] }));
  const hexVertices = corners.map((ks) => ks.map((k) => id.get(k)!));

  const edgeMap = new Map<string, Edge>();
  hexVertices.forEach((vs, h) => vs.forEach((v, k) => {
    const w = vs[(k + 1) % 6]!;
    const [a, b] = v < w ? [v, w] : [w, v];
    const ek = `${a}-${b}`;
    if (!edgeMap.has(ek)) edgeMap.set(ek, { a, b, hexes: [] });
    edgeMap.get(ek)!.hexes.push(h);
  }));
  const mid = (e: Edge) => ({ x: (vertices[e.a]!.x + vertices[e.b]!.x) / 2, y: (vertices[e.a]!.y + vertices[e.b]!.y) / 2 });
  const edges = [...edgeMap.values()].sort((e, f) => Math.round(mid(e).y - mid(f).y) || mid(e).x - mid(f).x);
  edges.forEach((e, i) => {
    vertices[e.a]!.adj.push(e.b); vertices[e.b]!.adj.push(e.a);
    vertices[e.a]!.edges.push(i); vertices[e.b]!.edges.push(i);
  });
  const hexNeighbors = HEX_COORDS.map(([q, r]) => HEX_COORDS.flatMap(([q2, r2], j) => {
    const dq = q2 - q, dr = r2 - r;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) === 2 ? [j] : [];
  }));
  // Coast: edges with one land hex, ordered clockwise from the top by angle around the centre.
  const coast = edges.map((e, i) => ({ e, i })).filter(({ e }) => e.hexes.length === 1)
    .sort((p, q) => angle(mid(p.e)) - angle(mid(q.e))).map(({ i }) => i);
  return { vertices, edges, hexVertices, hexNeighbors, coast };
}
const angle = (p: { x: number; y: number }) => (Math.atan2(p.x, -p.y) + 2 * Math.PI) % (2 * Math.PI);

export const { vertices: VERTICES, edges: EDGES, hexVertices: HEX_VERTICES, hexNeighbors: HEX_NEIGHBORS, coast: COAST } = buildGeometry();

/** Harbor positions on the frame: 9 coastal paths spread around the island. */
export const HARBOR_SLOTS = [0, 3, 7, 10, 13, 17, 20, 23, 27].map((k) => COAST[k]!);
export type HarborKind = Res | 'any';
export interface Harbor { edge: number; kind: HarborKind }

/** Vertex shared by three hexes (or two hexes on the coast), for readable fixed positions. */
export function vertexOf(...hexes: number[]): number {
  const v = VERTICES.findIndex((x) => hexes.every((h) => x.hexes.includes(h)) && (hexes.length === 3 || x.hexes.length === hexes.length));
  if (v < 0) throw new Error(`no vertex for hexes ${hexes.join(',')}`);
  return v;
}
export const edgeOf = (a: number, b: number) => {
  const e = EDGES.findIndex((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (e < 0) throw new Error(`no edge ${a}-${b}`);
  return e;
};

/** Rulebook Illustration A (Starting Map for Beginners), row by row. */
export const BEGINNER_MAP: { terrain: Terrain; number: number | null }[] = [
  { terrain: 'mountains', number: 10 }, { terrain: 'pasture', number: 2 }, { terrain: 'forest', number: 9 },
  { terrain: 'fields', number: 12 }, { terrain: 'hills', number: 6 }, { terrain: 'pasture', number: 4 }, { terrain: 'hills', number: 10 },
  { terrain: 'fields', number: 9 }, { terrain: 'forest', number: 11 }, { terrain: 'desert', number: null }, { terrain: 'forest', number: 3 }, { terrain: 'mountains', number: 8 },
  { terrain: 'forest', number: 8 }, { terrain: 'mountains', number: 3 }, { terrain: 'fields', number: 4 }, { terrain: 'pasture', number: 5 },
  { terrain: 'hills', number: 5 }, { terrain: 'fields', number: 6 }, { terrain: 'pasture', number: 11 }
];
export const BEGINNER_HARBORS: HarborKind[] = ['any', 'wool', 'any', 'any', 'brick', 'lumber', 'any', 'grain', 'ore'];

export const TERRAIN_POOL: Terrain[] = [
  ...Array<Terrain>(4).fill('forest'), ...Array<Terrain>(4).fill('pasture'), ...Array<Terrain>(4).fill('fields'),
  ...Array<Terrain>(3).fill('hills'), ...Array<Terrain>(3).fill('mountains'), 'desert'
];
export const NUMBER_POOL = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
export const HARBOR_POOL: HarborKind[] = ['any', 'any', 'any', 'any', 'brick', 'lumber', 'wool', 'grain', 'ore'];

/** Dots under a number token: how many of the 36 dice combinations roll it. */
export const pips = (n: number | null) => (n === null ? 0 : 6 - Math.abs(7 - n));
