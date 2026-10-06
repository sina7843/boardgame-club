// Conversations: direct messages (friends-only by default), table chat, group chat and club chat.
// Access is decided per request from current membership — never from a client-joined socket room.
import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, apiErrorSchema, conversationItem, messageBody, messageItem, messagesPage, userIdBody, type ConversationItem, type MessageItem } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { isChatRestricted } from '@bg/play';
import type { Deps } from '../../app.ts';
import { requireUser, type AuthContext } from '../auth/session.ts';
import { assertCanDirectMessage, membershipOf, pair, profiles } from './relations.ts';

const { conversations, conversationMembers, messages, participants, gameTables, groups, clubs, memberships, userMutes, outboxEvents, auditLog } = schema;
type Conversation = typeof conversations.$inferSelect;
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema };

/** Keep text plain and bounded: no control characters, at most two consecutive blank lines. Rendered as text only. */
export function sanitizeMessage(input: string): string {
  return input.normalize('NFC')
    // eslint-disable-next-line no-control-regex -- stripping control and bidi-override characters is the point
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** User ids allowed to read a conversation right now. */
export async function conversationMembersOf(db: Db, c: Conversation): Promise<string[]> {
  if (c.kind === 'direct') {
    return (await db.select({ userId: conversationMembers.userId }).from(conversationMembers).where(eq(conversationMembers.conversationId, c.id))).map((m) => m.userId);
  }
  if (c.kind === 'table') {
    return (await db.select({ userId: participants.userId }).from(participants).where(eq(participants.tableId, c.scopeId!)))
      .map((p) => p.userId).filter((u): u is string => !!u);
  }
  return (await db.select({ userId: memberships.userId }).from(memberships).where(and(
    eq(memberships.scopeType, c.kind as 'group' | 'club'), eq(memberships.scopeId, c.scopeId!), eq(memberships.status, 'active')))).map((m) => m.userId);
}

async function canModerate(db: Db, auth: AuthContext, c: Conversation): Promise<boolean> {
  if (auth.roles.includes('moderator') || auth.roles.includes('admin')) return true;
  if (c.kind === 'group' || c.kind === 'club') {
    const m = await membershipOf(db, c.kind, c.scopeId!, auth.userId);
    return m?.status === 'active' && (m.role === 'owner' || m.role === 'manager');
  }
  return false;
}

async function loadAccessible(db: Db, auth: AuthContext, id: string): Promise<{ c: Conversation; members: string[] }> {
  const [c] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!c) throw new AppError('NOT_FOUND');
  const members = await conversationMembersOf(db, c);
  if (!members.includes(auth.userId)) throw new AppError('FORBIDDEN');
  return { c, members };
}

export async function scopeConversation(db: Db, kind: 'table' | 'group' | 'club', scopeId: string): Promise<Conversation> {
  await db.insert(conversations).values({ kind, scopeId }).onConflictDoNothing();
  const [c] = await db.select().from(conversations).where(and(eq(conversations.kind, kind), eq(conversations.scopeId, scopeId)));
  return c!;
}

async function toItems(db: Db, rows: (typeof messages.$inferSelect)[]): Promise<MessageItem[]> {
  const map = await profiles(db, rows.map((m) => m.senderId));
  return rows.map((m) => ({
    id: m.id, conversationId: m.conversationId, sender: map.get(m.senderId)!, createdAt: m.createdAt.toISOString(),
    deleted: !!m.deletedAt, body: m.deletedAt ? '' : m.body
  }));
}

export async function messageItemById(db: Db, id: string): Promise<{ item: MessageItem; conversation: Conversation } | null> {
  const [m] = await db.select().from(messages).where(eq(messages.id, id));
  if (!m) return null;
  const [c] = await db.select().from(conversations).where(eq(conversations.id, m.conversationId));
  return { item: (await toItems(db, [m]))[0]!, conversation: c! };
}

export function chatRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const idParams = z.object({ id: z.uuid() });

  const page = async (auth: AuthContext, c: Conversation, before?: string, limit = 30) => {
    const muted = (await db.select({ id: userMutes.mutedId }).from(userMutes).where(eq(userMutes.muterId, auth.userId))).map((m) => m.id);
    const rows = await db.select().from(messages).where(and(
      eq(messages.conversationId, c.id),
      before ? lt(messages.createdAt, new Date(before)) : undefined,
      muted.length ? sql`${messages.senderId} not in (${sql.join(muted.map((m) => sql`${m}`), sql`, `)})` : undefined
    )).orderBy(desc(messages.createdAt)).limit(limit + 1);
    const more = rows.length > limit;
    const items = (await toItems(db, rows.slice(0, limit))).reverse();
    await db.insert(conversationMembers).values({ conversationId: c.id, userId: auth.userId, lastReadAt: sql`now()` })
      .onConflictDoUpdate({ target: [conversationMembers.conversationId, conversationMembers.userId], set: { lastReadAt: sql`now()` } });
    return { items, nextBefore: more ? items[0]!.createdAt : null };
  };

  const post = async (auth: AuthContext, c: Conversation, members: string[], raw: string): Promise<MessageItem> => {
    if (await isChatRestricted(db, auth.userId)) throw new AppError('CHAT_RESTRICTED');
    if (c.kind === 'direct') {
      const other = members.find((m) => m !== auth.userId)!;
      await assertCanDirectMessage(db, auth.userId, other);
    }
    if (c.kind === 'table') {
      const [t] = await db.select({ status: gameTables.status }).from(gameTables).where(eq(gameTables.id, c.scopeId!));
      if (t?.status === 'cancelled') throw new AppError('TABLE_NOT_OPEN');
    }
    const body = sanitizeMessage(raw);
    if (!body) throw new AppError('VALIDATION_FAILED');
    const m = await db.transaction(async (tx) => {
      const [m] = await tx.insert(messages).values({ conversationId: c.id, senderId: auth.userId, body }).returning();
      await tx.update(conversations).set({ lastMessageAt: sql`now()` }).where(eq(conversations.id, c.id));
      // In-app notifications only for private messages; group/club/table chat is visible in place.
      if (c.kind === 'direct') {
        await tx.insert(outboxEvents).values({ topic: 'message.created', aggregateId: c.id,
          payload: { messageId: m!.id, conversationId: c.id, senderId: auth.userId, recipientIds: members.filter((u) => u !== auth.userId) } });
      }
      await tx.execute(sql`select pg_notify('message_created', ${m!.id})`);
      return m!;
    });
    return (await toItems(db, [m]))[0]!;
  };

  r.post('/conversations/direct', {
    schema: { tags: ['chat'], summary: 'Open (or reuse) a private conversation; friends-only unless settings say otherwise', body: userIdBody, response: { 200: z.object({ id: z.uuid() }), ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    await assertCanDirectMessage(db, userId, req.body.userId);
    const [low, high] = pair(userId, req.body.userId);
    const key = `${low}:${high}`;
    await db.insert(conversations).values({ kind: 'direct', directKey: key }).onConflictDoNothing();
    const [c] = await db.select().from(conversations).where(eq(conversations.directKey, key));
    await db.insert(conversationMembers).values([{ conversationId: c!.id, userId: low }, { conversationId: c!.id, userId: high }]).onConflictDoNothing();
    return { id: c!.id };
  });

  r.get('/me/conversations', {
    schema: { tags: ['chat'], summary: 'My private, group and club conversations', response: { 200: z.object({ items: z.array(conversationItem) }), 401: apiErrorSchema } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const direct = await db.select({ c: conversations, lastReadAt: conversationMembers.lastReadAt }).from(conversationMembers)
      .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
      .where(and(eq(conversationMembers.userId, userId), eq(conversations.kind, 'direct')));
    const myScopes = await db.select().from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.status, 'active')));
    const scoped = myScopes.length ? await db.select().from(conversations).where(or(...myScopes.map((m) => and(eq(conversations.kind, m.scopeType), eq(conversations.scopeId, m.scopeId))))) : [];
    const reads = scoped.length ? await db.select().from(conversationMembers).where(and(eq(conversationMembers.userId, userId), inArray(conversationMembers.conversationId, scoped.map((c) => c.id)))) : [];
    const all = [...direct.map((d) => ({ c: d.c, lastReadAt: d.lastReadAt })), ...scoped.map((c) => ({ c, lastReadAt: reads.find((x) => x.conversationId === c.id)?.lastReadAt ?? null }))];
    const otherIds = new Map<string, string>();
    for (const { c } of all) if (c.kind === 'direct') otherIds.set(c.id, c.directKey!.split(':').find((u) => u !== userId)!);
    const people = await profiles(db, [...otherIds.values()]);
    const groupNames = new Map((await db.select().from(groups).where(inArray(groups.id, [...myScopes.filter((m) => m.scopeType === 'group').map((m) => m.scopeId), '00000000-0000-0000-0000-000000000000']))).map((g) => [g.id, g.name]));
    const clubNames = new Map((await db.select().from(clubs).where(inArray(clubs.id, [...myScopes.filter((m) => m.scopeType === 'club').map((m) => m.scopeId), '00000000-0000-0000-0000-000000000000']))).map((c) => [c.id, c.name]));
    const items: ConversationItem[] = [];
    for (const { c, lastReadAt } of all) {
      const [last] = await db.select().from(messages).where(and(eq(messages.conversationId, c.id), isNull(messages.deletedAt))).orderBy(desc(messages.createdAt)).limit(1);
      const lastSender = last ? (await profiles(db, [last.senderId])).get(last.senderId) : null;
      const other = otherIds.has(c.id) ? people.get(otherIds.get(c.id)!) ?? null : null;
      items.push({
        id: c.id, kind: c.kind as ConversationItem['kind'], scopeId: c.scopeId, other,
        title: c.kind === 'direct' ? other?.displayName ?? '—' : c.kind === 'group' ? `گروه ${groupNames.get(c.scopeId!) ?? ''}` : `باشگاه ${clubNames.get(c.scopeId!) ?? ''}`,
        lastMessage: last ? { body: last.body.slice(0, 120), senderName: lastSender?.displayName ?? '', createdAt: last.createdAt.toISOString() } : null,
        unread: !!last && last.senderId !== userId && (!lastReadAt || last.createdAt > lastReadAt)
      });
    }
    items.sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''));
    return { items };
  });

  const pageQuery = z.object({ before: z.iso.datetime().optional(), limit: z.coerce.number().int().min(1).max(100).default(30) });

  r.get('/conversations/:id/messages', {
    schema: { tags: ['chat'], summary: 'Messages, newest page first (cursor: before)', params: idParams, querystring: pageQuery, response: { 200: messagesPage, ...errors } }
  }, async (req) => {
    const auth = requireUser(req);
    const { c } = await loadAccessible(db, auth, req.params.id);
    return { ...(await page(auth, c, req.query.before, req.query.limit)), canPost: !(await isChatRestricted(db, auth.userId)), canModerate: await canModerate(db, auth, c) };
  });

  r.post('/conversations/:id/messages', {
    schema: { tags: ['chat'], summary: 'Send a message', params: idParams, body: messageBody, response: { 201: messageItem, ...errors } }
  }, async (req, reply) => {
    const auth = requireUser(req);
    const { c, members } = await loadAccessible(db, auth, req.params.id);
    return reply.code(201).send(await post(auth, c, members, req.body.body));
  });

  // Table chat: participants only (spectators cannot read or write). Never contains game state.
  const tableChat = async (auth: AuthContext, tableId: string) => {
    const [p] = await db.select().from(participants).where(and(eq(participants.tableId, tableId), eq(participants.userId, auth.userId)));
    if (!p) throw new AppError('NOT_PARTICIPANT');
    const [t] = await db.select({ isTutorial: gameTables.isTutorial }).from(gameTables).where(eq(gameTables.id, tableId));
    if (t?.isTutorial) throw new AppError('FORBIDDEN');
    const c = await scopeConversation(db, 'table', tableId);
    return { c, members: await conversationMembersOf(db, c) };
  };

  r.get('/tables/:id/chat', {
    schema: { tags: ['chat'], summary: 'Table chat (participants only)', params: idParams, querystring: pageQuery, response: { 200: messagesPage.extend({ conversationId: z.uuid() }), ...errors } }
  }, async (req) => {
    const auth = requireUser(req);
    const { c } = await tableChat(auth, req.params.id);
    return { conversationId: c.id, ...(await page(auth, c, req.query.before, req.query.limit)), canPost: !(await isChatRestricted(db, auth.userId)), canModerate: await canModerate(db, auth, c) };
  });

  r.post('/tables/:id/chat', {
    schema: { tags: ['chat'], summary: 'Post to table chat', params: idParams, body: messageBody, response: { 201: messageItem, ...errors } }
  }, async (req, reply) => {
    const auth = requireUser(req);
    const { c, members } = await tableChat(auth, req.params.id);
    return reply.code(201).send(await post(auth, c, members, req.body.body));
  });

  r.delete('/messages/:id', {
    schema: { tags: ['chat'], summary: 'Remove a message: the sender, a manager of the group/club, or a moderator', params: idParams, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const auth = requireUser(req);
    const found = await messageItemById(db, req.params.id);
    if (!found) throw new AppError('NOT_FOUND');
    const [m] = await db.select().from(messages).where(eq(messages.id, req.params.id));
    const own = m!.senderId === auth.userId;
    if (!own && !(await canModerate(db, auth, found.conversation))) throw new AppError('FORBIDDEN');
    await db.transaction(async (tx) => {
      await tx.update(messages).set({ deletedAt: sql`now()`, deletedBy: auth.userId }).where(and(eq(messages.id, m!.id), isNull(messages.deletedAt)));
      if (!own) {
        await tx.insert(auditLog).values({ actorId: auth.userId, action: 'message.remove', targetType: 'message', targetId: m!.id,
          metadata: { conversationKind: found.conversation.kind, scopeId: found.conversation.scopeId, senderId: m!.senderId }, requestId: req.id });
      }
      await tx.execute(sql`select pg_notify('message_created', ${m!.id})`);
    });
    return reply.code(204).send(null);
  });

}
