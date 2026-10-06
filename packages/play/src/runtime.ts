// Authoritative table runtime shared by the API (HTTP + Socket.IO commands) and the worker (deadlines).
// Every state change goes through persistStep inside a transaction that holds the table row lock.
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { AppError } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { failMatch } from './matchmaking.ts';
import { applyAction, applyTimeout, type AnyModule, type EngineSnapshot, type GameRegistry, type RngState, type StepResult } from '@bg/game-engine';

const { gameTables, gameVersions, gameSnapshots, gameEvents, commandReceipts, scheduledDeadlines, gameResults, outboxEvents, participants, tutorialProgress } = schema;

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type TableRow = typeof gameTables.$inferSelect;
export type VersionRow = typeof gameVersions.$inferSelect;

export interface LockedTable { table: TableRow; version: VersionRow; module: AnyModule }

/** Row-lock the table (serializes commands, timeouts and lifecycle changes for this table). */
export async function lockTable(tx: Tx, registry: GameRegistry, tableId: string): Promise<LockedTable> {
  const [table] = await tx.select().from(gameTables).where(eq(gameTables.id, tableId)).for('update');
  if (!table) throw new AppError('NOT_FOUND');
  const [version] = await tx.select().from(gameVersions).where(eq(gameVersions.id, table.gameVersionId));
  return { table, version: version!, module: registry.resolve(table.gameId, version!.rulesVersion) };
}

export async function loadSnapshot(tx: Tx | Db, tableId: string, revision: number): Promise<EngineSnapshot> {
  const [row] = await tx.select({ state: gameSnapshots.state, rng: gameSnapshots.rng }).from(gameSnapshots)
    .where(and(eq(gameSnapshots.tableId, tableId), eq(gameSnapshots.revision, revision)));
  if (!row) throw new Error(`snapshot ${tableId}@${revision} missing`);
  return { state: row.state, rng: row.rng as RngState };
}

/** Recorded engine input, kept for deterministic replay (internal only). */
export type EngineInput =
  | { kind: 'start'; seed: number; playerCount: number; options?: Record<string, unknown> }
  | { kind: 'action'; seat: number; action: unknown; logicalTime: number }
  | { kind: 'timeout'; deadlineToken: string; logicalTime: number };

const notifyTable = (tx: Tx, tableId: string) => tx.execute(sql`select pg_notify('table_changed', ${tableId})`);

/**
 * Persist one engine step atomically: snapshot + revision, engine input and internal events, deadline changes,
 * canonical result (once) and outbox events. NOTIFY is delivered by PostgreSQL only after commit, so clients are
 * never told about state that was not persisted.
 */
export async function persistStep(tx: Tx, locked: LockedTable, step: StepResult, input: EngineInput): Promise<number> {
  const { table, version } = locked;
  const revision = table.revision + 1;
  await tx.insert(gameSnapshots).values({
    tableId: table.id, revision, state: step.snapshot.state, rng: step.snapshot.rng,
    rulesVersion: version.rulesVersion, stateSchemaVersion: version.stateSchemaVersion
  });
  await tx.insert(gameEvents).values([
    { tableId: table.id, revision, seq: 0, type: 'input', payload: input },
    ...step.internalEvents.map((e, i) => ({ tableId: table.id, revision, seq: i + 1, type: e.type, payload: e }))
  ]);
  await tx.update(gameTables).set({ revision }).where(eq(gameTables.id, table.id));
  table.revision = revision;

  if (step.scheduleChanges.length === 0) {
    // The running deadline still applies (e.g. one sealed bid inside a round): carry it to the new revision.
    await tx.update(scheduledDeadlines).set({ expectedRevision: revision })
      .where(and(eq(scheduledDeadlines.tableId, table.id), eq(scheduledDeadlines.status, 'pending')));
  }
  for (const change of step.scheduleChanges) {
    await tx.update(scheduledDeadlines).set({ status: 'cancelled' })
      .where(and(eq(scheduledDeadlines.tableId, table.id), eq(scheduledDeadlines.status, 'pending')));
    if (change.kind === 'set' && !table.isTutorial && !step.outcome) {
      const turnSeconds = (table.settings as { turnSeconds: number }).turnSeconds;
      const dueAt = sql`now() + make_interval(secs => ${turnSeconds})`;
      await tx.insert(scheduledDeadlines).values({ tableId: table.id, deadlineKey: 'turn', token: randomUUID(), expectedRevision: revision, dueAt });
      if (table.pace === 'turn' && (table.settings as { reminders?: boolean }).reminders) {
        // Remind a quarter of the turn before the deadline (at most 6 hours before).
        const lead = Math.min(Math.floor(turnSeconds / 4), 6 * 3600);
        await tx.insert(scheduledDeadlines).values({
          tableId: table.id, deadlineKey: 'reminder', token: randomUUID(), expectedRevision: revision,
          dueAt: sql`now() + make_interval(secs => ${turnSeconds - lead})`
        });
      }
    }
  }

  if (step.outcome) {
    const [result] = await tx.insert(gameResults).values({ tableId: table.id, outcome: step.outcome, reason: step.outcome.reason })
      .onConflictDoNothing({ target: gameResults.tableId }).returning({ id: gameResults.id });
    await tx.update(gameTables).set({ status: 'finished', finishedAt: sql`now()` }).where(eq(gameTables.id, table.id));
    await tx.update(scheduledDeadlines).set({ status: 'cancelled' })
      .where(and(eq(scheduledDeadlines.tableId, table.id), eq(scheduledDeadlines.status, 'pending')));
    table.status = 'finished';
    if (result) {
      const seats = await tx.select({ seat: participants.seat, userId: participants.userId }).from(participants).where(eq(participants.tableId, table.id));
      const userBySeat = new Map(seats.map((s) => [s.seat, s.userId]));
      // Canonical, public outcome only — consumed by notifications now and by rating/rewards in DRAGON-03.
      await tx.insert(outboxEvents).values({
        topic: 'table.finished', aggregateId: table.id,
        payload: {
          tableId: table.id, resultId: result.id, gameId: table.gameId, rulesVersion: version.rulesVersion,
          pace: table.pace, competition: table.competition, isTutorial: table.isTutorial, reason: step.outcome.reason,
          placements: step.outcome.placements.map((p) => ({ ...p, userId: userBySeat.get(p.seat) ?? null }))
        }
      });
      if (table.isTutorial) {
        const learner = userBySeat.get(0);
        if (learner) {
          await tx.update(tutorialProgress).set({ status: 'completed', completedAt: sql`now()`, updatedAt: sql`now()` })
            .where(and(eq(tutorialProgress.userId, learner), eq(tutorialProgress.gameId, table.gameId), eq(tutorialProgress.tableId, table.id)));
          await tx.insert(outboxEvents).values({ topic: 'tutorial.completed', aggregateId: table.id, payload: { userId: learner, gameId: table.gameId, tableId: table.id } });
        }
      }
    }
  } else if (table.pace === 'turn' && !table.isTutorial && step.pendingSeats.length > 0) {
    const pendingUsers = await tx.select({ userId: participants.userId }).from(participants)
      .where(and(eq(participants.tableId, table.id), inArray(participants.seat, step.pendingSeats)));
    await tx.insert(outboxEvents).values({
      topic: 'table.turn', aggregateId: table.id,
      payload: { tableId: table.id, revision, gameId: table.gameId, userIds: pendingUsers.map((u) => u.userId).filter(Boolean) }
    });
  }
  await notifyTable(tx, table.id);
  return revision;
}

const stableJson = (v: unknown): string =>
  v === null || typeof v !== 'object' ? JSON.stringify(v)
    : Array.isArray(v) ? `[${v.map(stableJson).join(',')}]`
      : `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(',')}}`;

export const payloadHash = (expectedRevision: number, action: unknown) =>
  createHash('sha256').update(stableJson({ expectedRevision, action })).digest('hex');

export interface CommandInput { userId: string; tableId: string; commandId: string; expectedRevision: number; action: unknown }
export interface CommandOutcome { status: 'accepted' | 'rejected'; revision: number; errorCode: string | null; duplicate: boolean }

const deepEqual = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);

/**
 * The single command path for HTTP and Socket.IO. Order inside the table lock:
 * membership → receipt lookup (exact duplicate returns the original receipt, changed payload is refused)
 * → table status → expectedRevision (STALE_REVISION) → module validation → atomic persist.
 * Rejections are recorded as receipts too, so retries of the same command are answered identically.
 */
export async function executeCommand(db: Db, registry: GameRegistry, input: CommandInput): Promise<CommandOutcome> {
  const hash = payloadHash(input.expectedRevision, input.action);
  return db.transaction(async (tx) => {
    const locked = await lockTable(tx, registry, input.tableId);
    const { table, module } = locked;
    const [me] = await tx.select().from(participants)
      .where(and(eq(participants.tableId, table.id), eq(participants.userId, input.userId)));
    if (!me) throw new AppError('NOT_PARTICIPANT');

    const [existing] = await tx.select().from(commandReceipts).where(and(
      eq(commandReceipts.tableId, table.id), eq(commandReceipts.actorId, input.userId), eq(commandReceipts.commandId, input.commandId)));
    if (existing) {
      if (existing.payloadHash !== hash) throw new AppError('COMMAND_ID_REUSED');
      return { status: existing.status as CommandOutcome['status'], revision: existing.revision, errorCode: existing.errorCode, duplicate: true };
    }

    const receipt = async (status: CommandOutcome['status'], revision: number, errorCode: string | null): Promise<CommandOutcome> => {
      await tx.insert(commandReceipts).values({ tableId: table.id, actorId: input.userId, commandId: input.commandId, payloadHash: hash, status, revision, errorCode });
      return { status, revision, errorCode, duplicate: false };
    };

    if (table.status !== 'active') return receipt('rejected', table.revision, 'TABLE_NOT_ACTIVE');
    if (input.expectedRevision !== table.revision) return receipt('rejected', table.revision, 'STALE_REVISION');

    const tutorialStep = table.isTutorial ? module.tutorial.steps[table.tutorialStep] : undefined;
    const isResign = (input.action as { type?: unknown } | null)?.type === 'resign';
    if (tutorialStep?.expected && !isResign && !deepEqual(input.action, tutorialStep.expected)) {
      return receipt('rejected', table.revision, 'TUTORIAL_EXPECTED_OTHER');
    }

    const snap = await loadSnapshot(tx, table.id, table.revision);
    const logicalTime = Date.now();
    const step = applyAction(module, snap, { kind: 'player', seat: me.seat }, input.action, logicalTime);
    if ('ok' in step) return receipt('rejected', table.revision, step.errorCode);
    const revision = await persistStep(tx, locked, step, { kind: 'action', seat: me.seat, action: input.action, logicalTime });

    if (table.isTutorial && !isResign) {
      await tx.update(gameTables).set({ tutorialStep: table.tutorialStep + 1 }).where(eq(gameTables.id, table.id));
      // The tutorial opponent is a fixed script applied through the same engine path.
      if (tutorialStep?.reply && !step.outcome && step.pendingSeats.includes(1)) {
        const reply = applyAction(module, step.snapshot, { kind: 'player', seat: 1 }, tutorialStep.reply, logicalTime);
        if ('ok' in reply) throw new Error(`tutorial script rejected: ${reply.errorCode}`);
        await persistStep(tx, locked, reply, { kind: 'action', seat: 1, action: tutorialStep.reply, logicalTime });
      }
    }
    return receipt('accepted', revision, null);
  });
}

export async function lookupReceipt(db: Db, userId: string, tableId: string, commandId: string) {
  const [r] = await db.select().from(commandReceipts).where(and(
    eq(commandReceipts.tableId, tableId), eq(commandReceipts.actorId, userId), eq(commandReceipts.commandId, commandId)));
  return r ? { found: true as const, status: r.status as 'accepted' | 'rejected', revision: r.revision, errorCode: r.errorCode } : { found: false as const };
}

/**
 * Fire one due deadline. Locks the table first (same order as commands, so moves and timeouts serialize),
 * then re-checks the deadline: a deadline whose expectedRevision no longer matches is stale and is cancelled.
 * Returns what happened, for logging/tests.
 */
export async function fireDeadline(db: Db, registry: GameRegistry, deadlineId: string): Promise<'fired' | 'stale' | 'skipped'> {
  return db.transaction(async (tx) => {
    const [peek] = await tx.select({ tableId: scheduledDeadlines.tableId }).from(scheduledDeadlines).where(eq(scheduledDeadlines.id, deadlineId));
    if (!peek) return 'skipped';
    const locked = await lockTable(tx, registry, peek.tableId);
    const [d] = await tx.select().from(scheduledDeadlines).where(eq(scheduledDeadlines.id, deadlineId)).for('update');
    if (!d || d.status !== 'pending' || d.dueAt.getTime() > Date.now()) return 'skipped';
    const { table, module } = locked;
    if (d.deadlineKey === 'ready') {
      // Matched players did not all accept in time: requeue those who did; the rest leave the queue.
      await tx.update(scheduledDeadlines).set({ status: 'fired', attempts: d.attempts + 1 }).where(eq(scheduledDeadlines.id, d.id));
      if (table.status === 'open' && table.isMatchmade) await failMatch(tx, table.id, { reason: 'ready_timeout' });
      return 'fired';
    }
    if (table.status !== 'active' || d.expectedRevision !== table.revision) {
      await tx.update(scheduledDeadlines).set({ status: 'cancelled' }).where(eq(scheduledDeadlines.id, d.id));
      return 'stale';
    }
    await tx.update(scheduledDeadlines).set({ status: 'fired', attempts: d.attempts + 1 }).where(eq(scheduledDeadlines.id, d.id));
    const snap = await loadSnapshot(tx, table.id, table.revision);
    if (d.deadlineKey === 'reminder') {
      const pending = module.pendingSeats(snap.state);
      const users = pending.length ? await tx.select({ userId: participants.userId }).from(participants)
        .where(and(eq(participants.tableId, table.id), inArray(participants.seat, pending))) : [];
      await tx.insert(outboxEvents).values({ topic: 'table.reminder', aggregateId: table.id,
        payload: { tableId: table.id, revision: table.revision, gameId: table.gameId, userIds: users.map((u) => u.userId).filter(Boolean) } });
      return 'fired';
    }
    const logicalTime = Date.now();
    await persistStep(tx, locked, applyTimeout(module, snap, logicalTime), { kind: 'timeout', deadlineToken: d.token, logicalTime });
    return 'fired';
  });
}
