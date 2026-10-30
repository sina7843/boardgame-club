import { and, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AppError, apiErrorSchema, commandBody, commandResult, createBotTableBody, createTableBody, adminTables as adminTablesSchema, adminTablesQuery, homeOverview as homeOverviewSchema, liveTableItem, myTableItem, notificationItem, openTableItem,
  receiptLookup, rematchBody, tableSnapshot, tutorialProgressItem
} from '@bg/contracts';
import { schema } from '@bg/db';
import {
  adminTablesList, buildTableSnapshot, closeIncident, createBotTable, createTable, currentIncident, executeCommand, homeOverview, joinTable, leaveTable, listLiveTables, listMyTables,
  listNotifications, listOpenTables, lookupReceipt, markNotificationsRead, myTutorials, openIncident, setReady,
  skipTutorial, startTutorial, tableContextAt, tableRecord, voteRematch,
  fairPlayReview, listFairPlayReports, recordFocus, reportPlayer, resolveFairPlayReport
} from '@bg/play';
import type { Deps } from '../../app.ts';
import { requireRole, requireUser } from '../auth/session.ts';
import { timedCommand } from '../../http/timed-command.ts';

const { gameVersions, auditLog } = schema;
const idParams = z.object({ id: z.uuid() });
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema };

export function tableRoutes(app: FastifyInstance, { db, registry, play }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const snapshot = (tableId: string, userId: string, inviteCode?: string, admin?: boolean) => buildTableSnapshot(db, registry, { tableId, userId, inviteCode, admin });

  r.get('/status', { schema: { tags: ['tables'], summary: 'Platform incident status', response: { 200: z.object({ incident: tableSnapshot.shape.incident }) } } },
    async () => ({ incident: await currentIncident(db) }));

  r.post('/tables', {
    schema: { tags: ['tables'], summary: 'Create a table (private + friendly by default); host takes seat 0',
      body: createTableBody, response: { 201: z.object({ id: z.uuid() }), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireUser(req);
    const id = await createTable(db, registry, play, userId, req.body);
    return reply.code(201).send({ id });
  });

  r.post('/tables/bot', {
    schema: { tags: ['tables'], summary: 'Start a friendly game against bots (seat 0 = you); cancels your queued ticket',
      body: createBotTableBody, response: { 201: z.object({ id: z.uuid() }), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireUser(req);
    const id = await createBotTable(db, registry, play, userId, req.body);
    return reply.code(201).send({ id });
  });

  r.get('/tables', {
    schema: { tags: ['tables'], summary: 'Open public tables waiting for players', querystring: z.object({ gameId: z.string().max(64).optional() }),
      response: { 200: z.object({ items: z.array(openTableItem) }), 401: apiErrorSchema } }
  }, async (req) => {
    requireUser(req);
    return { items: await listOpenTables(db, req.query.gameId) };
  });

  r.get('/home', {
    schema: { tags: ['tables'], summary: 'Home page: live counts, running tables to watch, top players this week (public aggregate)', response: { 200: homeOverviewSchema } }
  }, async (req) => homeOverview(db, registry, req.auth?.userId ?? null));

  r.get('/tables/live', {
    schema: { tags: ['tables'], summary: 'Games in progress open to spectators (public and tournament tables)', querystring: z.object({ gameId: z.string().max(64).optional() }),
      response: { 200: z.object({ items: z.array(liveTableItem) }), 401: apiErrorSchema } }
  }, async (req) => {
    requireUser(req);
    return { items: await listLiveTables(db, req.query.gameId) };
  });

  for (const path of ['/tables/:id', '/tables/:id/view']) {
    r.get(path, {
      schema: { tags: ['tables'], summary: 'Authorized table snapshot for the signed-in viewer (player or spectator)',
        params: idParams, querystring: z.object({ invite: z.string().max(64).optional() }), response: { 200: tableSnapshot, ...errors } }
    }, async (req) => { const auth = requireUser(req); return snapshot(req.params.id, auth.userId, req.query.invite, auth.roles.includes('admin')); });
  }

  r.post('/tables/:id/report', {
    schema: { tags: ['tables'], summary: 'Report the opponent of a game for suspected cheating; an admin reviews it', params: idParams,
      body: z.strictObject({ accusedId: z.uuid(), note: z.string().trim().max(500).default('') }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    await reportPlayer(db, requireUser(req).userId, req.params.id, req.body.accusedId, req.body.note);
    return reply.code(204).send(null);
  });

  r.post('/tables/:id/focus', {
    schema: { tags: ['tables'], summary: 'Page hidden/shown signal at a tournament table (fair-play review only)', params: idParams,
      body: z.strictObject({ hidden: z.boolean() }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    await recordFocus(db, requireUser(req).userId, req.params.id, req.body.hidden);
    return reply.code(204).send(null);
  });

  r.get('/admin/tables', {
    schema: { tags: ['admin'], summary: 'All tables with status, players and result (filter by status, game, player name)', querystring: adminTablesQuery,
      response: { 200: adminTablesSchema } }
  }, async (req) => {
    requireRole(req, 'admin');
    return adminTablesList(db, req.query);
  });

  r.get('/admin/fair-play/reports', {
    schema: { tags: ['admin'], summary: 'Fair-play reports', querystring: z.object({ status: z.enum(['open', 'dismissed', 'actioned']).optional() }) }
  }, async (req) => {
    requireRole(req, 'admin');
    return { items: await listFairPlayReports(db, req.query.status) };
  });

  r.get('/admin/fair-play/tables/:id', {
    schema: { tags: ['admin'], summary: 'Move-time statistics, page-hidden time and indicator flags of both players of a table', params: idParams }
  }, async (req) => {
    requireRole(req, 'admin');
    return fairPlayReview(db, req.params.id);
  });

  r.post('/admin/fair-play/reports/:id', {
    schema: { tags: ['admin'], summary: 'Close a report (dismissed or actioned) with a note; audited', params: idParams,
      body: z.strictObject({ status: z.enum(['dismissed', 'actioned']), note: z.string().trim().min(3).max(500) }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    await resolveFairPlayReport(db, userId, req.params.id, req.body.status, req.body.note, req.id);
    return reply.code(204).send(null);
  });

  r.get('/tables/:id/record', {
    schema: { tags: ['tables'], summary: 'Game record for analysis (chess: PGN). Finished games only; arbiters may fetch a running one', params: idParams }
  }, async (req, reply) => {
    const auth = requireUser(req);
    const rec = await tableRecord(db, registry, req.params.id, auth.userId, auth.roles.includes('admin'));
    return reply.header('content-type', `${rec.mimeType}; charset=utf-8`).header('content-disposition', `attachment; filename="${rec.filename}"`).send(rec.text);
  });

  r.post('/tables/:id/join', {
    schema: { tags: ['tables'], summary: 'Join an open table (invite code required for private tables)', params: idParams,
      body: z.strictObject({ inviteCode: z.string().max(64).optional() }), response: { 200: tableSnapshot, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    await joinTable(db, registry, play, userId, req.params.id, req.body.inviteCode);
    return snapshot(req.params.id, userId);
  });

  r.post('/tables/:id/leave', {
    schema: { tags: ['tables'], summary: 'Leave before the game starts', params: idParams, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    await leaveTable(db, registry, requireUser(req).userId, req.params.id);
    return reply.code(204).send(null);
  });

  r.post('/tables/:id/ready', {
    schema: { tags: ['tables'], summary: 'Set ready; the game starts when all seats are filled and ready', params: idParams,
      body: z.strictObject({ ready: z.boolean() }), response: { 200: tableSnapshot, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    await setReady(db, registry, userId, req.params.id, req.body.ready);
    return snapshot(req.params.id, userId);
  });

  r.post('/tables/:id/rematch', {
    schema: { tags: ['tables'], summary: 'Vote for a rematch on a finished table; all humans «yes» within 30 s opens the same table again',
      params: idParams, body: rematchBody, response: { 200: tableSnapshot, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    await voteRematch(db, registry, play, userId, req.params.id, req.body.vote);
    return snapshot(req.params.id, userId);
  });

  r.post('/tables/:id/commands', {
    schema: { tags: ['tables'], summary: 'Submit a game command (idempotent per commandId; actor comes from the session)',
      params: idParams, body: commandBody, response: { 200: commandResult, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const result = await timedCommand('http', req.log, req.params.id, () => executeCommand(db, registry, { userId, tableId: req.params.id, ...req.body }));
    const ctx = await tableContextAt(db, req.params.id, result.revision);
    return { ...result, snapshot: await buildTableSnapshot(db, registry, { tableId: req.params.id, userId }, ctx) };
  });

  r.get('/tables/:id/commands/:commandId', {
    schema: { tags: ['tables'], summary: 'Receipt lookup for a command whose response was lost',
      params: z.object({ id: z.uuid(), commandId: z.uuid() }), response: { 200: receiptLookup, 401: apiErrorSchema } }
  }, async (req) => lookupReceipt(db, requireUser(req).userId, req.params.id, req.params.commandId));

  r.get('/me/tables', {
    schema: { tags: ['tables'], summary: 'My open/active/recent tables with «نوبت من» flags', response: { 200: z.object({ items: z.array(myTableItem) }), 401: apiErrorSchema } }
  }, async (req) => ({ items: await listMyTables(db, registry, requireUser(req).userId) }));

  r.get('/me/notifications', {
    schema: { tags: ['notifications'], summary: 'In-app notifications', response: { 200: z.object({ items: z.array(notificationItem) }), 401: apiErrorSchema } }
  }, async (req) => ({ items: await listNotifications(db, requireUser(req).userId) }));

  r.post('/me/notifications/:id/read', {
    schema: { tags: ['notifications'], summary: 'Mark one notification read', params: idParams, response: { 204: z.null(), 401: apiErrorSchema } }
  }, async (req, reply) => {
    await markNotificationsRead(db, requireUser(req).userId, req.params.id);
    return reply.code(204).send(null);
  });

  r.post('/me/notifications/read', {
    schema: { tags: ['notifications'], summary: 'Mark all notifications read', response: { 204: z.null(), 401: apiErrorSchema } }
  }, async (req, reply) => {
    await markNotificationsRead(db, requireUser(req).userId);
    return reply.code(204).send(null);
  });

  // ---------- Tutorials ----------
  const gameParams = z.object({ gameId: z.string().max(64) });
  r.post('/tutorials/:gameId/start', {
    schema: { tags: ['tutorials'], summary: 'Start, resume or restart the interactive tutorial table', params: gameParams,
      body: z.strictObject({ restart: z.boolean().default(false) }), response: { 200: z.object({ tableId: z.uuid() }), ...errors } }
  }, async (req) => ({ tableId: await startTutorial(db, registry, requireUser(req).userId, req.params.gameId, req.body.restart) }));

  r.post('/tutorials/:gameId/skip', {
    schema: { tags: ['tutorials'], summary: 'Skip the tutorial', params: gameParams, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    await skipTutorial(db, requireUser(req).userId, req.params.gameId);
    return reply.code(204).send(null);
  });

  r.get('/me/tutorials', {
    schema: { tags: ['tutorials'], summary: 'Tutorial progress per game', response: { 200: z.object({ items: z.array(tutorialProgressItem) }), 401: apiErrorSchema } }
  }, async (req) => ({ items: (await myTutorials(db, requireUser(req).userId)) as z.infer<typeof tutorialProgressItem>[] }));

  // ---------- Admin: incidents and version rollout ----------
  r.post('/admin/incidents', {
    schema: { tags: ['admin'], summary: 'Open a platform incident: freezes all turn deadlines', body: z.strictObject({ reasonFa: z.string().trim().min(3).max(300) }),
      response: { 201: z.object({ id: z.uuid() }), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const i = await openIncident(db, userId, req.body.reasonFa, req.id);
    return reply.code(201).send({ id: i.id });
  });

  r.post('/admin/incidents/close', {
    schema: { tags: ['admin'], summary: 'Close the incident and extend pending deadlines by its duration', response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    await closeIncident(db, requireRole(req, 'admin').userId, req.id);
    return reply.code(204).send(null);
  });

  const versionItem = z.object({ id: z.uuid(), gameId: z.string(), rulesVersion: z.string(), status: z.enum(['active', 'retired', 'disabled']),
    inRegistry: z.boolean(), publishedAt: z.iso.datetime() });
  r.get('/admin/game-versions', {
    schema: { tags: ['admin'], summary: 'Published rules versions', querystring: z.object({ gameId: z.string().max(64) }),
      response: { 200: z.object({ items: z.array(versionItem) }), ...errors } }
  }, async (req) => {
    requireRole(req, 'admin');
    const rows = await db.select().from(gameVersions).where(eq(gameVersions.gameId, req.query.gameId)).orderBy(desc(gameVersions.publishedAt));
    return { items: rows.map((v) => ({ id: v.id, gameId: v.gameId, rulesVersion: v.rulesVersion, status: v.status,
      inRegistry: registry.has(v.gameId, v.rulesVersion), publishedAt: v.publishedAt.toISOString() })) };
  });

  r.patch('/admin/game-versions/:id', {
    schema: { tags: ['admin'], summary: 'Activate / retire / disable a version for NEW tables; running tables keep their pinned version',
      params: idParams, body: z.strictObject({ status: z.enum(['active', 'retired', 'disabled']), reason: z.string().trim().min(3).max(300) }),
      response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    await db.transaction(async (tx) => {
      const [v] = await tx.select().from(gameVersions).where(eq(gameVersions.id, req.params.id)).for('update');
      if (!v) throw new AppError('NOT_FOUND');
      if (req.body.status === 'active' && !registry.has(v.gameId, v.rulesVersion)) throw new AppError('VALIDATION_FAILED');
      await tx.update(gameVersions).set({ status: req.body.status, ...(req.body.status === 'active' ? { publishedAt: sql`now()` } : {}) })
        .where(and(eq(gameVersions.id, v.id)));
      await tx.insert(auditLog).values({ actorId: userId, action: 'game_version.status', targetType: 'game_version', targetId: v.id,
        metadata: { gameId: v.gameId, rulesVersion: v.rulesVersion, from: v.status, to: req.body.status, reason: req.body.reason }, requestId: req.id });
    });
    return reply.code(204).send(null);
  });
}
