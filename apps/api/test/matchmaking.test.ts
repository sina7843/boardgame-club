import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { defaultMatchConfig, fireDeadline, runMatchmaking, windowFor } from '@bg/play';
import { grantRole, setup, type TestCtx } from './helpers.ts';
import { call, pendingDeadline, makeDue, users, view, type User } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const queue = (u: User, body: object = {}) => call(ctx, 'POST', '/api/matchmaking/tickets', u, { gameId: 'line-three', pace: 'live', playerCount: 2, turnSeconds: 60, ...body });
const mine = async (u: User) => (await call(ctx, 'GET', '/api/me/matchmaking', u)).json().items[0];
const tickets = () => ctx.db.select().from(schema.matchmakingTickets);

describe('matchmaking (FR-06)', () => {
  it('skill window starts at the base, grows with waiting time and is capped', () => {
    expect(windowFor(defaultMatchConfig, 'live', 0)).toBe(100);
    expect(windowFor(defaultMatchConfig, 'live', 25)).toBe(200);
    expect(windowFor(defaultMatchConfig, 'live', 3600)).toBe(400);
    expect(windowFor(defaultMatchConfig, 'turn', 25)).toBe(100);
  });

  it('matches two queued players into a private friendly table that starts when both accept', async () => {
    const [a, b] = await users(ctx, 2);
    expect((await queue(a!)).statusCode).toBe(201);
    expect(await mine(a!)).toMatchObject({ status: 'queued', window: 100, matchedTableId: null });
    expect((await queue(a!)).json().errorCode).toBe('ALREADY_QUEUED');
    await queue(b!);
    const ta = await mine(a!);
    expect(ta).toMatchObject({ status: 'matched' });
    expect(ta.readyDeadline).not.toBeNull();
    expect((await mine(b!)).matchedTableId).toBe(ta.matchedTableId);
    const lobby = await view(ctx, b!, ta.matchedTableId);
    expect(lobby.table).toMatchObject({ status: 'open', visibility: 'private', competition: 'friendly', inviteCode: null });
    // While matched, no other live table can be created or joined.
    expect((await call(ctx, 'POST', '/api/tables', a, { gameId: 'line-three', pace: 'live', capacity: 2, turnSeconds: 60 })).json().errorCode).toBe('ALREADY_QUEUED');
    await call(ctx, 'POST', `/api/tables/${ta.matchedTableId}/ready`, a, { ready: true });
    const started = (await call(ctx, 'POST', `/api/tables/${ta.matchedTableId}/ready`, b, { ready: true })).json();
    expect(started.table.status).toBe('active');
    expect((await tickets()).filter((t) => t.matchedTableId === ta.matchedTableId).map((t) => t.status)).toEqual(['started', 'started']);
  });

  it('concurrent enqueues and concurrent matcher runs never assign a player to two tables', async () => {
    const people = await users(ctx, 8);
    await Promise.all(people.map((u) => queue(u, { gameId: 'sealed-bids', playerCount: 2, pace: 'turn', turnSeconds: 86400 })));
    await Promise.all([runMatchmaking(ctx.db, defaultMatchConfig), runMatchmaking(ctx.db, defaultMatchConfig), runMatchmaking(ctx.db, defaultMatchConfig)]);
    const ids = new Set(people.map((p) => p.id));
    const mineTickets = (await tickets()).filter((t) => ids.has(t.userId));
    expect(mineTickets.every((t) => t.status === 'matched')).toBe(true);
    const seats = await ctx.db.select().from(schema.participants).where(sql`${schema.participants.userId} in (${sql.join(people.map((p) => sql`${p.id}`), sql`, `)})`);
    expect(seats).toHaveLength(8);
    expect(new Set(seats.map((s) => s.userId)).size).toBe(8);
    expect(new Set(seats.map((s) => s.tableId)).size).toBe(4);
  });

  it('cancel racing the matcher: a player ends up either cancelled or matched, never both', async () => {
    for (let i = 0; i < 4; i++) {
      const [a, b] = await users(ctx, 2);
      await queue(a!, { pace: 'turn', turnSeconds: 43200 });
      const ticketId = (await mine(a!)).id;
      const [cancel] = await Promise.all([call(ctx, 'DELETE', `/api/matchmaking/tickets/${ticketId}`, a), queue(b!, { pace: 'turn', turnSeconds: 43200 })]);
      const [t] = await ctx.db.select().from(schema.matchmakingTickets).where(eq(schema.matchmakingTickets.id, ticketId));
      expect(cancel.statusCode).toBe(204);
      expect(t!.status).toBe('cancelled');
      // If the match had formed first, the cancel acted as a decline: the table is cancelled and b is back in the queue.
      if (t!.matchedTableId) {
        const [table] = await ctx.db.select().from(schema.gameTables).where(eq(schema.gameTables.id, t!.matchedTableId));
        expect(table!.status).toBe('cancelled');
      }
      expect((await mine(b!)).status).toBe('queued');
      await call(ctx, 'DELETE', `/api/matchmaking/tickets/${(await mine(b!)).id}`, b);
    }
  });

  it('declining a proposed match re-queues the others with their original queue time', async () => {
    const [a, b] = await users(ctx, 2);
    await queue(a!, { pace: 'turn', turnSeconds: 172800 });
    const before = (await tickets()).find((t) => t.userId === a!.id)!.createdAt;
    await queue(b!, { pace: 'turn', turnSeconds: 172800 });
    const t = await mine(b!);
    await call(ctx, 'POST', `/api/tables/${t.matchedTableId}/ready`, a, { ready: true });
    expect((await call(ctx, 'DELETE', `/api/matchmaking/tickets/${t.id}`, b)).statusCode).toBe(204);
    const ta = (await tickets()).find((x) => x.userId === a!.id && x.status === 'queued')!;
    expect(ta.createdAt).toEqual(before);
    expect((await view(ctx, a!, t.matchedTableId)).table.status).toBe('cancelled');
    await call(ctx, 'DELETE', `/api/matchmaking/tickets/${ta.id}`, a);
  });

  it('ready timeout: players who accepted are re-queued, no-shows leave the queue with a moderator signal (no penalty)', async () => {
    const [a, b] = await users(ctx, 2);
    await queue(a!, { pace: 'turn', turnSeconds: 259200 });
    await queue(b!, { pace: 'turn', turnSeconds: 259200 });
    const t = await mine(a!);
    await call(ctx, 'POST', `/api/tables/${t.matchedTableId}/ready`, a, { ready: true });
    const d = (await pendingDeadline(ctx, t.matchedTableId, 'ready'))!;
    await makeDue(ctx, d.id);
    expect(await fireDeadline(ctx.db, createDefaultRegistry(), d.id)).toBe('fired');
    expect((await mine(a!)).status).toBe('queued');
    expect((await mine(b!)).status).toBe('expired');
    const signals = await ctx.db.select().from(schema.behaviorSignals).where(eq(schema.behaviorSignals.userId, b!.id));
    expect(signals.map((s) => s.kind)).toEqual(['ready_no_show']);
    await call(ctx, 'DELETE', `/api/matchmaking/tickets/${(await mine(a!)).id}`, a);
  });

  it('re-checks the game at start: a game suspended after matching cannot start', async () => {
    const [a, b, admin] = await users(ctx, 3);
    await grantRole(ctx.db, admin!.mobile, 'admin');
    await queue(a!, { gameId: 'sealed-bids', playerCount: 2 });
    await queue(b!, { gameId: 'sealed-bids', playerCount: 2 });
    const t = await mine(a!);
    await call(ctx, 'PATCH', '/api/admin/games/sealed-bids', admin, { status: 'suspended', reason: 'test' });
    await call(ctx, 'POST', `/api/tables/${t.matchedTableId}/ready`, a, { ready: true });
    expect((await call(ctx, 'POST', `/api/tables/${t.matchedTableId}/ready`, b, { ready: true })).json().errorCode).toBe('GAME_NOT_ACCEPTING_TABLES');
    await call(ctx, 'PATCH', '/api/admin/games/sealed-bids', admin, { status: 'active', reason: 'test' });
    // and suspended games cannot be queued for
    await call(ctx, 'PATCH', '/api/admin/games/line-three', admin, { status: 'suspended', reason: 'test' });
    const [c] = await users(ctx, 1);
    expect((await queue(c!)).json().errorCode).toBe('GAME_NOT_ACCEPTING_TABLES');
    await call(ctx, 'PATCH', '/api/admin/games/line-three', admin, { status: 'active', reason: 'test' });
  });

  it('expires tickets past their queue time', async () => {
    const [a] = await users(ctx, 1);
    await queue(a!, { pace: 'turn', turnSeconds: 86400, playerCount: 4, gameId: 'sealed-bids' });
    await ctx.db.update(schema.matchmakingTickets).set({ expiresAt: sql`now() - interval '1 second'` }).where(eq(schema.matchmakingTickets.userId, a!.id));
    expect((await runMatchmaking(ctx.db, defaultMatchConfig)).expired).toBeGreaterThanOrEqual(1);
    expect((await mine(a!)).status).toBe('expired');
  });
});
