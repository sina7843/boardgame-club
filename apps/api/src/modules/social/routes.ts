// Friends, blocks, mutes, user search, privacy/notification settings and table invitations (FR-11, FR-13).
import { and, eq, ne, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AppError, apiErrorSchema, friendsResponse, normalizeSearch, tableInviteBody, userCard, userIdBody, userSettingsSchema, type UserSettings
} from '@bg/contracts';
import { schema } from '@bg/db';
import type { Deps } from '../../app.ts';
import { requireUser } from '../auth/session.ts';
import { toPublicProfile } from '../users/routes.ts';
import { areFriends, isBlockedEither, membershipOf, pair, profiles, relationship, requireActiveUser, shareCommunity } from './relations.ts';

const { friendships, blocks, userMutes, users, userSettings, outboxEvents, gameTables, participants, tableInvites, memberships } = schema;
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema };
const userParams = z.object({ userId: z.uuid() });
const DEFAULT_SETTINGS: UserSettings = { dmPolicy: 'friends', notify: { turn: true, invite: true, message: true, result: true, social: true } };

export function socialRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // ---------- People ----------
  r.get('/users', {
    schema: { tags: ['social'], summary: 'Find players by display name', querystring: z.object({ q: z.string().trim().min(2).max(40) }),
      response: { 200: z.object({ items: z.array(userCard) }), ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const q = normalizeSearch(req.query.q).replace(/[\\%_]/g, (c) => `\\${c}`);
    const rows = await db.select().from(users)
      // Same normalization as the catalog: Arabic yeh/kaf and ZWNJ never prevent a match.
      .where(and(eq(users.status, 'active'), ne(users.id, userId),
        sql`replace(translate(lower(${users.displayName}), 'يكى', 'یکی'), chr(8204), ' ') like ${`%${q}%`}`)).limit(20);
    return { items: await Promise.all(rows.map(async (u) => ({ ...toPublicProfile(u), ...(await relationship(db, userId, u.id)) }))) };
  });

  r.get('/users/:userId/card', {
    schema: { tags: ['social'], summary: 'Public profile with my relationship to the user', params: userParams, response: { 200: userCard, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    return { ...(await requireActiveUser(db, req.params.userId)), ...(await relationship(db, userId, req.params.userId)) };
  });

  // ---------- Friends ----------
  r.get('/me/friends', { schema: { tags: ['social'], summary: 'Friends, requests, blocked and muted users', response: { 200: friendsResponse, 401: apiErrorSchema } } }, async (req) => {
    const { userId } = requireUser(req);
    const rows = await db.select().from(friendships).where(or(eq(friendships.userLow, userId), eq(friendships.userHigh, userId)));
    const blocked = await db.select().from(blocks).where(eq(blocks.blockerId, userId));
    const muted = await db.select().from(userMutes).where(eq(userMutes.muterId, userId));
    const other = (f: typeof rows[number]) => (f.userLow === userId ? f.userHigh : f.userLow);
    const map = await profiles(db, [...rows.map(other), ...blocked.map((b) => b.blockedId), ...muted.map((m) => m.mutedId)]);
    const pick = (ids: string[]) => ids.map((id) => map.get(id)!).filter(Boolean);
    return {
      friends: pick(rows.filter((f) => f.status === 'accepted').map(other)),
      incoming: pick(rows.filter((f) => f.status === 'pending' && f.requestedBy !== userId).map(other)),
      outgoing: pick(rows.filter((f) => f.status === 'pending' && f.requestedBy === userId).map(other)),
      blocked: pick(blocked.map((b) => b.blockedId)),
      muted: pick(muted.map((m) => m.mutedId))
    };
  });

  r.post('/friends/requests', {
    schema: { tags: ['social'], summary: 'Send a friend request (accepts a pending reverse request)', body: userIdBody, response: { 200: userCard, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const target = req.body.userId;
    if (target === userId) throw new AppError('CANNOT_TARGET_SELF');
    await requireActiveUser(db, target);
    if (await isBlockedEither(db, userId, target)) throw new AppError('BLOCKED');
    const [low, high] = pair(userId, target);
    await db.transaction(async (tx) => {
      const [f] = await tx.select().from(friendships).where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high))).for('update');
      if (f?.status === 'accepted') throw new AppError('ALREADY_FRIENDS');
      if (f && f.requestedBy !== userId) {
        await tx.update(friendships).set({ status: 'accepted', respondedAt: sql`now()` }).where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)));
        return;
      }
      if (f) return; // already requested: idempotent
      const [created] = await tx.insert(friendships).values({ userLow: low, userHigh: high, requestedBy: userId, status: 'pending' }).returning();
      await tx.insert(outboxEvents).values({ topic: 'friend.requested', aggregateId: `${low}:${high}`,
        payload: { from: userId, to: target, requestKey: `${low}:${high}:${created!.createdAt.getTime()}` } });
    });
    return { ...(await requireActiveUser(db, target)), ...(await relationship(db, userId, target)) };
  });

  r.post('/friends/requests/:userId/accept', {
    schema: { tags: ['social'], summary: 'Accept an incoming friend request', params: userParams, response: { 200: userCard, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const [low, high] = pair(userId, req.params.userId);
    const updated = await db.update(friendships).set({ status: 'accepted', respondedAt: sql`now()` })
      .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high), eq(friendships.status, 'pending'), ne(friendships.requestedBy, userId))).returning();
    if (!updated.length) throw new AppError('NOT_FOUND');
    return { ...(await requireActiveUser(db, req.params.userId)), ...(await relationship(db, userId, req.params.userId)) };
  });

  r.delete('/friends/:userId', {
    schema: { tags: ['social'], summary: 'Remove a friend, decline or cancel a request', params: userParams, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireUser(req);
    const [low, high] = pair(userId, req.params.userId);
    await db.delete(friendships).where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)));
    return reply.code(204).send(null);
  });

  // ---------- Block / mute ----------
  r.post('/blocks', {
    schema: { tags: ['social'], summary: 'Block a user: ends friendship and prevents any new contact or invitation', body: userIdBody, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireUser(req);
    if (req.body.userId === userId) throw new AppError('CANNOT_TARGET_SELF');
    await requireActiveUser(db, req.body.userId);
    const [low, high] = pair(userId, req.body.userId);
    await db.transaction(async (tx) => {
      await tx.insert(blocks).values({ blockerId: userId, blockedId: req.body.userId }).onConflictDoNothing();
      await tx.delete(friendships).where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)));
      // Pending table invitations between the two are withdrawn.
      await tx.execute(sql`delete from table_invites where (user_id = ${req.body.userId} and invited_by = ${userId}) or (user_id = ${userId} and invited_by = ${req.body.userId})`);
    });
    return reply.code(204).send(null);
  });

  r.delete('/blocks/:userId', { schema: { tags: ['social'], summary: 'Unblock', params: userParams, response: { 204: z.null(), ...errors } } }, async (req, reply) => {
    const { userId } = requireUser(req);
    await db.delete(blocks).where(and(eq(blocks.blockerId, userId), eq(blocks.blockedId, req.params.userId)));
    return reply.code(204).send(null);
  });

  r.post('/mutes', { schema: { tags: ['social'], summary: 'Mute: hide messages and notifications from a user', body: userIdBody, response: { 204: z.null(), ...errors } } }, async (req, reply) => {
    const { userId } = requireUser(req);
    if (req.body.userId === userId) throw new AppError('CANNOT_TARGET_SELF');
    await db.insert(userMutes).values({ muterId: userId, mutedId: req.body.userId }).onConflictDoNothing();
    return reply.code(204).send(null);
  });

  r.delete('/mutes/:userId', { schema: { tags: ['social'], summary: 'Unmute', params: userParams, response: { 204: z.null(), ...errors } } }, async (req, reply) => {
    const { userId } = requireUser(req);
    await db.delete(userMutes).where(and(eq(userMutes.muterId, userId), eq(userMutes.mutedId, req.params.userId)));
    return reply.code(204).send(null);
  });

  // ---------- Settings ----------
  r.get('/me/settings', { schema: { tags: ['social'], summary: 'Privacy and notification preferences', response: { 200: userSettingsSchema, 401: apiErrorSchema } } }, async (req) => {
    const { userId } = requireUser(req);
    const [s] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return s ? { dmPolicy: s.dmPolicy as UserSettings['dmPolicy'], notify: s.notify } : DEFAULT_SETTINGS;
  });

  r.put('/me/settings', { schema: { tags: ['social'], summary: 'Update preferences', body: userSettingsSchema, response: { 200: userSettingsSchema, ...errors } } }, async (req) => {
    const { userId } = requireUser(req);
    await db.insert(userSettings).values({ userId, ...req.body })
      .onConflictDoUpdate({ target: userSettings.userId, set: { ...req.body, updatedAt: sql`now()` } });
    return req.body;
  });

  // ---------- Table invitations ----------
  r.post('/tables/:id/invites', {
    schema: { tags: ['social'], summary: 'Invite a friend or community member (or a whole group) to an open table',
      params: z.object({ id: z.uuid() }), body: tableInviteBody, response: { 200: z.object({ invited: z.number().int() }), ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const [table] = await db.select().from(gameTables).where(eq(gameTables.id, req.params.id));
    if (!table) throw new AppError('NOT_FOUND');
    const [me] = await db.select().from(participants).where(and(eq(participants.tableId, table.id), eq(participants.userId, userId)));
    if (!me) throw new AppError('NOT_PARTICIPANT');
    if (table.status !== 'open' || table.isTutorial || table.isMatchmade) throw new AppError('TABLE_NOT_OPEN');

    let targets: string[];
    if ('userId' in req.body) {
      const target = req.body.userId;
      if (target === userId) throw new AppError('CANNOT_TARGET_SELF');
      await requireActiveUser(db, target);
      if (await isBlockedEither(db, userId, target)) throw new AppError('BLOCKED');
      if (!(await areFriends(db, userId, target)) && !(await shareCommunity(db, userId, target))) throw new AppError('FORBIDDEN');
      targets = [target];
    } else {
      const m = await membershipOf(db, 'group', req.body.groupId, userId);
      if (!m || m.status !== 'active') throw new AppError('NOT_A_MEMBER');
      const members = await db.select({ userId: memberships.userId }).from(memberships)
        .where(and(eq(memberships.scopeType, 'group'), eq(memberships.scopeId, req.body.groupId), eq(memberships.status, 'active'), ne(memberships.userId, userId)));
      targets = [];
      for (const { userId: u } of members) if (!(await isBlockedEither(db, userId, u))) targets.push(u);
    }
    const seated = new Set((await db.select({ userId: participants.userId }).from(participants).where(eq(participants.tableId, table.id))).map((p) => p.userId));
    targets = targets.filter((t) => !seated.has(t));
    if (targets.length) {
      await db.transaction(async (tx) => {
        await tx.insert(tableInvites).values(targets.map((t) => ({ tableId: table.id, userId: t, invitedBy: userId }))).onConflictDoNothing();
        await tx.insert(outboxEvents).values({ topic: 'table.invited', aggregateId: table.id, payload: { tableId: table.id, gameId: table.gameId, userIds: targets, invitedBy: userId } });
      });
    }
    return { invited: targets.length };
  });

}
