import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { noThanksModule } from '@bg/game-no-thanks';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('no thanks through the platform', () => {
  it('is in the catalog for 2–7 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/no-thanks')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 7, isTestGame: false });
  });

  it('chip counts of others stay secret; passing costs a chip', async () => {
    const t = await startTable(ctx, 'no-thanks', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    const mine = await view(ctx, bySeat(cur), t.tableId);
    expect(mine.game.view.chips.filter((c: number | null) => c !== null)).toEqual([11]);
    expect(mine.game.view.deck).toBeUndefined();
    expect((await command(ctx, bySeat((cur + 1) % 3), t.tableId, v.game.revision, { type: 'pass' })).json().errorCode).toBe('NOT_YOUR_TURN');
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'pass' })).json()).toMatchObject({ status: 'accepted' });
    expect((await view(ctx, bySeat(cur), t.tableId)).game.view.chips[cur]).toBe(10);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/no-thanks/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of noThanksModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
