import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { sspModule } from '@bg/game-sea-salt-paper';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('sea salt and paper through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/sea-salt-paper')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('the two drawn cards are visible only to the drawer; hands stay private', async () => {
    const t = await startTable(ctx, 'sea-salt-paper', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    const mine = (await view(ctx, bySeat(cur), t.tableId)).game;
    expect((await command(ctx, bySeat(cur), t.tableId, mine.revision, { type: 'draw' })).json()).toMatchObject({ status: 'accepted' });
    expect((await view(ctx, bySeat(cur), t.tableId)).game.view.drawn).toHaveLength(2);
    const other = (await view(ctx, bySeat(1 - cur), t.tableId)).game.view;
    expect(other.drawn).toBeNull();
    expect(other).not.toHaveProperty('hands');
    expect(other).not.toHaveProperty('deck');
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/sea-salt-paper/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of sspModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
