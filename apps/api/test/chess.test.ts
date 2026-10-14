import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { chessModule } from '@bg/game-chess';
import { createDefaultRegistry } from '@bg/game-engine';
import { fireDeadline } from '@bg/play';
import { call, command, makeDue, pendingDeadline, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('chess through the platform', () => {
  it('is in the catalog; a host cannot inject an undeclared setup option (e.g. a start position)', async () => {
    const g = (await call(ctx, 'GET', '/api/games/chess')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 2, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['firstMove', 'clock']);
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

  it('chess clock: banks run only on your turn, gain the increment, and a flag fall loses', async () => {
    const t = await startTable(ctx, 'chess', 2, { options: { clock: '3+2' } });
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const white = v.game.view.colors.indexOf('w') as number;
    expect(v.game.clocks).toMatchObject({ running: white, initialMs: 180_000, left: [180_000, 180_000] });
    const due0 = new Date(v.game.deadline.dueAt).getTime() - Date.now();
    expect(due0).toBeGreaterThan(170_000);
    expect(due0).toBeLessThanOrEqual(181_000);
    await command(ctx, bySeat(white), t.tableId, v.game.revision, { type: 'move', from: 'e2', to: 'e4' });
    const a = await view(ctx, t.players[0]!, t.tableId);
    expect(a.game.clocks.running).toBe(1 - white);
    // White spent a moment and earned +2 s; Black's bank is untouched.
    expect(a.game.clocks.left[white]).toBeGreaterThan(180_000);
    expect(a.game.clocks.left[1 - white]).toBe(180_000);
    // Black's flag falls: White can still mate, so White wins on time.
    const d = (await pendingDeadline(ctx, t.tableId))!;
    await makeDue(ctx, d.id);
    expect(await fireDeadline(ctx.db, createDefaultRegistry(), d.id)).toBe('fired');
    const end = await view(ctx, t.players[0]!, t.tableId);
    expect(end.table.status).toBe('finished');
    expect(end.game.result.placements.find((p: { place: number }) => p.place === 1).seat).toBe(white);
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
