// Reports, moderator decisions, sanctions, appeals and behaviour signals (Requirements §16, FR-16).
// Moderators see only the data attached to a specific report; every decision is audited.
// JS Dates carry milliseconds while timestamptz carries microseconds: compare inclusively and exclude by id.
import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, apiErrorSchema, appealBody, decideAppealBody, reportBody, reportItem, resolveReportBody, sanctionItem } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { Deps } from '../../app.ts';
import { requireRole, requireUser } from '../auth/session.ts';
import { conversationMembersOf } from '../social/chat.ts';
import { profiles, requireActiveUser } from '../social/relations.ts';

const { reports, messages, conversations, gameTables, participants, userSanctions, appeals, auditLog, behaviorSignals, games, gameResults } = schema;
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema };
const idParams = z.object({ id: z.uuid() });
const toReport = (r: typeof reports.$inferSelect) => ({
  id: r.id, targetType: r.targetType, targetId: r.targetId, reasonCode: r.reasonCode, reason: r.reason, evidenceRef: r.evidenceRef,
  status: r.status as 'open', decision: r.decision, resolution: r.resolution, createdAt: r.createdAt.toISOString()
});
const isActive = (s: typeof userSanctions.$inferSelect) => !s.revokedAt && (!s.endsAt || s.endsAt.getTime() > Date.now());

async function signalCounts(db: Db, userId: string) {
  const rows = await db.select({ kind: behaviorSignals.kind, n: sql<number>`count(*)::int` }).from(behaviorSignals)
    .where(and(eq(behaviorSignals.userId, userId), gt(behaviorSignals.createdAt, sql`now() - interval '30 days'`))).groupBy(behaviorSignals.kind);
  return Object.fromEntries(rows.map((r) => [r.kind, r.n])) as Record<string, number>;
}

export function moderationRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // ---------- Reporting (any player) ----------
  r.post('/reports', { schema: { tags: ['moderation'], summary: 'Report a user, display name, message or table', body: reportBody, response: { 201: reportItem, ...errors } } }, async (req, reply) => {
    const { userId } = requireUser(req, { allowSuspended: true });
    const b = req.body;
    let subject: string | null = null;
    if (b.targetType === 'user' || b.targetType === 'display_name') {
      subject = (await requireActiveUser(db, b.targetId)).id;
    } else if (b.targetType === 'message') {
      const [m] = await db.select().from(messages).where(eq(messages.id, b.targetId));
      if (!m) throw new AppError('NOT_FOUND');
      const [c] = await db.select().from(conversations).where(eq(conversations.id, m.conversationId));
      // You can only report what you could read.
      if (!(await conversationMembersOf(db, c!)).includes(userId)) throw new AppError('FORBIDDEN');
      subject = m.senderId;
    } else {
      const [p] = await db.select().from(participants).where(and(eq(participants.tableId, b.targetId), eq(participants.userId, userId)));
      if (!p) throw new AppError('NOT_PARTICIPANT');
    }
    if (subject === userId) throw new AppError('CANNOT_TARGET_SELF');
    const [row] = await db.insert(reports).values({ reporterId: userId, targetType: b.targetType, targetId: b.targetId, subjectUserId: subject,
      reasonCode: b.reasonCode, reason: b.reason, evidenceRef: b.evidenceRef ?? null }).returning();
    return reply.code(201).send(toReport(row!));
  });

  r.get('/me/reports', { schema: { tags: ['moderation'], summary: 'Reports I filed and their outcome', response: { 200: z.object({ items: z.array(reportItem) }), 401: apiErrorSchema } } }, async (req) => {
    const { userId } = requireUser(req, { allowSuspended: true });
    return { items: (await db.select().from(reports).where(eq(reports.reporterId, userId)).orderBy(desc(reports.createdAt)).limit(50)).map(toReport) };
  });

  r.get('/me/sanctions', { schema: { tags: ['moderation'], summary: 'Sanctions on my account and appeal status', response: { 200: z.object({ items: z.array(sanctionItem) }), 401: apiErrorSchema } } }, async (req) => {
    const { userId } = requireUser(req, { allowSuspended: true });
    const rows = await db.select({ s: userSanctions, a: appeals }).from(userSanctions).leftJoin(appeals, eq(appeals.sanctionId, userSanctions.id))
      .where(eq(userSanctions.userId, userId)).orderBy(desc(userSanctions.startsAt));
    return { items: rows.map(({ s, a }) => ({
      id: s.id, kind: s.kind as 'suspended', reason: s.reason, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt?.toISOString() ?? null,
      active: isActive(s), appeal: a ? { status: a.status as 'open', decisionNote: a.decisionNote } : null
    })) };
  });

  r.post('/appeals', { schema: { tags: ['moderation'], summary: 'Appeal one of my sanctions (also while suspended)', body: appealBody, response: { 201: z.object({ id: z.uuid() }), ...errors } } }, async (req, reply) => {
    const { userId } = requireUser(req, { allowSuspended: true });
    const [s] = await db.select().from(userSanctions).where(and(eq(userSanctions.id, req.body.sanctionId), eq(userSanctions.userId, userId)));
    if (!s) throw new AppError('NOT_FOUND');
    const [a] = await db.insert(appeals).values({ sanctionId: s.id, userId, text: req.body.text }).onConflictDoNothing().returning();
    if (!a) throw new AppError('APPEAL_EXISTS');
    return reply.code(201).send({ id: a.id });
  });

  // ---------- Moderator queue ----------
  r.get('/mod/reports', {
    schema: { tags: ['moderation'], summary: 'Report queue (moderator)', querystring: z.object({ status: z.enum(['open', 'resolved', 'dismissed']).default('open') }),
      response: { 200: z.object({ items: z.array(reportItem.extend({ subject: z.object({ id: z.uuid(), displayName: z.string() }).nullable() })) }), ...errors } }
  }, async (req) => {
    requireRole(req, 'moderator');
    const rows = await db.select().from(reports).where(eq(reports.status, req.query.status)).orderBy(asc(reports.createdAt)).limit(100);
    const people = await profiles(db, rows.map((x) => x.subjectUserId).filter((x): x is string => !!x));
    return { items: rows.map((x) => ({ ...toReport(x), subject: x.subjectUserId ? { id: x.subjectUserId, displayName: people.get(x.subjectUserId)?.displayName ?? '' } : null })) };
  });

  r.get('/mod/reports/:id', {
    schema: { tags: ['moderation'], summary: 'One report with only the evidence it concerns (access is audited)', params: idParams,
      response: { 200: z.object({ report: reportItem, reporter: z.object({ id: z.uuid(), displayName: z.string() }), subject: z.object({ id: z.uuid(), displayName: z.string(), avatarKey: z.string() }).nullable(),
        evidence: z.unknown(), signals: z.record(z.string(), z.number()), priorSanctions: z.array(sanctionItem) }), ...errors } }
  }, async (req) => {
    const { userId } = requireRole(req, 'moderator');
    const [rep] = await db.select().from(reports).where(eq(reports.id, req.params.id));
    if (!rep) throw new AppError('NOT_FOUND');
    const people = await profiles(db, [rep.reporterId, ...(rep.subjectUserId ? [rep.subjectUserId] : [])]);
    let evidence: unknown = null;
    if (rep.targetType === 'message') {
      const [m] = await db.select().from(messages).where(eq(messages.id, rep.targetId));
      if (m) {
        // Report-specific context only: the message and up to 3 messages on either side in the same conversation.
        const before = await db.select().from(messages).where(and(eq(messages.conversationId, m.conversationId), ne(messages.id, m.id), lte(messages.createdAt, m.createdAt))).orderBy(desc(messages.createdAt)).limit(3);
        const after = await db.select().from(messages).where(and(eq(messages.conversationId, m.conversationId), ne(messages.id, m.id), gte(messages.createdAt, m.createdAt))).orderBy(asc(messages.createdAt)).limit(3);
        const ctx = [...before.reverse(), m, ...after];
        const names = await profiles(db, ctx.map((x) => x.senderId));
        evidence = { reported: m.id, messages: ctx.map((x) => ({ id: x.id, sender: names.get(x.senderId)?.displayName ?? '', body: x.body, createdAt: x.createdAt.toISOString(), deleted: !!x.deletedAt })) };
      }
    } else if (rep.targetType === 'table') {
      const [t] = await db.select({ t: gameTables, g: games }).from(gameTables).innerJoin(games, eq(games.id, gameTables.gameId)).where(eq(gameTables.id, rep.targetId));
      if (t) {
        const seats = await db.select().from(participants).where(eq(participants.tableId, t.t.id));
        const names = await profiles(db, seats.map((s) => s.userId).filter((u): u is string => !!u));
        const [result] = await db.select().from(gameResults).where(eq(gameResults.tableId, t.t.id));
        // Public table facts and the canonical result only — never internal state or hidden information.
        evidence = { game: t.g.nameFa, pace: t.t.pace, status: t.t.status, startedAt: t.t.startedAt?.toISOString() ?? null,
          players: seats.map((s) => ({ seat: s.seat, name: s.userId ? names.get(s.userId)?.displayName ?? '' : 'آموزشی' })), result: result?.outcome ?? null };
      }
    } else {
      evidence = { displayName: people.get(rep.subjectUserId!)?.displayName ?? '' };
    }
    await db.insert(auditLog).values({ actorId: userId, action: 'report.view', targetType: 'report', targetId: rep.id, metadata: {}, requestId: req.id });
    const prior = rep.subjectUserId ? await db.select().from(userSanctions).where(eq(userSanctions.userId, rep.subjectUserId)).orderBy(desc(userSanctions.startsAt)) : [];
    const subject = rep.subjectUserId ? people.get(rep.subjectUserId) : undefined;
    return {
      report: toReport(rep),
      reporter: { id: rep.reporterId, displayName: people.get(rep.reporterId)?.displayName ?? '' },
      subject: subject ? { id: subject.id, displayName: subject.displayName, avatarKey: subject.avatarKey } : null,
      evidence,
      signals: rep.subjectUserId ? await signalCounts(db, rep.subjectUserId) : {},
      priorSanctions: prior.map((s) => ({ id: s.id, kind: s.kind as 'suspended', reason: s.reason, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt?.toISOString() ?? null, active: isActive(s), appeal: null }))
    };
  });

  r.post('/mod/reports/:id/resolve', {
    schema: { tags: ['moderation'], summary: 'Decide a report: dismiss, warn, restrict chat or suspend', params: idParams, body: resolveReportBody, response: { 200: reportItem, ...errors } }
  }, async (req) => {
    const { userId } = requireRole(req, 'moderator');
    return db.transaction(async (tx) => {
      const [rep] = await tx.select().from(reports).where(eq(reports.id, req.params.id)).for('update');
      if (!rep) throw new AppError('NOT_FOUND');
      if (rep.status !== 'open') throw new AppError('VALIDATION_FAILED');
      const sanction = req.body.decision !== 'dismiss';
      if (sanction && !rep.subjectUserId) throw new AppError('VALIDATION_FAILED');
      if (sanction && rep.subjectUserId === userId) throw new AppError('CANNOT_TARGET_SELF');
      if (sanction) {
        await tx.insert(userSanctions).values({
          userId: rep.subjectUserId!, kind: req.body.decision as 'suspended', reason: req.body.note, reportId: rep.id, createdBy: userId,
          endsAt: req.body.durationHours ? sql`now() + make_interval(hours => ${req.body.durationHours})` : null
        });
      }
      const [updated] = await tx.update(reports).set({ status: sanction ? 'resolved' : 'dismissed', decision: req.body.decision, resolution: req.body.note,
        resolvedBy: userId, resolvedAt: sql`now()` }).where(eq(reports.id, rep.id)).returning();
      await tx.insert(auditLog).values({ actorId: userId, action: 'report.resolve', targetType: 'report', targetId: rep.id,
        metadata: { decision: req.body.decision, durationHours: req.body.durationHours ?? null, subjectUserId: rep.subjectUserId }, requestId: req.id });
      return toReport(updated!);
    });
  });

  r.get('/mod/appeals', {
    schema: { tags: ['moderation'], summary: 'Open appeals (moderator)', response: { 200: z.object({ items: z.array(z.object({
      id: z.uuid(), text: z.string(), createdAt: z.iso.datetime(), user: z.object({ id: z.uuid(), displayName: z.string() }),
      sanction: z.object({ id: z.uuid(), kind: z.string(), reason: z.string(), endsAt: z.iso.datetime().nullable(), createdBy: z.uuid() }) })) }), ...errors } }
  }, async (req) => {
    requireRole(req, 'moderator');
    const rows = await db.select({ a: appeals, s: userSanctions }).from(appeals).innerJoin(userSanctions, eq(userSanctions.id, appeals.sanctionId))
      .where(eq(appeals.status, 'open')).orderBy(asc(appeals.createdAt));
    const people = await profiles(db, rows.map((x) => x.a.userId));
    return { items: rows.map(({ a, s }) => ({ id: a.id, text: a.text, createdAt: a.createdAt.toISOString(),
      user: { id: a.userId, displayName: people.get(a.userId)?.displayName ?? '' },
      sanction: { id: s.id, kind: s.kind, reason: s.reason, endsAt: s.endsAt?.toISOString() ?? null, createdBy: s.createdBy } })) };
  });

  r.post('/mod/appeals/:id/decide', {
    schema: { tags: ['moderation'], summary: 'Decide an appeal (a different moderator than the one who sanctioned, unless admin)', params: idParams, body: decideAppealBody, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const auth = requireRole(req, 'moderator');
    await db.transaction(async (tx) => {
      const [row] = await tx.select({ a: appeals, s: userSanctions }).from(appeals).innerJoin(userSanctions, eq(userSanctions.id, appeals.sanctionId))
        .where(eq(appeals.id, req.params.id)).for('update');
      if (!row || row.a.status !== 'open') throw new AppError('NOT_FOUND');
      if (row.s.createdBy === auth.userId && !auth.roles.includes('admin')) throw new AppError('FORBIDDEN');
      await tx.update(appeals).set({ status: req.body.decision, decidedBy: auth.userId, decidedAt: sql`now()`, decisionNote: req.body.note }).where(eq(appeals.id, row.a.id));
      if (req.body.decision === 'revoked') {
        await tx.update(userSanctions).set({ revokedAt: sql`now()`, revokedBy: auth.userId }).where(and(eq(userSanctions.id, row.s.id), isNull(userSanctions.revokedAt)));
      }
      await tx.insert(auditLog).values({ actorId: auth.userId, action: 'appeal.decide', targetType: 'appeal', targetId: row.a.id,
        metadata: { decision: req.body.decision, sanctionId: row.s.id }, requestId: req.id });
    });
    return reply.code(204).send(null);
  });

  r.get('/mod/audit', {
    schema: { tags: ['moderation'], summary: 'Moderation/admin audit history with filters (moderator)',
      querystring: z.object({ action: z.string().max(64).optional(), targetType: z.string().max(32).optional(), targetId: z.string().max(64).optional(), actorId: z.uuid().optional() }), response: { 200: z.object({ items: z.array(z.object({
      action: z.string(), targetType: z.string(), targetId: z.string(), actorName: z.string(), metadata: z.unknown(), createdAt: z.iso.datetime() })) }), ...errors } }
  }, async (req) => {
    requireRole(req, 'moderator');
    const q = req.query;
    const rows = await db.select().from(auditLog).where(and(
      inArray(auditLog.targetType, ['report', 'appeal', 'message', 'club', 'game', 'game_version', 'incident', 'season', 'plan', 'mission', 'user', 'payment']),
      q.action ? sql`${auditLog.action} like ${q.action.replace(/[\\%_]/g, '') + '%'}` : undefined,
      q.targetType ? eq(auditLog.targetType, q.targetType) : undefined,
      q.targetId ? eq(auditLog.targetId, q.targetId) : undefined,
      q.actorId ? eq(auditLog.actorId, q.actorId) : undefined))
      .orderBy(desc(auditLog.createdAt)).limit(100);
    const people = await profiles(db, rows.map((x) => x.actorId).filter((x): x is string => !!x));
    return { items: rows.map((x) => ({ action: x.action, targetType: x.targetType, targetId: x.targetId, actorName: x.actorId ? people.get(x.actorId)?.displayName ?? '' : 'سیستم',
      metadata: x.metadata, createdAt: x.createdAt.toISOString() })) };
  });
}
