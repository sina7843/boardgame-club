import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { forSaleModule } from '@bg/game-for-sale';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('for sale through the platform', () => {
  it('is in the catalog for 2–6 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/for-sale')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 6, isTestGame: false });
  });

  it('bought properties stay in the buyer’s hand; decks never reach clients', async () => {
    const t = await startTable(ctx, 'for-sale', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'pass' })).json()).toMatchObject({ status: 'accepted' });
    const mine = (await view(ctx, bySeat(cur), t.tableId)).game.view;
    expect(mine.owned[cur]).toHaveLength(1);
    const other = (await view(ctx, bySeat((cur + 1) % 3), t.tableId)).game.view;
    expect(other.owned[cur]).toEqual([]);
    expect(other.ownedCount[cur]).toBe(1);
    expect(other).not.toHaveProperty('props');
    expect(other).not.toHaveProperty('cheques');
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/for-sale/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of forSaleModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
