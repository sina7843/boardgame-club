import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { amlakModule } from '@bg/game-amlak';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('amlak through the platform', () => {
  it('is in the catalog with its rule variants', async () => {
    const g = (await call(ctx, 'GET', '/api/games/amlak')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 8, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['gameLength', 'auction', 'freeParking', 'doubleGo']);
  });

  it('the server rolls; only the current player may act; card order never leaves the server', async () => {
    const t = await startTable(ctx, 'amlak', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const current = v.game.view.current as number;
    expect((await command(ctx, bySeat((current + 1) % 3), t.tableId, v.game.revision, { type: 'roll' })).json().errorCode).toBe('NOT_YOUR_TURN');
    expect((await command(ctx, bySeat(current), t.tableId, v.game.revision, { type: 'roll' })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat(current), t.tableId)).game.view;
    expect(after.lastRoll).toHaveLength(2);
    expect(after.chance).toBeUndefined();
    expect(after.chest).toBeUndefined();
    expect(after.deckCounts.chance + after.deckCounts.chest).toBeGreaterThanOrEqual(30);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/amlak/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of amlakModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
