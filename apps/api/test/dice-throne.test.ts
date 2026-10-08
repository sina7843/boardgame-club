import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { dtModule } from '@bg/game-dice-throne';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('dice-throne through the platform', () => {
  it('is in the catalog for 2 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/dice-throne')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
  });

  it('hero picks and dice are validated and rolled on the server', async () => {
    const t = await startTable(ctx, 'dice-throne', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = (await view(ctx, t.players[0]!, t.tableId)).game.view;
    expect(v).not.toHaveProperty('fixedDice');
    const seat = v.current as number;
    const g = (await view(ctx, bySeat(seat), t.tableId)).game;
    expect((await command(ctx, bySeat(1 - seat), t.tableId, g.revision, { type: 'pickHero', hero: 0 })).json()).toMatchObject({ status: 'rejected' });
    expect((await command(ctx, bySeat(seat), t.tableId, g.revision, { type: 'pickHero', hero: 0 })).json()).toMatchObject({ status: 'accepted' });
    const g2 = (await view(ctx, bySeat(1 - seat), t.tableId)).game;
    expect((await command(ctx, bySeat(1 - seat), t.tableId, g2.revision, { type: 'pickHero', hero: 0 })).json()).toMatchObject({ status: 'rejected' });
    expect((await command(ctx, bySeat(1 - seat), t.tableId, g2.revision, { type: 'pickHero', hero: 2 })).json()).toMatchObject({ status: 'accepted' });
    const g3 = (await view(ctx, bySeat(seat), t.tableId)).game;
    expect((await command(ctx, bySeat(seat), t.tableId, g3.revision, { type: 'roll', keep: [false, false, false, false, false] })).json()).toMatchObject({ status: 'accepted' });
    expect((await view(ctx, bySeat(1 - seat), t.tableId)).game.view.rolled).toBe(true);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/dice-throne/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of dtModule.tutorial!.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
