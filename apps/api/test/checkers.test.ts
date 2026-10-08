import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { checkersModule } from '@bg/game-checkers';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('checkers through the platform', () => {
  it('is in the catalog with its rule variants', async () => {
    const g = (await call(ctx, 'GET', '/api/games/checkers')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['variant', 'firstMove']);
  });

  it('dark moves first; only legal paths are accepted', async () => {
    const t = await startTable(ctx, 'checkers', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const dark = v.game.view.colors.indexOf('d') as number;
    expect(v.game.view.current).toBe(dark);
    expect((await command(ctx, bySeat(1 - dark), t.tableId, v.game.revision, { type: 'move', path: [41, 32] })).json().errorCode).toBe('NOT_YOUR_TURN');
    expect((await command(ctx, bySeat(dark), t.tableId, v.game.revision, { type: 'move', path: [18, 26] })).json().errorCode).toBe('ILLEGAL_MOVE');
    expect((await command(ctx, bySeat(dark), t.tableId, v.game.revision, { type: 'move', path: [18, 27] })).json()).toMatchObject({ status: 'accepted' });
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/checkers/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of checkersModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
