import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { onitamaModule } from '@bg/game-onitama';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('onitama through the platform', () => {
  it('is in the catalog', async () => {
    const g = (await call(ctx, 'GET', '/api/games/onitama')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
  });

  it('cards are public; a move must use one of your two cards', async () => {
    const t = await startTable(ctx, 'onitama', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    const mine = await view(ctx, bySeat(cur), t.tableId);
    const legal = mine.game.legalActions.find((a: { type: string }) => a.type === 'move');
    const otherCard = v.game.view.hands[1 - cur][0];
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { ...legal, card: otherCard })).json().errorCode).toBe('NOT_YOUR_CARD');
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, legal)).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat(cur), t.tableId)).game.view;
    expect(after.side).toBe(legal.card);
    expect(after.seen).toBeUndefined();
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/onitama/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of onitamaModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
