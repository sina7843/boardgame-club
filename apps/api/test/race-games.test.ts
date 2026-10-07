import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { snakesModule } from '@bg/game-snakes-ladders';
import { ludoModule } from '@bg/game-ludo';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe.each([
  ['snakes-ladders', snakesModule, 6, ['finish', 'sixAgain']],
  ['ludo', ludoModule, 4, []]
] as const)('%s through the platform', (gameId, module, maxPlayers, optionKeys) => {
  it('is in the catalog with its variants', async () => {
    const g = (await call(ctx, 'GET', `/api/games/${gameId}`)).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(optionKeys);
  });

  it('the server rolls the die; only the current player may roll', async () => {
    const t = await startTable(ctx, gameId, 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const current = v.game.view.current as number;
    expect((await command(ctx, bySeat((current + 1) % 3), t.tableId, v.game.revision, { type: 'roll' })).json().errorCode).toBe('NOT_YOUR_TURN');
    expect((await command(ctx, bySeat(current), t.tableId, v.game.revision, { type: 'roll' })).json()).toMatchObject({ status: 'accepted' });
    const after = await view(ctx, bySeat(current), t.tableId);
    expect(after.game.view.log.some((e: { t: string }) => e.t === 'roll')).toBe(true);
    expect(JSON.stringify(after.game.view)).not.toContain('"script"');
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', `/api/tutorials/${gameId}/start`, u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of module.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
