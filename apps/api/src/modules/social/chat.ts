// Conversations: direct messages (friends-only by default), table chat, group chat and club chat.
// Access is decided per request from current membership — never from a client-joined socket room.
import { and, desc, eq, gt, inArray, isNull, lt, ne, notInArray, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AppError, apiErrorSchema, conversationItem, MESSAGE_EDIT_WINDOW_SECONDS, messageBody, messageEditBody, messageItem, messagesPage, QUICK_CHAT,
  muteChatBody, reactionBody, slowModeBody, userIdBody, type ConversationItem, type MessageItem
} from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { isChatRestricted } from '@bg/play';
import type { Deps } from '../../app.ts';
import { requireUser, type AuthContext } from '../auth/session.ts';
import { assertCanDirectMessage, membershipOf, pair, profiles } from './relations.ts';
import { maskProfanity } from './word-filter.ts';

const { conversations, conversationMembers, messageReactions, messages, participants, gameTables, groups, clubs, memberships, userMutes, outboxEvents, auditLog } = schema;
type Conversation = typeof conversations.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema, 429: apiErrorSchema };
/** Flood guard per sender, across all conversations. */
const BURST = { max: 5, seconds: 10 };

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

async function loadAccessible(db: Db, auth: AuthContext, id: string, readOnlyOk = false): Promise<{ c: Conversation; members: string[] }> {
  const [c] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!c) throw new AppError('NOT_FOUND');
  const members = await conversationMembersOf(db, c);
  if (!members.includes(auth.userId) && !(readOnlyOk && await canRead(db, c, auth.userId, members))) throw new AppError('FORBIDDEN');
  return { c, members };
}

export async function scopeConversation(db: Db, kind: 'table' | 'group' | 'club', scopeId: string): Promise<Conversation> {
  await db.insert(conversations).values({ kind, scopeId }).onConflictDoNothing();
  const [c] = await db.select().from(conversations).where(and(eq(conversations.kind, kind), eq(conversations.scopeId, scopeId)));
  return c!;
}

/** Spectators may read (not post) table chat when they may view the table: not a tutorial, not private (tournaments are always watchable). */
export async function canViewTable(db: Db, tableId: string): Promise<boolean> {
  const [t] = await db.select({ isTutorial: gameTables.isTutorial, visibility: gameTables.visibility, settings: gameTables.settings }).from(gameTables).where(eq(gameTables.id, tableId));
  if (!t || t.isTutorial) return false;
  return t.visibility !== 'private' || !!(t.settings as { tournament?: unknown }).tournament;
}

/** Members, or (table chat) anyone who may spectate the table. */
async function canRead(db: Db, c: Conversation, userId: string, members: string[]): Promise<boolean> {
  return members.includes(userId) || (c.kind === 'table' && await canViewTable(db, c.scopeId!));
}

type ReactionRow = { messageId: string; userId: string; emoji: string };
export async function reactionRows(db: Db, ids: string[]): Promise<ReactionRow[]> {
  return ids.length ? db.select({ messageId: messageReactions.messageId, userId: messageReactions.userId, emoji: messageReactions.emoji })
    .from(messageReactions).where(inArray(messageReactions.messageId, ids)).orderBy(messageReactions.createdAt) : [];
}
/** Aggregate one message's reactions for a viewer (emoji in first-used order). */
export function reactionsFor(rows: ReactionRow[], messageId: string, viewerId?: string): MessageItem['reactions'] {
  const out = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const r of rows) {
    if (r.messageId !== messageId) continue;
    const e = out.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    e.count++;
    if (r.userId === viewerId) e.mine = true;
    out.set(r.emoji, e);
  }
  return [...out.values()];
}

const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Members named as `@displayName` (name must end at a non-letter/digit). Sender excluded. */
export function mentionedIn(body: string, people: { id: string; displayName: string }[], senderId: string): string[] {
  if (!body.includes('@')) return [];
  return people.filter((p) => p.id !== senderId && p.displayName
    && new RegExp(`@${escapeRe(p.displayName)}(?![\\p{L}\\p{N}_])`, 'u').test(body)).map((p) => p.id);
}

async function toItems(db: Db, rows: MessageRow[], viewerId?: string): Promise<MessageItem[]> {
  const reactions = await reactionRows(db, rows.map((m) => m.id));
  // ponytail: loads the conversation's members once per page that contains an '@'; fine for table/DM/group sizes, cache if clubs get huge.
  const mentions = new Map<string, string[]>();
  for (const cid of new Set(rows.filter((m) => !m.deletedAt && m.body.includes('@')).map((m) => m.conversationId))) {
    const [c] = await db.select().from(conversations).where(eq(conversations.id, cid));
    const people = [...(await profiles(db, await conversationMembersOf(db, c!))).values()];
    for (const m of rows) if (m.conversationId === cid && !m.deletedAt) mentions.set(m.id, mentionedIn(m.body, people, m.senderId));
  }
  const replyIds = [...new Set(rows.map((m) => m.replyToId).filter((id): id is string => !!id))];
  const replies = new Map((replyIds.length ? await db.select().from(messages).where(inArray(messages.id, replyIds)) : []).map((r) => [r.id, r]));
  const map = await profiles(db, [...rows.map((m) => m.senderId), ...[...replies.values()].map((r) => r.senderId)]);
  return rows.map((m) => {
    const r = m.replyToId ? replies.get(m.replyToId) : undefined;
    return {
      id: m.id, conversationId: m.conversationId, sender: map.get(m.senderId)!, createdAt: m.createdAt.toISOString(),
      deleted: !!m.deletedAt, body: m.deletedAt ? '' : m.body, editedAt: m.editedAt?.toISOString() ?? null, clientId: m.clientId,
      reactions: m.deletedAt ? [] : reactionsFor(reactions, m.id, viewerId), mentions: mentions.get(m.id) ?? [],
      replyTo: r ? { id: r.id, senderName: map.get(r.senderId)?.displayName ?? '', body: r.deletedAt ? '' : r.body.slice(0, 120), deleted: !!r.deletedAt } : null
    };
  });
}

export async function messageItemById(db: Db, id: string): Promise<{ item: MessageItem; conversation: Conversation } | null> {
  const [m] = await db.select().from(messages).where(eq(messages.id, id));
  if (!m) return null;
  const [c] = await db.select().from(conversations).where(eq(conversations.id, m.conversationId));
  return { item: (await toItems(db, [m]))[0]!, conversation: c! };
}

/** Mark read now; the push tells my other tabs (unread badge) and, in a private chat, the other member ("seen"). */
async function markRead(db: Db, conversationId: string, userId: string): Promise<void> {
  const [row] = await db.insert(conversationMembers).values({ conversationId, userId, lastReadAt: sql`now()` })
    .onConflictDoUpdate({ target: [conversationMembers.conversationId, conversationMembers.userId], set: { lastReadAt: sql`now()` } }).returning();
  await db.execute(sql`select pg_notify('conversation_read', ${JSON.stringify({ conversationId, userId, readAt: row!.lastReadAt!.toISOString() })})`);
}

/** Direct, group and club conversations I belong to, with my read marker. */
async function myConversations(db: Db, userId: string) {
  const direct = await db.select({ c: conversations, lastReadAt: conversationMembers.lastReadAt }).from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(and(eq(conversationMembers.userId, userId), eq(conversations.kind, 'direct')));
  const myScopes = await db.select().from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.status, 'active')));
  const scoped = myScopes.length ? await db.select().from(conversations).where(or(...myScopes.map((m) => and(eq(conversations.kind, m.scopeType), eq(conversations.scopeId, m.scopeId))))) : [];
  return { all: [...direct.map((d) => d.c), ...scoped], myScopes };
}

/** Unread messages per conversation: from others, not deleted, not from users I muted, after my read marker. */
async function unreadCounts(db: Db, userId: string, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: messages.conversationId, n: sql<number>`count(*)::int` }).from(messages)
    .leftJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, userId)))
    .where(and(inArray(messages.conversationId, ids), isNull(messages.deletedAt), ne(messages.senderId, userId),
      sql`${messages.createdAt} > coalesce(${conversationMembers.lastReadAt}, '-infinity'::timestamptz)`,
      notInArray(messages.senderId, db.select({ id: userMutes.mutedId }).from(userMutes).where(eq(userMutes.muterId, userId)))))
    .groupBy(messages.conversationId);
  return new Map(rows.map((r) => [r.id, r.n]));
}

interface SendInput { body?: string | undefined; quick?: string | undefined; replyToId?: string | undefined; clientId?: string | undefined }

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
    const items = (await toItems(db, rows.slice(0, limit), auth.userId)).reverse();
    // My read point BEFORE this page marks everything read: where the «پیام تازه» divider goes.
    const [mine] = await db.select({ mutedAt: conversationMembers.mutedAt, readAt: conversationMembers.lastReadAt }).from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, c.id), eq(conversationMembers.userId, auth.userId)));
    if (!before) await markRead(db, c.id, auth.userId);
    const [other] = c.kind === 'direct'
      ? await db.select({ at: conversationMembers.lastReadAt }).from(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, c.id), ne(conversationMembers.userId, auth.userId)))
      : [];
    return {
      items, muted: !!mine?.mutedAt, nextBefore: more ? items[0]!.createdAt : null, kind: c.kind as ConversationItem['kind'], slowModeSeconds: c.slowModeSeconds,
      readUpTo: other?.at?.toISOString() ?? null, myReadUpTo: mine?.readAt?.toISOString() ?? null
    };
  };

  const post = async (auth: AuthContext, c: Conversation, members: string[], input: SendInput): Promise<MessageItem> => {
    if (input.clientId) {
      // A retried send whose response was lost: return the message that already went through.
      const [prior] = await db.select().from(messages).where(and(eq(messages.senderId, auth.userId), eq(messages.clientId, input.clientId)));
      if (prior) {
        if (prior.conversationId !== c.id) throw new AppError('VALIDATION_FAILED');
        return (await toItems(db, [prior], auth.userId))[0]!;
      }
    }
    const preset = input.quick ? QUICK_CHAT.find((q) => q.id === input.quick)!.text : null;
    // Presets are fixed, harmless text: still allowed while typed chat is restricted.
    if (!preset && await isChatRestricted(db, auth.userId)) throw new AppError('CHAT_RESTRICTED');
    if (c.kind === 'direct') {
      const other = members.find((m) => m !== auth.userId)!;
      await assertCanDirectMessage(db, auth.userId, other);
    }
    if (c.kind === 'table') {
      const [t] = await db.select({ status: gameTables.status }).from(gameTables).where(eq(gameTables.id, c.scopeId!));
      if (t?.status === 'cancelled') throw new AppError('TABLE_NOT_OPEN');
    }
    // ponytail: count-then-insert, so two parallel sends can slip one past the limit; fine for a flood guard.
    const [burst] = await db.select({ n: sql<number>`count(*)::int` }).from(messages)
      .where(and(eq(messages.senderId, auth.userId), gt(messages.createdAt, sql`now() - make_interval(secs => ${BURST.seconds})`)));
    if (burst!.n >= BURST.max) throw new AppError('CHAT_TOO_FAST', { retryAfterSeconds: BURST.seconds });
    if (c.slowModeSeconds > 0 && !(await canModerate(db, auth, c))) {
      const [recent] = await db.select({ at: messages.createdAt }).from(messages).where(and(eq(messages.conversationId, c.id), eq(messages.senderId, auth.userId),
        gt(messages.createdAt, sql`now() - make_interval(secs => ${c.slowModeSeconds})`))).limit(1);
      if (recent) throw new AppError('CHAT_SLOW_MODE', { retryAfterSeconds: c.slowModeSeconds });
    }
    if (input.replyToId) {
      const [target] = await db.select({ id: messages.id }).from(messages).where(and(eq(messages.id, input.replyToId), eq(messages.conversationId, c.id)));
      if (!target) throw new AppError('VALIDATION_FAILED');
    }
    const body = preset ?? maskProfanity(sanitizeMessage(input.body ?? ''));
    if (!body) throw new AppError('VALIDATION_FAILED');
    const m = await db.transaction(async (tx) => {
      const [m] = await tx.insert(messages).values({ conversationId: c.id, senderId: auth.userId, body, replyToId: input.replyToId ?? null, clientId: input.clientId ?? null })
        .onConflictDoNothing().returning();
      if (!m) return null; // the same clientId was committed by a parallel retry
      await tx.update(conversations).set({ lastMessageAt: sql`now()` }).where(eq(conversations.id, c.id));
      // In-app notifications only for private messages; group/club/table chat is visible in place.
      // Members who muted this conversation get neither kind of notification.
      const quiet = new Set((await tx.select({ id: conversationMembers.userId }).from(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, c.id), sql`${conversationMembers.mutedAt} is not null`))).map((x) => x.id));
      const loud = (ids: string[]) => ids.filter((u) => u !== auth.userId && !quiet.has(u));
      const mentioned = loud(mentionedIn(body, [...(await profiles(db, members)).values()], auth.userId));
      if (c.kind === 'direct') {
        const recipientIds = loud(members).filter((u) => !mentioned.includes(u));
        if (recipientIds.length) await tx.insert(outboxEvents).values({ topic: 'message.created', aggregateId: c.id,
          payload: { messageId: m.id, conversationId: c.id, senderId: auth.userId, recipientIds } });
      }
      if (mentioned.length) await tx.insert(outboxEvents).values({ topic: 'message.mentioned', aggregateId: c.id,
        payload: { messageId: m.id, conversationId: c.id, senderId: auth.userId, recipientIds: mentioned } });
      await tx.execute(sql`select pg_notify('message_created', ${m.id})`);
      return m;
    });
    const row = m ?? (await db.select().from(messages).where(and(eq(messages.senderId, auth.userId), eq(messages.clientId, input.clientId!))))[0]!;
    return (await toItems(db, [row], auth.userId))[0]!;
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
    const { all, myScopes } = await myConversations(db, userId);
    const ids = all.map((c) => c.id);
    const otherIds = new Map<string, string>();
    for (const c of all) if (c.kind === 'direct') otherIds.set(c.id, c.directKey!.split(':').find((u) => u !== userId)!);
    const lasts = new Map((ids.length ? await db.selectDistinctOn([messages.conversationId]).from(messages)
      .where(and(inArray(messages.conversationId, ids), isNull(messages.deletedAt))).orderBy(messages.conversationId, desc(messages.createdAt)) : []).map((m) => [m.conversationId, m]));
    const people = await profiles(db, [...otherIds.values(), ...[...lasts.values()].map((m) => m.senderId)]);
    const unread = await unreadCounts(db, userId, ids);
    const groupNames = new Map((await db.select().from(groups).where(inArray(groups.id, [...myScopes.filter((m) => m.scopeType === 'group').map((m) => m.scopeId), '00000000-0000-0000-0000-000000000000']))).map((g) => [g.id, g.name]));
    const clubNames = new Map((await db.select().from(clubs).where(inArray(clubs.id, [...myScopes.filter((m) => m.scopeType === 'club').map((m) => m.scopeId), '00000000-0000-0000-0000-000000000000']))).map((c) => [c.id, c.name]));
    const items: ConversationItem[] = all.map((c) => {
      const last = lasts.get(c.id);
      const other = otherIds.has(c.id) ? people.get(otherIds.get(c.id)!) ?? null : null;
      return {
        id: c.id, kind: c.kind as ConversationItem['kind'], scopeId: c.scopeId, other,
        title: c.kind === 'direct' ? other?.displayName ?? '—' : c.kind === 'group' ? `گروه ${groupNames.get(c.scopeId!) ?? ''}` : `باشگاه ${clubNames.get(c.scopeId!) ?? ''}`,
        lastMessage: last ? { body: last.body.slice(0, 120), senderName: people.get(last.senderId)?.displayName ?? '', createdAt: last.createdAt.toISOString() } : null,
        unreadCount: unread.get(c.id) ?? 0
      };
    });
    items.sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''));
    return { items };
  });

  r.get('/me/conversations/unread', {
    schema: { tags: ['chat'], summary: 'Total unread messages in my private, group and club conversations', response: { 200: z.object({ count: z.number().int() }), 401: apiErrorSchema } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const { all } = await myConversations(db, userId);
    let count = 0;
    for (const n of (await unreadCounts(db, userId, all.map((c) => c.id))).values()) count += n;
    return { count };
  });

  r.post('/conversations/:id/read', {
    schema: { tags: ['chat'], summary: 'Mark a conversation read up to now', params: idParams, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const auth = requireUser(req);
    const { c } = await loadAccessible(db, auth, req.params.id);
    await markRead(db, c.id, auth.userId);
    return reply.code(204).send(null);
  });

  r.put('/conversations/:id/slow-mode', {
    schema: { tags: ['chat'], summary: 'Group/club managers: minimum seconds between one member\'s messages (0 = off)', params: idParams, body: slowModeBody, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const auth = requireUser(req);
    const { c } = await loadAccessible(db, auth, req.params.id);
    if (c.kind !== 'group' && c.kind !== 'club') throw new AppError('VALIDATION_FAILED');
    if (!(await canModerate(db, auth, c))) throw new AppError('MANAGER_REQUIRED');
    await db.transaction(async (tx) => {
      await tx.update(conversations).set({ slowModeSeconds: req.body.seconds }).where(eq(conversations.id, c.id));
      await tx.insert(auditLog).values({ actorId: auth.userId, action: 'chat.slow_mode', targetType: 'conversation', targetId: c.id,
        metadata: { seconds: req.body.seconds, kind: c.kind, scopeId: c.scopeId }, requestId: req.id });
    });
    return reply.code(204).send(null);
  });

  const pageQuery = z.object({ before: z.iso.datetime().optional(), limit: z.coerce.number().int().min(1).max(100).default(30) });

  r.get('/conversations/:id/messages', {
    schema: { tags: ['chat'], summary: 'Messages, newest page first (cursor: before)', params: idParams, querystring: pageQuery, response: { 200: messagesPage, ...errors } }
  }, async (req) => {
    const auth = requireUser(req);
    const { c, members } = await loadAccessible(db, auth, req.params.id, true);
    return { ...(await page(auth, c, req.query.before, req.query.limit)), canPost: members.includes(auth.userId) && !(await isChatRestricted(db, auth.userId)), canModerate: await canModerate(db, auth, c) };
  });

  r.post('/conversations/:id/messages', {
    schema: { tags: ['chat'], summary: 'Send a message (typed text or a quick-chat preset)', params: idParams, body: messageBody, response: { 201: messageItem, ...errors } }
  }, async (req, reply) => {
    const auth = requireUser(req);
    const { c, members } = await loadAccessible(db, auth, req.params.id);
    return reply.code(201).send(await post(auth, c, members, req.body));
  });

  // Table chat: participants read and write; spectators who may view the table read only. Never contains game state.
  const tableChat = async (auth: AuthContext, tableId: string, write: boolean) => {
    const [p] = await db.select().from(participants).where(and(eq(participants.tableId, tableId), eq(participants.userId, auth.userId)));
    if (!p && (write || !(await canViewTable(db, tableId)))) throw new AppError(write ? 'NOT_PARTICIPANT' : 'FORBIDDEN');
    const [t] = await db.select({ isTutorial: gameTables.isTutorial }).from(gameTables).where(eq(gameTables.id, tableId));
    if (t?.isTutorial) throw new AppError('FORBIDDEN');
    const c = await scopeConversation(db, 'table', tableId);
    return { c, members: await conversationMembersOf(db, c) };
  };

  r.get('/tables/:id/chat', {
    schema: { tags: ['chat'], summary: 'Table chat (participants; spectators read-only)', params: idParams, querystring: pageQuery, response: { 200: messagesPage.extend({ conversationId: z.uuid() }), ...errors } }
  }, async (req) => {
    const auth = requireUser(req);
    const { c, members } = await tableChat(auth, req.params.id, false);
    return { conversationId: c.id, ...(await page(auth, c, req.query.before, req.query.limit)), canPost: members.includes(auth.userId) && !(await isChatRestricted(db, auth.userId)), canModerate: await canModerate(db, auth, c) };
  });

  r.post('/tables/:id/chat', {
    schema: { tags: ['chat'], summary: 'Post to table chat (typed text or a quick-chat preset)', params: idParams, body: messageBody, response: { 201: messageItem, ...errors } }
  }, async (req, reply) => {
    const auth = requireUser(req);
    const { c, members } = await tableChat(auth, req.params.id, true);
    return reply.code(201).send(await post(auth, c, members, req.body));
  });

  r.put('/conversations/:id/mute', {
    schema: { tags: ['chat'], summary: 'Mute or unmute notifications of a conversation for me', params: idParams, body: muteChatBody, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const auth = requireUser(req);
    const { c } = await loadAccessible(db, auth, req.params.id, true);
    const mutedAt = req.body.muted ? sql`now()` : null;
    await db.insert(conversationMembers).values({ conversationId: c.id, userId: auth.userId, mutedAt })
      .onConflictDoUpdate({ target: [conversationMembers.conversationId, conversationMembers.userId], set: { mutedAt } });
    return reply.code(204).send(null);
  });

  r.post('/messages/:id/reactions', {
    schema: { tags: ['chat'], summary: 'Toggle my reaction (fixed emoji set) on a message I can read', params: idParams, body: reactionBody, response: { 200: messageItem, ...errors } }
  }, async (req) => {
    const auth = requireUser(req);
    const [m] = await db.select().from(messages).where(eq(messages.id, req.params.id));
    if (!m || m.deletedAt) throw new AppError('NOT_FOUND');
    await loadAccessible(db, auth, m.conversationId, true);
    const key = { messageId: m.id, userId: auth.userId, emoji: req.body.emoji };
    await db.transaction(async (tx) => {
      const gone = await tx.delete(messageReactions).where(and(eq(messageReactions.messageId, m.id), eq(messageReactions.userId, auth.userId), eq(messageReactions.emoji, key.emoji))).returning();
      if (!gone.length) await tx.insert(messageReactions).values(key).onConflictDoNothing();
      await tx.execute(sql`select pg_notify('message_created', ${m.id})`);
    });
    return (await toItems(db, [m], auth.userId))[0]!;
  });

  r.patch('/messages/:id', {
    schema: { tags: ['chat'], summary: `Edit my own message within ${MESSAGE_EDIT_WINDOW_SECONDS} seconds of sending`, params: idParams, body: messageEditBody, response: { 200: messageItem, ...errors } }
  }, async (req) => {
    const auth = requireUser(req);
    const [m] = await db.select().from(messages).where(eq(messages.id, req.params.id));
    if (!m || m.deletedAt) throw new AppError('NOT_FOUND');
    if (m.senderId !== auth.userId) throw new AppError('FORBIDDEN');
    if (await isChatRestricted(db, auth.userId)) throw new AppError('CHAT_RESTRICTED');
    const body = maskProfanity(sanitizeMessage(req.body.body));
    if (!body) throw new AppError('VALIDATION_FAILED');
    const updated = await db.transaction(async (tx) => {
      // The window is checked against the database clock in the same statement that writes.
      const [u] = await tx.update(messages).set({ body, editedAt: sql`now()`, originalBody: sql`coalesce(${messages.originalBody}, ${messages.body})` })
        .where(and(eq(messages.id, m.id), isNull(messages.deletedAt), gt(messages.createdAt, sql`now() - make_interval(secs => ${MESSAGE_EDIT_WINDOW_SECONDS})`))).returning();
      if (u) await tx.execute(sql`select pg_notify('message_created', ${u.id})`);
      return u;
    });
    if (!updated) throw new AppError('EDIT_WINDOW_CLOSED');
    return (await toItems(db, [updated], auth.userId))[0]!;
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
