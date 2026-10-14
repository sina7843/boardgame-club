// Foundational PostgreSQL schema for every PRD domain (Requirements §10).
// Columns are snake_case in SQL via drizzle `casing: 'snake_case'`.
// Phase 00 owns business logic only for identity, sessions, roles, catalog and audit;
// the remaining tables are storage contracts consumed by later phases (no speculative logic).
import { sql, type SQL } from 'drizzle-orm';
import {
  bigint, bigserial, boolean, check, doublePrecision, index, integer, jsonb, pgTable,
  primaryKey, text, timestamp, unique, uniqueIndex, uuid, type AnyPgColumn
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const tsz = () => timestamp({ withTimezone: true });
const id = () => uuid().primaryKey().defaultRandom();

/** CHECK (col IN (...)) — database-enforced enum without pg ENUM migration friction. */
function oneOf(name: string, col: AnyPgColumn, values: readonly string[]): ReturnType<typeof check> {
  // Values are code constants (never user input); DDL cannot take bind parameters.
  const list: SQL = sql.raw(values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', '));
  return check(name, sql`${col} in (${list})`);
}

// ============ Identity ============
export const users = pgTable('users', {
  id: id(),
  displayName: text().notNull(),
  /** Legacy icon key or a built avatar string (`v1:…`, contracts/cosmetics.ts). */
  avatarKey: text().notNull().default('meeple'),
  /** Public profile customization; catalogue keys are checked for ownership on every write. */
  bio: text(),
  titleKey: text(),
  bannerKey: text(),
  favoriteGames: text().array().notNull().default(sql`'{}'::text[]`),
  /** Achievement keys the player chose to show first. */
  showcase: text().array().notNull().default(sql`'{}'::text[]`),
  /** Equipped table cosmetics per kind (`{ seatRing: 'sr.2' }`); ownership is checked when equipping. */
  equipped: jsonb().$type<Partial<Record<'cardBack' | 'boardSkin' | 'emote' | 'chatBubble' | 'seatRing', string>>>().notNull().default({}),
  profileCompleted: boolean().notNull().default(false),
  /** `deleted` = self-deleted: profile anonymised, mobile released, sessions rejected; the row stays for game history. */
  status: text().notNull().default('active'),
  /** Terms version (app_settings `terms_version`) the user last accepted, and when. */
  termsVersion: text(),
  termsAcceptedAt: tsz(),
  /** Invite code for the friend-referral link; issued on first request. */
  referralCode: text().unique(),
  createdAt: createdAt(),
  updatedAt: createdAt()
}, (t) => [oneOf('users_status_chk', t.status, ['active', 'suspended', 'deleted'])]);

/** Private contact data, separated from the public profile (Requirements §10). */
export const userPrivate = pgTable('user_private', {
  userId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  mobile: text().notNull().unique(),
  createdAt: createdAt()
});

export const userRoles = pgTable('user_roles', {
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text().notNull(),
  grantedBy: uuid().references(() => users.id),
  grantedAt: createdAt()
}, (t) => [primaryKey({ columns: [t.userId, t.role] }), oneOf('user_roles_role_chk', t.role, ['admin', 'moderator'])]);

/** OTP challenges store only an HMAC of the code; single use, expiry and attempt limits. */
export const otpChallenges = pgTable('otp_challenges', {
  id: id(),
  mobile: text().notNull(),
  codeHash: text().notNull(),
  expiresAt: tsz().notNull(),
  attempts: integer().notNull().default(0),
  maxAttempts: integer().notNull(),
  consumedAt: tsz(),
  createdAt: createdAt()
}, (t) => [index('otp_challenges_mobile_created_idx').on(t.mobile, t.createdAt)]);

export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text().notNull().unique(),
  createdAt: createdAt(),
  expiresAt: tsz().notNull(),
  lastSeenAt: createdAt(),
  revokedAt: tsz()
}, (t) => [index('sessions_user_idx').on(t.userId)]);

// ============ Social (logic: DRAGON-02) ============
export const friendships = pgTable('friendships', {
  userLow: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  userHigh: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  requestedBy: uuid().notNull().references(() => users.id),
  status: text().notNull(),
  createdAt: createdAt(),
  respondedAt: tsz()
}, (t) => [
  primaryKey({ columns: [t.userLow, t.userHigh] }),
  check('friendships_order_chk', sql`${t.userLow} < ${t.userHigh}`),
  oneOf('friendships_status_chk', t.status, ['pending', 'accepted'])
]);

export const blocks = pgTable('blocks', {
  blockerId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: createdAt()
}, (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })]);

export const groups = pgTable('groups', {
  id: id(),
  name: text().notNull(),
  ownerId: uuid().notNull().references(() => users.id),
  createdAt: createdAt()
});

export const clubs = pgTable('clubs', {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull().default(''),
  ownerId: uuid().notNull().references(() => users.id),
  joinPolicy: text().notNull(),
  createdAt: createdAt()
}, (t) => [oneOf('clubs_join_policy_chk', t.joinPolicy, ['open', 'request', 'invite'])]);

export const memberships = pgTable('memberships', {
  id: id(),
  scopeType: text().notNull(),
  scopeId: uuid().notNull(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text().notNull(),
  status: text().notNull(),
  invitedBy: uuid().references(() => users.id),
  createdAt: createdAt()
}, (t) => [
  unique('memberships_scope_user_uq').on(t.scopeType, t.scopeId, t.userId),
  index('memberships_user_idx').on(t.userId, t.scopeType),
  oneOf('memberships_scope_chk', t.scopeType, ['group', 'club']),
  oneOf('memberships_role_chk', t.role, ['owner', 'manager', 'member']),
  oneOf('memberships_status_chk', t.status, ['active', 'requested', 'invited'])
]);

export const conversations = pgTable('conversations', {
  id: id(),
  kind: text().notNull(),
  scopeId: uuid(),
  /** direct: "lowUserId:highUserId" — one conversation per pair. */
  directKey: text().unique(),
  createdAt: createdAt(),
  lastMessageAt: tsz(),
  /** Group/club slow mode: minimum seconds between one member's messages (managers exempt). 0 = off. */
  slowModeSeconds: integer().notNull().default(0)
}, (t) => [
  oneOf('conversations_kind_chk', t.kind, ['direct', 'table', 'group', 'club']),
  uniqueIndex('conversations_scope_uq').on(t.kind, t.scopeId).where(sql`scope_id is not null`)
]);

export const conversationMembers = pgTable('conversation_members', {
  conversationId: uuid().notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  mutedAt: tsz(),
  lastReadAt: tsz()
}, (t) => [primaryKey({ columns: [t.conversationId, t.userId] })]);

export const messages = pgTable('messages', {
  id: id(),
  conversationId: uuid().notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid().notNull().references(() => users.id),
  body: text().notNull(),
  createdAt: createdAt(),
  deletedAt: tsz(),
  deletedBy: uuid().references(() => users.id),
  replyToId: uuid().references((): AnyPgColumn => messages.id, { onDelete: 'set null' }),
  editedAt: tsz(),
  /** Body as first sent; kept on edit so moderators see what was originally said. */
  originalBody: text(),
  /** Client-generated id: a retried send returns the same message instead of a duplicate. */
  clientId: uuid()
}, (t) => [
  index('messages_conversation_created_idx').on(t.conversationId, t.createdAt),
  index('messages_sender_created_idx').on(t.senderId, t.createdAt),
  uniqueIndex('messages_sender_client_uq').on(t.senderId, t.clientId).where(sql`client_id is not null`)
]);

/** One row per user+message+emoji; the emoji allow-list is enforced by the API contract. */
export const messageReactions = pgTable('message_reactions', {
  messageId: uuid().notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji: text().notNull(),
  createdAt: createdAt()
}, (t) => [primaryKey({ columns: [t.messageId, t.userId, t.emoji] })]);

export const reports = pgTable('reports', {
  id: id(),
  reporterId: uuid().notNull().references(() => users.id),
  targetType: text().notNull(),
  targetId: text().notNull(),
  /** User whose behaviour is reported (resolved server-side from the target). */
  subjectUserId: uuid().references(() => users.id),
  reasonCode: text().notNull().default('other'),
  reason: text().notNull(),
  evidenceRef: text(),
  status: text().notNull().default('open'),
  decision: text(),
  resolvedBy: uuid().references(() => users.id),
  resolution: text(),
  createdAt: createdAt(),
  resolvedAt: tsz()
}, (t) => [
  index('reports_status_idx').on(t.status, t.createdAt),
  oneOf('reports_reason_chk', t.reasonCode, ['abuse', 'spam', 'cheating', 'inappropriate_name', 'other']),
  oneOf('reports_target_chk', t.targetType, ['user', 'display_name', 'bio', 'message', 'table']),
  oneOf('reports_status_chk', t.status, ['open', 'resolved', 'dismissed'])
]);

// ============ Catalog ============
export const games = pgTable('games', {
  id: text().primaryKey(),
  nameFa: text().notNull(),
  nameOriginal: text().notNull(),
  /** normalizeSearch(nameFa + nameOriginal); maintained by the seed/admin writer. */
  searchText: text().notNull(),
  summaryFa: text().notNull(),
  rulesFa: jsonb().$type<string[]>().notNull(),
  minPlayers: integer().notNull(),
  maxPlayers: integer().notNull(),
  minMinutes: integer().notNull(),
  maxMinutes: integer().notNull(),
  difficulty: text().$type<'easy' | 'medium' | 'hard'>().notNull(),
  access: text().$type<'free' | 'premium'>().notNull(),
  paces: text().array().$type<('live' | 'turn')[]>().notNull(),
  competitions: text().array().$type<('friendly' | 'ranked')[]>().notNull(),
  /** Catalog tags from the module (GAME_TAG_FA keys); refreshed by the seed. */
  tags: text().array().notNull().default(sql`'{}'::text[]`),
  isTestGame: boolean().notNull(),
  status: text().$type<'draft' | 'active' | 'suspended'>().notNull().default('draft'),
  timeoutPolicyFa: text().notNull(),
  resignPolicyFa: text().notNull(),
  tutorialFa: text().notNull(),
  /** Admin product control: hide/stop the interactive tutorial without touching history. */
  tutorialEnabled: boolean().notNull().default(true),
  /** Premium games only: a premium host's invitees may join (and play) without their own subscription. */
  premiumHostInvitesFree: boolean().notNull().default(true),
  /** Admin choices within the module's bounds: offered time budgets and rule-variant policy (see @bg/play game-settings). */
  playSettings: jsonb().$type<{
    liveSeconds?: number[];
    turnSeconds?: number[];
    options?: Record<string, { allowed: (string | number | boolean)[]; default: string | number | boolean; hostChooses: boolean }>;
  }>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: createdAt()
}, (t) => [
  check('games_players_chk', sql`${t.minPlayers} >= 1 and ${t.minPlayers} <= ${t.maxPlayers}`),
  check('games_minutes_chk', sql`${t.minMinutes} >= 1 and ${t.minMinutes} <= ${t.maxMinutes}`),
  oneOf('games_difficulty_chk', t.difficulty, ['easy', 'medium', 'hard']),
  oneOf('games_access_chk', t.access, ['free', 'premium']),
  oneOf('games_status_chk', t.status, ['draft', 'active', 'suspended'])
]);

export const gameVersions = pgTable('game_versions', {
  id: id(),
  gameId: text().notNull().references(() => games.id),
  rulesVersion: text().notNull(),
  stateSchemaVersion: integer().notNull(),
  clientBundleRef: text().notNull(),
  assetsRef: text().notNull(),
  manifest: jsonb().notNull(),
  status: text().$type<'active' | 'retired' | 'disabled'>().notNull(),
  publishedAt: createdAt()
}, (t) => [
  unique('game_versions_game_rules_uq').on(t.gameId, t.rulesVersion),
  oneOf('game_versions_status_chk', t.status, ['active', 'retired', 'disabled'])
]);

export const tutorials = pgTable('tutorials', {
  id: id(),
  gameId: text().notNull().references(() => games.id),
  version: integer().notNull(),
  titleFa: text().notNull(),
  content: jsonb().notNull(),
  createdAt: createdAt()
}, (t) => [unique('tutorials_game_version_uq').on(t.gameId, t.version)]);

export const assetBundles = pgTable('asset_bundles', {
  id: id(),
  gameId: text().notNull().references(() => games.id),
  ref: text().notNull().unique(),
  storageKey: text().notNull(),
  createdAt: createdAt()
});

// ============ Game sessions (logic: DRAGON-01/02) ============
export const gameTables = pgTable('game_tables', {
  id: id(),
  gameId: text().notNull().references(() => games.id),
  gameVersionId: uuid().notNull().references(() => gameVersions.id),
  pace: text().notNull(),
  competition: text().notNull(),
  visibility: text().notNull(),
  status: text().notNull(),
  hostId: uuid().notNull().references(() => users.id),
  capacity: integer().notNull(),
  /** Time and reminder settings chosen at creation; immutable after start (TableSettings in contracts). */
  settings: jsonb().notNull().default({}),
  /** Private-table invite token; returned only to participants. */
  inviteCode: text().unique(),
  isTutorial: boolean().notNull().default(false),
  /** Created by the matchmaker; seats must accept (ready) before the ready deadline. */
  isMatchmade: boolean().notNull().default(false),
  /** Learner progress through the module's tutorial script (tutorial tables only). */
  tutorialStep: integer().notNull().default(0),
  revision: integer().notNull().default(0),
  /** Chess-clock tables only: each seat's remaining time (ms) as of `since` (epoch ms), and whose clock runs. */
  clock: jsonb().$type<{ left: number[]; since: number; seat: number | null }>(),
  createdAt: createdAt(),
  startedAt: tsz(),
  finishedAt: tsz()
}, (t) => [
  index('game_tables_status_idx').on(t.status, t.gameId),
  check('game_tables_capacity_chk', sql`${t.capacity} between 1 and 16`),
  oneOf('game_tables_pace_chk', t.pace, ['live', 'turn']),
  oneOf('game_tables_competition_chk', t.competition, ['friendly', 'ranked']),
  oneOf('game_tables_visibility_chk', t.visibility, ['public', 'private']),
  oneOf('game_tables_status_chk', t.status, ['open', 'active', 'paused', 'finished', 'cancelled'])
]);

/** A seat at a table. `kind = 'script'` is the fixed tutorial opponent (no user, not an AI). */
export const participants = pgTable('participants', {
  tableId: uuid().notNull().references(() => gameTables.id, { onDelete: 'cascade' }),
  seat: integer().notNull(),
  userId: uuid().references(() => users.id),
  kind: text().notNull().default('human'),
  ready: boolean().notNull().default(false),
  joinedAt: createdAt(),
  leftAt: tsz()
}, (t) => [
  primaryKey({ columns: [t.tableId, t.seat] }),
  unique('participants_table_user_uq').on(t.tableId, t.userId),
  index('participants_user_idx').on(t.userId),
  oneOf('participants_kind_chk', t.kind, ['human', 'script', 'bot']),
  check('participants_user_chk', sql`(${t.kind} = 'human') = (${t.userId} is not null)`)
]);

export const matchmakingTickets = pgTable('matchmaking_tickets', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  gameId: text().notNull().references(() => games.id),
  pace: text().notNull(),
  competition: text().notNull(),
  playerCount: integer().notNull(),
  turnSeconds: integer().notNull(),
  /** Skill estimate used for matching; documented baseline until ratings exist (DRAGON-03). */
  rating: doublePrecision().notNull(),
  status: text().notNull(),
  matchedTableId: uuid().references(() => gameTables.id),
  /** Original queue time; kept when re-queued after someone else failed to accept. */
  createdAt: createdAt(),
  updatedAt: createdAt(),
  expiresAt: tsz().notNull()
}, (t) => [
  index('matchmaking_queue_idx').on(t.gameId, t.pace, t.competition, t.playerCount, t.turnSeconds, t.status),
  // One active ticket per user: a player can never be matched into two tables at once.
  uniqueIndex('matchmaking_one_active_uq').on(t.userId).where(sql`status in ('queued', 'matched')`),
  oneOf('matchmaking_status_chk', t.status, ['queued', 'matched', 'started', 'cancelled', 'expired'])
]);

export const gameSnapshots = pgTable('game_snapshots', {
  tableId: uuid().notNull().references(() => gameTables.id, { onDelete: 'cascade' }),
  revision: integer().notNull(),
  state: jsonb().notNull(),
  /** Engine RNG state after this revision. Server-only, never projected. */
  rng: jsonb().notNull(),
  rulesVersion: text().notNull(),
  stateSchemaVersion: integer().notNull(),
  createdAt: createdAt()
}, (t) => [primaryKey({ columns: [t.tableId, t.revision] })]);

export const commandReceipts = pgTable('command_receipts', {
  id: id(),
  tableId: uuid().notNull().references(() => gameTables.id, { onDelete: 'cascade' }),
  actorId: uuid().notNull().references(() => users.id),
  commandId: uuid().notNull(),
  payloadHash: text().notNull(),
  status: text().notNull(),
  revision: integer().notNull(),
  errorCode: text(),
  createdAt: createdAt()
}, (t) => [
  unique('command_receipts_table_actor_command_uq').on(t.tableId, t.actorId, t.commandId),
  oneOf('command_receipts_status_chk', t.status, ['accepted', 'rejected'])
]);

/** Internal events may contain hidden information; never sent to clients or analytics. */
export const gameEvents = pgTable('game_events', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  tableId: uuid().notNull().references(() => gameTables.id, { onDelete: 'cascade' }),
  revision: integer().notNull(),
  seq: integer().notNull(),
  type: text().notNull(),
  payload: jsonb().notNull(),
  createdAt: createdAt()
}, (t) => [unique('game_events_table_rev_seq_uq').on(t.tableId, t.revision, t.seq)]);

export const scheduledDeadlines = pgTable('scheduled_deadlines', {
  id: id(),
  tableId: uuid().notNull().references(() => gameTables.id, { onDelete: 'cascade' }),
  deadlineKey: text().notNull(),
  token: uuid().notNull(),
  expectedRevision: integer().notNull(),
  dueAt: tsz().notNull(),
  status: text().notNull().default('pending'),
  lockedUntil: tsz(),
  attempts: integer().notNull().default(0),
  createdAt: createdAt()
}, (t) => [
  index('scheduled_deadlines_due_idx').on(t.status, t.dueAt),
  uniqueIndex('scheduled_deadlines_one_pending_uq').on(t.tableId, t.deadlineKey).where(sql`status = 'pending'`),
  oneOf('scheduled_deadlines_key_chk', t.deadlineKey, ['turn', 'reminder', 'ready', 'bot']),
  oneOf('scheduled_deadlines_status_chk', t.status, ['pending', 'fired', 'cancelled'])
]);

export const gameResults = pgTable('game_results', {
  id: id(),
  tableId: uuid().notNull().unique().references(() => gameTables.id),
  outcome: jsonb().notNull(),
  reason: text().notNull(),
  createdAt: createdAt()
});

// ============ Progression (logic: DRAGON-03) ============
export const ratings = pgTable('ratings', {
  userId: uuid().notNull().references(() => users.id),
  gameId: text().notNull().references(() => games.id),
  mode: text().notNull(),
  mu: doublePrecision().notNull(),
  sigma: doublePrecision().notNull(),
  gamesPlayed: integer().notNull().default(0),
  lastPlayedAt: tsz(),
  updatedAt: createdAt()
}, (t) => [primaryKey({ columns: [t.userId, t.gameId, t.mode] }), index('ratings_board_idx').on(t.gameId, t.mode)]);

export const ratingHistory = pgTable('rating_history', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  gameId: text().notNull().references(() => games.id),
  mode: text().notNull(),
  resultId: uuid().notNull().references(() => gameResults.id),
  muBefore: doublePrecision().notNull(),
  sigmaBefore: doublePrecision().notNull(),
  muAfter: doublePrecision().notNull(),
  sigmaAfter: doublePrecision().notNull(),
  place: integer().notNull(),
  fieldSize: integer().notNull(),
  seasonId: uuid().references(() => seasons.id),
  createdAt: createdAt()
}, (t) => [
  unique('rating_history_result_user_mode_uq').on(t.resultId, t.userId, t.mode),
  index('rating_history_user_idx').on(t.userId, t.gameId, t.mode, t.createdAt)
]);

export const seasons = pgTable('seasons', {
  id: id(),
  gameId: text().references(() => games.id),
  nameFa: text().notNull(),
  startsAt: tsz().notNull(),
  endsAt: tsz().notNull(),
  status: text().notNull(),
  config: jsonb().notNull().default({}),
  closedAt: tsz(),
  closedBy: uuid()
}, (t) => [
  oneOf('seasons_status_chk', t.status, ['scheduled', 'active', 'closed']),
  check('seasons_dates_chk', sql`${t.startsAt} < ${t.endsAt}`),
  // At most one active season at a time (seasons are platform-wide in this delivery).
  uniqueIndex('seasons_one_active_uq').on(sql`(true)`).where(sql`status = 'active'`)
]);

export const leaguePlacements = pgTable('league_placements', {
  seasonId: uuid().notNull().references(() => seasons.id),
  userId: uuid().notNull().references(() => users.id),
  gameId: text().notNull().references(() => games.id),
  mode: text().notNull(),
  league: text().notNull(),
  /** Display rating at the time of the last placement update. */
  rating: integer().notNull().default(0),
  rankedGames: integer().notNull().default(0),
  correctedBy: uuid().references(() => users.id),
  correctionReason: text(),
  updatedAt: createdAt()
}, (t) => [
  primaryKey({ columns: [t.seasonId, t.userId, t.gameId, t.mode] }),
  oneOf('league_placements_league_chk', t.league, ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'])
]);

export const missionDefinitions = pgTable('mission_definitions', {
  id: id(),
  key: text().notNull(),
  ruleVersion: integer().notNull(),
  titleFa: text().notNull(),
  descriptionFa: text().notNull(),
  criteria: jsonb().notNull(),
  period: text().notNull(),
  active: boolean().notNull().default(false)
}, (t) => [unique('mission_definitions_key_version_uq').on(t.key, t.ruleVersion)]);

export const missionProgress = pgTable('mission_progress', {
  userId: uuid().notNull().references(() => users.id),
  missionId: uuid().notNull().references(() => missionDefinitions.id),
  periodKey: text().notNull(),
  progress: integer().notNull().default(0),
  completedAt: tsz()
}, (t) => [primaryKey({ columns: [t.userId, t.missionId, t.periodKey] })]);

export const achievementDefinitions = pgTable('achievement_definitions', {
  id: id(),
  key: text().notNull(),
  ruleVersion: integer().notNull(),
  titleFa: text().notNull(),
  descriptionFa: text().notNull(),
  criteria: jsonb().notNull()
}, (t) => [unique('achievement_definitions_key_version_uq').on(t.key, t.ruleVersion)]);

export const userAchievements = pgTable('user_achievements', {
  userId: uuid().notNull().references(() => users.id),
  achievementId: uuid().notNull().references(() => achievementDefinitions.id),
  grantedAt: createdAt(),
  showOnProfile: boolean().notNull().default(true)
}, (t) => [primaryKey({ columns: [t.userId, t.achievementId] })]);

export const rewardLedger = pgTable('reward_ledger', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  resultId: uuid().references(() => gameResults.id),
  ruleId: text().notNull(),
  ruleVersion: integer().notNull(),
  kind: text().notNull(),
  amount: integer().notNull().default(0),
  reason: text().notNull(),
  /** Idempotency key: one row per (source event, rule, version, user). Retries insert nothing. */
  sourceKey: text().notNull().unique(),
  gameId: text().references(() => games.id),
  metadata: jsonb().notNull().default({}),
  createdBy: uuid().references(() => users.id),
  createdAt: createdAt()
}, (t) => [
  index('reward_ledger_user_idx').on(t.userId, t.createdAt),
  unique('reward_ledger_result_user_rule_uq').on(t.resultId, t.userId, t.ruleId, t.ruleVersion),
  oneOf('reward_ledger_kind_chk', t.kind, ['xp', 'achievement', 'mission', 'cosmetic', 'manual'])
]);

// ============ Commerce & operations (logic: DRAGON-03/04) ============
export const plans = pgTable('plans', {
  id: id(),
  key: text().notNull().unique(),
  titleFa: text().notNull(),
  period: text().notNull(),
  /** Price is a product decision; null until approved. Checkout stays disabled while null. */
  priceAmount: bigint({ mode: 'number' }),
  currency: text().notNull().default('IRR'),
  durationDays: integer().notNull(),
  termsFa: text().notNull().default(''),
  active: boolean().notNull().default(false)
}, (t) => [oneOf('plans_period_chk', t.period, ['monthly', 'yearly']), check('plans_price_chk', sql`${t.priceAmount} is null or ${t.priceAmount} > 0`)]);

export const subscriptions = pgTable('subscriptions', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  planId: uuid().notNull().references(() => plans.id),
  paymentId: uuid(),
  status: text().notNull(),
  startsAt: tsz().notNull(),
  endsAt: tsz().notNull(),
  createdAt: createdAt()
}, (t) => [
  index('subscriptions_user_idx').on(t.userId, t.endsAt),
  oneOf('subscriptions_status_chk', t.status, ['active', 'expired', 'cancelled'])
]);

export const entitlements = pgTable('entitlements', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  key: text().notNull(),
  source: text().notNull(),
  sourceId: uuid(),
  startsAt: tsz().notNull(),
  endsAt: tsz(),
  reason: text(),
  createdBy: uuid().references(() => users.id),
  revokedAt: tsz(),
  createdAt: createdAt()
}, (t) => [index('entitlements_user_key_idx').on(t.userId, t.key), oneOf('entitlements_source_chk', t.source, ['subscription', 'manual', 'coins', 'tournament'])]);

/** Coin packs sold through the payment gateway. Price is a product decision; null (not purchasable) until an admin sets it. */
export const coinPacks = pgTable('coin_packs', {
  id: id(),
  key: text().notNull().unique(),
  titleFa: text().notNull(),
  coins: integer().notNull(),
  priceAmount: bigint({ mode: 'number' }),
  currency: text().notNull().default('IRR'),
  active: boolean().notNull().default(false)
}, (t) => [check('coin_packs_coins_chk', sql`${t.coins} > 0`), check('coin_packs_price_chk', sql`${t.priceAmount} is null or ${t.priceAmount} > 0`)]);

/**
 * Coin wallet, append-only. Balance = sum(amount). Earned rows are derived from reward_ledger rows (one per source key),
 * purchases from verified payments; spends are negative and taken under a per-user lock after a balance check.
 */
export const coinLedger = pgTable('coin_ledger', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  amount: integer().notNull(),
  ruleId: text().notNull(),
  reason: text().notNull(),
  /** Idempotency key: retries and redeliveries insert nothing. */
  sourceKey: text().notNull().unique(),
  resultId: uuid().references(() => gameResults.id),
  metadata: jsonb().notNull().default({}),
  createdAt: createdAt()
}, (t) => [index('coin_ledger_user_idx').on(t.userId, t.createdAt), check('coin_ledger_amount_chk', sql`${t.amount} <> 0`)]);

/** Cosmetics bought with coins. Earned items (level, achievement, league) are checked live and have no row. */
export const userCosmetics = pgTable('user_cosmetics', {
  userId: uuid().notNull().references(() => users.id),
  itemKey: text().notNull(),
  /** The coin_ledger debit that paid for it. */
  ledgerId: uuid().notNull().references(() => coinLedger.id),
  acquiredAt: createdAt()
}, (t) => [primaryKey({ columns: [t.userId, t.itemKey] })]);

export const payments = pgTable('payments', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  /** Exactly one product: a subscription plan, a coin pack or a tournament entry. */
  planId: uuid().references(() => plans.id),
  coinPackId: uuid().references(() => coinPacks.id),
  tournamentId: uuid().references((): AnyPgColumn => tournaments.id),
  orderId: text().notNull().unique(),
  provider: text().notNull(),
  amount: bigint({ mode: 'number' }).notNull(),
  currency: text().notNull(),
  status: text().notNull(),
  /** Gateway token for this attempt; callbacks are matched by (provider, authority). */
  authority: text(),
  providerRef: text(),
  failureReason: text(),
  expiresAt: tsz().notNull(),
  createdAt: createdAt(),
  updatedAt: createdAt(),
  verifiedAt: tsz()
}, (t) => [
  uniqueIndex('payments_provider_ref_uq').on(t.provider, t.providerRef),
  uniqueIndex('payments_provider_authority_uq').on(t.provider, t.authority),
  index('payments_user_idx').on(t.userId, t.createdAt),
  check('payments_amount_chk', sql`${t.amount} > 0`),
  check('payments_product_chk', sql`(${t.planId} is not null)::int + (${t.coinPackId} is not null)::int + (${t.tournamentId} is not null)::int = 1`),
  oneOf('payments_status_chk', t.status, ['pending', 'verified', 'failed', 'expired'])
]);

// ============ Tournaments (admin-run; prizes are fixed by the admin and never paid from entry fees) ============
export type TournamentPrize = { place: number; coins: number; premiumDays: number };

export const tournaments = pgTable('tournaments', {
  id: id(),
  gameId: text().notNull().references(() => games.id),
  titleFa: text().notNull(),
  descriptionFa: text().notNull().default(''),
  format: text().$type<'swiss' | 'knockout'>().notNull(),
  pace: text().$type<'live' | 'turn'>().notNull(),
  turnSeconds: integer().notNull(),
  /** Players per table (within the game's bounds); leftovers sit at a smaller table or get a bye. */
  tableSize: integer().notNull(),
  /** Swiss: number of rounds. */
  rounds: integer(),
  /** Knockout: how many of each table go through. */
  advance: integer().notNull().default(1),
  minEntrants: integer().notNull(),
  maxEntrants: integer().notNull(),
  startsAt: tsz().notNull(),
  /** Seconds a player has to come to the table before a bot (or a forfeit) takes the seat. */
  arrivalSeconds: integer().notNull().default(180),
  entryKind: text().$type<'free' | 'coins' | 'toman'>().notNull(),
  /** Coins, or Rial for a Toman entry. 0 when free. */
  entryAmount: bigint({ mode: 'number' }).notNull().default(0),
  prizes: jsonb().$type<TournamentPrize[]>().notNull().default([]),
  status: text().$type<'open' | 'running' | 'finished' | 'cancelled'>().notNull().default('open'),
  currentRound: integer().notNull().default(0),
  cancelReason: text(),
  createdBy: uuid().notNull().references(() => users.id),
  createdAt: createdAt(),
  finishedAt: tsz()
}, (t) => [
  index('tournaments_status_idx').on(t.status, t.startsAt),
  oneOf('tournaments_format_chk', t.format, ['swiss', 'knockout']),
  oneOf('tournaments_pace_chk', t.pace, ['live', 'turn']),
  oneOf('tournaments_entry_chk', t.entryKind, ['free', 'coins', 'toman']),
  oneOf('tournaments_status_chk', t.status, ['open', 'running', 'finished', 'cancelled']),
  check('tournaments_entrants_chk', sql`${t.minEntrants} >= 2 and ${t.minEntrants} <= ${t.maxEntrants}`),
  check('tournaments_fee_chk', sql`(${t.entryKind} = 'free') = (${t.entryAmount} = 0) and ${t.entryAmount} >= 0`)
]);

export const tournamentEntries = pgTable('tournament_entries', {
  tournamentId: uuid().notNull().references(() => tournaments.id),
  userId: uuid().notNull().references(() => users.id),
  status: text().$type<'registered' | 'withdrawn'>().notNull().default('registered'),
  points: doublePrecision().notNull().default(0),
  /** Tie-break: tables won outright. */
  wins: integer().notNull().default(0),
  byes: integer().notNull().default(0),
  noShows: integer().notNull().default(0),
  eliminatedRound: integer(),
  finalRank: integer(),
  /** What paid the entry: the coin debit or the verified payment (null when free). */
  coinLedgerId: uuid().references(() => coinLedger.id),
  paymentId: uuid().references(() => payments.id),
  createdAt: createdAt()
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.userId] }),
  index('tournament_entries_user_idx').on(t.userId),
  oneOf('tournament_entries_status_chk', t.status, ['registered', 'withdrawn'])
]);

export const tournamentTables = pgTable('tournament_tables', {
  tableId: uuid().primaryKey().references(() => gameTables.id),
  tournamentId: uuid().notNull().references(() => tournaments.id),
  round: integer().notNull(),
  /** Seat → player as seated at the start of the round (bots that later take a seat do not change it). */
  seats: jsonb().$type<{ seat: number; userId: string }[]>().notNull(),
  /** Players a bot replaced or who forfeited: they score 0 for this table. */
  absent: jsonb().$type<string[]>().notNull().default([]),
  /** Final place per player, written once when the table is scored. */
  placements: jsonb().$type<{ userId: string; place: number }[]>(),
  scoredAt: tsz()
}, (t) => [index('tournament_tables_round_idx').on(t.tournamentId, t.round)]);

/** Toman entry fees to give back (cancelled tournament, withdrawal, seat gone). Paid by an admin outside the system. */
export const tournamentRefunds = pgTable('tournament_refunds', {
  id: id(),
  tournamentId: uuid().notNull().references(() => tournaments.id),
  userId: uuid().notNull().references(() => users.id),
  paymentId: uuid().notNull().unique().references(() => payments.id),
  amount: bigint({ mode: 'number' }).notNull(),
  reason: text().notNull(),
  status: text().$type<'pending' | 'paid'>().notNull().default('pending'),
  paidBy: uuid().references(() => users.id),
  paidAt: tsz(),
  note: text(),
  createdAt: createdAt()
}, (t) => [index('tournament_refunds_status_idx').on(t.status, t.createdAt), oneOf('tournament_refunds_status_chk', t.status, ['pending', 'paid'])]);

/** Every callback/verification attempt, for reconciliation and dispute evidence (no card data is ever received). */
export const paymentEvents = pgTable('payment_events', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  paymentId: uuid().references(() => payments.id),
  provider: text().notNull(),
  authority: text(),
  kind: text().notNull(),
  outcome: text().notNull(),
  detail: jsonb().notNull().default({}),
  createdAt: createdAt()
}, (t) => [index('payment_events_payment_idx').on(t.paymentId)]);

/** Development-only fake gateway state. The API refuses to use it in production. */
export const fakeGatewayTransactions = pgTable('fake_gateway_transactions', {
  authority: text().primaryKey(),
  amount: bigint({ mode: 'number' }).notNull(),
  decision: text().notNull().default('pending'),
  paidAmount: bigint({ mode: 'number' }),
  refId: text(),
  createdAt: createdAt()
}, (t) => [oneOf('fake_gateway_decision_chk', t.decision, ['pending', 'paid', 'failed', 'delayed', 'wrong_amount'])]);

export const notifications = pgTable('notifications', {
  id: id(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text().notNull(),
  payload: jsonb().notNull(),
  /** Idempotency key for outbox consumers (duplicate delivery creates nothing new). */
  dedupeKey: text().notNull().unique(),
  createdAt: createdAt(),
  readAt: tsz()
}, (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)]);

export const outboxEvents = pgTable('outbox_events', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  topic: text().notNull(),
  aggregateId: text().notNull(),
  payload: jsonb().notNull(),
  createdAt: createdAt(),
  availableAt: createdAt(),
  claimedUntil: tsz(),
  attempts: integer().notNull().default(0),
  processedAt: tsz()
}, (t) => [index('outbox_pending_idx').on(t.processedAt, t.availableAt)]);

export const auditLog = pgTable('audit_log', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  actorId: uuid().references(() => users.id),
  action: text().notNull(),
  targetType: text().notNull(),
  targetId: text().notNull(),
  metadata: jsonb().notNull().default({}),
  requestId: text(),
  createdAt: createdAt()
}, (t) => [index('audit_log_target_idx').on(t.targetType, t.targetId)]);

export const tutorialProgress = pgTable('tutorial_progress', {
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameId: text().notNull().references(() => games.id),
  status: text().notNull(),
  tableId: uuid().references(() => gameTables.id, { onDelete: 'set null' }),
  updatedAt: createdAt(),
  completedAt: tsz()
}, (t) => [
  primaryKey({ columns: [t.userId, t.gameId] }),
  oneOf('tutorial_progress_status_chk', t.status, ['in_progress', 'completed', 'skipped'])
]);

/** Site onboarding (contracts/onboarding.ts): finished step keys and «رد کردن» per guide. Completion is derived from the registry. */
export const onboardingProgress = pgTable('onboarding_progress', {
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  tourKey: text().notNull(),
  steps: text().array().notNull().default(sql`'{}'::text[]`),
  dismissed: boolean().notNull().default(false),
  updatedAt: createdAt()
}, (t) => [primaryKey({ columns: [t.userId, t.tourKey] })]);

/** Platform-wide incident: turn deadlines are frozen while open and extended by its duration when closed. */
export const platformIncidents = pgTable('platform_incidents', {
  id: id(),
  reasonFa: text().notNull(),
  startedBy: uuid().references(() => users.id),
  startedAt: createdAt(),
  endedAt: tsz()
}, () => [uniqueIndex('platform_incidents_one_open_uq').on(sql`(true)`).where(sql`ended_at is null`)]);

/** Admin-editable site switches, one JSON value per key (e.g. the launch premium gift). Missing key = feature off. */
export const appSettings = pgTable('app_settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedBy: uuid().references(() => users.id),
  updatedAt: createdAt()
});

/** Who invited whom: one row per invited account, written once at sign-up. `rewards` = what each side got. */
export const referrals = pgTable('referrals', {
  referredId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  referrerId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  rewards: jsonb().notNull().default({}),
  createdAt: createdAt()
}, (t) => [index('referrals_referrer_idx').on(t.referrerId, t.createdAt)]);

// ============ Social & moderation (DRAGON-02) ============

/** Private per-user settings: who may start a DM, and which in-app notifications to create. */
export const userSettings = pgTable('user_settings', {
  userId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  dmPolicy: text().notNull().default('friends'),
  notify: jsonb().$type<{ turn: boolean; invite: boolean; message: boolean; result: boolean; social: boolean }>().notNull()
    .default({ turn: true, invite: true, message: true, result: true, social: true }),
  /** Turn-alert preferences (contracts alertPrefs); null = defaults. */
  alerts: jsonb(),
  /** What the public profile card shows to others (contracts profilePrivacy). */
  profilePrivacy: jsonb().$type<{ showStats: boolean; showRatings: boolean; showRecent: boolean }>().notNull()
    .default({ showStats: true, showRatings: true, showRecent: true }),
  updatedAt: createdAt()
}, (t) => [oneOf('user_settings_dm_chk', t.dmPolicy, ['friends', 'nobody'])]);

/** Mute hides another user's messages and notifications for the muter; it does not block contact. */
export const userMutes = pgTable('user_mutes', {
  muterId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  mutedId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: createdAt()
}, (t) => [primaryKey({ columns: [t.muterId, t.mutedId] })]);

/** Live spectators: one row per watching socket, refreshed by the socket heartbeat; stale rows (> 150 s) do not count. */
export const tableWatchers = pgTable('table_watchers', {
  tableId: uuid().notNull().references(() => gameTables.id, { onDelete: 'cascade' }),
  socketId: text().notNull(),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  seenAt: createdAt()
}, (t) => [primaryKey({ columns: [t.tableId, t.socketId] })]);

/** A personal invitation to a (possibly private) table; grants lobby access without the invite link. */
export const tableInvites = pgTable('table_invites', {
  tableId: uuid().notNull().references(() => gameTables.id, { onDelete: 'cascade' }),
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedBy: uuid().notNull().references(() => users.id),
  createdAt: createdAt()
}, (t) => [primaryKey({ columns: [t.tableId, t.userId] })]);

/** Server-enforced sanctions. Suspension blocks the account; chat_restricted blocks sending messages. */
export const userSanctions = pgTable('user_sanctions', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  kind: text().notNull(),
  reason: text().notNull(),
  reportId: uuid().references(() => reports.id),
  createdBy: uuid().notNull().references(() => users.id),
  startsAt: createdAt(),
  endsAt: tsz(),
  revokedAt: tsz(),
  revokedBy: uuid().references(() => users.id)
}, (t) => [
  index('user_sanctions_user_idx').on(t.userId, t.kind),
  oneOf('user_sanctions_kind_chk', t.kind, ['suspended', 'chat_restricted', 'warning'])
]);

export const appeals = pgTable('appeals', {
  id: id(),
  sanctionId: uuid().notNull().unique().references(() => userSanctions.id),
  userId: uuid().notNull().references(() => users.id),
  text: text().notNull(),
  status: text().notNull().default('open'),
  decidedBy: uuid().references(() => users.id),
  decisionNote: text(),
  createdAt: createdAt(),
  decidedAt: tsz()
}, (t) => [oneOf('appeals_status_chk', t.status, ['open', 'upheld', 'revoked'])]);

/** Behaviour signals for moderators (e.g. repeated timeouts). Never an automatic penalty. */
export const behaviorSignals = pgTable('behavior_signals', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  tableId: uuid().notNull().references(() => gameTables.id),
  kind: text().notNull(),
  createdAt: createdAt()
}, (t) => [
  unique('behavior_signals_once_uq').on(t.tableId, t.userId, t.kind),
  index('behavior_signals_user_idx').on(t.userId, t.createdAt),
  oneOf('behavior_signals_kind_chk', t.kind, ['timeout_loss', 'resigned', 'ready_no_show'])
]);
