import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { duelModule } from '@bg/game-wonders-duel';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('wonders-duel through the platform', () => {
  it('is in the catalog for 2 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/wonders-duel')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
  });

  it('face-down cards stay on the server; the draft is validated there', async () => {
    const t = await startTable(ctx, 'wonders-duel', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = (await view(ctx, t.players[0]!, t.tableId)).game.view;
    expect(v).not.toHaveProperty('progressOut');
    expect(v.structure.filter((x: { up: boolean; card: number | null }) => !x.up).every((x: { card: number | null }) => x.card === null)).toBe(true);
    const seat = v.first as number;
    const g = (await view(ctx, bySeat(seat), t.tableId)).game;
    expect((await command(ctx, bySeat(1 - seat), t.tableId, g.revision, { type: 'draftWonder', wonder: g.view.draftPool[0] })).json()).toMatchObject({ status: 'rejected' });
    expect((await command(ctx, bySeat(seat), t.tableId, g.revision, { type: 'draftWonder', wonder: g.view.draftPool[0] })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat(1 - seat), t.tableId)).game.view;
    expect(after.wonders[seat]).toHaveLength(1);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/wonders-duel/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of duelModule.tutorial!.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
