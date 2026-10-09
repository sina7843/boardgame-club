import { describe, expect, it } from 'vitest';
import { CARDS, canPay, raModule, vpOf, type RaState, type RaView } from '@bg/game-res-arcana';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = raModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as RaState;
const game = (players = 3, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => { const r = applyAction(m, snap, p(seat), action, 0); return 'ok' in r ? r.errorCode : 'ACCEPTED'; };
const edit = (snap: EngineSnapshot, f: (s: RaState) => void): EngineSnapshot => { const s = structuredClone(st(snap)); f(s); return { ...snap, state: s }; };
const byName = (n: string) => CARDS.find((c) => c.name === n)!.id;

describe('res arcana rules', () => {
  it('24 artifacts, 4 mages, 5 places, 6 monuments; each player gets a mage, 3 cards in hand and 3 in the deck', () => {
    expect(['artifact', 'mage', 'place', 'monument'].map((k) => CARDS.filter((c) => c.kind === k).length)).toEqual([24, 4, 5, 6]);
    const s = st(game(4));
    expect(s.players.every((x) => x.hand.length === 3 && x.deck.length === 3 && x.table.length === 1)).toBe(true);
    expect(s.monuments).toHaveLength(2);
    expect(canPay({ e: 1, l: 1, c: 0, d: 0, g: 0 }, { e: 1, l: 1 })).toBe(true);
  });

  it('actions rotate among players who have not passed; taps once per round; discards give essences', () => {
    let snap = edit(game(2, 2), (s) => { s.current = 0; s.players[0]!.table.push(byName('دیگ جوشان')); s.players[0]!.hand.push(byName('شعلهٔ کوچک')); });
    const pot = byName('دیگ جوشان');
    snap = act(snap, 0, { type: 'tap', card: pot });
    expect(st(snap).players[0]!.ess).toMatchObject({ l: 2, e: 2 });
    expect(st(snap).current).toBe(1);
    snap = act(snap, 1, { type: 'pass' });
    expect(reject(snap, 0, { type: 'tap', card: pot })).toBe('ALREADY_TAPPED');
    snap = act(snap, 0, { type: 'discard', card: byName('شعلهٔ کوچک'), gain: 'd' });
    expect(st(snap).players[0]!.ess.d).toBe(3);
    expect(st(snap).current).toBe(0);
  });

  it('passing draws a card; the first to pass starts the next round; collect at round start', () => {
    let snap = edit(game(2, 3), (s) => { s.current = 0; s.first = 0; });
    const before = st(snap).players.map((x) => ({ ...x.ess }));
    snap = act(snap, 1 - 1, { type: 'pass' });
    expect(st(snap).players[0]!.hand).toHaveLength(4);
    snap = act(snap, 1, { type: 'pass' });
    const s = st(snap);
    expect(s).toMatchObject({ round: 2, first: 0, current: 0, tapped: [] });
    const mage = CARDS[s.players[1]!.table[0]!]!;
    const gained = Object.entries(mage.collect).reduce((n, [, v]) => n + (v ?? 0), 0);
    expect(Object.values(s.players[1]!.ess).reduce((a, b) => a + b, 0) - Object.values(before[1]!).reduce((a, b) => a + b, 0)).toBe(gained);
  });

  it('places of power and monuments give VP; ten ends the game at the round end', () => {
    let snap = edit(game(2, 4), (s) => { s.current = 0; s.players[0]!.ess = { e: 0, l: 0, c: 5, d: 0, g: 5 }; s.players[0]!.vpTokens = 7; });
    const temple = byName('معبد آرام');
    snap = act(snap, 0, { type: 'buy', card: temple });
    expect(vpOf(st(snap).players[0]!)).toBe(10);
    expect(st(snap).places).not.toContain(temple);
    expect(reject(snap, 0, { type: 'buy', card: temple })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 1, { type: 'pass' });
    snap = act(snap, 0, { type: 'pass' });
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1, score: 10 });
  });

  it('hands, decks and the monument deck are hidden', () => {
    const snap = game(3, 2);
    const v = projectFor(m, snap, p(1)).view as RaView;
    expect(v).not.toHaveProperty('players');
    expect(v).not.toHaveProperty('monumentDeck');
    expect(v.hand).toEqual(st(snap).players[1]!.hand);
    expect(v.mages.map((x) => x.hand)).toEqual([3, 3, 3]);
  });

  it('timeouts pass; resign ends with the resigner last', () => {
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).players[c]!.passed).toBe(true);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = raModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) { snap = act(snap, 0, step.expected); if (step.reply) snap = act(snap, 1, step.reply); }
    expect(st(snap).outcome?.placements).toEqual([{ seat: 0, place: 1, score: 10 }, { seat: 1, place: 2, score: 7 }]);
  });

  it('greedy random games reach ten and replay deterministically', () => {
    for (let g = 0; g < 12; g++) {
      const rng = createRng({ s: 6 + g });
      const setup = { playerCount: 2 + (g % 3), seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 8000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const legal = projectFor(m, snap, p(s.current)).legalActions.filter((h) => h.type !== 'resign');
        const pref = ['buy', 'tap', 'play'].map((t) => legal.filter((h) => h.type === t)).find((xs) => xs.length && rng.nextInt(4));
        const disc = legal.filter((h) => h.type === 'discard');
        const pick = pref ? pref[rng.nextInt(pref.length)]! : disc.length && rng.nextInt(3) === 0 ? disc[0]! : legal.find((h) => h.type === 'pass')!;
        const { type, ...rest } = pick;
        const action = type === 'discard' ? { type, card: rest.card, gain: (['g', 'e', 'l', 'c', 'd'] as const)[rng.nextInt(5)] } : { type, ...rest };
        snap = act(snap, s.current, action);
        inputs.push({ kind: 'action', actor: p(s.current), action, logicalTime: 0 });
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
