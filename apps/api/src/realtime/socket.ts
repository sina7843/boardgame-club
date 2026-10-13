import type { Server as HttpServer } from 'node:http';
import type { FastifyBaseLogger } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { Server, type DefaultEventsMap, type Socket } from 'socket.io';
import { AppError, ClientEvents, commandEnvelope, ERRORS, ServerEvents, tableSubscribePayload, typingPayload, type ReadEvent, type TypingEvent } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { GameRegistry } from '@bg/game-engine';
import { buildTableSnapshot, executeCommand, loadTableContext, tableContextAt, toNotificationItem, type TableContext } from '@bg/play';
import { conversationMembersOf, messageItemById } from '../modules/social/chat.ts';
import { profiles } from '../modules/social/relations.ts';
import type { Config } from '../config.ts';
import { isAllowedOrigin } from '../http/origin-guard.ts';
import { timedCommand } from '../http/timed-command.ts';
import { metrics } from '../metrics.ts';
import { resolveSession, type AuthContext } from '../modules/auth/session.ts';

export interface SocketData { auth: AuthContext; invites: Map<string, string> }
type Ack = (response: unknown) => void;

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

const pino = { warn: () => {}, error: () => {}, info: () => {} } as unknown as FastifyBaseLogger;

const failure = (err: unknown) => {
  const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
  return { ok: false, errorCode: code, messageFa: ERRORS[code] };
};

/**
 * Socket.IO transport. Identity is pinned from the session cookie at handshake; handlers use socket.data.auth only.
 * Commands use the same executeCommand() as HTTP. Pushes are triggered by PostgreSQL NOTIFY, which is delivered only
 * after the writing transaction commits — so nothing is emitted before it is durable — and every push is a fresh
 * per-viewer projection, never raw state or internal events.
 */
export async function attachRealtime(httpServer: HttpServer, config: Config, db: Db, registry: GameRegistry, listenClient?: { listen: (channel: string, fn: (payload: string) => void) => Promise<unknown> }, log: FastifyBaseLogger = pino) {
  const io = new Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>(httpServer, {
    path: '/api/socket.io',
    serveClient: false,
    cors: { origin: config.webOrigins, credentials: true },
    // Long-polling needs every request of a session on the same process (sticky sessions); with several API
    // workers only WebSocket is offered, which the web client already tries first.
    ...(config.workers > 1 ? { transports: ['websocket' as const] } : {}),
    allowRequest: (req, cb) => cb(null, isAllowedOrigin(req.headers.origin, config.webOrigins))
  });

  metrics.socketConnections = () => io.engine.clientsCount;

  // Typing is not stored, so nothing in the database would NOTIFY: publish it ourselves so recipients connected to
  // another API worker get it too. Chunked to stay far below NOTIFY's 8000-byte payload limit in big clubs.
  const emitTyping = (to: string[], event: TypingEvent) => { for (const u of to) io.to(`user:${u}`).emit(ServerEvents.conversationTyping, event); };
  const relayTyping = async (event: TypingEvent, to: string[]) => {
    if (!listenClient) return emitTyping(to, event);
    for (let i = 0; i < to.length; i += 100) {
      await db.execute(sql`select pg_notify('conversation_typing', ${JSON.stringify({ event, to: to.slice(i, i + 100) })})`);
    }
  };

  io.use(async (socket, next) => {
    try {
      const auth = await resolveSession(db, readCookie(socket.handshake.headers.cookie, config.session.cookieName));
      if (!auth) return next(new Error('UNAUTHENTICATED'));
      if (auth.suspended) return next(new Error('ACCOUNT_SUSPENDED'));
      socket.data.auth = auth;
      socket.data.invites = new Map();
      next();
    } catch {
      next(new Error('SERVICE_UNAVAILABLE'));
    }
  });

  const pushSnapshot = async (socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>, tableId: string, ctx?: TableContext) => {
    try {
      socket.emit(ServerEvents.tableSnapshot, await buildTableSnapshot(db, registry, { tableId, userId: socket.data.auth.userId, inviteCode: socket.data.invites.get(tableId) }, ctx));
    } catch {
      // Access lost (e.g. left a private table): stop pushing to this socket.
      await socket.leave(`table:${tableId}`);
    }
  };

  io.on('connection', (socket) => {
    const { userId } = socket.data.auth;
    void socket.join(`user:${userId}`);
    socket.emit(ServerEvents.sessionReady, { userId, serverTime: new Date().toISOString() });

    socket.on(ClientEvents.tableSubscribe, async (payload: unknown, ack?: Ack) => {
      const parsed = tableSubscribePayload.safeParse(payload);
      if (!parsed.success) return ack?.(failure(new AppError('VALIDATION_FAILED')));
      try {
        // Join before reading: a change committed while the snapshot is built is then still pushed (clients drop
        // older revisions), instead of being missed and leaving this client on a stale turn.
        const room = `table:${parsed.data.tableId}`;
        const wasMember = socket.rooms.has(room);
        if (parsed.data.inviteCode) socket.data.invites.set(parsed.data.tableId, parsed.data.inviteCode);
        await socket.join(room);
        try {
          ack?.({ ok: true, snapshot: await buildTableSnapshot(db, registry, { tableId: parsed.data.tableId, userId, inviteCode: parsed.data.inviteCode }) });
        } catch (err) {
          if (!wasMember) { socket.data.invites.delete(parsed.data.tableId); await socket.leave(room); } // not authorized: no pushes either
          throw err;
        }
      } catch (err) {
        ack?.(failure(err));
      }
    });

    socket.on('table.unsubscribe', async (payload: unknown) => {
      const parsed = tableSubscribePayload.safeParse(payload);
      if (parsed.success) await socket.leave(`table:${parsed.data.tableId}`);
    });

    // Typing indicator: relayed to the conversation's current members (same access rule and mutes as messages).
    // Never stored; at most one relay per conversation every 2 seconds per socket.
    const typingAt = new Map<string, number>();
    socket.on(ClientEvents.conversationTyping, async (payload: unknown) => {
      const parsed = typingPayload.safeParse(payload);
      if (!parsed.success) return;
      const { conversationId } = parsed.data;
      if (Date.now() - (typingAt.get(conversationId) ?? 0) < 2000) return;
      typingAt.set(conversationId, Date.now());
      try {
        const [c] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
        if (!c) return;
        const members = await conversationMembersOf(db, c);
        if (!members.includes(userId)) return;
        const muters = (await db.select({ id: schema.userMutes.muterId }).from(schema.userMutes).where(eq(schema.userMutes.mutedId, userId))).map((m) => m.id);
        const me = (await profiles(db, [userId])).get(userId);
        const event: TypingEvent = { conversationId, userId, displayName: me?.displayName ?? '' };
        await relayTyping(event, members.filter((m) => m !== userId && !muters.includes(m)));
      } catch { /* best effort */ }
    });

    socket.on(ClientEvents.tableCommand, async (payload: unknown, ack?: Ack) => {
      // strictObject: any client-supplied actor/user field is rejected outright.
      const parsed = commandEnvelope.safeParse(payload);
      if (!parsed.success) return ack?.(failure(new AppError('VALIDATION_FAILED')));
      try {
        const result = await timedCommand('socket', log, parsed.data.tableId, () => executeCommand(db, registry, { userId, ...parsed.data }));
        const ctx = await tableContextAt(db, parsed.data.tableId, result.revision);
        ack?.({ ok: true, ...result, snapshot: await buildTableSnapshot(db, registry, { tableId: parsed.data.tableId, userId }, ctx) });
      } catch (err) {
        ack?.(failure(err));
      }
    });
  });

  if (listenClient) {
    await listenClient.listen('table_changed', (payload) => {
      void (async () => {
        // `tableId:revision` after a move (reuse the mover's context load), plain `tableId` for lobby/lifecycle changes.
        const [tableId = '', rev] = payload.split(':');
        const sockets = [...io.sockets.adapter.rooms.get(`table:${tableId}`) ?? []].map((id) => io.sockets.sockets.get(id)).filter((s) => !!s);
        if (!sockets.length) return;
        // Viewer-independent data is read once per change; each subscriber still gets its own projection + access check.
        // If the shared read fails, fall back to per-socket reads rather than silently dropping the push.
        const ctx = await (rev ? tableContextAt(db, tableId, Number(rev)) : loadTableContext(db, tableId)).catch((err: unknown) => {
          log.warn({ tableId, err: err instanceof Error ? err.message : String(err) }, 'shared table load failed');
          return undefined;
        });
        await Promise.all(sockets.map((s) => pushSnapshot(s, tableId, ctx)));
      })();
    });
    // Chat: pushed to each authorized member's own room (members are computed now, so leaving a club/table or
    // being blocked takes effect immediately; nobody can subscribe to a conversation room directly).
    await listenClient.listen('message_created', (id) => {
      void (async () => {
        const found = await messageItemById(db, id);
        if (!found) return;
        const muters = (await db.select({ id: schema.userMutes.muterId }).from(schema.userMutes).where(eq(schema.userMutes.mutedId, found.item.sender.id))).map((m) => m.id);
        for (const userId of await conversationMembersOf(db, found.conversation)) {
          if (!muters.includes(userId)) io.to(`user:${userId}`).emit(ServerEvents.messageCreated, found.item);
        }
      })();
    });
    // Read markers: to the reader's own tabs (unread badge) and, in a private chat, to the other member ("seen").
    await listenClient.listen('conversation_read', (payload) => {
      void (async () => {
        const e = JSON.parse(payload) as ReadEvent;
        const [c] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, e.conversationId));
        if (!c) return;
        const to = c.kind === 'direct' ? await conversationMembersOf(db, c) : [e.userId];
        for (const u of to) io.to(`user:${u}`).emit(ServerEvents.conversationRead, e);
      })();
    });
    await listenClient.listen('notification_created', (id) => {
      void (async () => {
        const [n] = await db.select().from(schema.notifications).where(eq(schema.notifications.id, id));
        if (n) io.to(`user:${n.userId}`).emit(ServerEvents.notificationCreated, toNotificationItem(n));
      })();
    });
    await listenClient.listen('conversation_typing', (payload) => {
      const { event, to } = JSON.parse(payload) as { event: TypingEvent; to: string[] };
      emitTyping(to, event);
    });
  }
  return io;
}
