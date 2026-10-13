// Site onboarding (guided tours and walkthroughs, contracts/onboarding.ts). The server records finished steps per user;
// walkthrough steps with `verify` are checked against real data here, never taken on the client's word. When every guide
// is complete, progression grants the «Getting Started» achievement exactly once (user_achievements PK + ledger source key).
import { and, eq, ne, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError, apiErrorSchema, GETTING_STARTED_KEY, ONBOARDING_TOURS, onboardingState, tourComplete, type OnboardingCheck, type OnboardingState } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { rewardOnboarding } from '@bg/play';
import type { Deps } from '../../app.ts';
import { requireUser } from '../auth/session.ts';

const { onboardingProgress, participants, gameTables, users, friendships, achievementDefinitions, userAchievements } = schema;
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema };
const tourParams = z.object({ tour: z.string().max(40) });

/** Real-action checks for walkthrough steps. Each looks only at server-owned rows. */
const CHECKS: Record<OnboardingCheck, (db: Db, userId: string) => Promise<boolean>> = {
  // Tutorial tables are excluded: they are not a table the player set up or joined.
  hosted_table: async (db, userId) => (await db.select({ id: gameTables.id }).from(gameTables)
    .where(and(eq(gameTables.hostId, userId), eq(gameTables.isTutorial, false))).limit(1)).length > 0,
  joined_other_table: async (db, userId) => (await db.select({ t: participants.tableId }).from(participants)
    .innerJoin(gameTables, eq(gameTables.id, participants.tableId))
    .where(and(eq(participants.userId, userId), ne(gameTables.hostId, userId), eq(gameTables.isTutorial, false))).limit(1)).length > 0,
  profile_customized: async (db, userId) => (await db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), or(
    sql`${users.avatarKey} <> 'meeple'`, sql`coalesce(${users.bio}, '') <> ''`, sql`${users.titleKey} is not null`, sql`${users.bannerKey} is not null`,
    sql`cardinality(${users.favoriteGames}) > 0`, sql`cardinality(${users.showcase}) > 0`)))).length > 0,
  friend_request: async (db, userId) => (await db.select({ s: friendships.status }).from(friendships).where(and(
    or(eq(friendships.userLow, userId), eq(friendships.userHigh, userId)),
    or(eq(friendships.requestedBy, userId), eq(friendships.status, 'accepted')))).limit(1)).length > 0
};

async function stateOf(db: Db, userId: string): Promise<OnboardingState> {
  const rows = await db.select().from(onboardingProgress).where(eq(onboardingProgress.userId, userId));
  const [granted] = await db.select({ at: userAchievements.grantedAt }).from(userAchievements)
    .innerJoin(achievementDefinitions, eq(achievementDefinitions.id, userAchievements.achievementId))
    .where(and(eq(userAchievements.userId, userId), eq(achievementDefinitions.key, GETTING_STARTED_KEY)));
  return {
    tours: ONBOARDING_TOURS.map((t) => {
      const row = rows.find((r) => r.tourKey === t.key);
      const done = t.steps.map((s) => s.key).filter((k) => row?.steps.includes(k));
      return { key: t.key, completedSteps: done, completed: tourComplete(t, done), dismissed: row?.dismissed ?? false };
    }),
    achievement: { key: GETTING_STARTED_KEY, grantedAt: granted?.at.toISOString() ?? null }
  };
}

export function onboardingRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/me/onboarding', {
    schema: { tags: ['onboarding'], summary: 'Site guides: finished steps, dismissed guides and the «Getting Started» achievement', response: { 200: onboardingState, 401: apiErrorSchema } }
  }, async (req) => stateOf(db, requireUser(req).userId));

  r.post('/me/onboarding/:tour/steps/:step', {
    schema: { tags: ['onboarding'], summary: 'Record a finished guide step (real-action steps are verified by the server)',
      params: tourParams.extend({ step: z.string().max(40) }), response: { 200: onboardingState, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    const tour = ONBOARDING_TOURS.find((t) => t.key === req.params.tour);
    const step = tour?.steps.find((s) => s.key === req.params.step);
    if (!tour || !step) throw new AppError('NOT_FOUND');
    if (step.verify && !(await CHECKS[step.verify](db, userId))) throw new AppError('ONBOARDING_STEP_NOT_DONE');
    await db.transaction(async (tx) => {
      const [row] = await tx.insert(onboardingProgress).values({ userId, tourKey: tour.key, steps: [step.key] })
        .onConflictDoUpdate({ target: [onboardingProgress.userId, onboardingProgress.tourKey], set: {
          steps: sql`case when ${step.key}::text = any(${onboardingProgress.steps}) then ${onboardingProgress.steps} else array_append(${onboardingProgress.steps}, ${step.key}::text) end`,
          updatedAt: sql`now()` } }).returning({ steps: onboardingProgress.steps });
      if (row && tourComplete(tour, row.steps)) await rewardOnboarding(tx, userId);
    });
    return stateOf(db, userId);
  });

  r.patch('/me/onboarding/:tour', {
    schema: { tags: ['onboarding'], summary: 'Skip (dismiss) a guide or bring it back; finished steps are kept',
      params: tourParams, body: z.strictObject({ dismissed: z.boolean() }), response: { 200: onboardingState, ...errors } }
  }, async (req) => {
    const { userId } = requireUser(req);
    if (!ONBOARDING_TOURS.some((t) => t.key === req.params.tour)) throw new AppError('NOT_FOUND');
    await db.insert(onboardingProgress).values({ userId, tourKey: req.params.tour, dismissed: req.body.dismissed })
      .onConflictDoUpdate({ target: [onboardingProgress.userId, onboardingProgress.tourKey], set: { dismissed: req.body.dismissed, updatedAt: sql`now()` } });
    return stateOf(db, userId);
  });
}
