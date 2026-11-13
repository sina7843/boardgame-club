// Game page content (written by the team) and players' reviews (DS v2.4 GameDetail). Public reads; the content is edited by
// admins; a review needs a finished table of that game, one per player, editable by its author, hideable by staff.
import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { apiErrorSchema, emptyGameContent, gameContent, gameReviews, reviewBody, type GameContent, type GameReviews } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { Deps } from '../../app.ts';
import { AppError } from '../../http/errors.ts';
import { requireRole, requireUser } from '../auth/session.ts';
import { toPublicProfile } from '../users/routes.ts';

const { games, gameContents, gameReviews: reviewsT, users, participants, gameTables, auditLog } = schema;
const idParams = z.object({ id: z.string().max(64) });
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema };

async function gameExists(db: Db, id: string) {
  const [g] = await db.select({ id: games.id }).from(games).where(eq(games.id, id));
  if (!g) throw new AppError('NOT_FOUND');
}

/** Stored content read through the schema, so an older row still gets every field with its default. */
export async function loadContent(db: Db, gameId: string): Promise<GameContent> {
  const [row] = await db.select({ data: gameContents.data }).from(gameContents).where(eq(gameContents.gameId, gameId));
  if (!row) return emptyGameContent();
  const parsed = gameContent.safeParse(row.data);
  return parsed.success ? parsed.data : emptyGameContent();
}

async function finishedAGame(db: Db, userId: string, gameId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(participants).innerJoin(gameTables, eq(gameTables.id, participants.tableId))
    .where(and(eq(participants.userId, userId), eq(gameTables.gameId, gameId), eq(gameTables.status, 'finished'), eq(gameTables.isTutorial, false)));
  return (r?.n ?? 0) > 0;
}

async function loadReviews(db: Db, gameId: string, viewer: string | null): Promise<GameReviews> {
  const visible = and(eq(reviewsT.gameId, gameId), eq(reviewsT.hidden, false), eq(users.status, 'active'));
  const [agg] = await db.select({ n: sql<number>`count(*)::int`, avg: sql<number | null>`round(avg(${reviewsT.stars})::numeric, 1)::float` })
    .from(reviewsT).innerJoin(users, eq(users.id, reviewsT.userId)).where(visible);
  const dist = await db.select({ stars: reviewsT.stars, n: sql<number>`count(*)::int` }).from(reviewsT).innerJoin(users, eq(users.id, reviewsT.userId))
    .where(visible).groupBy(reviewsT.stars);
  const rows = await db.select({ r: reviewsT, u: users }).from(reviewsT).innerJoin(users, eq(users.id, reviewsT.userId))
    .where(visible).orderBy(desc(reviewsT.updatedAt)).limit(12);
  const view = ({ r, u }: { r: typeof reviewsT.$inferSelect; u: typeof users.$inferSelect }) => ({
    id: r.id, user: toPublicProfile(u), stars: r.stars, bodyFa: r.body, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString()
  });
  let mine: GameReviews['mine'] = null;
  if (viewer) {
    const [m] = await db.select({ r: reviewsT, u: users }).from(reviewsT).innerJoin(users, eq(users.id, reviewsT.userId))
      .where(and(eq(reviewsT.gameId, gameId), eq(reviewsT.userId, viewer)));
    mine = m ? view(m) : null;
  }
  return {
    average: agg?.n ? agg.avg : null, count: agg?.n ?? 0,
    distribution: [5, 4, 3, 2, 1].map((s) => dist.find((d) => d.stars === s)?.n ?? 0),
    items: rows.map(view), mine, canReview: viewer ? await finishedAGame(db, viewer, gameId) : false
  };
}

export function gameContentRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/games/:id/content', {
    schema: { tags: ['catalog'], summary: 'Game page content written by the team (sheet, highlights, screenshots, questions)', params: idParams,
      response: { 200: gameContent, 404: apiErrorSchema } }
  }, async (req) => { await gameExists(db, req.params.id); return loadContent(db, req.params.id); });

  r.put('/admin/games/:id/content', {
    schema: { tags: ['admin'], summary: 'Replace the game page content (admin)', params: idParams, body: gameContent, response: { 200: gameContent, ...errors } }
  }, async (req) => {
    const auth = requireRole(req, 'admin');
    await gameExists(db, req.params.id);
    await db.insert(gameContents).values({ gameId: req.params.id, data: req.body, updatedBy: auth.userId })
      .onConflictDoUpdate({ target: gameContents.gameId, set: { data: req.body, updatedBy: auth.userId, updatedAt: sql`now()` } });
    await db.insert(auditLog).values({ actorId: auth.userId, action: 'game.content', targetType: 'game', targetId: req.params.id, metadata: {}, requestId: req.id });
    return loadContent(db, req.params.id);
  });

  r.get('/games/:id/reviews', {
    schema: { tags: ['catalog'], summary: 'Players\' reviews: average, distribution, the latest twelve and the viewer\'s own', params: idParams,
      response: { 200: gameReviews, 404: apiErrorSchema } }
  }, async (req) => { await gameExists(db, req.params.id); return loadReviews(db, req.params.id, req.auth?.userId ?? null); });

  r.put('/games/:id/reviews/mine', {
    schema: { tags: ['catalog'], summary: 'Write or edit your review (after finishing a table of this game)', params: idParams, body: reviewBody,
      response: { 200: gameReviews, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    await gameExists(db, req.params.id);
    if (!(await finishedAGame(db, userId, req.params.id))) throw new AppError('FORBIDDEN');
    await db.insert(reviewsT).values({ gameId: req.params.id, userId, stars: req.body.stars, body: req.body.bodyFa })
      .onConflictDoUpdate({ target: [reviewsT.gameId, reviewsT.userId], set: { stars: req.body.stars, body: req.body.bodyFa, updatedAt: sql`now()` } });
    return loadReviews(db, req.params.id, userId);
  });

  r.delete('/games/:id/reviews/mine', {
    schema: { tags: ['catalog'], summary: 'Delete your review', params: idParams, response: { 200: gameReviews, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    await db.delete(reviewsT).where(and(eq(reviewsT.gameId, req.params.id), eq(reviewsT.userId, userId)));
    return loadReviews(db, req.params.id, userId);
  });

  r.patch('/mod/reviews/:id', {
    schema: { tags: ['moderation'], summary: 'Hide or show a review (moderator)', params: z.object({ id: z.uuid() }),
      body: z.strictObject({ hidden: z.boolean(), reason: z.string().trim().min(3).max(300) }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const auth = requireRole(req, 'moderator');
    const [row] = await db.update(reviewsT).set({ hidden: req.body.hidden }).where(eq(reviewsT.id, req.params.id)).returning({ id: reviewsT.id });
    if (!row) throw new AppError('NOT_FOUND');
    await db.insert(auditLog).values({ actorId: auth.userId, action: req.body.hidden ? 'review.hide' : 'review.show', targetType: 'review', targetId: row.id,
      metadata: { reason: req.body.reason }, requestId: req.id });
    return reply.code(204).send(null);
  });
}
