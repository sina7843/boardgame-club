// Tournaments: admin-created Swiss or knockout events built from ordinary tables. Rules stay in the game modules;
// this file only seats players, scores finished tables from the canonical result and moves rounds along.
// Prizes are fixed by the admin and paid by the platform; they never come from entry fees.
import { randomInt, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { AppError, BOT_PERSONAS, ratingModeOf, type CreateTournamentBody, type TournamentDetail, type TournamentSummary } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { GameRegistry } from '@bg/game-engine';
import { checkout, isPremium, type BillingConfig } from './billing.ts';
import { coinBalance, lockCoins } from './coins.ts';
import { assertTimeAllowed, resolveOptions } from './game-settings.ts';
import type { LockedTable, Tx } from './runtime.ts';
import { activeSuspension } from './sanctions.ts';
import { activeVersion, pickPersonas, startTable } from './tables.ts';
import { fideRank, fideStats, type PlayerRecord, type RoundRecord } from './swiss-rank.ts';

const { tournaments, tournamentEntries: entries, tournamentTables: tTables, tournamentRefunds: refunds, gameTables, gameResults, participants,
  scheduledDeadlines, outboxEvents, coinLedger, entitlements, auditLog, payments, games, users } = schema;

type Tournament = typeof tournaments.$inferSelect;
type Entry = typeof entries.$inferSelect;
type Placement = { userId: string; place: number };

/** Level of the bot that takes an absent player's seat. */
const STAND_IN_LEVEL = 'medium';
/** Missing this many tables (no-show or bot takeover) eliminates the player. */
const NO_SHOW_LIMIT = 2;
/** Safety stop for knockouts where nobody is ever eliminated (e.g. endless draws). */
const MAX_ROUNDS = 30;
/** Rounds a Swiss player may sit out on request (½ point each). */
const MAX_REQUESTED_BYES = 2;
/** Search budget of the Swiss pairing backtracking; past it the pairing accepts a rematch instead of searching on. */
const PAIRING_NODES = 20_000;

// ---------------- Admin ----------------

export async function createTournament(db: Db, registry: GameRegistry, adminId: string, body: CreateTournamentBody, requestId?: string): Promise<string> {
  return db.transaction(async (tx) => {
    const { settings } = await activeVersion(tx, registry, body.gameId);
    const invalid = () => new AppError('TOURNAMENT_SETTINGS_INVALID');
    if (!settings.paces.includes(body.pace)) throw invalid();
    assertTimeAllowed(settings, body.pace, body.turnSeconds);
    if (body.tableSize < settings.minPlayers || body.tableSize > settings.maxPlayers) throw invalid();
    if (body.minEntrants > body.maxEntrants || body.minEntrants < Math.max(2, settings.minPlayers)) throw invalid();
    if (body.format === 'swiss' && !body.rounds) throw invalid();
    // Head-to-head Swiss: more rounds than opponents would force rematches.
    if (body.format === 'swiss' && body.tableSize === 2 && body.rounds! > body.maxEntrants - 1) throw invalid();
    if (body.format === 'knockout' && body.advance >= body.tableSize) throw invalid();
    if ((body.entryKind === 'free') !== (body.entryAmount === 0)) throw invalid();
    if (Date.parse(body.startsAt) < Date.now() + 60_000) throw invalid();
    if (new Set(body.prizes.map((p) => p.place)).size !== body.prizes.length || body.prizes.some((p) => p.place > body.maxEntrants)) throw invalid();
    const options = resolveOptions(settings, body.options);
    // An Armageddon playoff needs head-to-head Swiss in a game where the host can take the first move (colours are drawn by lot).
    if (body.playoff === 'armageddon' && !(body.format === 'swiss' && body.tableSize === 2 && settings.options.some((o) => o.key === 'firstMove' && o.allowed.includes('host')))) throw invalid();
    // Two-player games that let the host take the first move get alternating colours (see createRound).
    if (body.tableSize === 2 && body.options.firstMove === undefined && settings.options.some((o) => o.key === 'firstMove' && o.allowed.includes('host'))) options.firstMove = 'host';
    const [t] = await tx.insert(tournaments).values({
      gameId: body.gameId, titleFa: body.titleFa, descriptionFa: body.descriptionFa, format: body.format, pace: body.pace, turnSeconds: body.turnSeconds,
      tableSize: body.tableSize, rounds: body.format === 'swiss' ? body.rounds! : null, advance: body.format === 'knockout' ? body.advance : 1,
      minEntrants: body.minEntrants, maxEntrants: body.maxEntrants, startsAt: new Date(body.startsAt), arrivalSeconds: body.arrivalSeconds,
      entryKind: body.entryKind, entryAmount: body.entryAmount, prizes: [...body.prizes].sort((a, b) => a.place - b.place), createdBy: adminId,
      options, checkinMinutes: body.checkinMinutes, roundGapSeconds: body.roundGapSeconds, playoff: body.playoff
    }).returning({ id: tournaments.id });
    await tx.insert(auditLog).values({ actorId: adminId, action: 'tournament.create', targetType: 'tournament', targetId: t!.id, metadata: body, requestId: requestId ?? null });
    return t!.id;
  });
}

export async function adminCancelTournament(db: Db, adminId: string, id: string, reason: string, requestId?: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).for('update');
    if (!t) throw new AppError('NOT_FOUND');
    if (t.status !== 'open' && t.status !== 'running') throw new AppError('TOURNAMENT_NOT_OPEN');
    await cancelTournament(tx, t, reason);
    await tx.insert(auditLog).values({ actorId: adminId, action: 'tournament.cancel', targetType: 'tournament', targetId: id, metadata: { reason }, requestId: requestId ?? null });
  });
}

/** Cancel and give every entry fee back: coins at once, Toman into the refund queue. Tables already playing finish as friendly games. */
async function cancelTournament(tx: Tx, t: Tournament, reason: string) {
  await tx.update(tournaments).set({ status: 'cancelled', cancelReason: reason, finishedAt: sql`now()` }).where(eq(tournaments.id, t.id));
  const registered = await tx.select().from(entries).where(and(eq(entries.tournamentId, t.id), eq(entries.status, 'registered')));
  for (const e of registered) await refundEntry(tx, t, e, reason);
  await tx.insert(outboxEvents).values({ topic: 'tournament.cancelled', aggregateId: t.id,
    payload: { tournamentId: t.id, titleFa: t.titleFa, userIds: registered.map((e) => e.userId) } });
}

async function refundEntry(tx: Tx, t: Tournament, e: Entry, reason: string) {
  if (e.coinLedgerId) {
    const [debit] = await tx.select({ amount: coinLedger.amount }).from(coinLedger).where(eq(coinLedger.id, e.coinLedgerId));
    await tx.insert(coinLedger).values({ userId: e.userId, amount: -debit!.amount, ruleId: 'tournament.refund', reason: `بازگشت ورودی «${t.titleFa}».`,
      sourceKey: `refund:${e.coinLedgerId}`, metadata: { tournamentId: t.id } }).onConflictDoNothing({ target: coinLedger.sourceKey });
  }
  if (e.paymentId) await queueRefund(tx, t.id, e.userId, e.paymentId, reason);
}

async function queueRefund(tx: Tx, tournamentId: string, userId: string, paymentId: string, reason: string) {
  const [p] = await tx.select({ amount: payments.amount }).from(payments).where(eq(payments.id, paymentId));
  await tx.insert(refunds).values({ tournamentId, userId, paymentId, amount: p!.amount, reason }).onConflictDoNothing({ target: refunds.paymentId });
}

export async function markRefundPaid(db: Db, adminId: string, id: string, note: string, requestId?: string): Promise<void> {
  const rows = await db.update(refunds).set({ status: 'paid', paidBy: adminId, paidAt: sql`now()`, note })
    .where(and(eq(refunds.id, id), eq(refunds.status, 'pending'))).returning();
  if (!rows.length) throw new AppError('NOT_FOUND');
  await db.insert(auditLog).values({ actorId: adminId, action: 'tournament.refund_paid', targetType: 'payment', targetId: rows[0]!.paymentId, metadata: { note }, requestId: requestId ?? null });
}

export async function listRefunds(db: Db, status?: 'pending' | 'paid') {
  return db.select({ r: refunds, titleFa: tournaments.titleFa, displayName: users.displayName, mobile: schema.userPrivate.mobile, orderId: payments.orderId, providerRef: payments.providerRef })
    .from(refunds).innerJoin(tournaments, eq(tournaments.id, refunds.tournamentId)).innerJoin(users, eq(users.id, refunds.userId))
    .innerJoin(schema.userPrivate, eq(schema.userPrivate.userId, refunds.userId)).innerJoin(payments, eq(payments.id, refunds.paymentId))
    .where(status ? eq(refunds.status, status) : undefined).orderBy(desc(refunds.createdAt)).limit(200);
}

/** Close a tournament table without playing it: the arbiter's or a forfeit's placements stand, pending deadlines are void. */
async function closeTable(tx: Tx, tableId: string, placements: Placement[], absent: string[]) {
  await tx.update(gameTables).set({ status: 'cancelled' }).where(and(eq(gameTables.id, tableId), inArray(gameTables.status, ['open', 'active'])));
  await tx.update(scheduledDeadlines).set({ status: 'cancelled' }).where(and(eq(scheduledDeadlines.tableId, tableId), eq(scheduledDeadlines.status, 'pending')));
  await tx.update(tTables).set({ placements, absent }).where(eq(tTables.tableId, tableId));
  await tx.execute(sql`select pg_notify('table_changed', ${tableId})`);
}

/**
 * Disqualify a player of a running tournament (cheating, abuse): they are out for good, never ranked or paid, and the
 * table they sit at is forfeited to the opponent (head-to-head) or scored 0 for them. Audited with the reason.
 */
export async function disqualifyPlayer(db: Db, adminId: string, id: string, userId: string, reason: string, requestId?: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).for('update');
    if (!t) throw new AppError('NOT_FOUND');
    if (t.status !== 'running') throw new AppError('TOURNAMENT_NOT_OPEN');
    const [e] = await tx.select().from(entries).where(and(eq(entries.tournamentId, id), eq(entries.userId, userId), eq(entries.status, 'registered')));
    if (!e) throw new AppError('NOT_REGISTERED');
    if (e.disqualifiedAt) throw new AppError('PLAYER_DISQUALIFIED');
    await tx.update(entries).set({ disqualifiedAt: sql`now()`, disqualifiedReason: reason, eliminatedRound: e.eliminatedRound ?? t.currentRound })
      .where(and(eq(entries.tournamentId, id), eq(entries.userId, userId)));
    const open = await tx.select({ tt: tTables }).from(tTables).where(and(eq(tTables.tournamentId, id), eq(tTables.round, t.currentRound), isNull(tTables.scoredAt), isNull(tTables.placements)));
    for (const { tt } of open.filter((r) => r.tt.seats.some((s) => s.userId === userId))) {
      if (tt.seats.length === 2) {
        const other = tt.seats.find((s) => s.userId !== userId)!.userId;
        await closeTable(tx, tt.tableId, [{ userId: other, place: 1 }, { userId, place: 2 }], [...new Set([...tt.absent, userId])]);
      } else await markAbsent(tx, tt.tableId, id, [userId]);
    }
    await tx.insert(auditLog).values({ actorId: adminId, action: 'tournament.disqualify', targetType: 'tournament', targetId: id, metadata: { userId, reason }, requestId: requestId ?? null });
  });
}

/**
 * Arbiter's decision for one table: replaces the result (a table still being played is closed). Points are recomputed
 * from all results. A knockout round that was already scored cannot be reopened.
 */
export async function overrideTableResult(db: Db, adminId: string, id: string, tableId: string, placements: Placement[], reason: string, requestId?: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).for('update');
    if (!t) throw new AppError('NOT_FOUND');
    if (t.status !== 'running') throw new AppError('TOURNAMENT_NOT_OPEN');
    const [tt] = await tx.select().from(tTables).where(and(eq(tTables.tableId, tableId), eq(tTables.tournamentId, id)));
    if (!tt) throw new AppError('NOT_FOUND');
    const players = new Set([...tt.seats.map((s) => s.userId), ...tt.absent]);
    if (placements.length !== players.size || new Set(placements.map((p) => p.userId)).size !== players.size || !placements.every((p) => players.has(p.userId))) throw new AppError('VALIDATION_FAILED');
    if (tt.scoredAt && t.format === 'knockout') throw new AppError('TOURNAMENT_SETTINGS_INVALID');
    await closeTable(tx, tableId, placements, []);
    await tx.update(tTables).set({ overridden: true }).where(eq(tTables.tableId, tableId));
    if (tt.scoredAt) await recomputeStandings(tx, t);
    await tx.insert(auditLog).values({ actorId: adminId, action: 'tournament.override_result', targetType: 'tournament', targetId: id, metadata: { tableId, placements, reason }, requestId: requestId ?? null });
  });
}

// ---------------- Registration ----------------

/** Lock the tournament row: registrations, withdrawals and the start serialize on it (capacity can never be exceeded). */
async function lockOpen(tx: Tx, id: string): Promise<Tournament> {
  const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).for('update');
  if (!t) throw new AppError('NOT_FOUND');
  if (t.status !== 'open' || t.startsAt.getTime() <= Date.now()) throw new AppError('TOURNAMENT_NOT_OPEN');
  return t;
}

async function assertCanEnter(tx: Tx, t: Tournament, userId: string) {
  const [mine] = await tx.select().from(entries).where(and(eq(entries.tournamentId, t.id), eq(entries.userId, userId)));
  if (mine?.status === 'registered') throw new AppError('ALREADY_REGISTERED');
  if ((await entrantCount(tx, t.id)) >= t.maxEntrants) throw new AppError('TOURNAMENT_FULL');
  if (await activeSuspension(tx, userId)) throw new AppError('ACCOUNT_SUSPENDED');
  const [game] = await tx.select({ access: games.access }).from(games).where(eq(games.id, t.gameId));
  if (game?.access === 'premium' && !(await isPremium(tx, userId))) throw new AppError('PREMIUM_REQUIRED');
}

const entrantCount = async (tx: Tx | Db, id: string) => {
  const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(entries).where(and(eq(entries.tournamentId, id), eq(entries.status, 'registered')));
  return r?.n ?? 0;
};

/** The window in which players confirm attendance (registering inside it counts as confirming). */
const inCheckin = (t: Tournament) => t.checkinMinutes > 0 && Date.now() >= t.startsAt.getTime() - t.checkinMinutes * 60_000;

const enter = (tx: Tx, t: Tournament, userId: string, paid: { coinLedgerId?: string; paymentId?: string }) =>
  tx.insert(entries).values({ tournamentId: t.id, userId, coinLedgerId: paid.coinLedgerId ?? null, paymentId: paid.paymentId ?? null, checkedInAt: inCheckin(t) ? new Date() : null })
    .onConflictDoUpdate({ target: [entries.tournamentId, entries.userId],
      set: { status: 'registered', coinLedgerId: paid.coinLedgerId ?? null, paymentId: paid.paymentId ?? null, createdAt: sql`now()`, checkedInAt: inCheckin(t) ? sql`now()` : null } });

/** Free or coin entry. A Toman entry goes through `tournamentCheckout` and registers when the payment is verified. */
export async function registerForTournament(db: Db, userId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const t = await lockOpen(tx, id);
    await assertCanEnter(tx, t, userId);
    if (t.entryKind === 'toman') throw new AppError('TOURNAMENT_PAY_ONLINE');
    let coinLedgerId: string | undefined;
    if (t.entryKind === 'coins') {
      await lockCoins(tx, userId);
      if ((await coinBalance(tx, userId)) < t.entryAmount) throw new AppError('INSUFFICIENT_COINS');
      const [debit] = await tx.insert(coinLedger).values({ userId, amount: -t.entryAmount, ruleId: 'tournament.entry', reason: `ورودی «${t.titleFa}».`,
        sourceKey: `tournament-entry:${randomUUID()}`, metadata: { tournamentId: t.id } }).returning({ id: coinLedger.id });
      coinLedgerId = debit!.id;
    }
    await enter(tx, t, userId, { coinLedgerId });
  });
}

export async function withdrawFromTournament(db: Db, userId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const t = await lockOpen(tx, id);
    const [e] = await tx.select().from(entries).where(and(eq(entries.tournamentId, id), eq(entries.userId, userId), eq(entries.status, 'registered')));
    if (!e) throw new AppError('NOT_REGISTERED');
    await tx.update(entries).set({ status: 'withdrawn' }).where(and(eq(entries.tournamentId, id), eq(entries.userId, userId)));
    await refundEntry(tx, t, e, 'انصراف پیش از شروع');
  });
}

/** Attendance confirmation: only inside the check-in window; those who do not confirm are withdrawn (and refunded) at the start. */
export async function checkinTournament(db: Db, userId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const t = await lockOpen(tx, id);
    if (!inCheckin(t)) throw new AppError('TOURNAMENT_CHECKIN_CLOSED');
    const rows = await tx.update(entries).set({ checkedInAt: sql`now()` })
      .where(and(eq(entries.tournamentId, id), eq(entries.userId, userId), eq(entries.status, 'registered'))).returning({ u: entries.userId });
    if (!rows.length) throw new AppError('NOT_REGISTERED');
  });
}

/** Swiss: ask to sit a future round out (½ point, at most MAX_REQUESTED_BYES) or take the request back. */
export async function requestBye(db: Db, userId: string, id: string, round: number, requested: boolean): Promise<void> {
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).for('update');
    if (!t) throw new AppError('NOT_FOUND');
    if (t.format !== 'swiss' || (t.status !== 'open' && t.status !== 'running') || round <= t.currentRound || round > (t.rounds ?? 0)) throw new AppError('TOURNAMENT_BYE_INVALID');
    const [e] = await tx.select().from(entries).where(and(eq(entries.tournamentId, id), eq(entries.userId, userId), eq(entries.status, 'registered')));
    if (!e) throw new AppError('NOT_REGISTERED');
    if (e.disqualifiedAt || e.eliminatedRound !== null) throw new AppError('TOURNAMENT_BYE_INVALID');
    const set = new Set(e.requestedByes);
    if (requested) {
      if (!set.has(round) && set.size >= MAX_REQUESTED_BYES) throw new AppError('TOURNAMENT_BYE_INVALID');
      set.add(round);
    } else set.delete(round);
    await tx.update(entries).set({ requestedByes: [...set].sort((a, b) => a - b) }).where(and(eq(entries.tournamentId, id), eq(entries.userId, userId)));
  });
}

/** Start a gateway payment for a Toman entry (checks the seat first; the verified payment re-checks it). */
export async function tournamentCheckout(db: Db, billing: BillingConfig, userId: string, id: string) {
  await db.transaction(async (tx) => {
    const t = await lockOpen(tx, id);
    if (t.entryKind !== 'toman') throw new AppError('VALIDATION_FAILED');
    await assertCanEnter(tx, t, userId);
  });
  return checkout(db, billing, userId, { tournamentId: id });
}

/** Called by verifyPayment inside its transaction: a verified entry fee registers, or is queued for refund if the seat is gone. */
export async function registerPaidEntry(tx: Tx, p: { id: string; userId: string; tournamentId: string }) {
  const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, p.tournamentId)).for('update');
  const [mine] = await tx.select().from(entries).where(and(eq(entries.tournamentId, p.tournamentId), eq(entries.userId, p.userId)));
  const seat = t && t.status === 'open' && t.startsAt.getTime() > Date.now() && mine?.status !== 'registered' && (await entrantCount(tx, t.id)) < t.maxEntrants;
  if (seat) await enter(tx, t, p.userId, { paymentId: p.id });
  else await queueRefund(tx, p.tournamentId, p.userId, p.id, mine?.status === 'registered' ? 'پرداخت تکراری' : 'تورنمنت پیش از تأیید پرداخت بسته یا پر شد');
}

// ---------------- Pairing ----------------

/**
 * Table sizes for `n` players: as even as possible, never below the game's minimum. When that is impossible the
 * players who do not fit get a bye.
 */
export function groupSizes(n: number, size: number, min: number): { sizes: number[]; byes: number } {
  const floor = Math.max(2, min);
  const k = Math.ceil(n / size);
  const base = Math.floor(n / k);
  if (n >= floor && base >= floor) return { sizes: Array.from({ length: k }, (_, i) => (i < n % k ? base + 1 : base)), byes: 0 };
  const full = Math.floor(n / size);
  return { sizes: Array<number>(full).fill(size), byes: n - full * size };
}

const shuffle = <T>(xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};

export interface SwissPlayer {
  id: string;
  points: number;
  /** Everyone this player has already met. */
  opponents: ReadonlySet<string>;
  /** Pairing byes received so far. */
  byes: number;
  /** Games played as the first mover / the second mover (colours). */
  first: number;
  second: number;
}

/**
 * Head-to-head Swiss pairing (Dutch-style). `sorted` is best first (points, ties already in seeding order). Players with
 * equal points meet, the top half of a score group against the bottom half; nobody meets twice and the bye (odd field)
 * goes to the lowest-ranked player without one, unless that would force a rematch. If no rematch-free pairing exists
 * (or the search budget runs out) rematches are accepted as a last resort so a round can always be played.
 */
export function swissPairing(sorted: SwissPlayer[]): { pairs: [SwissPlayer, SwissPlayer][]; bye: SwissPlayer | null } {
  const solve = (list: SwissPlayer[], allowRematch: boolean, budget: { n: number }): [SwissPlayer, SwissPlayer][] | null => {
    if (!list.length) return [];
    const [p, ...others] = list;
    const group = others.filter((q) => q.points === p!.points).length + 1;
    const target = Math.ceil(group / 2) - 1; // Dutch: the first of a group meets the middle one, then the next, ...
    const cands = others.map((q, j) => ({ q, j, rematch: p!.opponents.has(q.id) }))
      .filter((c) => allowRematch || !c.rematch)
      .map((c) => ({ ...c, cost: (c.rematch ? 1e7 : 0) + Math.abs(c.q.points - p!.points) * 1000 + (c.q.points === p!.points ? Math.abs(c.j - target) : c.j) }))
      .sort((a, b) => a.cost - b.cost);
    for (const c of cands) {
      if (--budget.n < 0) return null;
      const rest = solve(others.filter((_, j) => j !== c.j), allowRematch, budget);
      if (rest) return [[p!, c.q], ...rest];
    }
    return null;
  };
  const pair = (list: SwissPlayer[]) => solve(list, false, { n: PAIRING_NODES }) ?? solve(list, true, { n: Infinity })!;
  if (sorted.length < 2) return { pairs: [], bye: sorted[0] ?? null };
  if (sorted.length % 2 === 0) return { pairs: pair(sorted), bye: null };
  const bottomUp = sorted.map((p, i) => ({ p, i })).reverse();
  const order = [...bottomUp.filter((x) => x.p.byes === 0), ...bottomUp.filter((x) => x.p.byes > 0)];
  for (const { p, i } of order.slice(0, 8)) {
    const pairs = solve(sorted.filter((_, j) => j !== i), false, { n: PAIRING_NODES });
    if (pairs) return { pairs, bye: p };
  }
  const { p, i } = order[0]!;
  return { pairs: pair(sorted.filter((_, j) => j !== i)), bye: p };
}

/** Who moves first: the player who has moved first less often (equal: coin flip). Returns [first, second]. */
export function firstMover(a: SwissPlayer, b: SwissPlayer): [SwissPlayer, SwissPlayer] {
  const da = a.first - a.second, db = b.first - b.second;
  if (da !== db) return da < db ? [a, b] : [b, a];
  return randomInt(2) ? [a, b] : [b, a];
}

/** Who each player met and how often they moved first/second, from the rounds so far (forfeited tables have no colours). */
async function seatHistory(tx: Tx, tournamentId: string) {
  const past = await tx.select({ seats: tTables.seats, absent: tTables.absent }).from(tTables).where(eq(tTables.tournamentId, tournamentId));
  const hist = new Map<string, { opponents: Set<string>; first: number; second: number }>();
  const of = (u: string) => hist.get(u) ?? hist.set(u, { opponents: new Set(), first: 0, second: 0 }).get(u)!;
  for (const row of past) {
    if (row.seats.length !== 2) continue;
    for (const s of row.seats) {
      const h = of(s.userId);
      h.opponents.add(row.seats.find((x) => x.userId !== s.userId)!.userId);
      if (!row.absent.length) { if (s.seat === 0) h.first++; else h.second++; }
    }
  }
  return hist;
}

// ---------------- Rounds ----------------

async function aliveEntries(tx: Tx, id: string) {
  return tx.select().from(entries).where(and(eq(entries.tournamentId, id), eq(entries.status, 'registered'), isNull(entries.eliminatedRound)));
}

async function createRound(tx: Tx, registry: GameRegistry, t: Tournament, round: number): Promise<'round' | 'finished'> {
  const alive = await aliveEntries(tx, t.id);
  const { version, settings } = await activeVersion(tx, registry, t.gameId);
  // Swiss players who asked to sit this round out do not play and score ½.
  const resting = t.format === 'swiss' ? alive.filter((e) => e.requestedByes.includes(round)) : [];
  const playing = alive.filter((e) => !resting.includes(e));
  let groups: Entry[][];
  let byed: Entry[];
  if (t.format === 'swiss' && t.tableSize === 2 && settings.minPlayers <= 2) {
    const hist = await seatHistory(tx, t.id);
    const byId = new Map(playing.map((e) => [e.userId, e]));
    // Seeding: by points, then by the rating fixed at the start (unrated count as a newcomer, 1500); equal ratings are drawn.
    const seed = (e: Entry) => e.startRating ?? 1500;
    const sorted: SwissPlayer[] = shuffle(playing).sort((a, b) => b.points - a.points || seed(b) - seed(a)).map((e) => ({
      id: e.userId, points: e.points, byes: e.byeRounds.length, opponents: hist.get(e.userId)?.opponents ?? new Set(), first: hist.get(e.userId)?.first ?? 0, second: hist.get(e.userId)?.second ?? 0
    }));
    const { pairs, bye } = swissPairing(sorted);
    // Seat 0 is the host and, with firstMove=host, the first mover: give it to whoever owes it.
    groups = pairs.map(([a, b]) => (t.options.firstMove === 'host' ? firstMover(a, b) : [a, b]).map((p) => byId.get(p.id)!));
    byed = bye ? [byId.get(bye.id)!] : [];
  } else {
    // Equal scores meet (a stable sort keeps the shuffle among ties). Knockout: a fresh draw each round.
    const order = t.format === 'swiss' ? shuffle(playing).sort((a, b) => b.points - a.points) : shuffle(playing);
    const { sizes } = groupSizes(order.length, t.tableSize, settings.minPlayers);
    groups = [];
    let at = 0;
    for (const size of sizes) { groups.push(order.slice(at, at + size)); at += size; }
    byed = order.slice(at);
  }
  if (!groups.length && !resting.length) { await finishTournament(tx, t); return 'finished'; }
  await tx.update(tournaments).set({ currentRound: round }).where(eq(tournaments.id, t.id));
  t.currentRound = round;
  if (groups.length) {
    const made = groups.map((group) => ({ id: randomUUID(), group }));
    await tx.insert(gameTables).values(made.map(({ id, group }) => ({
      id, gameId: t.gameId, gameVersionId: version.id, pace: t.pace, competition: 'friendly' as const, visibility: 'private' as const, status: 'open' as const,
      hostId: group[0]!.userId, capacity: group.length, settings: { turnSeconds: t.turnSeconds, reminders: false, options: t.options, tournament: { id: t.id, round } }
    })));
    await tx.insert(participants).values(made.flatMap(({ id, group }) => group.map((e, seat) => ({ tableId: id, seat, userId: e.userId, kind: 'human' }))));
    await tx.insert(tTables).values(made.map(({ id, group }) => ({ tableId: id, tournamentId: t.id, round, seats: group.map((e, seat) => ({ seat, userId: e.userId })) })));
    // Arrival window: the table starts as soon as everyone is ready, or at this deadline with stand-ins for the absent.
    await tx.insert(scheduledDeadlines).values(made.map(({ id }) => ({ tableId: id, deadlineKey: 'ready', token: randomUUID(), expectedRevision: 0,
      dueAt: sql`now() + make_interval(secs => ${t.arrivalSeconds})` })));
    await tx.insert(outboxEvents).values(made.map(({ id, group }) => ({ topic: 'tournament.round', aggregateId: id,
      payload: { tournamentId: t.id, titleFa: t.titleFa, round, tableId: id, userIds: group.map((e) => e.userId) } })));
    for (const { id } of made) await tx.execute(sql`select pg_notify('table_changed', ${id})`);
  }
  if (byed.length) {
    await tx.update(entries).set({ byes: sql`${entries.byes} + 1`, byeRounds: sql`${entries.byeRounds} || ${JSON.stringify([round])}::jsonb` })
      .where(and(eq(entries.tournamentId, t.id), inArray(entries.userId, byed.map((e) => e.userId))));
  }
  if (byed.length || resting.length) await recomputeStandings(tx, t);
  return 'round';
}

const tournamentOf = (table: { settings: unknown }) => (table.settings as { tournament?: { id: string; round: number } }).tournament;

/** Seats taken by stand-ins: the players are recorded as absent (0 points) and their no-show count goes up. */
async function markAbsent(tx: Tx, tableId: string, tournamentId: string, userIds: string[]) {
  if (!userIds.length) return;
  await tx.update(tTables).set({ absent: sql`(select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements(${tTables.absent} || ${JSON.stringify(userIds)}::jsonb) x)` })
    .where(eq(tTables.tableId, tableId));
  await tx.update(entries).set({ noShows: sql`${entries.noShows} + 1` }).where(and(eq(entries.tournamentId, tournamentId), inArray(entries.userId, userIds)));
}

async function seatBots(tx: Tx, locked: LockedTable, seats: number[]) {
  const { table } = locked;
  await tx.update(participants).set({ kind: 'bot', userId: null, ready: true }).where(and(eq(participants.tableId, table.id), inArray(participants.seat, seats)));
  const cfg = table.settings as { bot?: unknown };
  if (!cfg.bot) {
    table.settings = { ...cfg, bot: { level: STAND_IN_LEVEL, personas: pickPersonas(Math.min(table.capacity, BOT_PERSONAS.length)) } };
    await tx.update(gameTables).set({ settings: table.settings }).where(eq(gameTables.id, table.id));
  }
}

/**
 * The arrival window of a tournament table ended (runs inside the table lock, from the 'ready' deadline). Players who
 * are not ready (or are suspended or disqualified) are absent. Head-to-head tables are forfeited at once: whoever came
 * wins, nobody plays a bot for points. Larger tables: a bot takes the seat when the game has one; otherwise the table
 * plays without them if enough remain.
 */
export async function startTournamentTable(tx: Tx, locked: LockedTable): Promise<void> {
  const { table, module } = locked;
  const tour = tournamentOf(table)!;
  const seats = await tx.select().from(participants).where(eq(participants.tableId, table.id)).orderBy(asc(participants.seat));
  const [tt] = await tx.select({ absent: tTables.absent }).from(tTables).where(eq(tTables.tableId, table.id));
  const absentSeats: typeof seats = [];
  for (const s of seats) if (s.userId && (!s.ready || tt?.absent.includes(s.userId) || await activeSuspension(tx, s.userId))) absentSeats.push(s);
  const absent = absentSeats.map((s) => s.userId!);
  const present = seats.filter((s) => s.userId && !absent.includes(s.userId));
  await markAbsent(tx, table.id, tour.id, absent.filter((u) => !tt?.absent.includes(u)));
  const [game] = await tx.select({ minPlayers: games.minPlayers }).from(games).where(eq(games.id, table.gameId));
  const cancel = async (placements: Placement[]) => closeTable(tx, table.id, placements, [...new Set([...(tt?.absent ?? []), ...absent])]);
  if (!present.length) return cancel(absent.map((userId) => ({ userId, place: 1 })));
  if (absent.length && seats.length === 2) return cancel([...present.map((s) => ({ userId: s.userId!, place: 1 })), ...absent.map((userId) => ({ userId, place: 2 }))]);
  if (absent.length && module.bot) {
    await seatBots(tx, locked, absentSeats.map((s) => s.seat));
  } else if (absent.length) {
    if (present.length < Math.max(2, game?.minPlayers ?? 2)) {
      return cancel([...present.map((s) => ({ userId: s.userId!, place: 1 })), ...absent.map((userId) => ({ userId, place: 2 }))]);
    }
    // Play without them: close the gaps (ascending, so a seat number is always free when it is reused).
    await tx.delete(participants).where(and(eq(participants.tableId, table.id), inArray(participants.seat, absentSeats.map((s) => s.seat))));
    for (const [i, s] of present.entries()) {
      if (s.seat !== i) await tx.update(participants).set({ seat: i }).where(and(eq(participants.tableId, table.id), eq(participants.seat, s.seat)));
    }
    await tx.update(tTables).set({ seats: present.map((s, seat) => ({ seat, userId: s.userId! })) }).where(eq(tTables.tableId, table.id));
    await tx.update(gameTables).set({ capacity: present.length }).where(eq(gameTables.id, table.id));
    table.capacity = present.length;
  }
  await startTable(tx, locked);
}

/**
 * A live tournament player let the move clock run out at a table of three or more: a bot plays the rest of the table
 * for them (0 points), so the others are not stuck. Returns false for head-to-head tables (the game's own timeout rule
 * decides, e.g. chess loses on time) and for games without a bot.
 */
export async function botTakeover(tx: Tx, locked: LockedTable, pendingSeats: number[]): Promise<boolean> {
  const { table, module } = locked;
  const tour = tournamentOf(table);
  if (!tour || table.capacity === 2 || !module.bot || !pendingSeats.length) return false;
  const humans = await tx.select().from(participants)
    .where(and(eq(participants.tableId, table.id), eq(participants.kind, 'human'), inArray(participants.seat, pendingSeats)));
  if (!humans.length) return false;
  await markAbsent(tx, table.id, tour.id, humans.map((h) => h.userId!));
  await seatBots(tx, locked, humans.map((h) => h.seat));
  return true;
}

// ---------------- Scoring ----------------

/** Final places for one table: from the canonical result (seat → player as seated), absent players last. */
async function tablePlacements(tx: Tx, tt: typeof tTables.$inferSelect, status: string): Promise<Placement[]> {
  if (tt.placements) return tt.placements;
  const [res] = status === 'finished' ? await tx.select({ outcome: gameResults.outcome }).from(gameResults).where(eq(gameResults.tableId, tt.tableId)) : [];
  if (!res) return tt.seats.map((s) => ({ userId: s.userId, place: 1 })); // no result: nobody scores (all marked absent below)
  const bySeat = new Map(tt.seats.map((s) => [s.seat, s.userId]));
  const out = (res.outcome as { placements: { seat: number; place: number }[] }).placements
    .map((p) => ({ userId: bySeat.get(p.seat)!, place: p.place })).filter((p) => p.userId);
  const last = Math.max(0, ...out.map((p) => p.place)) + 1;
  // Absent players: a bot played their seat, or the table started without them.
  const gone = tt.absent.filter((u) => !out.some((p) => p.userId === u)).map((userId) => ({ userId, place: last }));
  return [...out.map((p) => (tt.absent.includes(p.userId) ? { ...p, place: last } : p)), ...gone];
}

/** (opponents beaten + ½ × tied) ÷ opponents. Absent players score 0. */
export function tablePoints(placements: Placement[], absent: string[]): Map<string, { points: number; won: boolean; rank: number }> {
  const out = new Map<string, { points: number; won: boolean; rank: number }>();
  const n = placements.length;
  for (const p of placements) {
    const beaten = placements.filter((q) => q.place > p.place).length;
    const tied = placements.filter((q) => q !== p && q.place === p.place).length;
    const gone = absent.includes(p.userId);
    out.set(p.userId, {
      points: gone ? 0 : n > 1 ? (beaten + tied / 2) / (n - 1) : 1,
      won: !gone && n > 1 && tied === 0 && beaten === n - 1,
      rank: 1 + placements.filter((q) => q.place < p.place).length
    });
  }
  return out;
}

/**
 * Swiss tie-breaks. Buchholz: sum of the opponents' points. Sonneborn-Berger: opponents' points weighted by the result
 * against them (win 1, draw ½, loss 0). Byes have no opponent and count for neither.
 */
export function tiebreaks(tables: { placements: Placement[] | null }[], points: ReadonlyMap<string, number>): Map<string, { buchholz: number; sonnebornBerger: number }> {
  const out = new Map<string, { buchholz: number; sonnebornBerger: number }>();
  const of = (u: string) => out.get(u) ?? out.set(u, { buchholz: 0, sonnebornBerger: 0 }).get(u)!;
  for (const tt of tables) {
    for (const p of tt.placements ?? []) {
      for (const q of tt.placements!) {
        if (p === q) continue;
        const r = p.place < q.place ? 1 : p.place === q.place ? 0.5 : 0;
        const theirs = points.get(q.userId) ?? 0;
        const e = of(p.userId);
        e.buchholz += theirs;
        e.sonnebornBerger += r * theirs;
      }
    }
  }
  return out;
}

type Tb = { buchholzCut1: number; buchholz: number; sonnebornBerger: number; aro: number | null; tpr: number | null };

/** Per-player round records for the FIDE ranking (head-to-head Swiss): played games, forfeits and byes. */
function playerRecords(list: Entry[], tables: { round: number; seats: { seat: number; userId: string }[]; absent: string[]; placements: Placement[] | null }[], currentRound: number): PlayerRecord[] {
  const rec = new Map<string, RoundRecord[]>(list.map((e) => [e.userId, [
    ...e.byeRounds.map((round) => ({ round, kind: 'bye' as const, result: 1, opponent: null, side: null })),
    ...e.requestedByes.filter((r) => r <= currentRound).map((round) => ({ round, kind: 'requestedBye' as const, result: 0.5, opponent: null, side: null }))
  ]]));
  for (const tt of tables) {
    if (!tt.placements || tt.seats.length !== 2) continue;
    const pts = tablePoints(tt.placements, tt.absent);
    for (const s of tt.seats) {
      const mine = rec.get(s.userId);
      if (!mine) continue;
      const kind = tt.absent.length === 0 ? 'played' : tt.absent.includes(s.userId) ? 'forfeitLoss' : 'forfeitWin';
      mine.push({ round: tt.round, kind, result: pts.get(s.userId)?.points ?? 0, opponent: tt.seats.find((x) => x.userId !== s.userId)!.userId,
        side: kind === 'played' ? (s.seat === 0 ? 'first' : 'second') : null });
    }
  }
  return list.map((e) => ({ id: e.userId, rounds: rec.get(e.userId)! }));
}

/**
 * Standings order as groups of tied players (best first; disqualified players are left out) plus each player's
 * tie-breaks. Head-to-head Swiss follows the FIDE regulations (swiss-rank.ts); other formats rank by points,
 * Buchholz, Sonneborn-Berger and wins (knockout: elimination round, last table place, points, wins).
 */
function rankPlayers(t: Tournament, all: Entry[], tables: { round: number; seats: { seat: number; userId: string }[]; absent: string[]; placements: Placement[] | null }[]):
  { groups: string[][]; tb: Map<string, Tb>; records: Map<string, RoundRecord[]> } {
  const live = all.filter((e) => !e.disqualifiedAt);
  if (t.format === 'swiss' && t.tableSize === 2) {
    const records = playerRecords(all, tables, t.currentRound);
    const total = t.rounds ?? Math.max(1, t.currentRound);
    // Ratings at the start of the event; ARO applies only if every player had one (FIDE Art. 10).
    const ratings = new Map(all.flatMap((e) => (e.startRating === null ? [] : [[e.userId, e.startRating] as const])));
    const stats = fideStats(records, total, ratings);
    const groups = fideRank(records, total, ratings).map((g) => g.filter((id) => live.some((e) => e.userId === id))).filter((g) => g.length);
    return { groups, tb: stats, records: new Map(records.map((r) => [r.id, r.rounds])) };
  }
  const old = tiebreaks(tables, new Map(all.map((e) => [e.userId, e.points])));
  const tb = new Map(all.map((e) => { const x = old.get(e.userId); return [e.userId, { buchholzCut1: x?.buchholz ?? 0, buchholz: x?.buchholz ?? 0, sonnebornBerger: x?.sonnebornBerger ?? 0, aro: null, tpr: null }]; }));
  // Place at each player's last table breaks ties inside a knockout round (the final decides the podium).
  const lastPlace = new Map<string, number>();
  for (const tt of tables) for (const p of tt.placements ?? []) lastPlace.set(p.userId, p.place);
  const key = (e: Entry): number[] => t.format === 'knockout'
    ? [-(e.eliminatedRound ?? Infinity), lastPlace.get(e.userId) ?? 99, -e.points, -e.wins]
    : [-e.points, -tb.get(e.userId)!.buchholz, -tb.get(e.userId)!.sonnebornBerger, -e.wins];
  const cmp = (a: Entry, b: Entry) => { const ka = key(a), kb = key(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i]! - kb[i]!; return 0; };
  const groups: string[][] = [];
  let prev: Entry | null = null;
  for (const e of [...live].sort(cmp)) {
    if (prev && cmp(prev, e) === 0) groups.at(-1)!.push(e.userId); else groups.push([e.userId]);
    prev = e;
  }
  return { groups, tb, records: new Map() };
}

/** Points and wins are always derived: scored tables + pairing byes (1) + requested byes (½) of rounds already created. */
async function recomputeStandings(tx: Tx, t: Tournament) {
  const tables = await tx.select({ placements: tTables.placements, absent: tTables.absent }).from(tTables).where(and(eq(tTables.tournamentId, t.id), eq(tTables.playoff, false)));
  const sum = new Map<string, { points: number; wins: number }>();
  for (const tt of tables) {
    if (!tt.placements) continue;
    for (const [userId, s] of tablePoints(tt.placements, tt.absent)) {
      const x = sum.get(userId) ?? sum.set(userId, { points: 0, wins: 0 }).get(userId)!;
      x.points += s.points;
      if (s.won) x.wins++;
    }
  }
  const list = await tx.select({ userId: entries.userId, byeRounds: entries.byeRounds, requestedByes: entries.requestedByes }).from(entries).where(eq(entries.tournamentId, t.id));
  const rows = list.map((e) => ({ userId: e.userId, p: (sum.get(e.userId)?.points ?? 0) + e.byeRounds.length + 0.5 * e.requestedByes.filter((r) => r <= t.currentRound).length, w: sum.get(e.userId)?.wins ?? 0 }));
  if (!rows.length) return;
  await tx.execute(sql`update tournament_entries e set points = v.p, wins = v.w
    from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as v("userId" uuid, p double precision, w int)
    where e.tournament_id = ${t.id} and e.user_id = v."userId"`);
}

async function advanceTournament(tx: Tx, registry: GameRegistry, t: Tournament): Promise<'waiting' | 'round' | 'finished'> {
  // Break between rounds: the next one opens when it is over.
  if (t.nextRoundAt) {
    if (t.nextRoundAt.getTime() > Date.now()) return 'waiting';
    await tx.update(tournaments).set({ nextRoundAt: null }).where(eq(tournaments.id, t.id));
    t.nextRoundAt = null;
    return createRound(tx, registry, t, t.currentRound + 1);
  }
  // The decisive game for first place is running: its winner takes first, it never touches the standings.
  if (t.playoffTableId) {
    const [pr] = await tx.select({ tt: tTables, status: gameTables.status }).from(tTables).innerJoin(gameTables, eq(gameTables.id, tTables.tableId)).where(eq(tTables.tableId, t.playoffTableId));
    if (pr && !pr.tt.placements && pr.status !== 'finished' && pr.status !== 'cancelled') return 'waiting';
    let winner: string | undefined;
    if (pr) {
      const placements = await tablePlacements(tx, pr.tt, pr.status);
      const absent = pr.tt.placements || pr.status === 'finished' ? pr.tt.absent : placements.map((p) => p.userId);
      await tx.update(tTables).set({ placements, absent, scoredAt: sql`now()` }).where(eq(tTables.tableId, pr.tt.tableId));
      const firsts = placements.filter((p) => p.place === 1 && !absent.includes(p.userId));
      if (firsts.length === 1) winner = firsts[0]!.userId;
    }
    await finishTournament(tx, t, winner);
    return 'finished';
  }
  const rows = await tx.select({ tt: tTables, status: gameTables.status }).from(tTables).innerJoin(gameTables, eq(gameTables.id, tTables.tableId))
    .where(and(eq(tTables.tournamentId, t.id), eq(tTables.round, t.currentRound)));
  if (rows.some((r) => !r.tt.placements && r.status !== 'finished' && r.status !== 'cancelled')) return 'waiting';
  const aliveBefore = (await aliveEntries(tx, t.id)).length;
  const knockedOut: string[] = [];
  const unscored = rows.filter((r) => !r.tt.scoredAt);
  for (const { tt, status } of unscored) {
    const placements = await tablePlacements(tx, tt, status);
    const absent = tt.placements || status === 'finished' ? tt.absent : placements.map((p) => p.userId);
    for (const [userId, s] of tablePoints(placements, absent)) if (t.format === 'knockout' && (absent.includes(userId) || s.rank > t.advance)) knockedOut.push(userId);
    await tx.update(tTables).set({ placements, absent, scoredAt: sql`now()` }).where(eq(tTables.tableId, tt.tableId));
  }
  if (unscored.length) {
    await recomputeStandings(tx, t);
    const out = t.format === 'knockout' ? inArray(entries.userId, knockedOut.length ? knockedOut : [randomUUID()]) : sql`${entries.noShows} >= ${NO_SHOW_LIMIT}`;
    await tx.update(entries).set({ eliminatedRound: t.currentRound }).where(and(eq(entries.tournamentId, t.id), eq(entries.status, 'registered'), isNull(entries.eliminatedRound), out));
  }
  const alive = (await aliveEntries(tx, t.id)).length;
  // A knockout final: the round had one table and every remaining player sat at it (no byes).
  const only = rows.length === 1 ? rows[0]!.tt : null;
  const wasFinal = t.format === 'knockout' && !!only && new Set([...only.seats.map((s) => s.userId), ...only.absent]).size >= aliveBefore;
  const done = t.format === 'swiss' ? t.currentRound >= (t.rounds ?? 1) : wasFinal || alive <= 1;
  if (done && t.format === 'swiss' && t.playoff === 'armageddon' && await startPlayoff(tx, registry, t)) return 'waiting';
  if (done || alive < 2 || t.currentRound >= MAX_ROUNDS) { await finishTournament(tx, t); return 'finished'; }
  if (t.roundGapSeconds > 0) {
    t.nextRoundAt = new Date(Date.now() + t.roundGapSeconds * 1000);
    await tx.update(tournaments).set({ nextRoundAt: t.nextRoundAt }).where(eq(tournaments.id, t.id));
    return 'waiting';
  }
  return createRound(tx, registry, t, t.currentRound + 1);
}

/** Time bank of the Armageddon game: the host (White) has 5 minutes, the guest (Black) 4 and wins a draw. */
const ARMAGEDDON_CLOCK = '5/4+0';

/**
 * Two players are still level for first place after every tie-break: they play one decisive game (draw = Black wins,
 * colours drawn by lot). The game is a table like any other (same arrival window, forfeits, spectators, record), but
 * outside the standings. Returns false when there is nothing to play off.
 */
async function startPlayoff(tx: Tx, registry: GameRegistry, t: Tournament): Promise<boolean> {
  const all = await tx.select().from(entries).where(and(eq(entries.tournamentId, t.id), eq(entries.status, 'registered')));
  const tables = (await tx.select().from(tTables).where(eq(tTables.tournamentId, t.id))).filter((x) => !x.playoff);
  const top = rankPlayers(t, all, tables).groups[0];
  if (top?.length !== 2) return false;
  const [white, black] = shuffle(top) as [string, string];
  const { version } = await activeVersion(tx, registry, t.gameId);
  const round = t.currentRound + 1;
  const tableId = randomUUID();
  await tx.insert(gameTables).values({
    id: tableId, gameId: t.gameId, gameVersionId: version.id, pace: 'live', competition: 'friendly', visibility: 'private', status: 'open', hostId: white, capacity: 2,
    settings: { turnSeconds: t.pace === 'live' ? t.turnSeconds : 60, reminders: false, options: { ...t.options, clock: ARMAGEDDON_CLOCK, firstMove: 'host', armageddon: true, minDrawMove: 'none' }, tournament: { id: t.id, round } }
  });
  await tx.insert(participants).values([{ tableId, seat: 0, userId: white, kind: 'human' }, { tableId, seat: 1, userId: black, kind: 'human' }]);
  await tx.insert(tTables).values({ tableId, tournamentId: t.id, round, playoff: true, seats: [{ seat: 0, userId: white }, { seat: 1, userId: black }] });
  await tx.insert(scheduledDeadlines).values({ tableId, deadlineKey: 'ready', token: randomUUID(), expectedRevision: 0, dueAt: sql`now() + make_interval(secs => ${t.arrivalSeconds})` });
  await tx.insert(outboxEvents).values({ topic: 'tournament.round', aggregateId: tableId, payload: { tournamentId: t.id, titleFa: t.titleFa, round, tableId, userIds: [white, black] } });
  await tx.update(tournaments).set({ currentRound: round, playoffTableId: tableId }).where(eq(tournaments.id, t.id));
  t.currentRound = round;
  t.playoffTableId = tableId;
  await tx.execute(sql`select pg_notify('table_changed', ${tableId})`);
  return true;
}

/**
 * Final ranks, prizes paid once, notifications. Runs under the tournament row lock. Order: see `rankPlayers`. Players
 * still tied share a rank and split the prizes of the places they occupy. Disqualified players are not ranked and win nothing.
 */
async function finishTournament(tx: Tx, t: Tournament, playoffWinner?: string) {
  const all = await tx.select().from(entries).where(and(eq(entries.tournamentId, t.id), eq(entries.status, 'registered')));
  const tables = (await tx.select().from(tTables).where(eq(tTables.tournamentId, t.id)).orderBy(asc(tTables.round))).filter((x) => !x.playoff);
  const { groups, tb } = rankPlayers(t, all, tables);
  // The playoff winner takes first place of the two who were level.
  const lead = groups[0];
  if (playoffWinner && lead?.length === 2 && lead.includes(playoffWinner)) groups.splice(0, 1, [playoffWinner], lead.filter((x) => x !== playoffWinner));
  const ranks = new Map<string, number>();
  let next = 1;
  for (const g of groups) { for (const id of g) ranks.set(id, next); next += g.length; }
  if (all.length) {
    const rows = all.map((e) => ({ userId: e.userId, r: ranks.get(e.userId) ?? null, c1: tb.get(e.userId)?.buchholzCut1 ?? 0, bh: tb.get(e.userId)?.buchholz ?? 0, sb: tb.get(e.userId)?.sonnebornBerger ?? 0 }));
    await tx.execute(sql`update tournament_entries e set final_rank = v.r, buchholz_cut1 = v.c1, buchholz = v.bh, sonneborn_berger = v.sb
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as v("userId" uuid, r int, c1 double precision, bh double precision, sb double precision)
      where e.tournament_id = ${t.id} and e.user_id = v."userId"`);
  }
  const sharing = new Map<number, string[]>();
  for (const [userId, rank] of ranks) sharing.set(rank, [...(sharing.get(rank) ?? []), userId]);
  for (const [rank, userIds] of sharing) {
    const share = (f: 'coins' | 'premiumDays') => Math.floor(t.prizes.filter((p) => p.place >= rank && p.place < rank + userIds.length).reduce((s, p) => s + p[f], 0) / userIds.length);
    const coins = share('coins'), premiumDays = share('premiumDays');
    for (const userId of userIds) {
      if (coins > 0) {
        await tx.insert(coinLedger).values({ userId, amount: coins, ruleId: 'tournament.prize', reason: `جایزهٔ رتبهٔ ${rank.toLocaleString('fa-IR')} «${t.titleFa}».`,
          sourceKey: `tournament-prize:${t.id}:${userId}`, metadata: { tournamentId: t.id, rank } }).onConflictDoNothing({ target: coinLedger.sourceKey });
      }
      if (premiumDays > 0) {
        await tx.insert(entitlements).values({ userId, key: 'premium', source: 'tournament', sourceId: t.id, startsAt: new Date(),
          endsAt: new Date(Date.now() + premiumDays * 86400_000), reason: `جایزهٔ «${t.titleFa}»` });
      }
    }
  }
  await tx.update(tournaments).set({ status: 'finished', finishedAt: sql`now()`, nextRoundAt: null }).where(eq(tournaments.id, t.id));
  t.status = 'finished';
  await tx.insert(outboxEvents).values({ topic: 'tournament.finished', aggregateId: t.id,
    payload: { tournamentId: t.id, titleFa: t.titleFa, ranks: [...ranks].map(([userId, rank]) => ({ userId, rank })) } });
}

/** Reminder when the check-in window is about to close: this many minutes before the start (at most half the window). */
const CHECKIN_REMINDER_MINUTES = 5;

/**
 * Tell registered players who have not confirmed yet that check-in is open (once, when the window opens) and, shortly
 * before the start, that it is about to close (once more). Each notice is recorded on the tournament row, so a worker
 * restart or a second worker never repeats it.
 */
export async function notifyCheckins(db: Db): Promise<number> {
  const due = await db.select({ id: tournaments.id }).from(tournaments)
    .where(and(eq(tournaments.status, 'open'), sql`${tournaments.checkinMinutes} > 0`, sql`${tournaments.startsAt} > now()`,
      sql`${tournaments.startsAt} - make_interval(mins => ${tournaments.checkinMinutes}) <= now()`,
      or(isNull(tournaments.checkinNotifiedAt), isNull(tournaments.checkinRemindedAt))));
  let sent = 0;
  for (const { id } of due) {
    sent += await db.transaction(async (tx) => {
      const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).for('update');
      if (!t || t.status !== 'open' || t.startsAt.getTime() <= Date.now()) return 0;
      const minutesLeft = Math.ceil((t.startsAt.getTime() - Date.now()) / 60_000);
      const reminder = t.checkinNotifiedAt !== null && t.checkinRemindedAt === null && minutesLeft <= Math.min(CHECKIN_REMINDER_MINUTES, t.checkinMinutes / 2);
      if (t.checkinNotifiedAt !== null && !reminder) return 0;
      await tx.update(tournaments).set(reminder ? { checkinRemindedAt: sql`now()` } : { checkinNotifiedAt: sql`now()` }).where(eq(tournaments.id, id));
      const missing = await tx.select({ userId: entries.userId }).from(entries)
        .where(and(eq(entries.tournamentId, id), eq(entries.status, 'registered'), isNull(entries.checkedInAt)));
      if (!missing.length) return 0;
      await tx.insert(outboxEvents).values({ topic: 'tournament.checkin', aggregateId: id,
        payload: { tournamentId: id, titleFa: t.titleFa, userIds: missing.map((m) => m.userId), minutesLeft, reminder } });
      return missing.length;
    });
  }
  return sent;
}

/** Worker: start (or cancel) tournaments at their start time, and move running ones to the next round. */
export async function runTournaments(db: Db, registry: GameRegistry) {
  await notifyCheckins(db);
  const due = await db.select({ id: tournaments.id }).from(tournaments)
    .where(or(and(eq(tournaments.status, 'open'), lte(tournaments.startsAt, sql`now()`)), eq(tournaments.status, 'running')));
  const counts = { started: 0, cancelled: 0, rounds: 0, finished: 0 };
  for (const { id } of due) {
    const r = await db.transaction(async (tx) => {
      const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).for('update');
      if (t?.status === 'open' && t.startsAt.getTime() <= Date.now()) {
        if (t.checkinMinutes > 0) {
          // Whoever did not confirm attendance is out, with the entry fee back.
          const missing = await tx.select().from(entries).where(and(eq(entries.tournamentId, t.id), eq(entries.status, 'registered'), isNull(entries.checkedInAt)));
          for (const e of missing) {
            await tx.update(entries).set({ status: 'withdrawn' }).where(and(eq(entries.tournamentId, t.id), eq(entries.userId, e.userId)));
            await refundEntry(tx, t, e, 'تأیید حضور انجام نشد');
          }
        }
        const n = await entrantCount(tx, t.id);
        if (n < t.minEntrants) { await cancelTournament(tx, t, 'تعداد ثبت‌نام‌ها به حد نصاب نرسید.'); return 'cancelled'; }
        // A head-to-head Swiss cannot have more rounds than opponents.
        const rounds = t.format === 'swiss' && t.tableSize === 2 && t.rounds ? Math.max(1, Math.min(t.rounds, n - 1)) : t.rounds;
        await tx.update(tournaments).set({ status: 'running', rounds }).where(eq(tournaments.id, t.id));
        t.status = 'running';
        t.rounds = rounds;
        // Ratings at the start (used by the ARO tie-break; later changes, e.g. by an admin, do not alter the event).
        await tx.execute(sql`update tournament_entries e set start_rating = round((60 * r.mu)::numeric)::int
          from ratings r where e.tournament_id = ${t.id} and e.status = 'registered' and r.user_id = e.user_id and r.game_id = ${t.gameId} and r.mode = ${ratingModeOf(t.pace, t.options)}`);
        return (await createRound(tx, registry, t, 1)) === 'round' ? 'started' : 'finished';
      }
      if (t?.status === 'running') return advanceTournament(tx, registry, t);
      return 'waiting';
    });
    if (r === 'started') counts.started++;
    if (r === 'cancelled') counts.cancelled++;
    if (r === 'round') counts.rounds++;
    if (r === 'finished') counts.finished++;
  }
  return counts;
}

// ---------------- Views ----------------

const profile = (u: typeof users.$inferSelect) => ({ id: u.id, displayName: u.displayName, avatarKey: u.avatarKey as never, joinedAt: u.createdAt.toISOString() });

function toSummary(t: Tournament, gameNameFa: string, entrants: number, registered: boolean): TournamentSummary {
  return {
    id: t.id, gameId: t.gameId, gameNameFa, titleFa: t.titleFa, format: t.format, status: t.status, pace: t.pace, turnSeconds: t.turnSeconds, tableSize: t.tableSize,
    rounds: t.rounds, advance: t.advance, startsAt: t.startsAt.toISOString(), entrants, minEntrants: t.minEntrants, maxEntrants: t.maxEntrants,
    entryKind: t.entryKind, entryAmount: t.entryAmount, prizes: t.prizes, currentRound: t.currentRound, registered
  };
}

/** Open and running tournaments, then those that ended in the last 30 days. */
export async function listTournaments(db: Db, userId: string | null): Promise<TournamentSummary[]> {
  const rows = await db.select({ t: tournaments, gameNameFa: games.nameFa,
    entrants: sql<number>`(select count(*)::int from tournament_entries e where e.tournament_id = ${tournaments.id} and e.status = 'registered')`,
    mine: userId ? sql<boolean>`exists (select 1 from tournament_entries e where e.tournament_id = ${tournaments.id} and e.user_id = ${userId} and e.status = 'registered')` : sql<boolean>`false` })
    .from(tournaments).innerJoin(games, eq(games.id, tournaments.gameId))
    .where(or(inArray(tournaments.status, ['open', 'running']), sql`${tournaments.finishedAt} > now() - interval '30 days'`))
    .orderBy(sql`case ${tournaments.status} when 'running' then 0 when 'open' then 1 else 2 end`, asc(tournaments.startsAt)).limit(100);
  return rows.map((r) => toSummary(r.t, r.gameNameFa, r.entrants, r.mine));
}

/** `roundSel`: the one round whose tables are returned (default: the current round, else the last). Standings are always complete. */
export async function tournamentDetail(db: Db, billing: BillingConfig, id: string, userId: string | null, roundSel?: number): Promise<TournamentDetail> {
  const [row] = await db.select({ t: tournaments, gameNameFa: games.nameFa }).from(tournaments).innerJoin(games, eq(games.id, tournaments.gameId)).where(eq(tournaments.id, id));
  if (!row) throw new AppError('NOT_FOUND');
  const { t } = row;
  const list = await db.select({ e: entries, u: users }).from(entries).innerJoin(users, eq(users.id, entries.userId))
    .where(and(eq(entries.tournamentId, id), eq(entries.status, 'registered')));
  const tables = await db.select({ tt: tTables, status: gameTables.status }).from(tTables).innerJoin(gameTables, eq(gameTables.id, tTables.tableId))
    .where(eq(tTables.tournamentId, id)).orderBy(asc(tTables.round));
  const roundCount = tables.reduce((m, r) => Math.max(m, r.tt.round), 0);
  const wanted = roundSel ?? (t.currentRound || roundCount);
  const shown = tables.filter((r) => r.tt.round === wanted);
  const { groups, tb, records } = rankPlayers(t, list.map(({ e }) => e), tables.map((r) => r.tt).filter((x) => !x.playoff));
  const position = new Map(groups.flatMap((g, i) => g.map((id) => [id, i] as const)));
  const cut1 = (u: string) => tb.get(u)?.buchholzCut1 ?? 0, bh = (u: string) => tb.get(u)?.buchholz ?? 0, sb = (u: string) => tb.get(u)?.sonnebornBerger ?? 0;
  list.sort((a, b) => (a.e.disqualifiedAt ? 1 : 0) - (b.e.disqualifiedAt ? 1 : 0) || (position.get(a.e.userId) ?? 1e9) - (position.get(b.e.userId) ?? 1e9)
    || a.e.createdAt.getTime() - b.e.createdAt.getTime());
  const people = new Map(list.map(({ u }) => [u.id, u]));
  const missing = [...new Set(shown.flatMap((r) => r.tt.seats.map((s) => s.userId)))].filter((u) => !people.has(u));
  if (missing.length) for (const u of await db.select().from(users).where(inArray(users.id, missing))) people.set(u.id, u);
  const rounds = new Map<number, TournamentDetail['roundsPlayed'][number]['tables']>();
  for (const { tt, status } of shown) {
    const place = new Map((tt.placements ?? []).map((p) => [p.userId, p.place]));
    const players = [...tt.seats.map((s) => s.userId), ...tt.absent.filter((u) => !tt.seats.some((s) => s.userId === u))]
      .filter((u) => people.has(u)).map((u) => ({ player: profile(people.get(u)!), place: place.get(u) ?? null, absent: tt.absent.includes(u) }));
    (rounds.get(tt.round) ?? rounds.set(tt.round, []).get(tt.round)!).push({ tableId: tt.tableId, status, overridden: tt.overridden, playoff: tt.playoff, players });
  }
  // Boards worth following: the highest combined score among the tables of the current round that are being played.
  const pointsOf = new Map(list.map(({ e }) => [e.userId, e.points]));
  const featured = t.status !== 'running' ? [] : tables.filter(({ tt, status }) => tt.round === t.currentRound && status === 'active')
    .map(({ tt, status }) => ({ tt, status, sum: tt.seats.reduce((n, s) => n + (pointsOf.get(s.userId) ?? 0), 0) }))
    .sort((a, b) => b.sum - a.sum).slice(0, 3)
    .map(({ tt, status }) => ({ tableId: tt.tableId, status, players: tt.seats.filter((s) => people.has(s.userId)).map((s) => ({ player: profile(people.get(s.userId)!), points: pointsOf.get(s.userId) ?? 0 })) }));
  let me: TournamentDetail['me'] = null;
  if (userId) {
    const mine = list.find(({ e }) => e.userId === userId)?.e;
    const current = tables.find(({ tt, status }) => tt.round === t.currentRound && (status === 'open' || status === 'active')
      && tt.seats.some((s) => s.userId === userId) && !tt.absent.includes(userId));
    const [refund] = await db.select({ status: refunds.status }).from(refunds).where(and(eq(refunds.tournamentId, id), eq(refunds.userId, userId)))
      .orderBy(desc(refunds.createdAt)).limit(1);
    me = { registered: !!mine, tableId: current?.tt.tableId ?? null, refundStatus: refund?.status ?? null, checkedIn: !!mine?.checkedInAt,
      requestedByes: mine?.requestedByes ?? [], disqualified: !!mine?.disqualifiedAt };
  }
  return {
    ...toSummary(t, row.gameNameFa, list.length, !!me?.registered),
    descriptionFa: t.descriptionFa, arrivalSeconds: t.arrivalSeconds, cancelReason: t.cancelReason, finishedAt: t.finishedAt?.toISOString() ?? null,
    options: t.options, playoff: t.playoff, checkinMinutes: t.checkinMinutes, roundGapSeconds: t.roundGapSeconds, nextRoundAt: t.nextRoundAt?.toISOString() ?? null,
    standings: list.map(({ e, u }) => ({ player: profile(u), points: e.points, wins: e.wins, byes: e.byes, noShows: e.noShows, eliminatedRound: e.eliminatedRound,
      finalRank: e.finalRank, buchholzCut1: cut1(e.userId), aro: tb.get(e.userId)?.aro ?? null, startRating: e.startRating, tpr: tb.get(e.userId)?.tpr ?? null,
      results: (records.get(e.userId) ?? []).sort((x, y) => x.round - y.round).map((r) => ({ round: r.round, opponentId: r.opponent, result: r.result, kind: r.kind, side: r.side })), buchholz: bh(e.userId), sonnebornBerger: sb(e.userId), disqualified: !!e.disqualifiedAt, checkedIn: !!e.checkedInAt })),
    roundCount,
    featured,
    roundsPlayed: [...rounds].map(([round, tables]) => ({ round, tables })),
    me,
    checkout: { available: !!billing.gateway, reasonFa: billing.unavailableReasonFa, fixture: !!billing.gateway?.isFixture }
  };
}
