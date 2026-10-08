import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { lostCitiesModule } from '@bg/game-lost-cities';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('lost cities through the platform', () => {
  it('is in the catalog for exactly two players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/lost-cities')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
  });

  it('hands stay private; a discard is public and cannot be drawn straight back', async () => {
    const t = await startTable(ctx, 'lost-cities', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    const mine = (await view(ctx, bySeat(cur), t.tableId)).game;
    const card = mine.view.hand[0] as string;
    expect((await command(ctx, bySeat(cur), t.tableId, mine.revision, { type: 'discard', card })).json()).toMatchObject({ status: 'accepted' });
    const other = (await view(ctx, bySeat(1 - cur), t.tableId)).game.view;
    expect(other.discard[card[0]!]).toEqual([card]);
    expect(other.handCount[cur]).toBe(7);
    expect(other).not.toHaveProperty('hands');
    expect(other).not.toHaveProperty('deck');
    const again = (await view(ctx, bySeat(cur), t.tableId)).game;
    expect((await command(ctx, bySeat(cur), t.tableId, again.revision, { type: 'draw', from: card[0] })).json()).toMatchObject({ status: 'rejected' });
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/lost-cities/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of lostCitiesModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
