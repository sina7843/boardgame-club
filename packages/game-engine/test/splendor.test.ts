import { describe, expect, it } from 'vitest';
import { CARDS, NOBLES, payment, pointsOf, splendorModule, type SplendorState, type SplendorView, type Token } from '@bg/game-splendor';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = splendorModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as SplendorState;
const game = (players = 2, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const tok = (t: Partial<Record<Token, number>>) => ({ w: 0, u: 0, g: 0, r: 0, k: 0, o: 0, ...t });
const total = (s: SplendorState) => {
  const all = { ...s.bank };
  for (const t of s.tokens) for (const k of Object.keys(t) as Token[]) all[k] += t[k];
  return all;
};

describe('splendor rules', () => {
  it('has 90 cards (40/30/20, 18 per colour) and 10 nobles; setup by player count', () => {
    expect(CARDS).toHaveLength(90);
    expect([1, 2, 3].map((l) => CARDS.filter((c) => c.level === l).length)).toEqual([40, 30, 20]);
    expect(new Set(CARDS.map((c) => JSON.stringify([c.level, c.points, c.cost]))).size).toBe(90);
    expect(NOBLES).toHaveLength(10);
    const s = st(game(3));
    expect(s.bank).toEqual({ w: 5, u: 5, g: 5, r: 5, k: 5, o: 5 });
    expect(s.market.map((r) => r.length)).toEqual([4, 4, 4]);
    expect(s.nobles).toHaveLength(4);
  });

  it('takes three different gems or two of a pile with four; nothing else', () => {
    let snap = game(2);
    const c = st(snap).current;
    expect(reject(snap, c, { type: 'take', gems: ['w', 'u'] })).toBe('TAKE_THREE');
    expect(reject(snap, c, { type: 'take', gems: ['w', 'w', 'u'] })).toBe('DIFFERENT_COLOURS');
    snap = act(snap, c, { type: 'take', gems: ['w', 'w'] });
    expect(st(snap).tokens[c]!.w).toBe(2);
    expect(reject(snap, 1 - c, { type: 'take', gems: ['w', 'w'] })).toBe('PAIR_NEEDS_FOUR');
  });

  it('buys with bonuses and gold; reserving gives gold; blind reserves stay hidden', () => {
    let snap = game(2);
    const s = st(snap);
    s.current = 0;
    const card = s.market[0]![0]!;
    const need = CARDS[card]!.cost;
    s.tokens[0] = tok({ o: 1, ...Object.fromEntries(Object.entries(need).map(([g, n]) => [g, n])) });
    const first = Object.keys(need)[0] as Token;
    s.tokens[0][first] -= 1; // one short: gold covers it
    expect(payment(s.tokens[0], [], card)).not.toBeNull();
    snap = act(snap, 0, { type: 'buy', card });
    expect(st(snap).bought[0]).toEqual([card]);
    expect(st(snap).tokens[0]).toEqual(tok({}));
    expect(st(snap).market[0]).not.toContain(card);
    snap = act(snap, 1, { type: 'reserve', level: 3 });
    expect(st(snap).tokens[1]!.o).toBe(1);
    const v = projectFor(m, snap, p(0)).view as SplendorView;
    expect(v.reserved[1]).toEqual([{ level: 3 }]);
    expect((projectFor(m, snap, p(1)).view as SplendorView).reserved[1]![0]).toBeTypeOf('number');
    expect(v).not.toHaveProperty('decks');
  });

  it('more than ten tokens must be returned; nobles visit; 15 finishes the round', () => {
    let snap = game(2);
    const s = st(snap);
    s.current = 0; s.starter = 0;
    s.tokens[0] = tok({ w: 3, u: 3, g: 3 });
    snap = act(snap, 0, { type: 'take', gems: ['r', 'k', 'w'] });
    expect(st(snap).phase).toBe('return');
    expect(reject(snap, 0, { type: 'take', gems: ['r', 'k', 'u'] })).toBe('RETURN_TOKENS');
    expect(reject(snap, 0, { type: 'return', gems: ['w'] })).toBe('RETURN_EXACT');
    snap = act(snap, 0, { type: 'return', gems: ['w', 'u'] });
    expect(st(snap).current).toBe(1);
    // A noble and the end of the round.
    let t = game(2, 5);
    const ts = st(t);
    ts.current = 0; ts.starter = 0;
    const noble = ts.nobles[0]!;
    const need = NOBLES[noble]!.need;
    ts.bought[0] = Object.entries(need).flatMap(([g, n]) => CARDS.filter((c) => c.color === g && c.level === 3).slice(0, 4).map((c) => c.id).slice(0, n));
    expect(pointsOf(ts, 0)).toBeGreaterThanOrEqual(12);
    t = act(t, 0, { type: 'take', gems: ['w', 'u', 'g'] });
    expect(st(t).visited[0]).toEqual([noble]);
    expect(st(t).ending).toBe(true);
    expect(st(t).outcome).toBeNull();
    t = act(t, 1, { type: 'take', gems: ['w', 'u', 'g'] });
    expect(st(t).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
  });

  it('timeouts take gems; resign ends with the resigner last', () => {
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(Object.values(st(t).tokens[c]!).reduce((a, b) => a + b, 0)).toBe(3);
    expect(st(t).timeouts[c]).toBe(1);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = splendorModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    expect(st(snap).market[1]![0]).toBe(68);
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1, score: 15 });
  });

  it('random games conserve tokens and cards and replay deterministically', () => {
    for (let g = 0; g < 20; g++) {
      const rng = createRng({ s: 19 + g });
      const players = 2 + (g % 3);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const start = total(st(snap));
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 4000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const buys = hints.filter((h) => h.type === 'buy');
        const takes = hints.filter((h) => h.type === 'take' || h.type === 'take2');
        const h = buys.length ? buys[rng.nextInt(buys.length)]! : takes.length && rng.nextInt(4) ? takes[rng.nextInt(takes.length)]! : hints[rng.nextInt(hints.length)]!;
        let action: unknown;
        if (h.type === 'take') action = { type: 'take', gems: (h.colors as string[]).slice(0, h.need as number) };
        else if (h.type === 'take2') action = { type: 'take', gems: [h.color, h.color] };
        else if (h.type === 'return') {
          const t = { ...s.tokens[seat]! };
          const gems: Token[] = [];
          for (let k = 0; k < (h.count as number); k++) { const x = (Object.keys(t) as Token[]).find((y) => t[y] > 0)!; t[x] -= 1; gems.push(x); }
          action = { type: 'return', gems };
        } else if (h.type === 'reserve') action = h.card !== undefined ? { type: 'reserve', card: h.card } : { type: 'reserve', level: h.level };
        else if (h.type === 'buy') action = { type: 'buy', card: h.card };
        else action = { type: 'pass' };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const t = st(snap);
        expect(total(t)).toEqual(start);
        const cards = [...t.decks.flat(), ...t.market.flat().filter((x) => x !== null), ...t.bought.flat(), ...t.reserved.flat()];
        expect(new Set(cards).size).toBe(90);
        if (t.phase === 'act') t.tokens.forEach((x) => expect(Object.values(x).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(10));
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
