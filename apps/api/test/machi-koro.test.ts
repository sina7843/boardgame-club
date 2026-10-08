import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { machiModule } from '@bg/game-machi-koro';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('machi koro through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/machi-koro')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('rolling pays out on the server; you cannot build before rolling', async () => {
    const t = await startTable(ctx, 'machi-koro', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'build', card: 'wheat' })).json()).toMatchObject({ status: 'rejected' });
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'roll', dice: 1 })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat(cur), t.tableId)).game.view;
    expect(after.dice).toHaveLength(1);
    expect(after.phase).toBe('build');
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/machi-koro/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of machiModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
