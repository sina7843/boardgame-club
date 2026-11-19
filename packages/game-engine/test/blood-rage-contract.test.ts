// Blood Rage: the ENGINE.md contract (contract.ts) — mock-state parity, action translation, error codes, privacy,
// and random playouts driven only by the contract hints.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  bloodRageModule, CARD_BY_ID, content, contractHints, NUM_PROV, PROV_NUM, slotMap, SLOT_PROVINCE,
  type BloodRageView, type BRState, type Figure, type ProvinceId
} from '@bg/game-blood-rage';
import { applyAction, projectFor, startGame, type EngineSnapshot } from '../src/index.ts';

const m = bloodRageModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (snap: EngineSnapshot) => snap.state as BRState;
const view = (snap: EngineSnapshot, seat: number | null) => projectFor(m, snap, seat === null ? { kind: 'spectator' } : p(seat)).view as BloodRageView;
const tryAct = (snap: EngineSnapshot, seat: number, action: unknown) => applyAction(m, snap, p(seat), action as never, 0);
function act(snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot {
  const r = tryAct(snap, seat, action);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
}
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => { const r = tryAct(snap, seat, action); return 'ok' in r ? r.errorCode : 'ACCEPTED'; };

interface MockFigure { id: string; seat: number; kind: Figure['kind']; monster: number | null; where: string }
interface MockState {
  players: number; clans: number[]; age: 1 | 2 | 3; first: number; turn: number; ragnarok: number[]; destroyed: number[];
  pillage: Record<string, { reward: string; pillaged: boolean; by?: number }>; stats: { rage: number; axe: number; horn: number }[];
  rage: number[]; glory: number[]; passed: boolean[]; hands: number[][]; quests: number[][];
  upgrades: { leader: number | null; warrior: number | null; ship: number | null; monster: (number | null)[]; clan: (number | null)[] }[];
  figures: MockFigure[];
}
const MOCK = JSON.parse(readFileSync(new URL('../../../design/games/blood-rage/data/mock-state.json', import.meta.url), 'utf8')) as { main: MockState; mainHints: unknown[] };
const REWARD: Record<string, BRState['rewards'][ProvinceId]> = { yggdrasil: 'all', rage: 'rage', axe: 'axes', horn: 'horns', glory: 'glory' };
const FJ = ['f1', 'f2', 'f3', 'f4'] as const;

/** ENGINE.md §2 state (mock-state.json) → the engine's internal state. */
function fromMock(mk: MockState): EngineSnapshot {
  const snap = startGame(m, { playerCount: mk.players, seed: 1, options: {} }).snapshot;
  const s = structuredClone(st(snap));
  Object.assign(s, { age: mk.age, step: 'action', first: mk.first, turn: mk.turn, spent: false, battle: null, queue: [], packs: s.packs.map(() => []) });
  s.clans.forEach((c, i) => {
    const u = mk.upgrades[i]!;
    Object.assign(c, {
      clan: mk.clans[i], rage: mk.rage[i], glory: mk.glory[i], passed: mk.passed[i], hand: [...mk.hands[i]!], quests: [...mk.quests[i]!],
      steps: { rage: mk.stats[i]!.rage, axes: mk.stats[i]!.axe, horns: mk.stats[i]!.horn },
      leader: u.leader, warrior: u.warrior, ship: u.ship, monsters: [...u.monster], clans: [...u.clan]
    });
  });
  s.rewards = Object.fromEntries(Object.entries(mk.pillage).map(([k, v]) => [NUM_PROV[Number(k)], REWARD[v.reward]])) as BRState['rewards'];
  s.pillaged = Object.entries(mk.pillage).filter(([, v]) => v.pillaged).map(([k]) => NUM_PROV[Number(k)]!);
  s.destroyed = mk.destroyed.map((n) => NUM_PROV[n]!);
  s.ragnarok = mk.ragnarok.map((n) => NUM_PROV[n]!);
  const max = Math.max(...mk.figures.map((f) => Number(f.id.slice(1))));
  s.figs = Array.from({ length: max + 1 }, (_, id): Figure => ({ id, seat: 0, kind: 'monster', mon: null, at: 'box' }));
  for (const f of mk.figures) {
    const id = Number(f.id.slice(1));
    const [k, n] = f.where.split(':');
    const at: Figure['at'] = f.where === 'yggdrasil' ? 'ygg' : k === 'fjord' ? FJ[Number(n)]! : k === 'village' ? SLOT_PROVINCE[Number(n)]! : f.where as Figure['at'];
    s.figs[id] = { id, seat: f.seat, kind: f.kind, mon: f.monster === null ? null : content.CARD_BY_NUM[f.monster]!.def, at, ...(k === 'village' ? { slot: Number(n) } : {}), ...(f.monster !== null ? { card: f.monster } : {}) };
  }
  return { ...snap, state: s };
}
const norm = (x: unknown): unknown => Array.isArray(x) ? x.map(norm) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, norm(v)])) : x;
const asSet = (xs: unknown[]) => xs.map((x) => JSON.stringify(norm(x))).sort();

describe('blood rage contract: mock-state parity', () => {
  it('legalActions(mock main, seat 0) equals mainHints as a set', () => {
    const snap = fromMock(MOCK.main);
    expect(asSet(contractHints(st(snap), p(0)))).toEqual(asSet(MOCK.mainHints));
  });
  it('the projection of mock main places every figure where mock-state says', () => {
    const snap = fromMock(MOCK.main);
    const v = view(snap, 0);
    for (const f of MOCK.main.figures) if (f.where !== 'reserve') expect(v.figures.find((x) => x.id === f.id)?.where, f.id).toBe(f.where);
    expect(v.pillage[8]).toEqual({ reward: 'horn', pillaged: true });
    expect(v.destroyed.sort()).toEqual([4, 6]);
    expect(v.doom).toBe(2);
  });
  it('the troll invasion from mainHints applies: the enemy warrior in Angerboda dies, rage 4 → 2', () => {
    let snap = fromMock(MOCK.main);
    snap = act(snap, 0, { type: 'invade', figure: 'f10', to: 'village:12' });
    const v = view(snap, 0);
    expect(v.figures.find((f) => f.id === 'f10')?.where).toBe('village:12');
    expect(v.figures.find((f) => f.id === 'f23')?.where).toBe('valhalla');
    expect(v.seats[0]!.rage).toBe(2);
  });
});

describe('blood rage contract: errors and privacy', () => {
  it('ENGINE §5 error codes', () => {
    const snap = fromMock(MOCK.main);
    expect(reject(snap, 0, { type: 'invade', figure: 'f4', to: 'village:8' })).toBe('VILLAGE_TAKEN');
    expect(reject(snap, 0, { type: 'invade', figure: 'f4', to: 'village:13' })).toBe('PROVINCE_DESTROYED');
    expect(reject(snap, 0, { type: 'invade', figure: 'f4', to: 'yggdrasil' })).toBe('YGGDRASIL_MARCH_ONLY');
    expect(reject(snap, 0, { type: 'invade', figure: 'f4', to: 'fjord:1' })).toBe('SHIP_FJORD_ONLY');
    expect(reject(snap, 0, { type: 'invade', figure: 'f1', to: 'village:2' })).toBe('NOT_IN_RESERVE');
    expect(reject(snap, 0, { type: 'march', from: 3, to: 3, figures: ['f1'] })).toBe('SAME_PROVINCE');
    expect(reject(snap, 0, { type: 'march', from: 3, to: 4, figures: ['f1'] })).toBe('PROVINCE_DESTROYED');
    expect(reject(snap, 0, { type: 'march', from: 3, to: 7, figures: ['f1', 'f2'] })).toBe('NOT_ENOUGH_VILLAGES');
    expect(reject(snap, 0, { type: 'quest', card: 44 })).toBe('NOT_QUEST_CARD');
    expect(reject(snap, 0, { type: 'upgrade', card: 44, slot: 'clan' })).toBe('NOT_UPGRADE_CARD');
    expect(reject(snap, 0, { type: 'upgrade', card: 63, slot: 'monster' })).toBe('SLOT_MISMATCH');
    expect(reject(snap, 0, { type: 'pillage', province: 8 })).toBe('ALREADY_PILLAGED');
    expect(reject(snap, 0, { type: 'pillage', province: 1 })).toBe('NO_PRESENCE');
    expect(reject(snap, 0, { type: 'decide', kind: 'raiseStat', choice: 'rage' })).toBe('WRONG_DECISION');
    expect(reject(snap, 1, { type: 'pass' })).toBe('NOT_YOUR_TURN');
  });
  it('a viewer sees its own hand and every hand count; spectators see no cards', () => {
    const snap = fromMock(MOCK.main);
    const v0 = view(snap, 0), spec = view(snap, null);
    expect(v0.me!.hand).toEqual([44, 39, 63, 61, 13]);
    expect(v0.seats.map((x) => x.handCount)).toEqual([5, 3, 5, 4]);
    expect(spec.me).toBeNull();
    expect(spec.seats[1]!.handCount).toBe(3);
    for (const c of MOCK.main.hands[1]!) expect(spec.defs[c]).toBeUndefined();
    expect(v0.defs[42]).toBeUndefined();
  });
});

// ---------- random playouts on the contract ----------
function mulberry(seed: number) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type Hint = { type: string; [k: string]: unknown };
function fromHint(s: BRState, seat: number, h: Hint, r: () => number): unknown {
  const pick = <X,>(xs: X[]): X => xs[Math.floor(r() * xs.length)]!;
  switch (h.type) {
    case 'draftPick': return { type: 'draftPick', cards: [...(h.cards as number[])].sort(() => r() - 0.5).slice(0, h.need as number) };
    case 'decide': {
      const choice = h.choice as unknown;
      if (h.kind === 'callToBattle' && choice && typeof choice === 'object') return { type: 'decide', kind: h.kind, choice: { ...choice, to: pick(h.targets as string[]) } };
      return { type: 'decide', kind: h.kind, choice };
    }
    case 'upgrade': {
      const d = CARD_BY_ID[s.inst[h.card as number]!]!;
      return { type: 'upgrade', card: h.card, slot: h.slot, ...(h.replace ? { index: Math.floor(r() * (d.kind === 'monster' ? 2 : 3)) } : {}) };
    }
    case 'clanAction': {
      if (h.target !== undefined) return { type: 'clanAction', card: h.card, target: h.target };
      const on = s.figs.filter((f) => f.seat === seat && f.at !== 'reserve' && f.at !== 'valhalla' && f.at !== 'box');
      const stat = (['rage', 'axe', 'horn'] as const).find((x) => s.clans[seat]!.steps[x === 'axe' ? 'axes' : x === 'horn' ? 'horns' : 'rage'] < 5);
      return stat ? { type: 'clanAction', card: h.card, figures: [`f${on[0]!.id}`, `f${on[1]!.id}`], stat } : { type: 'pass' };
    }
    default: {
      const { cost: _c, effects: _e, maxFigures: _m, ...rest } = h;
      return rest;
    }
  }
}

describe('blood rage contract: random playouts on contract hints', () => {
  for (const players of [2, 3, 4, 5]) {
    it(`${players} players: every hinted action is accepted, villages hold one figure, the game ends`, () => {
      for (const seed of [11, 12]) {
        const r = mulberry(seed * 7 + players);
        let snap = startGame(m, { playerCount: players, seed, options: {} }).snapshot;
        let steps = 0;
        while (!st(snap).outcome && steps < 6000) {
          steps++;
          const s = st(snap);
          const seats = bloodRageModule.pendingSeats(s);
          expect(seats.length).toBeGreaterThan(0);
          const seat = seats[Math.floor(r() * seats.length)]!;
          const hints = (contractHints(s, p(seat)) as Hint[]).filter((h) => !h.disabled);
          expect(hints.length, `hints at ${s.step}`).toBeGreaterThan(0);
          // prefer real moves over passing so the game exercises battles
          const h = hints.length > 1 && r() < 0.85 ? hints.filter((x) => x.type !== 'pass')[Math.floor(r() * (hints.length - 1))] ?? hints[0]! : hints[Math.floor(r() * hints.length)]!;
          snap = act(snap, seat, fromHint(s, seat, h, r));
          const sm = slotMap(st(snap));
          expect(new Set(sm.values()).size).toBe(sm.size);
        }
        expect(st(snap).outcome, `seed ${seed}`).not.toBeNull();
        expect(view(snap, 0).final).toHaveLength(players);
        expect(PROV_NUM.ygg).toBe(0);
      }
    });
  }
});
