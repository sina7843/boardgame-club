import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { bsModule } from '@bg/game-battleship';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('battleship through the platform', () => {
  it('is in the catalog for 2 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/battleship')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
  });

  it('fleets stay secret on the server; invalid fleets are refused', async () => {
    const t = await startTable(ctx, 'battleship', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const fleet = [0, 1, 2, 3, 4].map((ship) => ({ ship, x: 0, y: ship, dir: 'h' }));
    const g0 = (await view(ctx, bySeat(0), t.tableId)).game;
    expect((await command(ctx, bySeat(0), t.tableId, g0.revision, { type: 'place', ships: [...fleet.slice(0, 4), { ship: 4, x: 0, y: 0, dir: 'v' }] })).json()).toMatchObject({ status: 'rejected' });
    expect((await command(ctx, bySeat(0), t.tableId, g0.revision, { type: 'place', ships: fleet })).json()).toMatchObject({ status: 'accepted' });
    const other = (await view(ctx, bySeat(1), t.tableId)).game.view;
    expect(other.seas[0].ships).toEqual([]);
    expect(other.placed).toEqual([true, false]);
    expect((await view(ctx, bySeat(0), t.tableId)).game.view.seas[0].ships).toHaveLength(5);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/battleship/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of bsModule.tutorial!.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
