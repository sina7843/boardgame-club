import { z } from 'zod';

/**
 * Command envelope (Requirements §8/§10). The actor is NEVER part of the envelope:
 * the server derives it from the authenticated session. strictObject rejects any
 * client-supplied actorId/userId field.
 */
export const commandEnvelope = z.strictObject({
  commandId: z.uuid(),
  tableId: z.uuid(),
  expectedRevision: z.number().int().min(0),
  action: z.record(z.string(), z.unknown()).and(z.object({ type: z.string().min(1).max(64) })),
  /** Round-trip lag the client measured (ms); clock tables credit it within a small quota. */
  lagMs: z.number().int().min(0).max(5000).optional()
});
export type CommandEnvelope = z.infer<typeof commandEnvelope>;

export const commandResponse = z.object({
  status: z.enum(['accepted', 'rejected']),
  revision: z.number().int(),
  errorCode: z.string().optional(),
  projectedView: z.unknown().optional()
});

/** Socket.IO event names. Payloads are projections only — never full state or internal events. */
export const ServerEvents = {
  sessionReady: 'session.ready',
  tableSnapshot: 'table.snapshot',
  tableUpdated: 'table.updated',
  tableFinished: 'table.finished',
  presenceChanged: 'presence.changed',
  messageCreated: 'message.created',
  conversationRead: 'conversation.read',
  conversationTyping: 'conversation.typing',
  notificationCreated: 'notification.created',
  turnStarted: 'turn.started',
  turnAutoMoved: 'turn.autoMoved'
} as const;

export const ClientEvents = {
  tableCommand: 'table.command',
  tableSubscribe: 'table.subscribe',
  conversationTyping: 'conversation.typing'
} as const;

/**
 * Clock events, emitted to the table room (public data only). `turn.warning` (50% of the turn left) and
 * `turn.critical` (last 10 s live / last hour turn-based) are NOT server events: clients derive them from
 * `dueAt` (no per-table timers on the server). See `turnThresholds`.
 */
export interface TurnStartedEvent { tableId: string; revision: number; seats: number[]; dueAt: string; turnSeconds: number; pace: 'live' | 'turn'; serverTime: string }
/** The server timed out these seats and played for them at `revision`. */
export interface TurnAutoMovedEvent { tableId: string; revision: number; seats: number[] }
/** Seconds before dueAt at which the client raises warning / critical. */
export const turnThresholds = (pace: 'live' | 'turn', turnSeconds: number) =>
  ({ warningLeft: Math.floor(turnSeconds / 2), criticalLeft: pace === 'live' ? 10 : 3600 });

export const typingPayload = z.strictObject({ conversationId: z.uuid() });
/** Pushed to members: someone is typing (clients show it for a few seconds). */
export interface TypingEvent { conversationId: string; userId: string; displayName: string }
/** Pushed to members: a member read the conversation up to readAt. */
export interface ReadEvent { conversationId: string; userId: string; readAt: string }

export const sessionReadyPayload = z.object({ userId: z.uuid(), serverTime: z.iso.datetime() });

export const tableSubscribePayload = z.strictObject({
  tableId: z.uuid(),
  lastRevision: z.number().int().min(0).optional(),
  /** Lets an invited non-member watch the private lobby until they join. */
  inviteCode: z.string().max(64).optional()
});
