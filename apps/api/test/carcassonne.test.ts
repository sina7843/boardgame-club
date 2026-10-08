import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { carcModule } from '@bg/game-carcassonne';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('carcassonne through the platform', () => {
  it('is in the catalog for 2–5 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/carcassonne')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 5, isTestGame: false });
  });

  it('only the drawn tile is public; a placement is validated on the server', async () => {
    const t = await startTable(ctx, 'carcassonne', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = (await view(ctx, t.players[0]!, t.tableId)).game.view;
    expect(v).not.toHaveProperty('stack');
    expect(typeof v.tile).toBe('string');
    const seat = v.current as number;
    const g = (await view(ctx, bySeat(seat), t.tableId)).game;
    expect((await command(ctx, bySeat(seat), t.tableId, g.revision, { type: 'place', x: 9, y: 9, rot: 0 })).json()).toMatchObject({ status: 'rejected' });
    const opt = g.legalActions.find((a: { type: string }) => a.type === 'place').options[0];
    expect((await command(ctx, bySeat(seat), t.tableId, g.revision, { type: 'place', ...opt })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat((seat + 1) % 3), t.tableId)).game.view;
    expect(Object.keys(after.board)).toHaveLength(2);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/carcassonne/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of carcModule.tutorial!.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
