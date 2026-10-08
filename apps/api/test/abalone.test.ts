import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { abaloneModule, legalMoves } from '@bg/game-abalone';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('abalone through the platform', () => {
  it('is in the catalog', async () => {
    const g = (await call(ctx, 'GET', '/api/games/abalone')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
  });

  it('black moves first; illegal groups are refused', async () => {
    const t = await startTable(ctx, 'abalone', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const black = v.game.view.colors.indexOf('b') as number;
    const mv = legalMoves(v.game.view.board, 'b')[0]!;
    expect((await command(ctx, bySeat(1 - black), t.tableId, v.game.revision, { type: 'move', ...mv })).json().errorCode).toBe('NOT_YOUR_TURN');
    expect((await command(ctx, bySeat(black), t.tableId, v.game.revision, { type: 'move', marbles: [0], dir: 0 })).json().errorCode).toBe('ILLEGAL_MOVE');
    expect((await command(ctx, bySeat(black), t.tableId, v.game.revision, { type: 'move', ...mv })).json()).toMatchObject({ status: 'accepted' });
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/abalone/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of abaloneModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
