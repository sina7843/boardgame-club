import { describe, expect, it } from 'vitest';
import { POWERS, kotModule, type Face, type KotState } from '@bg/game-king-of-tokyo';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = kotModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as KotState;
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
const none = [false, false, false, false, false, false];
/** Rolls once and overwrites the dice, then resolves. */
function resolveWith(snap: EngineSnapshot, seat: number, dice: Face[]) {
  snap = act(snap, seat, { type: 'roll', keep: none });
  st(snap).dice = dice;
  return act(snap, seat, { type: 'resolve' });
}

describe('king of tokyo rules', () => {
  it('setup and rolling: three rolls, keeping dice between rolls', () => {
    let snap = game(3, 2);
    const c = st(snap).current;
    expect(reject(snap, c, { type: 'resolve' })).toBe('ROLL_FIRST');
    snap = act(snap, c, { type: 'roll', keep: none });
    const first = st(snap).dice.slice();
    snap = act(snap, c, { type: 'roll', keep: [true, true, true, true, true, true] });
    expect(st(snap).dice).toEqual(first);
    snap = act(snap, c, { type: 'roll', keep: none });
    expect(reject(snap, c, { type: 'roll', keep: none })).toBe('NO_ROLLS_LEFT');
  });

  it('numbers score, hearts heal, bolts give energy; an empty Tokyo is entered', () => {
    let snap = game(2, 3);
    const s = st(snap);
    s.current = 0; s.hp[0] = 7;
    snap = resolveWith(snap, 0, ['2', '2', '2', '2', 'heart', 'bolt']);
    const t = st(snap);
    expect(t.vp[0]).toBe(3 + 1); // 2+1 for four twos, +1 entering Tokyo
    expect(t.hp[0]).toBe(8);
    expect(t.energy[0]).toBe(1);
    expect(t.tokyo).toBe(0);
    expect(t.phase).toBe('buy');
  });

  it('claws from outside hit Tokyo, which may yield; from Tokyo they hit everyone outside', () => {
    let snap = game(3, 4);
    const s = st(snap);
    s.current = 1; s.tokyo = 0;
    snap = resolveWith(snap, 1, ['claw', 'claw', '1', '2', '3', 'bolt']);
    expect(st(snap).hp[0]).toBe(8);
    expect(st(snap).phase).toBe('yield');
    expect(reject(snap, 1, { type: 'end' })).toBe('WAIT_FOR_YIELD');
    snap = act(snap, 0, { type: 'yield', leave: true });
    expect(st(snap).tokyo).toBe(1);
    snap = act(snap, 1, { type: 'end' });
    snap = resolveWith(snap, 2, ['claw', '1', '1', '2', '3', 'heart']);
    snap = act(snap, 1, { type: 'yield', leave: false });
    expect(st(snap).tokyo).toBe(1);
    snap = act(snap, 2, { type: 'end' });
    // Seat 0 starts; seat 1 in Tokyo gets +2 at the start of its own turn later.
    snap = resolveWith(snap, 0, ['1', '2', '3', 'bolt', 'bolt', 'heart']);
    snap = act(snap, 0, { type: 'end' });
    const vpBefore = st(snap).vp[1]!;
    expect(st(snap).current).toBe(1);
    expect(vpBefore).toBeGreaterThanOrEqual(3); // entered (+1) and started in Tokyo (+2)
    snap = resolveWith(snap, 1, ['claw', 'claw', 'claw', '1', '2', '3']);
    expect(st(snap).hp[0]).toBe(9 - 3); // healed one heart on its own turn
    expect(st(snap).hp[2]).toBe(7);
  });

  it('power cards: buying, keep effects, sweeping; 20 VP or last standing wins', () => {
    let snap = game(2, 5);
    const s = st(snap);
    s.current = 0; s.energy[0] = 20;
    const armor = POWERS.findIndex((x) => x.effect.kind === 'keep' && x.effect.power === 'armor');
    s.market = [armor, 3, 5];
    snap = resolveWith(snap, 0, ['1', '2', '3', '1', '2', '3']);
    snap = act(snap, 0, { type: 'buy', slot: 0 });
    expect(st(snap).kept[0]).toEqual([armor]);
    snap = act(snap, 0, { type: 'sweep' });
    expect(st(snap).market).toHaveLength(3);
    st(snap).vp[0] = 19;
    st(snap).market[0] = 5;
    snap = act(snap, 0, { type: 'buy', slot: 0 });
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
    let k = game(2, 6);
    st(k).current = 0; st(k).tokyo = 1; st(k).hp[1] = 2;
    k = resolveWith(k, 0, ['claw', 'claw', '1', '2', '3', 'bolt']);
    expect(st(k).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
  });

  it('timeouts resolve and end; resign eliminates', () => {
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).timeouts[c]).toBe(1);
    const r = act(game(2), 0, { type: 'resign' });
    expect(st(r).outcome?.placements[0]).toMatchObject({ seat: 1, place: 1 });
    expect(projectFor(m, game(), p(0)).view).not.toHaveProperty('deck');
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = kotModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    const s = st(snap);
    expect(s.outcome?.placements).toEqual([{ seat: 0, place: 1, score: 20 }, { seat: 1, place: 2, score: 11 }]);
    expect(s.dice).toEqual(['claw', '3', '3', '3', 'claw', 'heart']);
    expect([s.tokyo, s.hp, s.energy]).toEqual([0, [7, 5], [0, 3]]);
  });

  it('random games end and replay deterministically', () => {
    for (let g = 0; g < 25; g++) {
      const rng = createRng({ s: 79 + g });
      const players = 2 + (g % 5);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 6000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = kotModule.pendingSeats(s)[0]!;
        let action: unknown;
        if (s.phase === 'yield') action = { type: 'yield', leave: !!rng.nextInt(2) };
        else if (s.phase === 'roll') action = s.rolls > 0 && (s.rolls === 3 || rng.nextInt(2)) ? { type: 'resolve' } : { type: 'roll', keep: s.dice.map((d) => s.rolls > 0 && d === 'claw') .concat(s.rolls ? [] : none).slice(0, 6) };
        else {
          const buys = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type === 'buy');
          action = buys.length && rng.nextInt(2) ? { type: 'buy', slot: buys[0]!.slot } : { type: 'end' };
        }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const t = st(snap);
        expect(t.hp.every((h, k) => h <= t.maxHp[k]! && h >= 0)).toBe(true);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
