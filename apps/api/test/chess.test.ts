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
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['firstMove', 'clock', 'minDrawMove', 'drawRule']);
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

  it('chess clock: each bank starts with its own first move, gains the increment after a move, and a flag fall loses', async () => {
    const t = await startTable(ctx, 'chess', 2, { options: { clock: '3+2' } });
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = await view(ctx, t.players[0]!, t.tableId);
    const white = v.game.view.colors.indexOf('w') as number;
    // ENGINE.md P1: before the first move only a first-move countdown runs (blitz 20 s, livefix row 7); the bank waits.
    expect(v.game.clocks).toMatchObject({ running: white, initialMs: 180_000, left: [180_000, 180_000], first: true });
    const due0 = new Date(v.game.deadline.dueAt).getTime() - Date.now();
    expect(due0).toBeGreaterThan(15_000);
    expect(due0).toBeLessThanOrEqual(21_000);
    await command(ctx, bySeat(white), t.tableId, v.game.revision, { type: 'move', from: 'e2', to: 'e4' });
    let a = await view(ctx, t.players[0]!, t.tableId);
    // The first move is free (no charge, no increment); Black is now on its own first-move countdown.
    expect(a.game.clocks).toMatchObject({ running: 1 - white, left: [180_000, 180_000], first: true });
    await command(ctx, bySeat(1 - white), t.tableId, a.game.revision, { type: 'move', from: 'e7', to: 'e5' });
    a = await view(ctx, t.players[0]!, t.tableId);
    expect(a.game.clocks.first).toBeUndefined();
    expect(new Date(a.game.deadline.dueAt).getTime() - Date.now()).toBeGreaterThan(170_000);
    await command(ctx, bySeat(white), t.tableId, a.game.revision, { type: 'move', from: 'g1', to: 'f3' });
    a = await view(ctx, t.players[0]!, t.tableId);
    expect(a.game.clocks.running).toBe(1 - white);
    // White spent a moment and earned +2 s; Black's bank is untouched.
    expect(a.game.clocks.left[white]).toBeGreaterThan(180_000);
    expect(a.game.clocks.left[1 - white]).toBe(180_000);
    // Black's flag falls: White can still mate, so White wins on time (no increment is added to the flagged bank).
    const d = (await pendingDeadline(ctx, t.tableId))!;
    await makeDue(ctx, d.id);
    expect(await fireDeadline(ctx.db, createDefaultRegistry(), d.id)).toBe('fired');
    const end = await view(ctx, t.players[0]!, t.tableId);
    expect(end.table.status).toBe('finished');
    expect(end.game.result.placements.find((p: { place: number }) => p.place === 1).seat).toBe(white);
  });

  it('a draw offer or decline on any turn leaves the running clock running', async () => {
    const t = await startTable(ctx, 'chess', 2, { options: { clock: '3+2' } });
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    let v = await view(ctx, t.players[0]!, t.tableId);
    const white = v.game.view.colors.indexOf('w') as number;
    await command(ctx, bySeat(white), t.tableId, v.game.revision, { type: 'move', from: 'e2', to: 'e4' });
    v = await view(ctx, t.players[0]!, t.tableId);
    await command(ctx, bySeat(1 - white), t.tableId, v.game.revision, { type: 'move', from: 'e7', to: 'e5' });
    v = await view(ctx, t.players[0]!, t.tableId);
    expect(v.game.clocks.running).toBe(white);
    // White (to move) offers, Black (not to move) declines: White's clock keeps running throughout.
    expect((await command(ctx, bySeat(white), t.tableId, v.game.revision, { type: 'offerDraw' })).json().status).toBe('accepted');
    v = await view(ctx, t.players[0]!, t.tableId);
    expect(v.game.clocks.running).toBe(white);
    expect((await command(ctx, bySeat(1 - white), t.tableId, v.game.revision, { type: 'declineDraw' })).json().status).toBe('accepted');
    v = await view(ctx, t.players[0]!, t.tableId);
    expect(v.game.clocks.running).toBe(white);
    expect(v.game.view.drawOffer).toBeNull();
  });

  it('quick pairing on a clock: the queue is keyed by the bank and the matched table plays on that clock', async () => {
    const [a, b] = await users(ctx, 2);
    const q = (u: typeof a, clock: string) => call(ctx, 'POST', '/api/matchmaking/tickets', u, { gameId: 'chess', pace: 'live', competition: 'ranked', playerCount: 2, turnSeconds: 60, clock });
    expect((await q(a!, '2+0')).json().errorCode).toBe('OPTION_NOT_ALLOWED'); // not a clock choice of chess
    expect((await q(a!, '3+0')).statusCode).toBe(201);
    expect((await q(b!, '3+0')).statusCode).toBe(201);
    const mine = (await call(ctx, 'GET', '/api/me/matchmaking', a)).json().items as { matchedTableId: string | null }[];
    const tableId = mine.find((t) => t.matchedTableId)?.matchedTableId;
    expect(tableId).toBeTruthy();
    const snap = await view(ctx, a!, tableId!);
    expect(snap.table).toMatchObject({ competition: 'ranked', settings: { turnSeconds: 180, options: { clock: '3+0' } } });
  });

  it('a side that does not make its first move in time aborts the game (no result)', async () => {
    const t = await startTable(ctx, 'chess', 2, { options: { clock: '5+0' } });
    const d = (await pendingDeadline(ctx, t.tableId))!;
    await makeDue(ctx, d.id);
    expect(await fireDeadline(ctx.db, createDefaultRegistry(), d.id)).toBe('fired');
    const end = await view(ctx, t.players[0]!, t.tableId);
    expect(end.table.status).toBe('cancelled');
    expect(end.game.clocks).toMatchObject({ aborted: true });
    expect(end.game.result).toBeNull();
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
