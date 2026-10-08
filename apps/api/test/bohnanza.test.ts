import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { beanModule } from '@bg/game-bohnanza';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('bohnanza through the platform', () => {
  it('is in the catalog for 2–5 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/bohnanza')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 5, isTestGame: false });
  });

  it('hands and deck stay on the server; a planting is validated there', async () => {
    const t = await startTable(ctx, 'bohnanza', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = (await view(ctx, t.players[0]!, t.tableId)).game.view;
    expect(v).not.toHaveProperty('deck');
    expect(v).not.toHaveProperty('hands');
    expect(v.handCounts).toEqual([5, 5, 5]);
    const seat = v.current as number;
    const g = (await view(ctx, bySeat(seat), t.tableId)).game;
    expect(g.view.hand).toHaveLength(5);
    expect((await command(ctx, bySeat(seat), t.tableId, g.revision, { type: 'flip' })).json()).toMatchObject({ status: 'rejected' });
    expect((await command(ctx, bySeat(seat), t.tableId, g.revision, { type: 'plant', field: 0 })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat((seat + 1) % 3), t.tableId)).game.view;
    expect(after.fields[seat][0].n).toBe(1);
    expect(after.hand).toHaveLength(5);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/bohnanza/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of beanModule.tutorial!.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
