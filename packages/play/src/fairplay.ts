// Fair play: player reports, page-visibility signals at tournament tables, and the numbers an arbiter reviews.
// Nothing here punishes anyone: the figures are indicators next to the game record (PGN), and an admin decides.
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { AppError } from '@bg/contracts';
import { schema, type Db } from '@bg/db';

const { fairPlayReports, tableFocusEvents, moveTimes, gameTables, participants, users, auditLog } = schema;

/** Open reports one player may have at the same time (stops report floods). */
const MAX_OPEN_REPORTS = 10;

/** A report is about a game both people played; the table must be over or part of a tournament. */
export async function reportPlayer(db: Db, reporterId: string, tableId: string, accusedId: string, note: string): Promise<void> {
  if (reporterId === accusedId) throw new AppError('VALIDATION_FAILED');
  const seats = await db.select({ userId: participants.userId }).from(participants).where(eq(participants.tableId, tableId));
  const humans = new Set(seats.flatMap((s) => (s.userId ? [s.userId] : [])));
  if (!humans.has(reporterId) || !humans.has(accusedId)) throw new AppError('FORBIDDEN');
  const [t] = await db.select({ status: gameTables.status }).from(gameTables).where(eq(gameTables.id, tableId));
  if (!t) throw new AppError('NOT_FOUND');
  const [{ open } = { open: 0 }] = await db.select({ open: sql<number>`count(*)::int` }).from(fairPlayReports)
    .where(and(eq(fairPlayReports.reporterId, reporterId), eq(fairPlayReports.status, 'open')));
  if (open >= MAX_OPEN_REPORTS) throw new AppError('RATE_LIMITED');
  await db.insert(fairPlayReports).values({ tableId, reporterId, accusedId, note }).onConflictDoNothing();
}

/** Tab hidden / shown at a tournament table the player sits at. Repeated identical states are ignored. */
export async function recordFocus(db: Db, userId: string, tableId: string, hidden: boolean): Promise<void> {
  const [row] = await db.select({ table: gameTables, seat: participants.seat }).from(gameTables)
    .innerJoin(participants, and(eq(participants.tableId, gameTables.id), eq(participants.userId, userId)))
    .where(eq(gameTables.id, tableId));
  if (!row || row.table.status !== 'active' || !(row.table.settings as { tournament?: unknown }).tournament) return;
  const [last] = await db.select({ hidden: tableFocusEvents.hidden }).from(tableFocusEvents)
    .where(and(eq(tableFocusEvents.tableId, tableId), eq(tableFocusEvents.userId, userId))).orderBy(desc(tableFocusEvents.id)).limit(1);
  if (last?.hidden === hidden) return;
  await db.insert(tableFocusEvents).values({ tableId, userId, hidden });
}

export interface MoveStats { moves: number; meanSec: number; medianSec: number; stdevSec: number; cv: number; under2s: number; longestSec: number }

/** Summary of a player's thinking times (seconds). `cv` = stdev / mean: very low values mean suspiciously even timing. */
export function moveStats(spentMs: number[]): MoveStats {
  const n = spentMs.length;
  if (!n) return { moves: 0, meanSec: 0, medianSec: 0, stdevSec: 0, cv: 0, under2s: 0, longestSec: 0 };
  const sec = spentMs.map((ms) => ms / 1000).sort((a, b) => a - b);
  const mean = sec.reduce((s, x) => s + x, 0) / n;
  const stdev = Math.sqrt(sec.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  const median = n % 2 ? sec[(n - 1) / 2]! : (sec[n / 2 - 1]! + sec[n / 2]!) / 2;
  const r = (x: number) => Math.round(x * 100) / 100;
  return { moves: n, meanSec: r(mean), medianSec: r(median), stdevSec: r(stdev), cv: mean ? r(stdev / mean) : 0, under2s: sec.filter((x) => x < 2).length, longestSec: r(sec[n - 1]!) };
}

/** Total time and number of times the page was hidden, from alternating hidden/shown events (an open hide ends at `until`). */
export function hiddenTime(events: { hidden: boolean; at: Date }[], until: Date): { times: number; seconds: number } {
  let times = 0, ms = 0, since: Date | null = null;
  for (const e of events) {
    if (e.hidden && !since) { since = e.at; times++; }
    else if (!e.hidden && since) { ms += e.at.getTime() - since.getTime(); since = null; }
  }
  if (since) ms += Math.max(0, until.getTime() - since.getTime());
  return { times, seconds: Math.round(ms / 1000) };
}

export interface FairPlayFlag { code: 'even_timing' | 'fast_moves' | 'tab_switching'; textFa: string }

/** Indicators only; they need a minimum number of moves to mean anything. */
export function fairPlayFlags(stats: MoveStats, hidden: { times: number; seconds: number }): FairPlayFlag[] {
  const flags: FairPlayFlag[] = [];
  if (stats.moves >= 20 && stats.cv < 0.35) flags.push({ code: 'even_timing', textFa: 'زمان حرکت‌ها بیش‌ازحد یکنواخت است.' });
  if (stats.moves >= 20 && stats.under2s / stats.moves > 0.6 && stats.meanSec < 4) flags.push({ code: 'fast_moves', textFa: 'بیشتر حرکت‌ها در کمتر از ۲ ثانیه زده شده است.' });
  if (hidden.times >= 5 || hidden.seconds >= 120) flags.push({ code: 'tab_switching', textFa: 'صفحهٔ بازی چند بار یا مدتی طولانی پنهان بوده است.' });
  return flags;
}

/** What an arbiter sees for one table: per player move-time statistics, focus loss and indicator flags. */
export async function fairPlayReview(db: Db, tableId: string) {
  const [table] = await db.select().from(gameTables).where(eq(gameTables.id, tableId));
  if (!table) throw new AppError('NOT_FOUND');
  const seats = await db.select({ seat: participants.seat, userId: participants.userId, displayName: users.displayName }).from(participants)
    .leftJoin(users, eq(users.id, participants.userId)).where(eq(participants.tableId, tableId)).orderBy(asc(participants.seat));
  const times = await db.select().from(moveTimes).where(and(eq(moveTimes.tableId, tableId), eq(moveTimes.actionType, 'move'))).orderBy(asc(moveTimes.revision));
  const focus = await db.select().from(tableFocusEvents).where(eq(tableFocusEvents.tableId, tableId)).orderBy(asc(tableFocusEvents.id));
  const until = table.finishedAt ?? new Date();
  return {
    tableId, status: table.status, gameId: table.gameId,
    players: seats.filter((s) => s.userId).map((s) => {
      const stats = moveStats(times.filter((t) => t.seat === s.seat).map((t) => t.spentMs));
      const hidden = hiddenTime(focus.filter((f) => f.userId === s.userId).map((f) => ({ hidden: f.hidden, at: f.createdAt })), until);
      return { seat: s.seat, userId: s.userId!, displayName: s.displayName ?? '?', stats, hidden, flags: fairPlayFlags(stats, hidden) };
    })
  };
}

export async function listFairPlayReports(db: Db, status?: 'open' | 'dismissed' | 'actioned') {
  const reporter = schema.users;
  const rows = await db.select({ r: fairPlayReports, accused: users.displayName }).from(fairPlayReports)
    .innerJoin(users, eq(users.id, fairPlayReports.accusedId)).where(status ? eq(fairPlayReports.status, status) : undefined)
    .orderBy(desc(fairPlayReports.createdAt)).limit(200);
  const names = new Map((await db.select({ id: reporter.id, name: reporter.displayName }).from(reporter)
    .where(inArray(reporter.id, [...new Set(rows.map((x) => x.r.reporterId))].length ? [...new Set(rows.map((x) => x.r.reporterId))] : ['00000000-0000-0000-0000-000000000000']))).map((u) => [u.id, u.name]));
  return rows.map(({ r, accused }) => ({ id: r.id, tableId: r.tableId, reporterName: names.get(r.reporterId) ?? '?', accusedId: r.accusedId, accusedName: accused,
    note: r.note, status: r.status, reviewNote: r.reviewNote, createdAt: r.createdAt.toISOString() }));
}

export async function resolveFairPlayReport(db: Db, adminId: string, id: string, status: 'dismissed' | 'actioned', note: string, requestId?: string): Promise<void> {
  const rows = await db.update(fairPlayReports).set({ status, reviewNote: note, reviewedBy: adminId, reviewedAt: sql`now()` })
    .where(and(eq(fairPlayReports.id, id), eq(fairPlayReports.status, 'open'))).returning({ id: fairPlayReports.id });
  if (!rows.length) throw new AppError('NOT_FOUND');
  await db.insert(auditLog).values({ actorId: adminId, action: 'fairplay.report_resolved', targetType: 'fair_play_report', targetId: id, metadata: { status, note }, requestId: requestId ?? null });
}
