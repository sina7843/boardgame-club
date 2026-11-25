// Time-limited events («رویداد»): public list and page (points, goals, leaderboard), admin CRUD. Every number is derived
// on the server from reward_ledger rows; no endpoint accepts client-claimed points.
import { desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { adminEventBody, adminEventItem, apiErrorSchema, cosmetic, eventDetail, eventsResponse, SLOT_FA, type AdminEventBody, type EventGoal, type EventSummary } from '@bg/contracts';
import { schema } from '@bg/db';
import { EVENT_POINTS, eventGoalsFor, eventLeaderboard, eventRewardGranted, eventStatusOf, validateEvent, type EventRow } from '@bg/play';
import type { Deps } from '../../app.ts';
import { AppError } from '../../http/errors.ts';
import { requireRole } from '../auth/session.ts';
import { profiles } from '../social/relations.ts';

const { events, games, auditLog } = schema;
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema };
const STATUS_ORDER = { live: 0, upcoming: 1, ended: 2 } as const;
const isUnique = (e: unknown) => { const x = e as { code?: string; cause?: { code?: string } }; return (x.code ?? x.cause?.code) === '23505'; };

export function eventRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  const gameNames = async (rows: EventRow[]) => {
    const ids = [...new Set(rows.flatMap((e) => e.gameIds ?? []))];
    const found = ids.length ? await db.select({ id: games.id, nameFa: games.nameFa }).from(games).where(inArray(games.id, ids)) : [];
    return new Map(found.map((g) => [g.id, g.nameFa]));
  };
  const summary = (e: EventRow, names: Map<string, string>): EventSummary => {
    const item = e.rewardCosmetic ? cosmetic(e.rewardCosmetic) : undefined;
    return {
      slug: e.slug, titleFa: e.titleFa, descriptionFa: e.descriptionFa, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(), status: eventStatusOf(e),
      games: e.gameIds ? e.gameIds.map((id) => ({ id, nameFa: names.get(id) ?? id })) : null,
      reward: item ? { key: item.key, nameFa: item.nameFa, slotFa: SLOT_FA[item.slot] } : null
    };
  };
  const adminItem = (e: EventRow) => ({ id: e.id, slug: e.slug, titleFa: e.titleFa, descriptionFa: e.descriptionFa, startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(), gameIds: e.gameIds, goals: e.goals as EventGoal[], rewardCosmetic: e.rewardCosmetic, active: e.active, status: eventStatusOf(e) });
  const values = (b: AdminEventBody) => ({ slug: b.slug, titleFa: b.titleFa, descriptionFa: b.descriptionFa, startsAt: new Date(b.startsAt), endsAt: new Date(b.endsAt),
    gameIds: b.gameIds?.length ? [...new Set(b.gameIds)] : null, goals: b.goals, rewardCosmetic: b.rewardCosmetic, active: b.active });

  r.get('/events', {
    schema: { tags: ['events'], summary: 'Active events: live first, then upcoming, then the most recent ended ones', response: { 200: eventsResponse } }
  }, async () => {
    const rows = await db.select().from(events).where(eq(events.active, true)).orderBy(desc(events.startsAt)).limit(50);
    const names = await gameNames(rows);
    return { items: rows.map((e) => summary(e, names)).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) };
  });

  r.get('/events/:slug', {
    schema: { tags: ['events'], summary: 'One event: goals (with my progress when signed in), top 100 by points and my rank',
      params: z.object({ slug: z.string().max(60) }), response: { 200: eventDetail, 404: apiErrorSchema } }
  }, async (req) => {
    const [e] = await db.select().from(events).where(eq(events.slug, req.params.slug));
    if (!e || !e.active) throw new AppError('NOT_FOUND');
    const me = req.auth?.userId ?? null;
    const board = await eventLeaderboard(db, e, me);
    const people = await profiles(db, board.top.map((x) => x.userId));
    const goals = me ? await eventGoalsFor(db, e, me) : (e.goals as EventGoal[]).map((g) => ({ type: g.type, target: g.count, progress: 0 }));
    return {
      ...summary(e, await gameNames([e])), goals,
      leaderboard: board.top.filter((x) => people.has(x.userId)).map((x) => ({ rank: x.rank, user: people.get(x.userId)!, points: x.points })),
      me: me ? { rank: board.me?.rank ?? null, points: board.me?.points ?? 0, rewardGranted: await eventRewardGranted(db, e.id, me) } : null,
      rules: EVENT_POINTS
    };
  });

  r.get('/admin/events', {
    schema: { tags: ['admin'], summary: 'All events (active or not)', response: { 200: z.object({ items: z.array(adminEventItem) }), ...errors } }
  }, async (req) => {
    requireRole(req, 'admin');
    return { items: (await db.select().from(events).orderBy(desc(events.startsAt))).map(adminItem) };
  });

  r.post('/admin/events', {
    schema: { tags: ['admin'], summary: 'Create an event (ends after it starts; known games; an existing catalogue cosmetic as reward)', body: adminEventBody,
      response: { 201: adminEventItem, ...errors } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    await validateEvent(db, req.body);
    try {
      const row = await db.transaction(async (tx) => {
        const [e] = await tx.insert(events).values({ ...values(req.body), createdBy: userId }).returning();
        await tx.insert(auditLog).values({ actorId: userId, action: 'event.create', targetType: 'event', targetId: e!.id, metadata: req.body, requestId: req.id });
        return e!;
      });
      return reply.code(201).send(adminItem(row));
    } catch (err) { if (isUnique(err)) throw new AppError('SLUG_TAKEN'); throw err; }
  });

  r.put('/admin/events/:id', {
    schema: { tags: ['admin'], summary: 'Edit an event (whole definition)', params: z.object({ id: z.uuid() }), body: adminEventBody, response: { 200: adminEventItem, ...errors } }
  }, async (req) => {
    const { userId } = requireRole(req, 'admin');
    await validateEvent(db, req.body);
    try {
      return adminItem(await db.transaction(async (tx) => {
        const [e] = await tx.update(events).set(values(req.body)).where(eq(events.id, req.params.id)).returning();
        if (!e) throw new AppError('NOT_FOUND');
        await tx.insert(auditLog).values({ actorId: userId, action: 'event.update', targetType: 'event', targetId: e.id, metadata: req.body, requestId: req.id });
        return e;
      }));
    } catch (err) { if (isUnique(err)) throw new AppError('SLUG_TAKEN'); throw err; }
  });

  r.patch('/admin/events/:id', {
    schema: { tags: ['admin'], summary: 'Activate or deactivate an event', params: z.object({ id: z.uuid() }), body: z.strictObject({ active: z.boolean() }),
      response: { 200: adminEventItem, ...errors } }
  }, async (req) => {
    const { userId } = requireRole(req, 'admin');
    return adminItem(await db.transaction(async (tx) => {
      const [e] = await tx.update(events).set({ active: req.body.active }).where(eq(events.id, req.params.id)).returning();
      if (!e) throw new AppError('NOT_FOUND');
      await tx.insert(auditLog).values({ actorId: userId, action: 'event.active', targetType: 'event', targetId: e.id, metadata: req.body, requestId: req.id });
      return e;
    }));
  });
}
