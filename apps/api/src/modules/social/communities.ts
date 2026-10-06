// Groups (private gatherings, quick invites) and clubs (public page, owner/managers, open/request/invite membership).
// Every permission is checked on the server against the current membership row (FR-12).
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AppError, apiErrorSchema, clubBody, clubDetail, clubSummary, clubUpdateBody, groupBody, groupView, normalizeSearch, userIdBody, type ClubDetail
} from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { Deps } from '../../app.ts';
import { requireUser } from '../auth/session.ts';
import { scopeConversation } from './chat.ts';
import { areFriends, isBlockedEither, membershipOf, profiles, requireActiveUser } from './relations.ts';

const { groups, clubs, memberships, outboxEvents, auditLog } = schema;
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema };
type Role = 'owner' | 'manager' | 'member';
const isManager = (m?: { role: string; status: string }) => m?.status === 'active' && (m.role === 'owner' || m.role === 'manager');

async function membersOf(db: Db, scopeType: 'group' | 'club', scopeId: string) {
  const rows = await db.select().from(memberships).where(and(eq(memberships.scopeType, scopeType), eq(memberships.scopeId, scopeId))).orderBy(asc(memberships.createdAt));
  const map = await profiles(db, rows.map((m) => m.userId));
  return rows.map((m) => ({ user: map.get(m.userId)!, role: m.role as Role, status: m.status as 'active' | 'requested' | 'invited' }));
}

export function communityRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const idParams = z.object({ id: z.uuid() });

  // ===================== Groups =====================
  const groupFor = async (groupId: string, userId: string) => {
    const [g] = await db.select().from(groups).where(eq(groups.id, groupId));
    if (!g) throw new AppError('NOT_FOUND');
    const m = await membershipOf(db, 'group', g.id, userId);
    if (!m) throw new AppError('NOT_A_MEMBER'); // private: invisible to non-members
    return { g, m };
  };
  const groupResponse = async (groupId: string, userId: string) => {
    const { g, m } = await groupFor(groupId, userId);
    const c = m.status === 'active' ? await scopeConversation(db, 'group', g.id) : null;
    return { id: g.id, name: g.name, ownerId: g.ownerId, conversationId: c?.id ?? null, myRole: m.role as Role, myStatus: m.status as 'active', members: await membersOf(db, 'group', g.id) };
  };

  r.post('/groups', { schema: { tags: ['groups'], summary: 'Create a private group', body: groupBody, response: { 201: groupView, ...errors } } }, async (req, reply) => {
    const { userId } = requireUser(req);
    const [g] = await db.insert(groups).values({ name: req.body.name, ownerId: userId }).returning();
    await db.insert(memberships).values({ scopeType: 'group', scopeId: g!.id, userId, role: 'owner', status: 'active' });
    return reply.code(201).send(await groupResponse(g!.id, userId));
  });

  r.get('/me/groups', {
    schema: { tags: ['groups'], summary: 'My groups and group invitations', response: { 200: z.object({ items: z.array(z.object({ id: z.uuid(), name: z.string(), myStatus: z.string(), myRole: z.string(), memberCount: z.number().int() })) }), 401: apiErrorSchema } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const rows = await db.select({ g: groups, m: memberships }).from(memberships).innerJoin(groups, eq(groups.id, memberships.scopeId))
      .where(and(eq(memberships.scopeType, 'group'), eq(memberships.userId, userId)));
    const counts = rows.length ? await db.select({ id: memberships.scopeId, n: sql<number>`count(*)::int` }).from(memberships)
      .where(and(eq(memberships.scopeType, 'group'), eq(memberships.status, 'active'), inArray(memberships.scopeId, rows.map((x) => x.g.id)))).groupBy(memberships.scopeId) : [];
    return { items: rows.map(({ g, m }) => ({ id: g.id, name: g.name, myStatus: m.status, myRole: m.role, memberCount: counts.find((c) => c.id === g.id)?.n ?? 0 })) };
  });

  r.get('/groups/:id', { schema: { tags: ['groups'], summary: 'Group (members and invitees only)', params: idParams, response: { 200: groupView, ...errors } } },
    async (req) => groupResponse(req.params.id, requireUser(req).userId));

  r.post('/groups/:id/invites', { schema: { tags: ['groups'], summary: 'Invite a friend (owner/manager)', params: idParams, body: userIdBody, response: { 200: groupView, ...errors } } }, async (req) => {
    const { userId } = requireUser(req);
    const { g, m } = await groupFor(req.params.id, userId);
    if (!isManager(m)) throw new AppError('MANAGER_REQUIRED');
    await requireActiveUser(db, req.body.userId);
    if (await isBlockedEither(db, userId, req.body.userId)) throw new AppError('BLOCKED');
    if (!(await areFriends(db, userId, req.body.userId))) throw new AppError('FORBIDDEN');
    await db.insert(memberships).values({ scopeType: 'group', scopeId: g.id, userId: req.body.userId, role: 'member', status: 'invited', invitedBy: userId }).onConflictDoNothing();
    return groupResponse(g.id, userId);
  });

  r.post('/groups/:id/accept', { schema: { tags: ['groups'], summary: 'Accept a group invitation', params: idParams, response: { 200: groupView, ...errors } } }, async (req) => {
    const { userId } = requireUser(req);
    const { g, m } = await groupFor(req.params.id, userId);
    if (m.status !== 'invited') throw new AppError('NOT_FOUND');
    await db.update(memberships).set({ status: 'active' }).where(eq(memberships.id, m.id));
    return groupResponse(g.id, userId);
  });

  r.delete('/groups/:id/members/:userId', {
    schema: { tags: ['groups'], summary: 'Leave, decline, or (owner/manager) remove a member', params: z.object({ id: z.uuid(), userId: z.uuid() }), response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireUser(req);
    const { g, m } = await groupFor(req.params.id, userId);
    const target = await membershipOf(db, 'group', g.id, req.params.userId);
    if (!target) throw new AppError('NOT_FOUND');
    if (target.role === 'owner') throw new AppError('FORBIDDEN');
    if (req.params.userId !== userId && !(isManager(m) && (m.role === 'owner' || target.role === 'member'))) throw new AppError('MANAGER_REQUIRED');
    await db.delete(memberships).where(eq(memberships.id, target.id));
    return reply.code(204).send(null);
  });

  // ===================== Clubs =====================
  const clubBySlug = async (slug: string) => {
    const [c] = await db.select().from(clubs).where(eq(clubs.slug, slug));
    if (!c) throw new AppError('NOT_FOUND');
    return c;
  };
  const summary = async (c: typeof clubs.$inferSelect) => {
    const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(memberships).where(and(eq(memberships.scopeType, 'club'), eq(memberships.scopeId, c.id), eq(memberships.status, 'active')));
    const owner = (await profiles(db, [c.ownerId])).get(c.ownerId)!;
    return { id: c.id, slug: c.slug, name: c.name, description: c.description, joinPolicy: c.joinPolicy as 'open', memberCount: n?.n ?? 0, owner };
  };
  const detail = async (slug: string, userId: string): Promise<ClubDetail> => {
    const c = await clubBySlug(slug);
    const mine = await membershipOf(db, 'club', c.id, userId);
    const all = await membersOf(db, 'club', c.id);
    const conv = mine?.status === 'active' ? await scopeConversation(db, 'club', c.id) : null;
    return {
      ...(await summary(c)),
      myMembership: mine ? { role: mine.role as Role, status: mine.status as 'active' } : null,
      members: all.filter((m) => m.status === 'active'),
      pending: isManager(mine) ? all.filter((m) => m.status !== 'active') : [],
      conversationId: conv?.id ?? null
    };
  };
  const audit = (actorId: string, action: string, clubId: string, metadata: object, requestId: string) =>
    db.insert(auditLog).values({ actorId, action, targetType: 'club', targetId: clubId, metadata, requestId });

  r.get('/clubs', {
    schema: { tags: ['clubs'], summary: 'Club directory', querystring: z.object({ q: z.string().max(60).optional() }), response: { 200: z.object({ items: z.array(clubSummary) }), 401: apiErrorSchema } }
  }, async (req) => {
    requireUser(req);
    const q = req.query.q ? normalizeSearch(req.query.q) : '';
    const rows = await db.select().from(clubs).where(q ? sql`replace(translate(lower(${clubs.name} || ' ' || ${clubs.slug}), 'يكى', 'یکی'), chr(8204), ' ') like ${`%${q.replace(/[\\%_]/g, (x) => `\\${x}`)}%`}` : undefined).limit(50);
    return { items: await Promise.all(rows.map(summary)) };
  });

  r.post('/clubs', { schema: { tags: ['clubs'], summary: 'Create a club; the creator becomes owner', body: clubBody, response: { 201: clubDetail, ...errors } } }, async (req, reply) => {
    const { userId } = requireUser(req);
    const [c] = await db.insert(clubs).values({ ...req.body, ownerId: userId }).onConflictDoNothing({ target: clubs.slug }).returning();
    if (!c) throw new AppError('SLUG_TAKEN');
    await db.insert(memberships).values({ scopeType: 'club', scopeId: c.id, userId, role: 'owner', status: 'active' });
    return reply.code(201).send(await detail(c.slug, userId));
  });

  const slugParams = z.object({ slug: z.string().max(40) });
  r.get('/clubs/:slug', { schema: { tags: ['clubs'], summary: 'Public club page (pending list for managers only)', params: slugParams, response: { 200: clubDetail, ...errors } } },
    async (req) => detail(req.params.slug, requireUser(req).userId));

  r.patch('/clubs/:slug', { schema: { tags: ['clubs'], summary: 'Edit club (owner/manager)', params: slugParams, body: clubUpdateBody, response: { 200: clubDetail, ...errors } } }, async (req) => {
    const { userId } = requireUser(req);
    const c = await clubBySlug(req.params.slug);
    if (!isManager(await membershipOf(db, 'club', c.id, userId))) throw new AppError('MANAGER_REQUIRED');
    await db.update(clubs).set(req.body).where(eq(clubs.id, c.id));
    await audit(userId, 'club.update', c.id, req.body, req.id);
    return detail(c.slug, userId);
  });

  r.post('/clubs/:slug/join', { schema: { tags: ['clubs'], summary: 'Join (open), request (request) or accept an invitation (invite)', params: slugParams, response: { 200: clubDetail, ...errors } } }, async (req) => {
    const { userId } = requireUser(req);
    const c = await clubBySlug(req.params.slug);
    const mine = await membershipOf(db, 'club', c.id, userId);
    if (mine?.status === 'active') return detail(c.slug, userId);
    if (mine?.status === 'invited') {
      await db.update(memberships).set({ status: 'active' }).where(eq(memberships.id, mine.id));
    } else if (c.joinPolicy === 'open') {
      await db.insert(memberships).values({ scopeType: 'club', scopeId: c.id, userId, role: 'member', status: 'active' }).onConflictDoNothing();
    } else if (c.joinPolicy === 'request') {
      if (!mine) {
        await db.transaction(async (tx) => {
          await tx.insert(memberships).values({ scopeType: 'club', scopeId: c.id, userId, role: 'member', status: 'requested' });
          const managers = await tx.select({ userId: memberships.userId }).from(memberships)
            .where(and(eq(memberships.scopeType, 'club'), eq(memberships.scopeId, c.id), eq(memberships.status, 'active'), inArray(memberships.role, ['owner', 'manager'])));
          await tx.insert(outboxEvents).values({ topic: 'club.requested', aggregateId: c.id, payload: { clubSlug: c.slug, clubName: c.name, managerIds: managers.map((m) => m.userId), userId } });
        });
      }
    } else {
      throw new AppError('INVITE_ONLY');
    }
    return detail(c.slug, userId);
  });

  r.post('/clubs/:slug/invites', { schema: { tags: ['clubs'], summary: 'Invite a user (owner/manager)', params: slugParams, body: userIdBody, response: { 200: clubDetail, ...errors } } }, async (req) => {
    const { userId } = requireUser(req);
    const c = await clubBySlug(req.params.slug);
    if (!isManager(await membershipOf(db, 'club', c.id, userId))) throw new AppError('MANAGER_REQUIRED');
    await requireActiveUser(db, req.body.userId);
    if (await isBlockedEither(db, userId, req.body.userId)) throw new AppError('BLOCKED');
    const existing = await membershipOf(db, 'club', c.id, req.body.userId);
    if (existing?.status === 'requested') await db.update(memberships).set({ status: 'active' }).where(eq(memberships.id, existing.id));
    else if (!existing) await db.insert(memberships).values({ scopeType: 'club', scopeId: c.id, userId: req.body.userId, role: 'member', status: 'invited', invitedBy: userId });
    await audit(userId, 'club.invite', c.id, { userId: req.body.userId }, req.id);
    return detail(c.slug, userId);
  });

  const memberParams = z.object({ slug: z.string().max(40), userId: z.uuid() });
  r.post('/clubs/:slug/requests/:userId/:decision', {
    schema: { tags: ['clubs'], summary: 'Approve or reject a join request (owner/manager)', params: memberParams.extend({ decision: z.enum(['approve', 'reject']) }), response: { 200: clubDetail, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const c = await clubBySlug(req.params.slug);
    if (!isManager(await membershipOf(db, 'club', c.id, userId))) throw new AppError('MANAGER_REQUIRED');
    const target = await membershipOf(db, 'club', c.id, req.params.userId);
    if (target?.status !== 'requested') throw new AppError('NOT_FOUND');
    if (req.params.decision === 'approve') await db.update(memberships).set({ status: 'active' }).where(eq(memberships.id, target.id));
    else await db.delete(memberships).where(eq(memberships.id, target.id));
    await audit(userId, `club.request.${req.params.decision}`, c.id, { userId: req.params.userId }, req.id);
    return detail(c.slug, userId);
  });

  r.patch('/clubs/:slug/members/:userId', {
    schema: { tags: ['clubs'], summary: 'Change a member role (owner only)', params: memberParams, body: z.strictObject({ role: z.enum(['manager', 'member']) }), response: { 200: clubDetail, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const c = await clubBySlug(req.params.slug);
    const mine = await membershipOf(db, 'club', c.id, userId);
    if (mine?.role !== 'owner' || mine.status !== 'active') throw new AppError('OWNER_REQUIRED');
    const target = await membershipOf(db, 'club', c.id, req.params.userId);
    if (!target || target.status !== 'active' || target.role === 'owner') throw new AppError('NOT_FOUND');
    await db.update(memberships).set({ role: req.body.role }).where(eq(memberships.id, target.id));
    await audit(userId, 'club.role', c.id, { userId: req.params.userId, from: target.role, to: req.body.role }, req.id);
    return detail(c.slug, userId);
  });

  r.delete('/clubs/:slug/members/:userId', {
    schema: { tags: ['clubs'], summary: 'Leave, or remove a member (managers remove members; the owner removes anyone but themself)', params: memberParams, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireUser(req);
    const c = await clubBySlug(req.params.slug);
    const mine = await membershipOf(db, 'club', c.id, userId);
    const target = await membershipOf(db, 'club', c.id, req.params.userId);
    if (!target) throw new AppError('NOT_FOUND');
    if (target.role === 'owner') throw new AppError('FORBIDDEN');
    const self = req.params.userId === userId;
    if (!self && !(mine?.status === 'active' && (mine.role === 'owner' || (mine.role === 'manager' && target.role === 'member')))) throw new AppError('MANAGER_REQUIRED');
    await db.delete(memberships).where(eq(memberships.id, target.id));
    if (!self) await audit(userId, 'club.remove', c.id, { userId: req.params.userId }, req.id);
    return reply.code(204).send(null);
  });

}
