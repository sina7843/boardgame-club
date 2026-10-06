// Table lifecycle: create, join (public / invite), leave, ready → start, and server-side tutorial tables.
import { randomBytes, randomInt } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { AppError, TIME_OPTIONS, type CreateTableBody } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { startGame, type GameRegistry } from '@bg/game-engine';
import { failMatch } from './matchmaking.ts';
import { lockTable, persistStep, type Tx } from './runtime.ts';
import { activeSuspension } from './sanctions.ts';
import { isPremium } from './billing.ts';

const { games, gameVersions, gameTables, participants, tutorialProgress, matchmakingTickets, tableInvites, blocks } = schema;

export interface PlayConfig {
  /** Max concurrent non-tutorial turn-based tables per user (configurable, not a commercial value). */
  turnTableLimit: number;
  /** Higher cap for premium players; still an operational limit, never unlimited. */
  turnTableLimitPremium: number;
}

export async function activeVersion(tx: Tx, registry: GameRegistry, gameId: string) {
  const [game] = await tx.select().from(games).where(eq(games.id, gameId));
  if (!game) throw new AppError('NOT_FOUND');
  const [version] = await tx.select().from(gameVersions)
    .where(and(eq(gameVersions.gameId, gameId), eq(gameVersions.status, 'active')))
    .orderBy(desc(gameVersions.publishedAt)).limit(1);
  // A suspended game, a game without an active version, or a version missing from the reviewed registry
  // never accepts new tables. Existing tables keep their pinned version.
  if (game.status !== 'active' || !version || !registry.has(gameId, version.rulesVersion)) throw new AppError('GAME_NOT_ACCEPTING_TABLES');
  return { game, version };
}

/** Lock the user's own membership rows so two concurrent joins cannot bypass the limits. */
export async function assertLimits(tx: Tx, userId: string, pace: 'live' | 'turn', cfg: PlayConfig, opts: { forQueue?: boolean } = {}) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'tables:' + userId}))`);
  // A queued/matched ticket may become a table at any moment: never allow a second one, and never a second live game.
  const active = await tx.select({ pace: matchmakingTickets.pace }).from(matchmakingTickets)
    .where(and(eq(matchmakingTickets.userId, userId), inArray(matchmakingTickets.status, ['queued', 'matched'])));
  if (opts.forQueue && active.length) throw new AppError('ALREADY_QUEUED');
  if (pace === 'live' && active.some((t) => t.pace === 'live')) throw new AppError('ALREADY_QUEUED');
  const mine = await tx.select({ pace: gameTables.pace }).from(participants)
    .innerJoin(gameTables, eq(gameTables.id, participants.tableId))
    .where(and(eq(participants.userId, userId), inArray(gameTables.status, ['open', 'active']), eq(gameTables.isTutorial, false)));
  if (pace === 'live' && mine.some((t) => t.pace === 'live')) throw new AppError('ALREADY_IN_LIVE_TABLE');
  if (pace === 'turn') {
    const limit = (await isPremium(tx, userId)) ? cfg.turnTableLimitPremium : cfg.turnTableLimit;
    if (mine.filter((t) => t.pace === 'turn').length >= limit) throw new AppError('TURN_TABLE_LIMIT');
  }
}

export async function createTable(db: Db, registry: GameRegistry, cfg: PlayConfig, userId: string, body: CreateTableBody): Promise<string> {
  return db.transaction(async (tx) => {
    const { game, version } = await activeVersion(tx, registry, body.gameId);
    if (!game.paces.includes(body.pace)) throw new AppError('MODE_NOT_SUPPORTED');
    if (!game.competitions.includes(body.competition)) throw new AppError('MODE_NOT_SUPPORTED');
    // Ranked tables come only from ranked matchmaking (skill-based pairing, no hand-picked opponents).
    if (body.competition === 'ranked') throw new AppError('RANKED_NOT_AVAILABLE');
    // Premium games: the host needs premium to create a table (FR-15 / §13).
    if (game.access === 'premium' && !(await isPremium(tx, userId))) throw new AppError('PREMIUM_REQUIRED');
    if (body.capacity < game.minPlayers || body.capacity > game.maxPlayers) throw new AppError('VALIDATION_FAILED');
    if (!(TIME_OPTIONS[body.pace] as readonly number[]).includes(body.turnSeconds)) throw new AppError('INVALID_TIME_SETTING');
    await assertLimits(tx, userId, body.pace, cfg);
    const [t] = await tx.insert(gameTables).values({
      gameId: game.id, gameVersionId: version.id, pace: body.pace, competition: body.competition,
      visibility: body.visibility, status: 'open', hostId: userId, capacity: body.capacity,
      settings: { turnSeconds: body.turnSeconds, reminders: body.reminders },
      inviteCode: body.visibility === 'private' ? randomBytes(12).toString('base64url') : null
    }).returning({ id: gameTables.id });
    await tx.insert(participants).values({ tableId: t!.id, seat: 0, userId, kind: 'human' });
    return t!.id;
  });
}

export async function joinTable(db: Db, registry: GameRegistry, cfg: PlayConfig, userId: string, tableId: string, inviteCode?: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { table } = await lockTable(tx, registry, tableId);
    if (table.isTutorial) throw new AppError('FORBIDDEN');
    const seats = await tx.select().from(participants).where(eq(participants.tableId, table.id));
    if (seats.some((s) => s.userId === userId)) throw new AppError('ALREADY_JOINED');
    const [invited] = await tx.select().from(tableInvites).where(and(eq(tableInvites.tableId, table.id), eq(tableInvites.userId, userId)));
    if (table.visibility === 'private' && !invited && (!table.inviteCode || inviteCode !== table.inviteCode)) throw new AppError('INVITE_REQUIRED');
    const others = seats.map((s) => s.userId).filter((u): u is string => !!u);
    if (others.length && (await tx.select().from(blocks).where(sql`(${blocks.blockerId} = ${userId} and ${inArray(blocks.blockedId, others)}) or (${blocks.blockedId} = ${userId} and ${inArray(blocks.blockerId, others)})`)).length) {
      throw new AppError('BLOCKED');
    }
    if (table.status !== 'open') throw new AppError('TABLE_NOT_OPEN');
    if (seats.length >= table.capacity) throw new AppError('TABLE_FULL');
    await assertJoinAccess(tx, table, userId, !!invited || (!!inviteCode && inviteCode === table.inviteCode));
    await assertLimits(tx, userId, table.pace as 'live' | 'turn', cfg);
    const taken = new Set(seats.map((s) => s.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;
    await tx.insert(participants).values({ tableId: table.id, seat, userId, kind: 'human' });
    await tx.execute(sql`select pg_notify('table_changed', ${table.id})`);
  });
}

export async function leaveTable(db: Db, registry: GameRegistry, userId: string, tableId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const { table } = await lockTable(tx, registry, tableId);
    if (table.status !== 'open') throw new AppError('TABLE_NOT_OPEN'); // after start, leaving = resign (a game action)
    if (table.isMatchmade) {
      const [me] = await tx.select().from(participants).where(and(eq(participants.tableId, table.id), eq(participants.userId, userId)));
      if (!me) throw new AppError('NOT_PARTICIPANT');
      await failMatch(tx, table.id, { cancelUserId: userId, reason: 'declined' });
      return;
    }
    const removed = await tx.delete(participants).where(and(eq(participants.tableId, table.id), eq(participants.userId, userId))).returning();
    if (!removed.length) throw new AppError('NOT_PARTICIPANT');
    const rest = await tx.select().from(participants).where(eq(participants.tableId, table.id)).orderBy(asc(participants.joinedAt));
    if (!rest.length) await tx.update(gameTables).set({ status: 'cancelled' }).where(eq(gameTables.id, table.id));
    else if (table.hostId === userId) await tx.update(gameTables).set({ hostId: rest[0]!.userId! }).where(eq(gameTables.id, table.id));
    await tx.execute(sql`select pg_notify('table_changed', ${table.id})`);
  });
}

/** Mark ready / not ready. When every seat is filled and ready, the game starts in the same transaction. */
export async function setReady(db: Db, registry: GameRegistry, userId: string, tableId: string, ready: boolean): Promise<void> {
  await db.transaction(async (tx) => {
    const locked = await lockTable(tx, registry, tableId);
    const { table } = locked;
    if (table.status !== 'open') throw new AppError('TABLE_NOT_OPEN');
    const updated = await tx.update(participants).set({ ready })
      .where(and(eq(participants.tableId, table.id), eq(participants.userId, userId))).returning();
    if (!updated.length) throw new AppError('NOT_PARTICIPANT');
    const seats = await tx.select().from(participants).where(eq(participants.tableId, table.id));
    if (seats.length === table.capacity && seats.every((s) => s.ready)) await startTable(tx, locked);
    else await tx.execute(sql`select pg_notify('table_changed', ${table.id})`);
  });
}

async function startTable(tx: Tx, locked: Awaited<ReturnType<typeof lockTable>>, seed = randomInt(0, 2 ** 31)) {
  const { table, module } = locked;
  if (!table.isTutorial) {
    // Re-check at start: the game may have been suspended, or a player sanctioned, since the table opened.
    const [game] = await tx.select({ status: games.status }).from(games).where(eq(games.id, table.gameId));
    if (game?.status !== 'active') throw new AppError('GAME_NOT_ACCEPTING_TABLES');
    const seats = await tx.select({ userId: participants.userId }).from(participants).where(eq(participants.tableId, table.id));
    for (const s of seats) if (s.userId && await activeSuspension(tx, s.userId)) throw new AppError('ACCOUNT_SUSPENDED');
    // Snapshot access at start: later expiry of a subscription never interrupts this game.
    const eligibility = await startEligibility(tx, table, seats.map((s) => s.userId).filter((u): u is string => !!u));
    table.settings = { ...(table.settings as object), eligibility };
    await tx.update(gameTables).set({ settings: table.settings }).where(eq(gameTables.id, table.id));
    if (table.isMatchmade) {
      await tx.update(matchmakingTickets).set({ status: 'started', updatedAt: sql`now()` })
        .where(and(eq(matchmakingTickets.matchedTableId, table.id), eq(matchmakingTickets.status, 'matched')));
    }
  }
  const step = startGame(module, { playerCount: table.capacity, seed });
  await tx.update(gameTables).set({ status: 'active', startedAt: sql`now()` }).where(eq(gameTables.id, table.id));
  table.status = 'active';
  await persistStep(tx, locked, step, { kind: 'start', seed, playerCount: table.capacity });
}

// ---------- Tutorials: a private, friendly, untimed table against the module's fixed script ----------

export async function startTutorial(db: Db, registry: GameRegistry, userId: string, gameId: string, restart: boolean): Promise<string> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'tutorial:' + userId + ':' + gameId}))`);
    const { game, version } = await activeVersion(tx, registry, gameId);
    if (!game.tutorialEnabled) throw new AppError('TUTORIAL_DISABLED');
    const [progress] = await tx.select().from(tutorialProgress).where(and(eq(tutorialProgress.userId, userId), eq(tutorialProgress.gameId, gameId)));
    if (progress?.tableId) {
      const [old] = await tx.select().from(gameTables).where(eq(gameTables.id, progress.tableId));
      if (old?.status === 'active' && !restart) return old.id; // resume
      if (old?.status === 'active') await tx.update(gameTables).set({ status: 'cancelled' }).where(eq(gameTables.id, old.id));
    }
    const module = registry.resolve(gameId, version.rulesVersion);
    const [t] = await tx.insert(gameTables).values({
      gameId, gameVersionId: version.id, pace: 'turn', competition: 'friendly', visibility: 'private', status: 'open',
      hostId: userId, capacity: 2, settings: { turnSeconds: 0, reminders: false }, isTutorial: true
    }).returning();
    await tx.insert(participants).values([
      { tableId: t!.id, seat: 0, userId, kind: 'human', ready: true },
      { tableId: t!.id, seat: 1, userId: null, kind: 'script', ready: true }
    ]);
    await tx.insert(tutorialProgress).values({ userId, gameId, status: 'in_progress', tableId: t!.id })
      // Replaying a completed tutorial never erases the completion.
      .onConflictDoUpdate({ target: [tutorialProgress.userId, tutorialProgress.gameId],
        set: { status: sql`case when ${tutorialProgress.status} = 'completed' then 'completed' else 'in_progress' end`, tableId: t!.id, updatedAt: sql`now()` } });
    await startTable(tx, { table: t!, version, module }, module.tutorial.seed);
    return t!.id;
  });
}

export async function skipTutorial(db: Db, userId: string, gameId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [progress] = await tx.select().from(tutorialProgress).where(and(eq(tutorialProgress.userId, userId), eq(tutorialProgress.gameId, gameId)));
    if (progress?.tableId) {
      await tx.update(gameTables).set({ status: 'cancelled' }).where(and(eq(gameTables.id, progress.tableId), eq(gameTables.status, 'active')));
    }
    if (progress?.status === 'completed') return; // skipping again never erases a completion
    await tx.insert(tutorialProgress).values({ userId, gameId, status: 'skipped', tableId: null })
      .onConflictDoUpdate({ target: [tutorialProgress.userId, tutorialProgress.gameId], set: { status: 'skipped', tableId: null, updatedAt: sql`now()` } });
  });
}

export async function myTutorials(db: Db, userId: string) {
  return db.select({ gameId: tutorialProgress.gameId, status: tutorialProgress.status, tableId: tutorialProgress.tableId })
    .from(tutorialProgress).where(eq(tutorialProgress.userId, userId));
}


// ---------- Premium access (per game; host-invites-free policy) ----------

type TableRow = typeof gameTables.$inferSelect;
type Basis = 'free_game' | 'premium' | 'host_invite';

/** Joining a premium game's table: own premium, or invited by a premium host when the game allows it. */
async function assertJoinAccess(tx: Tx, table: TableRow, userId: string, invited: boolean) {
  const [game] = await tx.select().from(games).where(eq(games.id, table.gameId));
  if (game?.access !== 'premium' || (await isPremium(tx, userId))) return;
  if (game.premiumHostInvitesFree && invited && (await isPremium(tx, table.hostId))) return;
  throw new AppError('PREMIUM_REQUIRED');
}

async function startEligibility(tx: Tx, table: TableRow, userIds: string[]): Promise<Record<string, Basis>> {
  const [game] = await tx.select().from(games).where(eq(games.id, table.gameId));
  const out: Record<string, Basis> = {};
  if (game?.access !== 'premium') { for (const u of userIds) out[u] = 'free_game'; return out; }
  const hostPremium = await isPremium(tx, table.hostId);
  for (const u of userIds) {
    if (await isPremium(tx, u)) out[u] = 'premium';
    else if (game.premiumHostInvitesFree && hostPremium && !table.isMatchmade) out[u] = 'host_invite';
    else throw new AppError('PREMIUM_REQUIRED'); // e.g. the host's subscription ended before the game started
  }
  return out;
}
