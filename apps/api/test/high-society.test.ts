import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { highSocietyModule } from '@bg/game-high-society';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('high society through the platform', () => {
  it('is in the catalog for 2–5 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/high-society')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 5, isTestGame: false });
  });

  it('money in hand stays private; open bids are public', async () => {
    const t = await startTable(ctx, 'high-society', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'bid', cards: [25] })).json()).toMatchObject({ status: 'accepted' });
    const other = (await view(ctx, bySeat((cur + 1) % 3), t.tableId)).game.view;
    expect(other.bids[cur]).toEqual([25]);
    expect(other.handCount[cur]).toBe(10);
    expect(other.hand).toHaveLength(11);
    expect(other).not.toHaveProperty('hands');
    expect(other).not.toHaveProperty('deck');
    expect(other.money).toBeNull();
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/high-society/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of highSocietyModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
