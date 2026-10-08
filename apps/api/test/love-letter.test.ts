import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { loveLetterModule } from '@bg/game-love-letter';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('love letter through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/love-letter')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('each player only sees their own hand; the deck never leaves the server', async () => {
    const t = await startTable(ctx, 'love-letter', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    const mine = await view(ctx, bySeat(cur), t.tableId);
    expect(mine.game.view.hand).toHaveLength(2);
    expect(mine.game.view.hands).toBeUndefined();
    expect(mine.game.view.deck).toBeUndefined();
    const other = await view(ctx, bySeat((cur + 1) % 3), t.tableId);
    expect(other.game.view.hand).toHaveLength(1);
    expect((await command(ctx, bySeat((cur + 1) % 3), t.tableId, v.game.revision, { type: 'play', card: other.game.view.hand[0] })).json().errorCode).toBe('NOT_YOUR_TURN');
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/love-letter/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of loveLetterModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
