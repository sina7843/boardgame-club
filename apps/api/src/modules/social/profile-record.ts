// The public play record on a profile card. Everything here is derived from server-side results; hidden sections are null.
import { and, eq, sql } from 'drizzle-orm';
import { DEFAULT_PROFILE_PRIVACY, type League, type ProfilePrivacy, type PublicRecord } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { activeSeason, levelFor, masteryFor, ratingRows, totalXp } from '@bg/play';

const { leaguePlacements, games, userSettings } = schema;
const LEAGUES: League[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
const NOTHING: PublicRecord = { stats: null, level: null, bestLeague: null, ratings: null, recent: null, mastery: null };

export async function privacyOf(db: Db, userId: string): Promise<ProfilePrivacy> {
  const [s] = await db.select({ p: userSettings.profilePrivacy }).from(userSettings).where(eq(userSettings.userId, userId));
  return { ...DEFAULT_PROFILE_PRIVACY, ...s?.p };
}

// The player's place comes from the stored outcome's placements, matched by seat.
const FINISHED = sql`select t.game_id, t.visibility, t.finished_at,
    (select (p->>'place')::int from jsonb_array_elements(r.outcome->'placements') p where (p->>'seat')::int = pa.seat limit 1) as place,
    jsonb_array_length(r.outcome->'placements') as field
  from participants pa join game_tables t on t.id = pa.table_id join game_results r on r.table_id = t.id`;
const rowsOf = <T>(r: unknown) => r as T[];

/** `viewer` is 'self' (sees all), 'other' (respects privacy) or 'blocked' (sees nothing). */
export async function publicRecord(db: Db, userId: string, viewer: 'self' | 'other' | 'blocked'): Promise<PublicRecord> {
  if (viewer === 'blocked') return NOTHING;
  const privacy = viewer === 'self' ? { showStats: true, showRatings: true, showRecent: true } : await privacyOf(db, userId);
  const out: PublicRecord = { ...NOTHING, level: levelFor(await totalXp(db, userId)).level };

  if (privacy.showStats) {
    const [a] = rowsOf<{ n: number; wins: number }>(await db.execute(sql`select count(*)::int n, count(*) filter (where place = 1)::int wins
      from (${FINISHED} where pa.user_id = ${userId} and t.status = 'finished' and not t.is_tutorial) f`));
    const n = a?.n ?? 0;
    out.stats = { gamesPlayed: n, wins: a?.wins ?? 0, winRate: n ? Math.round(((a?.wins ?? 0) / n) * 100) : 0 };
    const m = rowsOf<{ game_id: string; name_fa: string; completed: number; wins: number; ranked: number; tutorial: boolean }>(await db.execute(sql`
      select g.id game_id, g.name_fa,
        (select count(*) from reward_ledger l where l.user_id = ${userId} and l.game_id = g.id and l.rule_id = 'xp.match_completed')::int completed,
        (select count(*) from reward_ledger l where l.user_id = ${userId} and l.game_id = g.id and l.rule_id = 'xp.first_place')::int wins,
        (select count(*) from rating_history h where h.user_id = ${userId} and h.game_id = g.id)::int ranked,
        exists (select 1 from reward_ledger l where l.user_id = ${userId} and l.game_id = g.id and l.rule_id = 'xp.tutorial') tutorial
      from games g where g.status = 'active'`));
    out.mastery = m.map((x) => ({ x, t: masteryFor(x) })).filter(({ t }) => t.tier !== 'new')
      .map(({ x, t }) => ({ gameId: x.game_id, gameNameFa: x.name_fa, tier: t.tier, tierFa: t.fa }));
  }

  if (privacy.showRatings) {
    const season = await activeSeason(db);
    const placements = season ? await db.select().from(leaguePlacements).where(and(eq(leaguePlacements.seasonId, season.id), eq(leaguePlacements.userId, userId))) : [];
    const names = new Map((await db.select({ id: games.id, n: games.nameFa }).from(games)).map((g) => [g.id, g.n]));
    out.ratings = (await ratingRows(db, userId)).filter((r) => r.leaderboardEligible).map((r) => ({
      gameId: r.gameId, gameNameFa: names.get(r.gameId) ?? r.gameId, mode: r.mode, rating: r.display, games: r.games,
      league: (placements.find((p) => p.gameId === r.gameId && p.mode === r.mode)?.league ?? null) as League | null }));
    const best = Math.max(-1, ...out.ratings.map((r) => (r.league ? LEAGUES.indexOf(r.league) : -1)));
    out.bestLeague = best >= 0 ? LEAGUES[best]! : null;
  }

  if (privacy.showRecent) {
    // Public tables only: a private table never shows up on someone's profile.
    const rows = rowsOf<{ game_id: string; name_fa: string; place: number; field: number; finished_at: Date | string }>(await db.execute(sql`
      select f.game_id, g.name_fa, f.place, f.field, f.finished_at from (${FINISHED}
        where pa.user_id = ${userId} and t.status = 'finished' and not t.is_tutorial and t.visibility = 'public') f
      join games g on g.id = f.game_id where f.place is not null order by f.finished_at desc limit 5`));
    out.recent = rows.map((r) => ({ gameId: r.game_id, gameNameFa: r.name_fa, place: r.place, fieldSize: r.field, finishedAt: new Date(r.finished_at).toISOString() }));
  }
  return out;
}
