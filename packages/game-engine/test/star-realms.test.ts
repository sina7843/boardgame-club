import { describe, expect, it } from 'vitest';
import { TYPES, srModule, typeOf, type SrState, type SrView } from '@bg/game-star-realms';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = srModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as SrState;
const game = (seed = 1) => startGame(m, { playerCount: 2, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const edit = (snap: EngineSnapshot, f: (s: SrState) => void): EngineSnapshot => { const s = structuredClone(st(snap)); f(s); return { ...snap, state: s }; };
const total = (s: SrState) => s.sides.reduce((n, x) => n + x.deck.length + x.hand.length + x.discard.length + x.bases.length, 0) + s.inPlay.length + s.tradeDeck.length + s.row.filter((x) => x !== null).length + s.scrapped.length;
/** Puts trade-deck cards of the given types into seat 0's hand and makes it seat 0's fresh turn. */
const handOf = (snap: EngineSnapshot, keys: string[]) => edit(snap, (s) => {
  s.current = 0;
  s.sides[0]!.discard.push(...s.sides[0]!.hand);
  s.sides[0]!.hand = keys.map((k) => { const i = s.tradeDeck.findIndex((x) => s.cards[x] === k); return s.tradeDeck.splice(i, 1)[0]!; });
});

describe('star realms rules', () => {
  it('65-card trade deck, row of five, 50 authority; first player draws 3', () => {
    expect(TYPES.reduce((n, t) => n + t.count, 0)).toBe(65);
    const s = st(game(2));
    expect(s.row.every((x) => x !== null)).toBe(true);
    expect(s.tradeDeck).toHaveLength(60);
    expect(s.sides.map((x) => x.authority)).toEqual([50, 50]);
    expect(s.sides[s.current]!.hand).toHaveLength(3);
    expect(s.sides[1 - s.current]!.hand).toHaveLength(5);
  });

  it('playing, buying from the row and explorers, attacking; turn passes with a fresh hand', () => {
    let snap = handOf(game(3), ['tradepod', 'cutter']);
    snap = act(snap, 0, { type: 'playAll' });
    expect(st(snap).pool).toMatchObject({ trade: 5, combat: 0 });
    expect(st(snap).sides[0]!.authority).toBe(54);
    const before = total(st(snap));
    snap = act(snap, 0, { type: 'buy', slot: 5 });
    expect(total(st(snap))).toBe(before + 1);
    expect(reject(snap, 0, { type: 'attack', base: -1 })).toBe('NO_COMBAT');
    snap = act(snap, 0, { type: 'endTurn' });
    expect(st(snap)).toMatchObject({ current: 1 });
    expect(st(snap).sides[0]!.hand).toHaveLength(5);
  });

  it('allies trigger once; bases persist and outposts must fall first', () => {
    let snap = handOf(game(4), ['bfighter', 'battlepod', 'spacestation']);
    snap = act(snap, 0, { type: 'play', index: 0 });
    expect(st(snap).pool.combat).toBe(3);
    snap = act(snap, 0, { type: 'play', index: 0 });
    expect(st(snap).pool.combat).toBe(3 + 4 + 2);
    expect(st(snap).pool.scrapRow).toBe(1);
    snap = act(snap, 0, { type: 'play', index: 0 });
    expect(st(snap).sides[0]!.bases).toHaveLength(1);
    snap = act(snap, 0, { type: 'endTurn' });
    expect(reject(snap, 1, { type: 'attack', base: -1 })).toMatch(/OUTPOST_FIRST|NO_COMBAT/);
    snap = edit(snap, (s) => { s.pool.combat = 5; });
    expect(reject(snap, 1, { type: 'attack', base: -1 })).toBe('OUTPOST_FIRST');
    const base = st(snap).sides[0]!.bases[0]!;
    snap = act(snap, 1, { type: 'attack', base });
    expect(st(snap).sides[0]!.bases).toHaveLength(0);
    snap = act(snap, 1, { type: 'attack', base: -1 });
    expect(st(snap).sides[0]!.authority).toBe(49);
  });

  it('scrap abilities: self, hand/discard and trade row; opponent discard at turn start', () => {
    let snap = handOf(game(5), ['tradebot', 'ifighter', 'ram']);
    snap = act(snap, 0, { type: 'play', index: 0 });
    snap = act(snap, 0, { type: 'scrapCard', from: 'discard', index: 0 });
    expect(st(snap).scrapped).toHaveLength(1);
    snap = act(snap, 0, { type: 'play', index: 0 });
    const ram = st(snap).sides[0]!.hand[0]!;
    snap = act(snap, 0, { type: 'play', index: 0 });
    snap = act(snap, 0, { type: 'scrapSelf', card: ram });
    expect(st(snap).pool.trade).toBe(1 + 3);
    snap = act(snap, 0, { type: 'endTurn' });
    expect(st(snap).mustDiscard[1]).toBe(1);
    expect(reject(snap, 1, { type: 'endTurn' })).toBe('DISCARD_FIRST');
    const had = st(snap).sides[1]!.hand.length;
    snap = act(snap, 1, { type: 'discard', index: 0 });
    expect(st(snap).sides[1]!.hand).toHaveLength(had - 1);
  });

  it('hands, decks and the trade deck stay hidden', () => {
    const snap = game(2);
    const v = projectFor(m, snap, p(0)).view as SrView;
    expect(v).not.toHaveProperty('tradeDeck');
    expect(v.hand).toEqual(st(snap).sides[0]!.hand);
    expect(v.sides[1]).not.toHaveProperty('deck', expect.any(Array));
    expect(v.tradeDeckCount).toBe(60);
  });

  it('timeouts play everything, attack and pass; resign loses', () => {
    let t = game(6);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).current).toBe(1 - c);
    const r = act(game(), 0, { type: 'resign' });
    expect(st(r).outcome?.placements[0]).toMatchObject({ seat: 1, place: 1 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = srModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    expect(typeOf(st(snap), st(snap).sides[1]!.bases[0]!).key).toBe('tradepost');
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
  });

  it('random games end and replay deterministically', () => {
    for (let g = 0; g < 12; g++) {
      const rng = createRng({ s: 7 + g });
      const setup = { playerCount: 2, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      let size = total(st(snap));
      for (let n = 0; n < 8000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const legal = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const pref = ['discard', 'playAll', 'scrapRow', 'scrapCard', 'attack', 'buy', 'endTurn'];
        const kind = pref.find((k) => legal.some((h) => h.type === k) && (k !== 'scrapCard' || rng.nextInt(2)) && (k !== 'buy' || rng.nextInt(5)))!;
        const opts = legal.filter((h) => h.type === kind);
        const { type, ...rest } = opts[kind === 'attack' ? opts.length - 1 : rng.nextInt(opts.length)]!;
        const action = { type, ...rest };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        if (type === 'buy' && rest.slot === 5) size += 1;
        expect(total(st(snap))).toBe(size);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
