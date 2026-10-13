import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TrophyTier } from '@bg/contracts';
import { schema } from '@bg/db';
import { COIN_RULES, coinBalance, coinsForReward, levelFor, runOutbox, totalXp } from '@bg/play';
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

const { coinLedger, coinPacks, rewardLedger, outboxEvents, entitlements } = schema;

async function playLineThree(players: User[]) {
  const t = await startTable(ctx, 'line-three', 2, { pace: 'turn', players });
  const bySeat = await seatsOf(ctx, t.tableId, players);
  let s = await view(ctx, players[0]!, t.tableId);
  for (const cell of [0, 3, 1, 4, 2]) s = (await command(ctx, bySeat(s.game.pendingSeats[0]), t.tableId, s.game.revision, { type: 'place', cell })).json().snapshot;
  await runOutbox(ctx.db);
  return t.tableId;
}
/** Expected balance straight from the rules: every reward row's coins plus every level reached. */
async function expected(userId: string) {
  const rows = await ctx.db.select().from(rewardLedger).where(eq(rewardLedger.userId, userId));
  const level = levelFor(await totalXp(ctx.db, userId)).level;
  const defs = await ctx.db.select().from(schema.achievementDefinitions);
  const tier = (k: string) => (defs.find((d) => d.key === k)!.criteria as { tier: TrophyTier }).tier;
  let n = rows.reduce((s, r) => s + coinsForReward(r, tier), 0);
  for (let l = 2; l <= level; l++) n += l * COIN_RULES.levelUp;
  return n;
}
const give = (userId: string, amount: number) => ctx.db.insert(coinLedger).values({ userId, amount, ruleId: 'test', reason: 'test', sourceKey: `test:${randomUUID()}` });

describe('earning coins', () => {
  it('a finished table pays coins once, matching the server rules; redelivery pays nothing', async () => {
    const [a, b] = await users(ctx, 2);
    const tableId = await playLineThree([a!, b!]);
    const balance = await coinBalance(ctx.db, a!.id);
    expect(balance).toBeGreaterThan(0);
    expect(balance).toBe(await expected(a!.id));
    const rewards = (await call(ctx, 'GET', `/api/me/rewards?tableId=${tableId}`, a)).json();
    expect(rewards.coins).toBeGreaterThan(0);
    await ctx.db.update(outboxEvents).set({ processedAt: null, claimedUntil: null }).where(eq(outboxEvents.topic, 'table.finished'));
    await runOutbox(ctx.db);
    expect(await coinBalance(ctx.db, a!.id)).toBe(balance);
    const wallet = (await call(ctx, 'GET', '/api/me/coins', a)).json();
    expect(wallet.balance).toBe(balance);
    expect(wallet.history.length).toBeGreaterThan(0);
    expect(wallet.earn.find((e: { labelFa: string }) => e.labelFa === 'هر بازی کامل').coins).toBe(5);
  });
});

describe('spending coins', () => {
  it('needs enough coins; a retried request spends once; premium days chain after existing premium', async () => {
    const [u] = await users(ctx, 1);
    const spend = (item: string, requestId = randomUUID()) => call(ctx, 'POST', '/api/coins/spend', u, { item, requestId });
    expect((await spend('premium-1d')).json().errorCode).toBe('INSUFFICIENT_COINS');
    await give(u!.id, 1500);
    const rid = randomUUID();
    const first = await spend('premium-1d', rid);
    expect(first.statusCode).toBe(200);
    expect(first.json().balance).toBe(1300);
    expect((await spend('premium-1d', rid)).json().balance).toBe(1300); // retry: no second charge
    const week = (await spend('premium-7d')).json();
    expect(week.balance).toBe(300);
    // 1 day then 7 days: the second pass starts where the first ends.
    const days = (Date.parse(week.premiumUntil) - Date.now()) / 86400_000;
    expect(days).toBeGreaterThan(7.9);
    expect(days).toBeLessThan(8.01);
    expect((await call(ctx, 'GET', '/api/me/subscription', u)).json().premium).toBe(true);
    const passes = await ctx.db.select().from(entitlements).where(eq(entitlements.userId, u!.id));
    expect(passes.map((p) => p.source)).toEqual(['coins', 'coins']);
    expect((await spend('premium-7d')).json().errorCode).toBe('INSUFFICIENT_COINS');
    expect((await spend('nope')).statusCode).toBe(400);
  });

  it('concurrent spends never overdraw', async () => {
    const [u] = await users(ctx, 1);
    await give(u!.id, 250);
    const all = await Promise.all([1, 2, 3].map(() => call(ctx, 'POST', '/api/coins/spend', u, { item: 'premium-1d', requestId: randomUUID() })));
    expect(all.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(await coinBalance(ctx.db, u!.id)).toBe(50);
  });
});

describe('buying coins', () => {
  it('a pack is purchasable only once priced; coins are credited once after server verification', async () => {
    const [pack] = await ctx.db.select().from(coinPacks).where(eq(coinPacks.coins, 500));
    const [u] = await users(ctx, 1);
    expect((await call(ctx, 'GET', '/api/me/coins', u)).json().packs).toEqual([]); // inactive until an admin approves
    expect((await call(ctx, 'PATCH', `/api/admin/coin-packs/${pack!.id}`, u, { priceAmount: 500_000, active: true, reason: 'قیمت آزمایشی' })).statusCode).toBe(403);
    expect((await call(ctx, 'PATCH', `/api/admin/coin-packs/${pack!.id}`, admin, { priceAmount: 500_000, active: true, reason: 'قیمت آزمایشی' })).statusCode).toBe(204);
    expect((await call(ctx, 'GET', '/api/me/coins', u)).json().packs[0]).toMatchObject({ coins: 500, purchasable: true });

    const r = await call(ctx, 'POST', '/api/coins/checkout', u, { packId: pack!.id });
    expect(r.statusCode).toBe(200);
    const { orderId, redirectUrl } = r.json();
    const authority = new URL(redirectUrl).searchParams.get('authority')!;
    const cb = () => ctx.app.inject({ method: 'GET', url: `/api/payments/callback?provider=fake&authority=${encodeURIComponent(authority)}` });
    await cb();
    expect(await coinBalance(ctx.db, u!.id)).toBe(0); // pending: nothing credited
    await call(ctx, 'POST', `/api/payments/fake/${authority}/decision`, u, { decision: 'paid' });
    await cb();
    await cb();
    expect(await coinBalance(ctx.db, u!.id)).toBe(500);
    const status = (await call(ctx, 'GET', `/api/payments/${orderId}`, u)).json();
    expect(status).toMatchObject({ status: 'verified', kind: 'coins', coins: 500 });
    expect((await call(ctx, 'GET', '/api/me/subscription', u)).json()).toMatchObject({ premium: false, payments: [{ orderId, status: 'verified' }] });
    await ctx.db.update(coinPacks).set({ active: false, priceAmount: null }).where(sql`true`);
  });
});
