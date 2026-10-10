// Server-derived progression (FR-10, FR-14). Inputs are only canonical server events:
//   MatchCompleted  ← outbox 'table.finished' (canonical game_results row; never a client claim)
//   TutorialCompleted ← outbox 'tutorial.completed' (server-decided tutorial result)
//   GameMilestone   ← derived here from verified results (first game, first win, ranked debut, new title)
// Every award is a reward_ledger row with a unique source_key, so retries and duplicate deliveries award nothing twice.
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { schema, type Db } from '@bg/db';
import type { Tx } from './runtime.ts';
import { DEFAULT_SEASON, displayRating, ELIGIBILITY, leagueFor, newSkill, rate, type SeasonConfig } from './rating.ts';

const { ratings, ratingHistory, seasons, leaguePlacements, rewardLedger, missionDefinitions, missionProgress,
  achievementDefinitions, userAchievements, gameResults, gameTables, games, gameVersions } = schema;

/** Reward rules, versioned. Changing a value means bumping RULES_VERSION (old ledger rows keep their version). */
export const RULES_VERSION = 1;
export const XP_RULES = {
  matchCompleted: 20,
  firstPlace: 10,
  newTitle: 25,
  tutorialCompleted: 30,
  achievement: 15,
  /** Game of the day: once per user per Tehran day. Separate reward, not counted against dailyMatchCap. */
  dailyGame: 40,
  /** Daily cap on XP from matches (completion + first place), Tehran calendar day. */
  dailyMatchCap: 300,
  /** Same opponent set more than this many times in the window → reduced XP. */
  repeatedOpponentThreshold: 3,
  repeatedOpponentWindowHours: 24,
  repeatedOpponentXp: 5
} as const;

export interface FinishedEvent {
  tableId: string; resultId: string; gameId: string; pace: 'live' | 'turn'; competition: 'friendly' | 'ranked';
  isTutorial: boolean; reason: string; placements: { seat: number; place: number; score?: number; userId: string | null }[];
}

export const levelFor = (xp: number) => {
  // Level n needs 50·n·(n−1) total XP: 0, 100, 300, 600, 1000, …
  let level = 1;
  while (50 * (level + 1) * level <= xp) level++;
  return { level, currentFloor: 50 * level * (level - 1), nextAt: 50 * (level + 1) * level };
};

/** Saturday-based week in Tehran (Iranian week), used as the weekly mission period key. */
export function weekKey(at = new Date()): { key: string; endsAt: Date } {
  const tehran = new Date(at.getTime() + 3.5 * 3600_000);
  const dow = (tehran.getUTCDay() + 1) % 7; // Saturday = 0
  const start = Date.UTC(tehran.getUTCFullYear(), tehran.getUTCMonth(), tehran.getUTCDate() - dow) - 3.5 * 3600_000;
  return { key: new Date(start).toISOString().slice(0, 10), endsAt: new Date(start + 7 * 86400_000) };
}

/** Tehran calendar date (YYYY-MM-DD) of an instant; same fixed +03:30 offset as weekKey. */
export const tehranDate = (at = new Date()) => new Date(at.getTime() + 3.5 * 3600_000).toISOString().slice(0, 10);

// ---------------- Game of the day ----------------

/** Deterministic pick: FNV-1a hash of the Tehran date over the sorted ids. Same date + same catalog → same game. */
export function pickDaily(date: string, ids: readonly string[]): string | null {
  if (!ids.length) return null;
  let h = 0x811c9dc5;
  for (const ch of date) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return [...ids].sort()[(h >>> 0) % ids.length]!;
}

/** Eligible: active, not a test fixture, with a published (active) version. Free-access games are preferred when any exist. */
export async function dailyGame(db: Db | Tx, date = tehranDate()): Promise<{ id: string; nameFa: string } | null> {
  const rows = await db.selectDistinct({ id: games.id, nameFa: games.nameFa, access: games.access }).from(games)
    .innerJoin(gameVersions, and(eq(gameVersions.gameId, games.id), eq(gameVersions.status, 'active')))
    .where(and(eq(games.status, 'active'), eq(games.isTestGame, false)));
  const free = rows.filter((g) => g.access === 'free');
  const pool = free.length ? free : rows;
  const id = pickDaily(date, pool.map((g) => g.id));
  const g = pool.find((x) => x.id === id);
  return g ? { id: g.id, nameFa: g.nameFa } : null;
}

/** Current streak (ending today or yesterday) and best-ever run of consecutive dates (YYYY-MM-DD). */
export function dailyStreaks(dates: readonly string[], today = tehranDate()): { current: number; best: number } {
  const days = [...new Set(dates)].sort().map((d) => Date.parse(d) / 86400_000);
  let run = 0, best = 0;
  for (const [i, d] of days.entries()) {
    run = i > 0 && d - days[i - 1]! === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const last = days.at(-1);
  const t = Date.parse(today) / 86400_000;
  return { current: last !== undefined && t - last <= 1 ? run : 0, best };
}

const lockUser = (tx: Tx, userId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'progress:' + userId}))`);

async function award(tx: Tx, row: { userId: string; sourceKey: string; ruleId: string; kind: 'xp' | 'achievement' | 'mission' | 'cosmetic' | 'manual';
  amount: number; reason: string; resultId?: string | null; gameId?: string | null; metadata?: object; createdBy?: string | null }): Promise<boolean> {
  const inserted = await tx.insert(rewardLedger).values({
    userId: row.userId, sourceKey: row.sourceKey, ruleId: row.ruleId, ruleVersion: RULES_VERSION, kind: row.kind, amount: row.amount,
    reason: row.reason, resultId: row.resultId ?? null, gameId: row.gameId ?? null, metadata: row.metadata ?? {}, createdBy: row.createdBy ?? null
  }).onConflictDoNothing({ target: rewardLedger.sourceKey }).returning({ id: rewardLedger.id });
  return inserted.length > 0;
}

// ---------------- Rating ----------------

export async function activeSeason(db: Db | Tx) {
  const [s] = await db.select().from(seasons).where(eq(seasons.status, 'active'));
  return s ?? null;
}

/** Apply one ranked result exactly once (rating_history is unique per result/user/mode; checked first). */
export async function applyRating(tx: Tx, e: FinishedEvent): Promise<boolean> {
  if (e.competition !== 'ranked' || e.isTutorial) return false;
  const humans = e.placements.filter((p): p is typeof p & { userId: string } => !!p.userId);
  if (humans.length < 2) return false;
  const [already] = await tx.select({ id: ratingHistory.id }).from(ratingHistory).where(eq(ratingHistory.resultId, e.resultId)).limit(1);
  if (already) return false;
  const start = newSkill();
  await tx.insert(ratings).values(humans.map((h) => ({ userId: h.userId, gameId: e.gameId, mode: e.pace, mu: start.mu, sigma: start.sigma })))
    .onConflictDoNothing();
  // Lock in a stable order to avoid deadlocks between concurrent results.
  const ids = humans.map((h) => h.userId).sort();
  const rows = await tx.select().from(ratings)
    .where(and(inArray(ratings.userId, ids), eq(ratings.gameId, e.gameId), eq(ratings.mode, e.pace))).orderBy(ratings.userId).for('update');
  const byUser = new Map(rows.map((r) => [r.userId, r]));
  const next = rate(humans.map((h) => ({ skill: { mu: byUser.get(h.userId)!.mu, sigma: byUser.get(h.userId)!.sigma }, place: h.place })));
  const season = await activeSeason(tx);
  for (const [i, h] of humans.entries()) {
    const before = byUser.get(h.userId)!;
    const after = next[i]!;
    await tx.insert(ratingHistory).values({ userId: h.userId, gameId: e.gameId, mode: e.pace, resultId: e.resultId,
      muBefore: before.mu, sigmaBefore: before.sigma, muAfter: after.mu, sigmaAfter: after.sigma, place: h.place, fieldSize: humans.length, seasonId: season?.id ?? null });
    await tx.update(ratings).set({ mu: after.mu, sigma: after.sigma, gamesPlayed: before.gamesPlayed + 1, lastPlayedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(ratings.userId, h.userId), eq(ratings.gameId, e.gameId), eq(ratings.mode, e.pace)));
    if (season) await updatePlacement(tx, season, h.userId, e.gameId, e.pace, displayRating(after));
  }
  return true;
}

async function updatePlacement(tx: Tx, season: typeof seasons.$inferSelect, userId: string, gameId: string, mode: string, display: number) {
  const cfg = { ...DEFAULT_SEASON, ...(season.config as Partial<SeasonConfig>) };
  const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(ratingHistory)
    .where(and(eq(ratingHistory.userId, userId), eq(ratingHistory.gameId, gameId), eq(ratingHistory.mode, mode), eq(ratingHistory.seasonId, season.id)));
  // Placement needs a minimum number of ranked games, then follows skill only (volume alone never moves a league).
  if (n < cfg.minGames) return;
  const league = leagueFor(display, cfg);
  await tx.insert(leaguePlacements).values({ seasonId: season.id, userId, gameId, mode, league, rating: display, rankedGames: n })
    .onConflictDoUpdate({ target: [leaguePlacements.seasonId, leaguePlacements.userId, leaguePlacements.gameId, leaguePlacements.mode],
      set: { league, rating: display, rankedGames: n, updatedAt: sql`now()` } });
}

// ---------------- XP, missions, achievements ----------------

/** Match metadata written by rewardMatch (also copied onto first-place rows). */
type MatchMeta = { week?: string; opponents?: string[]; pace?: 'live' | 'turn'; competition?: 'friendly' | 'ranked' };

export const ACHIEVEMENT_TYPES = ['matches', 'wins', 'distinct_games', 'tutorials', 'ranked', 'level', 'missions', 'live_matches', 'turn_matches',
  'big_tables', 'one_game', 'win_games', 'daily_total', 'daily_streak', 'achievements'] as const;
export type AchievementType = typeof ACHIEVEMENT_TYPES[number];
/** Weekly mission goals. None may require winning (Requirements: «بدون برد اجباری»). */
export const MISSION_TYPES = ['complete_tables', 'distinct_games', 'learn_new_game', 'ranked_tables', 'friendly_tables', 'live_tables', 'turn_tables',
  'big_tables', 'tutorials'] as const;
export type MissionType = typeof MISSION_TYPES[number];

export interface GoalFacts { achievement: Record<AchievementType, number>; mission: Record<MissionType, number> }

/** Every value a mission or achievement can measure, derived only from server ledger rows (never client claims). */
export async function goalFacts(tx: Tx | Db, userId: string, week = weekKey().key): Promise<GoalFacts> {
  const rows = await tx.select({ ruleId: rewardLedger.ruleId, kind: rewardLedger.kind, gameId: rewardLedger.gameId, metadata: rewardLedger.metadata })
    .from(rewardLedger).where(and(eq(rewardLedger.userId, userId),
      sql`(${inArray(rewardLedger.ruleId, ['xp.match_completed', 'xp.first_place', 'xp.tutorial', 'xp.new_title', 'xp.daily_game'])} or ${rewardLedger.kind} = 'mission')`));
  const meta = (r: { metadata: unknown }) => r.metadata as MatchMeta;
  const inWeek = (r: { metadata: unknown }) => meta(r).week === week;
  const [{ n: ranked } = { n: 0 }] = await tx.select({ n: count() }).from(ratingHistory).where(eq(ratingHistory.userId, userId));
  const [{ n: granted } = { n: 0 }] = await tx.select({ n: count() }).from(userAchievements).where(eq(userAchievements.userId, userId));
  const matches = rows.filter((r) => r.ruleId === 'xp.match_completed');
  const wins = rows.filter((r) => r.ruleId === 'xp.first_place');
  const tutorials = rows.filter((r) => r.ruleId === 'xp.tutorial');
  const daily = rows.filter((r) => r.ruleId === 'xp.daily_game').map((r) => (r.metadata as { date?: string }).date ?? '').filter(Boolean);
  const weekMatches = matches.filter(inWeek);
  const perGame = new Map<string, number>();
  for (const m of matches) perGame.set(m.gameId!, (perGame.get(m.gameId!) ?? 0) + 1);
  const big = (r: { metadata: unknown }) => (meta(r).opponents?.length ?? 0) >= 2; // three or more people at the table
  const distinct = (rs: typeof rows) => new Set(rs.map((r) => r.gameId!)).size;
  return {
    achievement: {
      matches: matches.length, wins: wins.length, distinct_games: perGame.size, tutorials: tutorials.length, ranked,
      level: levelFor(await totalXp(tx, userId)).level,
      missions: rows.filter((r) => r.kind === 'mission').length,
      live_matches: matches.filter((r) => meta(r).pace === 'live').length,
      turn_matches: matches.filter((r) => meta(r).pace === 'turn').length,
      big_tables: matches.filter(big).length,
      one_game: Math.max(0, ...perGame.values()),
      win_games: distinct(wins),
      daily_total: daily.length,
      daily_streak: dailyStreaks(daily).best, // best run, so a trophy never depends on when it is evaluated
      achievements: granted
    },
    mission: {
      complete_tables: weekMatches.length,
      distinct_games: distinct(weekMatches),
      learn_new_game: rows.filter((r) => (r.ruleId === 'xp.tutorial' || r.ruleId === 'xp.new_title') && inWeek(r)).length,
      ranked_tables: weekMatches.filter((r) => meta(r).competition === 'ranked').length,
      friendly_tables: weekMatches.filter((r) => meta(r).competition === 'friendly').length,
      live_tables: weekMatches.filter((r) => meta(r).pace === 'live').length,
      turn_tables: weekMatches.filter((r) => meta(r).pace === 'turn').length,
      big_tables: weekMatches.filter(big).length,
      tutorials: tutorials.filter(inWeek).length
    }
  };
}

type Criteria = { type: MissionType; count: number; xp: number };
type AchievementCriteria = { type: AchievementType; count: number };
/** Level, mission-count and trophy-count achievements depend on awards made earlier in the same pass, so they are checked last. */
const META_TYPES: AchievementType[] = ['level', 'missions', 'achievements'];

/** Missions and achievements are recomputed from ledger facts (not incremented), so re-running is harmless. */
async function evaluateGoals(tx: Tx, userId: string) {
  const week = weekKey();
  let f = await goalFacts(tx, userId, week.key);
  const missions = await tx.select().from(missionDefinitions).where(eq(missionDefinitions.active, true));
  for (const m of missions) {
    const c = m.criteria as Criteria;
    const value = f.mission[c.type];
    if (value === undefined) continue; // unknown type in a newer definition: never award blindly
    const progress = Math.min(value, c.count);
    const done = progress >= c.count;
    await tx.insert(missionProgress).values({ userId, missionId: m.id, periodKey: week.key, progress, completedAt: done ? sql`now()` : null })
      .onConflictDoUpdate({ target: [missionProgress.userId, missionProgress.missionId, missionProgress.periodKey],
        set: { progress, completedAt: sql`coalesce(${missionProgress.completedAt}, ${done ? sql`now()` : sql`null`})` } });
    if (done) {
      await award(tx, { userId, sourceKey: `mission:${m.key}:v${m.ruleVersion}:${week.key}:${userId}`, ruleId: `mission.${m.key}`, kind: 'mission',
        amount: c.xp, reason: `مأموریت «${m.titleFa}» کامل شد.`, metadata: { week: week.key } });
    }
  }
  const achievements = await tx.select().from(achievementDefinitions);
  const isMeta = (a: typeof achievements[number]) => META_TYPES.includes((a.criteria as AchievementCriteria).type);
  const grant = async (list: typeof achievements) => {
    for (const a of list) {
      const c = a.criteria as AchievementCriteria;
      const value = f.achievement[c.type];
      if (value === undefined || value < c.count) continue;
      const granted = await tx.insert(userAchievements).values({ userId, achievementId: a.id }).onConflictDoNothing().returning();
      if (granted.length) {
        await award(tx, { userId, sourceKey: `achievement:${a.key}:${userId}`, ruleId: `achievement.${a.key}`, kind: 'achievement',
          amount: XP_RULES.achievement, reason: `دستاورد «${a.titleFa}».`, metadata: { week: week.key } });
      }
    }
  };
  await grant(achievements.filter((a) => !isMeta(a)));
  f = await goalFacts(tx, userId, week.key); // fresh XP and trophy count after the awards above
  await grant(achievements.filter(isMeta));
}

/** MatchCompleted: completion XP (also for losses), capped first-place bonus, repeated-opponent and daily limits. */
export async function rewardMatch(tx: Tx, e: FinishedEvent): Promise<void> {
  if (e.isTutorial) return;
  const humans = e.placements.filter((p): p is typeof p & { userId: string } => !!p.userId);
  const week = weekKey().key;
  const best = Math.min(...e.placements.map((p) => p.place));
  // Game of the day counts on the Tehran day the result was recorded (not when the outbox delivers it).
  const [res] = await tx.select({ at: gameResults.createdAt }).from(gameResults).where(eq(gameResults.id, e.resultId));
  const day = res ? tehranDate(res.at) : null;
  const isDaily = !!day && (await dailyGame(tx, day))?.id === e.gameId;
  const someoneWorse = e.placements.some((p) => p.place > best);
  for (const h of humans) {
    await lockUser(tx, h.userId);
    const doneKey = `match:${e.resultId}:${h.userId}:xp.match_completed`;
    const [exists] = await tx.select({ id: rewardLedger.id }).from(rewardLedger).where(eq(rewardLedger.sourceKey, doneKey));
    if (exists) continue; // this result was already rewarded for this player

    const opponents = humans.filter((x) => x.userId !== h.userId).map((x) => x.userId).sort();
    const recent = await tx.execute(sql`
      select count(*)::int as n from reward_ledger l join game_results r on r.id = l.result_id
      where l.user_id = ${h.userId} and l.rule_id = 'xp.match_completed' and l.result_id <> ${e.resultId}
        and l.created_at > now() - make_interval(hours => ${XP_RULES.repeatedOpponentWindowHours})
        and l.metadata->'opponents' = ${JSON.stringify(opponents)}::jsonb`) as unknown as { n: number }[];
    const repeated = (recent[0]?.n ?? 0) >= XP_RULES.repeatedOpponentThreshold;
    const todays = await tx.execute(sql`
      select coalesce(sum(amount), 0)::int as xp from reward_ledger
      where user_id = ${h.userId} and rule_id in ('xp.match_completed', 'xp.first_place')
        and (created_at at time zone 'Asia/Tehran')::date = (now() at time zone 'Asia/Tehran')::date`) as unknown as { xp: number }[];
    let room = Math.max(0, XP_RULES.dailyMatchCap - (todays[0]?.xp ?? 0));
    const meta = { week, opponents, place: h.place, pace: e.pace, competition: e.competition };

    let base: number = repeated ? XP_RULES.repeatedOpponentXp : XP_RULES.matchCompleted;
    let reason = repeated ? 'بازی کامل با حریف تکراری؛ XP کاهش‌یافته.' : 'بازی کامل شد.';
    if (base > room) { base = room; reason = room === 0 ? 'بازی کامل شد؛ سقف روزانه XP پر شده است.' : 'بازی کامل شد؛ تا سقف روزانه XP.'; }
    room -= base;
    await award(tx, { userId: h.userId, sourceKey: doneKey, ruleId: 'xp.match_completed', kind: 'xp', amount: base, reason, resultId: e.resultId, gameId: e.gameId, metadata: meta });

    if (h.place === best && someoneWorse) {
      const bonus = repeated ? 0 : Math.min(XP_RULES.firstPlace, room);
      await award(tx, { userId: h.userId, sourceKey: `match:${e.resultId}:${h.userId}:xp.first_place`, ruleId: 'xp.first_place', kind: 'xp', amount: bonus,
        reason: repeated ? 'رتبه اول؛ با حریف تکراری پاداش برد داده نمی‌شود.' : bonus < XP_RULES.firstPlace ? 'رتبه اول؛ محدود به سقف روزانه.' : 'رتبه اول.',
        resultId: e.resultId, gameId: e.gameId, metadata: meta });
    }
    await award(tx, { userId: h.userId, sourceKey: `title:${e.gameId}:${h.userId}`, ruleId: 'xp.new_title', kind: 'xp', amount: XP_RULES.newTitle,
      reason: 'اولین بازی کامل در یک عنوان تازه.', resultId: e.resultId, gameId: e.gameId, metadata: { week } });
    if (isDaily) {
      await award(tx, { userId: h.userId, sourceKey: `daily:${day}:${h.userId}`, ruleId: 'xp.daily_game', kind: 'xp', amount: XP_RULES.dailyGame,
        reason: 'بازی روز کامل شد.', resultId: e.resultId, gameId: e.gameId, metadata: { week, date: day } });
    }
    await evaluateGoals(tx, h.userId);
  }
}

/** TutorialCompleted: XP once per game, ever (replays give nothing). */
export async function rewardTutorial(tx: Tx, p: { userId: string; gameId: string; tableId: string }): Promise<void> {
  const [t] = await tx.select({ status: gameTables.status, isTutorial: gameTables.isTutorial }).from(gameTables).where(eq(gameTables.id, p.tableId));
  const [r] = await tx.select({ id: gameResults.id }).from(gameResults).where(eq(gameResults.tableId, p.tableId));
  if (!t?.isTutorial || t.status !== 'finished' || !r) return; // only a real, finished tutorial table counts
  await lockUser(tx, p.userId);
  await award(tx, { userId: p.userId, sourceKey: `tutorial:${p.gameId}:${p.userId}`, ruleId: 'xp.tutorial', kind: 'xp', amount: XP_RULES.tutorialCompleted,
    reason: 'آموزش تعاملی کامل شد.', resultId: r.id, gameId: p.gameId, metadata: { week: weekKey().key } });
  await evaluateGoals(tx, p.userId);
}

/** Admin manual reward/correction, always with a reason; audited by the caller. */
export async function manualReward(tx: Tx, p: { userId: string; amount: number; reason: string; adminId: string; requestId: string }) {
  await award(tx, { userId: p.userId, sourceKey: `manual:${p.requestId}:${p.userId}`, ruleId: 'manual', kind: 'manual', amount: p.amount, reason: p.reason, createdBy: p.adminId });
}

// ---------------- Seasons ----------------

/** Close (freeze) a season: placements become immutable (DB trigger) and finishers get a cosmetic badge. */
export async function closeSeason(tx: Tx, seasonId: string, adminId: string) {
  const [s] = await tx.select().from(seasons).where(eq(seasons.id, seasonId)).for('update');
  if (!s || s.status !== 'active') return null;
  const placements = await tx.select().from(leaguePlacements).where(eq(leaguePlacements.seasonId, seasonId));
  for (const p of placements) {
    await award(tx, { userId: p.userId, sourceKey: `season:${seasonId}:${p.gameId}:${p.mode}:${p.userId}`, ruleId: 'season.badge', kind: 'cosmetic', amount: 0,
      reason: `نشان فصل «${s.nameFa}»: لیگ ${p.league}.`, gameId: p.gameId, metadata: { league: p.league, mode: p.mode, seasonId } });
  }
  await tx.update(seasons).set({ status: 'closed', closedAt: sql`now()`, closedBy: adminId }).where(eq(seasons.id, seasonId));
  return { placements: placements.length };
}

// ---------------- Read models ----------------

export async function totalXp(db: Db | Tx, userId: string): Promise<number> {
  const [r] = await db.select({ xp: sql<number>`coalesce(sum(${rewardLedger.amount}), 0)::int` }).from(rewardLedger)
    .where(and(eq(rewardLedger.userId, userId), inArray(rewardLedger.kind, ['xp', 'mission', 'achievement', 'manual'])));
  return r?.xp ?? 0;
}

export const MASTERY = [
  { tier: 'new', fa: 'تازه‌وارد' }, { tier: 'learner', fa: 'آشنا' }, { tier: 'player', fa: 'بازیکن' },
  { tier: 'seasoned', fa: 'کارکشته' }, { tier: 'master', fa: 'استاد' }
] as const;

/** Per-game mastery, separate from skill rating and account XP: tutorial → completed games → ranked → milestones. */
export function masteryFor(f: { tutorial: boolean; completed: number; ranked: number; wins: number }) {
  if (f.completed >= 50 && f.ranked >= 20 && f.wins >= 15) return MASTERY[4];
  if (f.completed >= 20 && f.ranked >= 5) return MASTERY[3];
  if (f.completed >= 5) return MASTERY[2];
  if (f.tutorial || f.completed >= 1) return MASTERY[1];
  return MASTERY[0];
}

export async function ratingRows(db: Db, userId: string) {
  const rows = await db.select().from(ratings).where(eq(ratings.userId, userId)).orderBy(desc(ratings.updatedAt));
  return rows.map((r) => ({
    gameId: r.gameId, mode: r.mode, display: displayRating(r), mu: r.mu, sigma: r.sigma, games: r.gamesPlayed,
    provisional: r.gamesPlayed < ELIGIBILITY.provisionalGames,
    leaderboardEligible: r.gamesPlayed >= ELIGIBILITY.leaderboardMinGames && r.sigma <= ELIGIBILITY.leaderboardMaxSigma
  }));
}

