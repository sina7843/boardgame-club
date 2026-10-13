// Friend referral: each user gets an invite code/link; a new account that signs up through it becomes the inviter's
// friend automatically, and both sides get the admin-configured reward (coins and/or premium days).
import { randomInt } from 'node:crypto';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { apiErrorSchema, publicProfile } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { premiumUntil } from '@bg/play';
import type { Deps } from '../../app.ts';
import { requireRole, requireUser } from '../auth/session.ts';
import { pair, profiles } from '../social/relations.ts';

const { appSettings, auditLog, coinLedger, entitlements, friendships, referrals, users } = schema;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema };

export const REFERRAL_PREMIUM_REASON = 'جایزهٔ دعوت دوست';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const referralCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6,12}$/);

const settingsSchema = z.strictObject({
  enabled: z.boolean(),
  inviterCoins: z.number().int().min(0).max(100_000),
  inviterDays: z.number().int().min(0).max(365),
  inviteeCoins: z.number().int().min(0).max(100_000),
  inviteeDays: z.number().int().min(0).max(365),
  /** Rewarded invites per inviter (0 = no limit); further invites still make friends but pay nothing. */
  maxRewardedPerInviter: z.number().int().min(0).max(10_000)
});
export type ReferralSettings = z.infer<typeof settingsSchema>;
const DEFAULTS: ReferralSettings = { enabled: false, inviterCoins: 0, inviterDays: 0, inviteeCoins: 0, inviteeDays: 0, maxRewardedPerInviter: 0 };
const rewardsSchema = z.object({ coins: z.number(), days: z.number() });
type Reward = z.infer<typeof rewardsSchema>;

export async function referralSettings(db: Db | Tx): Promise<ReferralSettings> {
  const [r] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, 'referral'));
  return { ...DEFAULTS, ...(r?.value as Partial<ReferralSettings> | undefined) };
}

/** The user's invite code, issued on first request (retries on the unlikely unique clash). */
async function codeFor(db: Db, userId: string): Promise<string> {
  const [u] = await db.select({ code: users.referralCode }).from(users).where(eq(users.id, userId));
  if (u?.code) return u.code;
  for (;;) {
    const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    const rows = await db.update(users).set({ referralCode: code }).where(and(eq(users.id, userId), sql`${users.referralCode} is null`))
      .returning({ code: users.referralCode }).catch((e: { code?: string; cause?: { code?: string } }) => {
        if ((e.code ?? e.cause?.code) === '23505') return null; // code taken: try another
        throw e;
      });
    if (rows === null) continue;
    if (rows.length) return rows[0]!.code!;
    return (await codeFor(db, userId)); // a concurrent request issued one first
  }
}

async function grant(tx: Tx, userId: string, referredId: string, side: 'inviter' | 'invitee', coins: number, days: number): Promise<Reward> {
  if (coins > 0) {
    await tx.insert(coinLedger).values({ userId, amount: coins, ruleId: `referral.${side}`, reason: side === 'inviter' ? 'دعوت دوست' : 'عضویت با دعوت دوست',
      sourceKey: `referral:${referredId}:${side}`, metadata: { referredId } }).onConflictDoNothing({ target: coinLedger.sourceKey });
  }
  if (days > 0) {
    // Extend past any premium the user already has, so the gift is never swallowed by an overlapping period.
    const until = await premiumUntil(tx, userId);
    if (until !== null) {
      const from = Math.max(until?.getTime() ?? 0, Date.now());
      await tx.insert(entitlements).values({ userId, key: 'premium', source: 'manual', startsAt: new Date(), endsAt: new Date(from + days * 86400_000),
        reason: REFERRAL_PREMIUM_REASON });
    }
  }
  return { coins, days };
}

/**
 * Called once for a brand-new account. Unknown/inactive codes are ignored (sign-up never fails on a bad link).
 * The referrals primary key (one row per invited user) makes the whole thing idempotent.
 */
export async function applyReferral(db: Db, referredId: string, rawCode: string): Promise<void> {
  const parsed = referralCodeSchema.safeParse(rawCode);
  if (!parsed.success) return;
  const [inviter] = await db.select({ id: users.id }).from(users).where(and(eq(users.referralCode, parsed.data), eq(users.status, 'active')));
  if (!inviter || inviter.id === referredId) return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'referral:' + inviter.id}))`);
    const inserted = await tx.insert(referrals).values({ referredId, referrerId: inviter.id }).onConflictDoNothing().returning({ id: referrals.referredId });
    if (!inserted.length) return;
    const [low, high] = pair(inviter.id, referredId);
    await tx.insert(friendships).values({ userLow: low, userHigh: high, requestedBy: inviter.id, status: 'accepted', respondedAt: new Date() })
      .onConflictDoUpdate({ target: [friendships.userLow, friendships.userHigh], set: { status: 'accepted', respondedAt: new Date() } });

    const s = await referralSettings(tx);
    if (!s.enabled) return;
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(referrals)
      .where(and(eq(referrals.referrerId, inviter.id), sql`(${referrals.rewards} -> 'inviter') is not null`));
    const inviterPaid = s.maxRewardedPerInviter === 0 || n < s.maxRewardedPerInviter;
    const rewards = {
      invitee: await grant(tx, referredId, referredId, 'invitee', s.inviteeCoins, s.inviteeDays),
      ...(inviterPaid ? { inviter: await grant(tx, inviter.id, referredId, 'inviter', s.inviterCoins, s.inviterDays) } : {})
    };
    await tx.update(referrals).set({ rewards }).where(eq(referrals.referredId, referredId));
  });
}

const inviteItem = z.object({ user: publicProfile, createdAt: z.iso.datetime(), reward: rewardsSchema.nullable() });

export function referralRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/me/referral', {
    schema: { tags: ['social'], summary: 'My invite code, the current reward and the people who joined through my link',
      response: { 200: z.object({ code: z.string(), reward: z.object({ inviterCoins: z.number(), inviterDays: z.number(), inviteeCoins: z.number(), inviteeDays: z.number() }).nullable(),
        invited: z.array(inviteItem) }), ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const [code, s, rows] = await Promise.all([codeFor(db, userId), referralSettings(db),
      db.select().from(referrals).where(eq(referrals.referrerId, userId)).orderBy(desc(referrals.createdAt)).limit(200)]);
    const people = await profiles(db, rows.map((x) => x.referredId));
    return {
      code,
      reward: s.enabled ? { inviterCoins: s.inviterCoins, inviterDays: s.inviterDays, inviteeCoins: s.inviteeCoins, inviteeDays: s.inviteeDays } : null,
      invited: rows.flatMap((x) => {
        const user = people.get(x.referredId);
        return user ? [{ user, createdAt: x.createdAt.toISOString(), reward: (x.rewards as { inviter?: Reward }).inviter ?? null }] : [];
      })
    };
  });

  r.get('/admin/referral', {
    schema: { tags: ['admin'], summary: 'Referral reward settings', response: { 200: settingsSchema, ...errors } }
  }, async (req) => { requireRole(req, 'admin'); return referralSettings(db); });

  r.put('/admin/referral', {
    schema: { tags: ['admin'], summary: 'Set referral rewards (applies to new sign-ups only), audited', body: settingsSchema, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const before = await referralSettings(db);
    await db.insert(appSettings).values({ key: 'referral', value: req.body, updatedBy: userId })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: req.body, updatedBy: userId, updatedAt: sql`now()` } });
    await db.insert(auditLog).values({ actorId: userId, action: 'referral.update', targetType: 'setting', targetId: 'referral', metadata: { before, after: req.body }, requestId: req.id });
    return reply.code(204).send(null);
  });

  r.get('/admin/referrals', {
    schema: { tags: ['admin'], summary: 'Referral report: top inviters and recent sign-ups through invite links',
      querystring: z.object({ referrerId: z.uuid().optional() }),
      response: { 200: z.object({
        total: z.number(),
        top: z.array(z.object({ user: publicProfile, count: z.number() })),
        items: z.array(z.object({ referrer: publicProfile, referred: publicProfile, createdAt: z.iso.datetime(),
          rewards: z.object({ inviter: rewardsSchema.optional(), invitee: rewardsSchema.optional() }) }))
      }), ...errors } }
  }, async (req) => {
    requireRole(req, 'admin');
    const who = req.query.referrerId;
    const [[{ total } = { total: 0 }], top, rows] = await Promise.all([
      db.select({ total: count() }).from(referrals),
      db.select({ id: referrals.referrerId, n: count() }).from(referrals).groupBy(referrals.referrerId).orderBy(desc(count())).limit(20),
      db.select().from(referrals).where(who ? eq(referrals.referrerId, who) : undefined).orderBy(desc(referrals.createdAt)).limit(300)
    ]);
    const people = await profiles(db, [...top.map((t) => t.id), ...rows.flatMap((x) => [x.referrerId, x.referredId])]);
    return {
      total,
      top: top.flatMap((t) => (people.has(t.id) ? [{ user: people.get(t.id)!, count: t.n }] : [])),
      items: rows.flatMap((x) => {
        const referrer = people.get(x.referrerId), referred = people.get(x.referredId);
        return referrer && referred ? [{ referrer, referred, createdAt: x.createdAt.toISOString(), rewards: x.rewards as { inviter?: Reward; invitee?: Reward } }] : [];
      })
    };
  });
}
