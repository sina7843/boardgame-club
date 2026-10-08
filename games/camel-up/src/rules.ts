// Camel Up («مسابقهٔ شترها»), 2–8 players, first edition without crazy camels. Five camels race on 16 spaces and
// stack; a moving camel carries everything on top of it. Five dice (one per camel, faces 1–3) in the pyramid. A turn:
// take the top leg-bet tile of a camel (5, 3, 2); place your desert tile (oasis +1 / mirage −1; not on space 1, not
// on or next to another tile, not under camels); roll a random pyramid die (+1 coin; that camel moves 1–3); or secretly
// bet one of your five camel cards on the overall winner or loser. Landing on a tile pays its owner 1 and moves the
// stack +1 (on top) or −1 (underneath). A leg ends when all five dice are out: leg bets pay their value for the leader,
// 1 for the runner-up and −1 otherwise; dice and desert tiles reset. A camel crossing space 16 ends the game: the leg
// is scored, then overall bets in placing order 8, 5, 3, 2, 1, 1… (wrong −1). Everyone starts with 3 coins.
// Hidden: the order of overall bets and which camels they back until the end.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { camelUp } from './definition.ts';

export const CAMELS = ['blue', 'green', 'orange', 'yellow', 'white'] as const;
export type Camel = (typeof CAMELS)[number];
export const TRACK = 16;
const OVERALL = [8, 5, 3, 2, 1];

export interface CamelState {
  players: number;
  /** Stacks per space 1..16, bottom → top. */
  spaces: Record<number, Camel[]>;
  dice: Camel[];
  rolled: { camel: Camel; value: number }[];
  legTiles: Record<Camel, number[]>;
  legBets: { camel: Camel; value: number }[][];
  pyramid: number[];
  desert: ({ space: number; oasis: boolean } | null)[];
  winnerBets: { seat: number; camel: Camel }[];
  loserBets: { seat: number; camel: Camel }[];
  coins: number[];
  current: number;
  leg: number;
  log: { leg: number; gains: number[] }[];
  last: { seat: number; kind: string; camel?: Camel; value?: number; to?: number } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface CamelView extends Omit<CamelState, 'dice' | 'winnerBets' | 'loserBets' | 'timeouts'> {
  diceLeft: number;
  winnerCount: number;
  loserCount: number;
  /** Your own overall bets (all bets once the game is over). */
  myOverall: { which: 'win' | 'lose'; camel: Camel }[];
  usedCards: Camel[];
  finalBets: { winner: CamelState['winnerBets']; loser: CamelState['loserBets'] } | null;
  ranking: Camel[];
}

const camel = z.enum(CAMELS);
export const camelAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('roll') }),
  z.strictObject({ type: z.literal('leg'), camel }),
  z.strictObject({ type: z.literal('desert'), space: z.number().int().min(2).max(TRACK), oasis: z.boolean() }),
  z.strictObject({ type: z.literal('overall'), camel, which: z.enum(['win', 'lose']) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type CamelAction = z.infer<typeof camelAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
export const posOf = (s: Pick<CamelState, 'spaces'>, c: Camel) => Number(Object.keys(s.spaces).find((k) => s.spaces[Number(k)]!.includes(c)));
/** Camels from first to last. */
export function ranking(s: Pick<CamelState, 'spaces'>): Camel[] {
  return Object.keys(s.spaces).map(Number).sort((a, b) => b - a).flatMap((k) => s.spaces[k]!.slice().reverse());
}

// ---------- module ----------

type Events = Transition<CamelState>['internalEvents'];
const finish = (s: CamelState, events: Events): Transition<CamelState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: CamelState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, p: s.coins[seat]! })).sort((a, b) => b.p - a.p);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.p === x.p ? out[i - 1]!.place : i + 1, score: x.p }); });
  return out;
}

const tileAt = (s: CamelState, space: number) => s.desert.findIndex((d) => d?.space === space);

function move(s: CamelState, c: Camel, by: number): boolean {
  const from = posOf(s, c);
  const stack = s.spaces[from]!;
  const moving = stack.splice(stack.indexOf(c));
  if (!stack.length) delete s.spaces[from];
  let to = from + by;
  let under = false;
  const t = tileAt(s, to);
  if (t >= 0) { s.coins[t]! += 1; if (s.desert[t]!.oasis) to += 1; else { to -= 1; under = true; } }
  const dest = s.spaces[to] ?? [];
  s.spaces[to] = under ? [...moving, ...dest] : [...dest, ...moving];
  return to > TRACK;
}

function scoreLeg(s: CamelState) {
  const r = ranking(s);
  const gains = s.coins.map(() => 0);
  s.legBets.forEach((bets, k) => bets.forEach((b) => { gains[k]! += b.camel === r[0] ? b.value : b.camel === r[1] ? 1 : -1; }));
  gains.forEach((g, k) => { s.coins[k] = Math.max(0, s.coins[k]! + g); });
  s.log.push({ leg: s.leg, gains });
}

function newLeg(s: CamelState) {
  s.dice = CAMELS.slice();
  s.rolled = [];
  s.legTiles = Object.fromEntries(CAMELS.map((c) => [c, [5, 3, 2]])) as Record<Camel, number[]>;
  s.legBets = s.coins.map(() => []);
  s.pyramid = s.coins.map(() => 0);
  s.desert = s.coins.map(() => null);
  s.leg += 1;
}

function endGame(s: CamelState) {
  scoreLeg(s);
  const r = ranking(s);
  const pay = (bets: CamelState['winnerBets'], target: Camel) => {
    let i = 0;
    for (const b of bets) { if (b.camel === target) { s.coins[b.seat]! += OVERALL[i] ?? 1; i += 1; } else s.coins[b.seat] = Math.max(0, s.coins[b.seat]! - 1); }
  };
  pay(s.winnerBets, r[0]!);
  pay(s.loserBets, r[r.length - 1]!);
  s.outcome = { placements: rank(s, s.coins.map((_, k) => k)), reason: 'score' };
}

export function desertOk(s: CamelState, seat: number, space: number) {
  if (space < 2 || space > TRACK || s.spaces[space]?.length) return false;
  return s.desert.every((d, k) => k === seat || !d || Math.abs(d.space - space) > 1);
}

export const camelModule: GameModule<CamelState, CamelAction, CamelView> = {
  manifest: camelUp.manifest,
  actionSchema: camelAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 8) throw new Error('camel up needs 2–8 players');
    const s = { players: playerCount, spaces: {}, winnerBets: [], loserBets: [], coins: Array(playerCount).fill(3), current: rng.nextInt(playerCount), leg: 0, log: [], last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null } as unknown as CamelState;
    newLeg(s);
    for (const c of shuffle(rng, CAMELS.slice())) { const at = 1 + rng.nextInt(3); s.spaces[at] = [...(s.spaces[at] ?? []), c]; }
    if (options.deal === 'tutorial') {
      s.current = 0;
      s.spaces = { 10: ['white', 'yellow'], 12: ['green'], 13: ['orange'], 16: ['blue'] };
      s.dice = ['blue'];
      s.rolled = CAMELS.filter((c) => c !== 'blue').map((camel) => ({ camel, value: 2 }));
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    switch (a.type) {
      case 'roll': return { ok: true };
      case 'leg': return s.legTiles[a.camel].length ? { ok: true } : { ok: false, errorCode: 'NO_TILES_LEFT' };
      case 'desert': return desertOk(s, seat, a.space) ? { ok: true } : { ok: false, errorCode: 'BAD_SPACE' };
      case 'overall': return [...s.winnerBets, ...s.loserBets].some((b) => b.seat === seat && b.camel === a.camel) ? { ok: false, errorCode: 'CARD_USED' } : { ok: true };
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.coins.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: s.coins[seat]! }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    switch (a.type) {
      case 'leg': s.legBets[seat]!.push({ camel: a.camel, value: s.legTiles[a.camel].shift()! }); s.last = { seat, kind: 'leg', camel: a.camel }; break;
      case 'desert': s.desert[seat] = { space: a.space, oasis: a.oasis }; s.last = { seat, kind: a.oasis ? 'oasis' : 'mirage', to: a.space }; break;
      case 'overall': (a.which === 'win' ? s.winnerBets : s.loserBets).push({ seat, camel: a.camel }); s.last = { seat, kind: 'overall' }; break;
      case 'roll': {
        const c = s.dice.splice(ctx.rng.nextInt(s.dice.length), 1)[0]!;
        const value = 1 + ctx.rng.nextInt(3);
        s.coins[seat]! += 1;
        s.pyramid[seat]! += 1;
        s.rolled.push({ camel: c, value });
        s.last = { seat, kind: 'roll', camel: c, value };
        if (move(s, c, value)) { endGame(s); return finish(s, [{ type: 'roll', seat }]); }
        if (!s.dice.length) { scoreLeg(s); newLeg(s); }
        break;
      }
    }
    s.current = (seat + 1) % s.players;
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    const { dice, winnerBets, loserBets, timeouts: _t, ...rest } = structuredClone(s);
    const mine = [...winnerBets.map((b) => ({ ...b, which: 'win' as const })), ...loserBets.map((b) => ({ ...b, which: 'lose' as const }))].filter((b) => b.seat === me);
    return {
      ...rest, diceLeft: dice.length, winnerCount: winnerBets.length, loserCount: loserBets.length, myOverall: mine.map(({ which, camel: c }) => ({ which, camel: c })),
      usedCards: mine.map((b) => b.camel), finalBets: s.outcome ? { winner: winnerBets, loser: loserBets } : null, ranking: ranking(s)
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    if (s.current === viewer.seat) {
      out.push({ type: 'roll' });
      for (const c of CAMELS) if (s.legTiles[c].length) out.push({ type: 'leg', camel: c, value: s.legTiles[c][0] });
      const spaces = Array.from({ length: TRACK - 1 }, (_, i) => i + 2).filter((sp) => desertOk(s, viewer.seat, sp));
      if (spaces.length) out.push({ type: 'desert', spaces });
      const used = [...s.winnerBets, ...s.loserBets].filter((b) => b.seat === viewer.seat).map((b) => b.camel);
      if (used.length < 5) out.push({ type: 'overall', cards: CAMELS.filter((c) => !used.includes(c)) });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    const t = camelModule.apply(s, { kind: 'player', seat }, { type: 'roll' }, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 59,
    options: { deal: 'tutorial' },
    introFa: 'شتر آبی روی آخرین خانه است و فقط تاس آبی در هرم مانده: تاس بعدی مسابقه را تمام می‌کند.',
    steps: [
      { instructionFa: 'مخفیانه شرط ببندید که آبی برندهٔ کل مسابقه است.', expected: { type: 'overall', camel: 'blue', which: 'win' }, reply: { type: 'leg', camel: 'green' } },
      { instructionFa: 'حریف روی سبز شرط مرحله بست. شما کارت ۵ سکه‌ای آبی را بردارید.', expected: { type: 'leg', camel: 'blue' }, reply: { type: 'roll' } }
    ],
    completedFa: 'بردید! آبی از خط گذشت: ۵ سکه شرط مرحله و ۸ سکه شرط برندهٔ نهایی.'
  }
};
