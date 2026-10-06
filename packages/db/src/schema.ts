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
  avatarKey: text().notNull().default('meeple'),
  profileCompleted: boolean().notNull().default(false),
  status: text().notNull().default('active'),
  createdAt: createdAt(),
  updatedAt: createdAt()
}, (t) => [oneOf('users_status_chk', t.status, ['active', 'suspended'])]);

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
  lastMessageAt: tsz()
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
  deletedBy: uuid().references(() => users.id)
}, (t) => [index('messages_conversation_created_idx').on(t.conversationId, t.createdAt)]);

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
  oneOf('reports_target_chk', t.targetType, ['user', 'display_name', 'message', 'table']),
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
  oneOf('participants_kind_chk', t.kind, ['human', 'script']),
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
  oneOf('scheduled_deadlines_key_chk', t.deadlineKey, ['turn', 'reminder', 'ready']),
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
}, (t) => [index('entitlements_user_key_idx').on(t.userId, t.key), oneOf('entitlements_source_chk', t.source, ['subscription', 'manual'])]);

export const payments = pgTable('payments', {
  id: id(),
  userId: uuid().notNull().references(() => users.id),
  planId: uuid().notNull().references(() => plans.id),
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
  oneOf('payments_status_chk', t.status, ['pending', 'verified', 'failed', 'expired'])
]);

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

/** Platform-wide incident: turn deadlines are frozen while open and extended by its duration when closed. */
export const platformIncidents = pgTable('platform_incidents', {
  id: id(),
  reasonFa: text().notNull(),
  startedBy: uuid().references(() => users.id),
  startedAt: createdAt(),
  endedAt: tsz()
}, () => [uniqueIndex('platform_incidents_one_open_uq').on(sql`(true)`).where(sql`ended_at is null`)]);

// ============ Social & moderation (DRAGON-02) ============

/** Private per-user settings: who may start a DM, and which in-app notifications to create. */
export const userSettings = pgTable('user_settings', {
  userId: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  dmPolicy: text().notNull().default('friends'),
  notify: jsonb().$type<{ turn: boolean; invite: boolean; message: boolean; result: boolean; social: boolean }>().notNull()
    .default({ turn: true, invite: true, message: true, result: true, social: true }),
  updatedAt: createdAt()
}, (t) => [oneOf('user_settings_dm_chk', t.dmPolicy, ['friends', 'nobody'])]);

/** Mute hides another user's messages and notifications for the muter; it does not block contact. */
export const userMutes = pgTable('user_mutes', {
  muterId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  mutedId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: createdAt()
}, (t) => [primaryKey({ columns: [t.muterId, t.mutedId] })]);

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
