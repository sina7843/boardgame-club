import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { goModule } from '@bg/game-go';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('go through the platform', () => {
  it('is in the catalog with size, komi and colour options', async () => {
    const g = (await call(ctx, 'GET', '/api/games/go')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['size', 'komi', 'firstMove']);
  });

  it('black plays first; occupied points are refused; the superko table is never sent', async () => {
    const t = await startTable(ctx, 'go', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const black = v.game.view.colors.indexOf('b') as number;
    expect((await command(ctx, bySeat(1 - black), t.tableId, v.game.revision, { type: 'place', at: 40 })).json().errorCode).toBe('NOT_YOUR_TURN');
    expect((await command(ctx, bySeat(black), t.tableId, v.game.revision, { type: 'place', at: 40 })).json()).toMatchObject({ status: 'accepted' });
    const v2 = await view(ctx, bySeat(1 - black), t.tableId);
    expect((await command(ctx, bySeat(1 - black), t.tableId, v2.game.revision, { type: 'place', at: 40 })).json().errorCode).toBe('POINT_TAKEN');
    expect(v2.game.view.seen).toBeUndefined();
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/go/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of goModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
