// Reputation «اعتبار» (phase C): computed on read from behaviour signals and finished games; nothing is stored.
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import type { ReputationBand, ReputationView } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { Tx } from './runtime.ts';

const { behaviorSignals, participants, gameTables } = schema;

export const REPUTATION_WINDOW_DAYS = 90;
/** Fewer finished games than this → «تازه‌وارد», no number. */
export const REPUTATION_NEWCOMER_GAMES = 5;
const DAY_MS = 86_400_000;
const PENALTY: Record<string, number> = { timeout_loss: 5, ready_no_show: 2, resigned: 5 };

export interface ReputationSignal { kind: string; at: Date; /** Human seats at the signal's table. */ humanSeats: number }
export interface Reputation { score: number; band: ReputationBand }

/**
 * Start 100; signals of the last 90 days: timeout loss −5, ready no-show −2, resign −5 (only on tables with 3+ human
 * seats; leaving a 2-player game harms no third player); +1 per finished game in the window; clamp 0 to 100.
 * `finishedGames.recent` = finished in the window, `total` = ever (decides «تازه‌وارد»).
 */
export function reputationFrom({ signals, finishedGames, now }: { signals: ReputationSignal[]; finishedGames: { total: number; recent: number }; now: Date }): Reputation {
  const since = now.getTime() - REPUTATION_WINDOW_DAYS * DAY_MS;
  let score = 100 + finishedGames.recent;
  for (const s of signals) {
    if (s.at.getTime() <= since || s.at.getTime() > now.getTime()) continue;
    if (s.kind === 'resigned' && s.humanSeats < 3) continue;
    score -= PENALTY[s.kind] ?? 0;
  }
  score = Math.max(0, Math.min(100, score));
  const band: ReputationBand = finishedGames.total < REPUTATION_NEWCOMER_GAMES ? 'newcomer' : score >= 90 ? 'reliable' : score >= 70 ? 'normal' : 'low';
  return { score, band };
}

/** «حداقل اعتبار»: a newcomer meets 70 (when the score does) but never 90. */
export const meetsReputation = (r: Reputation, min: number | null | undefined) => !min || (r.score >= min && (r.band !== 'newcomer' || min <= 70));

/** Public view: the number only when allowed, and never for a newcomer. */
export const reputationView = (r: Reputation, showScore: boolean): ReputationView => ({ band: r.band, score: showScore && r.band !== 'newcomer' ? r.score : null });

/**
 * Reputation of many players in two queries (no N+1). Finished games = finished, non-tutorial tables without bots
 * (games against bots would let anyone farm reputation).
 */
export async function reputations(db: Db | Tx, userIds: readonly string[], now = new Date()): Promise<Map<string, Reputation>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Map();
  const since = new Date(now.getTime() - REPUTATION_WINDOW_DAYS * DAY_MS);
  const [signals, games] = await Promise.all([
    // Qualified by hand: drizzle renders a single-table column unqualified, which the subquery would read as p.table_id.
    db.select({ userId: behaviorSignals.userId, kind: behaviorSignals.kind, at: behaviorSignals.createdAt,
      humanSeats: sql<number>`(select count(*)::int from participants p where p.table_id = behavior_signals.table_id and p.kind = 'human')` })
      .from(behaviorSignals).where(and(inArray(behaviorSignals.userId, ids), gt(behaviorSignals.createdAt, since))),
    db.select({ userId: participants.userId, total: sql<number>`count(*)::int`,
      recent: sql<number>`(count(*) filter (where ${gameTables.finishedAt} > ${since.toISOString()}::timestamptz))::int` })
      .from(participants).innerJoin(gameTables, eq(gameTables.id, participants.tableId))
      .where(and(inArray(participants.userId, ids), eq(gameTables.status, 'finished'), eq(gameTables.isTutorial, false), sql`${gameTables.settings}->'bot' is null`))
      .groupBy(participants.userId)
  ]);
  return new Map(ids.map((id) => {
    const g = games.find((x) => x.userId === id);
    return [id, reputationFrom({ signals: signals.filter((s) => s.userId === id), finishedGames: { total: g?.total ?? 0, recent: g?.recent ?? 0 }, now })];
  }));
}
