import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { raModule } from '@bg/game-res-arcana';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('res-arcana through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/res-arcana')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('hands and decks stay on the server; plays are validated there', async () => {
    const t = await startTable(ctx, 'res-arcana', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = (await view(ctx, t.players[0]!, t.tableId)).game.view;
    expect(v).not.toHaveProperty('players');
    expect(v).not.toHaveProperty('monumentDeck');
    expect(v.mages.map((o: { hand: number }) => o.hand)).toEqual([3, 3, 3]);
    const seat = v.current as number;
    const g = (await view(ctx, bySeat(seat), t.tableId)).game;
    expect(g.view.hand).toHaveLength(3);
    expect((await command(ctx, bySeat(seat), t.tableId, g.revision, { type: 'buy', card: g.view.places[0] })).json()).toMatchObject({ status: 'rejected' });
    expect((await command(ctx, bySeat(seat), t.tableId, g.revision, { type: 'pass' })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat((seat + 1) % 3), t.tableId)).game.view;
    expect(after.current).toBe((seat + 1) % 3);
    expect(after.mages[seat].hand).toBe(4);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/res-arcana/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of raModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
