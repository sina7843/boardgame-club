// Time-limited events («رویداد»): read models. Points and goals are derived from reward_ledger rows (one per result and
// player, unique source key), so redelivery never double-counts; the cosmetic reward is granted in progression.ts.
import { eq, inArray, sql } from 'drizzle-orm';
import { AppError, cosmetic, type AdminEventBody, type EventStatus } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { eventGoalProgress, eventRewardKey, factRows } from './progression.ts';

const { games, rewardLedger } = schema;
export type EventRow = typeof schema.events.$inferSelect;
export const EVENT_LEADERBOARD_SIZE = 100;
/** +1 per counted game, +1 more for first place (the SQL below counts one point per ledger row). */
export const EVENT_POINTS = { perGame: 1, firstPlace: 1 } as const;

export const eventStatusOf = (e: Pick<EventRow, 'startsAt' | 'endsAt'>, now = new Date()): EventStatus =>
  now < e.startsAt ? 'upcoming' : now < e.endsAt ? 'live' : 'ended';

/**
 * Points per player in the window: +1 per human-table game (xp.match_completed), +1 for first place (xp.first_place).
 * Same anti-farming as XP: rows the XP rules zeroed (daily cap, repeated-opponent first place) and repeated-opponent
 * games give no points; bot tables have their own rule ids and never count. Ties: who reached the total first.
 */
export async function eventLeaderboard(db: Db, e: Pick<EventRow, 'startsAt' | 'endsAt' | 'gameIds'>, me: string | null) {
  const gameFilter = e.gameIds?.length ? sql`and l.game_id in (${sql.join(e.gameIds.map((g) => sql`${g}`), sql`, `)})` : sql``;
  const mine = me ? sql`or user_id = ${me}` : sql``;
  const rows = await db.execute(sql`
    with pts as (
      select l.user_id, count(*)::int as points, max(r.created_at) as reached
      from reward_ledger l join game_results r on r.id = l.result_id
      where l.rule_id in ('xp.match_completed', 'xp.first_place') and l.amount > 0
        and coalesce(l.metadata->>'repeated', 'false') <> 'true'
        and r.created_at >= ${e.startsAt.toISOString()}::timestamptz and r.created_at < ${e.endsAt.toISOString()}::timestamptz ${gameFilter}
      group by l.user_id
    ), ranked as (select user_id, points, row_number() over (order by points desc, reached asc, user_id) as rank from pts)
    select user_id, points, rank::int as rank from ranked where rank <= ${EVENT_LEADERBOARD_SIZE} ${mine} order by rank`) as unknown as { user_id: string; points: number; rank: number }[];
  const top = rows.filter((r) => r.rank <= EVENT_LEADERBOARD_SIZE).map((r) => ({ userId: r.user_id, points: r.points, rank: r.rank }));
  const own = me ? rows.find((r) => r.user_id === me) : undefined;
  return { top, me: own ? { rank: own.rank, points: own.points } : null };
}

export async function eventGoalsFor(db: Db, e: EventRow, userId: string) {
  return eventGoalProgress(e, await factRows(db, userId));
}

export async function eventRewardGranted(db: Db, eventId: string, userId: string): Promise<boolean> {
  const [r] = await db.select({ id: rewardLedger.id }).from(rewardLedger).where(eq(rewardLedger.sourceKey, eventRewardKey(eventId, userId)));
  return !!r;
}

/** Admin input checks beyond the schema: window order, known games, an existing catalogue cosmetic. */
export async function validateEvent(db: Db, b: Pick<AdminEventBody, 'startsAt' | 'endsAt' | 'gameIds' | 'rewardCosmetic'>): Promise<void> {
  if (Date.parse(b.endsAt) <= Date.parse(b.startsAt)) throw new AppError('VALIDATION_FAILED');
  if (b.rewardCosmetic && !cosmetic(b.rewardCosmetic)) throw new AppError('VALIDATION_FAILED');
  if (b.gameIds?.length) {
    const ids = [...new Set(b.gameIds)];
    const found = await db.select({ id: games.id }).from(games).where(inArray(games.id, ids));
    if (found.length !== ids.length) throw new AppError('VALIDATION_FAILED');
  }
}

