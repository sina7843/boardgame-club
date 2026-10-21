import { z } from 'zod';
import { publicProfile } from './api.ts';
import { ratingModeSchema } from './rating-mode.ts';

export const leagueSchema = z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master']);
export type League = z.infer<typeof leagueSchema>;
export const ratingRow = z.object({
  gameId: z.string(), mode: ratingModeSchema, display: z.number().int(), mu: z.number(), sigma: z.number(),
  games: z.number().int(), provisional: z.boolean(), leaderboardEligible: z.boolean(), league: leagueSchema.nullable()
});
export const ledgerItem = z.object({
  kind: z.string(), ruleId: z.string(), amount: z.number().int(), reason: z.string(), gameId: z.string().nullable(), createdAt: z.iso.datetime()
});
export type LedgerItem = z.infer<typeof ledgerItem>;
/** Achievement trophy art tier, lowest to highest. */
export const TROPHY_TIERS = ['bronze', 'silver', 'gold', 'turquoise', 'diamond'] as const;
export const trophyTier = z.enum(TROPHY_TIERS);
export type TrophyTier = z.infer<typeof trophyTier>;

/** Three separate kinds of progress (Requirements §12): skill (ratings), account level (XP) and per-game mastery. */
/** Coins for reaching level n: n × this (shown on the level-up celebration; paid by the server's coin sync). */
export const LEVEL_UP_COINS = 10;

export const progressionResponse = z.object({
  xp: z.number().int(),
  level: z.number().int(),
  levelFloor: z.number().int(),
  nextLevelAt: z.number().int(),
  ratings: z.array(ratingRow),
  mastery: z.array(z.object({ gameId: z.string(), gameNameFa: z.string(), tier: z.string(), tierFa: z.string(), completed: z.number().int(),
    wins: z.number().int(), ranked: z.number().int(), tutorial: z.boolean() })),
  missions: z.object({ periodKey: z.string(), endsAt: z.iso.datetime(), items: z.array(z.object({
    key: z.string(), titleFa: z.string(), descriptionFa: z.string(), progress: z.number().int(), target: z.number().int(), xp: z.number().int(), completed: z.boolean() })) }),
  achievements: z.array(z.object({ key: z.string(), titleFa: z.string(), descriptionFa: z.string(), tier: trophyTier,
    progress: z.number().int(), target: z.number().int(), grantedAt: z.iso.datetime().nullable() })),
  ledger: z.array(ledgerItem),
  season: z.object({ id: z.uuid(), nameFa: z.string(), endsAt: z.iso.datetime() }).nullable()
});
export type Progression = z.infer<typeof progressionResponse>;

/** Game of the day (Tehran calendar day). gameId null when no eligible game is published. */
export const dailyGameResponse = z.object({
  gameId: z.string().nullable(), gameNameFa: z.string().nullable(), date: z.iso.date(), bonusXp: z.number().int(),
  doneToday: z.boolean(), streak: z.number().int()
});
export type DailyGame = z.infer<typeof dailyGameResponse>;

export const tableRewards = z.object({
  rating: z.object({ before: z.number().int(), after: z.number().int(), provisional: z.boolean() }).nullable(),
  rewards: z.array(ledgerItem),
  /** Coins earned from this table (all rules together). */
  coins: z.number().int(),
  /** Rewards are computed asynchronously after the game; false = still processing (the UI re-checks). */
  processed: z.boolean()
});

export const leaderboardResponse = z.object({
  gameId: z.string(), mode: ratingModeSchema,
  season: z.object({ id: z.uuid(), nameFa: z.string(), status: z.string() }).nullable(),
  rules: z.object({ minGames: z.number().int(), maxSigma: z.number() }),
  items: z.array(z.object({ rank: z.number().int(), user: publicProfile, rating: z.number().int(), games: z.number().int(), league: leagueSchema.nullable(),
    /** Share of ranked games finished first (0-100), and rating change over the last 7 days. */
    winRate: z.number().int(), weekDelta: z.number().int() })),
  /** Eligible players in this board, and where I stand (null when I have no rating here). */
  total: z.number().int(),
  me: z.object({ rank: z.number().int().nullable(), rating: z.number().int(), games: z.number().int(), league: leagueSchema.nullable(), gamesToEligible: z.number().int() }).nullable(),
  /** League floors for the ladder (bronze starts at 0). */
  ladder: z.array(z.object({ league: leagueSchema, from: z.number().int() }))
});

export const planItem = z.object({
  id: z.uuid(), key: z.string(), titleFa: z.string(), period: z.enum(['monthly', 'yearly']), durationDays: z.number().int(),
  priceAmount: z.number().int().nullable(), currency: z.string(), termsFa: z.string(), purchasable: z.boolean(), unavailableReasonFa: z.string().nullable()
});
export const plansResponse = z.object({
  items: z.array(planItem),
  checkout: z.object({ available: z.boolean(), reasonFa: z.string().nullable(), fixture: z.boolean() }),
  /** Concurrent turn-based tables, free vs premium (server config), for the comparison table. */
  limits: z.object({ turnTables: z.object({ free: z.number().int(), premium: z.number().int() }) })
});
export const subscriptionStatus = z.object({
  premium: z.boolean(),
  premiumUntil: z.iso.datetime().nullable(),
  autoRenew: z.literal(false),
  subscriptions: z.array(z.object({ planTitleFa: z.string(), status: z.string(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime() })),
  payments: z.array(z.object({ orderId: z.string(), planTitleFa: z.string(), amount: z.number().int(), currency: z.string(),
    status: z.enum(['pending', 'verified', 'failed', 'expired']), failureReason: z.string().nullable(), createdAt: z.iso.datetime() }))
});
export type SubscriptionStatus = z.infer<typeof subscriptionStatus>;
export const paymentStatus = z.object({
  orderId: z.string(), status: z.enum(['pending', 'verified', 'failed', 'expired']), failureReason: z.string().nullable(),
  /** planTitleFa names the product: a plan or a coin pack (see kind). */
  amount: z.number().int(), planTitleFa: z.string(), kind: z.enum(['plan', 'coins', 'tournament']), coins: z.number().int().nullable(), fixture: z.boolean(),
  /** Tournament entry payments: where to go back to. */
  tournamentId: z.uuid().nullable().default(null)
});

/** Coin wallet: balance, recent movements, shop, purchasable packs and the earning rules (all server-defined). */
export const coinsResponse = z.object({
  balance: z.number().int(),
  history: z.array(z.object({ amount: z.number().int(), ruleId: z.string(), reason: z.string(), createdAt: z.iso.datetime() })),
  shop: z.array(z.object({ key: z.string(), titleFa: z.string(), descriptionFa: z.string(), cost: z.number().int(), premiumDays: z.number().int() })),
  packs: z.array(z.object({ id: z.uuid(), key: z.string(), titleFa: z.string(), coins: z.number().int(), priceAmount: z.number().int().nullable(),
    currency: z.string(), purchasable: z.boolean(), unavailableReasonFa: z.string().nullable() })),
  checkout: z.object({ available: z.boolean(), reasonFa: z.string().nullable(), fixture: z.boolean() }),
  earn: z.array(z.object({ labelFa: z.string(), coins: z.number().int() }))
});
export type CoinsResponse = z.infer<typeof coinsResponse>;
