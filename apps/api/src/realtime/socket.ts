import type { Server as HttpServer } from 'node:http';
import type { FastifyBaseLogger } from 'fastify';
import { eq } from 'drizzle-orm';
import { Server, type DefaultEventsMap, type Socket } from 'socket.io';
import { AppError, ClientEvents, commandEnvelope, ERRORS, ServerEvents, tableSubscribePayload } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { GameRegistry } from '@bg/game-engine';
import { buildTableSnapshot, executeCommand, loadTableContext, toNotificationItem, type TableContext } from '@bg/play';
import { conversationMembersOf, messageItemById } from '../modules/social/chat.ts';
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
    allowRequest: (req, cb) => cb(null, isAllowedOrigin(req.headers.origin, config.webOrigins))
  });

  metrics.socketConnections = () => io.engine.clientsCount;

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

    socket.on(ClientEvents.tableCommand, async (payload: unknown, ack?: Ack) => {
      // strictObject: any client-supplied actor/user field is rejected outright.
      const parsed = commandEnvelope.safeParse(payload);
      if (!parsed.success) return ack?.(failure(new AppError('VALIDATION_FAILED')));
      try {
        const result = await timedCommand('socket', log, parsed.data.tableId, () => executeCommand(db, registry, { userId, ...parsed.data }));
        ack?.({ ok: true, ...result, snapshot: await buildTableSnapshot(db, registry, { tableId: parsed.data.tableId, userId }) });
      } catch (err) {
        ack?.(failure(err));
      }
    });
  });

  if (listenClient) {
    await listenClient.listen('table_changed', (tableId) => {
      void (async () => {
        const sockets = [...io.sockets.adapter.rooms.get(`table:${tableId}`) ?? []].map((id) => io.sockets.sockets.get(id)).filter((s) => !!s);
        if (!sockets.length) return;
        // Viewer-independent data is read once per change; each subscriber still gets its own projection + access check.
        // If the shared read fails, fall back to per-socket reads rather than silently dropping the push.
        const ctx = await loadTableContext(db, tableId).catch((err: unknown) => {
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
    await listenClient.listen('notification_created', (id) => {
      void (async () => {
        const [n] = await db.select().from(schema.notifications).where(eq(schema.notifications.id, id));
        if (n) io.to(`user:${n.userId}`).emit(ServerEvents.notificationCreated, toNotificationItem(n));
      })();
    });
  }
  return io;
}
