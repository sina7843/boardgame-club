import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { citadelsModule } from '@bg/game-citadels';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('citadels through the platform', () => {
  it('is in the catalog for 2–7 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/citadels')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 7, isTestGame: false });
  });

  it('picked characters stay secret; the face-down character never leaves the server', async () => {
    const t = await startTable(ctx, 'citadels', 4);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    expect(v.game.view).not.toHaveProperty('faceDown');
    expect(v.game.view).not.toHaveProperty('deck');
    const picker = (await view(ctx, bySeat(0), t.tableId)).game.view.crown as number;
    const pv = (await view(ctx, bySeat(picker), t.tableId)).game;
    const char = pv.view.pool[0];
    expect((await command(ctx, bySeat(picker), t.tableId, pv.revision, { type: 'pick', char })).json()).toMatchObject({ status: 'accepted' });
    const other = (await view(ctx, bySeat((picker + 1) % 4), t.tableId)).game.view;
    expect(other.pickCounts[picker]).toBe(1);
    expect(other.myPicks).toEqual([]);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/citadels/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of citadelsModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
