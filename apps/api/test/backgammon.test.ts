import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { backgammonModule, legalPlays, type BgState } from '@bg/game-backgammon';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('backgammon through the platform', () => {
  it('is in the catalog with its rule variants', async () => {
    const g = (await call(ctx, 'GET', '/api/games/backgammon')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['gammons', 'cube']);
  });

  it('the server rolls; a whole turn is one play; only the player to move may act', async () => {
    const t = await startTable(ctx, 'backgammon', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const s = v.game.view as BgState;
    expect(s.dice).toHaveLength(2);
    const moves = legalPlays(s, s.current, s.dice!)[0];
    expect((await command(ctx, bySeat(1 - s.current), t.tableId, v.game.revision, { type: 'play', moves })).json().errorCode).toBe('NOT_YOUR_TURN');
    expect((await command(ctx, bySeat(s.current), t.tableId, v.game.revision, { type: 'play', moves: moves!.slice(0, 1) })).json().errorCode).toBe('ILLEGAL_MOVE');
    expect((await command(ctx, bySeat(s.current), t.tableId, v.game.revision, { type: 'play', moves })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat(s.current), t.tableId)).game.view;
    expect(after.current).toBe(1 - s.current);
    expect(after.script).toBeUndefined();
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/backgammon/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of backgammonModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
