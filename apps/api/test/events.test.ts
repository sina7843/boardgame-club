import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COSMETICS } from '@bg/contracts';
import { schema } from '@bg/db';
import { COIN_RULES, pickDailyMissions, runOutbox, tehranDate, tehranDayEnd } from '@bg/play';
import { grantRole, setup, type TestCtx } from './helpers.ts';
import { call, command, seatsOf, startTable, users, view, type User } from './play-helpers.ts';

let ctx: TestCtx;
let admin: User;
beforeAll(async () => {
  ctx = await setup();
  [admin] = await users(ctx, 1) as [User];
  await grantRole(ctx.db, admin.mobile, 'admin');
});
afterAll(async () => { await ctx.close(); });

const { rewardLedger, coinLedger, outboxEvents, missionDefinitions } = schema;

async function playLineThree(players: User[]) {
  const t = await startTable(ctx, 'line-three', 2, { pace: 'turn', players });
  const bySeat = await seatsOf(ctx, t.tableId, players);
  let s = await view(ctx, players[0]!, t.tableId);
  for (const cell of [0, 3, 1, 4, 2]) s = (await command(ctx, bySeat(s.game.pendingSeats[0]), t.tableId, s.game.revision, { type: 'place', cell })).json().snapshot;
  await runOutbox(ctx.db);
  return t.tableId;
}
const redeliver = async () => {
  await ctx.db.update(outboxEvents).set({ processedAt: null, claimedUntil: null }).where(eq(outboxEvents.topic, 'table.finished'));
  await runOutbox(ctx.db);
};
const ledger = (userId: string, ruleId: string) => ctx.db.select().from(rewardLedger).where(and(eq(rewardLedger.userId, userId), eq(rewardLedger.ruleId, ruleId)));

describe('daily missions', () => {
  it('three per Tehran day, deterministic and independent of row order; the day turns at Tehran midnight', () => {
    const defs = Array.from({ length: 10 }, (_, i) => ({ id: `00000000-0000-0000-0000-00000000000${i}` }));
    const today = pickDailyMissions('2026-11-25', defs);
    expect(today).toHaveLength(3);
    expect(new Set(today.map((d) => d.id)).size).toBe(3);
    expect(pickDailyMissions('2026-11-25', [...defs].reverse())).toEqual(today);
    expect(new Set(Array.from({ length: 20 }, (_, i) => pickDailyMissions(`2026-12-${String(i + 1).padStart(2, '0')}`, defs)[0]!.id)).size).toBeGreaterThan(1);
    expect(pickDailyMissions('2026-11-25', defs.slice(0, 2))).toHaveLength(2); // small pool: all of it
    // 00:00 Tehran = 20:30 UTC the evening before.
    expect(tehranDate(new Date('2026-11-24T20:29:59Z'))).toBe('2026-11-24');
    expect(tehranDate(new Date('2026-11-24T20:30:00Z'))).toBe('2026-11-25');
    expect(tehranDayEnd('2026-11-25').toISOString()).toBe('2026-11-25T20:30:00.000Z');
  });

  it('a completed daily mission pays its XP and the daily coins once; the weekly picker leaves daily missions alone', async () => {
    const catalog = (await call(ctx, 'GET', '/api/admin/missions', admin)).json().items as { id: string; key: string; period: string; active: boolean }[];
    const daily = catalog.filter((m) => m.period === 'daily');
    expect(daily).toHaveLength(10);
    expect(daily.every((m) => m.active)).toBe(true);
    // Pool of one → today's set is exactly that mission.
    for (const m of daily.filter((x) => x.key !== 'daily_complete_1')) {
      expect((await call(ctx, 'PATCH', `/api/admin/missions/${m.id}`, admin, { active: false, reason: 'تست روزانه' })).statusCode).toBe(204);
    }
    // Weekly picker: daily ids are not choosable and daily rows keep their state.
    const weekly = catalog.filter((m) => m.period === 'weekly');
    expect((await call(ctx, 'PUT', '/api/admin/missions/active', admin, { ids: [daily[0]!.id], reason: 'اشتباه' })).statusCode).toBe(404);
    expect((await call(ctx, 'PUT', '/api/admin/missions/active', admin, { ids: [weekly[0]!.id], reason: 'هفته' })).statusCode).toBe(204);
    const [kept] = await ctx.db.select().from(missionDefinitions).where(eq(missionDefinitions.key, 'daily_complete_1'));
    expect(kept!.active).toBe(true);

    const [a, b] = await users(ctx, 2);
    expect((await call(ctx, 'GET', '/api/me/daily', a)).json().missions.items).toEqual([expect.objectContaining({ key: 'daily_complete_1', progress: 0, target: 1, completed: false })]);
    await playLineThree([a!, b!]);
    await playLineThree([a!, b!]);
    await redeliver();
    for (const u of [a!, b!]) {
      const rows = await ledger(u.id, 'mission_daily.daily_complete_1');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: 'mission', amount: 15, sourceKey: `mission-daily:daily_complete_1:v1:${tehranDate()}:${u.id}` });
      const coins = await ctx.db.select().from(coinLedger).where(and(eq(coinLedger.userId, u.id), eq(coinLedger.ruleId, 'mission_daily.daily_complete_1')));
      expect(coins.map((c) => c.amount)).toEqual([COIN_RULES.dailyMission]);
    }
    expect(COIN_RULES.dailyMission).toBe(5);
    const p = (await call(ctx, 'GET', '/api/me/progression', a)).json();
    expect(p.daily).toMatchObject({ periodKey: tehranDate(), items: [{ key: 'daily_complete_1', progress: 1, completed: true }] });
    expect(p.missions.items.every((m: { key: string }) => m.key.startsWith('weekly_'))).toBe(true);
    // Daily completions do not feed the weekly «missions» trophies.
    expect(p.achievements.find((x: { key: string }) => x.key === 'missions_1').grantedAt).toBeNull();
    expect((await call(ctx, 'GET', '/api/me/coins', a)).json().earn.find((e: { labelFa: string }) => e.labelFa === 'مأموریت روزانه').coins).toBe(5);
  });
});

describe('events', () => {
  const reward = COSMETICS.find((c) => 'coins' in c.unlock)!;
  const hour = 3600_000;
  const body = (over: object = {}) => ({ slug: `ev-${randomUUID().slice(0, 8)}`, titleFa: 'هفتهٔ دوز', descriptionFa: 'بازی کنید و امتیاز بگیرید.',
    startsAt: new Date(Date.now() - hour).toISOString(), endsAt: new Date(Date.now() + 24 * hour).toISOString(), gameIds: ['line-three'],
    goals: [{ type: 'complete_tables', count: 2 }], rewardCosmetic: reward.key, active: true, ...over });

  it('admin CRUD validates the window, games and cosmetic; players cannot manage events', async () => {
    const [u] = await users(ctx, 1);
    expect((await call(ctx, 'POST', '/api/admin/events', u, body())).statusCode).toBe(403);
    const now = new Date().toISOString();
    expect((await call(ctx, 'POST', '/api/admin/events', admin, body({ startsAt: now, endsAt: now }))).statusCode).toBe(400);
    expect((await call(ctx, 'POST', '/api/admin/events', admin, body({ gameIds: ['no-such-game'] }))).statusCode).toBe(400);
    expect((await call(ctx, 'POST', '/api/admin/events', admin, body({ rewardCosmetic: 'zz.999' }))).statusCode).toBe(400);
    expect((await call(ctx, 'POST', '/api/admin/events', admin, body({ goals: [{ type: 'wins', count: 1 }] }))).statusCode).toBe(400); // no win goals
    const created = await call(ctx, 'POST', '/api/admin/events', admin, body({ slug: 'draft-event', active: false }));
    expect(created.statusCode).toBe(201);
    expect((await call(ctx, 'POST', '/api/admin/events', admin, body({ slug: 'draft-event' }))).json().errorCode).toBe('SLUG_TAKEN');
    const id = created.json().id;
    expect((await call(ctx, 'GET', '/api/events/draft-event')).statusCode).toBe(404); // inactive: not public
    expect((await call(ctx, 'PUT', `/api/admin/events/${id}`, admin, body({ slug: 'draft-event', titleFa: 'ویرایش‌شده', active: false }))).json().titleFa).toBe('ویرایش‌شده');
    expect((await call(ctx, 'PUT', `/api/admin/events/${id}`, admin, body({ slug: 'draft-event', endsAt: new Date(Date.now() - 2 * hour).toISOString() }))).statusCode).toBe(400);
    expect((await call(ctx, 'PATCH', `/api/admin/events/${id}`, admin, { active: true })).json().active).toBe(true);
    expect((await call(ctx, 'GET', '/api/events/draft-event')).json()).toMatchObject({ titleFa: 'ویرایش‌شده', status: 'live', me: null });
    await call(ctx, 'PATCH', `/api/admin/events/${id}`, admin, { active: false });
  });

  it('points from finished games in the window and game filter, anti-farming like XP, bot tables never; reward granted once', async () => {
    const live = (await call(ctx, 'POST', '/api/admin/events', admin, body({ slug: 'live-dooz' }))).json();
    await call(ctx, 'POST', '/api/admin/events', admin, body({ slug: 'other-game', gameIds: ['sealed-bids'] }));
    await call(ctx, 'POST', '/api/admin/events', admin, body({ slug: 'over', startsAt: new Date(Date.now() - 72 * hour).toISOString(), endsAt: new Date(Date.now() - 48 * hour).toISOString() }));
    await call(ctx, 'POST', '/api/admin/events', admin, body({ slug: 'soon', startsAt: new Date(Date.now() + 24 * hour).toISOString(), endsAt: new Date(Date.now() + 48 * hour).toISOString() }));
    expect((await call(ctx, 'GET', '/api/events')).json().items.map((e: { slug: string; status: string }) => e.status)).toEqual(['live', 'live', 'upcoming', 'ended']);

    const [a, b] = await users(ctx, 2);
    const before = (await call(ctx, 'GET', '/api/events/live-dooz', a)).json();
    expect(before.me).toEqual({ rank: null, points: 0, rewardGranted: false });
    expect(before.goals).toEqual([{ type: 'complete_tables', target: 2, progress: 0 }]);
    // Four games with the same opponent: the fourth is a repeated-opponent game (reduced XP) and earns no points.
    for (let i = 0; i < 4; i++) await playLineThree([a!, b!]);
    await redeliver();
    const total = async (slug: string, u: User) => (await call(ctx, 'GET', `/api/events/${slug}`, u)).json();
    const da = await total('live-dooz', a!), db = await total('live-dooz', b!);
    expect(da.me.points + db.me.points).toBe(3 * 2 + 3); // 3 counted games × 2 players + 3 first places
    // Players from the daily-missions test played line-three today too: ranks are 1..n by points, ties by who reached them first.
    const board = da.leaderboard as { rank: number; points: number; user: { id: string } }[];
    expect(board.map((r) => r.rank)).toEqual(board.map((_, i) => i + 1));
    expect(board.every((r, i) => i === 0 || board[i - 1]!.points >= r.points)).toBe(true);
    expect(board.find((r) => r.user.id === a!.id)).toMatchObject({ rank: da.me.rank, points: da.me.points });
    expect(da.goals).toEqual([{ type: 'complete_tables', target: 2, progress: 2 }]);
    for (const slug of ['other-game', 'over']) expect((await total(slug, a!)).me).toMatchObject({ points: 0, rank: null });

    // Reward: once, even after redelivery and more games; owned for cosmetics, not for sale again.
    for (const u of [a!, b!]) {
      const rows = await ledger(u.id, 'event.reward');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: 'cosmetic', amount: 0, sourceKey: `event:${live.id}:${u.id}` });
      expect((await total('live-dooz', u)).me.rewardGranted).toBe(true);
      expect((await call(ctx, 'GET', '/api/me/cosmetics', u)).json().unlocked).toContain(reward.key);
    }
    expect((await call(ctx, 'POST', '/api/cosmetics/buy', a, { item: reward.key, requestId: randomUUID() })).json().errorCode).toBe('ALREADY_OWNED');
    for (const slug of ['other-game', 'over']) expect((await total(slug, a!)).me.rewardGranted).toBe(false);

    // A bot-table row inside the window never counts.
    const [res] = await ctx.db.execute(sql`select id from game_results limit 1`) as unknown as { id: string }[];
    const [c] = await users(ctx, 1);
    await ctx.db.insert(rewardLedger).values({ userId: c!.id, resultId: res!.id, sourceKey: `test-bot:${c!.id}`, ruleId: 'xp.bot_match', ruleVersion: 1, kind: 'xp', amount: 6,
      reason: 'test', gameId: 'line-three', metadata: { vsBot: true } });
    expect((await total('live-dooz', c!)).me).toMatchObject({ points: 0, rank: null });
    // Guests see the board without a «me» row.
    expect((await call(ctx, 'GET', '/api/events/live-dooz')).json()).toMatchObject({ me: null, rules: { perGame: 1, firstPlace: 1 } });
  });
});
