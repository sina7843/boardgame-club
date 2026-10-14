// Plans, checkout, gateway callback, payment status, subscription status and admin billing controls (FR-15).
import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, apiErrorSchema, coinsResponse, paymentStatus, plansResponse, subscriptionStatus } from '@bg/contracts';
import { schema } from '@bg/db';
import { checkout, COIN_RULES, COIN_SHOP, coinBalance, coinHistory, grantManualPremium, premiumUntil, setWelcomePremium, welcomePremium, spendCoins, verifyPayment, XP_RULES, type CoinShopKey } from '@bg/play';
import type { Deps } from '../../app.ts';
import { requireRole, requireUser } from '../auth/session.ts';

const { plans, coinPacks, payments, subscriptions, entitlements, auditLog, fakeGatewayTransactions, games } = schema;
/** Product title of a payment: its plan or its coin pack. */
const productTitle = sql<string>`coalesce(${plans.titleFa}, ${coinPacks.titleFa}, (select t.title_fa from tournaments t where t.id = ${payments.tournamentId}))`;
const TIER_FA = { bronze: 'برنزی', silver: 'نقره‌ای', gold: 'طلایی', turquoise: 'فیروزه‌ای', diamond: 'الماس' } as const;
const matchCoins = (xp: number) => Math.round(xp / COIN_RULES.matchXpDivisor);
/** How coins are earned, derived from the same constants the server pays by. */
const EARN = [
  { labelFa: 'هر بازی کامل', coins: matchCoins(XP_RULES.matchCompleted) },
  { labelFa: 'رتبه اول', coins: matchCoins(XP_RULES.firstPlace) },
  { labelFa: 'بازی کامل با ربات', coins: matchCoins(Math.round(XP_RULES.matchCompleted * XP_RULES.botShare)) },
  { labelFa: 'بازی روز', coins: COIN_RULES.dailyGame },
  { labelFa: 'اولین بازی در یک عنوان تازه', coins: COIN_RULES.newTitle },
  { labelFa: 'آموزش تعاملی هر بازی', coins: COIN_RULES.tutorial },
  { labelFa: 'مأموریت هفتگی', coins: COIN_RULES.mission },
  ...(Object.keys(TIER_FA) as (keyof typeof TIER_FA)[]).map((t) => ({ labelFa: `دستاورد ${TIER_FA[t]}`, coins: COIN_RULES.achievement[t] })),
  { labelFa: 'هر سطح تازه (ضرب در شماره سطح)', coins: COIN_RULES.levelUp }
];
const SHOP_KEYS = COIN_SHOP.map((i) => i.key) as [CoinShopKey, ...CoinShopKey[]];
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema, 502: apiErrorSchema };

export function billingRoutes(app: FastifyInstance, { db, billing, config }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const web = config.payments.publicWebUrl;
  /** The launch promo closes the store: no plans, coin shop or coin packs are listed or sold. */
  const storeClosed = async () => (await welcomePremium(db)).enabled;
  const closed = async () => { if (await storeClosed()) throw new AppError('PAYMENT_UNAVAILABLE'); };

  r.get('/plans', { schema: { tags: ['billing'], summary: 'Plans with terms; purchasable only with an approved price and a configured gateway', response: { 200: plansResponse } } }, async () => {
    const rows = await storeClosed() ? [] : await db.select().from(plans).orderBy(plans.durationDays);
    return {
      items: rows.map((p) => {
        const reason = !billing.gateway ? billing.unavailableReasonFa : !p.active ? 'این پلن فعلاً عرضه نمی‌شود.' : !p.priceAmount ? 'قیمت این پلن هنوز تعیین نشده است.' : null;
        return { id: p.id, key: p.key, titleFa: p.titleFa, period: p.period as 'monthly', durationDays: p.durationDays, priceAmount: p.priceAmount, currency: p.currency,
          termsFa: p.termsFa, purchasable: !reason, unavailableReasonFa: reason };
      }),
      checkout: { available: !!billing.gateway, reasonFa: billing.unavailableReasonFa, fixture: !!billing.gateway?.isFixture },
      limits: { turnTables: { free: config.play.turnTableLimit, premium: config.play.turnTableLimitPremium } }
    };
  });

  r.post('/subscriptions/checkout', {
    schema: { tags: ['billing'], summary: 'Start a payment for a plan; returns the gateway redirect URL', body: z.strictObject({ planId: z.uuid() }),
      response: { 200: z.object({ orderId: z.string(), redirectUrl: z.url() }), ...errors } }
  }, async (req) => { await closed(); return checkout(db, billing, requireUser(req).userId, { planId: req.body.planId }); });

  /** Browser redirect from the gateway. The query proves nothing; it only triggers server-side verification. */
  r.get('/payments/callback', {
    schema: { tags: ['billing'], summary: 'Gateway return URL (verifies server-to-server, then redirects to the result page)', hide: false,
      querystring: z.object({ provider: z.string().max(32), authority: z.string().max(128) }).loose() }
  }, async (req, reply) => {
    const out = await verifyPayment(db, billing, { provider: req.query.provider, authority: req.query.authority, via: 'callback' });
    return reply.redirect(out.orderId ? `${web}/payments/result?order=${encodeURIComponent(out.orderId)}` : `${web}/payments/result?error=unknown`, 303);
  });

  // Zarinpal return URL: Zarinpal appends ?Authority=…&Status=OK|NOK to the configured callback.
  r.get('/payments/callback/zarinpal', {
    schema: { tags: ['billing'], summary: 'Zarinpal return URL: NOK fails the payment, OK verifies server-to-server; then redirects to the result page',
      querystring: z.object({ Authority: z.string().max(64), Status: z.enum(['OK', 'NOK']) }).loose() }
  }, async (req, reply) => {
    const out = await verifyPayment(db, billing, { provider: 'zarinpal', authority: req.query.Authority, via: 'callback', payerCancelled: req.query.Status === 'NOK' });
    return reply.redirect(out.orderId ? `${web}/payments/result?order=${encodeURIComponent(out.orderId)}` : `${web}/payments/result?error=unknown`, 303);
  });

  const ownPayment = async (userId: string, orderId: string) => {
    const [row] = await db.select({ p: payments, title: productTitle, coins: coinPacks.coins }).from(payments).leftJoin(plans, eq(plans.id, payments.planId))
      .leftJoin(coinPacks, eq(coinPacks.id, payments.coinPackId)).where(and(eq(payments.orderId, orderId), eq(payments.userId, userId)));
    if (!row) throw new AppError('NOT_FOUND');
    return row;
  };
  const toStatus = (row: Awaited<ReturnType<typeof ownPayment>>) => ({ orderId: row.p.orderId, status: row.p.status as 'pending', failureReason: row.p.failureReason,
    amount: row.p.amount, planTitleFa: row.title, kind: row.p.planId ? 'plan' as const : row.p.coinPackId ? 'coins' as const : 'tournament' as const, coins: row.coins, fixture: row.p.provider === 'fake', tournamentId: row.p.tournamentId });

  r.get('/payments/:orderId', { schema: { tags: ['billing'], summary: 'My payment status', params: z.object({ orderId: z.string().max(64) }), response: { 200: paymentStatus, ...errors } } },
    async (req) => toStatus(await ownPayment(requireUser(req).userId, req.params.orderId)));

  r.post('/payments/:orderId/verify', {
    schema: { tags: ['billing'], summary: 'Re-check a pending payment with the gateway (recovery after a lost callback)', params: z.object({ orderId: z.string().max(64) }), response: { 200: paymentStatus, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const row = await ownPayment(userId, req.params.orderId);
    if (row.p.status === 'pending' && row.p.authority) await verifyPayment(db, billing, { provider: row.p.provider, authority: row.p.authority, via: 'user' });
    return toStatus(await ownPayment(userId, req.params.orderId));
  });

  r.get('/me/subscription', { schema: { tags: ['billing'], summary: 'Premium status, expiry, subscriptions and payment history (no auto-renewal)', response: { 200: subscriptionStatus, 401: apiErrorSchema } } }, async (req) => {
    const { userId } = requireUser(req, { allowSuspended: true });
    const until = await premiumUntil(db, userId);
    const subs = await db.select({ s: subscriptions, title: plans.titleFa }).from(subscriptions).innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.endsAt));
    const pays = await db.select({ p: payments, title: productTitle }).from(payments).leftJoin(plans, eq(plans.id, payments.planId))
      .leftJoin(coinPacks, eq(coinPacks.id, payments.coinPackId)).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt)).limit(30);
    return {
      premium: until !== undefined, premiumUntil: until ? until.toISOString() : null, autoRenew: false as const,
      subscriptions: subs.map(({ s, title }) => ({ planTitleFa: title, status: s.status, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() })),
      payments: pays.map(({ p, title }) => ({ orderId: p.orderId, planTitleFa: title, amount: p.amount, currency: p.currency, status: p.status as 'pending', failureReason: p.failureReason, createdAt: p.createdAt.toISOString() }))
    };
  });

  // ---------- Coins: wallet, shop and packs ----------
  r.get('/me/coins', { schema: { tags: ['coins'], summary: 'Coin balance, recent movements, shop items, coin packs and earning rules', response: { 200: coinsResponse, 401: apiErrorSchema } } }, async (req) => {
    const { userId } = requireUser(req, { allowSuspended: true });
    const shut = await storeClosed();
    const packs = shut ? [] : await db.select().from(coinPacks).where(eq(coinPacks.active, true)).orderBy(coinPacks.coins);
    return {
      balance: await coinBalance(db, userId),
      history: (await coinHistory(db, userId)).map((h) => ({ amount: h.amount, ruleId: h.ruleId, reason: h.reason, createdAt: h.createdAt.toISOString() })),
      shop: shut ? [] : COIN_SHOP.map((i) => ({ ...i })),
      packs: packs.map((p) => {
        const reason = !billing.gateway ? billing.unavailableReasonFa : !p.priceAmount ? 'قیمت این بسته هنوز تعیین نشده است.' : null;
        return { id: p.id, key: p.key, titleFa: p.titleFa, coins: p.coins, priceAmount: p.priceAmount, currency: p.currency, purchasable: !reason, unavailableReasonFa: reason };
      }),
      checkout: { available: !!billing.gateway, reasonFa: billing.unavailableReasonFa, fixture: !!billing.gateway?.isFixture },
      earn: EARN
    };
  });

  r.post('/coins/spend', {
    schema: { tags: ['coins'], summary: 'Spend coins on a shop item; the same requestId never spends twice',
      body: z.strictObject({ item: z.enum(SHOP_KEYS), requestId: z.uuid() }),
      response: { 200: z.object({ balance: z.number().int(), premiumUntil: z.iso.datetime().nullable() }), ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    await closed();
    const out = await spendCoins(db, userId, req.body.item, req.body.requestId);
    return { balance: out.balance, premiumUntil: out.premiumUntil?.toISOString() ?? null };
  });

  r.post('/coins/checkout', {
    schema: { tags: ['coins'], summary: 'Start a payment for a coin pack; coins are credited only after server verification',
      body: z.strictObject({ packId: z.uuid() }), response: { 200: z.object({ orderId: z.string(), redirectUrl: z.url() }), ...errors } }
  }, async (req) => { await closed(); return checkout(db, billing, requireUser(req).userId, { coinPackId: req.body.packId }); });

  // ---------- Development-only fake gateway decision (the labelled "bank page" calls this) ----------
  r.post('/payments/fake/:authority/decision', {
    schema: { tags: ['billing'], summary: 'DEV ONLY: choose the fake gateway outcome for my own payment', params: z.object({ authority: z.string().max(128) }),
      body: z.strictObject({ decision: z.enum(['paid', 'failed', 'delayed', 'wrong_amount']) }), response: { 200: z.object({ callbackUrl: z.url() }), ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    if (!billing.gateway?.isFixture) throw new AppError('NOT_FOUND');
    const [p] = await db.select().from(payments).where(and(eq(payments.provider, 'fake'), eq(payments.authority, req.params.authority), eq(payments.userId, userId)));
    if (!p) throw new AppError('NOT_FOUND');
    await db.update(fakeGatewayTransactions).set({ decision: req.body.decision === 'delayed' ? 'pending' : req.body.decision, refId: `FAKE-REF-${p.orderId}` })
      .where(eq(fakeGatewayTransactions.authority, req.params.authority));
    return { callbackUrl: `${billing.callbackUrl}?provider=fake&authority=${encodeURIComponent(req.params.authority)}` };
  });

  // ---------- Admin ----------
  r.get('/admin/plans', { schema: { tags: ['admin'], summary: 'Plans (admin)', response: { 200: z.object({ items: z.array(z.object({ id: z.uuid(), key: z.string(), titleFa: z.string(),
    priceAmount: z.number().nullable(), active: z.boolean(), durationDays: z.number().int(), termsFa: z.string() })) }), ...errors } } }, async (req) => {
    requireRole(req, 'admin');
    return { items: (await db.select().from(plans)).map((p) => ({ id: p.id, key: p.key, titleFa: p.titleFa, priceAmount: p.priceAmount, active: p.active, durationDays: p.durationDays, termsFa: p.termsFa })) };
  });

  r.patch('/admin/plans/:id', {
    schema: { tags: ['admin'], summary: 'Set price/terms/availability (product decision; audited)', params: z.object({ id: z.uuid() }),
      body: z.strictObject({ priceAmount: z.number().int().positive().nullable().optional(), active: z.boolean().optional(), termsFa: z.string().trim().min(10).max(2000).optional(), reason: z.string().trim().min(3).max(300) }),
      response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const { reason, ...change } = req.body;
    const [before] = await db.select().from(plans).where(eq(plans.id, req.params.id));
    if (!before) throw new AppError('NOT_FOUND');
    await db.update(plans).set(change).where(eq(plans.id, before.id));
    await db.insert(auditLog).values({ actorId: userId, action: 'plan.update', targetType: 'plan', targetId: before.id,
      metadata: { before: { priceAmount: before.priceAmount, active: before.active }, change, reason }, requestId: req.id });
    return reply.code(204).send(null);
  });

  r.get('/admin/coin-packs', { schema: { tags: ['admin'], summary: 'Coin packs (admin)', response: { 200: z.object({ items: z.array(z.object({ id: z.uuid(), key: z.string(), titleFa: z.string(),
    coins: z.number().int(), priceAmount: z.number().nullable(), active: z.boolean() })) }), ...errors } } }, async (req) => {
    requireRole(req, 'admin');
    return { items: (await db.select().from(coinPacks).orderBy(coinPacks.coins)).map((p) => ({ id: p.id, key: p.key, titleFa: p.titleFa, coins: p.coins, priceAmount: p.priceAmount, active: p.active })) };
  });

  r.patch('/admin/coin-packs/:id', {
    schema: { tags: ['admin'], summary: 'Set coin pack price/availability (product decision; audited)', params: z.object({ id: z.uuid() }),
      body: z.strictObject({ priceAmount: z.number().int().positive().nullable().optional(), active: z.boolean().optional(), reason: z.string().trim().min(3).max(300) }),
      response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const { reason, ...change } = req.body;
    const [before] = await db.select().from(coinPacks).where(eq(coinPacks.id, req.params.id));
    if (!before) throw new AppError('NOT_FOUND');
    await db.update(coinPacks).set(change).where(eq(coinPacks.id, before.id));
    await db.insert(auditLog).values({ actorId: userId, action: 'coin_pack.update', targetType: 'coin_pack', targetId: before.id,
      metadata: { before: { priceAmount: before.priceAmount, active: before.active }, change, reason }, requestId: req.id });
    return reply.code(204).send(null);
  });

  r.get('/admin/welcome-premium', {
    schema: { tags: ['admin'], summary: 'Launch promo: free premium days on login (store closed while enabled)',
      response: { 200: z.object({ enabled: z.boolean(), days: z.number().int() }), ...errors } }
  }, async (req) => { requireRole(req, 'admin'); return welcomePremium(db); });

  r.put('/admin/welcome-premium', {
    schema: { tags: ['admin'], summary: 'Turn the launch promo on/off and set its days (new grants only), audited',
      body: z.strictObject({ enabled: z.boolean(), days: z.number().int().min(1).max(365) }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const before = await welcomePremium(db);
    await setWelcomePremium(db, req.body, userId);
    await db.insert(auditLog).values({ actorId: userId, action: 'welcome_premium.update', targetType: 'setting', targetId: 'welcome_premium', metadata: { before, after: req.body }, requestId: req.id });
    return reply.code(204).send(null);
  });

  r.post('/admin/entitlements', {
    schema: { tags: ['admin'], summary: 'Grant premium manually (support/recovery), audited', body: z.strictObject({ userId: z.uuid(), days: z.number().int().min(1).max(400), reason: z.string().trim().min(5).max(300) }),
      response: { 201: z.object({ id: z.uuid() }), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const id = await db.transaction(async (tx) => {
      const id = await grantManualPremium(tx, { ...req.body, adminId: userId });
      await tx.insert(auditLog).values({ actorId: userId, action: 'entitlement.grant', targetType: 'user', targetId: req.body.userId, metadata: req.body, requestId: req.id });
      return id;
    });
    return reply.code(201).send({ id });
  });

  r.delete('/admin/entitlements/:id', {
    schema: { tags: ['admin'], summary: 'Revoke an entitlement (running games are unaffected), audited', params: z.object({ id: z.uuid() }), body: z.strictObject({ reason: z.string().trim().min(5).max(300) }),
      response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const rows = await db.update(entitlements).set({ revokedAt: sql`now()` }).where(eq(entitlements.id, req.params.id)).returning();
    if (!rows.length) throw new AppError('NOT_FOUND');
    await db.insert(auditLog).values({ actorId: userId, action: 'entitlement.revoke', targetType: 'user', targetId: rows[0]!.userId, metadata: { entitlementId: req.params.id, reason: req.body.reason }, requestId: req.id });
    return reply.code(204).send(null);
  });

  r.get('/admin/payments', {
    schema: { tags: ['admin'], summary: 'Recent payments for support and reconciliation', querystring: z.object({ status: z.enum(['pending', 'verified', 'failed', 'expired']).optional() }),
      response: { 200: z.object({ items: z.array(z.object({ orderId: z.string(), userId: z.uuid(), amount: z.number(), status: z.string(), provider: z.string(), failureReason: z.string().nullable(), createdAt: z.iso.datetime() })) }), ...errors } }
  }, async (req) => {
    requireRole(req, 'admin');
    const rows = await db.select().from(payments).where(req.query.status ? eq(payments.status, req.query.status) : undefined).orderBy(desc(payments.createdAt)).limit(100);
    return { items: rows.map((p) => ({ orderId: p.orderId, userId: p.userId, amount: p.amount, status: p.status, provider: p.provider, failureReason: p.failureReason, createdAt: p.createdAt.toISOString() })) };
  });

  r.get('/admin/subscriptions', {
    schema: { tags: ['admin'], summary: 'Subscriptions and manual entitlements, newest first (optionally one user) for support',
      querystring: z.object({ userId: z.uuid().optional() }),
      response: { 200: z.object({ items: z.array(z.object({ kind: z.enum(['subscription', 'manual']), id: z.uuid(), userId: z.uuid(), planTitleFa: z.string().nullable(), status: z.string(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime().nullable() })) }), ...errors } }
  }, async (req) => {
    requireRole(req, 'admin');
    const who = req.query.userId;
    const subs = await db.select({ s: subscriptions, title: plans.titleFa }).from(subscriptions).innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(who ? eq(subscriptions.userId, who) : undefined).orderBy(desc(subscriptions.createdAt)).limit(100);
    const manual = await db.select().from(entitlements).where(and(eq(entitlements.source, 'manual'), who ? eq(entitlements.userId, who) : undefined))
      .orderBy(desc(entitlements.createdAt)).limit(100);
    return { items: [
      ...subs.map(({ s, title }) => ({ kind: 'subscription' as const, id: s.id, userId: s.userId, planTitleFa: title, status: s.status, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() })),
      ...manual.map((e) => ({ kind: 'manual' as const, id: e.id, userId: e.userId, planTitleFa: null, status: e.revokedAt ? 'revoked' : 'active', startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null }))
    ].sort((a, b) => b.startsAt.localeCompare(a.startsAt)) };
  });

  r.patch('/admin/games/:id/access', {
    schema: { tags: ['admin'], summary: 'Per-game access: free or premium, and whether a premium host can invite free players (audited)', params: z.object({ id: z.string().max(64) }),
      body: z.strictObject({ access: z.enum(['free', 'premium']), premiumHostInvitesFree: z.boolean(), reason: z.string().trim().min(3).max(300) }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const rows = await db.update(games).set({ access: req.body.access, premiumHostInvitesFree: req.body.premiumHostInvitesFree, updatedAt: sql`now()` }).where(eq(games.id, req.params.id)).returning();
    if (!rows.length) throw new AppError('NOT_FOUND');
    await db.insert(auditLog).values({ actorId: userId, action: 'game.access', targetType: 'game', targetId: req.params.id, metadata: req.body, requestId: req.id });
    return reply.code(204).send(null);
  });
}
