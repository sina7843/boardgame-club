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
  prizes: z.array(tournamentPrize).max(64).default([])
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
  standings: z.array(z.object({
    player: publicProfile, points: z.number(), wins: z.number().int(), byes: z.number().int(), noShows: z.number().int(),
    eliminatedRound: z.number().int().nullable(), finalRank: z.number().int().nullable()
  })),
  roundsPlayed: z.array(z.object({
    round: z.number().int(),
    tables: z.array(z.object({
      tableId: z.uuid(), status: z.string(),
      players: z.array(z.object({ player: publicProfile, place: z.number().int().nullable(), absent: z.boolean() }))
    }))
  })),
  /** The signed-in player's own state. */
  me: z.object({ registered: z.boolean(), tableId: z.uuid().nullable(), refundStatus: z.enum(['pending', 'paid']).nullable() }).nullable(),
  checkout: z.object({ available: z.boolean(), reasonFa: z.string().nullable(), fixture: z.boolean() })
});
export type TournamentDetail = z.infer<typeof tournamentDetail>;

export const tournamentRefundItem = z.object({
  id: z.uuid(), tournamentTitleFa: z.string(), userId: z.uuid(), displayName: z.string(), mobile: z.string(), orderId: z.string(),
  providerRef: z.string().nullable(), amount: z.number().int(), reason: z.string(), status: z.enum(['pending', 'paid']), createdAt: z.iso.datetime(), note: z.string().nullable()
});
