import { describe, expect, it } from 'vitest';
import { backgammonModule, CHECKERS, legalPlays, nextSteps, pipCount, startPos, step, target, type BgState, type BgView, type Step } from '@bg/game-backgammon';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = backgammonModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as BgState;
const game = (seed = 1, options: Record<string, unknown> = {}) => startGame(m, { playerCount: 2, seed, options }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
/** An empty board with chosen checkers: `w` / `b` = { point: count }, everything else off. */
function pos(w: Record<number, number>, b: Record<number, number>, bar: [number, number] = [0, 0]) {
  const pts = Array<number>(24).fill(0);
  for (const [i, n] of Object.entries(w)) pts[Number(i)] = n;
  for (const [i, n] of Object.entries(b)) pts[Number(i)] = -n;
  const onBoard = (sign: number) => pts.reduce((a, x) => a + (Math.sign(x) === sign ? Math.abs(x) : 0), 0);
  return { pts, bar, off: [CHECKERS - onBoard(1) - bar[0], CHECKERS - onBoard(-1) - bar[1]] as [number, number] };
}
const plays = (ps: Step[][]) => ps.map((pl) => pl.map((s) => `${s.from}/${s.die}`).join(' ')).sort();

describe('backgammon rules', () => {
  it('start position: 15 checkers each, 167 pips; opening roll is two different dice and the higher moves', () => {
    const s0 = startPos();
    expect(pipCount(s0, 0)).toBe(167);
    expect(pipCount(s0, 1)).toBe(167);
    for (let seed = 0; seed < 20; seed++) {
      const s = st(game(seed));
      expect(s.dice![0]).not.toBe(s.dice![1]);
      expect(s.current).toBe(s.dice![0] > s.dice![1] ? 0 : 1);
      expect(s.phase).toBe('move');
    }
  });

  it('a whole turn is one play; it must use both dice when it can, and only legal sequences are accepted', () => {
    const snap = game(1);
    const s = st(snap);
    const seat = s.current;
    const all = legalPlays(s, seat, s.dice!);
    expect(all.every((pl) => pl.length === 2)).toBe(true);
    expect(reject(snap, seat, { type: 'play', moves: [all[0]![0]] })).toBe('ILLEGAL_MOVE');
    expect(reject(snap, 1 - seat, { type: 'play', moves: all[0] })).toBe('NOT_YOUR_TURN');
    const next = act(snap, seat, { type: 'play', moves: all[0] });
    expect(st(next).current).toBe(1 - seat);
    expect(st(next).phase).toBe('move'); // no cube: the next player's dice are rolled at once
  });

  it('only one die playable: it must be the larger one when either could be played', () => {
    // Seat 0: checkers on indices 10 and 23. 10 can play 6 or 4, but never both (index 0 is closed); 23 is stuck.
    const p0 = pos({ 10: 1, 23: 1 }, { 0: 2, 17: 2, 19: 2 });
    expect(plays(legalPlays(p0, 0, [6, 4]))).toEqual(['10/6']);
    expect(plays(legalPlays(p0, 0, [4, 6]))).toEqual(['10/6']);
  });

  it('doubles are played four times; checkers on the bar must enter first; a blocked entry passes the turn', () => {
    const d = legalPlays(startPos(), 0, [3, 3]);
    expect(d.every((pl) => pl.length === 4)).toBe(true);
    const barred = pos({ 12: 14 }, { 0: 3 }, [1, 0]);
    expect(nextSteps(barred, 0, [5, 2], []).every((s) => s.from === 'bar')).toBe(true);
    // Seat 1 closed board (indices 18..23 for its home = seat 0 enters on 18..23): no entry → no play.
    const closed = pos({ 12: 14 }, { 18: 2, 19: 2, 20: 2, 21: 2, 22: 2, 23: 2 }, [1, 0]);
    expect(legalPlays(closed, 0, [6, 1])).toEqual([[]]);
  });

  it('hitting a blot sends it to the bar; a point with two or more is closed', () => {
    const p0 = pos({ 7: 2, 12: 13 }, { 4: 1, 3: 2, 23: 12 });
    const r = step(p0, 0, { from: 7, die: 3 });
    expect(r.played.hit).toBe(true);
    expect(r.pos.bar).toEqual([0, 1]);
    expect(r.pos.pts[4]).toBe(1);
    expect(target(p0, 0, 7, 4)).toBeNull(); // index 3 holds two of seat 1
    // The hit checker must enter before anything else moves.
    expect(nextSteps(r.pos, 1, [6, 5], []).every((s) => s.from === 'bar')).toBe(true);
  });

  it('bearing off: exact die, or a higher die only from the farthest point', () => {
    const home = pos({ 0: 2, 3: 1 }, { 23: 15 });
    const ps = plays(legalPlays(home, 0, [6, 5]));
    // 6 and 5 both bear off the checker on the 4-point (farthest), then the 1-point checkers.
    expect(ps).toContain('3/6 0/5');
    expect(nextSteps(home, 0, [6, 5], []).map((s) => `${s.from}/${s.die}`).sort()).toEqual(['3/5', '3/6']);
    // Not all home: no bearing off at all.
    const notHome = pos({ 0: 2, 8: 1 }, { 23: 15 });
    expect(legalPlays(notHome, 0, [6, 5]).flat().some((s) => s.from === 0)).toBe(false);
  });

  it('single / gammon / backgammon scoring and the option to ignore gammons', () => {
    const finishFrom = (b: Record<number, number>, barB: number, options: Record<string, unknown> = {}) => {
      let snap = game(3, options);
      const s = st(snap);
      Object.assign(s, pos({ 0: 1 }, b, [0, barB]));
      s.current = 0; s.dice = [1, 2]; s.phase = 'move';
      snap = act(snap, 0, { type: 'play', moves: [{ from: 0, die: 2 }] });
      return st(snap);
    };
    expect(finishFrom({ 23: 15 }, 0).win).toMatchObject({ seat: 0, kind: 'gammon', points: 2 });
    expect(finishFrom({ 23: 14 }, 1).win).toMatchObject({ kind: 'backgammon', points: 3 });
    expect(finishFrom({ 2: 1, 23: 14 }, 0).win).toMatchObject({ kind: 'backgammon', points: 3 }); // a checker in the winner's home
    const single = finishFrom({ 23: 14 }, 0);
    expect(single.win).toMatchObject({ kind: 'single', points: 1 });
    expect(single.outcome?.placements).toEqual([{ seat: 0, place: 1, score: 1 }, { seat: 1, place: 2, score: 0 }]);
    expect(finishFrom({ 23: 15 }, 0, { gammons: false }).win).toMatchObject({ kind: 'single', points: 1 });
  });

  it('doubling cube: double → take doubles the stake and passes the cube; drop loses at the current value', () => {
    let snap = game(5, { cube: true });
    const first = st(snap).current;
    snap = act(snap, first, { type: 'play', moves: legalPlays(st(snap), first, st(snap).dice!)[0] });
    const second = 1 - first;
    expect(st(snap).phase).toBe('roll');
    expect(projectFor(m, snap, p(second)).legalActions.map((a) => a.type).sort()).toEqual(['double', 'resign', 'roll']);
    const doubled = act(snap, second, { type: 'double' });
    expect(projectFor(m, doubled, p(first)).legalActions.map((a) => a.type).sort()).toEqual(['drop', 'resign', 'take']);
    const taken = act(doubled, first, { type: 'take' });
    expect(st(taken).cube).toEqual({ value: 2, owner: first });
    expect(st(taken).phase).toBe('move');
    expect(st(taken).current).toBe(second);
    expect(reject({ ...taken, state: { ...st(taken), phase: 'roll' } } as EngineSnapshot, second, { type: 'double' })).toBe('CANNOT_DOUBLE');
    const dropped = act(doubled, first, { type: 'drop' });
    expect(st(dropped).win).toMatchObject({ seat: second, points: 1 });
  });

  it('timeouts play passively; three in a row lose; resign concedes', () => {
    let snap = game(6);
    const seat = st(snap).current;
    snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(snap).current).toBe(1 - seat);
    let t = game(6);
    const loser = st(t).current;
    for (let i = 0; i < 3; i++) {
      // Only the same seat times out: the other side plays normally.
      if (st(t).current !== loser) t = act(t, st(t).current, { type: 'play', moves: legalPlays(st(t), st(t).current, st(t).dice!)[0] });
      t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    }
    expect(st(t).outcome?.reason).toBe('timeout');
    expect(st(t).win?.seat).toBe(1 - loser);
    const r = act(game(7), 1, { type: 'resign' });
    expect(st(r).outcome?.reason).toBe('resign');
    expect(st(r).win).toMatchObject({ seat: 0, kind: 'single', points: 1 });
  });

  it('the view hides nothing but the tutorial script; pip counts are included', () => {
    expect((projectFor(m, game(8, { deal: 'tutorial' }), p(1)).view as BgView)).not.toHaveProperty('script');
    expect((projectFor(m, game(8), p(1)).view as BgView).pips).toEqual([167, 167]);
  });

  it('tutorial script is legal from start to finish', () => {
    const t = backgammonModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const stp of t.steps) {
      snap = act(snap, 0, stp.expected);
      if (stp.reply) snap = act(snap, 1, stp.reply);
    }
    expect(st(snap).outcome?.placements).toEqual([{ seat: 0, place: 1, score: 2 }, { seat: 1, place: 2, score: 0 }]);
    expect(st(snap).win).toEqual({ seat: 0, kind: 'gammon', points: 2 });
    expect(st(snap).off).toEqual([15, 0]);
  });

  it('random games: checkers are conserved, games finish and replay deterministically', () => {
    let finished = 0;
    for (let g = 0; g < 40; g++) {
      const rng = createRng({ s: 300 + g });
      const setup = { playerCount: 2, seed: g, options: { cube: g % 2 === 0, gammons: g % 3 !== 0 } };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 2000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.phase === 'cube' ? 1 - s.current : s.current;
        let action: unknown;
        if (s.phase === 'roll') action = rng.nextInt(10) === 0 && s.cube.value < 8 && (s.cube.owner === null || s.cube.owner === seat) ? { type: 'double' } : { type: 'roll' };
        else if (s.phase === 'cube') action = rng.nextInt(4) ? { type: 'take' } : { type: 'drop' };
        else { const all = legalPlays(s, seat, s.dice!); action = { type: 'play', moves: all[rng.nextInt(all.length)] }; }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const after = st(snap);
        for (const side of [0, 1]) {
          const onBoard = after.pts.reduce((a, x) => a + (side === 0 ? Math.max(0, x) : Math.max(0, -x)), 0);
          expect(onBoard + after.bar[side]! + after.off[side]!).toBe(CHECKERS);
        }
      }
      if (st(snap).outcome) finished++;
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
    expect(finished).toBe(40);
  }, 300_000);
});
