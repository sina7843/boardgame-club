import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { azulModule } from '@bg/game-azul';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('azul through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/azul')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('a take moves the rest of the factory to the centre; the bag order is never sent', async () => {
    const t = await startTable(ctx, 'azul', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    const f0 = v.game.view.factories[0] as string[];
    expect(v.game.view).not.toHaveProperty('bag');
    expect(v.game.view.bagCount).toBe(80);
    const r = await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'take', from: 0, color: f0[0], line: 'floor' });
    expect(r.json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat(1 - cur), t.tableId)).game.view;
    expect(after.factories[0]).toEqual([]);
    expect(after.center.length).toBe(f0.filter((c) => c !== f0[0]).length);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/azul/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of azulModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
