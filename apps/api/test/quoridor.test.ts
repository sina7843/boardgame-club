import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { quoridorModule } from '@bg/game-quoridor';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('quoridor through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/quoridor')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('moves and walls are validated on the server', async () => {
    const t = await startTable(ctx, 'quoridor', 4);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    const pawn = v.game.view.pawns[cur] as number;
    expect((await command(ctx, bySeat((cur + 1) % 4), t.tableId, v.game.revision, { type: 'wall', r: 3, c: 3, o: 'h' })).json().errorCode).toBe('NOT_YOUR_TURN');
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'move', to: (pawn + 40) % 81 })).json().errorCode).toBe('ILLEGAL_MOVE');
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'wall', r: 3, c: 3, o: 'h' })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat(cur), t.tableId)).game.view;
    expect(after.walls).toEqual([{ r: 3, c: 3, o: 'h' }]);
    expect(after.wallsLeft[cur]).toBe(4);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/quoridor/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of quoridorModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
