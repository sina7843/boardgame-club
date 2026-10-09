import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { cryptidModule } from '@bg/game-cryptid';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

type Hint = { type: string; target?: number; cells?: number[] };

describe('cryptid through the platform', () => {
  it('is in the catalog for 3–5 players with the advanced-mode variant', async () => {
    const g = (await call(ctx, 'GET', '/api/games/cryptid')).json();
    expect(g).toMatchObject({ minPlayers: 3, maxPlayers: 5, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['mode']);
  });

  it('a three-player table plays to a result; each player sees only their own clue', async () => {
    const t = await startTable(ctx, 'cryptid', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const first = await Promise.all(t.players.map((u) => view(ctx, u, t.tableId)));
    for (const v of first) {
      expect(v.game.view.myClue).toBeTruthy();
      expect(v.game.view.reveal).toBeNull();
      const json = JSON.stringify(v.game.view);
      expect(json).not.toContain('"clues"');
      expect(json).not.toContain('"answer"');
    }
    expect(new Set(first.map((v) => JSON.stringify(v.game.view.myClue))).size).toBe(3);

    let snap = first[0]!;
    for (let n = 0; n < 600 && snap.table.status !== 'finished'; n++) {
      const seat = snap.game.view.current as number;
      const me = await view(ctx, bySeat(seat), t.tableId);
      const hints = me.game.legalActions as Hint[];
      const cube = hints.find((h) => h.type === 'placeCube');
      const search = hints.find((h) => h.type === 'search');
      const action = cube ? { type: 'placeCube', cell: cube.cells![0] } : { type: 'search', cell: search!.cells![n % search!.cells!.length] };
      const r = await command(ctx, bySeat(seat), t.tableId, me.game.revision, action);
      expect(r.json().status, JSON.stringify(action)).toBe('accepted');
      snap = await view(ctx, bySeat(seat), t.tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.filter((p: { place: number }) => p.place === 1)).toHaveLength(1);
    expect(snap.game.view.reveal.clues).toHaveLength(3);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/cryptid/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    expect(snap.game.view.myClue).toEqual({ d: 1, a: 'forest', not: false });
    for (const step of cryptidModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
    expect(snap.game.view.reveal.answer).toBe(40);
  });
});
