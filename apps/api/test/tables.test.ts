import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { fireDeadline } from '@bg/play';
import { setup, type TestCtx } from './helpers.ts';
import { call, command, makeDue, pendingDeadline, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup({ LOG_LEVEL: 'info' }); });
afterAll(async () => { await ctx.close(); });

describe('table lifecycle (FR-05)', () => {
  it('validates creation: mode, ranked, time, capacity; defaults to private + friendly', async () => {
    const [u] = await users(ctx, 1);
    const create = (body: object) => call(ctx, 'POST', '/api/tables', u, { gameId: 'line-three', pace: 'live', capacity: 2, turnSeconds: 60, ...body });
    expect((await create({ competition: 'ranked' })).json().errorCode).toBe('RANKED_NOT_AVAILABLE');
    expect((await create({ turnSeconds: 7 })).json().errorCode).toBe('INVALID_TIME_SETTING');
    expect((await create({ capacity: 3 })).json().errorCode).toBe('VALIDATION_FAILED');
    expect((await create({ gameId: 'nope' })).statusCode).toBe(404);
    const ok = await create({});
    expect(ok.statusCode).toBe(201);
    const snap = await view(ctx, u!, ok.json().id);
    expect(snap.table).toMatchObject({ visibility: 'private', competition: 'friendly', status: 'open', mySeat: 0, rulesVersion: '1.0.0' });
    expect(snap.table.inviteCode).toMatch(/^[\w-]{16}$/);
    expect(snap.table.policies.timeoutFa).toContain('زمان');
    expect(snap.game).toBeNull();
    // one live table at a time
    expect((await create({})).json().errorCode).toBe('ALREADY_IN_LIVE_TABLE');
  });

  it('private tables: invite required to join, outsiders cannot view; invite holders see the lobby only', async () => {
    const [host, guest, outsider] = await users(ctx, 3);
    const id = (await call(ctx, 'POST', '/api/tables', host, { gameId: 'sealed-bids', pace: 'turn', capacity: 3, turnSeconds: 86400 })).json().id;
    const invite = (await view(ctx, host!, id)).table.inviteCode;
    expect((await call(ctx, 'GET', `/api/tables/${id}`, outsider)).statusCode).toBe(403);
    const peek = (await call(ctx, 'GET', `/api/tables/${id}?invite=${invite}`, outsider)).json();
    expect(peek.table.inviteCode).toBeNull();
    expect((await call(ctx, 'POST', `/api/tables/${id}/join`, guest, {})).json().errorCode).toBe('INVITE_REQUIRED');
    const joined = await call(ctx, 'POST', `/api/tables/${id}/join`, guest, { inviteCode: invite });
    expect(joined.json().table.mySeat).toBe(1);
    expect((await call(ctx, 'POST', `/api/tables/${id}/join`, guest, { inviteCode: invite })).json().errorCode).toBe('ALREADY_JOINED');
    expect((await call(ctx, 'GET', '/api/tables', outsider)).json().items.map((t: { id: string }) => t.id)).not.toContain(id);
  });

  it('starts only when every seat is filled and ready; then joining and leaving are closed', async () => {
    const t = await startTable(ctx, 'line-three', 2);
    const snap = await view(ctx, t.players[0]!, t.tableId);
    expect(snap.table.status).toBe('active');
    expect(snap.game.revision).toBe(1);
    expect(snap.game.deadline).not.toBeNull();
    const [late] = await users(ctx, 1);
    expect((await call(ctx, 'POST', `/api/tables/${t.tableId}/leave`, t.players[0])).json().errorCode).toBe('TABLE_NOT_OPEN');
    expect((await call(ctx, 'GET', `/api/tables/${t.tableId}`, late)).statusCode).toBe(403);
  });

  it('public tables are listed and viewable by spectators with a spectator projection', async () => {
    const [host, guest, watcher] = await users(ctx, 3);
    const id = (await call(ctx, 'POST', '/api/tables', host, { gameId: 'line-three', pace: 'turn', visibility: 'public', capacity: 2, turnSeconds: 86400 })).json().id;
    expect((await call(ctx, 'GET', '/api/tables?gameId=line-three', watcher)).json().items.map((t: { id: string }) => t.id)).toContain(id);
    await call(ctx, 'POST', `/api/tables/${id}/join`, guest, {});
    await call(ctx, 'POST', `/api/tables/${id}/ready`, host, { ready: true });
    await call(ctx, 'POST', `/api/tables/${id}/ready`, guest, { ready: true });
    const s = await view(ctx, watcher!, id);
    expect(s.table.mySeat).toBeNull();
    expect(s.game.legalActions).toEqual([]);
    expect(s.table.inviteCode).toBeNull();
  });
});

describe('command service (FR-07, NFR-02)', () => {
  it('accepts a move, returns the original receipt for an exact duplicate before revision checks, refuses a changed payload', async () => {
    const t = await startTable(ctx, 'line-three', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const first = (await view(ctx, t.players[0]!, t.tableId)).game.pendingSeats[0];
    const mover = bySeat(first);
    const cid = randomUUID();
    const a = (await command(ctx, mover, t.tableId, 1, { type: 'place', cell: 4 }, cid)).json();
    expect(a).toMatchObject({ status: 'accepted', revision: 2, duplicate: false });
    expect(a.snapshot.game.view.board[4]).toBe('X');
    const dup = (await command(ctx, mover, t.tableId, 1, { type: 'place', cell: 4 }, cid)).json();
    expect(dup).toMatchObject({ status: 'accepted', revision: 2, duplicate: true });
    const reused = await command(ctx, mover, t.tableId, 1, { type: 'place', cell: 5 }, cid);
    expect(reused.statusCode).toBe(409);
    expect(reused.json().errorCode).toBe('COMMAND_ID_REUSED');
    expect((await view(ctx, mover, t.tableId)).game.revision).toBe(2);
  });

  it('rejects stale revisions with the current permitted snapshot, invalid actions without mutation, outsiders with 403', async () => {
    const t = await startTable(ctx, 'line-three', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const s = await view(ctx, t.players[0]!, t.tableId);
    const mover = bySeat(s.game.pendingSeats[0]);
    const other = bySeat(1 - s.game.pendingSeats[0]);
    await command(ctx, mover, t.tableId, 1, { type: 'place', cell: 0 });
    const stale = (await command(ctx, other, t.tableId, 1, { type: 'place', cell: 1 })).json();
    expect(stale).toMatchObject({ status: 'rejected', errorCode: 'STALE_REVISION', revision: 2 });
    expect(stale.snapshot.game.revision).toBe(2);
    for (const [action, code] of [[{ type: 'place', cell: 0 }, 'CELL_OCCUPIED'], [{ type: 'place', cell: 99 }, 'INVALID_ACTION'], [{ type: 'teleport' }, 'INVALID_ACTION']] as const) {
      expect((await command(ctx, other, t.tableId, 2, action)).json()).toMatchObject({ status: 'rejected', errorCode: code, revision: 2 });
    }
    expect((await command(ctx, mover, t.tableId, 2, { type: 'place', cell: 8 })).json().errorCode).toBe('NOT_YOUR_TURN');
    expect((await view(ctx, mover, t.tableId)).game.revision).toBe(2);
    const [outsider] = await users(ctx, 1);
    expect((await command(ctx, outsider!, t.tableId, 2, { type: 'place', cell: 8 })).statusCode).toBe(403);
    const withActor = await call(ctx, 'POST', `/api/tables/${t.tableId}/commands`, other, { commandId: randomUUID(), expectedRevision: 2, action: { type: 'place', cell: 8 }, actorId: mover.id });
    expect(withActor.statusCode).toBe(400);
  });

  it('parallel commands on the same revision: exactly one is accepted', async () => {
    const t = await startTable(ctx, 'sealed-bids', 3, { pace: 'turn' });
    const results = await Promise.all(t.players.map((p, i) => command(ctx, p, t.tableId, 1, { type: 'bid', token: i + 1 })));
    const statuses = results.map((r) => r.json());
    expect(statuses.filter((s) => s.status === 'accepted')).toHaveLength(1);
    expect(statuses.filter((s) => s.errorCode === 'STALE_REVISION')).toHaveLength(2);
    expect((await view(ctx, t.players[0]!, t.tableId)).game.revision).toBe(2);
  });

  it('receipt lookup supports reconnect before and after commit; resending the same command is safe', async () => {
    const t = await startTable(ctx, 'line-three', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const mover = bySeat((await view(ctx, t.players[0]!, t.tableId)).game.pendingSeats[0]);
    const cid = randomUUID();
    const before = await call(ctx, 'GET', `/api/tables/${t.tableId}/commands/${cid}`, mover);
    expect(before.json()).toEqual({ found: false });
    await command(ctx, mover, t.tableId, 1, { type: 'place', cell: 2 }, cid);
    expect((await call(ctx, 'GET', `/api/tables/${t.tableId}/commands/${cid}`, mover)).json()).toEqual({ found: true, status: 'accepted', revision: 2, errorCode: null });
    expect((await command(ctx, mover, t.tableId, 1, { type: 'place', cell: 2 }, cid)).json().duplicate).toBe(true);
  });

  it('survives a process restart: a new app instance serves the same revision and continues', async () => {
    const t = await startTable(ctx, 'line-three', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const firstSeat = (await view(ctx, t.players[0]!, t.tableId)).game.pendingSeats[0];
    await command(ctx, bySeat(firstSeat), t.tableId, 1, { type: 'place', cell: 4 });
    const before = await view(ctx, t.players[0]!, t.tableId);
    const restarted = await setup({}, createDefaultRegistry(), { reset: false });
    try {
      const after = (await restarted.app.inject({ method: 'GET', url: `/api/tables/${t.tableId}`, headers: { cookie: t.players[0]!.cookie } })).json();
      expect(after.game).toEqual({ ...before.game, deadline: after.game.deadline });
      const next = after.game.pendingSeats[0];
      const res = await restarted.app.inject({ method: 'POST', url: `/api/tables/${t.tableId}/commands`,
        headers: { origin: 'http://localhost:5173', cookie: bySeat(next).cookie },
        payload: { commandId: randomUUID(), expectedRevision: 2, action: { type: 'place', cell: 0 } } });
      expect(res.json()).toMatchObject({ status: 'accepted', revision: 3 });
    } finally {
      await restarted.close();
    }
  });
});

describe('deadlines (FR-09)', () => {
  it('timeout race: a move and the due deadline serialize — exactly one of them takes effect', async () => {
    for (let i = 0; i < 4; i++) {
      const t = await startTable(ctx, 'line-three', 2);
      const bySeat = await seatsOf(ctx, t.tableId, t.players);
      const mover = bySeat((await view(ctx, t.players[0]!, t.tableId)).game.pendingSeats[0]);
      const d = (await pendingDeadline(ctx, t.tableId))!;
      await makeDue(ctx, d.id);
      const [move, fired] = await Promise.all([
        command(ctx, mover, t.tableId, 1, { type: 'place', cell: 4 }).then((r) => r.json()),
        fireDeadline(ctx.db, createDefaultRegistry(), d.id)
      ]);
      const snap = await view(ctx, mover, t.tableId);
      expect(snap.game.revision).toBe(2);
      if (move.status === 'accepted') {
        expect(fired).toBe('skipped');
        expect(snap.table.status).toBe('active');
      } else {
        expect(fired).toBe('fired');
        expect(snap.game.result).toMatchObject({ reason: 'timeout' });
      }
    }
  });

  it('a stale deadline (old revision) never fires against a newer turn', async () => {
    const t = await startTable(ctx, 'line-three', 2);
    const d = (await pendingDeadline(ctx, t.tableId))!;
    await ctx.db.update(schema.scheduledDeadlines).set({ expectedRevision: 0 }).where(eq(schema.scheduledDeadlines.id, d.id));
    await makeDue(ctx, d.id);
    expect(await fireDeadline(ctx.db, createDefaultRegistry(), d.id)).toBe('stale');
    const snap = await view(ctx, t.players[0]!, t.tableId);
    expect(snap.game.revision).toBe(1);
    expect(snap.table.status).toBe('active');
  });

  it('sealed-bids: one bid keeps the round deadline; on timeout missing seats auto-commit their lowest token', async () => {
    const t = await startTable(ctx, 'sealed-bids', 2, { pace: 'turn' });
    const d1 = (await pendingDeadline(ctx, t.tableId))!;
    await command(ctx, t.players[0]!, t.tableId, 1, { type: 'bid', token: 5 });
    const d2 = (await pendingDeadline(ctx, t.tableId))!;
    expect(d2.id).toBe(d1.id);
    expect(d2.expectedRevision).toBe(2);
    expect(await pendingDeadline(ctx, t.tableId, 'reminder')).toBeDefined();
    await makeDue(ctx, d2.id);
    expect(await fireDeadline(ctx.db, createDefaultRegistry(), d2.id)).toBe('fired');
    const v = (await view(ctx, t.players[1]!, t.tableId)).game.view;
    expect(v.history[0].bids).toEqual([5, 1]);
    expect(v.round).toBe(2);
  });
});
