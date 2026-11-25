import { z } from 'zod';
import { publicProfile } from './api.ts';
import { MISSION_TYPES } from './progression.ts';

/** Time-limited event («رویداد»): server-computed points, goals and a one-time cosmetic reward. */
export const eventGoal = z.object({ type: z.enum(MISSION_TYPES), count: z.number().int().min(1).max(100) });
export type EventGoal = z.infer<typeof eventGoal>;
export const eventStatus = z.enum(['upcoming', 'live', 'ended']);
export type EventStatus = z.infer<typeof eventStatus>;

export const eventSummary = z.object({
  slug: z.string(), titleFa: z.string(), descriptionFa: z.string(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), status: eventStatus,
  games: z.array(z.object({ id: z.string(), nameFa: z.string() })).nullable(),
  reward: z.object({ key: z.string(), nameFa: z.string(), slotFa: z.string() }).nullable()
});
export type EventSummary = z.infer<typeof eventSummary>;
export const eventsResponse = z.object({ items: z.array(eventSummary) });

export const eventDetail = eventSummary.extend({
  goals: z.array(z.object({ type: z.enum(MISSION_TYPES), target: z.number().int(), progress: z.number().int() })),
  /** Top 100: points desc, ties by who reached the total first. */
  leaderboard: z.array(z.object({ rank: z.number().int(), user: publicProfile, points: z.number().int() })),
  /** Signed-in viewer: my rank (null without points), points and whether the reward is already mine. */
  me: z.object({ rank: z.number().int().nullable(), points: z.number().int(), rewardGranted: z.boolean() }).nullable(),
  rules: z.object({ perGame: z.number().int(), firstPlace: z.number().int() })
});
export type EventDetail = z.infer<typeof eventDetail>;

const slug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(60);
export const adminEventBody = z.strictObject({
  slug, titleFa: z.string().trim().min(3).max(120), descriptionFa: z.string().trim().max(1000).default(''),
  startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
  gameIds: z.array(z.string().max(64)).min(1).max(100).nullable().default(null),
  goals: z.array(eventGoal).max(5).default([]),
  rewardCosmetic: z.string().max(40).nullable().default(null),
  active: z.boolean().default(false)
});
export type AdminEventBody = z.infer<typeof adminEventBody>;
export const adminEventItem = z.object({
  id: z.uuid(), slug: z.string(), titleFa: z.string(), descriptionFa: z.string(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
  gameIds: z.array(z.string()).nullable(), goals: z.array(eventGoal), rewardCosmetic: z.string().nullable(), active: z.boolean(), status: eventStatus
});
