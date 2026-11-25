import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { fireDeadline, runOutbox } from '@bg/play';
import { setup, type TestCtx } from './helpers.ts';
import { call, makeDue, pendingDeadline, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const { users: usersT, participants, gameTables, notifications } = schema;
const fire = (id: string) => fireDeadline(ctx.db, createDefaultRegistry(), id);
const secondsBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 1000);

/** A started 2-seat turn table (24 h turns) and the user whose turn it is. */
async function turnTable(turnSeconds = 86400) {
  const t = await startTable(ctx, 'line-three', 2, { pace: 'turn', turnSeconds });
  const s = await view(ctx, t.players[0]!, t.tableId);
  const mover = (await seatsOf(ctx, t.tableId, t.players))(s.game.pendingSeats[0]);
  return { ...t, mover, moverSeat: s.game.pendingSeats[0] as number };
}

const status = async (tableId: string) => (await ctx.db.select({ s: gameTables.status }).from(gameTables).where(eq(gameTables.id, tableId)))[0]!.s;

describe('vacation «مرخصی» (phase B)', () => {
  it('validates days 1 to 7, rejects a second vacation and enforces the 7-day gap after ending early', async () => {
    const [u] = await users(ctx, 1);
    expect((await call(ctx, 'POST', '/api/me/vacation', u, { days: 0 })).statusCode).toBe(400);
    expect((await call(ctx, 'POST', '/api/me/vacation', u, { days: 8 })).statusCode).toBe(400);
    const started = await call(ctx, 'POST', '/api/me/vacation', u, { days: 3 });
    expect(started.statusCode).toBe(200);
    const until = new Date(started.json().vacation.until);
    expect(secondsBetween(until, new Date())).toBeGreaterThan(3 * 86400 - 60);
    expect((await call(ctx, 'POST', '/api/me/vacation', u, { days: 1 })).json().errorCode).toBe('VACATION_ACTIVE');
    const ended = (await call(ctx, 'DELETE', '/api/me/vacation', u)).json();
    expect(ended.vacation.until).toBeNull();
    expect(secondsBetween(new Date(ended.vacation.availableAt), new Date())).toBeGreaterThan(7 * 86400 - 60);
    expect((await call(ctx, 'POST', '/api/me/vacation', u, { days: 1 })).json().errorCode).toBe('VACATION_COOLDOWN');
    // Eight days later a new vacation may start.
    await ctx.db.update(usersT).set({ vacationLastEndedAt: sql`now() - interval '8 days'` }).where(eq(usersT.id, u!.id));
    expect((await call(ctx, 'POST', '/api/me/vacation', u, { days: 1 })).statusCode).toBe(200);
  });

  it('a turn deadline of a player on vacation moves to vacation end + turn time instead of timing out; others see the tag', async () => {
    const t = await turnTable();
    expect((await call(ctx, 'POST', '/api/me/vacation', t.mover, { days: 2 })).statusCode).toBe(200);
    const [{ until }] = await ctx.db.select({ until: usersT.vacationUntil }).from(usersT).where(eq(usersT.id, t.mover.id)) as [{ until: Date }];
    const d = (await pendingDeadline(ctx, t.tableId))!;
    await makeDue(ctx, d.id);
    expect(await fire(d.id)).toBe('fired');
    expect(await status(t.tableId)).toBe('active');
    const next = (await pendingDeadline(ctx, t.tableId))!;
    expect(secondsBetween(next.dueAt, until)).toBe(86400);
    expect(next.expectedRevision).toBe(t.revision);
    // Only the «last hour» reminder after the vacation, no reminders during it.
    const rem = (await pendingDeadline(ctx, t.tableId, 'reminder'))!;
    expect(secondsBetween(next.dueAt, rem.dueAt)).toBe(3600);
    const other = t.players.find((p) => p.id !== t.mover.id)!;
    const seat = (await view(ctx, other, t.tableId)).table.seats.find((x: { seat: number }) => x.seat === t.moverSeat);
    expect(seat.onVacationUntil).toBe(until.toISOString());
    const mine = (await call(ctx, 'GET', '/api/me/tables', other)).json().items.find((x: { id: string }) => x.id === t.tableId);
    expect(mine.seats.find((x: { seat: number }) => x.seat === t.moverSeat).onVacationUntil).toBe(until.toISOString());
  });

  it('tournament tables ignore vacation and extra time: the game timeout applies', async () => {
    const t = await turnTable();
    await call(ctx, 'POST', '/api/me/vacation', t.mover, { days: 2 });
    await ctx.db.update(gameTables).set({ settings: sql`${gameTables.settings} || '{"tournament":{"id":"00000000-0000-0000-0000-000000000000","round":1}}'::jsonb` })
      .where(eq(gameTables.id, t.tableId));
    const d = (await pendingDeadline(ctx, t.tableId))!;
    await makeDue(ctx, d.id);
    expect(await fire(d.id)).toBe('fired');
    expect(await status(t.tableId)).toBe('finished'); // line-three: the player whose time ran out loses
  });

  it('extra time «مهلت اضافه»: first timeout extends by the turn time (≤ 24 h) once and notifies; the second times out', async () => {
    const t = await turnTable(3 * 86400);
    const d = (await pendingDeadline(ctx, t.tableId))!;
    await makeDue(ctx, d.id);
    expect(await fire(d.id)).toBe('fired');
    expect(await status(t.tableId)).toBe('active');
    const next = (await pendingDeadline(ctx, t.tableId))!;
    expect(secondsBetween(next.dueAt, new Date())).toBeGreaterThan(86400 - 60);
    expect(secondsBetween(next.dueAt, new Date())).toBeLessThanOrEqual(86400);
    const [p] = await ctx.db.select({ used: participants.extraTimeUsed }).from(participants)
      .where(and(eq(participants.tableId, t.tableId), eq(participants.seat, t.moverSeat)));
    expect(p!.used).toBe(true);
    expect((await view(ctx, t.mover, t.tableId)).table.seats.find((x: { seat: number }) => x.seat === t.moverSeat).extraTimeUsed).toBe(true);
    await runOutbox(ctx.db);
    const notes = await ctx.db.select().from(notifications).where(and(eq(notifications.userId, t.mover.id), eq(notifications.kind, 'reminder')));
    expect(notes).toHaveLength(1);
    const items = (await call(ctx, 'GET', '/api/me/notifications', t.mover)).json().items as { textFa: string; href: string }[];
    expect(items.find((i) => i.textFa.startsWith('مهلت اضافه شروع شد'))?.href).toBe(`/tables/${t.tableId}`);
    await makeDue(ctx, next.id);
    expect(await fire(next.id)).toBe('fired');
    expect(await status(t.tableId)).toBe('finished');
  });

  it('bots never get extra time', async () => {
    const t = await turnTable();
    // The pending seat becomes a bot stand-in.
    await ctx.db.update(participants).set({ kind: 'bot', userId: null })
      .where(and(eq(participants.tableId, t.tableId), eq(participants.seat, t.moverSeat)));
    const d = (await pendingDeadline(ctx, t.tableId))!;
    await makeDue(ctx, d.id);
    expect(await fire(d.id)).toBe('fired');
    expect(await status(t.tableId)).toBe('finished');
  });
});

