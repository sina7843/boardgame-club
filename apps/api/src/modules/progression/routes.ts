// Ratings, leaderboards, seasons, XP/missions/achievements and stats (FR-10, FR-14). Read-only for players:
// every number here is derived from server events; there is no endpoint that accepts a client-claimed result.
import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, apiErrorSchema, leaderboardResponse, progressionResponse, tableRewards } from '@bg/contracts';
import { schema } from '@bg/db';
import {
  activeSeason, closeSeason, DEFAULT_SEASON, displayRating, ELIGIBILITY, isPremium, levelFor, manualReward, masteryFor, ratingRows,
  totalXp, weekKey, type SeasonConfig
} from '@bg/play';
import type { Deps } from '../../app.ts';
import { requireRole, requireUser } from '../auth/session.ts';
import { profiles } from '../social/relations.ts';

const { ratings, ratingHistory, seasons, leaguePlacements, rewardLedger, missionDefinitions, missionProgress, achievementDefinitions,
  userAchievements, games, gameResults, auditLog, users } = schema;
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema };
const modeSchema = z.enum(['live', 'turn']);
const toLedger = (r: typeof rewardLedger.$inferSelect) => ({ kind: r.kind, ruleId: r.ruleId, amount: r.amount, reason: r.reason, gameId: r.gameId, createdAt: r.createdAt.toISOString() });

export function progressionRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/me/progression', {
    schema: { tags: ['progression'], summary: 'Skill ratings, account level/XP, per-game mastery, weekly missions, achievements and recent rewards with reasons',
      response: { 200: progressionResponse, 401: apiErrorSchema } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const xp = await totalXp(db, userId);
    const lvl = levelFor(xp);
    const season = await activeSeason(db);
    const placements = season ? await db.select().from(leaguePlacements).where(and(eq(leaguePlacements.seasonId, season.id), eq(leaguePlacements.userId, userId))) : [];
    const ratingList = (await ratingRows(db, userId)).map((x) => ({ ...x, mode: x.mode as 'live',
      league: (placements.find((p) => p.gameId === x.gameId && p.mode === x.mode)?.league ?? null) as 'gold' | null }));

    const allGames = await db.select({ id: games.id, nameFa: games.nameFa }).from(games).where(eq(games.status, 'active'));
    const ledger = await db.select().from(rewardLedger).where(eq(rewardLedger.userId, userId)).orderBy(desc(rewardLedger.createdAt));
    const rankedByGame = await db.select({ gameId: ratingHistory.gameId, n: sql<number>`count(*)::int` }).from(ratingHistory).where(eq(ratingHistory.userId, userId)).groupBy(ratingHistory.gameId);
    const mastery = allGames.map((g) => {
      const f = {
        tutorial: ledger.some((l) => l.ruleId === 'xp.tutorial' && l.gameId === g.id),
        completed: ledger.filter((l) => l.ruleId === 'xp.match_completed' && l.gameId === g.id).length,
        wins: ledger.filter((l) => l.ruleId === 'xp.first_place' && l.gameId === g.id).length,
        ranked: rankedByGame.find((x) => x.gameId === g.id)?.n ?? 0
      };
      const m = masteryFor(f);
      return { gameId: g.id, gameNameFa: g.nameFa, tier: m.tier, tierFa: m.fa, ...f };
    });

    const week = weekKey();
    const defs = await db.select().from(missionDefinitions).where(eq(missionDefinitions.active, true));
    const progress = await db.select().from(missionProgress).where(and(eq(missionProgress.userId, userId), eq(missionProgress.periodKey, week.key)));
    const missions = defs.map((m) => {
      const c = m.criteria as { count: number; xp: number };
      const p = progress.find((x) => x.missionId === m.id);
      return { key: m.key, titleFa: m.titleFa, descriptionFa: m.descriptionFa, progress: p?.progress ?? 0, target: c.count, xp: c.xp, completed: !!p?.completedAt };
    });
    const achDefs = await db.select().from(achievementDefinitions);
    const mine = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
    return {
      xp, level: lvl.level, levelFloor: lvl.currentFloor, nextLevelAt: lvl.nextAt,
      ratings: ratingList, mastery,
      missions: { periodKey: week.key, endsAt: week.endsAt.toISOString(), items: missions },
      achievements: achDefs.map((a) => ({ key: a.key, titleFa: a.titleFa, descriptionFa: a.descriptionFa,
        grantedAt: mine.find((m) => m.achievementId === a.id)?.grantedAt.toISOString() ?? null })),
      ledger: ledger.slice(0, 30).map(toLedger),
      season: season ? { id: season.id, nameFa: season.nameFa, endsAt: season.endsAt.toISOString() } : null
    };
  });

  r.get('/me/rewards', {
    schema: { tags: ['progression'], summary: 'Rating change and rewards from one finished table (shown after the game, never during it)',
      querystring: z.object({ tableId: z.uuid() }), response: { 200: tableRewards, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const [result] = await db.select({ id: gameResults.id }).from(gameResults).where(eq(gameResults.tableId, req.query.tableId));
    if (!result) return { rating: null, rewards: [], processed: false };
    const rows = await db.select().from(rewardLedger).where(and(eq(rewardLedger.userId, userId), eq(rewardLedger.resultId, result.id)));
    const [h] = await db.select().from(ratingHistory).where(and(eq(ratingHistory.resultId, result.id), eq(ratingHistory.userId, userId)));
    const [rt] = h ? await db.select().from(ratings).where(and(eq(ratings.userId, userId), eq(ratings.gameId, h.gameId), eq(ratings.mode, h.mode))) : [];
    return {
      rating: h ? { before: displayRating({ mu: h.muBefore, sigma: h.sigmaBefore }), after: displayRating({ mu: h.muAfter, sigma: h.sigmaAfter }), provisional: (rt?.gamesPlayed ?? 0) < ELIGIBILITY.provisionalGames } : null,
      rewards: rows.map(toLedger),
      processed: rows.length > 0
    };
  });

  r.get('/users/:userId/achievements', {
    schema: { tags: ['progression'], summary: 'Achievements a player shows on their public profile', params: z.object({ userId: z.uuid() }),
      response: { 200: z.object({ level: z.number().int(), items: z.array(z.object({ key: z.string(), titleFa: z.string(), grantedAt: z.iso.datetime() })) }), 401: apiErrorSchema } }
  }, async (req) => {
    requireUser(req);
    const rows = await db.select({ a: achievementDefinitions, u: userAchievements }).from(userAchievements)
      .innerJoin(achievementDefinitions, eq(achievementDefinitions.id, userAchievements.achievementId))
      .where(and(eq(userAchievements.userId, req.params.userId), eq(userAchievements.showOnProfile, true)));
    return { level: levelFor(await totalXp(db, req.params.userId)).level, items: rows.map(({ a, u }) => ({ key: a.key, titleFa: a.titleFa, grantedAt: u.grantedAt.toISOString() })) };
  });

  r.get('/games/:id/leaderboard', {
    schema: { tags: ['progression'], summary: 'Leaderboard: eligible players only (min games and certainty), sorted by skill',
      params: z.object({ id: z.string().max(64) }), querystring: z.object({ mode: modeSchema.default('live'), seasonId: z.uuid().optional() }),
      response: { 200: leaderboardResponse, ...errors } }
  }, async (req) => {
    const season = req.query.seasonId ? (await db.select().from(seasons).where(eq(seasons.id, req.query.seasonId)))[0] : await activeSeason(db);
    let items: { userId: string; rating: number; games: number; league: string | null }[];
    if (season && season.status === 'closed') {
      // A closed season shows its frozen final placements.
      const rows = await db.select().from(leaguePlacements).where(and(eq(leaguePlacements.seasonId, season.id), eq(leaguePlacements.gameId, req.params.id), eq(leaguePlacements.mode, req.query.mode)))
        .orderBy(desc(leaguePlacements.rating)).limit(100);
      items = rows.map((p) => ({ userId: p.userId, rating: p.rating, games: p.rankedGames, league: p.league }));
    } else {
      const rows = await db.select().from(ratings).innerJoin(users, eq(users.id, ratings.userId))
        .where(and(eq(ratings.gameId, req.params.id), eq(ratings.mode, req.query.mode), eq(users.status, 'active'),
          sql`${ratings.gamesPlayed} >= ${ELIGIBILITY.leaderboardMinGames}`, sql`${ratings.sigma} <= ${ELIGIBILITY.leaderboardMaxSigma}`))
        .orderBy(desc(ratings.mu)).limit(100);
      const placements = season ? await db.select().from(leaguePlacements).where(and(eq(leaguePlacements.seasonId, season.id), eq(leaguePlacements.gameId, req.params.id), eq(leaguePlacements.mode, req.query.mode))) : [];
      items = rows.map(({ ratings: x }) => ({ userId: x.userId, rating: displayRating(x), games: x.gamesPlayed, league: placements.find((p) => p.userId === x.userId)?.league ?? null }));
    }
    const people = await profiles(db, items.map((i) => i.userId));
    return {
      gameId: req.params.id, mode: req.query.mode,
      season: season ? { id: season.id, nameFa: season.nameFa, status: season.status } : null,
      rules: { minGames: ELIGIBILITY.leaderboardMinGames, maxSigma: ELIGIBILITY.leaderboardMaxSigma },
      items: items.map((i, k) => ({ rank: k + 1, user: people.get(i.userId)!, rating: i.rating, games: i.games, league: i.league as 'gold' | null }))
    };
  });

  r.get('/seasons', {
    schema: { tags: ['progression'], summary: 'Seasons (newest first)', response: { 200: z.object({ items: z.array(z.object({
      id: z.uuid(), nameFa: z.string(), status: z.string(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), config: z.unknown() })) }) } }
  }, async () => ({ items: (await db.select().from(seasons).orderBy(desc(seasons.startsAt))).map((s) => ({ id: s.id, nameFa: s.nameFa, status: s.status,
    startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), config: { ...DEFAULT_SEASON, ...(s.config as object) } })) }));

  // ---------- Stats: core history free; trends premium (no gameplay advantage) ----------
  r.get('/me/stats/history', {
    schema: { tags: ['progression'], summary: 'Ranked result history (free)', querystring: z.object({ gameId: z.string().max(64), mode: modeSchema }),
      response: { 200: z.object({ items: z.array(z.object({ at: z.iso.datetime(), place: z.number().int(), fieldSize: z.number().int(), before: z.number().int(), after: z.number().int() })) }), 401: apiErrorSchema } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const rows = await db.select().from(ratingHistory).where(and(eq(ratingHistory.userId, userId), eq(ratingHistory.gameId, req.query.gameId), eq(ratingHistory.mode, req.query.mode)))
      .orderBy(desc(ratingHistory.createdAt)).limit(50);
    return { items: rows.map((h) => ({ at: h.createdAt.toISOString(), place: h.place, fieldSize: h.fieldSize,
      before: displayRating({ mu: h.muBefore, sigma: h.sigmaBefore }), after: displayRating({ mu: h.muAfter, sigma: h.sigmaAfter }) })) };
  });

  r.get('/me/stats/trends', {
    schema: { tags: ['progression'], summary: 'Advanced trends and season comparison (premium)', querystring: z.object({ gameId: z.string().max(64), mode: modeSchema }),
      response: { 200: z.object({ weekly: z.array(z.object({ week: z.string(), rating: z.number().int(), games: z.number().int(), firstPlaces: z.number().int() })),
        seasons: z.array(z.object({ nameFa: z.string(), league: z.string(), rating: z.number().int() })) }), ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    if (!(await isPremium(db, userId))) throw new AppError('PREMIUM_REQUIRED');
    const weekly = await db.execute(sql`
      select to_char(date_trunc('week', created_at), 'YYYY-MM-DD') as week, count(*)::int as games,
        count(*) filter (where place = 1)::int as "firstPlaces",
        round(60 * (array_agg(mu_after order by created_at desc))[1])::int as rating
      from rating_history where user_id = ${userId} and game_id = ${req.query.gameId} and mode = ${req.query.mode}
      group by 1 order by 1`) as unknown as { week: string; games: number; firstPlaces: number; rating: number }[];
    const past = await db.select({ nameFa: seasons.nameFa, league: leaguePlacements.league, rating: leaguePlacements.rating }).from(leaguePlacements)
      .innerJoin(seasons, eq(seasons.id, leaguePlacements.seasonId))
      .where(and(eq(leaguePlacements.userId, userId), eq(leaguePlacements.gameId, req.query.gameId), eq(leaguePlacements.mode, req.query.mode))).orderBy(seasons.startsAt);
    return { weekly: [...weekly], seasons: past };
  });

  // ---------- Admin: seasons, corrections, manual rewards ----------
  const seasonBody = z.strictObject({
    nameFa: z.string().trim().min(2).max(60), startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
    config: z.strictObject({ minGames: z.number().int().min(1).max(100), thresholds: z.strictObject({ silver: z.number().int(), gold: z.number().int(), platinum: z.number().int(), diamond: z.number().int(), master: z.number().int() }) }).optional()
  });
  r.post('/admin/seasons', { schema: { tags: ['admin'], summary: 'Create a scheduled season', body: seasonBody, response: { 201: z.object({ id: z.uuid() }), ...errors } } }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const cfg: SeasonConfig = req.body.config ?? DEFAULT_SEASON;
    const t = cfg.thresholds;
    if (!(t.silver < t.gold && t.gold < t.platinum && t.platinum < t.diamond && t.diamond < t.master)) throw new AppError('VALIDATION_FAILED');
    if (new Date(req.body.startsAt) >= new Date(req.body.endsAt)) throw new AppError('VALIDATION_FAILED');
    const [s] = await db.insert(seasons).values({ nameFa: req.body.nameFa, startsAt: new Date(req.body.startsAt), endsAt: new Date(req.body.endsAt), status: 'scheduled', config: cfg }).returning();
    await db.insert(auditLog).values({ actorId: userId, action: 'season.create', targetType: 'season', targetId: s!.id, metadata: req.body, requestId: req.id });
    return reply.code(201).send({ id: s!.id });
  });

  r.post('/admin/seasons/:id/activate', { schema: { tags: ['admin'], summary: 'Activate a scheduled season (one active at a time)', params: z.object({ id: z.uuid() }), response: { 204: z.null(), ...errors } } }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const updated = await db.update(seasons).set({ status: 'active' }).where(and(eq(seasons.id, req.params.id), eq(seasons.status, 'scheduled'))).returning()
      .catch(() => { throw new AppError('VALIDATION_FAILED'); });
    if (!updated.length) throw new AppError('NOT_FOUND');
    await db.insert(auditLog).values({ actorId: userId, action: 'season.activate', targetType: 'season', targetId: req.params.id, metadata: {}, requestId: req.id });
    return reply.code(204).send(null);
  });

  r.post('/admin/seasons/:id/close', { schema: { tags: ['admin'], summary: 'Close and freeze a season; finishers get a cosmetic badge', params: z.object({ id: z.uuid() }),
    response: { 200: z.object({ placements: z.number().int() }), ...errors } } }, async (req) => {
    const { userId } = requireRole(req, 'admin');
    const res = await db.transaction(async (tx) => {
      const out = await closeSeason(tx, req.params.id, userId);
      if (out) await tx.insert(auditLog).values({ actorId: userId, action: 'season.close', targetType: 'season', targetId: req.params.id, metadata: out, requestId: req.id });
      return out;
    });
    if (!res) throw new AppError('NOT_FOUND');
    return res;
  });

  r.post('/admin/seasons/:id/corrections', {
    schema: { tags: ['admin'], summary: 'Explicit, audited correction of a frozen placement', params: z.object({ id: z.uuid() }),
      body: z.strictObject({ userId: z.uuid(), gameId: z.string().max(64), mode: modeSchema, league: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master']), reason: z.string().trim().min(5).max(500) }),
      response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    await db.transaction(async (tx) => {
      const [s] = await tx.select().from(seasons).where(eq(seasons.id, req.params.id));
      if (!s) throw new AppError('NOT_FOUND');
      // The freeze trigger allows changes only inside this flagged transaction.
      await tx.execute(sql`set local app.season_correction = 'on'`);
      const [before] = await tx.select().from(leaguePlacements).where(and(eq(leaguePlacements.seasonId, s.id), eq(leaguePlacements.userId, req.body.userId),
        eq(leaguePlacements.gameId, req.body.gameId), eq(leaguePlacements.mode, req.body.mode)));
      if (!before) throw new AppError('NOT_FOUND');
      await tx.update(leaguePlacements).set({ league: req.body.league, correctedBy: userId, correctionReason: req.body.reason, updatedAt: sql`now()` })
        .where(and(eq(leaguePlacements.seasonId, s.id), eq(leaguePlacements.userId, req.body.userId), eq(leaguePlacements.gameId, req.body.gameId), eq(leaguePlacements.mode, req.body.mode)));
      await tx.insert(auditLog).values({ actorId: userId, action: 'season.correction', targetType: 'season', targetId: s.id,
        metadata: { userId: req.body.userId, gameId: req.body.gameId, mode: req.body.mode, from: before.league, to: req.body.league, reason: req.body.reason }, requestId: req.id });
    });
    return reply.code(204).send(null);
  });

  r.get('/admin/missions', {
    schema: { tags: ['admin'], summary: 'Mission definitions (versioned)', response: { 200: z.object({ items: z.array(z.object({ id: z.uuid(), key: z.string(), ruleVersion: z.number().int(),
      titleFa: z.string(), descriptionFa: z.string(), criteria: z.unknown(), active: z.boolean() })) }), ...errors } }
  }, async (req) => {
    requireRole(req, 'admin');
    return { items: (await db.select().from(missionDefinitions).orderBy(missionDefinitions.key)).map((m) => ({ id: m.id, key: m.key, ruleVersion: m.ruleVersion,
      titleFa: m.titleFa, descriptionFa: m.descriptionFa, criteria: m.criteria, active: m.active })) };
  });

  r.patch('/admin/missions/:id', {
    schema: { tags: ['admin'], summary: 'Activate/deactivate a mission (definitions are versioned; edits ship as a new version)', params: z.object({ id: z.uuid() }),
      body: z.strictObject({ active: z.boolean(), reason: z.string().trim().min(3).max(300) }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const rows = await db.update(missionDefinitions).set({ active: req.body.active }).where(eq(missionDefinitions.id, req.params.id)).returning();
    if (!rows.length) throw new AppError('NOT_FOUND');
    await db.insert(auditLog).values({ actorId: userId, action: 'mission.active', targetType: 'mission', targetId: req.params.id, metadata: req.body, requestId: req.id });
    return reply.code(204).send(null);
  });

  r.post('/admin/rewards', {
    schema: { tags: ['admin'], summary: 'Manual XP reward or correction with a recorded reason', body: z.strictObject({ userId: z.uuid(), amount: z.number().int().min(-1000).max(1000).refine((x) => x !== 0), reason: z.string().trim().min(5).max(300) }),
      response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    await db.transaction(async (tx) => {
      await manualReward(tx, { userId: req.body.userId, amount: req.body.amount, reason: req.body.reason, adminId: userId, requestId: req.id });
      await tx.insert(auditLog).values({ actorId: userId, action: 'reward.manual', targetType: 'user', targetId: req.body.userId, metadata: req.body, requestId: req.id });
    });
    return reply.code(204).send(null);
  });

}
