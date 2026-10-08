import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { santoriniModule } from '@bg/game-santorini';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('santorini through the platform', () => {
  it('is in the catalog', async () => {
    const g = (await call(ctx, 'GET', '/api/games/santorini')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
  });

  it('setup placements and a whole turn are validated on the server', async () => {
    const t = await startTable(ctx, 'santorini', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    let v = await view(ctx, t.players[0]!, t.tableId);
    const first = v.game.view.current as number;
    for (const [seat, at] of [[first, 6], [first, 8], [1 - first, 16], [1 - first, 18]] as const) {
      v = await view(ctx, bySeat(seat), t.tableId);
      expect((await command(ctx, bySeat(seat), t.tableId, v.game.revision, { type: 'place', at })).json()).toMatchObject({ status: 'accepted' });
    }
    v = await view(ctx, bySeat(first), t.tableId);
    expect(v.game.view.phase).toBe('play');
    expect((await command(ctx, bySeat(first), t.tableId, v.game.revision, { type: 'turn', from: 6, to: 12, build: 24 })).json().errorCode).toBe('ILLEGAL_MOVE');
    expect((await command(ctx, bySeat(first), t.tableId, v.game.revision, { type: 'turn', from: 6, to: 12, build: 13 })).json()).toMatchObject({ status: 'accepted' });
    expect((await view(ctx, bySeat(first), t.tableId)).game.view.height[13]).toBe(1);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/santorini/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of santoriniModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
