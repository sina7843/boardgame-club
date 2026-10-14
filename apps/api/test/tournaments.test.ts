import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { schema } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { coinBalance, groupSizes, runDueDeadlines, runOutbox, runTournaments, tablePoints } from '@bg/play';
import { grantRole, setup, type TestCtx } from './helpers.ts';
import { call, command, makeDue, pendingDeadline, users, view, type User } from './play-helpers.ts';

let ctx: TestCtx;
let admin: User;
const registry = createDefaultRegistry();
const { tournaments, tournamentEntries, tournamentTables, tournamentRefunds, coinLedger, entitlements, notifications } = schema;

beforeAll(async () => {
  ctx = await setup();
  [admin] = await users(ctx, 1) as [User];
  await grantRole(ctx.db, admin.mobile, 'admin');
});
afterAll(async () => { await ctx.close(); });

const soon = () => new Date(Date.now() + 3600_000).toISOString();
const base = {
  gameId: 'line-three', titleFa: 'جام سه‌خطی', format: 'swiss', pace: 'live', turnSeconds: 60, tableSize: 2, rounds: 2,
  minEntrants: 2, maxEntrants: 8, entryKind: 'free', entryAmount: 0, prizes: [{ place: 1, coins: 100, premiumDays: 3 }]
};
async function create(over: Record<string, unknown> = {}) {
  const r = await call(ctx, 'POST', '/api/admin/tournaments', admin, { ...base, startsAt: soon(), ...over });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().id as string;
}
const startNow = async (id: string) => {
  await ctx.db.update(tournaments).set({ startsAt: sql`now() - interval '1 second'` }).where(eq(tournaments.id, id));
  return runTournaments(ctx.db, registry);
};
const give = (userId: string, amount: number) => ctx.db.insert(coinLedger).values({ userId, amount, ruleId: 'test', reason: 'test', sourceKey: `test:${randomUUID()}` });
const detail = async (id: string, u?: User) => (await call(ctx, 'GET', `/api/tournaments/${id}`, u)).json();
const roundTables = (id: string, round: number) => ctx.db.select().from(tournamentTables).where(sql`${tournamentTables.tournamentId} = ${id} and ${tournamentTables.round} = ${round}`);

/** Everyone at the table readies (the table starts), then the first player to move wins line-three. */
async function playOut(tableId: string, ps: User[]) {
  for (const p of ps) await call(ctx, 'POST', `/api/tables/${tableId}/ready`, p, { ready: true });
  let s = await view(ctx, ps[0]!, tableId);
  const seatUser = (seat: number) => ps.find((p) => p.id === s.table.seats.find((x: { seat: number; user: { id: string } }) => x.seat === seat).user.id)!;
  for (const cell of [0, 3, 1, 4, 2]) s = (await command(ctx, seatUser(s.game.pendingSeats[0]), tableId, s.game.revision, { type: 'place', cell })).json().snapshot;
  expect(s.game.status ?? 'finished').toBeTruthy();
}

describe('pure helpers', () => {
  it('groups players evenly, never below the game minimum, with byes only when unavoidable', () => {
    expect(groupSizes(8, 4, 2)).toEqual({ sizes: [4, 4], byes: 0 });
    expect(groupSizes(7, 4, 3)).toEqual({ sizes: [4, 3], byes: 0 });
    expect(groupSizes(5, 2, 2)).toEqual({ sizes: [2, 2], byes: 1 });
    expect(groupSizes(5, 4, 4)).toEqual({ sizes: [4], byes: 1 });
    expect(groupSizes(1, 2, 2)).toEqual({ sizes: [], byes: 1 });
  });
  it('scores beaten + half tied over opponents; absent players score 0', () => {
    const s = tablePoints([{ userId: 'a', place: 1 }, { userId: 'b', place: 2 }, { userId: 'c', place: 2 }, { userId: 'd', place: 4 }], ['d']);
    expect(s.get('a')).toEqual({ points: 1, won: true, rank: 1 });
    expect(s.get('b')!.points).toBeCloseTo(0.5);
    expect(s.get('d')!.points).toBe(0);
    const draw = tablePoints([{ userId: 'a', place: 1 }, { userId: 'b', place: 1 }], []);
    expect(draw.get('a')).toEqual({ points: 0.5, won: false, rank: 1 });
  });
});

describe('admin', () => {
  it('only admins create; settings are checked against the game', async () => {
    const [u] = await users(ctx, 1);
    expect((await call(ctx, 'POST', '/api/admin/tournaments', u, { ...base, startsAt: soon() })).statusCode).toBe(403);
    const bad = async (over: object) => (await call(ctx, 'POST', '/api/admin/tournaments', admin, { ...base, startsAt: soon(), ...over })).json().errorCode;
    expect(await bad({ tableSize: 3 })).toBe('TOURNAMENT_SETTINGS_INVALID'); // line-three is two-player
    expect(await bad({ format: 'knockout', advance: 2 })).toBe('TOURNAMENT_SETTINGS_INVALID');
    expect(await bad({ entryKind: 'coins', entryAmount: 0 })).toBe('TOURNAMENT_SETTINGS_INVALID');
    expect(await bad({ startsAt: new Date(Date.now() - 1000).toISOString() })).toBe('TOURNAMENT_SETTINGS_INVALID');
    expect(await bad({ turnSeconds: 7 })).toBe('INVALID_TIME_SETTING');
  });
});

describe('swiss', () => {
  it('runs rounds from finished tables, ranks by points and pays the prize once', async () => {
    const id = await create();
    const ps = await users(ctx, 4);
    for (const p of ps) expect((await call(ctx, 'POST', `/api/tournaments/${id}/register`, p)).statusCode).toBe(204);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/register`, ps[0])).json().errorCode).toBe('ALREADY_REGISTERED');
    expect((await detail(id, ps[0])).me.registered).toBe(true);

    expect(await startNow(id)).toMatchObject({ started: 1 });
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/register`, admin)).json().errorCode).toBe('TOURNAMENT_NOT_OPEN');
    for (const round of [1, 2]) {
      const tables = await roundTables(id, round);
      expect(tables).toHaveLength(2);
      for (const t of tables) await playOut(t.tableId, t.seats.map((s) => ps.find((p) => p.id === s.userId)!));
      await runTournaments(ctx.db, registry);
    }
    const d = await detail(id);
    expect(d.status).toBe('finished');
    expect(d.roundsPlayed).toHaveLength(2);
    expect(d.standings.reduce((s: number, x: { points: number }) => s + x.points, 0)).toBe(4); // one point per table
    const champs = d.standings.filter((x: { finalRank: number }) => x.finalRank === 1);
    expect(champs.length).toBeGreaterThanOrEqual(1);
    for (const c of champs) {
      expect(c.points).toBe(2);
      const prize = await ctx.db.select().from(coinLedger).where(eq(coinLedger.sourceKey, `tournament-prize:${id}:${c.player.id}`));
      expect(prize[0]?.amount).toBe(100);
      expect((await ctx.db.select().from(entitlements).where(eq(entitlements.userId, c.player.id))).map((e) => e.source)).toEqual(['tournament']);
    }
    expect(await runTournaments(ctx.db, registry)).toMatchObject({ finished: 0 }); // nothing runs twice
    await runOutbox(ctx.db);
    const n = await ctx.db.select().from(notifications).where(eq(notifications.userId, ps[0]!.id));
    expect(n.some((x) => x.kind === 'tournament')).toBe(true);
  });
});

describe('spectators', () => {
  it('anyone signed in can watch a tournament table (spectator projection, no join) and find it in the live list', async () => {
    const id = await create();
    const ps = await users(ctx, 2);
    for (const p of ps) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    const [tt] = await roundTables(id, 1);
    const [watcher] = await users(ctx, 1);
    for (const p of ps) await call(ctx, 'POST', `/api/tables/${tt!.tableId}/ready`, p, { ready: true });
    const s = await view(ctx, watcher!, tt!.tableId);
    expect(s.table.mySeat).toBeNull();
    expect(s.game.legalActions).toEqual([]);
    expect(s.table.inviteCode).toBeNull();
    expect((await call(ctx, 'POST', `/api/tables/${tt!.tableId}/join`, watcher, {})).json().errorCode).toBe('INVITE_REQUIRED');
    // Spectators read the table chat but cannot post.
    const chat = await call(ctx, 'GET', `/api/tables/${tt!.tableId}/chat`, watcher);
    expect(chat.statusCode).toBe(200);
    expect(chat.json().canPost).toBe(false);
    const live = (await call(ctx, 'GET', '/api/tables/live', watcher)).json().items;
    expect(live.find((t: { id: string }) => t.id === tt!.tableId)).toMatchObject({ tournament: { id, round: 1 }, players: expect.any(Array) });
  });
});

describe('absence', () => {
  it('a no-show is replaced by a bot (0 points) and knocked out', async () => {
    const id = await create({ format: 'knockout', rounds: undefined, advance: 1 });
    const [a, b] = await users(ctx, 2);
    for (const p of [a!, b!]) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    const [t] = await roundTables(id, 1);
    await call(ctx, 'POST', `/api/tables/${t!.tableId}/ready`, a, { ready: true }); // b never comes
    expect((await call(ctx, 'POST', `/api/tables/${t!.tableId}/leave`, a)).statusCode).toBe(403);
    await makeDue(ctx, (await pendingDeadline(ctx, t!.tableId, 'ready'))!.id);
    await runDueDeadlines(ctx.db, registry);
    const s = await view(ctx, a!, t!.tableId);
    expect(s.table.status).toBe('active');
    expect(s.table.seats.filter((x: { kind: string }) => x.kind === 'bot')).toHaveLength(1);
    const [row] = await ctx.db.select().from(tournamentTables).where(eq(tournamentTables.tableId, t!.tableId));
    expect(row!.absent).toEqual([b!.id]);
    // a resigns to the bot: a is present (loses), b absent → both out; the final was this table.
    await command(ctx, a!, t!.tableId, s.game.revision, { type: 'resign' });
    await runTournaments(ctx.db, registry);
    const d = await detail(id);
    expect(d.status).toBe('finished');
    expect(d.standings.find((x: { player: { id: string } }) => x.player.id === b!.id).noShows).toBe(1);
    expect(d.standings.find((x: { player: { id: string } }) => x.player.id === a!.id).finalRank).toBe(1);
  });

  it('a player whose move clock runs out is replaced by a bot for the rest of the table', async () => {
    const id = await create({ rounds: 1 });
    const [a, b] = await users(ctx, 2);
    for (const p of [a!, b!]) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    const [t] = await roundTables(id, 1);
    for (const p of [a!, b!]) await call(ctx, 'POST', `/api/tables/${t!.tableId}/ready`, p, { ready: true });
    await makeDue(ctx, (await pendingDeadline(ctx, t!.tableId, 'turn'))!.id);
    await runDueDeadlines(ctx.db, registry);
    const [row] = await ctx.db.select().from(tournamentTables).where(eq(tournamentTables.tableId, t!.tableId));
    expect(row!.absent).toHaveLength(1);
    const present = [a!, b!].find((p) => !row!.absent.includes(p.id))!;
    const s = await view(ctx, present, t!.tableId);
    expect(s.table.status).toBe('active');
    expect(s.table.seats.filter((x: { kind: string }) => x.kind === 'bot')).toHaveLength(1);
  });

  it('without a bot, the player who came wins by forfeit', async () => {
    const id = await create({ gameId: 'sealed-bids', rounds: 1 });
    const [a, b] = await users(ctx, 2);
    for (const p of [a!, b!]) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    const [t] = await roundTables(id, 1);
    await call(ctx, 'POST', `/api/tables/${t!.tableId}/ready`, b, { ready: true });
    await makeDue(ctx, (await pendingDeadline(ctx, t!.tableId, 'ready'))!.id);
    await runDueDeadlines(ctx.db, registry);
    await runTournaments(ctx.db, registry);
    const d = await detail(id);
    expect(d.status).toBe('finished');
    expect(d.standings[0]).toMatchObject({ player: { id: b!.id }, points: 1, finalRank: 1 });
    expect(d.roundsPlayed[0].tables[0].players.find((x: { player: { id: string } }) => x.player.id === a!.id).absent).toBe(true);
  });
});

describe('entry fees', () => {
  it('coins: checked, debited once, returned on withdrawal and on a cancelled start', async () => {
    const id = await create({ entryKind: 'coins', entryAmount: 50, minEntrants: 3 });
    const [a, b] = await users(ctx, 2);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/register`, a)).json().errorCode).toBe('INSUFFICIENT_COINS');
    await give(a!.id, 120);
    await give(b!.id, 50);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/register`, a)).statusCode).toBe(204);
    expect(await coinBalance(ctx.db, a!.id)).toBe(70);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/withdraw`, a)).statusCode).toBe(204);
    expect(await coinBalance(ctx.db, a!.id)).toBe(120);
    await call(ctx, 'POST', `/api/tournaments/${id}/register`, a);
    await call(ctx, 'POST', `/api/tournaments/${id}/register`, b);
    expect(await coinBalance(ctx.db, b!.id)).toBe(0);
    expect(await startNow(id)).toMatchObject({ cancelled: 1 }); // 2 of 3 needed
    expect(await coinBalance(ctx.db, a!.id)).toBe(120);
    expect(await coinBalance(ctx.db, b!.id)).toBe(50);
    expect((await detail(id)).status).toBe('cancelled');
  });

  it('Toman: registers only after the verified payment; a gone seat goes to the refund queue an admin settles', async () => {
    const id = await create({ entryKind: 'toman', entryAmount: 500_000, maxEntrants: 2 });
    const [a, b, c] = await users(ctx, 3);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/register`, a)).json().errorCode).toBe('TOURNAMENT_PAY_ONLINE');
    const pay = async (u: User) => {
      const r = await call(ctx, 'POST', `/api/tournaments/${id}/checkout`, u);
      expect(r.statusCode, r.body).toBe(200);
      const authority = new URL(r.json().redirectUrl).searchParams.get('authority')!;
      return async () => {
        await call(ctx, 'POST', `/api/payments/fake/${authority}/decision`, u, { decision: 'paid' });
        await ctx.app.inject({ method: 'GET', url: `/api/payments/callback?provider=fake&authority=${encodeURIComponent(authority)}` });
        return r.json().orderId as string;
      };
    };
    const payA = await pay(a!), payB = await pay(b!), payC = await pay(c!);
    expect((await detail(id, a)).me.registered).toBe(false);
    const orderA = await payA();
    expect((await call(ctx, 'GET', `/api/payments/${orderA}`, a)).json()).toMatchObject({ status: 'verified', kind: 'tournament', planTitleFa: 'جام سه‌خطی' });
    expect((await detail(id, a)).me.registered).toBe(true);
    await payB();
    await payC(); // full by now: paid, not registered, refund queued
    expect((await detail(id, c)).me).toMatchObject({ registered: false, refundStatus: 'pending' });
    const q = (await call(ctx, 'GET', '/api/admin/tournament-refunds?status=pending', admin)).json().items;
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ userId: c!.id, amount: 500_000 });
    expect((await call(ctx, 'GET', '/api/admin/tournament-refunds', c)).statusCode).toBe(403);
    expect((await call(ctx, 'POST', `/api/admin/tournament-refunds/${q[0].id}/paid`, admin, { note: 'کارت‌به‌کارت ۱۲۳' })).statusCode).toBe(204);
    expect((await detail(id, c)).me.refundStatus).toBe('paid');
    // Admin cancel: both paid entries queue for refund.
    expect((await call(ctx, 'POST', `/api/admin/tournaments/${id}/cancel`, admin, { reason: 'آزمایش لغو' })).statusCode).toBe(204);
    expect((await ctx.db.select().from(tournamentRefunds).where(eq(tournamentRefunds.tournamentId, id)))).toHaveLength(3);
    expect((await ctx.db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, id)))).toHaveLength(2);
  });
});
