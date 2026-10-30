// Admin «میزها»: every table with its status, players and result. Generic over games: seats, revision and the stored
// outcome only, never game state.
import { and, desc, eq, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import { botPersona, type AdminTables } from '@bg/contracts';
import { schema, type Db } from '@bg/db';

const { games, gameTables, participants, users, gameResults, tournamentTables } = schema;
const PAGE = 50;

export async function adminTablesList(db: Db, query: { status: string; gameId?: string | undefined; q?: string | undefined; tutorials: string; offset: number }): Promise<AdminTables> {
  const like = query.q ? `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : '';
  const base: (SQL | undefined)[] = [
    query.tutorials === 'true' ? undefined : eq(gameTables.isTutorial, false),
    query.gameId ? eq(gameTables.gameId, query.gameId) : undefined,
    query.q ? sql`exists (select 1 from participants p join users u on u.id = p.user_id where p.table_id = ${gameTables.id}
      and ${ilike(sql`u.display_name`, like)})` : undefined
  ];
  const where = and(...base, query.status === 'all' ? undefined : eq(gameTables.status, query.status));
  const rows = await db.select({ t: gameTables, gameNameFa: games.nameFa, host: users.displayName, reason: gameResults.reason, outcome: gameResults.outcome,
    tournament: tournamentTables.tableId })
    .from(gameTables).innerJoin(games, eq(games.id, gameTables.gameId)).leftJoin(users, eq(users.id, gameTables.hostId))
    .leftJoin(gameResults, eq(gameResults.tableId, gameTables.id)).leftJoin(tournamentTables, eq(tournamentTables.tableId, gameTables.id))
    .where(where).orderBy(desc(gameTables.createdAt), desc(gameTables.id)).limit(PAGE + 1).offset(query.offset);
  const page = rows.slice(0, PAGE);
  const ids = page.map((r) => r.t.id);
  const seated = ids.length ? await db.select({ tableId: participants.tableId, seat: participants.seat, kind: participants.kind, userId: participants.userId,
    name: users.displayName, leftAt: participants.leftAt })
    .from(participants).leftJoin(users, eq(users.id, participants.userId)).where(inArray(participants.tableId, ids)).orderBy(participants.seat) : [];
  const [{ total = 0 } = {}] = await db.select({ total: sql<number>`count(*)::int` }).from(gameTables).where(where);
  const byStatus = await db.select({ status: gameTables.status, n: sql<number>`count(*)::int` }).from(gameTables).where(and(...base)).groupBy(gameTables.status);
  const counts = { open: 0, active: 0, paused: 0, finished: 0, cancelled: 0 } as AdminTables['counts'];
  for (const s of byStatus) counts[s.status as keyof typeof counts] = s.n;

  return {
    total, hasMore: rows.length > PAGE, counts,
    items: page.map(({ t, gameNameFa, host, reason, outcome, tournament }) => {
      const places = (outcome as { placements?: { seat: number; place: number }[] } | null)?.placements ?? [];
      let bots = 0;
      return {
        id: t.id, gameId: t.gameId, gameNameFa, status: t.status as AdminTables['items'][number]['status'],
        pace: t.pace as 'live' | 'turn', competition: t.competition as 'friendly' | 'ranked', visibility: t.visibility as 'public' | 'private',
        kind: t.isTutorial ? 'tutorial' : tournament ? 'tournament' : t.isMatchmade ? 'matchmade' : 'normal', capacity: t.capacity, host,
        seats: seated.filter((s) => s.tableId === t.id).map((s) => ({
          seat: s.seat, userId: s.userId, bot: s.kind !== 'human', left: !!s.leftAt,
          name: s.kind === 'bot' ? botPersona((t.settings as { bot?: { personas?: number[] } }).bot?.personas, bots++).nameFa : s.kind === 'script' ? 'آموزش' : s.name ?? '—',
          place: places.find((p) => p.seat === s.seat)?.place ?? null
        })),
        moves: t.revision, resultReason: reason ?? null,
        createdAt: t.createdAt.toISOString(), startedAt: t.startedAt?.toISOString() ?? null, finishedAt: t.finishedAt?.toISOString() ?? null
      };
    })
  };
}
