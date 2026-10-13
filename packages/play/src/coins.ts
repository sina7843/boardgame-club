// Coins: a soft currency. Earned only from server reward rows (never a client claim), bought only through a verified
// payment (billing.ts), spent only on server-defined shop items. Balance = sum of the append-only coin_ledger.
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { AppError, trophyTier, type TrophyTier } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { Tx } from './runtime.ts';

const { coinLedger, rewardLedger, achievementDefinitions, entitlements } = schema;

/** Earning rules. Values are read when a reward row is first converted; changing them never rewrites old rows. */
export const COIN_RULES = {
  /** Match XP (completion, first place, bot tables) pays XP ÷ this, so the daily XP cap and repeated-opponent cut apply to coins too. */
  matchXpDivisor: 4,
  newTitle: 5,
  tutorial: 10,
  dailyGame: 15,
  mission: 20,
  achievement: { bronze: 10, silver: 20, gold: 40, turquoise: 75, diamond: 150 } satisfies Record<TrophyTier, number>,
  /** Reaching level n pays n × this. */
  levelUp: 10
} as const;

/** Shop: what coins buy. Premium days chain after any premium the player already has. */
export const COIN_SHOP = [
  { key: 'premium-1d', titleFa: 'یک روز پریمیوم', descriptionFa: 'بیست‌وچهار ساعت دسترسی پریمیوم؛ از پایان پریمیوم فعلی شما شروع می‌شود.', cost: 200, premiumDays: 1 },
  { key: 'premium-7d', titleFa: 'هفت روز پریمیوم', descriptionFa: 'یک هفته دسترسی پریمیوم با تخفیف؛ از پایان پریمیوم فعلی شما شروع می‌شود.', cost: 1000, premiumDays: 7 }
] as const;
export type CoinShopKey = typeof COIN_SHOP[number]['key'];

const MATCH_RULES = new Set(['xp.match_completed', 'xp.first_place', 'xp.bot_match', 'xp.bot_win']);
const FIXED: Record<string, number> = { 'xp.new_title': COIN_RULES.newTitle, 'xp.tutorial': COIN_RULES.tutorial, 'xp.daily_game': COIN_RULES.dailyGame };

/** Coins for one reward row; 0 = this row pays no coins (manual, cosmetic, capped match). */
export function coinsForReward(r: { ruleId: string; kind: string; amount: number }, tierOf: (achievementKey: string) => TrophyTier): number {
  if (MATCH_RULES.has(r.ruleId)) return Math.round(r.amount / COIN_RULES.matchXpDivisor);
  if (r.kind === 'mission') return COIN_RULES.mission;
  if (r.kind === 'achievement') return COIN_RULES.achievement[tierOf(r.ruleId.replace(/^achievement\./, ''))];
  return FIXED[r.ruleId] ?? 0;
}

const lockCoins = (tx: Tx, userId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'coins:' + userId}))`);

/**
 * Convert reward rows that have no coin row yet, and pay level-ups up to `level`. Idempotent (unique source keys), so
 * it runs after every progression pass and also back-fills players who earned rewards before coins existed.
 */
export async function syncCoins(tx: Tx, userId: string, level: number): Promise<void> {
  const rows = await tx.select({ id: rewardLedger.id, ruleId: rewardLedger.ruleId, kind: rewardLedger.kind, amount: rewardLedger.amount,
    reason: rewardLedger.reason, resultId: rewardLedger.resultId }).from(rewardLedger)
    .where(and(eq(rewardLedger.userId, userId), sql`not exists (select 1 from coin_ledger c where c.source_key = 'reward:' || ${rewardLedger.id})`));
  let tiers: Map<string, TrophyTier> | undefined;
  if (rows.some((r) => r.kind === 'achievement')) {
    const defs = await tx.select({ key: achievementDefinitions.key, criteria: achievementDefinitions.criteria }).from(achievementDefinitions);
    tiers = new Map(defs.map((d) => [d.key, trophyTier.catch('bronze').parse((d.criteria as { tier?: string }).tier)]));
  }
  const values: (typeof coinLedger.$inferInsert)[] = rows.map((r) => ({ userId, amount: coinsForReward(r, (k) => tiers?.get(k) ?? 'bronze'), ruleId: r.ruleId, reason: r.reason,
    sourceKey: `reward:${r.id}`, resultId: r.resultId, metadata: { rewardId: r.id } })).filter((v) => v.amount > 0);
  for (let n = 2; n <= level; n++) {
    values.push({ userId, amount: n * COIN_RULES.levelUp, ruleId: 'level', reason: `رسیدن به سطح ${n.toLocaleString('fa-IR')}.`,
      sourceKey: `level:${n}:${userId}`, resultId: null, metadata: { level: n } });
  }
  if (values.length) await tx.insert(coinLedger).values(values).onConflictDoNothing({ target: coinLedger.sourceKey });
}

export async function coinBalance(db: Db | Tx, userId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`coalesce(sum(${coinLedger.amount}), 0)::int` }).from(coinLedger).where(eq(coinLedger.userId, userId));
  return r?.n ?? 0;
}

export const coinHistory = (db: Db, userId: string, limit = 40) =>
  db.select().from(coinLedger).where(eq(coinLedger.userId, userId)).orderBy(desc(coinLedger.createdAt)).limit(limit);

/**
 * Spend coins on a shop item, exactly once per (user, requestId): a retried request returns the first outcome.
 * Premium days start where the player's latest premium (any source, including passes not started yet) ends.
 */
export async function spendCoins(db: Db, userId: string, itemKey: CoinShopKey, requestId: string) {
  const item = COIN_SHOP.find((i) => i.key === itemKey);
  if (!item) throw new AppError('NOT_FOUND');
  return db.transaction(async (tx) => {
    await lockCoins(tx, userId);
    const sourceKey = `spend:${userId}:${requestId}`;
    const [done] = await tx.select({ id: coinLedger.id }).from(coinLedger).where(eq(coinLedger.sourceKey, sourceKey));
    const live = and(eq(entitlements.userId, userId), eq(entitlements.key, 'premium'), isNull(entitlements.revokedAt));
    /** End of the latest premium period, including periods that have not started yet. */
    const latestEnd = async () => {
      const [r] = await tx.select({ end: sql<string | null>`max(${entitlements.endsAt})` }).from(entitlements).where(and(live, gt(entitlements.endsAt, sql`now()`)));
      return r?.end ? new Date(r.end) : null;
    };
    if (!done) {
      const [unlimited] = await tx.select({ id: entitlements.id }).from(entitlements).where(and(live, isNull(entitlements.endsAt), sql`${entitlements.startsAt} <= now()`)).limit(1);
      if (unlimited) throw new AppError('PREMIUM_UNLIMITED');
      if ((await coinBalance(tx, userId)) < item.cost) throw new AppError('INSUFFICIENT_COINS');
      const start = (await latestEnd()) ?? new Date();
      const [row] = await tx.insert(coinLedger).values({ userId, amount: -item.cost, ruleId: `shop.${item.key}`, reason: `خرید «${item.titleFa}».`, sourceKey,
        metadata: { item: item.key } }).returning({ id: coinLedger.id });
      await tx.insert(entitlements).values({ userId, key: 'premium', source: 'coins', sourceId: row!.id, startsAt: start,
        endsAt: new Date(start.getTime() + item.premiumDays * 86400_000), reason: item.titleFa });
    }
    return { balance: await coinBalance(tx, userId), premiumUntil: await latestEnd() };
  });
}
