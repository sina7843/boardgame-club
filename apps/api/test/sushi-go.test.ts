import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { sushiGoModule } from '@bg/game-sushi-go';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('sushi go through the platform', () => {
  it('is in the catalog for 2–5 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/sushi-go')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 5, isTestGame: false });
  });

  it('hands and picks stay private until everyone has picked', async () => {
    const t = await startTable(ctx, 'sushi-go', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, bySeat(0), t.tableId);
    expect(v.game.view.hand).toHaveLength(9);
    expect((await command(ctx, bySeat(0), t.tableId, v.game.revision, { type: 'pick', card: v.game.view.hand[0] })).json()).toMatchObject({ status: 'accepted' });
    const other = (await view(ctx, bySeat(1), t.tableId)).game.view;
    expect(other.picked).toEqual([true, false, false]);
    expect(other.table[0]).toEqual([]);
    expect(other).not.toHaveProperty('hands');
    expect(other).not.toHaveProperty('deck');
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/sushi-go/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of sushiGoModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
