import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { hiveModule } from '@bg/game-hive';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('hive through the platform', () => {
  it('is in the catalog', async () => {
    const g = (await call(ctx, 'GET', '/api/games/hive')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
  });

  it('white places first in the centre; moves before the queen are refused', async () => {
    const t = await startTable(ctx, 'hive', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    let v = await view(ctx, t.players[0]!, t.tableId);
    const white = v.game.view.colors.indexOf('w') as number;
    expect((await command(ctx, bySeat(white), t.tableId, v.game.revision, { type: 'place', bug: 'A', to: [3, 3] })).json().errorCode).toBe('ILLEGAL_MOVE');
    expect((await command(ctx, bySeat(white), t.tableId, v.game.revision, { type: 'place', bug: 'A', to: [0, 0] })).json()).toMatchObject({ status: 'accepted' });
    v = await view(ctx, bySeat(1 - white), t.tableId);
    expect((await command(ctx, bySeat(1 - white), t.tableId, v.game.revision, { type: 'move', from: [0, 0], to: [1, 0] })).json().errorCode).toBe('QUEEN_FIRST');
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/hive/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of hiveModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
