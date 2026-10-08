import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { skullModule } from '@bg/game-skull';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('skull through the platform', () => {
  it('is in the catalog for 2–6 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/skull')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 6, isTestGame: false });
  });

  it('placed discs stay face down for everyone else', async () => {
    const t = await startTable(ctx, 'skull', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const cur = v.game.view.current as number;
    expect((await command(ctx, bySeat(cur), t.tableId, v.game.revision, { type: 'place', disc: 'skull' })).json()).toMatchObject({ status: 'accepted' });
    const mine = (await view(ctx, bySeat(cur), t.tableId)).game.view;
    expect(mine.myStack).toEqual(['skull']);
    const other = (await view(ctx, bySeat((cur + 1) % 3), t.tableId)).game.view;
    expect(other.stackCounts[cur]).toBe(1);
    expect(other.stacks).toBeUndefined();
    expect(other.myStack).toEqual([]);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/skull/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of skullModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
