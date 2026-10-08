import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { theMindModule } from '@bg/game-the-mind';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('the mind through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/the-mind')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('any seat may play out of turn; hands stay private', async () => {
    const t = await startTable(ctx, 'the-mind', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = (await view(ctx, bySeat(2), t.tableId)).game;
    expect(v.view.hand).toHaveLength(1);
    expect(v.view).not.toHaveProperty('hands');
    expect(v.view.handCount).toEqual([1, 1, 1]);
    expect((await command(ctx, bySeat(2), t.tableId, v.revision, { type: 'play' })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat(0), t.tableId)).game.view;
    // Either the card is on the pile, or it ended level 1 (both other cards were lower and got discarded).
    expect(after.pile.includes(v.view.hand[0]) || after.level === 2).toBe(true);
  });

  it('the interactive tutorial runs on the server to a team win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/the-mind/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of theMindModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result).toMatchObject({ reason: 'win' });
    expect(snap.game.result.placements.every((x: { place: number }) => x.place === 1)).toBe(true);
  });
});
