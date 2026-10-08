import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { pointSaladModule } from '@bg/game-point-salad';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('point salad through the platform', () => {
  it('is in the catalog for 2–6 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/point-salad')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 6, isTestGame: false });
  });

  it('taking two vegetables refills the market; pile order stays hidden', async () => {
    const t = await startTable(ctx, 'point-salad', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    expect(v.game.view).not.toHaveProperty('piles');
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'veg', slots: [0, 1] })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat((cur + 1) % 3), t.tableId)).game.view;
    expect(after.veggies[cur]).toHaveLength(2);
    expect(after.market.every((x: number | null) => x !== null)).toBe(true);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/point-salad/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of pointSaladModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
