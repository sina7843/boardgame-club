import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { othelloModule } from '@bg/game-othello';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('othello through the platform', () => {
  it('is in the catalog', async () => {
    const g = (await call(ctx, 'GET', '/api/games/othello')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['firstMove']);
  });

  it('black moves first; only outflanking moves are accepted', async () => {
    const t = await startTable(ctx, 'othello', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const black = v.game.view.colors.indexOf('b') as number;
    expect((await command(ctx, bySeat(1 - black), t.tableId, v.game.revision, { type: 'place', sq: 19 })).json().errorCode).toBe('NOT_YOUR_TURN');
    expect((await command(ctx, bySeat(black), t.tableId, v.game.revision, { type: 'place', sq: 0 })).json().errorCode).toBe('ILLEGAL_MOVE');
    expect((await command(ctx, bySeat(black), t.tableId, v.game.revision, { type: 'place', sq: 19 })).json()).toMatchObject({ status: 'accepted' });
    expect((await view(ctx, bySeat(black), t.tableId)).game.view.counts).toEqual({ b: 4, w: 1 });
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/othello/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of othelloModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
