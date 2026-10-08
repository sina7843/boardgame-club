import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { sixNimmtModule } from '@bg/game-six-nimmt';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('6 nimmt! through the platform', () => {
  it('is in the catalog for 2–10 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/six-nimmt')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 10, isTestGame: false });
  });

  it('hands and chosen cards stay private until everyone has chosen', async () => {
    const t = await startTable(ctx, 'six-nimmt', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v0 = await view(ctx, bySeat(0), t.tableId);
    const card = v0.game.view.hand[0];
    expect((await command(ctx, bySeat(0), t.tableId, v0.game.revision, { type: 'play', card })).json()).toMatchObject({ status: 'accepted' });
    const v1 = await view(ctx, bySeat(1), t.tableId);
    expect(v1.game.view.chosen).toEqual([true, false, false]);
    expect(v1.game.view.hand).not.toContain(card);
    expect(v1.game.view.hands).toBeUndefined();
    expect(v1.game.pendingSeats.sort()).toEqual([1, 2]);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/six-nimmt/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of sixNimmtModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
