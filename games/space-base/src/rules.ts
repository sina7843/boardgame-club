// Space Base («پایگاه فضایی»), 2–5 players. Each player has 12 sectors with a starting ship. Turn: roll 2d6, choose
// "separate" (sectors d1 and d2) or "sum" (sector d1+d2) — the same choice applies to everyone. The active player
// gets the blue reward of each activated sector's station ship; every other player gets the red rewards of the
// ships deployed in those sectors. Then buy at most one ship from the three shop rows (6 face-up per level): it
// becomes the station of its sector and the old station is deployed. End of turn: credits rise to income. The game
// ends after the turn in which someone reaches 40 VP (most VP wins, ties share). Simplification: ship list is
// generated (sector × level with original names), no charge/colony cards; everyone follows the roller's choice.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { spaceBase } from './definition.ts';

export interface Reward { credits?: number; vp?: number }
export interface Ship { id: number; name: string; sector: number; level: 0 | 1 | 2 | 3; cost: number; blue: Reward; red: Reward; onBuy?: { income?: number; vp?: number } }
const NAMES = ['کاوشگر', 'باربر', 'معدنچی', 'نگهبان', 'ناو پژوهش', 'یدک‌کش', 'شاتل', 'ایستگاه', 'ناو مهندسی', 'رزمناو', 'کشتی کاروان', 'ناو ستاره‌ای'];
const rarity = (sec: number) => [0, 2, 2, 2, 2, 2, 2, 1, 1, 2, 3, 4, 5][sec]!; // rarer sectors pay more
export const SHIPS: Ship[] = (() => {
  const out: Ship[] = [];
  for (let sector = 1; sector <= 12; sector++) out.push({ id: out.length, name: `ناو آغازین ${sector.toLocaleString('fa-IR')}`, sector, level: 0, cost: 0, blue: { credits: sector <= 6 ? 1 : rarity(sector) }, red: { credits: 1 } });
  for (const level of [1, 2, 3] as const) {
    for (let sector = 1; sector <= 12; sector++) {
      for (let v = 0; v < 2; v++) {
        const r = rarity(sector);
        const name = `${NAMES[(sector + level * 3 + v * 5) % NAMES.length]} ${['', 'سبک', 'میانه', 'سنگین'][level]}`;
        const ship: Ship = level === 1
          ? { id: 0, name, sector, level, cost: 3 + v + (r > 2 ? 1 : 0), blue: { credits: 2 + r + v }, red: { credits: 1 + (v && r > 2 ? 1 : 0) }, ...(v ? {} : { onBuy: { income: 1 } }) }
          : level === 2
            ? { id: 0, name, sector, level, cost: 7 + v + (r > 2 ? 1 : 0), blue: v ? { credits: 3 + r } : { credits: 2, vp: 1 + (r > 2 ? 1 : 0) }, red: v ? { credits: 2 } : { vp: 1 }, onBuy: v ? { income: 2 } : { vp: 1 } }
            : { id: 0, name, sector, level, cost: 12 + v * 2, blue: { vp: 2 + Math.min(r, 3) + v }, red: { vp: 1 + v }, onBuy: { vp: 3 + v } };
        out.push({ ...ship, id: out.length });
      }
    }
  }
  return out;
})();

/** Tutorial purchase: the first mid-level ship of sector 5 (+1 VP when bought). */
export const TUTORIAL_BUY = SHIPS.find((x) => x.level === 2 && x.sector === 5 && x.onBuy?.vp === 1)!.id;

export interface Board { station: number[]; deployed: number[][]; credits: number; income: number; vp: number }
export interface SbState {
  boards: Board[];
  decks: number[][];
  shop: number[][];
  current: number;
  phase: 'roll' | 'choose' | 'buy';
  dice: [number, number] | null;
  gains: { seat: number; credits: number; vp: number }[];
  fixedDice: [number, number][];
  last: { seat: number; kind: string; ship?: number } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type SbView = Omit<SbState, 'decks' | 'fixedDice' | 'timeouts'> & { deckCounts: number[] };
export const GOAL = 40;

export const sbAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('roll') }),
  z.strictObject({ type: z.literal('choose'), use: z.enum(['separate', 'sum']) }),
  z.strictObject({ type: z.literal('buy'), ship: z.number().int().min(0).max(200) }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type SbAction = z.infer<typeof sbAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
type Events = Transition<SbState>['internalEvents'];
const finish = (s: SbState, events: Events): Transition<SbState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
function rank(s: SbState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, p: s.boards[seat]!.vp })).sort((a, b) => b.p - a.p);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.p === x.p ? out[i - 1]!.place : i + 1, score: x.p }); });
  return out;
}
const refill = (s: SbState) => s.shop.forEach((row, l) => { while (row.length < 6 && s.decks[l]!.length) row.push(s.decks[l]!.shift()!); });
export const sectorsFor = (d: [number, number], use: 'separate' | 'sum') => (use === 'sum' ? [d[0] + d[1]] : [d[0], d[1]]);

function activate(s: SbState, sectors: number[]) {
  s.gains = s.boards.map((b, seat) => {
    let credits = 0, vp = 0;
    for (const sec of sectors) {
      const rewards = seat === s.current ? [SHIPS[b.station[sec - 1]!]!.blue] : b.deployed[sec - 1]!.map((id) => SHIPS[id]!.red);
      for (const r of rewards) { credits += r.credits ?? 0; vp += r.vp ?? 0; }
    }
    b.credits += credits; b.vp += vp;
    return { seat, credits, vp };
  });
}

function endTurn(s: SbState) {
  const b = s.boards[s.current]!;
  b.credits = Math.max(b.credits, b.income);
  if (s.boards.some((x) => x.vp >= GOAL)) { s.outcome = { placements: rank(s, s.boards.map((_, k) => k)), reason: 'score' }; return; }
  s.current = (s.current + 1) % s.boards.length;
  s.phase = 'roll'; s.dice = null;
}

export const sbModule: GameModule<SbState, SbAction, SbView> = {
  manifest: spaceBase.manifest,
  actionSchema: sbAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 5) throw new Error('space base needs 2–5 players');
    const decks = [1, 2, 3].map((l) => shuffle(rng, SHIPS.filter((x) => x.level === l).map((x) => x.id)));
    const first = rng.nextInt(playerCount);
    const s: SbState = {
      boards: Array.from({ length: playerCount }, (_, k) => ({
        station: SHIPS.filter((x) => x.level === 0).map((x) => x.id), deployed: Array.from({ length: 12 }, () => []),
        credits: 3 + ((k - first + playerCount) % playerCount), income: 0, vp: 0
      })),
      decks, shop: [[], [], []], current: first, phase: 'roll', dice: null, gains: [], fixedDice: [], last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    refill(s);
    if (options.deal === 'tutorial') {
      // The learner's winning turn: dice 3 + 4. Separately, sectors 3 and 4 hold starting ships (+1 credit each); as a
      // sum, sector 7 holds a heavy ship (+3 VP). The opponent has two ships deployed in sector 7, so the sum also pays
      // them their red rewards. Buying the mid-level sector-5 ship (+1 VP) deploys the old sector-5 station.
      const take = (id: number) => { s.decks = s.decks.map((d) => d.filter((x) => x !== id)); s.shop = s.shop.map((r) => r.filter((x) => x !== id)); };
      const ship = (level: number, sector: number, v: 0 | 1) => SHIPS.filter((x) => x.level === level && x.sector === sector)[v]!.id;
      const seven = ship(3, 7, 0), oppStation = ship(3, 7, 1), oppDeployed = ship(2, 7, 0);
      [TUTORIAL_BUY, seven, oppStation, oppDeployed].forEach(take);
      refill(s);
      s.current = 0;
      s.fixedDice = [[3, 4]];
      Object.assign(s.boards[0]!, { vp: 36, credits: 9, income: 4 });
      s.boards[0]!.station[6] = seven;
      Object.assign(s.boards[1]!, { vp: 33, credits: 6, income: 2 });
      s.boards[1]!.station[6] = oppStation;
      s.boards[1]!.deployed[6] = [6, oppDeployed];
      const row = [TUTORIAL_BUY, ...s.shop[1]!];
      s.shop[1] = row.slice(0, 6);
      s.decks[1]!.unshift(...row.slice(6));
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.boards.length) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.current !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    switch (a.type) {
      case 'roll': return s.phase === 'roll' ? { ok: true } : { ok: false, errorCode: 'ALREADY_ROLLED' };
      case 'choose': return s.phase === 'choose' ? { ok: true } : { ok: false, errorCode: 'ROLL_FIRST' };
      case 'pass': return s.phase === 'buy' ? { ok: true } : { ok: false, errorCode: 'NOT_NOW' };
      case 'buy':
        if (s.phase !== 'buy') return { ok: false, errorCode: 'NOT_NOW' };
        if (!s.shop.some((row) => row.includes(a.ship))) return { ok: false, errorCode: 'NOT_IN_SHOP' };
        return SHIPS[a.ship]!.cost <= s.boards[actor.seat]!.credits ? { ok: true } : { ok: false, errorCode: 'CANNOT_AFFORD' };
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    s.seq += 1;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.boards.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.boards.length, score: s.boards[seat]!.vp }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    const b = s.boards[seat]!;
    switch (a.type) {
      case 'roll':
        s.dice = s.fixedDice.shift() ?? [1 + ctx.rng.nextInt(6), 1 + ctx.rng.nextInt(6)];
        s.phase = 'choose'; s.gains = [];
        break;
      case 'choose':
        activate(s, sectorsFor(s.dice!, a.use));
        s.phase = 'buy';
        s.last = { seat, kind: a.use };
        break;
      case 'buy': {
        const ship = SHIPS[a.ship]!;
        s.shop = s.shop.map((row) => row.filter((x) => x !== a.ship));
        refill(s);
        b.credits -= ship.cost;
        b.deployed[ship.sector - 1]!.push(b.station[ship.sector - 1]!);
        b.station[ship.sector - 1] = a.ship;
        b.income += ship.onBuy?.income ?? 0;
        b.vp += ship.onBuy?.vp ?? 0;
        s.last = { seat, kind: 'buy', ship: a.ship };
        endTurn(s);
        break;
      }
      case 'pass': s.last = { seat, kind: 'pass' }; endTurn(s); break;
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { decks, fixedDice: _f, timeouts: _t, ...rest } = structuredClone(s);
    return { ...rest, deckCounts: decks.map((d) => d.length) };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    if (s.current === viewer.seat) {
      if (s.phase === 'roll') out.push({ type: 'roll' });
      if (s.phase === 'choose') out.push({ type: 'choose', use: 'separate' }, { type: 'choose', use: 'sum' });
      if (s.phase === 'buy') {
        s.shop.flat().forEach((ship) => { if (SHIPS[ship]!.cost <= s.boards[viewer.seat]!.credits) out.push({ type: 'buy', ship }); });
        out.push({ type: 'pass' });
      }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    const run = (a: SbAction) => sbModule.apply(s, { kind: 'player', seat }, a, ctx);
    if (s.phase === 'roll') run({ type: 'roll' });
    if (s.phase === 'choose') run({ type: 'choose', use: 'sum' });
    if (s.phase === 'buy' && !s.outcome) run({ type: 'pass' });
    s.timeouts[seat] = missed;
    return { ...finish(s, []), internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 23,
    options: { deal: 'tutorial' },
    introFa: 'آخر یک بازی دونفره است: شما ۳۶ امتیاز، ۹ اعتبار و درآمد ۴ دارید و حریف ۳۳ امتیاز. هر کدام ۱۲ بخش دارید (۱ تا ۱۲) و در هر بخش یک ناو مستقر. در بخش ۷ ناو سنگینی دارید که در نوبت خودتان ۳ امتیاز می‌دهد. اولین کسی که به ۴۰ امتیاز برسد، بازی در پایان همان نوبت تمام می‌شود.',
    steps: [
      { instructionFa: 'تاس‌ها را بریزید. دو تاس شش‌وجهی دو بخش جدا یا جمعشان یک بخش را فعال می‌کند و انتخاب با کسی است که تاس ریخته است.', expected: { type: 'roll' }, reply: null },
      { instructionFa: '۳ و ۴ آمد. بخش‌های ۳ و ۴ جدا هر کدام ۱ اعتبار می‌دهند، ولی جمع، بخش ۷ را فعال می‌کند: ناو مستقر شما (پاداش آبی) ۳ امتیاز می‌دهد. جمع را انتخاب کنید. همین انتخاب برای حریف هم اعمال می‌شود: ناوهای اعزام‌شدهٔ او در بخش ۷ پاداش قرمزشان را می‌گیرند (۱ اعتبار و ۱ امتیاز).', expected: { type: 'choose', use: 'sum' }, reply: null },
      { instructionFa: 'حالا ۳۹ امتیاز دارید. می‌توانید یک ناو بخرید یا بگذرید. ناو میانهٔ بخش ۵ را که در بازار برجسته است بخرید (۷ اعتبار): خریدش ۱ امتیاز می‌دهد، جای ناو مستقر بخش ۵ را می‌گیرد و ناو قبلی اعزام می‌شود تا از این به بعد در نوبت دیگران پاداش قرمز بدهد.', expected: { type: 'buy', ship: TUTORIAL_BUY }, reply: null }
    ],
    completedFa: 'بردید! ۳۶ امتیاز + ۳ امتیاز از ناو بخش ۷ + ۱ امتیاز خرید ناو = ۴۰، پس بازی در پایان همین نوبت تمام شد. حریف با پاداش قرمز بخش ۷ از ۳۳ به ۳۴ رسید. اعتبارتان بعد از خرید ۲ ماند و در پایان نوبت تا درآمدتان، ۴، بالا رفت؛ در بازی واقعی همین قاعده نمی‌گذارد دستتان خالی بماند.'
  }
};
