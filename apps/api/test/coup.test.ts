import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { coupModule } from '@bg/game-coup';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('coup through the platform', () => {
  it('is in the catalog for 2–6 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/coup')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 6, isTestGame: false });
  });

  it('influence cards stay hidden from everyone else; claims open a response window for the others', async () => {
    const t = await startTable(ctx, 'coup', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    const mine = (await view(ctx, bySeat(cur), t.tableId)).game.view;
    expect(mine.myCards).toHaveLength(2);
    const other = (await view(ctx, bySeat((cur + 1) % 3), t.tableId)).game.view;
    expect(other.cards[cur]).toEqual({ revealed: [], hidden: 2 });
    expect(other).not.toHaveProperty('deck');
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'act', act: 'tax' })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat((cur + 1) % 3), t.tableId)).game;
    expect(after.view.phase).toBe('respond');
    expect(after.legalActions.map((a: { type: string }) => a.type)).toEqual(expect.arrayContaining(['challenge', 'pass']));
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/coup/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of coupModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
