import { describe, expect, it } from 'vitest';
import { DISTRICTS, citadelsModule, current, scoreOf, type CitadelsState, type CitadelsView } from '@bg/game-citadels';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = citadelsModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as CitadelsState;
const game = (players = 4, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const byName = (n: string, k = 0) => DISTRICTS.filter((d) => d.name === n)[k]!.id;
/** Drafts with a fixed preference: everyone takes the lowest available character. */
function draftLowest(snap: EngineSnapshot) {
  while (st(snap).phase === 'draft') { const s = st(snap); snap = act(snap, current(s), { type: 'pick', char: s.pool[0] }); }
  return snap;
}

describe('citadels rules', () => {
  it('54 districts; draft removes characters by player count; 2–3 players take two each', () => {
    expect(DISTRICTS).toHaveLength(54);
    const four = st(game(4));
    expect(four.pool.length).toBe(8 - 1 - 2);
    expect(four.faceUp).not.toContain(4);
    expect(st(game(2)).draftOrder).toHaveLength(4);
    expect(st(game(7)).pool).toHaveLength(7);
  });

  it('the draft pool is visible only to the picker; picks stay hidden until called', () => {
    let snap = game(4, 2);
    const first = current(st(snap));
    const other = (first + 1) % 4;
    expect((projectFor(m, snap, p(other)).view as CitadelsView).pool).toBeNull();
    expect((projectFor(m, snap, p(first)).view as CitadelsView).pool).not.toBeNull();
    const c = st(snap).pool[0]!;
    snap = act(snap, first, { type: 'pick', char: c });
    const v = projectFor(m, snap, p(other)).view as CitadelsView;
    expect(v.myPicks).toEqual([]);
    expect(v.pickCounts[first]).toBe(1);
    expect(v).not.toHaveProperty('picks');
  });

  it('characters are called in order: income, building, abilities; the assassin skips a character', () => {
    let snap = game(4, 3);
    snap = draftLowest(snap);
    const s = st(snap);
    const seat = current(s);
    const char = s.calling;
    expect(s.revealed).toContain(char);
    if (char === 1) {
      const target = s.picks.flat().find((x) => x > 1)!;
      snap = act(snap, seat, { type: 'kill', char: target });
      expect(reject(snap, seat, { type: 'kill', char: target })).toBe('ABILITY_USED');
      snap = act(snap, seat, { type: 'income', take: 'gold' });
      snap = act(snap, seat, { type: 'end' });
      expect(st(snap).calling).not.toBe(target);
    } else {
      snap = act(snap, seat, { type: 'income', take: 'cards' });
      expect(st(snap).phase).toBe('choose');
      snap = act(snap, seat, { type: 'keep', card: st(snap).drawn[0] });
      snap = act(snap, seat, { type: 'end' });
    }
    expect(st(snap).phase === 'income' || st(snap).phase === 'draft').toBe(true);
  });

  it('building: cost, no duplicates; warlord destroys but not the bishop; scoring', () => {
    let snap = game(2, 4);
    const s = st(snap);
    Object.assign(s, { phase: 'act', picks: [[8], [5]], calling: 8, revealed: [8], buildsLeft: 1, abilityUsed: false });
    s.gold = [10, 0];
    s.hands[0] = [byName('دژ'), byName('دژ', 1)];
    s.cities[0] = [byName('دژ')].slice(0, 0);
    s.cities[1] = [byName('معبد')];
    expect(reject(snap, 0, { type: 'destroy', target: 1, card: byName('معبد') })).toBe('BISHOP_PROTECTS');
    snap = act(snap, 0, { type: 'build', card: byName('دژ') });
    expect(reject(snap, 0, { type: 'build', card: byName('دژ', 1) })).toBe('NO_BUILD');
    expect(st(snap).gold[0]).toBe(5);
    const city = [byName('عمارت'), byName('معبد'), byName('کاروانسرا'), byName('دژ'), byName('کاخ'), byName('جامع'), byName('بندر'), byName('دارالحکومه')];
    expect(scoreOf({ cities: [city], firstComplete: 0 }, 0)).toBe(3 + 1 + 1 + 5 + 5 + 5 + 4 + 5 + 3 + 4);
  });

  it('timeouts pick and pass; resign ends with the resigner last', () => {
    let t = game(3);
    const c = current(st(t));
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).picks[c]).toHaveLength(1);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = citadelsModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements).toEqual([{ seat: 0, place: 1, score: 26 }, { seat: 1, place: 2, score: 21 }]);
    expect(st(snap).gold).toEqual([0, 1]);
  });

  it('random games end with a completed city and replay deterministically', () => {
    for (let g = 0; g < 15; g++) {
      const rng = createRng({ s: 83 + g });
      const players = 2 + (g % 6);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 6000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = current(s);
        let action: unknown;
        if (s.phase === 'draft') action = { type: 'pick', char: s.pool[rng.nextInt(s.pool.length)] };
        else if (s.phase === 'income') action = { type: 'income', take: !s.hands[seat]!.length || rng.nextInt(6) === 0 ? 'cards' : 'gold' };
        else if (s.phase === 'choose') action = { type: 'keep', card: s.drawn[0] };
        else {
          const builds = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type === 'build');
          if (s.calling === 1 && !s.abilityUsed) action = { type: 'kill', char: 2 + rng.nextInt(7) };
          else if (s.calling === 2 && !s.abilityUsed) action = { type: 'rob', char: [3, 4, 5, 6, 7, 8].filter((c) => c !== s.killed)[rng.nextInt(5)] };
          else action = builds.length ? { type: 'build', card: builds[rng.nextInt(builds.length)]!.card } : { type: 'end' };
        }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const t = st(snap);
        expect(t.deck.length + t.hands.flat().length + t.cities.flat().length + t.drawn.length).toBe(54);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
