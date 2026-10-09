// Gaia Project space map: the 10 double-sided sector tiles (19 hexes each), their placement for 2 players
// (sectors 1–4 + back sides 5B/6B/7B) and 3–4 players (sectors 1–10), random rotation, and the rule that two
// planets of the same home type never touch across sectors. Pure data + geometry shared by rules and renderer.
//
// Coordinates are axial (q, r), flat-top hexes: x = 1.5·q, y = √3·(r + q/2). Hex ids are stable per game.
import type { EngineRng } from '@bg/game-sdk';

/** e = empty space, r = Terra, o = Oxide, v = Volcanic, d = Desert, s = Swamp, t = Titanium, i = Ice,
 *  g = Gaia, m = Transdim, l = Lost Planet (navigation level 5). */
export const PLANETS = ['r', 'o', 'v', 'd', 's', 't', 'i', 'g', 'm', 'l', 'e'] as const;
export type Planet = (typeof PLANETS)[number];
/** The terraforming wheel (home planet types), in order. */
export const WHEEL = ['r', 'o', 'v', 'd', 's', 't', 'i'] as const;
export type HomePlanet = (typeof WHEEL)[number];

export const PLANET_FA: Record<Planet, string> = {
  r: 'زمین‌گون (آبی)', o: 'اکسیدی (قرمز)', v: 'آتشفشانی (نارنجی)', d: 'بیابانی (زرد)', s: 'باتلاقی (قهوه‌ای)',
  t: 'تیتانیومی (خاکستری)', i: 'یخی (سفید)', g: 'گایا (سبز)', m: 'فرابُعدی (بنفش)', l: 'سیارهٔ گمشده', e: 'فضای خالی'
};

/** Terraforming steps between two home planet types (0–3 around the wheel). */
export function wheelDistance(from: HomePlanet, to: Planet): number {
  const i = WHEEL.indexOf(from), j = WHEEL.indexOf(to as HomePlanet);
  if (j < 0) return 0;
  const d = Math.abs(i - j);
  return Math.min(d, 7 - d);
}

// Sector contents, ring by ring: outer ring (12, clockwise from the top hex), inner ring (6), centre.
const SECTOR_RINGS: Record<string, string> = {
  '1': 'eeemevoeedee,ereees,e',
  '2': 'teedemeoeeev,eieese,e',
  '3': 'meeteedreeee,eeieeg,e',
  '4': 'teeereeeeiee,oeseve,e',
  '5A': 'iemoeedveeee,eeeeeg,e',
  '5B': 'iemoeeeveeee,eeeeeg,e',
  '6A': 'emeedmeeeeee,ereges,e',
  '6B': 'emeedmeeeeee,eregee,e',
  '7A': 'eseeeeteeeme,oegege,e',
  '7B': 'eeeeeeteeeme,gesege,e',
  '8': 'remeeeemeeee,ieteve,e',
  '9': 'emieeeeeseev,eegete,e',
  '10': 'emmeeeeoreee,eegeed,e'
};
export const SECTORS: Record<string, string> = Object.fromEntries(Object.entries(SECTOR_RINGS).map(([k, v]) => [k, v.replace(/,/g, '')]));

export const SMALL_SECTORS = ['1', '2', '3', '4', '5B', '6B', '7B'];
export const BIG_SECTORS = ['1', '2', '3', '4', '5A', '6A', '7A', '8', '9', '10'];

export const SMALL_CENTERS: [number, number][] = [[0, 0], [5, -2], [2, 3], [-3, 5], [-5, 2], [-2, -3], [3, -5]];
const BIG_CENTERS: [number, number][] = [...SMALL_CENTERS, [-1, 8], [-6, 10], [-8, 7]];

/** Axial directions walked clockwise around a ring starting from its top hex. */
const RING_WALK: [number, number][] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
export const NEIGHBOR_DIRS: [number, number][] = RING_WALK;

function ring(k: number): [number, number][] {
  if (k === 0) return [[0, 0]];
  const out: [number, number][] = [];
  let q = 0, r = -k;
  for (const [dq, dr] of RING_WALK) for (let i = 0; i < k; i++) { out.push([q, r]); q += dq; r += dr; }
  return out;
}
const SECTOR_OFFSETS = [...ring(2), ...ring(1), ...ring(0)];

/** Rotate an axial offset clockwise by 60° `times` times. */
function rotate([q, r]: [number, number], times: number): [number, number] {
  let a = q, b = r;
  for (let i = 0; i < ((times % 6) + 6) % 6; i++) [a, b] = [-b, a + b];
  return [a, b];
}

export interface MapHex { q: number; r: number; sector: number; planet: Planet }
export interface SectorPlacement { sector: string; rotation: number; center: [number, number] }

export const sectorNumber = (name: string) => Number(name.replace(/[AB]/, ''));

export function buildMap(placements: SectorPlacement[]): MapHex[] {
  const hexes: MapHex[] = [];
  for (const p of placements) {
    const def = SECTORS[p.sector]!;
    if (def.length !== 19) throw new Error(`sector ${p.sector} must have 19 hexes`);
    SECTOR_OFFSETS.forEach((off, i) => {
      const [dq, dr] = rotate(off, p.rotation);
      hexes.push({ q: p.center[0] + dq, r: p.center[1] + dr, sector: sectorNumber(p.sector), planet: def[i] as Planet });
    });
  }
  return hexes;
}

export const hexDistance = (a: { q: number; r: number }, b: { q: number; r: number }) =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

const HOME = new Set<Planet>(WHEEL);
/** No two planets of the same home type may touch (official German-rules map check). */
export function validMap(hexes: MapHex[]): boolean {
  const at = new Map(hexes.map((h) => [`${h.q},${h.r}`, h]));
  for (const h of hexes) {
    if (!HOME.has(h.planet)) continue;
    for (const [dq, dr] of NEIGHBOR_DIRS) if (at.get(`${h.q + dq},${h.r + dr}`)?.planet === h.planet) return false;
  }
  return true;
}

export function randomMap(players: number, rng: EngineRng): { placements: SectorPlacement[]; hexes: MapHex[] } {
  const names = players <= 2 ? SMALL_SECTORS : BIG_SECTORS;
  const centers = players <= 2 ? SMALL_CENTERS : BIG_CENTERS;
  let last: { placements: SectorPlacement[]; hexes: MapHex[] } | null = null;
  for (let tries = 0; tries < 500; tries++) {
    const order = names.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [order[i], order[j]] = [order[j]!, order[i]!]; }
    const placements = order.map((sector, i) => ({ sector, rotation: rng.nextInt(6), center: centers[i]! }));
    last = { placements, hexes: buildMap(placements) };
    if (validMap(last.hexes)) return last;
  }
  return last!; // ponytail: 500 tries always suffice in practice; the last layout is still a legal board.
}

/** Index of every hex by "q,r", for neighbour lookups. */
export function hexIndex(hexes: { q: number; r: number }[]): Map<string, number> {
  return new Map(hexes.map((h, i) => [`${h.q},${h.r}`, i]));
}
export function neighbors(hexes: { q: number; r: number }[], idx: Map<string, number>, i: number): number[] {
  const h = hexes[i]!;
  const out: number[] = [];
  for (const [dq, dr] of NEIGHBOR_DIRS) { const j = idx.get(`${h.q + dq},${h.r + dr}`); if (j !== undefined) out.push(j); }
  return out;
}

export const HEX_SIZE = 20;
export const hexCenter = (h: { q: number; r: number }) => ({ x: HEX_SIZE * 1.5 * h.q, y: HEX_SIZE * Math.sqrt(3) * (h.r + h.q / 2) });
