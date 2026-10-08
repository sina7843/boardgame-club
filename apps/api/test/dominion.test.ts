import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { domModule } from '@bg/game-dominion';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('dominion through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/dominion')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('hands and decks stay on the server; plays are validated there', async () => {
    const t = await startTable(ctx, 'dominion', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = (await view(ctx, t.players[0]!, t.tableId)).game.view;
    expect(v).not.toHaveProperty('players');
    expect(v.others.map((o: { hand: number }) => o.hand)).toEqual([5, 5, 5]);
    const seat = v.current as number;
    const g = (await view(ctx, bySeat(seat), t.tableId)).game;
    expect(g.view.hand).toHaveLength(5);
    expect((await command(ctx, bySeat(seat), t.tableId, g.revision, { type: 'buy', card: 'province' })).json()).toMatchObject({ status: 'rejected' });
    expect((await command(ctx, bySeat(seat), t.tableId, g.revision, { type: 'treasures' })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat((seat + 1) % 3), t.tableId)).game.view;
    expect(after.coins).toBeGreaterThanOrEqual(2);
    expect(after.hand).toHaveLength(5);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/dominion/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of domModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
