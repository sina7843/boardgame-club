import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { kotModule } from '@bg/game-king-of-tokyo';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('king of tokyo through the platform', () => {
  it('is in the catalog for 2–6 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/king-of-tokyo')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 6, isTestGame: false });
  });

  it('dice are rolled on the server; the power deck order is never sent', async () => {
    const t = await startTable(ctx, 'king-of-tokyo', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    expect(v.game.view).not.toHaveProperty('deck');
    expect(v.game.view.market).toHaveLength(3);
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'roll', keep: [false, false, false, false, false, false] })).json()).toMatchObject({ status: 'accepted' });
    expect((await view(ctx, bySeat((cur + 1) % 3), t.tableId)).game.view.dice).toHaveLength(6);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/king-of-tokyo/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of kotModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
