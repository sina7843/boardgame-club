// The Tharsis map: 61 hex areas in rows of 5,6,7,8,9,8,7,6,5 (ids '03'…'63', row by row) plus the off-map city
// areas Ganymede Colony ('01') and Phobos Space Haven ('02'). 12 areas are reserved for oceans; Noctis City ('31')
// is reserved for the Noctis City card. Bonuses follow the printed board.
import type { Space } from './api.ts';

type B = Space['bonus'][number];
const S: B = 'steel', T: B = 'titanium', P: B = 'plants', C: B = 'card';
// [ocean?, bonuses] per area, row by row.
const L = (...b: B[]) => [false, b] as const;
const O = (...b: B[]) => [true, b] as const;
const ROWS = [
  [L(S, S), O(S, S), L(), O(C), O()],
  [L(), L(S), L(), L(), L(), O(C, C)],
  [L(C), L(), L(), L(), L(), L(), L(S)],
  [L(P, T), L(P), L(P), L(P), L(P, P), L(P), L(P), O(P, P)],
  [L(P, P), L(P, P), L(P, P), O(P, P), O(P, P), O(P, P), L(P, P), L(P, P), L(P, P)],
  [L(P), L(P, P), L(P), L(P), L(P), O(P), O(P), O(P)],
  [L(), L(), L(), L(), L(), L(P), L()],
  [L(S, S), L(), L(C), L(C), L(), L(T)],
  [L(S), L(S, S), L(), L(), O(T, T)]
];
const NAMES: Record<string, string> = { '09': 'tholus', '14': 'ascraeus', '21': 'pavonis', '29': 'arsia', '31': 'noctis' };
export const NAME_FA: Record<string, string> = { tholus: 'تارسیس تولوس', ascraeus: 'اسکرئوس مونس', pavonis: 'پاوونیس مونس', arsia: 'آرسیا مونس', noctis: 'شهر نوکتیس', ganymede: 'مستعمرهٔ گانیمد', phobos: 'پناهگاه فوبوس' };

export const SPACES: Space[] = [
  { id: '01', row: -1, col: 0, ocean: false, bonus: [], name: 'ganymede', offMap: true },
  { id: '02', row: -1, col: 1, ocean: false, bonus: [], name: 'phobos', offMap: true }
];
{
  let n = 3;
  ROWS.forEach((row, r) => row.forEach(([ocean, bonus], c) => {
    const id = String(n++).padStart(2, '0');
    SPACES.push({ id, row: r, col: c, ocean, bonus: [...bonus], ...(NAMES[id] ? { name: NAMES[id] } : {}) });
  }));
}
export const SPACE: Record<string, Space> = Object.fromEntries(SPACES.map((s) => [s.id, s]));
export const MARS = SPACES.filter((s) => !s.offMap);
export const VOLCANIC = new Set(['09', '14', '21', '29']);
export const NOCTIS = '31';

/** Doubled x coordinate: rows are centred, so neighbours differ by 1 in x across rows and by 2 within a row. */
export const hexX = (s: Space) => 2 * s.col + Math.abs(s.row - 4);
export const ADJ: Record<string, string[]> = Object.fromEntries(MARS.map((a) => [a.id, MARS.filter((b) => b !== a && (
  (b.row === a.row && Math.abs(hexX(b) - hexX(a)) === 2) || (Math.abs(b.row - a.row) === 1 && Math.abs(hexX(b) - hexX(a)) === 1)
)).map((b) => b.id)]));
SPACES.filter((s) => s.offMap).forEach((s) => { ADJ[s.id] = []; });
