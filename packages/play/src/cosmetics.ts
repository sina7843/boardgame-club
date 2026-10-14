// Cosmetics ownership: free items, items bought with coins (user_cosmetics), and items earned through level,
// achievements or a league placement (checked live, so they unlock the moment the progress exists).
import { and, eq, inArray, sql } from 'drizzle-orm';
import { AppError, bundlePrice, COSMETIC_BUNDLES, COSMETICS, cosmetic, kindOfKey, leagueSchema, type CosmeticItem, type EquippedCosmetics, type ItemKind } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { isPremium } from './billing.ts';
import { coinBalance, lockCoins } from './coins.ts';
import { levelFor, totalXp } from './progression.ts';
import type { Tx } from './runtime.ts';

const { users, coinLedger, userCosmetics, userAchievements, achievementDefinitions, leaguePlacements, notifications } = schema;
const LEAGUES = leagueSchema.options;

export interface Progress { level: number; achievements: Set<string>; bestLeague: number; owned: Set<string>; premium: boolean }

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
    owned: new Set(owned.map((o) => o.k)),
    premium: await isPremium(db, userId)
  };
}

export function isUnlocked(item: CosmeticItem, p: Progress): boolean {
  const u = item.unlock;
  if ('free' in u) return true;
  if ('coins' in u) return p.owned.has(item.key);
  if ('level' in u) return p.level >= u.level;
  if ('achievement' in u) return p.achievements.has(u.achievement);
  if ('premium' in u) return p.premium;
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

/** Buy a seasonal bundle: pays the discounted price of the items not owned yet; the same requestId never spends twice. */
export async function buyBundle(db: Db, userId: string, key: string, requestId: string): Promise<{ balance: number }> {
  const b = COSMETIC_BUNDLES.find((x) => x.key === key);
  if (!b) throw new AppError('NOT_FOUND');
  return db.transaction(async (tx) => {
    await lockCoins(tx, userId);
    const sourceKey = `bundle:${userId}:${requestId}`;
    const [done] = await tx.select({ id: coinLedger.id }).from(coinLedger).where(eq(coinLedger.sourceKey, sourceKey));
    if (!done) {
      const owned = new Set((await tx.select({ k: userCosmetics.itemKey }).from(userCosmetics).where(eq(userCosmetics.userId, userId))).map((r) => r.k));
      const cost = bundlePrice(b, owned);
      if (cost === 0) throw new AppError('ALREADY_OWNED');
      if ((await coinBalance(tx, userId)) < cost) throw new AppError('INSUFFICIENT_COINS');
      const [row] = await tx.insert(coinLedger).values({ userId, amount: -cost, ruleId: `bundle.${key}`, reason: `خرید «${b.nameFa}».`, sourceKey, metadata: { bundle: key } })
        .returning({ id: coinLedger.id });
      await tx.insert(userCosmetics).values(b.items.filter((k) => !owned.has(k)).map((k) => ({ userId, itemKey: k, ledgerId: row!.id })));
    }
    return { balance: await coinBalance(tx, userId) };
  });
}

/** Gift a coin item to a friend (the caller checks friendship): the sender pays, the item lands in the friend's wardrobe. */
export async function giftCosmetic(db: Db, fromId: string, toId: string, key: string, requestId: string): Promise<{ balance: number }> {
  const item = cosmetic(key);
  if (!item) throw new AppError('NOT_FOUND');
  if (!('coins' in item.unlock)) throw new AppError('NOT_FOR_SALE');
  const cost = item.unlock.coins;
  const r = await db.transaction(async (tx) => {
    await lockCoins(tx, fromId);
    const sourceKey = `gift:${fromId}:${requestId}`;
    const [done] = await tx.select({ id: coinLedger.id }).from(coinLedger).where(eq(coinLedger.sourceKey, sourceKey));
    let note: string | null = null;
    if (!done) {
      const [own] = await tx.select().from(userCosmetics).where(and(eq(userCosmetics.userId, toId), eq(userCosmetics.itemKey, key)));
      if (own) throw new AppError('ALREADY_OWNED');
      if ((await coinBalance(tx, fromId)) < cost) throw new AppError('INSUFFICIENT_COINS');
      const [row] = await tx.insert(coinLedger).values({ userId: fromId, amount: -cost, ruleId: `gift.${key}`, reason: `هدیهٔ «${item.nameFa}».`, sourceKey,
        metadata: { item: key, to: toId } }).returning({ id: coinLedger.id });
      await tx.insert(userCosmetics).values({ userId: toId, itemKey: key, ledgerId: row!.id });
      const [from] = await tx.select({ name: users.displayName }).from(users).where(eq(users.id, fromId));
      const [n] = await tx.insert(notifications).values({ userId: toId, kind: 'gift', payload: { actorName: from?.name, itemNameFa: item.nameFa }, dedupeKey: `gift:${row!.id}` })
        .returning({ id: notifications.id });
      note = n!.id;
    }
    return { balance: await coinBalance(tx, fromId), note };
  });
  if (r.note) await db.execute(sql`select pg_notify('notification_created', ${r.note})`);
  return { balance: r.balance };
}

export async function equippedFor(db: Db | Tx, userId: string): Promise<EquippedCosmetics> {
  const [u] = await db.select({ e: users.equipped }).from(users).where(eq(users.id, userId));
  return u?.e ?? {};
}

/** Equip (or clear with null) one table cosmetic. The key must belong to `kind` and be unlocked right now. */
export async function equipCosmetic(db: Db, userId: string, kind: ItemKind, key: string | null): Promise<EquippedCosmetics> {
  if (key !== null) {
    if (kindOfKey(key) !== kind || !cosmetic(key)) throw new AppError('VALIDATION_FAILED');
    await assertUnlocked(db, userId, [key]);
  }
  // One atomic jsonb update so two kinds equipped at once cannot overwrite each other.
  const patch = key === null ? sql`${users.equipped} - ${kind}::text` : sql`${users.equipped} || ${JSON.stringify({ [kind]: key })}::jsonb`;
  const [row] = await db.update(users).set({ equipped: patch }).where(eq(users.id, userId)).returning({ e: users.equipped });
  return row?.e ?? {};
}

/** Equipped keys the table shows next to a seat (only the three kinds other players see). */
/** Table-visible equipped items (seat ring, chat bubble, emote) from a user's `equipped` column; undefined when none. */
export function seatCosmeticsOf(e: { seatRing?: string | null; chatBubble?: string | null; emote?: string | null } | null | undefined) {
  if (!e) return undefined;
  const c = { ...(e.seatRing && { seatRing: e.seatRing }), ...(e.chatBubble && { chatBubble: e.chatBubble }), ...(e.emote && { emote: e.emote }) };
  return Object.keys(c).length ? c : undefined;
}

export async function seatCosmeticsFor(db: Db | Tx, userIds: string[]): Promise<Map<string, { seatRing?: string; chatBubble?: string; emote?: string }>> {
  const out = new Map<string, { seatRing?: string; chatBubble?: string; emote?: string }>();
  if (!userIds.length) return out;
  const rows = await db.select({ id: users.id, e: users.equipped }).from(users).where(inArray(users.id, userIds));
  for (const r of rows) {
    const c = seatCosmeticsOf(r.e);
    if (c) out.set(r.id, c);
  }
  return out;
}
