// Cosmetics ownership: free items, items bought with coins (user_cosmetics), and items earned through level,
// achievements or a league placement (checked live, so they unlock the moment the progress exists).
import { and, eq } from 'drizzle-orm';
import { AppError, COSMETICS, cosmetic, leagueSchema, type CosmeticItem } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { coinBalance, lockCoins } from './coins.ts';
import { levelFor, totalXp } from './progression.ts';
import type { Tx } from './runtime.ts';

const { coinLedger, userCosmetics, userAchievements, achievementDefinitions, leaguePlacements } = schema;
const LEAGUES = leagueSchema.options;

export interface Progress { level: number; achievements: Set<string>; bestLeague: number; owned: Set<string> }

export async function cosmeticProgress(db: Db | Tx, userId: string): Promise<Progress> {
  const [owned, ach, leagues] = await Promise.all([
    db.select({ k: userCosmetics.itemKey }).from(userCosmetics).where(eq(userCosmetics.userId, userId)),
    db.select({ k: achievementDefinitions.key }).from(userAchievements)
      .innerJoin(achievementDefinitions, eq(achievementDefinitions.id, userAchievements.achievementId)).where(eq(userAchievements.userId, userId)),
    db.select({ l: leaguePlacements.league }).from(leaguePlacements).where(eq(leaguePlacements.userId, userId))
  ]);
  return {
    level: levelFor(await totalXp(db, userId)).level,
    achievements: new Set(ach.map((a) => a.k)),
    bestLeague: Math.max(-1, ...leagues.map((l) => LEAGUES.indexOf(l.l as never))),
    owned: new Set(owned.map((o) => o.k))
  };
}

export function isUnlocked(item: CosmeticItem, p: Progress): boolean {
  const u = item.unlock;
  if ('free' in u) return true;
  if ('coins' in u) return p.owned.has(item.key);
  if ('level' in u) return p.level >= u.level;
  if ('achievement' in u) return p.achievements.has(u.achievement);
  return p.bestLeague >= LEAGUES.indexOf(u.league);
}

/** Throws COSMETIC_LOCKED unless every key is a catalogue item this player has unlocked. */
export async function assertUnlocked(db: Db | Tx, userId: string, keys: string[]): Promise<void> {
  if (!keys.length) return;
  const p = await cosmeticProgress(db, userId);
  for (const k of keys) {
    const item = cosmetic(k);
    if (!item || !isUnlocked(item, p)) throw new AppError('COSMETIC_LOCKED');
  }
}

export async function cosmeticsFor(db: Db, userId: string) {
  const p = await cosmeticProgress(db, userId);
  return { level: p.level, unlocked: COSMETICS.filter((c) => isUnlocked(c, p)).map((c) => c.key) };
}

/** Buy a coin item, exactly once per (user, requestId); shares the coin lock so it cannot race a premium spend. */
export async function buyCosmetic(db: Db, userId: string, key: string, requestId: string): Promise<{ balance: number }> {
  const item = cosmetic(key);
  if (!item) throw new AppError('NOT_FOUND');
  if (!('coins' in item.unlock)) throw new AppError('NOT_FOR_SALE');
  const cost = item.unlock.coins;
  return db.transaction(async (tx) => {
    await lockCoins(tx, userId);
    const sourceKey = `cosmetic:${userId}:${requestId}`;
    const [done] = await tx.select({ id: coinLedger.id }).from(coinLedger).where(eq(coinLedger.sourceKey, sourceKey));
    if (!done) {
      const [own] = await tx.select().from(userCosmetics).where(and(eq(userCosmetics.userId, userId), eq(userCosmetics.itemKey, key)));
      if (own) throw new AppError('ALREADY_OWNED');
      if ((await coinBalance(tx, userId)) < cost) throw new AppError('INSUFFICIENT_COINS');
      const [row] = await tx.insert(coinLedger).values({ userId, amount: -cost, ruleId: `cosmetic.${key}`, reason: `خرید «${item.nameFa}».`, sourceKey,
        metadata: { item: key } }).returning({ id: coinLedger.id });
      await tx.insert(userCosmetics).values({ userId, itemKey: key, ledgerId: row!.id });
    }
    return { balance: await coinBalance(tx, userId) };
  });
}
