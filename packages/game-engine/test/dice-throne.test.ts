import { describe, expect, it } from 'vitest';
import { HEROES, MAX_HP, abilityEffect, dtModule, type DtState } from '@bg/game-dice-throne';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = dtModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as DtState;
const game = (seed = 1) => startGame(m, { playerCount: 2, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => { const r = applyAction(m, snap, p(seat), action, 0); return 'ok' in r ? r.errorCode : 'ACCEPTED'; };
const edit = (snap: EngineSnapshot, f: (s: DtState) => void): EngineSnapshot => { const s = structuredClone(st(snap)); f(s); return { ...snap, state: s }; };
const NONE = [false, false, false, false, false];
const picked = (seed = 1, a = 0, b = 3) => { let s = game(seed); const c = st(s).current; s = act(s, c, { type: 'pickHero', hero: a }); return act(s, 1 - c, { type: 'pickHero', hero: b }); };

describe('dice throne rules', () => {
  it('four heroes, five abilities each; patterns and tiers', () => {
    expect(HEROES).toHaveLength(4);
    const w = HEROES[0]!;
    expect(abilityEffect(w, w.abilities[0]!, [1, 2, 3, 4, 6])).toEqual({ dmg: 4 });
    expect(abilityEffect(w, w.abilities[0]!, [1, 2, 3, 1, 1])).toEqual({ dmg: 8 });
    expect(abilityEffect(w, w.abilities[3]!, [2, 3, 4, 5, 5])).toEqual({ dmg: 6 });
    expect(abilityEffect(w, w.abilities[3]!, [1, 1, 3, 5, 6])).toBeNull();
    const sh = HEROES[1]!;
    expect(abilityEffect(sh, sh.abilities[2]!, [1, 2, 5, 6, 3])).toMatchObject({ dmg: 5 });
  });

  it('heroes are drafted without duplicates; the first picker plays first', () => {
    let snap = game(3);
    const c = st(snap).current;
    snap = act(snap, c, { type: 'pickHero', hero: 1 });
    expect(reject(snap, 1 - c, { type: 'pickHero', hero: 1 })).toBe('HERO_TAKEN');
    snap = act(snap, 1 - c, { type: 'pickHero', hero: 2 });
    expect(st(snap)).toMatchObject({ phase: 'offense', current: c, rollsLeft: 3 });
  });

  it('three rolls keeping dice, then extra rolls cost 2 CP; attacks need their pattern', () => {
    let snap = picked(4);
    const c = st(snap).current;
    expect(reject(snap, c, { type: 'roll', keep: [true, false, false, false, false] })).toBe('ROLL_ALL_FIRST');
    snap = edit(snap, (s) => { s.fixedDice = [1, 1, 1, 4, 5, 6, 6, 6, 6]; });
    snap = act(snap, c, { type: 'roll', keep: NONE });
    const kept = st(snap).dice.slice(0, 3);
    snap = act(snap, c, { type: 'roll', keep: [true, true, true, false, false] });
    expect(st(snap).dice.slice(0, 3)).toEqual(kept);
    snap = act(snap, c, { type: 'roll', keep: [true, true, true, false, false] });
    expect(st(snap).rollsLeft).toBe(0);
    const cp = st(snap).fighters[c]!.cp;
    snap = act(snap, c, { type: 'roll', keep: [true, true, true, true, true] });
    expect(st(snap).fighters[c]!.cp).toBe(cp - 2);
  });

  it('defendable attacks wait for the defender; shield and wounds work', () => {
    let snap = edit(picked(5, 0, 1), (s) => { s.fixedDice = [1, 1, 1, 1, 2, 5, 1]; });
    const c = st(snap).current;
    snap = act(snap, c, { type: 'roll', keep: NONE });
    snap = act(snap, c, { type: 'attack', ability: 0 });
    expect(dtModule.pendingSeats(st(snap))).toEqual([1 - c]);
    expect(reject(snap, c, { type: 'defend' })).toBe('NOT_DEFENDING');
    const hp = st(snap).fighters[1 - c]!.hp;
    snap = act(snap, 1 - c, { type: 'defend' });
    expect(st(snap).fighters[1 - c]!.hp).toBe(hp - (8 - 3));
    expect(st(snap).fighters[c]!.hp).toBe(MAX_HP - 1);
    expect(st(snap).current).toBe(1 - c);
  });

  it('dice are public; nothing is hidden except the test-only fixed dice', () => {
    const v = projectFor(m, picked(), p(0)).view;
    expect(v).not.toHaveProperty('fixedDice');
  });

  it('timeouts pick, roll and attack; resign loses', () => {
    let t = game(6);
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).phase).toBe('offense');
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).current !== c || st(t).phase === 'defense').toBe(true);
    const r = act(game(), 0, { type: 'resign' });
    expect(st(r).outcome?.placements[0]).toMatchObject({ seat: 1, place: 1 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = dtModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) { snap = act(snap, 0, step.expected); if (step.reply) snap = act(snap, 1, step.reply); }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
  });

  it('random duels end and replay deterministically', () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 4 + g });
      const setup = { playerCount: 2, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 3000 && !st(snap).outcome; n++) {
        const seat = dtModule.pendingSeats(st(snap))[0]!;
        const legal = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const attacks = legal.filter((h) => h.type === 'attack');
        const s = st(snap);
        let action: unknown;
        if (attacks.length && (s.rollsLeft === 0 || rng.nextInt(2))) action = { type: 'attack', ability: attacks.at(-1)!.ability };
        else if (legal.some((h) => h.type === 'roll' && !h.extra)) action = { type: 'roll', keep: s.rolled ? s.dice.map(() => rng.nextInt(2) === 0) : NONE };
        else { const { type, ...rest } = legal.find((h) => h.type !== 'roll') ?? legal[0]!; action = type === 'roll' ? { type, keep: NONE } : { type, ...rest }; }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
