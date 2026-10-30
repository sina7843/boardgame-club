// Home page data (design/reference/html/play/Home-*.html): live counts, running tables anyone may watch, the week's
// top players by XP. Public aggregate only: no hidden game state, names and avatars as on public leaderboards.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { botPersona, type HomeOverview } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { GameRegistry } from '@bg/game-engine';
import { loadSnapshot } from './runtime.ts';
import { weekKey } from './progression.ts';

const { games, gameVersions, gameTables, participants, users, scheduledDeadlines, tournamentTables, tableWatchers, sessions, rewardLedger, matchmakingTickets } = schema;

const running = and(eq(gameTables.status, 'active'), eq(gameTables.isTutorial, false));
const watchable = sql`(${gameTables.visibility} = 'public' or exists (select 1 from tournament_tables tt where tt.table_id = ${gameTables.id}))`;

export async function homeOverview(db: Db, registry: GameRegistry, userId: string | null): Promise<HomeOverview> {
  const [counts] = await db.select({
    liveTables: sql<number>`count(*)::int`
  }).from(gameTables).innerJoin(games, eq(games.id, gameTables.gameId)).where(and(running, eq(games.status, 'active'), watchable));
  const [playing] = await db.select({ n: sql<number>`count(distinct ${participants.userId})::int` }).from(participants)
    .innerJoin(gameTables, eq(gameTables.id, participants.tableId)).where(and(running, sql`${participants.userId} is not null`));
  const [online] = await db.select({ n: sql<number>`count(distinct ${sessions.userId})::int` }).from(sessions)
    .where(and(sql`${sessions.lastSeenAt} > now() - interval '5 minutes'`, sql`${sessions.revokedAt} is null`));

  // Four running tables to watch: tournament tables first, then the busiest, then the newest.
  const rows = await db.select({ table: gameTables, version: gameVersions, game: games }).from(gameTables)
    .innerJoin(games, eq(games.id, gameTables.gameId)).innerJoin(gameVersions, eq(gameVersions.id, gameTables.gameVersionId))
    .leftJoin(tournamentTables, eq(tournamentTables.tableId, gameTables.id))
    .where(and(running, eq(games.status, 'active'), watchable))
    .orderBy(sql`${tournamentTables.tableId} is null`, desc(gameTables.startedAt)).limit(4);
  const ids = rows.map((r) => r.table.id);
  const seated = ids.length ? await db.select({ tableId: participants.tableId, seat: participants.seat, kind: participants.kind, name: users.displayName, avatarKey: users.avatarKey })
    .from(participants).leftJoin(users, eq(users.id, participants.userId)).where(inArray(participants.tableId, ids)).orderBy(participants.seat) : [];
  const deadlines = ids.length ? await db.select({ tableId: scheduledDeadlines.tableId, dueAt: scheduledDeadlines.dueAt }).from(scheduledDeadlines)
    .where(and(inArray(scheduledDeadlines.tableId, ids), eq(scheduledDeadlines.deadlineKey, 'turn'), eq(scheduledDeadlines.status, 'pending'))) : [];
  const watchers = ids.length ? await db.select({ tableId: tableWatchers.tableId, n: sql<number>`count(distinct ${tableWatchers.userId})::int` }).from(tableWatchers)
    .where(and(inArray(tableWatchers.tableId, ids), sql`${tableWatchers.seenAt} > now() - interval '150 seconds'`,
      sql`${tableWatchers.userId} not in (select user_id from participants p where p.table_id = ${tableWatchers.tableId} and p.user_id is not null)`))
    .groupBy(tableWatchers.tableId) : [];
  const live: HomeOverview['live'] = [];
  for (const { table, version, game } of rows) {
    let bots = 0;
    const seats = seated.filter((s) => s.tableId === table.id).map((s) => {
      if (s.kind !== 'bot') return { seat: s.seat, name: s.name ?? 'جایگزین', avatarKey: s.avatarKey ?? 'meeple' };
      const p = botPersona((table.settings as { bot?: { personas?: number[] } }).bot?.personas, bots++);
      return { seat: s.seat, name: p.nameFa, avatarKey: p.avatarKey };
    });
    const module = registry.resolve(table.gameId, version.rulesVersion);
    const pending = module.pendingSeats((await loadSnapshot(db, table.id, table.revision)).state);
    live.push({
      id: table.id, gameId: game.id, gameNameFa: game.nameFa, pace: table.pace as 'live' | 'turn', competition: table.competition as 'friendly' | 'ranked',
      turnSeconds: (table.settings as { turnSeconds?: number }).turnSeconds ?? null,
      seats: seats.map(({ name, avatarKey }) => ({ name, avatarKey })),
      turnName: pending.length === 1 ? seats.find((s) => s.seat === pending[0])?.name ?? null : null,
      deadline: deadlines.find((d) => d.tableId === table.id)?.dueAt.toISOString() ?? null,
      spectators: watchers.find((w) => w.tableId === table.id)?.n ?? 0
    });
  }

  // The week's XP (all games), ranked.
  const week = weekKey();
  const since = new Date(week.endsAt.getTime() - 7 * 86400_000);
  const xp = and(eq(rewardLedger.kind, 'xp'), sql`${rewardLedger.createdAt} >= ${since.toISOString()}`);
  const points = sql<number>`sum(${rewardLedger.amount})::int`;
  const top = await db.select({ userId: rewardLedger.userId, points, displayName: users.displayName, avatarKey: users.avatarKey })
    .from(rewardLedger).innerJoin(users, eq(users.id, rewardLedger.userId)).where(xp)
    .groupBy(rewardLedger.userId, users.displayName, users.avatarKey).having(sql`sum(${rewardLedger.amount}) > 0`).orderBy(desc(points)).limit(10);
  const topGames = top.length ? await db.select({ userId: rewardLedger.userId, nameFa: games.nameFa, n: points }).from(rewardLedger)
    .innerJoin(games, eq(games.id, rewardLedger.gameId)).where(and(xp, inArray(rewardLedger.userId, top.map((t) => t.userId))))
    .groupBy(rewardLedger.userId, games.nameFa).orderBy(desc(points)) : [];
  let me: HomeOverview['weekly']['me'] = null;
  if (userId) {
    const [mine] = await db.select({ points }).from(rewardLedger).where(and(xp, eq(rewardLedger.userId, userId)));
    const myPoints = mine?.points ?? 0;
    const [above] = myPoints > 0 ? await db.execute<{ n: number }>(sql`select count(*)::int as n from (select user_id from reward_ledger
      where kind = 'xp' and created_at >= ${since.toISOString()} group by user_id having sum(amount) > ${myPoints}) x`).then((r) => [...r]) : [];
    me = { rank: myPoints > 0 ? (above?.n ?? 0) + 1 : null, points: myPoints };
  }

  const popular = await db.select({ gameId: gameTables.gameId, n: sql<number>`count(*)::int` }).from(gameTables)
    .innerJoin(games, eq(games.id, gameTables.gameId))
    .where(and(eq(gameTables.isTutorial, false), eq(games.status, 'active'), sql`${gameTables.createdAt} > now() - interval '7 days'`))
    .groupBy(gameTables.gameId).orderBy(desc(sql`count(*)`)).limit(12);

  const searching = await db.select({ gameId: matchmakingTickets.gameId, n: sql<number>`count(distinct ${matchmakingTickets.userId})::int` })
    .from(matchmakingTickets).where(eq(matchmakingTickets.status, 'queued')).groupBy(matchmakingTickets.gameId);
  const seatedByGame = await db.select({ gameId: gameTables.gameId, n: sql<number>`count(distinct ${participants.userId})::int` }).from(participants)
    .innerJoin(gameTables, eq(gameTables.id, participants.tableId)).where(and(running, sql`${participants.userId} is not null`)).groupBy(gameTables.gameId);
  const queues: HomeOverview['queues'] = {};
  for (const r of searching) queues[r.gameId] = { searching: r.n, seated: 0 };
  for (const r of seatedByGame) queues[r.gameId] = { searching: queues[r.gameId]?.searching ?? 0, seated: r.n };

  return {
    liveTables: counts?.liveTables ?? 0, playingNow: playing?.n ?? 0, onlineNow: online?.n ?? 0, live,
    weekly: {
      endsAt: week.endsAt.toISOString(),
      tenth: top[9]?.points ?? null,
      top: top.slice(0, 5).map((t, i) => ({ rank: i + 1, user: { id: t.userId, displayName: t.displayName, avatarKey: t.avatarKey }, points: t.points,
        games: topGames.filter((g) => g.userId === t.userId).slice(0, 2).map((g) => g.nameFa) })),
      me
    },
    popular: popular.map((p) => p.gameId),
    queues
  };
}
