import { describe, expect, it } from 'vitest';
import { MERCHANTS, ORDERS, centuryModule, legalFor, scoreOf, total, upgrade, type Bag, type CenturyState, type Spice } from '@bg/game-century';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = centuryModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as CenturyState;
const game = (players = 3, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const b = (s: string): Bag => { const x: Bag = { y: 0, r: 0, g: 0, b: 0 }; for (const c of s) x[c as Spice] += 1; return x; };

describe('century rules', () => {
  it('cards, starting hands and spices by seat order', () => {
    expect(MERCHANTS).toHaveLength(36);
    expect(ORDERS).toHaveLength(36);
    const s = st(game(5, 2));
    const fromStart = (k: number) => s.cubes[(s.starter + k) % 5]!;
    expect([0, 1, 2, 3, 4].map((k) => total(fromStart(k)))).toEqual([3, 4, 4, 4, 4]);
    expect(fromStart(3).r).toBe(1);
    expect(s.hands.every((h) => h.join() === '0,1')).toBe(true);
    expect(s.market).toHaveLength(6);
    expect(s.orders).toHaveLength(5);
  });

  it('upgrades step by step; trades repeat; spice cards gain', () => {
    expect(upgrade(b('yy'), ['y', 'r'])).toEqual(b('yg'));
    expect(upgrade(b('b'), ['b'])).toBeNull();
    let snap = game(2, 3);
    const s = st(snap);
    s.current = 0; s.starter = 0;
    s.cubes[0] = b('yyyy');
    const trade = MERCHANTS.find((x) => x.kind === 'trade' && x.give.y === 2 && x.gain.r === 2)!.id;
    s.hands[0] = [0, 1, trade];
    snap = act(snap, 0, { type: 'play', card: trade, times: 2 });
    expect(st(snap).cubes[0]).toEqual(b('rrrr'));
    expect(st(snap).played[0]).toEqual([trade]);
    snap = act(snap, 1, { type: 'play', card: 1, upgrades: ['y', 'r'] });
    expect(st(snap).cubes[1]!.g).toBe(1);
    expect(reject(snap, 0, { type: 'play', card: trade })).toBe('NOT_IN_HAND');
    snap = act(snap, 0, { type: 'rest' });
    expect(st(snap).hands[0]).toContain(trade);
  });

  it('acquiring pays one spice per earlier card and takes the spices on the card', () => {
    let snap = game(2, 4);
    const s = st(snap);
    s.current = 0; s.starter = 0;
    s.cubes[0] = b('yyy');
    s.market[2]!.cubes = b('r');
    const card = s.market[2]!.card;
    expect(reject(snap, 0, { type: 'acquire', slot: 2, pay: ['y'] })).toBe('PAY_ONE_EACH');
    snap = act(snap, 0, { type: 'acquire', slot: 2, pay: ['y', 'y'] });
    const t = st(snap);
    expect(t.hands[0]).toContain(card);
    expect(t.cubes[0]).toEqual(b('yr'));
    expect(t.market[0]!.cubes.y).toBe(1);
    expect(t.market).toHaveLength(6);
  });

  it('claiming pays exact spices with coins; over ten spices must be discarded; the round ends', () => {
    let snap = game(2, 5);
    const s = st(snap);
    s.current = 0; s.starter = 0;
    const need = ORDERS[s.orders[0]!]!.need;
    s.cubes[0] = { ...need, y: need.y + 1 };
    snap = act(snap, 0, { type: 'claim', slot: 0 });
    expect(st(snap).coins[0]).toEqual({ gold: 1, silver: 0 });
    expect(st(snap).cubes[0]).toEqual(b('y'));
    st(snap).cubes[1] = b('yyyyyyyyyy');
    snap = act(snap, 1, { type: 'play', card: 0 });
    expect(st(snap).phase).toBe('discard');
    expect(reject(snap, 1, { type: 'discard', cubes: ['y'] })).toBe('DISCARD_EXACT');
    snap = act(snap, 1, { type: 'discard', cubes: ['y', 'y'] });
    expect(st(snap).current).toBe(0);
    expect(scoreOf(st(snap), 0)).toBe(ORDERS[st(snap).won[0]![0]!]!.points + 3);
  });

  it('legal hints, timeouts and resign', () => {
    const s = st(game(3));
    expect(legalFor(s, s.current).some((h) => h.type === 'play')).toBe(true);
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).played[c]).toEqual([0]);
    const r = act(game(3), 1, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 1, place: 3 });
    expect(projectFor(m, game(), p(0)).view).not.toHaveProperty('mdeck');
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = centuryModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    const s = st(snap);
    expect(s.outcome?.placements).toEqual([{ seat: 0, place: 1, score: 51 }, { seat: 1, place: 2, score: 35 }]);
    expect(s.won[0]).toHaveLength(6);
    expect(s.cubes[0]).toEqual(b('g'));
    expect(s.coins[0]).toEqual({ gold: 2, silver: 1 });
  });

  it('random games end and replay deterministically', () => {
    for (let g = 0; g < 20; g++) {
      const rng = createRng({ s: 59 + g });
      const players = 2 + (g % 4);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 6000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const hints = legalFor(s, seat);
        const claims = hints.filter((h) => h.type === 'claim');
        const h = claims.length ? claims[0]! : hints[rng.nextInt(hints.length)]!;
        const c = s.cubes[seat]!;
        let action: unknown;
        if (h.type === 'discard') { const x = { ...c }; const cubes: Spice[] = []; for (let k = 0; k < (h.count as number); k++) { const y = (['y', 'r', 'g', 'b'] as Spice[]).find((z) => x[z] > 0)!; x[y] -= 1; cubes.push(y); } action = { type: 'discard', cubes }; }
        else if (h.type === 'play') {
          const mc = MERCHANTS[h.card as number]!;
          if (mc.kind === 'trade') action = { type: 'play', card: h.card, times: 1 + rng.nextInt(h.max as number) };
          else if (mc.kind === 'upgrade') { const from = (['y', 'r', 'g'] as Spice[]).find((z) => c[z] > 0)!; action = { type: 'play', card: h.card, upgrades: [from] }; }
          else action = { type: 'play', card: h.card };
        } else if (h.type === 'acquire') { const x = { ...c }; const pay: Spice[] = []; for (let k = 0; k < (h.slot as number); k++) { const y = (['y', 'r', 'g', 'b'] as Spice[]).find((z) => x[z] > 0)!; x[y] -= 1; pay.push(y); } action = { type: 'acquire', slot: h.slot, pay }; }
        else if (h.type === 'claim') action = { type: 'claim', slot: h.slot };
        else action = { type: 'rest' };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const t = st(snap);
        if (t.phase === 'act') t.cubes.forEach((x) => expect(total(x)).toBeLessThanOrEqual(10));
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
