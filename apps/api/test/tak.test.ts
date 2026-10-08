import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { takModule } from '@bg/game-tak';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('tak through the platform', () => {
  it('is in the catalog with size and colour options', async () => {
    const g = (await call(ctx, 'GET', '/api/games/tak')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['size', 'firstMove']);
  });

  it('the opening places an opponent flat; walls are refused on the first turn', async () => {
    const t = await startTable(ctx, 'tak', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const white = v.game.view.colors.indexOf('w') as number;
    expect((await command(ctx, bySeat(white), t.tableId, v.game.revision, { type: 'place', at: 0, kind: 'S' })).json().errorCode).toBe('FIRST_MOVE_FLAT');
    expect((await command(ctx, bySeat(white), t.tableId, v.game.revision, { type: 'place', at: 0, kind: 'F' })).json()).toMatchObject({ status: 'accepted' });
    expect((await view(ctx, bySeat(white), t.tableId)).game.view.board[0]).toEqual([{ c: 'b', t: 'F' }]);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/tak/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of takModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
