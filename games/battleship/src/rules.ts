// Battleship («نبرد دریایی»), two players. 10×10 sea each; fleet of five ships (5, 4, 3, 3, 2), horizontal or vertical,
// no overlaps (touching allowed). Placement is simultaneous and secret; then players alternate single shots at the
// opponent's sea (miss / hit; the ship's name is announced when sunk). First to sink the whole enemy fleet wins.
// Hidden: the opponent's ship positions (only your own shot results and sunk ships are shown).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { battleship } from './definition.ts';

export const SIZE = 10;
export const FLEET = [
  { key: 'carrier', name: 'ناو هواپیمابر', len: 5 },
  { key: 'battleship', name: 'رزمناو', len: 4 },
  { key: 'cruiser', name: 'ناوشکن', len: 3 },
  { key: 'submarine', name: 'زیردریایی', len: 3 },
  { key: 'patrol', name: 'قایق گشتی', len: 2 }
] as const;
export type Dir = 'h' | 'v';
export interface Ship { ship: number; x: number; y: number; dir: Dir }
export interface Sea { ships: Ship[]; shots: number[] }
export interface BsState {
  phase: 'place' | 'fire';
  seas: Sea[];
  placed: boolean[];
  current: number;
  first: number;
  last: { seat: number; cell: number; hit: boolean; sunk: number | null } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
/** What a viewer may see of a sea: own ships fully; opponent ships only once sunk. */
export interface SeaView { ships: Ship[]; shots: { cell: number; hit: boolean }[]; sunk: number[]; afloat: number }
export type BsView = Omit<BsState, 'seas' | 'timeouts'> & { seas: SeaView[] };

const ship = z.strictObject({ ship: z.number().int().min(0).max(4), x: z.number().int().min(0).max(9), y: z.number().int().min(0).max(9), dir: z.enum(['h', 'v']) });
export const bsAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('place'), ships: z.array(ship).length(5) }),
  z.strictObject({ type: z.literal('placeRandom') }),
  z.strictObject({ type: z.literal('fire'), cell: z.number().int().min(0).max(SIZE * SIZE - 1) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type BsAction = z.infer<typeof bsAction>;

/** Cells covered by a ship, or null if it leaves the sea. */
export function cellsOf(s: Ship): number[] | null {
  const len = FLEET[s.ship]!.len;
  const out: number[] = [];
  for (let k = 0; k < len; k++) {
    const x = s.x + (s.dir === 'h' ? k : 0), y = s.y + (s.dir === 'v' ? k : 0);
    if (x >= SIZE || y >= SIZE) return null;
    out.push(y * SIZE + x);
  }
  return out;
}
/** A fleet is valid when it has each of the five ships once, inside the sea, without overlaps. */
export function validFleet(ships: Ship[]) {
  if (ships.length !== FLEET.length || new Set(ships.map((s) => s.ship)).size !== FLEET.length) return false;
  const used = new Set<number>();
  for (const s of ships) {
    const cells = cellsOf(s);
    if (!cells || cells.some((c) => used.has(c))) return false;
    cells.forEach((c) => used.add(c));
  }
  return true;
}
export function randomFleet(rng: EngineRng): Ship[] {
  for (;;) {
    const ships: Ship[] = [];
    const used = new Set<number>();
    let ok = true;
    for (let i = 0; i < FLEET.length && ok; i++) {
      ok = false;
      for (let tries = 0; tries < 200; tries++) {
        const s: Ship = { ship: i, x: rng.nextInt(SIZE), y: rng.nextInt(SIZE), dir: rng.nextInt(2) ? 'h' : 'v' };
        const cells = cellsOf(s);
        if (cells && !cells.some((c) => used.has(c))) { cells.forEach((c) => used.add(c)); ships.push(s); ok = true; break; }
      }
    }
    if (ok) return ships;
  }
}
export const isSunk = (sea: Pick<Sea, 'shots'>, s: Ship) => cellsOf(s)!.every((c) => sea.shots.includes(c));
const shipAt = (sea: Sea, cell: number) => sea.ships.find((s) => cellsOf(s)!.includes(cell)) ?? null;

type Events = Transition<BsState>['internalEvents'];
const finish = (s: BsState, events: Events): Transition<BsState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const win = (s: BsState, seat: number, reason: Outcome['reason']) => { s.outcome = { placements: [{ seat, place: 1 }, { seat: 1 - seat, place: 2 }], reason }; };

function placeFor(s: BsState, seat: number, ships: Ship[]) {
  s.seas[seat]!.ships = ships;
  s.placed[seat] = true;
  if (s.placed.every(Boolean)) { s.phase = 'fire'; s.current = s.first; }
}

export const bsModule: GameModule<BsState, BsAction, BsView> = {
  manifest: battleship.manifest,
  actionSchema: bsAction,

  setup({ rng, options }) {
    const first = rng.nextInt(2);
    const s: BsState = {
      phase: 'place', seas: [{ ships: [], shots: [] }, { ships: [], shots: [] }], placed: [false, false], current: first, first,
      last: null, seq: 0, timeouts: [0, 0], outcome: null
    };
    if (options.deal === 'tutorial') {
      // A late battle, both fleets already placed. The opponent has lost carrier, battleship and cruiser; the
      // submarine (column 7, rows ث–چ) and the patrol boat (row ج, columns 2–3) are still afloat. The learner's
      // carrier on row ب is already hit twice.
      s.seas[0]!.ships = [
        { ship: 0, x: 1, y: 1, dir: 'h' }, { ship: 1, x: 8, y: 2, dir: 'v' }, { ship: 2, x: 2, y: 6, dir: 'h' },
        { ship: 3, x: 6, y: 8, dir: 'h' }, { ship: 4, x: 0, y: 4, dir: 'v' }
      ];
      s.seas[0]!.shots = [12, 13, 0, 35, 77, 91, 54, 23];
      s.seas[1]!.ships = [
        { ship: 0, x: 0, y: 0, dir: 'h' }, { ship: 1, x: 9, y: 0, dir: 'v' }, { ship: 2, x: 2, y: 8, dir: 'h' },
        { ship: 3, x: 6, y: 4, dir: 'v' }, { ship: 4, x: 1, y: 5, dir: 'h' }
      ];
      s.seas[1]!.shots = [0, 1, 2, 3, 4, 9, 19, 29, 39, 82, 83, 84, 22, 25, 33, 37, 44, 63, 68, 71, 75, 77, 88, 91, 15, 59, 31, 97, 53];
      s.placed = [true, true]; s.phase = 'fire'; s.first = 0; s.current = 0;
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat > 1) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    const seat = actor.seat;
    switch (a.type) {
      case 'resign': return { ok: true };
      case 'place': case 'placeRandom':
        if (s.phase !== 'place' || s.placed[seat]) return { ok: false, errorCode: 'ALREADY_PLACED' };
        return a.type === 'placeRandom' || validFleet(a.ships) ? { ok: true } : { ok: false, errorCode: 'INVALID_FLEET' };
      case 'fire':
        if (s.phase !== 'fire' || s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
        return s.seas[1 - seat]!.shots.includes(a.cell) ? { ok: false, errorCode: 'ALREADY_SHOT' } : { ok: true };
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    s.seq += 1;
    if (a.type === 'resign') { win(s, 1 - seat, 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    if (a.type === 'place') placeFor(s, seat, a.ships);
    else if (a.type === 'placeRandom') placeFor(s, seat, randomFleet(ctx.rng));
    else {
      const sea = s.seas[1 - seat]!;
      sea.shots.push(a.cell);
      const target = shipAt(sea, a.cell);
      const sunk = target && isSunk(sea, target) ? target.ship : null;
      s.last = { seat, cell: a.cell, hit: !!target, sunk };
      if (sea.ships.every((x) => isSunk(sea, x))) win(s, seat, 'win');
      else s.current = 1 - seat;
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    const { seas, timeouts: _t, ...rest } = structuredClone(s);
    return {
      ...rest,
      seas: seas.map((sea, k) => {
        const sunkShips = sea.ships.filter((x) => isSunk(sea, x));
        return {
          ships: k === me || s.outcome ? sea.ships : sunkShips,
          shots: sea.shots.map((cell) => ({ cell, hit: !!shipAt(sea, cell) })),
          sunk: sunkShips.map((x) => x.ship),
          afloat: sea.ships.length - sunkShips.length
        };
      })
    };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.phase === 'place' && !s.placed[seat]) out.push({ type: 'place' }, { type: 'placeRandom' });
    if (s.phase === 'fire' && s.current === seat) out.push({ type: 'fire' });
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seats = bsModule.pendingSeats(s);
    const missed = seats.map((k) => s.timeouts[k]! + 1);
    for (const seat of seats) {
      if (s.outcome) break;
      const a: BsAction = s.phase === 'place' ? { type: 'placeRandom' }
        : { type: 'fire', cell: Array.from({ length: SIZE * SIZE }, (_, i) => i).find((c) => !s.seas[1 - seat]!.shots.includes(c))! };
      bsModule.apply(s, { kind: 'player', seat }, a, ctx);
    }
    seats.forEach((k, i) => { s.timeouts[k] = missed[i]!; });
    return { ...finish(s, []), internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : s.phase === 'place' ? [0, 1].filter((k) => !s.placed[k]) : [s.current]),

  tutorial: {
    seed: 7,
    options: { deal: 'tutorial' },
    introFa: 'نبرد به آخرش نزدیک است. هر دو ناوگان چیده شده و نوبت شلیک شماست. سه کشتی حریف غرق شده و فقط زیردریایی (۳ خانه) و قایق گشتی (۲ خانه) مانده‌اند. در هر نوبت یک شلیک می‌کنید: «آب» یعنی خطا، «اصابت» یعنی به کشتی خورده است، و وقتی همهٔ خانه‌های کشتی بخورد غرق می‌شود.',
    steps: [
      { instructionFa: 'به خانهٔ روشن در دریای حریف (ج۷) شلیک کنید.', expected: { type: 'fire', cell: 56 }, reply: { type: 'fire', cell: 14 } },
      { instructionFa: 'اصابت! ولی نمی‌دانید کشتی افقی است یا عمودی. خانهٔ کنارش در همان سطر (ج۸) را امتحان کنید.', expected: { type: 'fire', cell: 57 }, reply: { type: 'fire', cell: 15 } },
      { instructionFa: '«آب» بود، پس کشتی احتمالاً در این سطر ادامه ندارد. خانهٔ کنارش در همان ستون (ث۷) را بزنید. حواستان به دریای خودتان هم باشد: حریف چهار خانه از ناو هواپیمابر پنج‌خانه‌ای شما را زده است.', expected: { type: 'fire', cell: 46 }, reply: { type: 'fire', cell: 11 } },
      { instructionFa: 'دومین اصابت: کشتی در ستون ۷ عمودی است. حریف هم ناو هواپیمابر شما را غرق کرد! زیردریایی سه خانه است؛ خانهٔ سوم (چ۷) را بزنید تا غرق شود.', expected: { type: 'fire', cell: 66 }, reply: { type: 'fire', cell: 49 } },
      { instructionFa: 'زیردریایی غرق شد و جای کاملش روی دریا پیدا شد. فقط قایق گشتی دوخانه‌ای مانده؛ خانهٔ ج۳ را بزنید.', expected: { type: 'fire', cell: 52 }, reply: { type: 'fire', cell: 38 } },
      { instructionFa: 'اصابت! در ج۴ قبلاً آب خورده‌اید، پس خانهٔ دیگر قایق در همان سطر به سمت دیگر است: ج۲ را بزنید تا آخرین کشتی حریف غرق شود.', expected: { type: 'fire', cell: 51 }, reply: null }
    ],
    completedFa: 'بردید! با غرق شدن قایق گشتی هر پنج کشتی حریف غرق شد. حریف در همین مدت ناو هواپیمابر شما را غرق کرد و به رزمناوتان هم زد، ولی چهار کشتی شما هنوز شناور بود. از هر اصابت با شلیک به خانه‌های کناری جهت کشتی را پیدا کنید و در همان امتداد ادامه دهید.'
  }
};
