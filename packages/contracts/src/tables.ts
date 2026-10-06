import { z } from 'zod';
import { competitionSchema, paceSchema } from '@bg/game-sdk';
import { publicProfile } from './api.ts';

/** Allowed per-turn time budgets. Live: seconds per move/round; turn-based: durable deadline per turn. */
export const TIME_OPTIONS = {
  live: [15, 30, 60, 120, 300],
  turn: [12 * 3600, 24 * 3600, 48 * 3600, 72 * 3600]
} as const;

export const tableStatusSchema = z.enum(['open', 'active', 'paused', 'finished', 'cancelled']);
export const visibilitySchema = z.enum(['public', 'private']);

export const createTableBody = z.strictObject({
  gameId: z.string().min(1).max(64),
  pace: paceSchema,
  competition: competitionSchema.default('friendly'),
  visibility: visibilitySchema.default('private'),
  capacity: z.number().int().min(1).max(16),
  turnSeconds: z.number().int().positive(),
  reminders: z.boolean().default(true)
});
export type CreateTableBody = z.infer<typeof createTableBody>;

export const tableSettings = z.object({ turnSeconds: z.number().int(), reminders: z.boolean() });

export const seatView = z.object({
  seat: z.number().int(),
  kind: z.enum(['human', 'script']),
  user: publicProfile.nullable(),
  ready: z.boolean()
});

export const tableLobby = z.object({
  id: z.uuid(),
  gameId: z.string(),
  gameNameFa: z.string(),
  gameNameOriginal: z.string(),
  status: tableStatusSchema,
  pace: paceSchema,
  competition: competitionSchema,
  visibility: visibilitySchema,
  capacity: z.number().int(),
  settings: tableSettings,
  rulesVersion: z.string(),
  stateSchemaVersion: z.number().int(),
  clientBundleRef: z.string(),
  isTutorial: z.boolean(),
  isMatchmade: z.boolean(),
  /** Matchmade tables: accept before this time or the match is dissolved. */
  readyDeadline: z.iso.datetime().nullable(),
  hostId: z.uuid(),
  seats: z.array(seatView),
  mySeat: z.number().int().nullable(),
  /** Only returned to participants of a private table. */
  inviteCode: z.string().nullable(),
  policies: z.object({ timeoutFa: z.string(), resignFa: z.string(), disconnectFa: z.string() }),
  createdAt: z.iso.datetime()
});
export type TableLobby = z.infer<typeof tableLobby>;

export const outcomeSchema = z.object({
  reason: z.enum(['win', 'draw', 'score', 'timeout', 'resign']),
  placements: z.array(z.object({ seat: z.number().int(), place: z.number().int(), score: z.number().optional() }))
});

/** Everything a viewer may know about a table at one revision. Built only from module.project(). */
export const tableSnapshot = z.object({
  table: tableLobby,
  game: z.object({
    revision: z.number().int(),
    view: z.unknown(),
    legalActions: z.array(z.object({ type: z.string() }).loose()),
    pendingSeats: z.array(z.number().int()),
    deadline: z.object({ dueAt: z.iso.datetime(), frozen: z.boolean() }).nullable(),
    result: outcomeSchema.nullable(),
    tutorial: z.object({
      step: z.number().int(), total: z.number().int(), instructionFa: z.string(), introFa: z.string(),
      expected: z.object({ type: z.string() }).loose().nullable()
    }).nullable()
  }).nullable(),
  incident: z.object({ reasonFa: z.string(), startedAt: z.iso.datetime() }).nullable(),
  serverTime: z.iso.datetime()
});
export type TableSnapshot = z.infer<typeof tableSnapshot>;

export const commandBody = z.strictObject({
  commandId: z.uuid(),
  expectedRevision: z.number().int().min(0),
  action: z.object({ type: z.string().min(1).max(64) }).loose()
});

export const commandResult = z.object({
  status: z.enum(['accepted', 'rejected']),
  revision: z.number().int(),
  errorCode: z.string().nullable(),
  duplicate: z.boolean(),
  snapshot: tableSnapshot
});
export type CommandResult = z.infer<typeof commandResult>;

export const receiptLookup = z.union([
  z.object({ found: z.literal(false) }),
  z.object({ found: z.literal(true), status: z.enum(['accepted', 'rejected']), revision: z.number().int(), errorCode: z.string().nullable() })
]);

export const myTableItem = z.object({
  id: z.uuid(),
  gameId: z.string(),
  gameNameFa: z.string(),
  status: tableStatusSchema,
  pace: paceSchema,
  isTutorial: z.boolean(),
  isMyTurn: z.boolean(),
  deadline: z.iso.datetime().nullable(),
  players: z.number().int(),
  capacity: z.number().int(),
  updatedRevision: z.number().int()
});
export type MyTableItem = z.infer<typeof myTableItem>;

export const openTableItem = z.object({
  id: z.uuid(), gameId: z.string(), gameNameFa: z.string(), pace: paceSchema, players: z.number().int(),
  capacity: z.number().int(), turnSeconds: z.number().int(), host: publicProfile
});

export const notificationItem = z.object({
  id: z.uuid(),
  kind: z.enum(['turn', 'reminder', 'finished', 'invite', 'match', 'message', 'friend_request', 'club']),
  /** In-app destination; the target page re-checks authorization. */
  href: z.string(),
  tableId: z.uuid().nullable(),
  textFa: z.string(),
  createdAt: z.iso.datetime(),
  read: z.boolean()
});
export type NotificationItem = z.infer<typeof notificationItem>;

export const tutorialProgressItem = z.object({
  gameId: z.string(), status: z.enum(['in_progress', 'completed', 'skipped']), tableId: z.uuid().nullable()
});

/** Persian text for command-level rejection codes (status 200, `rejected`). */
export const GAME_ERRORS_FA: Record<string, string> = {
  STALE_REVISION: 'وضعیت میز تغییر کرده است؛ آخرین وضعیت نمایش داده شد. حرکت را دوباره بررسی کنید.',
  TABLE_NOT_ACTIVE: 'این میز در جریان نیست.',
  INVALID_ACTION: 'این حرکت معتبر نیست.',
  NOT_YOUR_TURN: 'نوبت شما نیست.',
  CELL_OCCUPIED: 'این خانه پر است.',
  GAME_FINISHED: 'بازی تمام شده است.',
  NOT_A_PLAYER: 'شما بازیکن این میز نیستید.',
  ALREADY_COMMITTED: 'پیشنهاد این دور را قبلاً ثبت کرده‌اید.',
  TOKEN_UNAVAILABLE: 'این ژتون را قبلاً مصرف کرده‌اید.',
  ALREADY_RESIGNED: 'شما از این بازی انصراف داده‌اید.',
  TUTORIAL_EXPECTED_OTHER: 'در این مرحله آموزش، حرکت مشخص‌شده را انجام دهید.'
};
