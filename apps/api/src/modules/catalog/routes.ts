import { and, asc, desc, eq, gte, ilike, lte, sql, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  adminUpdateGameBody, apiErrorSchema, catalogQuery, gameDetail, gameListResponse, normalizeSearch,
  type CatalogQuery, type GameDetail, type GameSummary
} from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { Deps } from '../../app.ts';
import { AppError } from '../../http/errors.ts';
import { requireRole } from '../auth/session.ts';

const { games, gameVersions, auditLog } = schema;
type GameRow = typeof games.$inferSelect;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function catalogFilters(q: CatalogQuery): SQL[] {
  const where: SQL[] = [];
  const text = q.q ? normalizeSearch(q.q) : '';
  if (text) where.push(ilike(games.searchText, `%${escapeLike(text)}%`));
  if (q.players) where.push(lte(games.minPlayers, q.players), gte(games.maxPlayers, q.players));
  if (q.maxMinutes) where.push(lte(games.minMinutes, q.maxMinutes));
  if (q.difficulty) where.push(eq(games.difficulty, q.difficulty));
  if (q.access) where.push(eq(games.access, q.access));
  if (q.mode === 'live' || q.mode === 'turn') where.push(sql`${games.paces} @> array[${q.mode}]::text[]`);
  if (q.mode === 'friendly' || q.mode === 'ranked') where.push(sql`${games.competitions} @> array[${q.mode}]::text[]`);
  return where;
}

function toSummary(g: GameRow): GameSummary {
  return {
    id: g.id, nameFa: g.nameFa, nameOriginal: g.nameOriginal, summaryFa: g.summaryFa,
    minPlayers: g.minPlayers, maxPlayers: g.maxPlayers, minMinutes: g.minMinutes, maxMinutes: g.maxMinutes,
    difficulty: g.difficulty, access: g.access, paces: g.paces, competitions: g.competitions,
    isTestGame: g.isTestGame, status: g.status, tutorialEnabled: g.tutorialEnabled
  };
}

async function loadDetail(db: Db, g: GameRow): Promise<GameDetail> {
  const [v] = await db.select({ rulesVersion: gameVersions.rulesVersion, stateSchemaVersion: gameVersions.stateSchemaVersion })
    .from(gameVersions).where(and(eq(gameVersions.gameId, g.id), eq(gameVersions.status, 'active')))
    .orderBy(desc(gameVersions.publishedAt)).limit(1);
  return {
    ...toSummary(g),
    rulesFa: g.rulesFa, timeoutPolicyFa: g.timeoutPolicyFa, resignPolicyFa: g.resignPolicyFa, tutorialFa: g.tutorialFa,
    activeVersion: v ?? null,
    acceptingNewTables: g.status === 'active' && !!v
  };
}

export function catalogRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/games', {
    schema: { tags: ['catalog'], summary: 'Search and filter the public catalog', querystring: catalogQuery,
      response: { 200: gameListResponse, 400: apiErrorSchema } }
  }, async (req) => {
    const rows = await db.select().from(games)
      .where(and(eq(games.status, 'active'), ...catalogFilters(req.query))).orderBy(asc(games.nameFa));
    return { items: rows.map(toSummary) };
  });

  r.get('/games/:id', {
    schema: { tags: ['catalog'], summary: 'Game detail: rules, players, time, modes, access, policies',
      params: z.object({ id: z.string().max(64) }), response: { 200: gameDetail, 404: apiErrorSchema } }
  }, async (req) => {
    const [g] = await db.select().from(games).where(eq(games.id, req.params.id));
    // Suspended games stay viewable (history kept) but accept no new tables; drafts are admin-only.
    if (!g || g.status === 'draft') throw new AppError('NOT_FOUND');
    return loadDetail(db, g);
  });

  r.get('/admin/games', {
    schema: { tags: ['admin'], summary: 'All games including draft/suspended (admin)',
      response: { 200: gameListResponse, 401: apiErrorSchema, 403: apiErrorSchema } }
  }, async (req) => {
    requireRole(req, 'admin');
    const rows = await db.select().from(games).orderBy(asc(games.nameFa));
    return { items: rows.map(toSummary) };
  });

  r.patch('/admin/games/:id/tutorial', {
    schema: { tags: ['admin'], summary: 'Enable or disable the interactive tutorial (running tutorial tables are kept)',
      params: z.object({ id: z.string().max(64) }), body: z.strictObject({ enabled: z.boolean(), reason: z.string().trim().min(3).max(300) }),
      response: { 200: gameDetail, 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema } }
  }, async (req) => {
    const auth = requireRole(req, 'admin');
    const [row] = await db.update(games).set({ tutorialEnabled: req.body.enabled, updatedAt: sql`now()` }).where(eq(games.id, req.params.id)).returning();
    if (!row) throw new AppError('NOT_FOUND');
    await db.insert(auditLog).values({ actorId: auth.userId, action: 'game.tutorial', targetType: 'game', targetId: row.id,
      metadata: { enabled: req.body.enabled, reason: req.body.reason }, requestId: req.id });
    return loadDetail(db, row);
  });

  r.patch('/admin/games/:id', {
    schema: { tags: ['admin'], summary: 'Change game status, e.g. suspend new tables without deleting history',
      params: z.object({ id: z.string().max(64) }), body: adminUpdateGameBody,
      response: { 200: gameDetail, 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema } }
  }, async (req) => {
    const auth = requireRole(req, 'admin');
    const updated = await db.transaction(async (tx) => {
      const [before] = await tx.select({ status: games.status }).from(games).where(eq(games.id, req.params.id)).for('update');
      if (!before) return null;
      const [row] = await tx.update(games).set({ status: req.body.status, updatedAt: sql`now()` })
        .where(eq(games.id, req.params.id)).returning();
      await tx.insert(auditLog).values({
        actorId: auth.userId, action: 'game.status', targetType: 'game', targetId: req.params.id,
        metadata: { from: before.status, to: req.body.status, reason: req.body.reason }, requestId: req.id
      });
      return row!;
    });
    if (!updated) throw new AppError('NOT_FOUND');
    return loadDetail(db, updated);
  });
}
