import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '@bg/contracts';
import { schema } from '@bg/db';
import { coinBalance } from '@bg/play';
import { grantRole, setup, type TestCtx } from './helpers.ts';
import { call, users, type User } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const { coinLedger, rewardLedger, userAchievements, achievementDefinitions, userCosmetics, auditLog } = schema;
const give = (userId: string, amount: number) => ctx.db.insert(coinLedger).values({ userId, amount, ruleId: 'test', reason: 'test', sourceKey: `test:${randomUUID()}` });
const xp = (userId: string, amount: number) => ctx.db.insert(rewardLedger).values({ userId, ruleId: 'test', ruleVersion: 1, kind: 'manual', amount, reason: 'test', sourceKey: `test:${randomUUID()}` });
async function grantAchievement(userId: string, key: string) {
  const [d] = await ctx.db.select().from(achievementDefinitions).where(eq(achievementDefinitions.key, key));
  await ctx.db.insert(userAchievements).values({ userId, achievementId: d!.id });
}
const buy = (u: User, item: string, requestId = randomUUID()) => call(ctx, 'POST', '/api/cosmetics/buy', u, { item, requestId });
const patch = (u: User, body: object) => call(ctx, 'PATCH', '/api/me/profile', u, body);
/** Default avatar with one slot changed. */
const withPart = (slot: string, i: number) => DEFAULT_AVATAR.replace(new RegExp(`([:.])${slot}\\d+(?=\\.|$)`), `$1${slot}${i}`);

describe('buying cosmetics', () => {
  it('debits once per requestId, records ownership, refuses a second purchase and earned-only items', async () => {
    const [u] = await users(ctx, 1) as [User];
    expect((await buy(u, 'h.6')).json().errorCode).toBe('INSUFFICIENT_COINS');
    await give(u.id, 250);
    const rid = randomUUID();
    const first = await buy(u, 'h.6', rid);
    expect(first.statusCode).toBe(200);
    expect(first.json().balance).toBe(150);
    expect((await buy(u, 'h.6', rid)).json().balance).toBe(150); // retry: same outcome, no second debit
    expect((await buy(u, 'h.6')).json().errorCode).toBe('ALREADY_OWNED');
    expect((await buy(u, 'a.3')).json().errorCode).toBe('NOT_FOR_SALE'); // crown: achievement only
    expect((await buy(u, 's.0')).json().errorCode).toBe('NOT_FOR_SALE'); // free
    expect((await buy(u, 'zz.1')).statusCode).toBe(404);
    expect(await coinBalance(ctx.db, u.id)).toBe(150);
    expect(await ctx.db.select().from(userCosmetics).where(eq(userCosmetics.userId, u.id))).toHaveLength(1);
    expect((await call(ctx, 'GET', '/api/me/cosmetics', u)).json().unlocked).toContain('h.6');
  });

  it('concurrent purchases of different items cannot overspend', async () => {
    const [u] = await users(ctx, 1) as [User];
    await give(u.id, 200);
    const all = await Promise.all(['h.6', 'h.7', 'hc.6'].map((k) => buy(u, k)));
    expect(all.filter((r) => r.statusCode === 200)).toHaveLength(2); // 100 + 100, or 100 + 80
    expect(await coinBalance(ctx.db, u.id)).toBeGreaterThanOrEqual(0);
  });
});

describe('bundles and gifts', () => {
  it('a bundle charges the discounted price of the items not owned yet, once per requestId', async () => {
    const [u] = await users(ctx, 1);
    await give(u!.id, 1000);
    // Owning one item makes the bundle cheaper: (250 + 220) × 0.75 = 353 (rounded).
    expect((await call(ctx, 'POST', '/api/cosmetics/buy', u, { item: 'bn.4', requestId: randomUUID() })).statusCode).toBe(200);
    const before = await coinBalance(ctx.db, u!.id);
    const rid = randomUUID();
    expect((await call(ctx, 'POST', '/api/cosmetics/bundles/buy', u, { bundle: 'bd.autumn', requestId: rid })).statusCode).toBe(200);
    expect((await call(ctx, 'POST', '/api/cosmetics/bundles/buy', u, { bundle: 'bd.autumn', requestId: rid })).statusCode).toBe(200);
    expect(before - await coinBalance(ctx.db, u!.id)).toBe(353);
    const owned = (await ctx.db.select().from(userCosmetics).where(eq(userCosmetics.userId, u!.id))).map((r) => r.itemKey);
    expect(owned).toEqual(expect.arrayContaining(['bn.4', 'cb.2', 'sr.2']));
    expect((await call(ctx, 'POST', '/api/cosmetics/bundles/buy', u, { bundle: 'bd.autumn', requestId: randomUUID() })).json().errorCode).toBe('ALREADY_OWNED');
  });

  it('gifts go to friends only: the sender pays, the friend owns it and is notified', async () => {
    const [a, b, stranger] = await users(ctx, 3);
    await give(a!.id, 500);
    await call(ctx, 'POST', '/api/friends/requests', a, { userId: b!.id });
    await call(ctx, 'POST', `/api/friends/requests/${a!.id}/accept`, b);
    expect((await call(ctx, 'POST', '/api/cosmetics/gift', a, { item: 'bu.1', userId: stranger!.id, requestId: randomUUID() })).statusCode).toBe(403);
    expect((await call(ctx, 'POST', '/api/cosmetics/gift', a, { item: 'bu.1', userId: b!.id, requestId: randomUUID() })).json()).toEqual({ balance: 420 });
    expect(await coinBalance(ctx.db, b!.id)).toBe(0);
    expect((await ctx.db.select().from(userCosmetics).where(eq(userCosmetics.userId, b!.id))).map((r) => r.itemKey)).toContain('bu.1');
    const n = (await call(ctx, 'GET', '/api/me/notifications', b)).json().items.find((x: { kind: string }) => x.kind === 'gift');
    expect(n.href).toBe('/me/wardrobe');
    expect((await call(ctx, 'POST', '/api/cosmetics/gift', a, { item: 'bu.1', userId: b!.id, requestId: randomUUID() })).json().errorCode).toBe('ALREADY_OWNED');
  });
});

describe('equipping', () => {
  it('rejects locked items and accepts them once unlocked by coins, level or achievement', async () => {
    const [u] = await users(ctx, 1) as [User];
    for (const [slot, i] of [['h', 6], ['h', 10], ['a', 3]] as const) {
      expect((await patch(u, { avatarKey: withPart(slot, i) })).json().errorCode).toBe('COSMETIC_LOCKED');
    }
    await give(u.id, 100);
    await buy(u, 'h.6');
    expect((await patch(u, { avatarKey: withPart('h', 6) })).json().avatarKey).toBe(withPart('h', 6));
    await xp(u.id, 1500); // level 6 needs 1500 XP
    expect((await patch(u, { avatarKey: withPart('h', 10) })).statusCode).toBe(200);
    await grantAchievement(u.id, 'winner_25');
    const res = (await patch(u, { avatarKey: withPart('a', 3), titleKey: 't.1', bannerKey: 'bn.6' })).json();
    expect(res.avatarKey).toBe(withPart('a', 3));
    expect(res.bannerKey).toBe('bn.6');
    expect((await patch(u, { titleKey: 't.10' })).json().errorCode).toBe('COSMETIC_LOCKED');
    expect((await patch(u, { avatarKey: 'v1:<script>' })).statusCode).toBe(400);
  });

  it('saves bio, favourite games and a showcase of owned achievements only; the card shows them', async () => {
    const [u, viewer] = await users(ctx, 2) as [User, User];
    await grantAchievement(u.id, 'first_win');
    expect((await patch(u, { showcase: ['veteran'] })).statusCode).toBe(400);
    expect((await patch(u, { favoriteGames: ['no-such-game'] })).statusCode).toBe(400);
    expect((await patch(u, { bio: 'abc‮def' })).statusCode).toBe(400);
    const ok = await patch(u, { bio: 'عاشق کاتان', favoriteGames: ['line-three'], showcase: ['first_win'] });
    expect(ok.statusCode).toBe(200);
    const card = (await call(ctx, 'GET', `/api/users/${u.id}/card`, viewer)).json();
    expect(card).toMatchObject({ bio: 'عاشق کاتان', favoriteGames: ['line-three'], showcase: ['first_win'] });
    expect(JSON.stringify(card)).not.toMatch(/mobile/i);
    expect((await patch(u, { bio: '' })).json().bio).toBeNull();
  });

  it('a moderator can clear a reported bio, audited', async () => {
    const [u, reporter, mod] = await users(ctx, 3) as [User, User, User];
    await grantRole(ctx.db, mod.mobile, 'moderator');
    await patch(u, { bio: 'متن نامناسب' });
    expect((await call(ctx, 'POST', '/api/reports', reporter, { targetType: 'bio', targetId: u.id, reasonCode: 'abuse', reason: 'متن توهین‌آمیز' })).statusCode).toBe(201);
    expect((await call(ctx, 'POST', `/api/mod/users/${u.id}/clear-bio`, reporter, { reason: 'test' })).statusCode).toBe(403);
    expect((await call(ctx, 'POST', `/api/mod/users/${u.id}/clear-bio`, mod, { reason: 'متن توهین‌آمیز' })).statusCode).toBe(204);
    expect((await call(ctx, 'GET', `/api/users/${u.id}/card`, reporter)).json().bio).toBeNull();
    expect(await ctx.db.select().from(auditLog).where(eq(auditLog.action, 'profile.clear_bio'))).toHaveLength(1);
  });
});
