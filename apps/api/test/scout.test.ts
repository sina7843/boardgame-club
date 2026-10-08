import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { scoutModule } from '@bg/game-scout';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('scout through the platform', () => {
  it('is in the catalog for 2–5 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/scout')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 5, isTestGame: false });
  });

  it('everyone orients at once; hands stay private', async () => {
    const t = await startTable(ctx, 'scout', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, bySeat(1), t.tableId);
    expect(v.game.view.phase).toBe('orient');
    expect(v.game.view.hand).toHaveLength(12);
    expect(v.game.view).not.toHaveProperty('hands');
    expect((await command(ctx, bySeat(1), t.tableId, v.game.revision, { type: 'orient', flip: true })).json()).toMatchObject({ status: 'accepted' });
    const w = (await view(ctx, bySeat(2), t.tableId)).game.view;
    expect(w.oriented).toEqual([false, true, false]);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/scout/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of scoutModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
