import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { runOutbox } from '@bg/play';
import { grantRole, setup, type TestCtx } from './helpers.ts';
import { call, command, seatsOf, startTable, users, view, type User } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const { ratings, ratingHistory, rewardLedger, outboxEvents, leaguePlacements, seasons, gameTables } = schema;

/** Play line-three to the end: the first mover wins with the top row. */
async function finishLineThree(tableId: string, players: User[]) {
  const bySeat = await seatsOf(ctx, tableId, players);
  let s = await view(ctx, players[0]!, tableId);
  for (const cell of [0, 3, 1, 4, 2]) {
    s = (await command(ctx, bySeat(s.game.pendingSeats[0]), tableId, s.game.revision, { type: 'place', cell })).json().snapshot;
  }
  return s;
}

/** A ranked table can only come from ranked matchmaking. */
async function rankedMatch(game: 'line-three' | 'sealed-bids', players: User[]) {
  for (const p of players) {
    const r = await call(ctx, 'POST', '/api/matchmaking/tickets', p, { gameId: game, pace: 'turn', competition: 'ranked', playerCount: players.length, turnSeconds: 86400 });
    expect(r.statusCode).toBe(201);
  }
  const tableId = (await call(ctx, 'GET', '/api/me/matchmaking', players[0])).json().items[0].matchedTableId as string;
  for (const p of players) await call(ctx, 'POST', `/api/tables/${tableId}/ready`, p, { ready: true });
  return tableId;
}

const xpRows = (userId: string) => ctx.db.select().from(rewardLedger).where(eq(rewardLedger.userId, userId));
const redeliver = async () => {
  await ctx.db.update(outboxEvents).set({ processedAt: null, claimedUntil: null }).where(eq(outboxEvents.topic, 'table.finished'));
  await runOutbox(ctx.db);
};

describe('ranked rating (FR-10)', () => {
  it('friendly tables cannot be ranked by hand; ranked results are applied exactly once, even when redelivered', async () => {
    const [a, b] = await users(ctx, 2);
    expect((await call(ctx, 'POST', '/api/tables', a, { gameId: 'line-three', pace: 'turn', capacity: 2, turnSeconds: 86400, competition: 'ranked' })).json().errorCode).toBe('RANKED_NOT_AVAILABLE');
    const tableId = await rankedMatch('line-three', [a!, b!]);
    expect((await view(ctx, a!, tableId)).table.competition).toBe('ranked');
    await finishLineThree(tableId, [a!, b!]);
    await runOutbox(ctx.db);
    const rows = await ctx.db.select().from(ratingHistory).where(sql`${ratingHistory.userId} in (${a!.id}, ${b!.id})`);
    expect(rows).toHaveLength(2);
    const winner = rows.find((r) => r.place === 1)!;
    expect(winner.muAfter).toBeGreaterThan(winner.muBefore);
    const snapshot = await ctx.db.select().from(ratings).where(sql`${ratings.userId} in (${a!.id}, ${b!.id})`);
    const ledgerBefore = (await xpRows(a!.id)).length;
    await redeliver();
    await redeliver();
    expect(await ctx.db.select().from(ratingHistory).where(sql`${ratingHistory.userId} in (${a!.id}, ${b!.id})`)).toHaveLength(2);
    expect(await ctx.db.select().from(ratings).where(sql`${ratings.userId} in (${a!.id}, ${b!.id})`)).toEqual(snapshot);
    expect((await xpRows(a!.id)).length).toBe(ledgerBefore);
    const rewards = (await call(ctx, 'GET', `/api/me/rewards?tableId=${tableId}`, a)).json();
    expect(rewards.processed).toBe(true);
    expect(rewards.rating.before).toBe(1500);
  });

  it('reordered result events each apply once; friendly results never touch ratings', async () => {
    const [a, b] = await users(ctx, 2);
    const t1 = await rankedMatch('line-three', [a!, b!]);
    await finishLineThree(t1, [a!, b!]);
    const t2 = await rankedMatch('line-three', [a!, b!]);
    await finishLineThree(t2, [a!, b!]);
    const friendly = await startTable(ctx, 'line-three', 2, { pace: 'turn', players: [a!, b!] });
    await finishLineThree(friendly.tableId, [a!, b!]);
    // Deliver the newer result first.
    const events = await ctx.db.select().from(outboxEvents).where(and(eq(outboxEvents.topic, 'table.finished'), sql`${outboxEvents.processedAt} is null`));
    const e2 = events.find((e) => e.aggregateId === t2)!;
    await ctx.db.update(outboxEvents).set({ availableAt: sql`now() + interval '1 hour'` }).where(sql`${outboxEvents.id} <> ${e2.id} and ${outboxEvents.processedAt} is null`);
    await runOutbox(ctx.db);
    await ctx.db.update(outboxEvents).set({ availableAt: sql`now()` }).where(sql`${outboxEvents.processedAt} is null`);
    await runOutbox(ctx.db);
    await redeliver();
    const [ra] = await ctx.db.select().from(ratings).where(and(eq(ratings.userId, a!.id), eq(ratings.gameId, 'line-three'), eq(ratings.mode, 'turn')));
    expect(ra!.gamesPlayed).toBe(2);
    expect(await ctx.db.select().from(ratingHistory).where(eq(ratingHistory.userId, a!.id))).toHaveLength(2);
    // The friendly game still earned completion XP.
    expect((await xpRows(a!.id)).filter((r) => r.ruleId === 'xp.match_completed')).toHaveLength(3);
  });

  it('shared placement: tied players in a 3-player ranked sealed-bids game get identical updates', async () => {
    const people = await users(ctx, 3);
    const tableId = await rankedMatch('sealed-bids', people);
    const bySeat = await seatsOf(ctx, tableId, people);
    // seats 0 and 1 mirror each other; seat 2 always bids lowest → seats 0/1 tie on every round
    for (const bids of [[5, 5, 1], [4, 4, 2], [3, 3, 3], [2, 2, 4], [1, 1, 5]]) {
      for (const [seat, token] of bids.entries()) {
        const s = await view(ctx, bySeat(seat), tableId);
        await command(ctx, bySeat(seat), tableId, s.game.revision, { type: 'bid', token });
      }
    }
    const result = (await view(ctx, people[0]!, tableId)).game.result;
    await runOutbox(ctx.db);
    const rows = await ctx.db.select().from(ratingHistory).where(sql`${ratingHistory.resultId} = (select id from game_results where table_id = ${tableId})`);
    const placeOf = (seat: number) => result.placements.find((p: { seat: number }) => p.seat === seat).place;
    expect(placeOf(0)).toBe(placeOf(1));
    const r0 = rows.find((r) => r.userId === bySeat(0).id)!;
    const r1 = rows.find((r) => r.userId === bySeat(1).id)!;
    expect(r0.muAfter).toBeCloseTo(r1.muAfter, 10);
    expect(rows.every((r) => r.fieldSize === 3)).toBe(true);
  });
});

describe('seasons and leaderboards', () => {
  it('places players by skill after the minimum games, freezes on close, and allows only audited corrections', async () => {
    const [admin, a, b] = await users(ctx, 3);
    await grantRole(ctx.db, admin!.mobile, 'admin');
    await ctx.db.update(seasons).set({ status: 'closed' }).where(eq(seasons.status, 'active'));
    const create = await call(ctx, 'POST', '/api/admin/seasons', admin, { nameFa: 'فصل آزمون', startsAt: new Date(Date.now() - 86400_000).toISOString(),
      endsAt: new Date(Date.now() + 30 * 86400_000).toISOString(), config: { minGames: 1, thresholds: { silver: 1350, gold: 1500, platinum: 1650, diamond: 1800, master: 1950 } } });
    const seasonId = create.json().id;
    expect((await call(ctx, 'POST', `/api/admin/seasons/${seasonId}/activate`, admin)).statusCode).toBe(204);
    const tableId = await rankedMatch('line-three', [a!, b!]);
    await finishLineThree(tableId, [a!, b!]);
    await runOutbox(ctx.db);
    const placed = await ctx.db.select().from(leaguePlacements).where(eq(leaguePlacements.seasonId, seasonId));
    expect(placed).toHaveLength(2);
    // One win/one loss from 1500: winner ≈1658 (platinum), loser ≈1342 (bronze) with the default thresholds.
    const order = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
    const winnerSeat = placed.sort((x, y) => y.rating - x.rating);
    expect(order.indexOf(winnerSeat[0]!.league)).toBeGreaterThan(order.indexOf(winnerSeat[1]!.league));
    expect(winnerSeat.map((p) => p.league)).toEqual(['platinum', 'bronze']);

    expect((await call(ctx, 'POST', `/api/admin/seasons/${seasonId}/close`, admin)).json()).toEqual({ placements: 2 });
    // Frozen: a direct write is rejected by the database itself.
    const direct = await ctx.db.update(leaguePlacements).set({ league: 'master' }).where(eq(leaguePlacements.seasonId, seasonId)).then(() => null, (e: { cause?: Error }) => e.cause?.message ?? String(e));
    expect(direct).toMatch(/season is closed/);
    // Explicit correction path works and is audited.
    expect((await call(ctx, 'POST', `/api/admin/seasons/${seasonId}/corrections`, admin, { userId: a!.id, gameId: 'line-three', mode: 'turn', league: 'platinum', reason: 'اصلاح پس از بررسی تقلب حریف' })).statusCode).toBe(204);
    const [fixed] = await ctx.db.select().from(leaguePlacements).where(and(eq(leaguePlacements.seasonId, seasonId), eq(leaguePlacements.userId, a!.id)));
    expect(fixed).toMatchObject({ league: 'platinum', correctedBy: admin!.id });
    const audit = await ctx.db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'season.correction'), eq(schema.auditLog.targetId, seasonId)));
    expect(audit).toHaveLength(1);
    const board = (await call(ctx, 'GET', `/api/games/line-three/leaderboard?mode=turn&seasonId=${seasonId}`, a)).json();
    expect(board.season.status).toBe('closed');
    expect(board.items).toHaveLength(2);
    // Season finishers received a cosmetic badge exactly once.
    const badges = await ctx.db.select().from(rewardLedger).where(eq(rewardLedger.ruleId, 'season.badge'));
    expect(badges.filter((x) => x.userId === a!.id)).toHaveLength(1);
  });

  it('live leaderboard lists only certain, experienced players', async () => {
    const [a, b] = await users(ctx, 2);
    const tableId = await rankedMatch('line-three', [a!, b!]);
    await finishLineThree(tableId, [a!, b!]);
    await runOutbox(ctx.db);
    const before = (await call(ctx, 'GET', '/api/games/line-three/leaderboard?mode=turn', a)).json().items.map((i: { user: { id: string } }) => i.user.id);
    expect(before).not.toContain(a!.id);
    await ctx.db.update(ratings).set({ gamesPlayed: 12, sigma: 5 }).where(eq(ratings.userId, a!.id));
    const after = (await call(ctx, 'GET', '/api/games/line-three/leaderboard?mode=turn', a)).json().items.map((i: { user: { id: string } }) => i.user.id);
    expect(after).toContain(a!.id);
  });
});

describe('XP, missions and achievements (FR-14)', () => {
  it('completion XP for both players, first-place bonus once, tutorial XP once, missions and achievements from server events', async () => {
    const [a, b] = await users(ctx, 2);
    for (let i = 0; i < 3; i++) {
      const t = await startTable(ctx, 'line-three', 2, { pace: 'turn', players: [a!, b!] });
      await finishLineThree(t.tableId, [a!, b!]);
    }
    await runOutbox(ctx.db);
    const p = (await call(ctx, 'GET', '/api/me/progression', a)).json();
    expect(p.missions.items.find((m: { key: string }) => m.key === 'weekly_complete_3')).toMatchObject({ progress: 3, completed: true });
    expect(p.achievements.find((x: { key: string }) => x.key === 'first_game').grantedAt).not.toBeNull();
    expect(p.achievements[0]).toMatchObject({ key: 'first_game', tier: 'bronze' }); // grouped by track, easiest first
    expect(p.achievements.find((x: { key: string }) => x.key === 'warm_up').grantedAt).toBeNull(); // 3 of 5 games
    expect(p.achievements.find((x: { key: string }) => x.key === 'table_legend').tier).toBe('diamond');
    expect(p.mastery.find((m: { gameId: string }) => m.gameId === 'line-three')).toMatchObject({ completed: 3, tierFa: 'آشنا' });
    expect(p.ledger.some((l: { reason: string }) => l.reason.includes('مأموریت'))).toBe(true);
    const missionRows = (await xpRows(a!.id)).filter((r) => r.ruleId === 'mission.weekly_complete_3');
    expect(missionRows).toHaveLength(1);

    // Tutorial: once per game, replay gives nothing.
    for (let i = 0; i < 2; i++) {
      const tid = (await call(ctx, 'POST', '/api/tutorials/sealed-bids/start', a, { restart: true })).json().tableId;
      let s = await view(ctx, a!, tid);
      for (const token of [1, 2, 5, 3, 4]) s = (await command(ctx, a!, tid, s.game.revision, { type: 'bid', token })).json().snapshot;
      expect(s.table.status).toBe('finished');
    }
    await runOutbox(ctx.db);
    expect((await xpRows(a!.id)).filter((r) => r.ruleId === 'xp.tutorial')).toHaveLength(1);
  });

  it('repeated opponent and daily cap reduce match XP with an explained reason', async () => {
    const [a, b] = await users(ctx, 2);
    for (let i = 0; i < 4; i++) {
      const t = await startTable(ctx, 'line-three', 2, { pace: 'turn', players: [a!, b!] });
      await finishLineThree(t.tableId, [a!, b!]);
      await runOutbox(ctx.db);
    }
    const matchRows = (await xpRows(a!.id)).filter((r) => r.ruleId === 'xp.match_completed').sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime());
    expect(matchRows.map((r) => r.amount)).toEqual([20, 20, 20, 5]);
    expect(matchRows[3]!.reason).toContain('حریف تکراری');
    // Daily cap: fill today's match XP up to the cap, then a new opponent still earns nothing, with the reason recorded.
    const [c] = await users(ctx, 1);
    await ctx.db.insert(rewardLedger).values({ userId: c!.id, sourceKey: `test-fill:${c!.id}`, ruleId: 'xp.match_completed', ruleVersion: 1, kind: 'xp', amount: 300, reason: 'test fill' });
    const t = await startTable(ctx, 'line-three', 2, { pace: 'turn', players: [c!, b!] });
    await finishLineThree(t.tableId, [c!, b!]);
    await runOutbox(ctx.db);
    const capped = (await xpRows(c!.id)).find((r) => r.resultId && r.ruleId === 'xp.match_completed')!;
    expect(capped.amount).toBe(0);
    expect(capped.reason).toContain('سقف روزانه');
  });

  it('cancelled tables award nothing and clients cannot claim progress', async () => {
    const [a, b, admin] = await users(ctx, 3);
    await grantRole(ctx.db, admin!.mobile, 'admin');
    for (const u of [a!, b!]) await call(ctx, 'POST', '/api/matchmaking/tickets', u, { gameId: 'line-three', pace: 'turn', playerCount: 2, turnSeconds: 172800 });
    const ticket = (await call(ctx, 'GET', '/api/me/matchmaking', a)).json().items[0];
    await call(ctx, 'DELETE', `/api/matchmaking/tickets/${ticket.id}`, a);
    const [cancelled] = await ctx.db.select().from(gameTables).where(eq(gameTables.id, ticket.matchedTableId));
    expect(cancelled!.status).toBe('cancelled');
    await runOutbox(ctx.db);
    expect(await xpRows(a!.id)).toHaveLength(0);
    // No client endpoint accepts milestones, mission completions or XP.
    for (const [method, url, body] of [['POST', '/api/me/progression', { xp: 500 }], ['POST', '/api/me/milestones', { key: 'first_win' }], ['POST', '/api/me/missions/weekly_complete_3/complete', {}]] as const) {
      expect((await call(ctx, method, url, a, body)).statusCode).toBe(404);
    }
    expect((await call(ctx, 'POST', '/api/admin/rewards', a, { userId: a!.id, amount: 500, reason: 'خودم به خودم' })).statusCode).toBe(403);
    expect((await call(ctx, 'GET', '/api/me/progression', a)).json().xp).toBe(0);
    // Manual reward by an admin is recorded with its reason and audited.
    expect((await call(ctx, 'POST', '/api/admin/rewards', admin, { userId: a!.id, amount: 50, reason: 'جبران خطای سیستم' })).statusCode).toBe(204);
    const p = (await call(ctx, 'GET', '/api/me/progression', a)).json();
    expect(p.xp).toBe(50);
    expect(p.ledger[0]).toMatchObject({ kind: 'manual', reason: 'جبران خطای سیستم' });
  });
});
