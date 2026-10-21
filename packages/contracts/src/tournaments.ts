import { z } from 'zod';
import { publicProfile } from './api.ts';

export const tournamentFormat = z.enum(['swiss', 'knockout']);
export const tournamentStatus = z.enum(['open', 'running', 'finished', 'cancelled']);
export const tournamentEntryKind = z.enum(['free', 'coins', 'toman']);
export const tournamentPrize = z.strictObject({
  place: z.number().int().min(1).max(64),
  coins: z.number().int().min(0).max(1_000_000),
  premiumDays: z.number().int().min(0).max(365)
});

export const createTournamentBody = z.strictObject({
  gameId: z.string().max(64),
  titleFa: z.string().trim().min(3).max(80),
  descriptionFa: z.string().trim().max(1000).default(''),
  format: tournamentFormat,
  pace: z.enum(['live', 'turn']),
  turnSeconds: z.number().int().positive(),
  tableSize: z.number().int().min(2).max(16),
  /** Swiss only. */
  rounds: z.number().int().min(1).max(15).optional(),
  /** Knockout only: players of each table who go through. */
  advance: z.number().int().min(1).max(15).default(1),
  minEntrants: z.number().int().min(2).max(512),
  maxEntrants: z.number().int().min(2).max(512),
  startsAt: z.iso.datetime(),
  arrivalSeconds: z.number().int().min(30).max(1800).default(180),
  entryKind: tournamentEntryKind,
  /** Coins, or Rial for a Toman entry; 0 for a free entry. */
  entryAmount: z.number().int().min(0).max(1_000_000_000),
  prizes: z.array(tournamentPrize).max(64).default([]),
  /** Variant choices of the game for every table (e.g. chess clock "10+5"); checked against the game's options. */
  options: z.record(z.string().max(32), z.union([z.string().max(64), z.number(), z.boolean()])).default({}),
  /** Minutes before the start in which players confirm attendance; 0 = no check-in. Unconfirmed players are withdrawn and refunded. */
  checkinMinutes: z.number().int().min(0).max(240).default(0),
  /** Break between a finished round and the next one. */
  roundGapSeconds: z.number().int().min(0).max(3600).default(0),
  /** Two players level for first place after every tie-break: 'armageddon' plays one decisive game, 'none' shares the prize. */
  playoff: z.enum(['none', 'armageddon']).default('none')
});
export type CreateTournamentBody = z.infer<typeof createTournamentBody>;

export const tournamentSummary = z.object({
  id: z.uuid(), gameId: z.string(), gameNameFa: z.string(), titleFa: z.string(), format: tournamentFormat, status: tournamentStatus,
  pace: z.enum(['live', 'turn']), turnSeconds: z.number().int(), tableSize: z.number().int(), rounds: z.number().int().nullable(), advance: z.number().int(),
  startsAt: z.iso.datetime(), entrants: z.number().int(), minEntrants: z.number().int(), maxEntrants: z.number().int(),
  entryKind: tournamentEntryKind, entryAmount: z.number().int(), prizes: z.array(tournamentPrize), currentRound: z.number().int(),
  registered: z.boolean()
});
export type TournamentSummary = z.infer<typeof tournamentSummary>;

export const tournamentDetail = tournamentSummary.extend({
  descriptionFa: z.string(), arrivalSeconds: z.number().int(), cancelReason: z.string().nullable(), finishedAt: z.iso.datetime().nullable(),
  options: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  playoff: z.enum(['none', 'armageddon']), checkinMinutes: z.number().int(), roundGapSeconds: z.number().int(), nextRoundAt: z.iso.datetime().nullable(),
  standings: z.array(z.object({
    player: publicProfile, points: z.number(), wins: z.number().int(), byes: z.number().int(), noShows: z.number().int(),
    eliminatedRound: z.number().int().nullable(), finalRank: z.number().int().nullable(),
    /** Swiss tie-breaks: sum of opponents' points, and of beaten opponents' points (+½ drawn). */
    buchholzCut1: z.number(), buchholz: z.number(), sonnebornBerger: z.number(),
    /** Average rating of opponents played; null when the event has unrated players (the criterion is then not used). */
    aro: z.number().int().nullable(), startRating: z.number().int().nullable(),
    /** Performance rating over the games played (needs everyone rated). */
    tpr: z.number().int().nullable(),
    /** Round by round (head-to-head Swiss): result, opponent and side, for the cross-table. */
    results: z.array(z.object({ round: z.number().int(), opponentId: z.uuid().nullable(), result: z.number(), kind: z.string(), side: z.enum(['first', 'second']).nullable() })), disqualified: z.boolean(), checkedIn: z.boolean()
  })),
  /** Rounds created so far; `roundsPlayed` holds only the one asked for (`?round=`, default the current/latest). */
  roundCount: z.number().int(),
  /** Up to three boards of the current round with the highest-scoring players, to follow live. */
  featured: z.array(z.object({ tableId: z.uuid(), status: z.string(), players: z.array(z.object({ player: publicProfile, points: z.number() })) })),
  roundsPlayed: z.array(z.object({
    round: z.number().int(),
    tables: z.array(z.object({
      tableId: z.uuid(), status: z.string(), overridden: z.boolean(), playoff: z.boolean(),
      players: z.array(z.object({ player: publicProfile, place: z.number().int().nullable(), absent: z.boolean() }))
    }))
  })),
  /** The signed-in player's own state. */
  me: z.object({
    registered: z.boolean(), tableId: z.uuid().nullable(), refundStatus: z.enum(['pending', 'paid']).nullable(),
    checkedIn: z.boolean(), requestedByes: z.array(z.number().int()), disqualified: z.boolean()
  }).nullable(),
  checkout: z.object({ available: z.boolean(), reasonFa: z.string().nullable(), fixture: z.boolean() })
});
export type TournamentDetail = z.infer<typeof tournamentDetail>;

export const tournamentRefundItem = z.object({
  id: z.uuid(), tournamentTitleFa: z.string(), userId: z.uuid(), displayName: z.string(), mobile: z.string(), orderId: z.string(),
  providerRef: z.string().nullable(), amount: z.number().int(), reason: z.string(), status: z.enum(['pending', 'paid']), createdAt: z.iso.datetime(), note: z.string().nullable()
});

export const tournamentPlacements = z.array(z.strictObject({ userId: z.uuid(), place: z.number().int().min(1).max(16) })).min(2).max(16);
