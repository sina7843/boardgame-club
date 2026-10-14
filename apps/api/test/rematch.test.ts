import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_ALERT_PREFS, turnThresholds } from '@bg/contracts';
import { schema } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { fireDeadline, loadTableContext, turnStartedEvent } from '@bg/play';
import { setup, type TestCtx } from './helpers.ts';
import { call, command, makeDue, pendingDeadline, startTable, users, view, type Started } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

/** A finished two-player line-three table (player 0 resigns). */
async function finished(): Promise<Started> {
  const t = await startTable(ctx, 'line-three', 2);
  const v = await view(ctx, t.players[0]!, t.tableId);
  const me = t.players.find((p) => p.id === v.table.seats[v.table.mySeat].user.id)!;
  expect((await command(ctx, me, t.tableId, v.game.revision, { type: 'resign' })).json().status).toBe('accepted');
  return t;
}
const vote = (t: Started, i: number, v: 'yes' | 'no') => call(ctx, 'POST', `/api/tables/${t.tableId}/rematch`, t.players[i], { vote: v });

describe('rematch', () => {
  it('offers nothing before the game ends and rejects outsiders', async () => {
    const t = await startTable(ctx, 'line-three', 2);
    expect((await view(ctx, t.players[0]!, t.tableId)).table.rematch).toBeNull();
    expect((await vote(t, 0, 'yes')).statusCode).toBe(409);
    const [outsider] = await users(ctx, 1);
    expect((await call(ctx, 'POST', `/api/tables/${t.tableId}/rematch`, outsider, { vote: 'yes' })).statusCode).toBe(403);
  });

  it('all yes opens a new started table with the same seats and settings', async () => {
    const t = await finished();
    expect((await view(ctx, t.players[0]!, t.tableId)).table.rematch).toMatchObject({ votes: [], deadline: null, newTableId: null, closed: false });
    const first = (await vote(t, 0, 'yes')).json();
    expect(first.table.rematch.votes).toHaveLength(1);
    expect(first.table.rematch.deadline).toBeTruthy();
    const done = (await vote(t, 1, 'yes')).json();
    const id = done.table.rematch.newTableId as string;
    expect(id).toBeTruthy();
    const n = await view(ctx, t.players[0]!, id);
    const o = await view(ctx, t.players[0]!, t.tableId);
    expect(n.table.status).toBe('active');
    expect(n.table.seats.map((s: { seat: number; user: { id: string } }) => [s.seat, s.user.id]))
      .toEqual(o.table.seats.map((s: { seat: number; user: { id: string } }) => [s.seat, s.user.id]));
    expect(n.table).toMatchObject({ gameId: o.table.gameId, pace: o.table.pace, competition: o.table.competition, visibility: o.table.visibility, rematch: null });
    expect(n.table.settings.turnSeconds).toBe(o.table.settings.turnSeconds);
    expect((await vote(t, 1, 'yes')).statusCode).toBe(409); // already opened
  });

  it('a single no closes it', async () => {
    const t = await finished();
    await vote(t, 0, 'yes');
    const s = (await vote(t, 1, 'no')).json();
    expect(s.table.rematch).toMatchObject({ closed: true, newTableId: null });
    expect((await vote(t, 0, 'yes')).statusCode).toBe(409);
  });

  it('closes when 30 s pass after the first vote', async () => {
    const t = await finished();
    await vote(t, 0, 'yes');
    const { gameTables } = schema;
    const [row] = await ctx.db.select().from(gameTables).where(eq(gameTables.id, t.tableId));
    const st = row!.settings as { rematch: { deadline: string } };
    st.rematch.deadline = new Date(Date.now() - 1000).toISOString();
    await ctx.db.update(gameTables).set({ settings: st }).where(eq(gameTables.id, t.tableId));
    expect((await view(ctx, t.players[0]!, t.tableId)).table.rematch.closed).toBe(true);
    expect((await vote(t, 1, 'yes')).statusCode).toBe(409);
  });

  it('is not offered on tutorial tables', async () => {
    const [u] = await users(ctx, 1);
    const id = (await call(ctx, 'POST', '/api/tutorials/line-three/start', u, { restart: true })).json().tableId;
    await call(ctx, 'POST', '/api/tutorials/line-three/skip', u);
    expect((await view(ctx, u!, id)).table.rematch).toBeNull();
  });
});

describe('clock events', () => {
  it('turn.started carries the pending seats and deadline; thresholds are derived', async () => {
    const t = await startTable(ctx, 'line-three', 2);
    const c = await loadTableContext(ctx.db, t.tableId);
    const e = turnStartedEvent(createDefaultRegistry(), c, c.table.revision)!;
    expect(e).toMatchObject({ tableId: t.tableId, pace: 'live', seats: expect.any(Array), turnSeconds: 60 });
    expect(e.dueAt).toBe((await pendingDeadline(ctx, t.tableId))!.dueAt.toISOString());
    expect(turnStartedEvent(createDefaultRegistry(), c, c.table.revision + 1)).toBeNull();
    expect(turnThresholds('live', 60)).toEqual({ warningLeft: 30, criticalLeft: 10 });
    expect(turnThresholds('turn', 86400)).toEqual({ warningLeft: 43200, criticalLeft: 3600 });
  });

  it('a timeout notifies table_clock with the timed-out seats', async () => {
    const t = await startTable(ctx, 'line-three', 2);
    const got: string[] = [];
    const { createRequire } = await import('node:module');
    const postgres = createRequire(new URL('../../../packages/db/package.json', import.meta.url))('postgres');
    const sql = postgres(process.env.TEST_DATABASE_URL ?? 'postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame_test');
    await sql.listen('table_clock', (p: string) => { got.push(p); });
    const d = (await pendingDeadline(ctx, t.tableId))!;
    await makeDue(ctx, d.id);
    expect(await fireDeadline(ctx.db, createDefaultRegistry(), d.id)).toBe('fired');
    await new Promise((r) => setTimeout(r, 300));
    await sql.end();
    expect(JSON.parse(got[0]!)).toMatchObject({ tableId: t.tableId, seats: expect.any(Array) });
  });
});

describe('alert prefs', () => {
  it('defaults, saves, validates', async () => {
    const [u] = await users(ctx, 1);
    expect((await call(ctx, 'GET', '/api/me/alert-prefs', u)).json()).toEqual(DEFAULT_ALERT_PREFS);
    expect((await call(ctx, 'GET', '/api/me/alert-prefs')).statusCode).toBe(401);
    const next = { ...DEFAULT_ALERT_PREFS, volume: 20, vibration: false, quietHours: { enabled: true, startHour: 22, endHour: 6 }, warningSound: 'bell' };
    expect((await call(ctx, 'PUT', '/api/me/alert-prefs', u, next)).statusCode).toBe(200);
    expect((await call(ctx, 'GET', '/api/me/alert-prefs', u)).json()).toEqual(next);
    for (const bad of [{ ...next, volume: 101 }, { ...next, quietHours: { enabled: true, startHour: 24, endHour: 1 } }, { ...next, warningSound: 'x' }, { ...next, extra: 1 }]) {
      expect((await call(ctx, 'PUT', '/api/me/alert-prefs', u, bad)).statusCode).toBe(400);
    }
  });
});
