import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { camelModule } from '@bg/game-camel-up';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('camel up through the platform', () => {
  it('is in the catalog for 2–8 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/camel-up')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 8, isTestGame: false });
  });

  it('overall bets stay secret from the other players', async () => {
    const t = await startTable(ctx, 'camel-up', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'overall', camel: 'blue', which: 'win' })).json()).toMatchObject({ status: 'accepted' });
    const mine = (await view(ctx, bySeat(cur), t.tableId)).game.view;
    expect(mine.myOverall).toEqual([{ which: 'win', camel: 'blue' }]);
    const other = (await view(ctx, bySeat((cur + 1) % 3), t.tableId)).game.view;
    expect(other.winnerCount).toBe(1);
    expect(other.myOverall).toEqual([]);
    expect(other).not.toHaveProperty('winnerBets');
    expect(other).not.toHaveProperty('dice');
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/camel-up/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of camelModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
