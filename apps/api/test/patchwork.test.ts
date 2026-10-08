import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { patchworkModule } from '@bg/game-patchwork';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('patchwork through the platform', () => {
  it('is in the catalog for exactly two players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/patchwork')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
  });

  it('buying a patch sews it and moves time; a bad placement is rejected', async () => {
    const t = await startTable(ctx, 'patchwork', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    const bad = await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'buy', patch: 0, rot: 0, flip: false, row: 8, col: 8 });
    expect(bad.json()).toMatchObject({ status: 'rejected' });
    const ok = await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'buy', patch: 0, rot: 0, flip: false, row: 0, col: 0 });
    expect(ok.json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat(1 - cur), t.tableId)).game.view;
    expect(after.quilts[cur][0].slice(0, 2)).toEqual([0, 0]);
    expect(after.buttons[cur]).toBe(3);
    expect(after).not.toHaveProperty('timeouts');
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/patchwork/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of patchworkModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
