import { z } from 'zod';
import { competitionSchema, paceSchema } from '@bg/game-sdk';
import { profileExtras, publicProfile } from './api.ts';
import { leagueSchema } from './progression.ts';

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
/** Which public-profile sections the owner shows to other people (the owner always sees everything). */
export const profilePrivacy = z.strictObject({ showStats: z.boolean(), showRatings: z.boolean(), showRecent: z.boolean() });
export type ProfilePrivacy = z.infer<typeof profilePrivacy>;
export const DEFAULT_PROFILE_PRIVACY: ProfilePrivacy = { showStats: true, showRatings: true, showRecent: true };

/**
 * Public play record on the profile page. Every section is null when the owner hides it, or when either side blocked
 * the other; `level` stays visible otherwise. Only finished, non-tutorial games count; the recent list is public tables only.
 */
export const publicRecord = z.object({
  stats: z.object({ gamesPlayed: z.number().int(), wins: z.number().int(), winRate: z.number().int().min(0).max(100) }).nullable(),
  level: z.number().int().nullable(),
  bestLeague: leagueSchema.nullable(),
  /** Leaderboard-eligible ratings only (never provisional ones). */
  ratings: z.array(z.object({ gameId: z.string(), gameNameFa: z.string(), mode: z.string(), rating: z.number().int(), games: z.number().int(), league: leagueSchema.nullable() })).nullable(),
  recent: z.array(z.object({ gameId: z.string(), gameNameFa: z.string(), place: z.number().int(), fieldSize: z.number().int(), finishedAt: z.iso.datetime() })).nullable(),
  mastery: z.array(z.object({ gameId: z.string(), gameNameFa: z.string(), tier: z.string(), tierFa: z.string() })).nullable()
});
export type PublicRecord = z.infer<typeof publicRecord>;

/** The profile page: card plus the player's customization. */
export const profileCard = userCard.extend(profileExtras.shape).extend(publicRecord.shape).extend({
  /** Premium badge; public clubs the player belongs to; friends we share (empty when blocked or self). */
  premium: z.boolean(),
  clubs: z.array(z.object({ slug: z.string(), name: z.string() })),
  mutualFriends: z.array(publicProfile)
});
export type ProfileCard = z.infer<typeof profileCard>;

export const friendsResponse = z.object({
  friends: z.array(publicProfile),
  incoming: z.array(publicProfile),
  outgoing: z.array(publicProfile),
  blocked: z.array(publicProfile),
  muted: z.array(publicProfile)
});
export const userIdBody = z.strictObject({ userId: z.uuid() });

/** Online status (friends and table-mates only). `playing` = seated at a running live table. */
export const presence = z.object({ online: z.boolean(), lastSeenAt: z.iso.datetime().nullable(), playing: z.object({ tableId: z.uuid(), gameNameFa: z.string() }).nullable() });
export type Presence = z.infer<typeof presence>;

// ---------- Conversations ----------
/** One-tap table phrases and emoji. Sent by id; the server stores the fixed text, so they skip the word filter. */
export const QUICK_CHAT = [
  { id: 'hi', text: 'سلام! 👋' },
  { id: 'your_turn', text: 'نوبت توئه!' },
  { id: 'nice', text: 'آفرین، حرکت خوبی بود 👏' },
  { id: 'wait', text: 'ببخشید، یه لحظه صبر کن' },
  { id: 'thinking', text: 'دارم فکر می‌کنم… 🤔' },
  { id: 'oops', text: 'اوه! 😅' },
  { id: 'luck', text: 'موفق باشی 🍀' },
  { id: 'gg', text: 'بازی خوبی بود 🤝' },
  { id: 'rematch', text: 'یه دست دیگه؟ 🔁' },
  { id: 'thumbs', text: '👍' },
  { id: 'laugh', text: '😂' },
  { id: 'wow', text: '😮' },
  { id: 'fire', text: '🔥' },
  { id: 'party', text: '🎉' }
] as const;
export const quickChatId = z.enum(QUICK_CHAT.map((q) => q.id) as [(typeof QUICK_CHAT)[number]['id'], ...(typeof QUICK_CHAT)[number]['id'][]]);

/** Either typed text (body) or a preset (quick). clientId makes a retried send idempotent. */
export const messageBody = z.strictObject({
  body: z.string().min(1).max(1000).optional(),
  quick: quickChatId.optional(),
  /** An emote from the sender's loadout (stored as «:em.N:», drawn as the emote by clients). */
  emote: z.string().regex(/^em\.\d{1,3}$/).optional(),
  replyToId: z.uuid().optional(),
  clientId: z.uuid().optional()
}).refine((b) => [b.body, b.quick, b.emote].filter((x) => x !== undefined).length === 1, { message: 'body, quick or emote' });
/** Body of an emote message. */
export const EMOTE_BODY = /^:(em\.\d{1,3}):$/;
export const messageEditBody = z.strictObject({ body: z.string().min(1).max(1000) });
/** Own messages can be edited for this long after sending. */
export const MESSAGE_EDIT_WINDOW_SECONDS = 120;
export const REACTION_EMOJIS = ['👍', '😂', '😮', '😢', '🔥', '👏'] as const;
export const reactionBody = z.strictObject({ emoji: z.enum(REACTION_EMOJIS) });
export const muteChatBody = z.strictObject({ muted: z.boolean() });
export const reactionItem = z.object({ emoji: z.string(), count: z.number().int(), mine: z.boolean() });
export const messageItem = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  sender: publicProfile,
  body: z.string(),
  createdAt: z.iso.datetime(),
  deleted: z.boolean(),
  editedAt: z.iso.datetime().nullable(),
  clientId: z.uuid().nullable(),
  reactions: z.array(reactionItem),
  /** Members whose @displayName appears in the body. */
  mentions: z.array(z.uuid()),
  replyTo: z.object({ id: z.uuid(), senderName: z.string(), body: z.string(), deleted: z.boolean() }).nullable()
});
export type MessageItem = z.infer<typeof messageItem>;
export const messagesPage = z.object({
  items: z.array(messageItem), nextBefore: z.string().nullable(), canPost: z.boolean(), canModerate: z.boolean(),
  kind: z.enum(['direct', 'table', 'group', 'club']),
  slowModeSeconds: z.number().int(),
  /** Private chats: the other member has read everything up to this moment ("seen"). */
  readUpTo: z.iso.datetime().nullable(),
  /** Where I had read up to when this page was opened (null = never opened, or no membership row). */
  myReadUpTo: z.iso.datetime().nullable(),
  /** I muted this conversation (no notifications for it). */
  muted: z.boolean()
});
export const SLOW_MODE_OPTIONS = [0, 10, 30, 60, 300] as const;
export const slowModeBody = z.strictObject({ seconds: z.literal([...SLOW_MODE_OPTIONS]) });
export const conversationItem = z.object({
  id: z.uuid(),
  kind: z.enum(['direct', 'table', 'group', 'club']),
  title: z.string(),
  other: publicProfile.nullable(),
  scopeId: z.uuid().nullable(),
  lastMessage: z.object({ body: z.string(), senderName: z.string(), createdAt: z.iso.datetime() }).nullable(),
  unreadCount: z.number().int()
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
  id: z.uuid(), slug: z.string(), name: z.string(), description: z.string(), joinPolicy, memberCount: z.number().int(), owner: publicProfile,
  /** Directory only: the viewer's own membership status in this club. */
  myStatus: memberStatus.nullable().optional()
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

/** Turn alerts (sound / vibration / quiet hours in Tehran time). Hours 0-23; start === end means no quiet hours. */
export const alertSoundSchema = z.enum(['chime', 'bell', 'pulse', 'soft']);
export const alertPrefs = z.strictObject({
  sound: z.boolean(), volume: z.number().int().min(0).max(100), vibration: z.boolean(),
  quietHours: z.strictObject({ enabled: z.boolean(), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(0).max(23) }),
  warningSound: alertSoundSchema, criticalSound: alertSoundSchema,
  /** «نوبت شماست» tone, and a short tick each second in a live game's last 10 s. Defaults keep older saved prefs valid. */
  turnSound: z.boolean().default(true), criticalTick: z.boolean().default(true)
});
export type AlertPrefs = z.infer<typeof alertPrefs>;
export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  sound: true, volume: 70, vibration: true, quietHours: { enabled: false, startHour: 23, endHour: 7 }, warningSound: 'chime', criticalSound: 'pulse', turnSound: true, criticalTick: true
};

// ---------- Moderation ----------
export const reportBody = z.strictObject({
  targetType: z.enum(['user', 'display_name', 'bio', 'message', 'table']),
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

export const NOTIFICATION_KINDS = ['turn', 'reminder', 'finished', 'invite', 'match', 'message', 'mention', 'friend_request', 'club', 'tournament'] as const;
