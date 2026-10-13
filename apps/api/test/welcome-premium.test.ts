import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { grantWelcomePremium, WELCOME_PREMIUM_REASON } from '@bg/play';
import { grantRole, nextMobile, post, setup, FIXTURE_CODE, type TestCtx } from './helpers.ts';
import { call, users, type User } from './play-helpers.ts';

let ctx: TestCtx;
let admin: User;
beforeAll(async () => {
  ctx = await setup({ PAYMENT_PROVIDER: 'fake' });
  [admin] = await users(ctx, 1) as [User];
  await grantRole(ctx.db, admin.mobile, 'admin');
});
afterAll(async () => { await ctx.close(); });

const setPromo = (body: object, who: User = admin) => call(ctx, 'PUT', '/api/admin/welcome-premium', who, body);
const premium = async (u: User) => (await call(ctx, 'GET', '/api/me/subscription', u)).json();

describe('launch promo (admin switch): free premium on login, store hidden', () => {
  it('is off by default: no gift, store visible; only admins can change it', async () => {
    expect((await call(ctx, 'GET', '/api/admin/welcome-premium', admin)).json()).toEqual({ enabled: false, days: 30 });
    const [u] = await users(ctx, 1);
    expect((await premium(u!)).premium).toBe(false);
    expect((await call(ctx, 'GET', '/api/plans')).json().items.length).toBeGreaterThan(0);
    expect((await call(ctx, 'GET', '/api/me/coins', u)).json().shop.length).toBeGreaterThan(0);
    expect((await setPromo({ enabled: true, days: 30 }, u)).statusCode).toBe(403);
  });

  it('when on, grants the set days once; a later login never re-grants it', async () => {
    expect((await setPromo({ enabled: true, days: 7 })).statusCode).toBe(204);
    const [u] = await users(ctx, 1);
    const s = await premium(u!);
    expect(s.premium).toBe(true);
    const days = (new Date(s.premiumUntil).getTime() - Date.now()) / 86400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
    expect(await grantWelcomePremium(ctx.db, u!.id)).toBe(0); // what the next login does: no second gift, no gift box
    const rows = await ctx.db.select().from(schema.entitlements)
      .where(and(eq(schema.entitlements.userId, u!.id), eq(schema.entitlements.reason, WELCOME_PREMIUM_REASON)));
    expect(rows).toHaveLength(1);
  });

  it('the login that grants the gift reports its days (the client shows the gift box once)', async () => {
    await setPromo({ enabled: true, days: 30 });
    const mobile = nextMobile();
    const verify = async () => {
      const c = await post(ctx.app, '/api/auth/otp/request', { mobile });
      return (await post(ctx.app, '/api/auth/otp/verify', { challengeId: c.json().challengeId, code: FIXTURE_CODE })).json();
    };
    expect(await verify()).toEqual({ isNewUser: true, welcomeGiftDays: 30 });
  });

  it('when on, lists no plans, coin shop or coin packs and refuses to sell them; off reopens the store', async () => {
    await setPromo({ enabled: true, days: 30 });
    const [u] = await users(ctx, 1);
    expect((await call(ctx, 'GET', '/api/plans')).json().items).toEqual([]);
    const coins = (await call(ctx, 'GET', '/api/me/coins', u)).json();
    expect(coins.shop).toEqual([]);
    expect(coins.packs).toEqual([]);
    const [plan] = await ctx.db.select().from(schema.plans).limit(1);
    expect((await call(ctx, 'POST', '/api/subscriptions/checkout', u, { planId: plan!.id })).statusCode).not.toBe(200);
    expect((await call(ctx, 'POST', '/api/coins/spend', u, { item: 'premium-1d', requestId: crypto.randomUUID() })).statusCode).not.toBe(200);
    await setPromo({ enabled: false, days: 30 });
    expect((await call(ctx, 'GET', '/api/plans')).json().items.length).toBeGreaterThan(0);
    expect((await premium(u!)).premium).toBe(true); // a granted gift outlives the switch
  });
});
