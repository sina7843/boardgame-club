import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { expireSubscriptions, reconcilePayments } from '@bg/play';
import { billingFor } from '../src/app.ts';
import { grantRole, setup, testConfig, type TestCtx } from './helpers.ts';
import { call, command, seatsOf, users, view, type User } from './play-helpers.ts';

let ctx: TestCtx;
let admin: User;
let monthly: string;
beforeAll(async () => {
  ctx = await setup({ TURN_TABLE_LIMIT: '1', TURN_TABLE_LIMIT_PREMIUM: '2' });
  [admin] = await users(ctx, 1) as [User];
  await grantRole(ctx.db, admin.mobile, 'admin');
  monthly = (await ctx.db.select().from(schema.plans).where(eq(schema.plans.key, 'premium-monthly')))[0]!.id;
});
afterAll(async () => { await ctx.close(); });

const { payments, subscriptions, entitlements, fakeGatewayTransactions, paymentEvents } = schema;
const billing = () => billingFor(testConfig({ PAYMENT_PROVIDER: 'fake' }), ctx.db);

async function startCheckout(u: User) {
  const r = await call(ctx, 'POST', '/api/subscriptions/checkout', u, { planId: monthly });
  expect(r.statusCode).toBe(200);
  const { orderId, redirectUrl } = r.json();
  const authority = new URL(redirectUrl).searchParams.get('authority')!;
  return { orderId, authority };
}
const decide = (u: User, authority: string, decision: string) => call(ctx, 'POST', `/api/payments/fake/${authority}/decision`, u, { decision });
const callback = (authority: string, provider = 'fake') => ctx.app.inject({ method: 'GET', url: `/api/payments/callback?provider=${provider}&authority=${encodeURIComponent(authority)}` });
const sub = async (u: User) => (await call(ctx, 'GET', '/api/me/subscription', u)).json();

describe('plans and checkout availability', () => {
  it('a plan without an approved price is not purchasable; admin pricing is audited', async () => {
    const plans = (await call(ctx, 'GET', '/api/plans')).json();
    expect(plans.checkout).toEqual({ available: true, reasonFa: null, fixture: true });
    expect(plans.items.every((p: { purchasable: boolean }) => !p.purchasable)).toBe(true);
    const [u] = await users(ctx, 1);
    expect((await call(ctx, 'POST', '/api/subscriptions/checkout', u, { planId: monthly })).statusCode).toBe(404);
    expect((await call(ctx, 'PATCH', `/api/admin/plans/${monthly}`, u, { priceAmount: 1_000_000, active: true, reason: 'x y z' })).statusCode).toBe(403);
    expect((await call(ctx, 'PATCH', `/api/admin/plans/${monthly}`, admin, { priceAmount: 1_000_000, active: true, reason: 'قیمت آزمایشی' })).statusCode).toBe(204);
    expect((await call(ctx, 'GET', '/api/plans')).json().items.find((p: { id: string }) => p.id === monthly).purchasable).toBe(true);
  });

  it('production refuses the fake gateway; without a provider checkout is disabled with an honest reason', () => {
    expect(() => testConfig({ NODE_ENV: 'production', WEB_ORIGINS: 'https://x.example', OTP_HASH_SECRET: 'p'.repeat(40), PAYMENT_PROVIDER: 'fake', DATABASE_URL: 'postgres://u:p@h/d' }))
      .toThrow(/PAYMENT_PROVIDER=fake is development-only/);
    const none = billingFor(testConfig({ PAYMENT_PROVIDER: 'none' }), ctx.db);
    expect(none.gateway).toBeNull();
    expect(none.unavailableReasonFa).toContain('درگاه');
  });
});

describe('payment verification (FR-15)', () => {
  it('activates only after server verification; duplicate callbacks change nothing', async () => {
    const [u] = await users(ctx, 1);
    const { orderId, authority } = await startCheckout(u!);
    // A callback before the payer finished is only "pending": no access.
    expect((await callback(authority)).headers.location).toContain(`order=${orderId}`);
    expect((await sub(u!)).premium).toBe(false);
    await decide(u!, authority, 'paid');
    await callback(authority);
    await callback(authority);
    await callback(authority);
    const s = await sub(u!);
    expect(s).toMatchObject({ premium: true, autoRenew: false });
    expect(s.subscriptions).toHaveLength(1);
    expect(s.payments[0]).toMatchObject({ orderId, status: 'verified' });
    const events = await ctx.db.select().from(paymentEvents).where(eq(paymentEvents.authority, authority));
    expect(events.map((e) => e.outcome)).toEqual(expect.arrayContaining(['pending', 'verified', 'duplicate']));
  });

  it('forged, failed, mismatched and reused-reference payments never activate', async () => {
    // forged: unknown authority / wrong provider
    expect((await callback('FAKE-forged')).headers.location).toContain('error=unknown');
    const [u1, u2, u3, u4] = await users(ctx, 4);
    const a1 = await startCheckout(u1!);
    expect((await callback(a1.authority, 'zarinpal')).headers.location).toContain('error=unknown');
    // declined
    await decide(u1!, a1.authority, 'failed');
    await callback(a1.authority);
    expect(await sub(u1!)).toMatchObject({ premium: false, payments: [{ status: 'failed', failureReason: 'DECLINED_BY_PAYER' }] });
    // paid amount differs from the order
    const a2 = await startCheckout(u2!);
    await decide(u2!, a2.authority, 'wrong_amount');
    await callback(a2.authority);
    expect(await sub(u2!)).toMatchObject({ premium: false, payments: [{ status: 'failed', failureReason: 'AMOUNT_MISMATCH' }] });
    // a provider reference that was already used for another payment
    const a3 = await startCheckout(u3!);
    await decide(u3!, a3.authority, 'paid');
    await callback(a3.authority);
    const a4 = await startCheckout(u4!);
    await decide(u4!, a4.authority, 'paid');
    await ctx.db.update(fakeGatewayTransactions).set({ refId: `FAKE-REF-${a3.orderId}` }).where(eq(fakeGatewayTransactions.authority, a4.authority));
    await callback(a4.authority);
    expect(await sub(u4!)).toMatchObject({ premium: false, payments: [{ status: 'failed', failureReason: 'DUPLICATE_REFERENCE' }] });
    // a failed payment stays failed even if the gateway later says paid
    await decide(u1!, a1.authority, 'paid');
    await callback(a1.authority);
    expect((await sub(u1!)).premium).toBe(false);
  });

  it('delayed confirmation is recovered by reconciliation or a user re-check; stale pending payments expire', async () => {
    const [u, v] = await users(ctx, 2);
    const { orderId, authority } = await startCheckout(u!);
    await decide(u!, authority, 'delayed');
    await callback(authority);
    expect((await call(ctx, 'GET', `/api/payments/${orderId}`, u)).json().status).toBe('pending');
    // The bank confirms later but the browser never returns: the worker reconciles.
    await ctx.db.update(fakeGatewayTransactions).set({ decision: 'paid', refId: `FAKE-REF-${orderId}` }).where(eq(fakeGatewayTransactions.authority, authority));
    await ctx.db.update(payments).set({ updatedAt: sql`now() - interval '2 minutes'` }).where(eq(payments.orderId, orderId));
    expect((await reconcilePayments(ctx.db, billing())).checked).toBeGreaterThanOrEqual(1);
    expect((await sub(u!)).premium).toBe(true);
    // Never-confirmed payment past its window → expired on the next check (user-triggered here).
    const late = await startCheckout(v!);
    await ctx.db.update(payments).set({ expiresAt: sql`now() - interval '1 minute'` }).where(eq(payments.orderId, late.orderId));
    expect((await call(ctx, 'POST', `/api/payments/${late.orderId}/verify`, v)).json().status).toBe('expired');
    expect((await sub(v!)).premium).toBe(false);
  });

  it('renewal extends from the current end; expiry is processed and running entitlement checks follow time', async () => {
    const [u] = await users(ctx, 1);
    for (let i = 0; i < 2; i++) {
      const { authority } = await startCheckout(u!);
      await decide(u!, authority, 'paid');
      await callback(authority);
    }
    const subs = (await sub(u!)).subscriptions;
    expect(subs).toHaveLength(2);
    const [later, first] = subs;
    expect(new Date(later.startsAt).getTime()).toBe(new Date(first.endsAt).getTime());
    expect(new Date(later.endsAt).getTime() - new Date(first.startsAt).getTime()).toBe(60 * 86400_000);
    // Expire everything.
    await ctx.db.update(subscriptions).set({ startsAt: sql`now() - interval '70 days'`, endsAt: sql`now() - interval '1 day'` }).where(eq(subscriptions.userId, u!.id));
    await ctx.db.update(entitlements).set({ startsAt: sql`now() - interval '70 days'`, endsAt: sql`now() - interval '1 day'` }).where(eq(entitlements.userId, u!.id));
    expect((await expireSubscriptions(ctx.db)).expired).toBeGreaterThanOrEqual(2);
    expect(await sub(u!)).toMatchObject({ premium: false, premiumUntil: null });
  });
});

describe('premium access (§13, FR-15)', () => {
  const grant = (u: User, days = 30) => call(ctx, 'POST', '/api/admin/entitlements', admin, { userId: u.id, days, reason: 'آزمون دسترسی' });

  it('premium game: host needs premium, invited free friends may join and play, public joiners may not; expiry mid-game changes nothing', async () => {
    const [host, friend, stranger] = await users(ctx, 3);
    expect((await call(ctx, 'PATCH', '/api/admin/games/sealed-bids/access', admin, { access: 'premium', premiumHostInvitesFree: true, reason: 'آزمون پریمیوم' })).statusCode).toBe(204);
    const body = { gameId: 'sealed-bids', pace: 'turn', capacity: 2, turnSeconds: 86400 };
    expect((await call(ctx, 'POST', '/api/tables', host, body)).json().errorCode).toBe('PREMIUM_REQUIRED');
    const g = await grant(host!);
    expect(g.statusCode).toBe(201);
    const pub = (await call(ctx, 'POST', '/api/tables', host, { ...body, visibility: 'public' })).json().id;
    expect((await call(ctx, 'POST', `/api/tables/${pub}/join`, stranger, {})).json().errorCode).toBe('PREMIUM_REQUIRED');
    await call(ctx, 'POST', `/api/tables/${pub}/leave`, host);
    const priv = (await call(ctx, 'POST', '/api/tables', host, body)).json().id;
    const invite = (await view(ctx, host!, priv)).table.inviteCode;
    expect((await call(ctx, 'POST', `/api/tables/${priv}/join`, friend, { inviteCode: invite })).statusCode).toBe(200);
    await call(ctx, 'POST', `/api/tables/${priv}/ready`, host, { ready: true });
    expect((await call(ctx, 'POST', `/api/tables/${priv}/ready`, friend, { ready: true })).json().table.status).toBe('active');
    const [t] = await ctx.db.select().from(schema.gameTables).where(eq(schema.gameTables.id, priv));
    expect((t!.settings as { eligibility: Record<string, string> }).eligibility).toEqual({ [host!.id]: 'premium', [friend!.id]: 'host_invite' });
    // The host's premium is revoked mid-game: the game continues.
    await call(ctx, 'DELETE', `/api/admin/entitlements/${g.json().id}`, admin, { reason: 'آزمون انقضا' });
    const bySeat = await seatsOf(ctx, priv, [host!, friend!]);
    const s = await view(ctx, host!, priv);
    expect((await command(ctx, bySeat(0), priv, s.game.revision, { type: 'bid', token: 3 })).json().status).toBe('accepted');
    // …but a new premium table cannot be created any more.
    expect((await call(ctx, 'POST', '/api/tables', host, body)).json().errorCode).toBe('PREMIUM_REQUIRED');
    // Queueing for a premium game needs premium; premium never changes queue order.
    expect((await call(ctx, 'POST', '/api/matchmaking/tickets', stranger, { gameId: 'sealed-bids', pace: 'turn', playerCount: 2, turnSeconds: 86400 })).json().errorCode).toBe('PREMIUM_REQUIRED');
    await call(ctx, 'PATCH', '/api/admin/games/sealed-bids/access', admin, { access: 'free', premiumHostInvitesFree: true, reason: 'بازگشت' });
  });

  it('a host whose premium ends before start cannot start a premium game', async () => {
    const [host, friend] = await users(ctx, 2);
    await call(ctx, 'PATCH', '/api/admin/games/line-three/access', admin, { access: 'premium', premiumHostInvitesFree: true, reason: 'آزمون' });
    const g = await grant(host!);
    const id = (await call(ctx, 'POST', '/api/tables', host, { gameId: 'line-three', pace: 'turn', capacity: 2, turnSeconds: 86400 })).json().id;
    const invite = (await view(ctx, host!, id)).table.inviteCode;
    await call(ctx, 'POST', `/api/tables/${id}/join`, friend, { inviteCode: invite });
    await call(ctx, 'DELETE', `/api/admin/entitlements/${g.json().id}`, admin, { reason: 'آزمون انقضا' });
    await call(ctx, 'POST', `/api/tables/${id}/ready`, host, { ready: true });
    expect((await call(ctx, 'POST', `/api/tables/${id}/ready`, friend, { ready: true })).json().errorCode).toBe('PREMIUM_REQUIRED');
    await call(ctx, 'PATCH', '/api/admin/games/line-three/access', admin, { access: 'free', premiumHostInvitesFree: true, reason: 'بازگشت' });
  });

  it('turn-based cap is higher with premium but never unlimited; premium does not reorder the ranked queue', async () => {
    const [u, x, y] = await users(ctx, 3);
    const body = { gameId: 'line-three', pace: 'turn', capacity: 2, turnSeconds: 86400 };
    expect((await call(ctx, 'POST', '/api/tables', u, body)).statusCode).toBe(201);
    expect((await call(ctx, 'POST', '/api/tables', u, body)).json().errorCode).toBe('TURN_TABLE_LIMIT');
    await grant(u!);
    expect((await call(ctx, 'POST', '/api/tables', u, body)).statusCode).toBe(201);
    expect((await call(ctx, 'POST', '/api/tables', u, body)).json().errorCode).toBe('TURN_TABLE_LIMIT');
    // x and y queue first (free), a premium player queues last for a 2-player ranked game: x and y are paired.
    const [p] = await users(ctx, 1);
    await grant(p!);
    const q = { gameId: 'sealed-bids', pace: 'live', competition: 'ranked', playerCount: 2, turnSeconds: 60 };
    await call(ctx, 'POST', '/api/matchmaking/tickets', x, q);
    await ctx.db.update(schema.matchmakingTickets).set({ createdAt: sql`now() - interval '5 seconds'` }).where(eq(schema.matchmakingTickets.userId, x!.id));
    await call(ctx, 'POST', '/api/matchmaking/tickets', y, q);
    await call(ctx, 'POST', '/api/matchmaking/tickets', p, q);
    const [px] = await ctx.db.select().from(schema.matchmakingTickets).where(and(eq(schema.matchmakingTickets.userId, x!.id)));
    const [pp] = await ctx.db.select().from(schema.matchmakingTickets).where(and(eq(schema.matchmakingTickets.userId, p!.id)));
    expect(px!.status).toBe('matched');
    expect(pp!.status).toBe('queued');
  });

  it('advanced trend stats are premium; core history is free', async () => {
    const [u] = await users(ctx, 1);
    expect((await call(ctx, 'GET', '/api/me/stats/history?gameId=line-three&mode=live', u)).statusCode).toBe(200);
    expect((await call(ctx, 'GET', '/api/me/stats/trends?gameId=line-three&mode=live', u)).json().errorCode).toBe('PREMIUM_REQUIRED');
    await grant(u!);
    expect((await call(ctx, 'GET', '/api/me/stats/trends?gameId=line-three&mode=live', u)).statusCode).toBe(200);
  });
});
