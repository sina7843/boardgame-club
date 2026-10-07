import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { chessModule } from '@bg/game-chess';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('chess through the platform', () => {
  it('is in the catalog; a host cannot inject an undeclared setup option (e.g. a start position)', async () => {
    const g = (await call(ctx, 'GET', '/api/games/chess')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['firstMove']);
    const [u] = await users(ctx, 1);
    const r = await call(ctx, 'POST', '/api/tables', u, { gameId: 'chess', pace: 'live', capacity: 2, turnSeconds: 60, options: { fen: '4k3/8/8/8/8/8/8/Q3K3 w - - 0 1' } });
    expect(r.json().errorCode).toBe('OPTION_NOT_ALLOWED');
  });

  it('moves go through the command path; only the side to move may move', async () => {
    const t = await startTable(ctx, 'chess', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const white = v.game.view.colors.indexOf('w') as number;
    expect((await command(ctx, bySeat(1 - white), t.tableId, v.game.revision, { type: 'move', from: 'e7', to: 'e5' })).json().errorCode).toBe('NOT_YOUR_TURN');
    expect((await command(ctx, bySeat(white), t.tableId, v.game.revision, { type: 'move', from: 'e2', to: 'e4' })).json()).toMatchObject({ status: 'accepted' });
    const after = await view(ctx, bySeat(white), t.tableId);
    expect(after.game.view.history.map((h: { san: string }) => h.san)).toEqual(['e4']);
    expect(after.game.view.current).toBe(1 - white);
  });

  it('the interactive tutorial runs on the server to checkmate', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/chess/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of chessModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.view.end).toEqual({ kind: 'checkmate' });
  });
});
