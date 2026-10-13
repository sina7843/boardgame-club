// Subscriptions, entitlements and payments (FR-15). Activation happens ONLY after the server verifies the payment
// with the gateway and the verified amount matches the order. Callbacks are only a trigger to verify.
import { randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { AppError } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { Tx } from './runtime.ts';
import { registerPaidEntry } from './tournaments.ts';

const { appSettings, plans, coinPacks, tournaments, coinLedger, payments, paymentEvents, subscriptions, entitlements, auditLog, fakeGatewayTransactions } = schema;

export type VerifyResult = { status: 'paid'; refId: string; paidAmount: number } | { status: 'failed'; reason: string } | { status: 'pending' };

/** Boundary for an Iranian payment gateway. A real adapter must verify server-to-server with the provider. */
export interface PaymentGateway {
  readonly id: string;
  readonly isFixture: boolean;
  create(input: { orderId: string; amount: number; currency: string; callbackUrl: string; description: string }): Promise<{ authority: string; redirectUrl: string }>;
  verify(input: { authority: string; amount: number }): Promise<VerifyResult>;
}

/**
 * DEVELOPMENT-ONLY fake gateway. Moves no money; the "bank page" is a labelled page inside the web app that lets a
 * developer choose an outcome. The API refuses to start with it in production.
 */
export function fakeGateway(db: Db, webOrigin: string): PaymentGateway {
  return {
    id: 'fake',
    isFixture: true,
    async create({ amount }) {
      const authority = `FAKE-${randomBytes(9).toString('base64url')}`;
      await db.insert(fakeGatewayTransactions).values({ authority, amount });
      return { authority, redirectUrl: `${webOrigin}/dev-gateway?authority=${encodeURIComponent(authority)}` };
    },
    async verify({ authority }) {
      const [t] = await db.select().from(fakeGatewayTransactions).where(eq(fakeGatewayTransactions.authority, authority));
      if (!t) return { status: 'failed', reason: 'UNKNOWN_AUTHORITY' };
      if (t.decision === 'paid') return { status: 'paid', refId: t.refId ?? `REF-${authority}`, paidAmount: t.paidAmount ?? t.amount };
      if (t.decision === 'wrong_amount') return { status: 'paid', refId: t.refId ?? `REF-${authority}`, paidAmount: (t.paidAmount ?? t.amount) - 1000 };
      if (t.decision === 'failed') return { status: 'failed', reason: 'DECLINED_BY_PAYER' };
      return { status: 'pending' };
    }
  };
}

export interface BillingConfig {
  gateway: PaymentGateway | null;
  /** Human-readable reason checkout is unavailable (production without provider/credentials/prices). */
  unavailableReasonFa: string | null;
  callbackUrl: string;
  paymentTtlMinutes: number;
}

// ---------------- Entitlements ----------------

export async function premiumUntil(db: Db | Tx, userId: string): Promise<Date | null | undefined> {
  const [e] = await db.select({ endsAt: entitlements.endsAt }).from(entitlements)
    .where(and(eq(entitlements.userId, userId), eq(entitlements.key, 'premium'), isNull(entitlements.revokedAt),
      sql`${entitlements.startsAt} <= now()`, or(isNull(entitlements.endsAt), gt(entitlements.endsAt, sql`now()`))))
    .orderBy(sql`${entitlements.endsAt} desc nulls first`).limit(1);
  return e ? e.endsAt : undefined;
}
export const isPremium = async (db: Db | Tx, userId: string) => (await premiumUntil(db, userId)) !== undefined;

// ---------------- Checkout ----------------

/** Start a payment for one product: a subscription plan, a coin pack or a Toman tournament entry. */
export async function checkout(db: Db, cfg: BillingConfig, userId: string, product: { planId: string } | { coinPackId: string } | { tournamentId: string }) {
  if (!cfg.gateway) throw new AppError('PAYMENT_UNAVAILABLE');
  const [plan] = 'planId' in product ? await db.select().from(plans).where(eq(plans.id, product.planId))
    : 'coinPackId' in product ? await db.select().from(coinPacks).where(eq(coinPacks.id, product.coinPackId))
      : await db.select({ id: tournaments.id, titleFa: tournaments.titleFa, priceAmount: tournaments.entryAmount, currency: sql<string>`'IRR'`, active: sql<boolean>`${tournaments.status} = 'open'` })
        .from(tournaments).where(and(eq(tournaments.id, product.tournamentId), eq(tournaments.entryKind, 'toman')));
  if (!plan || !plan.active) throw new AppError('NOT_FOUND');
  if (!plan.priceAmount) throw new AppError('PAYMENT_UNAVAILABLE'); // price not approved yet
  const orderId = `BG-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(5).toString('hex').toUpperCase()}`;
  const [payment] = await db.insert(payments).values({
    userId, ...product, orderId, provider: cfg.gateway.id, amount: plan.priceAmount, currency: plan.currency, status: 'pending',
    expiresAt: sql`now() + make_interval(mins => ${cfg.paymentTtlMinutes})`
  }).returning();
  try {
    const { authority, redirectUrl } = await cfg.gateway.create({ orderId, amount: plan.priceAmount, currency: plan.currency,
      callbackUrl: `${cfg.callbackUrl}?provider=${cfg.gateway.id}&authority=`, description: plan.titleFa });
    await db.update(payments).set({ authority, updatedAt: sql`now()` }).where(eq(payments.id, payment!.id));
    await db.insert(paymentEvents).values({ paymentId: payment!.id, provider: cfg.gateway.id, authority, kind: 'create', outcome: 'ok', detail: { amount: plan.priceAmount } });
    return { orderId, redirectUrl };
  } catch (err) {
    await db.update(payments).set({ status: 'failed', failureReason: 'PROVIDER_ERROR', updatedAt: sql`now()` }).where(eq(payments.id, payment!.id));
    await db.insert(paymentEvents).values({ paymentId: payment!.id, provider: cfg.gateway.id, kind: 'create', outcome: 'error', detail: { message: (err as Error).message.slice(0, 200) } });
    throw new AppError('PAYMENT_PROVIDER_ERROR');
  }
}

export type VerifyOutcome = 'verified' | 'already_verified' | 'pending' | 'failed' | 'expired' | 'unknown';

/**
 * Verify one payment with the gateway and activate the subscription exactly once.
 * Idempotent: the payment row is locked; a verified payment is never processed again; a provider reference can be
 * used once (unique index). Amount and currency must match the order exactly.
 */
export async function verifyPayment(db: Db, cfg: BillingConfig, ref: { provider: string; authority: string; via: 'callback' | 'reconcile' | 'user'; payerCancelled?: boolean }): Promise<{ outcome: VerifyOutcome; orderId?: string }> {
  const gateway = cfg.gateway;
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(and(eq(payments.provider, ref.provider), eq(payments.authority, ref.authority))).for('update');
    const log = (outcome: string, detail: object = {}) => tx.insert(paymentEvents).values({ paymentId: p?.id ?? null, provider: ref.provider, authority: ref.authority, kind: ref.via, outcome, detail });
    if (!p || !gateway || gateway.id !== ref.provider) { await log('unknown'); return { outcome: 'unknown' as const }; }
    if (p.status === 'verified') { await log('duplicate'); return { outcome: 'already_verified' as const, orderId: p.orderId }; }
    if (p.status === 'failed' || p.status === 'expired') { await log('ignored_final', { status: p.status }); return { outcome: p.status, orderId: p.orderId }; }

    const fail = async (reason: string, detail: object = {}) => {
      await tx.update(payments).set({ status: 'failed', failureReason: reason, updatedAt: sql`now()` }).where(eq(payments.id, p.id));
      await log('failed', { reason, ...detail });
      return { outcome: 'failed' as const, orderId: p.orderId };
    };
    // The gateway told the buyer's browser the payment was cancelled (e.g. Zarinpal Status=NOK): nothing to verify.
    if (ref.payerCancelled) return fail('CANCELLED_BY_PAYER');

    const v = await gateway.verify({ authority: ref.authority, amount: p.amount });
    if (v.status === 'pending') {
      if (p.expiresAt.getTime() < Date.now()) {
        await tx.update(payments).set({ status: 'expired', failureReason: 'NOT_CONFIRMED_IN_TIME', updatedAt: sql`now()` }).where(eq(payments.id, p.id));
        await log('expired');
        return { outcome: 'expired' as const, orderId: p.orderId };
      }
      await log('pending');
      return { outcome: 'pending' as const, orderId: p.orderId };
    }
    if (v.status === 'failed') return fail(v.reason);
    if (v.paidAmount !== p.amount) return fail('AMOUNT_MISMATCH', { expected: p.amount, paid: v.paidAmount });
    const [dup] = await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.provider, p.provider), eq(payments.providerRef, v.refId)));
    if (dup) return fail('DUPLICATE_REFERENCE', { refId: v.refId });

    await tx.update(payments).set({ status: 'verified', providerRef: v.refId, verifiedAt: sql`now()`, updatedAt: sql`now()` }).where(eq(payments.id, p.id));
    if (p.planId) await activate(tx, p.userId, p.planId, p.id);
    else if (p.coinPackId) await creditCoinPack(tx, p.userId, p.coinPackId, p.id, p.orderId);
    else await registerPaidEntry(tx, { id: p.id, userId: p.userId, tournamentId: p.tournamentId! });
    await log('verified', { refId: v.refId });
    await tx.insert(auditLog).values({ actorId: p.userId, action: p.planId ? 'subscription.activate' : p.coinPackId ? 'coins.purchase' : 'tournament.entry', targetType: 'payment', targetId: p.id, metadata: { orderId: p.orderId, refId: v.refId, via: ref.via } });
    return { outcome: 'verified' as const, orderId: p.orderId };
  });
}

/** A verified coin-pack payment credits its coins once (the payment id is the source key). */
async function creditCoinPack(tx: Tx, userId: string, coinPackId: string, paymentId: string, orderId: string) {
  const [pack] = await tx.select().from(coinPacks).where(eq(coinPacks.id, coinPackId));
  await tx.insert(coinLedger).values({ userId, amount: pack!.coins, ruleId: 'purchase', reason: `خرید «${pack!.titleFa}».`, sourceKey: `payment:${paymentId}`,
    metadata: { orderId } }).onConflictDoNothing({ target: coinLedger.sourceKey });
}

/** New period starts at the end of any active subscription (renewal extends; never shortens). No auto-renewal. */
async function activate(tx: Tx, userId: string, planId: string, paymentId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'subscription:' + userId}))`);
  const [plan] = await tx.select().from(plans).where(eq(plans.id, planId));
  const [current] = await tx.select({ endsAt: subscriptions.endsAt }).from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active'), gt(subscriptions.endsAt, sql`now()`))).orderBy(desc(subscriptions.endsAt)).limit(1);
  const start = current ? current.endsAt : new Date();
  const end = new Date(start.getTime() + plan!.durationDays * 86400_000);
  const [sub] = await tx.insert(subscriptions).values({ userId, planId, paymentId, status: 'active', startsAt: start, endsAt: end }).returning();
  await tx.insert(entitlements).values({ userId, key: 'premium', source: 'subscription', sourceId: sub!.id, startsAt: start, endsAt: end });
}

/** Worker: re-verify payments whose callback never arrived (or arrived while the gateway was still pending). */
export async function reconcilePayments(db: Db, cfg: BillingConfig) {
  if (!cfg.gateway) return { checked: 0 };
  const pending = await db.select().from(payments).where(and(eq(payments.status, 'pending'), eq(payments.provider, cfg.gateway.id),
    sql`${payments.authority} is not null`, lt(payments.updatedAt, sql`now() - interval '60 seconds'`))).limit(50);
  for (const p of pending) await verifyPayment(db, cfg, { provider: p.provider, authority: p.authority!, via: 'reconcile' });
  return { checked: pending.length };
}

/** Worker: mark ended subscriptions expired. Running games are unaffected (eligibility is snapshotted at start). */
export async function expireSubscriptions(db: Db) {
  const rows = await db.update(subscriptions).set({ status: 'expired' })
    .where(and(eq(subscriptions.status, 'active'), lt(subscriptions.endsAt, sql`now()`))).returning({ id: subscriptions.id });
  return { expired: rows.length };
}

export const WELCOME_PREMIUM_REASON = 'هدیهٔ افتتاح سایت';

export interface WelcomePremium { enabled: boolean; days: number }

/** Launch promo setting (admin panel). Off when never set. */
export async function welcomePremium(db: Db | Tx): Promise<WelcomePremium> {
  const [r] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, 'welcome_premium'));
  return (r?.value as WelcomePremium | undefined) ?? { enabled: false, days: 30 };
}

export async function setWelcomePremium(db: Db | Tx, value: WelcomePremium, adminId: string) {
  await db.insert(appSettings).values({ key: 'welcome_premium', value, updatedBy: adminId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: adminId, updatedAt: sql`now()` } });
}

/**
 * Launch promo, while enabled: one free premium period per user, ever (a later login never re-grants it, even after
 * the admin changes the days). While enabled the store (plans, coin shop, coin packs) is closed.
 */
export async function grantWelcomePremium(db: Db, userId: string) {
  const { enabled, days } = await welcomePremium(db);
  if (!enabled || days <= 0) return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'welcome:' + userId}))`);
    const [had] = await tx.select({ id: entitlements.id }).from(entitlements)
      .where(and(eq(entitlements.userId, userId), eq(entitlements.source, 'manual'), eq(entitlements.reason, WELCOME_PREMIUM_REASON))).limit(1);
    if (!had) await tx.insert(entitlements).values({ userId, key: 'premium', source: 'manual', startsAt: new Date(), endsAt: new Date(Date.now() + days * 86400_000), reason: WELCOME_PREMIUM_REASON });
  });
}

export async function grantManualPremium(tx: Tx, p: { userId: string; days: number; reason: string; adminId: string }) {
  const id = randomUUID();
  await tx.insert(entitlements).values({ id, userId: p.userId, key: 'premium', source: 'manual', startsAt: new Date(), endsAt: new Date(Date.now() + p.days * 86400_000),
    reason: p.reason, createdBy: p.adminId });
  return id;
}
