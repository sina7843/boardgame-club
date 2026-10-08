import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { kingdominoModule } from '@bg/game-kingdomino';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('kingdomino through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/kingdomino')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('the first line is picked in king order; the deck never reaches clients', async () => {
    const t = await startTable(ctx, 'kingdomino', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const actor = v.game.view.actor as number;
    expect(v.game.view).not.toHaveProperty('deck');
    expect(v.game.view.deckCount).toBe(20);
    expect((await command(ctx, bySeat(actor), t.tableId, v.game.revision, { type: 'pick', slot: 1 })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat(0), t.tableId)).game.view;
    expect(after.next[1].owner).toBe(actor);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/kingdomino/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of kingdominoModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
