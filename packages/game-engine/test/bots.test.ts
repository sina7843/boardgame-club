// Every module that ships a bot: bots play each other at every level through the normal engine path. Each move must
// be accepted by validate/apply, games must finish (or reach the ply cap), and a single decision must stay cheap.
import { describe, expect, it } from 'vitest';
import type { BotLevel } from '@bg/game-sdk';
import { applyAction, createRng, reviewedModules, startGame, type AnyModule, type EngineSnapshot } from '../src/index.ts';

const modules = (reviewedModules as unknown as AnyModule[]).filter((m) => m.bot);
const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];
/** Upper bound for one decision on a developer machine; the real budget is the node cap, this only catches blow-ups. */
const MAX_DECIDE_MS = 1500;

function playOut(m: AnyModule, levels: BotLevel[], seed: number, maxPlies: number) {
  let snap: EngineSnapshot = startGame(m, { playerCount: levels.length, seed }).snapshot;
  const rng = createRng({ s: seed * 7919 });
  let plies = 0, slowest = 0;
  while (!m.outcome(snap.state) && plies < maxPlies) {
    const seat = m.pendingSeats(snap.state)[0]!;
    const t0 = performance.now();
    const action = m.bot!.decide(structuredClone(snap.state), seat, levels[seat]!, rng);
    slowest = Math.max(slowest, performance.now() - t0);
    const step = applyAction(m, snap, { kind: 'player', seat }, action, 1_000 + plies);
    if ('ok' in step) throw new Error(`${m.manifest.gameId}: bot action rejected (${step.errorCode}): ${JSON.stringify(action)}`);
    snap = step.snapshot;
    plies++;
  }
  return { outcome: m.outcome(snap.state), plies, slowest };
}

describe('bots', () => {
  it('ships bots for the wave-1 games', () => {
    expect(modules.map((m) => m.manifest.gameId).sort()).toEqual(['checkers', 'chess', 'line-three', 'othello', 'snakes-ladders']);
  });

  for (const m of modules) {
    const id = m.manifest.gameId;
    // Chess and checkers games can run long; a ply cap still exercises openings, captures and the middle game.
    const cap = id === 'chess' ? 60 : id === 'checkers' ? 120 : 400;
    for (const level of LEVELS) {
      it(`${id}: ${level} vs ${level} plays only legal moves`, () => {
        const r = playOut(m, [level, level], 11, cap);
        if (cap === 400) expect(r.outcome).not.toBeNull();
        expect(r.slowest).toBeLessThan(MAX_DECIDE_MS);
      }, 60_000);
    }
  }

  it('snakes-ladders bot plays a 4-player game to the end', () => {
    const m = modules.find((x) => x.manifest.gameId === 'snakes-ladders')!;
    expect(playOut(m, ['easy', 'medium', 'hard', 'easy'], 3, 2000).outcome).not.toBeNull();
  });

  it('line-three hard never loses', () => {
    const m = modules.find((x) => x.manifest.gameId === 'line-three')!;
    for (let seed = 1; seed <= 20; seed++) {
      for (const [a, b] of [['hard', 'easy'], ['easy', 'hard'], ['hard', 'hard']] as BotLevel[][]) {
        const placements = playOut(m, [a!, b!], seed, 9).outcome!.placements;
        for (const seat of [0, 1]) {
          if ([a, b][seat] === 'hard') expect(placements.find((p) => p.seat === seat)!.place).toBe(1);
        }
      }
    }
  }, 60_000);

  it('othello hard beats easy in most games', () => {
    const m = modules.find((x) => x.manifest.gameId === 'othello')!;
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const r = playOut(m, seed % 2 ? ['hard', 'easy'] : ['easy', 'hard'], seed, 200);
      const hardSeat = seed % 2 ? 0 : 1;
      if (r.outcome!.placements.find((p) => p.seat === hardSeat)!.place === 1) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(5);
  }, 60_000);
});
