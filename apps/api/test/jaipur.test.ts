import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { jaipurModule } from '@bg/game-jaipur';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('jaipur through the platform', () => {
  it('is in the catalog for exactly two players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/jaipur')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
  });

  it('hands, deck and bonus values stay private', async () => {
    const t = await startTable(ctx, 'jaipur', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    const mine = (await view(ctx, bySeat(cur), t.tableId)).game;
    expect((await command(ctx, bySeat(cur), t.tableId, mine.revision, { type: 'camels' })).json()).toMatchObject({ status: 'accepted' });
    const other = (await view(ctx, bySeat(1 - cur), t.tableId)).game.view;
    expect(other.herds[cur]).toBeGreaterThanOrEqual(3);
    expect(other).not.toHaveProperty('hands');
    expect(other).not.toHaveProperty('deck');
    expect(other).not.toHaveProperty('bonus');
    expect(other.bonuses[cur]).toBe(0);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/jaipur/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of jaipurModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
