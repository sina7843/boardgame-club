import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { rgModule } from '@bg/game-race-galaxy';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('race-galaxy through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/race-galaxy')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('hands and decks stay on the server; plays are validated there', async () => {
    const t = await startTable(ctx, 'race-galaxy', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = (await view(ctx, t.players[0]!, t.tableId)).game.view;
    expect(v).not.toHaveProperty('players');
    expect(v).not.toHaveProperty('deck');
    expect(v.empires.map((o: { hand: number }) => o.hand)).toEqual([4, 4, 4]);
    const seat = 0;
    const g = (await view(ctx, bySeat(seat), t.tableId)).game;
    expect(g.view.hand).toHaveLength(4);
    expect((await command(ctx, bySeat(seat), t.tableId, g.revision, { type: 'keep', card: g.view.hand[0] })).json()).toMatchObject({ status: 'rejected' });
    expect((await command(ctx, bySeat(seat), t.tableId, g.revision, { type: 'choose', phase: 'develop' })).json()).toMatchObject({ status: 'accepted' });
    const other = (await view(ctx, bySeat(1), t.tableId)).game.view;
    expect(other.empires[seat].chose).toBe(true);
    expect(other.myChoice).toBeNull();
    expect(JSON.stringify(other)).not.toContain('develop');
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/race-galaxy/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of rgModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
