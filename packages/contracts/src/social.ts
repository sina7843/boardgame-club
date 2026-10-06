import { z } from 'zod';
import { competitionSchema, paceSchema } from '@bg/game-sdk';
import { publicProfile } from './api.ts';

// ---------- Matchmaking ----------
export const enqueueBody = z.strictObject({
  gameId: z.string().min(1).max(64),
  pace: paceSchema,
  competition: competitionSchema.default('friendly'),
  playerCount: z.number().int().min(1).max(16),
  turnSeconds: z.number().int().positive()
});
export type EnqueueBody = z.infer<typeof enqueueBody>;

export const ticketView = z.object({
  id: z.uuid(),
  gameId: z.string(),
  gameNameFa: z.string(),
  pace: paceSchema,
  competition: competitionSchema,
  playerCount: z.number().int(),
  turnSeconds: z.number().int(),
  status: z.enum(['queued', 'matched', 'started', 'cancelled', 'expired']),
  waitSeconds: z.number().int(),
  /** Current skill window (± rating points); grows with waiting time up to the configured cap. */
  window: z.number().int(),
  matchedTableId: z.uuid().nullable(),
  readyDeadline: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime()
});
export type TicketView = z.infer<typeof ticketView>;

// ---------- Relationships ----------
export const relationshipSchema = z.enum(['self', 'none', 'friends', 'incoming', 'outgoing', 'blocked']);
export const userCard = publicProfile.extend({ relationship: relationshipSchema, muted: z.boolean() });
export type UserCard = z.infer<typeof userCard>;

export const friendsResponse = z.object({
  friends: z.array(publicProfile),
  incoming: z.array(publicProfile),
  outgoing: z.array(publicProfile),
  blocked: z.array(publicProfile),
  muted: z.array(publicProfile)
});
export const userIdBody = z.strictObject({ userId: z.uuid() });

// ---------- Conversations ----------
export const messageBody = z.strictObject({ body: z.string().min(1).max(1000) });
export const messageItem = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  sender: publicProfile,
  body: z.string(),
  createdAt: z.iso.datetime(),
  deleted: z.boolean()
});
export type MessageItem = z.infer<typeof messageItem>;
export const messagesPage = z.object({ items: z.array(messageItem), nextBefore: z.string().nullable(), canPost: z.boolean(), canModerate: z.boolean() });
export const conversationItem = z.object({
  id: z.uuid(),
  kind: z.enum(['direct', 'table', 'group', 'club']),
  title: z.string(),
  other: publicProfile.nullable(),
  scopeId: z.uuid().nullable(),
  lastMessage: z.object({ body: z.string(), senderName: z.string(), createdAt: z.iso.datetime() }).nullable(),
  unread: z.boolean()
});
export type ConversationItem = z.infer<typeof conversationItem>;

// ---------- Groups & clubs ----------
export const memberRole = z.enum(['owner', 'manager', 'member']);
export const memberStatus = z.enum(['active', 'requested', 'invited']);
export const memberItem = z.object({ user: publicProfile, role: memberRole, status: memberStatus });

export const groupBody = z.strictObject({ name: z.string().trim().min(2).max(40) });
export const groupView = z.object({
  id: z.uuid(), name: z.string(), ownerId: z.uuid(), conversationId: z.uuid().nullable(),
  myRole: memberRole.nullable(), myStatus: memberStatus.nullable(), members: z.array(memberItem)
});

export const joinPolicy = z.enum(['open', 'request', 'invite']);
export const clubBody = z.strictObject({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,31}$/, 'نشانی باشگاه فقط حروف لاتین کوچک، عدد و خط تیره'),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(1000).default(''),
  joinPolicy
});
export const clubUpdateBody = z.strictObject({ name: z.string().trim().min(2).max(60).optional(), description: z.string().trim().max(1000).optional(), joinPolicy: joinPolicy.optional() });
export const clubSummary = z.object({
  id: z.uuid(), slug: z.string(), name: z.string(), description: z.string(), joinPolicy, memberCount: z.number().int(), owner: publicProfile
});
export const clubDetail = clubSummary.extend({
  myMembership: z.object({ role: memberRole, status: memberStatus }).nullable(),
  members: z.array(memberItem),
  /** Join requests and pending invites; only for owner/managers. */
  pending: z.array(memberItem),
  conversationId: z.uuid().nullable()
});
export type ClubDetail = z.infer<typeof clubDetail>;

export const tableInviteBody = z.union([z.strictObject({ userId: z.uuid() }), z.strictObject({ groupId: z.uuid() })]);

// ---------- Settings ----------
export const notifyPrefs = z.strictObject({ turn: z.boolean(), invite: z.boolean(), message: z.boolean(), result: z.boolean(), social: z.boolean() });
export const userSettingsSchema = z.strictObject({ dmPolicy: z.enum(['friends', 'nobody']), notify: notifyPrefs });
export type UserSettings = z.infer<typeof userSettingsSchema>;

// ---------- Moderation ----------
export const reportBody = z.strictObject({
  targetType: z.enum(['user', 'display_name', 'message', 'table']),
  targetId: z.string().min(1).max(64),
  reasonCode: z.enum(['abuse', 'spam', 'cheating', 'inappropriate_name', 'other']),
  reason: z.string().trim().min(3).max(1000),
  evidenceRef: z.string().trim().max(200).optional()
});
export const reportItem = z.object({
  id: z.uuid(), targetType: z.string(), targetId: z.string(), reasonCode: z.string(), reason: z.string(),
  evidenceRef: z.string().nullable(), status: z.enum(['open', 'resolved', 'dismissed']), decision: z.string().nullable(),
  resolution: z.string().nullable(), createdAt: z.iso.datetime()
});
export const sanctionItem = z.object({
  id: z.uuid(), kind: z.enum(['suspended', 'chat_restricted', 'warning']), reason: z.string(),
  startsAt: z.iso.datetime(), endsAt: z.iso.datetime().nullable(), active: z.boolean(),
  appeal: z.object({ status: z.enum(['open', 'upheld', 'revoked']), decisionNote: z.string().nullable() }).nullable()
});
export const resolveReportBody = z.strictObject({
  decision: z.enum(['dismiss', 'warning', 'chat_restricted', 'suspended']),
  durationHours: z.number().int().min(1).max(24 * 365).optional(),
  note: z.string().trim().min(3).max(1000)
});
export const appealBody = z.strictObject({ sanctionId: z.uuid(), text: z.string().trim().min(10).max(2000) });
export const decideAppealBody = z.strictObject({ decision: z.enum(['upheld', 'revoked']), note: z.string().trim().min(3).max(1000) });

export const NOTIFICATION_KINDS = ['turn', 'reminder', 'finished', 'invite', 'match', 'message', 'friend_request', 'club'] as const;
