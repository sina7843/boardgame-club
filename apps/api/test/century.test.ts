import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { centuryModule } from '@bg/game-century';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('century through the platform', () => {
  it('is in the catalog for 2–5 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/century')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 5, isTestGame: false });
  });

  it('playing a spice card fills the caravan; decks never reach clients', async () => {
    const t = await startTable(ctx, 'century', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    expect(v.game.view).not.toHaveProperty('mdeck');
    expect(v.game.view).not.toHaveProperty('odeck');
    const before = v.game.view.cubes[cur].y;
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'play', card: 0 })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat((cur + 1) % 3), t.tableId)).game.view;
    expect(after.cubes[cur].y).toBe(before + 2);
    expect(after.played[cur]).toEqual([0]);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/century/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of centuryModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
