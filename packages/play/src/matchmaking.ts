// Persistent matchmaking (FR-06). Tickets live in PostgreSQL; matching runs under a per-queue advisory lock and
// SKIP LOCKED row locks, so concurrent matchers and cancellations never double-assign a player.
import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import { AppError, TIME_OPTIONS, type EnqueueBody, type TicketView } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { GameRegistry } from '@bg/game-engine';
import { activeVersion, assertLimits, type PlayConfig } from './tables.ts';
import { isPremium } from './billing.ts';
import { matchRating } from './rating.ts';
import type { Tx } from './runtime.ts';

const { matchmakingTickets: tickets, gameTables, participants, scheduledDeadlines, outboxEvents, ratings, games, blocks, behaviorSignals } = schema;

export interface MatchConfig {
  /** Rating used while a player has no rating for the game/mode (documented baseline until DRAGON-03). */
  baselineRating: number;
  baseWindow: number;
  growthPerStep: number;
  /** Seconds of waiting per growth step, per pace. */
  stepSeconds: { live: number; turn: number };
  maxWindow: number;
  /** Seconds each matched player has to accept («آماده‌ام»). */
  readySeconds: { live: number; turn: number };
  /** Queue time before a ticket expires. */
  ticketTtlSeconds: { live: number; turn: number };
}

export const defaultMatchConfig: MatchConfig = {
  baselineRating: 1500, baseWindow: 100, growthPerStep: 50, stepSeconds: { live: 10, turn: 60 }, maxWindow: 400,
  readySeconds: { live: 30, turn: 15 * 60 }, ticketTtlSeconds: { live: 15 * 60, turn: 24 * 3600 }
};

type Ticket = typeof tickets.$inferSelect;

export function windowFor(cfg: MatchConfig, pace: 'live' | 'turn', waitSeconds: number): number {
  return Math.min(cfg.maxWindow, cfg.baseWindow + cfg.growthPerStep * Math.floor(Math.max(0, waitSeconds) / cfg.stepSeconds[pace]));
}

export async function enqueue(db: Db, registry: GameRegistry, play: PlayConfig, cfg: MatchConfig, userId: string, body: EnqueueBody): Promise<string> {
  const id = await db.transaction(async (tx) => {
    const { game } = await activeVersion(tx, registry, body.gameId);
    if (!game.paces.includes(body.pace)) throw new AppError('MODE_NOT_SUPPORTED');
    // Premium decides access to a premium game only — never queue priority or rating (no pay-to-win).
    if (game.access === 'premium' && !(await isPremium(tx, userId))) throw new AppError('PREMIUM_REQUIRED');
    if (!game.competitions.includes(body.competition)) throw new AppError('MODE_NOT_SUPPORTED');
    if (body.playerCount < game.minPlayers || body.playerCount > game.maxPlayers) throw new AppError('VALIDATION_FAILED');
    if (!(TIME_OPTIONS[body.pace] as readonly number[]).includes(body.turnSeconds)) throw new AppError('INVALID_TIME_SETTING');
    await assertLimits(tx, userId, body.pace, play, { forQueue: true }); // also refuses a second active ticket
    const [r] = await tx.select({ mu: ratings.mu, sigma: ratings.sigma }).from(ratings)
      .where(and(eq(ratings.userId, userId), eq(ratings.gameId, game.id), eq(ratings.mode, body.pace)));
    const [t] = await tx.insert(tickets).values({
      userId, gameId: game.id, pace: body.pace, competition: body.competition, playerCount: body.playerCount, turnSeconds: body.turnSeconds,
      rating: r ? matchRating(r) : cfg.baselineRating, status: 'queued',
      expiresAt: sql`now() + make_interval(secs => ${cfg.ticketTtlSeconds[body.pace]})`
    }).returning({ id: tickets.id });
    return t!.id;
  });
  await runMatcher(db, cfg, { gameId: body.gameId, pace: body.pace, competition: body.competition, playerCount: body.playerCount, turnSeconds: body.turnSeconds });
  return id;
}

export interface QueueKey { gameId: string; pace: 'live' | 'turn'; competition: 'friendly' | 'ranked'; playerCount: number; turnSeconds: number }

async function blockedPairs(tx: Tx, userIds: string[]): Promise<Set<string>> {
  if (userIds.length < 2) return new Set();
  const rows = await tx.select().from(blocks).where(and(inArray(blocks.blockerId, userIds), inArray(blocks.blockedId, userIds)));
  return new Set(rows.flatMap((b) => [`${b.blockerId}:${b.blockedId}`, `${b.blockedId}:${b.blockerId}`]));
}

/**
 * Form as many tables as possible for one queue. Oldest ticket anchors the group; its skill window grows with
 * waiting time. Players who blocked each other are never matched together. Returns created table ids.
 */
export async function runMatcher(db: Db, cfg: MatchConfig, key: QueueKey): Promise<string[]> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`mm:${key.gameId}:${key.pace}:${key.competition}:${key.playerCount}:${key.turnSeconds}`}))`);
    const queued = await tx.select().from(tickets).where(and(
      eq(tickets.status, 'queued'), eq(tickets.gameId, key.gameId), eq(tickets.pace, key.pace), eq(tickets.competition, key.competition),
      eq(tickets.playerCount, key.playerCount), eq(tickets.turnSeconds, key.turnSeconds), sql`${tickets.expiresAt} > now()`
    )).orderBy(asc(tickets.createdAt)).for('update', { skipLocked: true });
    const blocked = await blockedPairs(tx, queued.map((t) => t.userId));
    const now = Date.now();
    const pool = [...queued];
    const created: string[] = [];
    while (pool.length >= key.playerCount) {
      const anchor = pool.shift()!;
      const window = windowFor(cfg, key.pace, (now - anchor.createdAt.getTime()) / 1000);
      const group: Ticket[] = [anchor];
      for (const t of pool) {
        if (group.length === key.playerCount) break;
        if (Math.abs(t.rating - anchor.rating) > window) continue;
        if (group.some((g) => blocked.has(`${g.userId}:${t.userId}`))) continue;
        group.push(t);
      }
      if (group.length < key.playerCount) continue; // anchor waits for a wider window
      for (const g of group.slice(1)) pool.splice(pool.indexOf(g), 1);
      created.push(await createMatchTable(tx, cfg, key, group));
    }
    return created;
  });
}

async function createMatchTable(tx: Tx, cfg: MatchConfig, key: QueueKey, group: Ticket[]): Promise<string> {
  const [version] = await tx.execute(sql`
    select v.id from game_versions v join games g on g.id = v.game_id
    where v.game_id = ${key.gameId} and v.status = 'active' and g.status = 'active' order by v.published_at desc limit 1`) as unknown as { id: string }[];
  if (!version) throw new AppError('GAME_NOT_ACCEPTING_TABLES');
  const tableId = randomUUID();
  await tx.insert(gameTables).values({
    id: tableId, gameId: key.gameId, gameVersionId: version.id, pace: key.pace, competition: key.competition, visibility: 'private',
    status: 'open', hostId: group[0]!.userId, capacity: key.playerCount, isMatchmade: true,
    settings: { turnSeconds: key.turnSeconds, reminders: key.pace === 'turn' }
  });
  await tx.insert(participants).values(group.map((t, seat) => ({ tableId, seat, userId: t.userId, kind: 'human' })));
  await tx.update(tickets).set({ status: 'matched', matchedTableId: tableId, updatedAt: sql`now()` }).where(inArray(tickets.id, group.map((t) => t.id)));
  await tx.insert(scheduledDeadlines).values({
    tableId, deadlineKey: 'ready', token: randomUUID(), expectedRevision: 0,
    dueAt: sql`now() + make_interval(secs => ${cfg.readySeconds[key.pace]})`
  });
  await tx.insert(outboxEvents).values({ topic: 'match.found', aggregateId: tableId, payload: { tableId, gameId: key.gameId, userIds: group.map((t) => t.userId) } });
  await tx.execute(sql`select pg_notify('table_changed', ${tableId})`);
  return tableId;
}

/**
 * A matched table that will not start (someone declined, left, or the ready deadline passed):
 * players who accepted go back to the queue with their original queue time; the others leave the queue.
 * Must run inside the table lock.
 */
export async function failMatch(tx: Tx, tableId: string, opts: { cancelUserId?: string; reason: 'declined' | 'ready_timeout' }) {
  const seats = await tx.select().from(participants).where(eq(participants.tableId, tableId));
  // A decline puts everyone else back in the queue; a ready timeout keeps only those who accepted.
  const ready = new Set(seats.filter((s) => s.userId !== opts.cancelUserId && (opts.reason === 'declined' || s.ready)).map((s) => s.userId!));
  const matched = await tx.select().from(tickets).where(and(eq(tickets.matchedTableId, tableId), eq(tickets.status, 'matched')));
  for (const t of matched) {
    if (ready.has(t.userId)) {
      await tx.update(tickets).set({ status: 'queued', matchedTableId: null, updatedAt: sql`now()` }).where(eq(tickets.id, t.id));
    } else {
      await tx.update(tickets).set({ status: t.userId === opts.cancelUserId ? 'cancelled' : 'expired', updatedAt: sql`now()` }).where(eq(tickets.id, t.id));
      if (opts.reason === 'ready_timeout') {
        // Signal for moderators only; no automatic penalty.
        await tx.insert(behaviorSignals).values({ userId: t.userId, tableId, kind: 'ready_no_show' }).onConflictDoNothing();
      }
    }
  }
  await tx.update(gameTables).set({ status: 'cancelled' }).where(eq(gameTables.id, tableId));
  await tx.update(scheduledDeadlines).set({ status: 'cancelled' })
    .where(and(eq(scheduledDeadlines.tableId, tableId), eq(scheduledDeadlines.status, 'pending')));
  await tx.execute(sql`select pg_notify('table_changed', ${tableId})`);
  return { requeued: [...ready] };
}

export async function cancelTicket(db: Db, userId: string, ticketId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(tickets).where(and(eq(tickets.id, ticketId), eq(tickets.userId, userId))).for('update');
    if (!t) throw new AppError('NOT_FOUND');
    if (t.status === 'queued') {
      await tx.update(tickets).set({ status: 'cancelled', updatedAt: sql`now()` }).where(eq(tickets.id, t.id));
      return;
    }
    if (t.status === 'matched' && t.matchedTableId) {
      const [table] = await tx.select().from(gameTables).where(eq(gameTables.id, t.matchedTableId)).for('update');
      // Re-check under the table lock: the table may have started in the meantime.
      const [fresh] = await tx.select().from(tickets).where(eq(tickets.id, t.id));
      if (table?.status === 'open' && fresh?.status === 'matched') {
        await failMatch(tx, table.id, { cancelUserId: userId, reason: 'declined' });
        return;
      }
    }
    throw new AppError('TICKET_NOT_ACTIVE');
  });
}

export async function myTickets(db: Db, cfg: MatchConfig, userId: string): Promise<TicketView[]> {
  const rows = await db.select({ t: tickets, nameFa: games.nameFa }).from(tickets).innerJoin(games, eq(games.id, tickets.gameId))
    .where(and(eq(tickets.userId, userId), sql`(${tickets.status} in ('queued','matched') or ${tickets.updatedAt} > now() - interval '2 minutes')`))
    .orderBy(sql`${tickets.updatedAt} desc`).limit(5);
  const now = Date.now();
  const out: TicketView[] = [];
  for (const { t, nameFa } of rows) {
    let readyDeadline: string | null = null;
    if (t.status === 'matched' && t.matchedTableId) {
      const [d] = await db.select({ dueAt: scheduledDeadlines.dueAt }).from(scheduledDeadlines).where(and(
        eq(scheduledDeadlines.tableId, t.matchedTableId), eq(scheduledDeadlines.deadlineKey, 'ready'), eq(scheduledDeadlines.status, 'pending')));
      readyDeadline = d?.dueAt.toISOString() ?? null;
    }
    const waitSeconds = Math.floor((now - t.createdAt.getTime()) / 1000);
    out.push({
      id: t.id, gameId: t.gameId, gameNameFa: nameFa, pace: t.pace as 'live' | 'turn', competition: t.competition as 'friendly' | 'ranked', playerCount: t.playerCount, turnSeconds: t.turnSeconds,
      status: t.status as TicketView['status'], waitSeconds, window: windowFor(cfg, t.pace as 'live' | 'turn', waitSeconds),
      matchedTableId: t.matchedTableId, readyDeadline, createdAt: t.createdAt.toISOString()
    });
  }
  return out;
}

/** Worker job: expire old tickets and run every non-empty queue. */
export async function runMatchmaking(db: Db, cfg: MatchConfig) {
  const expired = await db.update(tickets).set({ status: 'expired', updatedAt: sql`now()` })
    .where(and(eq(tickets.status, 'queued'), lte(tickets.expiresAt, sql`now()`))).returning({ id: tickets.id });
  const keys = await db.selectDistinct({ gameId: tickets.gameId, pace: tickets.pace, competition: tickets.competition, playerCount: tickets.playerCount, turnSeconds: tickets.turnSeconds })
    .from(tickets).where(eq(tickets.status, 'queued'));
  let matched = 0;
  for (const k of keys) matched += (await runMatcher(db, cfg, { ...k, pace: k.pace as 'live' | 'turn', competition: k.competition as 'friendly' | 'ranked' })).length;
  return { matched, expired: expired.length };
}
