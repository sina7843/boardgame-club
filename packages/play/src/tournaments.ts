// Tournaments: admin-created Swiss or knockout events built from ordinary tables. Rules stay in the game modules;
// this file only seats players, scores finished tables from the canonical result and moves rounds along.
// Prizes are fixed by the admin and paid by the platform; they never come from entry fees.
import { randomInt, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { AppError, BOT_PERSONAS, type CreateTournamentBody, type TournamentDetail, type TournamentSummary } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { GameRegistry } from '@bg/game-engine';
import { checkout, isPremium, type BillingConfig } from './billing.ts';
import { coinBalance, lockCoins } from './coins.ts';
import { assertTimeAllowed } from './game-settings.ts';
import type { LockedTable, Tx } from './runtime.ts';
import { activeSuspension } from './sanctions.ts';
import { activeVersion, pickPersonas, startTable } from './tables.ts';

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
    if (body.format === 'knockout' && body.advance >= body.tableSize) throw invalid();
    if ((body.entryKind === 'free') !== (body.entryAmount === 0)) throw invalid();
    if (Date.parse(body.startsAt) < Date.now() + 60_000) throw invalid();
    if (new Set(body.prizes.map((p) => p.place)).size !== body.prizes.length || body.prizes.some((p) => p.place > body.maxEntrants)) throw invalid();
    const [t] = await tx.insert(tournaments).values({
      gameId: body.gameId, titleFa: body.titleFa, descriptionFa: body.descriptionFa, format: body.format, pace: body.pace, turnSeconds: body.turnSeconds,
      tableSize: body.tableSize, rounds: body.format === 'swiss' ? body.rounds! : null, advance: body.format === 'knockout' ? body.advance : 1,
      minEntrants: body.minEntrants, maxEntrants: body.maxEntrants, startsAt: new Date(body.startsAt), arrivalSeconds: body.arrivalSeconds,
      entryKind: body.entryKind, entryAmount: body.entryAmount, prizes: [...body.prizes].sort((a, b) => a.place - b.place), createdBy: adminId
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

const enter = (tx: Tx, tournamentId: string, userId: string, paid: { coinLedgerId?: string; paymentId?: string }) =>
  tx.insert(entries).values({ tournamentId, userId, coinLedgerId: paid.coinLedgerId ?? null, paymentId: paid.paymentId ?? null })
    .onConflictDoUpdate({ target: [entries.tournamentId, entries.userId],
      set: { status: 'registered', coinLedgerId: paid.coinLedgerId ?? null, paymentId: paid.paymentId ?? null, createdAt: sql`now()` } });

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
    await enter(tx, t.id, userId, { coinLedgerId });
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
  if (seat) await enter(tx, p.tournamentId, p.userId, { paymentId: p.id });
  else await queueRefund(tx, p.tournamentId, p.userId, p.id, mine?.status === 'registered' ? 'پرداخت تکراری' : 'تورنمنت پیش از تأیید پرداخت بسته یا پر شد');
}

// ---------------- Rounds ----------------

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

async function aliveEntries(tx: Tx, id: string) {
  return tx.select().from(entries).where(and(eq(entries.tournamentId, id), eq(entries.status, 'registered'), isNull(entries.eliminatedRound)));
}

async function createRound(tx: Tx, registry: GameRegistry, t: Tournament, round: number): Promise<'round' | 'finished'> {
  const alive = await aliveEntries(tx, t.id);
  const { version, settings } = await activeVersion(tx, registry, t.gameId);
  // Swiss: equal scores meet (a stable sort keeps the shuffle among ties). Knockout: a fresh draw each round.
  const order = t.format === 'swiss' ? shuffle(alive).sort((a, b) => b.points - a.points) : shuffle(alive);
  const { sizes } = groupSizes(order.length, t.tableSize, settings.minPlayers);
  if (!sizes.length) { await finishTournament(tx, t); return 'finished'; }
  await tx.update(tournaments).set({ currentRound: round }).where(eq(tournaments.id, t.id));
  t.currentRound = round;
  let at = 0;
  for (const size of sizes) {
    const group = order.slice(at, at + size);
    at += size;
    const tableId = randomUUID();
    await tx.insert(gameTables).values({
      id: tableId, gameId: t.gameId, gameVersionId: version.id, pace: t.pace, competition: 'friendly', visibility: 'private', status: 'open',
      hostId: group[0]!.userId, capacity: size, settings: { turnSeconds: t.turnSeconds, reminders: false, tournament: { id: t.id, round } }
    });
    await tx.insert(participants).values(group.map((e, seat) => ({ tableId, seat, userId: e.userId, kind: 'human' })));
    await tx.insert(tTables).values({ tableId, tournamentId: t.id, round, seats: group.map((e, seat) => ({ seat, userId: e.userId })) });
    // Arrival window: the table starts as soon as everyone is ready, or at this deadline with stand-ins for the absent.
    await tx.insert(scheduledDeadlines).values({ tableId, deadlineKey: 'ready', token: randomUUID(), expectedRevision: 0,
      dueAt: sql`now() + make_interval(secs => ${t.arrivalSeconds})` });
    await tx.insert(outboxEvents).values({ topic: 'tournament.round', aggregateId: tableId,
      payload: { tournamentId: t.id, titleFa: t.titleFa, round, tableId, userIds: group.map((e) => e.userId) } });
    await tx.execute(sql`select pg_notify('table_changed', ${tableId})`);
  }
  const byed = order.slice(at);
  if (byed.length) {
    await tx.update(entries).set({ points: sql`${entries.points} + 1`, byes: sql`${entries.byes} + 1` })
      .where(and(eq(entries.tournamentId, t.id), inArray(entries.userId, byed.map((e) => e.userId))));
  }
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
 * are not ready (or are suspended) are absent: a bot takes their seat when the game has one; otherwise the table
 * plays without them if enough remain, and if not, whoever came wins by forfeit.
 */
export async function startTournamentTable(tx: Tx, locked: LockedTable): Promise<void> {
  const { table, module } = locked;
  const tour = tournamentOf(table)!;
  const seats = await tx.select().from(participants).where(eq(participants.tableId, table.id)).orderBy(asc(participants.seat));
  const absentSeats: typeof seats = [];
  for (const s of seats) if (s.userId && (!s.ready || await activeSuspension(tx, s.userId))) absentSeats.push(s);
  const absent = absentSeats.map((s) => s.userId!);
  const present = seats.filter((s) => s.userId && !absent.includes(s.userId));
  await markAbsent(tx, table.id, tour.id, absent);
  const [game] = await tx.select({ minPlayers: games.minPlayers }).from(games).where(eq(games.id, table.gameId));
  const cancel = async (placements: Placement[]) => {
    await tx.update(gameTables).set({ status: 'cancelled' }).where(eq(gameTables.id, table.id));
    await tx.update(tTables).set({ placements }).where(eq(tTables.tableId, table.id));
    await tx.execute(sql`select pg_notify('table_changed', ${table.id})`);
  };
  if (!present.length) return cancel(absent.map((userId) => ({ userId, place: 1 })));
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
 * A live tournament player let the move clock run out: a bot plays the rest of the table for them (0 points), so the
 * others are not stuck. Returns false when the game has no bot (the module's own timeout rule applies).
 */
export async function botTakeover(tx: Tx, locked: LockedTable, pendingSeats: number[]): Promise<boolean> {
  const { table, module } = locked;
  const tour = tournamentOf(table);
  if (!tour || !module.bot || !pendingSeats.length) return false;
  const humans = await tx.select().from(participants)
    .where(and(eq(participants.tableId, table.id), eq(participants.kind, 'human'), inArray(participants.seat, pendingSeats)));
  if (!humans.length) return false;
  await markAbsent(tx, table.id, tour.id, humans.map((h) => h.userId!));
  await seatBots(tx, locked, humans.map((h) => h.seat));
  return true;
}

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

async function advanceTournament(tx: Tx, registry: GameRegistry, t: Tournament): Promise<'waiting' | 'round' | 'finished'> {
  const rows = await tx.select({ tt: tTables, status: gameTables.status }).from(tTables).innerJoin(gameTables, eq(gameTables.id, tTables.tableId))
    .where(and(eq(tTables.tournamentId, t.id), eq(tTables.round, t.currentRound)));
  if (rows.some((r) => !r.tt.placements && r.status !== 'finished' && r.status !== 'cancelled')) return 'waiting';
  const aliveBefore = (await aliveEntries(tx, t.id)).length;
  for (const { tt, status } of rows.filter((r) => !r.tt.scoredAt)) {
    const placements = await tablePlacements(tx, tt, status);
    const absent = tt.placements || status === 'finished' ? tt.absent : placements.map((p) => p.userId);
    const scores = tablePoints(placements, absent);
    for (const [userId, s] of scores) {
      const [e] = await tx.select().from(entries).where(and(eq(entries.tournamentId, t.id), eq(entries.userId, userId)));
      if (!e) continue;
      const out = t.format === 'knockout' ? absent.includes(userId) || s.rank > t.advance : e.noShows >= NO_SHOW_LIMIT;
      await tx.update(entries).set({ points: e.points + s.points, wins: e.wins + (s.won ? 1 : 0), ...(out && e.eliminatedRound === null ? { eliminatedRound: t.currentRound } : {}) })
        .where(and(eq(entries.tournamentId, t.id), eq(entries.userId, userId)));
    }
    await tx.update(tTables).set({ placements, absent, scoredAt: sql`now()` }).where(eq(tTables.tableId, tt.tableId));
  }
  const alive = (await aliveEntries(tx, t.id)).length;
  // A knockout final: the round had one table and every remaining player sat at it (no byes).
  const only = rows.length === 1 ? rows[0]!.tt : null;
  const wasFinal = t.format === 'knockout' && !!only && new Set([...only.seats.map((s) => s.userId), ...only.absent]).size >= aliveBefore;
  const done = t.format === 'swiss' ? t.currentRound >= (t.rounds ?? 1) : wasFinal || alive <= 1;
  if (done || alive < 2 || t.currentRound >= MAX_ROUNDS) { await finishTournament(tx, t); return 'finished'; }
  return createRound(tx, registry, t, t.currentRound + 1);
}

/** Final ranks (ties share a rank), prizes paid once, notifications. Runs under the tournament row lock. */
async function finishTournament(tx: Tx, t: Tournament) {
  const all = await tx.select().from(entries).where(and(eq(entries.tournamentId, t.id), eq(entries.status, 'registered')));
  // Place at each player's last table breaks ties inside a knockout round (the final decides the podium).
  const lastPlace = new Map<string, number>();
  for (const tt of await tx.select().from(tTables).where(eq(tTables.tournamentId, t.id)).orderBy(asc(tTables.round))) {
    for (const p of tt.placements ?? []) lastPlace.set(p.userId, p.place);
  }
  const key = (e: Entry): number[] => t.format === 'knockout'
    ? [-(e.eliminatedRound ?? Infinity), lastPlace.get(e.userId) ?? 99, -e.points, -e.wins]
    : [-e.points, -e.wins];
  const cmp = (a: Entry, b: Entry) => { const ka = key(a), kb = key(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i]! - kb[i]!; return 0; };
  const sorted = [...all].sort(cmp);
  const ranks = new Map<string, number>();
  sorted.forEach((e, i) => ranks.set(e.userId, i > 0 && cmp(e, sorted[i - 1]!) === 0 ? ranks.get(sorted[i - 1]!.userId)! : i + 1));
  for (const [userId, finalRank] of ranks) await tx.update(entries).set({ finalRank }).where(and(eq(entries.tournamentId, t.id), eq(entries.userId, userId)));
  for (const prize of t.prizes) {
    for (const [userId, rank] of ranks) {
      if (rank !== prize.place) continue;
      if (prize.coins > 0) {
        await tx.insert(coinLedger).values({ userId, amount: prize.coins, ruleId: 'tournament.prize', reason: `جایزهٔ رتبهٔ ${rank.toLocaleString('fa-IR')} «${t.titleFa}».`,
          sourceKey: `tournament-prize:${t.id}:${userId}`, metadata: { tournamentId: t.id, rank } }).onConflictDoNothing({ target: coinLedger.sourceKey });
      }
      if (prize.premiumDays > 0) {
        await tx.insert(entitlements).values({ userId, key: 'premium', source: 'tournament', sourceId: t.id, startsAt: new Date(),
          endsAt: new Date(Date.now() + prize.premiumDays * 86400_000), reason: `جایزهٔ «${t.titleFa}»` });
      }
    }
  }
  await tx.update(tournaments).set({ status: 'finished', finishedAt: sql`now()` }).where(eq(tournaments.id, t.id));
  t.status = 'finished';
  await tx.insert(outboxEvents).values({ topic: 'tournament.finished', aggregateId: t.id,
    payload: { tournamentId: t.id, titleFa: t.titleFa, ranks: [...ranks].map(([userId, rank]) => ({ userId, rank })) } });
}

/** Worker: start (or cancel) tournaments at their start time, and move running ones to the next round. */
export async function runTournaments(db: Db, registry: GameRegistry) {
  const due = await db.select({ id: tournaments.id }).from(tournaments)
    .where(or(and(eq(tournaments.status, 'open'), lte(tournaments.startsAt, sql`now()`)), eq(tournaments.status, 'running')));
  const counts = { started: 0, cancelled: 0, rounds: 0, finished: 0 };
  for (const { id } of due) {
    const r = await db.transaction(async (tx) => {
      const [t] = await tx.select().from(tournaments).where(eq(tournaments.id, id)).for('update');
      if (t?.status === 'open' && t.startsAt.getTime() <= Date.now()) {
        if ((await entrantCount(tx, t.id)) < t.minEntrants) { await cancelTournament(tx, t, 'تعداد ثبت‌نام‌ها به حد نصاب نرسید.'); return 'cancelled'; }
        await tx.update(tournaments).set({ status: 'running' }).where(eq(tournaments.id, t.id));
        t.status = 'running';
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

export async function tournamentDetail(db: Db, billing: BillingConfig, id: string, userId: string | null): Promise<TournamentDetail> {
  const [row] = await db.select({ t: tournaments, gameNameFa: games.nameFa }).from(tournaments).innerJoin(games, eq(games.id, tournaments.gameId)).where(eq(tournaments.id, id));
  if (!row) throw new AppError('NOT_FOUND');
  const { t } = row;
  const list = await db.select({ e: entries, u: users }).from(entries).innerJoin(users, eq(users.id, entries.userId))
    .where(and(eq(entries.tournamentId, id), eq(entries.status, 'registered')))
    .orderBy(sql`${entries.finalRank} asc nulls last`, desc(entries.points), desc(entries.wins), asc(entries.createdAt));
  const tables = await db.select({ tt: tTables, status: gameTables.status }).from(tTables).innerJoin(gameTables, eq(gameTables.id, tTables.tableId))
    .where(eq(tTables.tournamentId, id)).orderBy(asc(tTables.round));
  const people = new Map(list.map(({ u }) => [u.id, u]));
  const missing = [...new Set(tables.flatMap((r) => r.tt.seats.map((s) => s.userId)))].filter((u) => !people.has(u));
  if (missing.length) for (const u of await db.select().from(users).where(inArray(users.id, missing))) people.set(u.id, u);
  const rounds = new Map<number, TournamentDetail['roundsPlayed'][number]['tables']>();
  for (const { tt, status } of tables) {
    const place = new Map((tt.placements ?? []).map((p) => [p.userId, p.place]));
    const players = [...tt.seats.map((s) => s.userId), ...tt.absent.filter((u) => !tt.seats.some((s) => s.userId === u))]
      .filter((u) => people.has(u)).map((u) => ({ player: profile(people.get(u)!), place: place.get(u) ?? null, absent: tt.absent.includes(u) }));
    (rounds.get(tt.round) ?? rounds.set(tt.round, []).get(tt.round)!).push({ tableId: tt.tableId, status, players });
  }
  let me: TournamentDetail['me'] = null;
  if (userId) {
    const registered = list.some(({ e }) => e.userId === userId);
    const current = tables.find(({ tt, status }) => tt.round === t.currentRound && (status === 'open' || status === 'active')
      && tt.seats.some((s) => s.userId === userId) && !tt.absent.includes(userId));
    const [refund] = await db.select({ status: refunds.status }).from(refunds).where(and(eq(refunds.tournamentId, id), eq(refunds.userId, userId)))
      .orderBy(desc(refunds.createdAt)).limit(1);
    me = { registered, tableId: current?.tt.tableId ?? null, refundStatus: refund?.status ?? null };
  }
  return {
    ...toSummary(t, row.gameNameFa, list.length, !!me?.registered),
    descriptionFa: t.descriptionFa, arrivalSeconds: t.arrivalSeconds, cancelReason: t.cancelReason, finishedAt: t.finishedAt?.toISOString() ?? null,
    standings: list.map(({ e, u }) => ({ player: profile(u), points: e.points, wins: e.wins, byes: e.byes, noShows: e.noShows, eliminatedRound: e.eliminatedRound, finalRank: e.finalRank })),
    roundsPlayed: [...rounds].map(([round, tables]) => ({ round, tables })),
    me,
    checkout: { available: !!billing.gateway, reasonFa: billing.unavailableReasonFa, fixture: !!billing.gateway?.isFixture }
  };
}
