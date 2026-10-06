import { z } from 'zod';
import { accessSchema, competitionSchema, difficultySchema, optionValueSchema, paceSchema } from '@bg/game-sdk';

export { accessSchema, competitionSchema, difficultySchema, paceSchema };

// ---------- Auth ----------
export const otpRequestBody = z.strictObject({ mobile: z.string().min(10).max(20) });
export const otpRequestResponse = z.object({
  challengeId: z.uuid(),
  expiresAt: z.iso.datetime(),
  resendAfterSeconds: z.number().int(),
  /** True only for the development fixture provider, so the UI can say no SMS was sent. */
  fixtureDelivery: z.boolean()
});

export const otpVerifyBody = z.strictObject({
  challengeId: z.uuid(),
  code: z.string().min(4).max(8)
});

export const roleSchema = z.enum(['admin', 'moderator']);
export type Role = z.infer<typeof roleSchema>;

export const avatarKeys = ['meeple', 'dice', 'crown', 'pawn', 'card', 'star'] as const;
export const avatarKeySchema = z.enum(avatarKeys);

export const publicProfile = z.object({
  id: z.uuid(),
  displayName: z.string(),
  avatarKey: avatarKeySchema,
  joinedAt: z.iso.datetime()
});
export type PublicProfile = z.infer<typeof publicProfile>;

/** Private view of the signed-in account. Mobile is masked even for the owner. */
export const meResponse = publicProfile.extend({
  mobileMasked: z.string(),
  roles: z.array(roleSchema),
  profileCompleted: z.boolean(),
  /** Active suspension: only sanctions, appeals and support are available. */
  suspended: z.boolean()
});
export type Me = z.infer<typeof meResponse>;

export const displayNameSchema = z.string().trim()
  .min(2, 'نام نمایشی حداقل ۲ نویسه است')
  .max(24, 'نام نمایشی حداکثر ۲۴ نویسه است')
  .regex(/^[\p{L}\p{N}\u200C _.-]+$/u, 'فقط حروف، عدد، فاصله و ـ . مجاز است');

export const updateProfileBody = z.strictObject({
  displayName: displayNameSchema,
  avatarKey: avatarKeySchema
});

// ---------- Catalog ----------
export const gameStatusSchema = z.enum(['draft', 'active', 'suspended']);

const intFromQuery = z.coerce.number().int();

export const catalogQuery = z.strictObject({
  q: z.string().max(60).optional(),
  players: intFromQuery.min(1).max(20).optional(),
  maxMinutes: intFromQuery.min(1).max(600).optional(),
  difficulty: difficultySchema.optional(),
  mode: z.enum(['live', 'turn', 'friendly', 'ranked']).optional(),
  access: accessSchema.optional()
});
export type CatalogQuery = z.infer<typeof catalogQuery>;

export const gameSummary = z.object({
  id: z.string(),
  nameFa: z.string(),
  nameOriginal: z.string(),
  summaryFa: z.string(),
  minPlayers: z.number().int(),
  maxPlayers: z.number().int(),
  minMinutes: z.number().int(),
  maxMinutes: z.number().int(),
  difficulty: difficultySchema,
  access: accessSchema,
  paces: z.array(paceSchema),
  competitions: z.array(competitionSchema),
  isTestGame: z.boolean(),
  status: gameStatusSchema,
  tutorialEnabled: z.boolean(),
  /** Time budgets offered for this game (admin-chosen subset of TIME_OPTIONS). */
  liveSeconds: z.array(z.number().int()),
  turnSeconds: z.array(z.number().int())
});
export type GameSummary = z.infer<typeof gameSummary>;

/** A rule variant as offered for this game: only the admin-allowed choices are listed. */
export const gameOptionView = z.object({
  key: z.string(),
  labelFa: z.string(),
  descriptionFa: z.string().nullable(),
  choices: z.array(z.object({ value: optionValueSchema, labelFa: z.string() })),
  default: optionValueSchema,
  /** false = fixed by the admin; the host cannot change it. */
  hostChooses: z.boolean()
});
export type GameOptionView = z.infer<typeof gameOptionView>;

export const gameDetail = gameSummary.extend({
  options: z.array(gameOptionView),
  rulesFa: z.array(z.string()),
  timeoutPolicyFa: z.string(),
  resignPolicyFa: z.string(),
  tutorialFa: z.string(),
  activeVersion: z.object({ rulesVersion: z.string(), stateSchemaVersion: z.number().int() }).nullable(),
  /** New tables can be created only when the game is active. Gameplay itself ships in DRAGON-01. */
  acceptingNewTables: z.boolean()
});
export type GameDetail = z.infer<typeof gameDetail>;

export const gameListResponse = z.object({ items: z.array(gameSummary) });

/** What the reviewed module supports (upper bounds for the admin) and what is currently offered. */
const offeredSettings = z.strictObject({
  paces: z.array(paceSchema).min(1),
  competitions: z.array(competitionSchema).min(1),
  minPlayers: z.number().int().min(1).max(16),
  maxPlayers: z.number().int().min(1).max(16),
  liveSeconds: z.array(z.number().int().positive()).min(1),
  turnSeconds: z.array(z.number().int().positive()).min(1),
  options: z.record(z.string().max(32), z.strictObject({
    allowed: z.array(optionValueSchema).min(1),
    default: optionValueSchema,
    hostChooses: z.boolean()
  }))
});
export const adminGameSettingsBody = offeredSettings.extend({ reason: z.string().trim().min(3).max(300) });
export type AdminGameSettingsBody = z.infer<typeof adminGameSettingsBody>;
export const adminGameSettingsView = z.object({
  gameId: z.string(),
  rulesVersion: z.string().nullable(),
  supported: z.object({
    paces: z.array(paceSchema), competitions: z.array(competitionSchema), minPlayers: z.number().int(), maxPlayers: z.number().int(),
    liveSeconds: z.array(z.number().int()), turnSeconds: z.array(z.number().int()),
    options: z.array(z.object({ key: z.string(), labelFa: z.string(), descriptionFa: z.string().nullable(), choices: z.array(z.object({ value: optionValueSchema, labelFa: z.string() })), default: optionValueSchema }))
  }),
  current: offeredSettings
});
export type AdminGameSettingsView = z.infer<typeof adminGameSettingsView>;

export const adminUpdateGameBody = z.strictObject({
  status: gameStatusSchema,
  reason: z.string().trim().min(3).max(300)
});

// ---------- Health ----------
export const healthResponse = z.object({
  status: z.enum(['ok', 'unavailable']),
  checks: z.record(z.string(), z.enum(['ok', 'fail'])).optional()
});
