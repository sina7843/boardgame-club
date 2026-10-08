import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { cockroachModule } from '@bg/game-cockroach-poker';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('cockroach poker through the platform', () => {
  it('is in the catalog for 2–6 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/cockroach-poker')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 6, isTestGame: false });
  });

  it('the card in play is hidden from the receiver until they look; hands stay private', async () => {
    const t = await startTable(ctx, 'cockroach-poker', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    const mine = (await view(ctx, bySeat(cur), t.tableId)).game;
    const card = mine.view.hand[0];
    const to = (cur + 1) % 3;
    expect((await command(ctx, bySeat(cur), t.tableId, mine.revision, { type: 'give', card, to, claim: 'bat' })).json()).toMatchObject({ status: 'accepted' });
    const recv = (await view(ctx, bySeat(to), t.tableId)).game;
    expect(recv.view.chain).toMatchObject({ from: cur, to, claim: 'bat', card: null });
    expect(recv.view).not.toHaveProperty('hands');
    expect((await command(ctx, bySeat(to), t.tableId, recv.revision, { type: 'peek' })).json()).toMatchObject({ status: 'accepted' });
    expect((await view(ctx, bySeat(to), t.tableId)).game.view.chain.card).toBe(card);
    expect((await view(ctx, bySeat((cur + 2) % 3), t.tableId)).game.view.chain.card).toBeNull();
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/cockroach-poker/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of cockroachModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
