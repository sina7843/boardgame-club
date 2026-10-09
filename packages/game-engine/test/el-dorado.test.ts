import { describe, expect, it } from 'vitest';
import { COLS, DIST, MAP, TYPE, coinValue, edModule, neighbours, type EdState, type EdView } from '@bg/game-el-dorado';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = edModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as EdState;
const game = (players = 3, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => { const r = applyAction(m, snap, p(seat), action, 0); return 'ok' in r ? r.errorCode : 'ACCEPTED'; };
const edit = (snap: EngineSnapshot, f: (s: EdState) => void): EngineSnapshot => { const s = structuredClone(st(snap)); f(s); return { ...snap, state: s }; };
const at = (r: number, c: number) => r * COLS + c;
const total = (s: EdState) => s.players.reduce((n, x) => n + x.deck.length + x.hand.length + x.discard.length, 0) + s.removed;

describe('el dorado rules', () => {
  it('map: 4 starts, 4 El Dorado hexes, every start can reach the goal', () => {
    expect(MAP.filter((h) => h.kind === 's')).toHaveLength(4);
    expect(MAP.filter((h) => h.kind === 'E')).toHaveLength(4);
    MAP.forEach((h, i) => { if (h.kind === 's') expect(DIST[i]).toBeLessThan(20); });
    expect(neighbours(at(0, 0))).toEqual(expect.arrayContaining([at(0, 1), at(1, 0)]));
    expect(coinValue(['traveller', 'explorer', 'journalist'])).toBe(4.5);
    const s = st(game(4));
    expect(s.players.every((x) => x.hand.length === 4 && x.deck.length === 4)).toBe(true);
  });

  it('moving spends matching card points across hexes; occupied and wrong-colour hexes are refused', () => {
    let snap = edit(game(2, 2), (s) => {
      s.current = 0; s.players[0]!.pos = at(1, 0); s.players[0]!.hand = ['scout', 'sailor', 'traveller', 'explorer']; s.players[1]!.pos = at(1, 1);
    });
    expect(reject(snap, 0, { type: 'move', to: at(1, 1), card: 0 })).toBe('NOT_REACHABLE');
    expect(reject(snap, 0, { type: 'move', to: at(2, 0), card: 1 })).toBe('WRONG_CARD');
    snap = act(snap, 0, { type: 'move', to: at(2, 0), card: 0 });
    expect(st(snap).active).toMatchObject({ key: 'scout', left: 1 });
    expect(reject(snap, 0, { type: 'move', to: at(2, 1), card: -1 })).toBe('NO_POINTS');
    snap = edit(snap, (s) => { s.players[1]!.pos = at(0, 3); });
    expect(neighbours(at(2, 0))).toContain(at(2, 1));
    snap = act(snap, 0, { type: 'move', to: at(2, 1), card: 1 });
    expect(st(snap).players[0]!.pos).toBe(at(2, 1));
  });

  it('rubble discards, camps remove cards; buying once per turn with coins', () => {
    let snap = edit(game(2, 3), (s) => { s.current = 0; s.players[0]!.pos = at(2, 2); s.players[0]!.hand = ['explorer', 'traveller', 'traveller', 'photographer']; });
    const n = total(st(snap));
    expect(reject(snap, 0, { type: 'move', to: at(3, 2), card: 0 })).toBe('MUST_PAY_CARDS');
    snap = act(snap, 0, { type: 'move', to: at(3, 2), card: -1, pay: [0] });
    expect(st(snap).players[0]!.discard).toContain('explorer');
    expect(reject(snap, 0, { type: 'buy', key: 'pioneer', pay: [0, 1, 2] })).toBe('CANNOT_AFFORD');
    snap = act(snap, 0, { type: 'buy', key: 'journalist', pay: [1, 2] });
    expect(reject(snap, 0, { type: 'buy', key: 'scout', pay: [0] })).toBe('ALREADY_BOUGHT');
    expect(total(st(snap))).toBe(n + 1);
    snap = act(snap, 0, { type: 'endTurn', discard: [] });
    expect(st(snap).players[0]!.hand).toHaveLength(4);
    expect(MAP[at(5, 0)]!.kind).toBe('c');
  });

  it('hands and decks are hidden; positions are public', () => {
    const snap = game(3, 2);
    const v = projectFor(m, snap, p(1)).view as EdView;
    expect(v).not.toHaveProperty('players');
    expect(v.hand).toEqual(st(snap).players[1]!.hand);
    expect(v.explorers.map((e) => e.hand)).toEqual([4, 4, 4]);
  });

  it('timeouts end the turn; resign ends with the resigner last', () => {
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).current).toBe((c + 1) % 3);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = edModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) { snap = act(snap, 0, step.expected); if (step.reply) snap = act(snap, 1, step.reply); }
    const s = st(snap);
    expect(s.outcome?.placements.map((x) => ({ ...x, score: x.score === 0 ? 0 : x.score }))).toEqual([{ seat: 0, place: 1, score: 0 }, { seat: 1, place: 2, score: -2 }]);
    expect(s.players[0]!.arrived).toBe(true);
    // The bought photographer joined the learner's cards (the final refill reshuffled the discard into the deck).
    const me = s.players[0]!;
    expect([...me.deck, ...me.hand, ...me.discard].filter((k) => k === 'photographer')).toHaveLength(1);
  });

  it('greedy random races reach El Dorado and replay deterministically', () => {
    for (let g = 0; g < 12; g++) {
      const rng = createRng({ s: 8 + g });
      const setup = { playerCount: 2 + (g % 3), seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const size = total(st(snap));
      let bought = 0;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 6000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const me = s.players[seat]!;
        const legal = projectFor(m, snap, p(seat)).legalActions;
        const moves = legal.filter((h) => h.type === 'move').sort((a, b) => DIST[a.to as number]! - DIST[b.to as number]!);
        let action: unknown;
        const forward = moves.find((h) => DIST[h.to as number]! < DIST[me.pos]! && (h.card !== undefined || me.hand.length >= (h.discardCards as number)));
        if (forward) action = forward.card !== undefined ? { type: 'move', to: forward.to, card: forward.card } : { type: 'move', to: forward.to, card: -1, pay: Array.from({ length: forward.discardCards as number }, (_, i) => i) };
        else if (!s.bought && me.hand.length && rng.nextInt(2)) {
          const coins = coinValue(me.hand);
          const options = Object.keys(s.market).filter((k) => s.market[k]! > 0 && TYPE[k]!.cost <= coins);
          action = options.length ? { type: 'buy', key: options[rng.nextInt(options.length)], pay: me.hand.map((_, i) => i) } : { type: 'endTurn', discard: [] };
        } else action = { type: 'endTurn', discard: me.hand.map((_, i) => i).filter(() => rng.nextInt(3) === 0) };
        if ((action as { type: string }).type === 'buy') bought += 1;
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(total(st(snap))).toBe(size + bought);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(st(snap).players.some((x) => x.arrived)).toBe(true);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
