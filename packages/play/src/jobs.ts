// Durable background work, driven by the worker process. All recovery state is in PostgreSQL.
import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm';
import { AppError } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { GameRegistry } from '@bg/game-engine';
import { applyRating, rewardMatch, rewardTutorial, type FinishedEvent } from './progression.ts';
import { fireDeadline } from './runtime.ts';

const { scheduledDeadlines, outboxEvents, notifications, platformIncidents, games, auditLog, userSettings, userMutes, blocks, users, behaviorSignals } = schema;

type Kind = 'turn' | 'reminder' | 'finished' | 'invite' | 'match' | 'message' | 'friend_request' | 'club';
const PREF: Record<Kind, 'turn' | 'invite' | 'message' | 'result' | 'social'> = {
  turn: 'turn', reminder: 'turn', finished: 'result', invite: 'invite', match: 'invite', message: 'message', friend_request: 'social', club: 'social'
};

/**
 * Fire due deadlines. Deadlines are frozen while a platform incident is open. Each deadline is handled in its
 * own transaction holding the table lock, so a crash simply rolls back and the deadline is picked up again.
 */
export async function runDueDeadlines(db: Db, registry: GameRegistry, limit = 50) {
  const [incident] = await db.select({ id: platformIncidents.id }).from(platformIncidents).where(isNull(platformIncidents.endedAt)).limit(1);
  if (incident) return { fired: 0, stale: 0, frozen: true };
  const due = await db.select({ id: scheduledDeadlines.id }).from(scheduledDeadlines)
    .where(and(eq(scheduledDeadlines.status, 'pending'), lte(scheduledDeadlines.dueAt, sql`now()`)))
    .orderBy(asc(scheduledDeadlines.dueAt)).limit(limit);
  let fired = 0;
  let stale = 0;
  for (const d of due) {
    const r = await fireDeadline(db, registry, d.id);
    if (r === 'fired') fired++;
    if (r === 'stale') stale++;
  }
  return { fired, stale, frozen: false };
}

type OutboxRow = typeof outboxEvents.$inferSelect;
type Consumer = (db: Db, event: OutboxRow) => Promise<void>;

/**
 * Create in-app notifications. Respects each recipient's preferences and never notifies about an actor the
 * recipient muted or blocked (or who blocked them). The dedupe key makes redelivery a no-op.
 */
async function notify(db: Db, userIds: unknown, kind: Kind, dedupe: (u: string) => string, payload: Record<string, unknown>, actorId?: string) {
  for (const userId of (userIds as (string | null)[]).filter((u): u is string => !!u && u !== actorId)) {
    const [settings] = await db.select({ notify: userSettings.notify }).from(userSettings).where(eq(userSettings.userId, userId));
    if (settings && settings.notify[PREF[kind]] === false) continue;
    if (actorId) {
      const muted = await db.select().from(userMutes).where(and(eq(userMutes.muterId, userId), eq(userMutes.mutedId, actorId)));
      const blocked = await db.select().from(blocks).where(sql`(${blocks.blockerId} = ${userId} and ${blocks.blockedId} = ${actorId}) or (${blocks.blockerId} = ${actorId} and ${blocks.blockedId} = ${userId})`);
      if (muted.length || blocked.length) continue;
    }
    const [n] = await db.insert(notifications).values({ userId, kind, payload, dedupeKey: dedupe(userId) })
      .onConflictDoNothing({ target: notifications.dedupeKey }).returning({ id: notifications.id });
    if (n) await db.execute(sql`select pg_notify('notification_created', ${n.id})`);
  }
}

async function displayName(db: Db, userId: string) {
  const [u] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, userId));
  return u?.displayName ?? 'یک بازیکن';
}

async function gameName(db: Db, gameId: string) {
  const [g] = await db.select({ nameFa: games.nameFa }).from(games).where(eq(games.id, gameId));
  return g?.nameFa ?? gameId;
}

/** Idempotent consumers: a duplicate delivery hits the notification dedupe key and creates nothing. */
export const notificationConsumers: Record<string, Consumer> = {
  'table.turn': async (db, e) => {
    const p = e.payload as { tableId: string; revision: number; gameId: string; userIds: string[] };
    await notify(db, p.userIds, 'turn', (u) => `turn:${p.tableId}:${p.revision}:${u}`, { tableId: p.tableId, gameNameFa: await gameName(db, p.gameId) });
  },
  'table.reminder': async (db, e) => {
    const p = e.payload as { tableId: string; revision: number; gameId: string; userIds: string[] };
    await notify(db, p.userIds, 'reminder', (u) => `reminder:${p.tableId}:${p.revision}:${u}`, { tableId: p.tableId, gameNameFa: await gameName(db, p.gameId) });
  },
  'table.finished': async (db, e) => {
    const p = e.payload as { tableId: string; gameId: string; isTutorial: boolean; reason: string; placements: { userId: string | null; place: number }[] };
    if (p.isTutorial) return;
    await notify(db, p.placements.map((x) => x.userId), 'finished', (u) => `finished:${p.tableId}:${u}`, { tableId: p.tableId, gameNameFa: await gameName(db, p.gameId) });
    // Behaviour signals (moderator information only, never an automatic penalty). Deadlines are frozen and
    // compensated during platform incidents, so a timeout here is not caused by a system failure.
    if (p.reason === 'timeout' || p.reason === 'resign') {
      const worst = Math.max(...p.placements.map((x) => x.place));
      for (const x of p.placements) {
        if (x.userId && x.place === worst && p.placements.some((y) => y.place < worst)) {
          await db.insert(behaviorSignals).values({ userId: x.userId, tableId: p.tableId, kind: p.reason === 'timeout' ? 'timeout_loss' : 'resigned' }).onConflictDoNothing();
        }
      }
    }
  },
  'match.found': async (db, e) => {
    const p = e.payload as { tableId: string; gameId: string; userIds: string[] };
    await notify(db, p.userIds, 'match', (u) => `match:${p.tableId}:${u}`, { tableId: p.tableId, gameNameFa: await gameName(db, p.gameId) });
  },
  'table.invited': async (db, e) => {
    const p = e.payload as { tableId: string; gameId: string; userIds: string[]; invitedBy: string };
    await notify(db, p.userIds, 'invite', (u) => `invite:${p.tableId}:${u}`,
      { tableId: p.tableId, gameNameFa: await gameName(db, p.gameId), actorName: await displayName(db, p.invitedBy) }, p.invitedBy);
  },
  'friend.requested': async (db, e) => {
    const p = e.payload as { from: string; to: string; requestKey: string };
    await notify(db, [p.to], 'friend_request', (u) => `friend:${p.requestKey}:${u}`, { actorName: await displayName(db, p.from) }, p.from);
  },
  'message.created': async (db, e) => {
    const p = e.payload as { messageId: string; conversationId: string; senderId: string; recipientIds: string[] };
    await notify(db, p.recipientIds, 'message', (u) => `message:${p.messageId}:${u}`,
      { conversationId: p.conversationId, actorName: await displayName(db, p.senderId) }, p.senderId);
  },
  'club.requested': async (db, e) => {
    const p = e.payload as { clubSlug: string; clubName: string; managerIds: string[]; userId: string };
    await notify(db, p.managerIds, 'club', (u) => `club:${p.clubSlug}:${p.userId}:${e.id}:${u}`, { clubSlug: p.clubSlug, clubName: p.clubName }, p.userId);
  }
};

/**
 * Progression consumers (DRAGON-03). Each runs in one transaction; rating is unique per result, rewards per source key,
 * so redelivery or out-of-order delivery never applies a result twice.
 */
const progressionConsumers: Record<string, Consumer> = {
  'table.finished': async (db, e) => {
    const p = e.payload as FinishedEvent;
    await db.transaction(async (tx) => {
      await applyRating(tx, p);
      await rewardMatch(tx, p);
    });
  },
  'tutorial.completed': async (db, e) => {
    const p = e.payload as { userId: string; gameId: string; tableId: string };
    await db.transaction((tx) => rewardTutorial(tx, p));
  }
};

/** Every consumer of a topic runs for each delivery; all are idempotent, so a partial failure is simply retried. */
export const consumers: Record<string, Consumer[]> = {};
for (const map of [notificationConsumers, progressionConsumers]) {
  for (const [topic, fn] of Object.entries(map)) (consumers[topic] ??= []).push(fn);
}

/**
 * Claim a batch with a lease (claimed_until), run consumers outside the claim transaction, then mark processed.
 * A crashed worker's lease expires and another worker re-delivers the event; consumers are idempotent.
 */
export async function runOutbox(db: Db, opts: { batch?: number; leaseSeconds?: number; registry?: Record<string, Consumer[]> } = {}) {
  const registry = opts.registry ?? consumers;
  const topics = Object.keys(registry);
  if (!topics.length) return { processed: 0, failed: 0 };
  const claimed = (await db.execute(sql`
    update outbox_events set claimed_until = now() + make_interval(secs => ${opts.leaseSeconds ?? 60}), attempts = attempts + 1
    where id in (
      select id from outbox_events
      where processed_at is null and available_at <= now() and (claimed_until is null or claimed_until < now())
        and topic in (${sql.join(topics.map((t) => sql`${t}`), sql`, `)})
      order by id limit ${opts.batch ?? 50}
      for update skip locked)
    returning id`)) as unknown as { id: number }[];
  let processed = 0;
  let failed = 0;
  for (const { id } of claimed) {
    const [event] = await db.select().from(outboxEvents).where(eq(outboxEvents.id, Number(id)));
    if (!event) continue;
    try {
      for (const consume of registry[event.topic]!) await consume(db, event);
      await db.update(outboxEvents).set({ processedAt: sql`now()`, claimedUntil: null }).where(eq(outboxEvents.id, event.id));
      processed++;
    } catch {
      // Exponential backoff, capped at 10 minutes; the event stays durable.
      const delay = Math.min(600, 2 ** Math.min(event.attempts, 9));
      await db.update(outboxEvents).set({ claimedUntil: null, availableAt: sql`now() + make_interval(secs => ${delay})` }).where(eq(outboxEvents.id, event.id));
      failed++;
    }
  }
  return { processed, failed };
}

// ---------- Platform incidents (distinct from a player's own disconnect) ----------

export async function openIncident(db: Db, adminId: string, reasonFa: string, requestId?: string) {
  return db.transaction(async (tx) => {
    const [open] = await tx.select().from(platformIncidents).where(isNull(platformIncidents.endedAt));
    if (open) throw new AppError('INCIDENT_ALREADY_OPEN');
    const [i] = await tx.insert(platformIncidents).values({ reasonFa, startedBy: adminId }).returning();
    await tx.insert(auditLog).values({ actorId: adminId, action: 'incident.open', targetType: 'incident', targetId: i!.id, metadata: { reasonFa }, requestId: requestId ?? null });
    await tx.execute(sql`select pg_notify('table_changed', t.id::text) from game_tables t where t.status = 'active'`);
    return i!;
  });
}

/** Close the incident and extend every pending deadline by the incident's duration (time compensation). */
export async function closeIncident(db: Db, adminId: string, requestId?: string) {
  return db.transaction(async (tx) => {
    const [i] = await tx.update(platformIncidents).set({ endedAt: sql`now()` }).where(isNull(platformIncidents.endedAt)).returning();
    if (!i) throw new AppError('NOT_FOUND');
    const shifted = await tx.execute(sql`
      update scheduled_deadlines d set due_at = d.due_at + (i.ended_at - i.started_at)
      from platform_incidents i where i.id = ${i.id} and d.status = 'pending' and d.created_at < i.ended_at returning d.id`);
    await tx.insert(auditLog).values({ actorId: adminId, action: 'incident.close', targetType: 'incident', targetId: i.id,
      metadata: { compensatedDeadlines: (shifted as unknown as unknown[]).length }, requestId: requestId ?? null });
    await tx.execute(sql`select pg_notify('table_changed', t.id::text) from game_tables t where t.status = 'active'`);
    return i;
  });
}
