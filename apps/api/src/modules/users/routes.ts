import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  apiErrorSchema, avatarItemKeys, COSMETICS, equipBody, equippedCosmetics, maskMobile, meResponse, parseAvatar, publicProfile, updateProfileBody,
  type ProfileExtras, type PublicProfile
} from '@bg/contracts';
import { schema } from '@bg/db';
import { assertUnlocked, buyCosmetic, coinBalance, cosmeticsFor, equipCosmetic, equippedFor } from '@bg/play';
import type { Deps } from '../../app.ts';
import { AppError } from '../../http/errors.ts';
import { requireUser } from '../auth/session.ts';
import { termsVersion } from '../site/routes.ts';

const { users, userPrivate, games, userAchievements, achievementDefinitions, sessions, userRoles, friendships, userSettings, participants, gameTables, auditLog, matchmakingTickets, tournamentEntries, tournaments } = schema;

/** Public projection: an explicit allow-list so private columns can never leak by addition. */
export function toPublicProfile(u: typeof users.$inferSelect): PublicProfile {
  return {
    id: u.id,
    displayName: u.displayName,
    avatarKey: u.avatarKey,
    joinedAt: u.createdAt.toISOString()
  };
}
export function toProfileExtras(u: typeof users.$inferSelect): ProfileExtras {
  return { bio: u.bio, titleKey: u.titleKey, bannerKey: u.bannerKey, favoriteGames: u.favoriteGames, showcase: u.showcase };
}

/** Achievement keys the catalogue unlocks with, so the builder can name them («دستاورد هت‌تریک»). */
const UNLOCK_ACHIEVEMENTS = [...new Set(COSMETICS.flatMap((c) => ('achievement' in c.unlock ? [c.unlock.achievement] : [])))];

export function userRoutes(app: FastifyInstance, { db, config }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  const loadMe = async (userId: string, roles: z.infer<typeof meResponse>['roles'], suspended = false) => {
    const [row] = await db.select({ user: users, mobile: userPrivate.mobile }).from(users)
      .innerJoin(userPrivate, eq(userPrivate.userId, users.id)).where(eq(users.id, userId));
    if (!row) throw new AppError('UNAUTHENTICATED');
    return { ...toPublicProfile(row.user), ...toProfileExtras(row.user), mobileMasked: maskMobile(row.mobile), roles, profileCompleted: row.user.profileCompleted, suspended,
      termsAccepted: row.user.termsVersion === await termsVersion(db) };
  };

  r.get('/me', {
    schema: { tags: ['users'], summary: 'Signed-in account (private view)', response: { 200: meResponse, 401: apiErrorSchema } }
  }, async (req) => {
    const auth = requireUser(req, { allowSuspended: true });
    return loadMe(auth.userId, auth.roles, auth.suspended);
  });

  r.patch('/me/profile', {
    schema: { tags: ['users'], summary: 'Update name, avatar and profile customization; every cosmetic must be unlocked', body: updateProfileBody,
      response: { 200: meResponse, 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema } }
  }, async (req) => {
    const auth = requireUser(req);
    const b = req.body;
    const avatar = b.avatarKey ? parseAvatar(b.avatarKey) : null;
    await assertUnlocked(db, auth.userId, [...(avatar ? avatarItemKeys(avatar) : []), ...(b.titleKey ? [b.titleKey] : []), ...(b.bannerKey ? [b.bannerKey] : [])]);
    if (b.favoriteGames?.length) {
      const found = await db.select({ id: games.id }).from(games).where(and(inArray(games.id, b.favoriteGames), eq(games.status, 'active')));
      if (found.length !== b.favoriteGames.length) throw new AppError('VALIDATION_FAILED');
    }
    if (b.showcase?.length) {
      const mine = await db.select({ k: achievementDefinitions.key }).from(userAchievements)
        .innerJoin(achievementDefinitions, eq(achievementDefinitions.id, userAchievements.achievementId)).where(eq(userAchievements.userId, auth.userId));
      const keys = new Set(mine.map((m) => m.k));
      if (!b.showcase.every((k) => keys.has(k))) throw new AppError('VALIDATION_FAILED');
    }
    await db.update(users).set({ ...b, bio: b.bio === '' ? null : b.bio, ...(b.displayName ? { profileCompleted: true } : {}), updatedAt: sql`now()` })
      .where(eq(users.id, auth.userId));
    return loadMe(auth.userId, auth.roles);
  });

  r.post('/me/terms', {
    schema: { tags: ['users'], summary: 'Accept the current terms and privacy version (version and time are stored)', response: { 200: meResponse, 401: apiErrorSchema } }
  }, async (req) => {
    const auth = requireUser(req, { allowSuspended: true });
    await db.update(users).set({ termsVersion: await termsVersion(db), termsAcceptedAt: sql`now()` }).where(eq(users.id, auth.userId));
    return loadMe(auth.userId, auth.roles, auth.suspended);
  });

  r.delete('/me', {
    schema: { tags: ['users'], summary: 'Delete own account: profile anonymised, mobile released, sessions ended; game history kept without identity',
      body: z.strictObject({ confirm: z.literal('حذف') }), response: { 204: z.null(), 401: apiErrorSchema, 409: apiErrorSchema } }
  }, async (req, reply) => {
    const { userId } = requireUser(req, { allowSuspended: true });
    // Staff accounts would lock moderation/admin out; a running game would strand the other players.
    if ((await db.select({ r: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId)).limit(1)).length) throw new AppError('ACCOUNT_DELETE_ADMIN');
    const busy = await db.select({ id: gameTables.id }).from(participants).innerJoin(gameTables, eq(gameTables.id, participants.tableId))
      .where(and(eq(participants.userId, userId), isNull(participants.leftAt), inArray(gameTables.status, ['open', 'active', 'paused']))).limit(1);
    const entered = await db.select({ id: tournaments.id }).from(tournamentEntries).innerJoin(tournaments, eq(tournaments.id, tournamentEntries.tournamentId))
      .where(and(eq(tournamentEntries.userId, userId), eq(tournamentEntries.status, 'registered'), inArray(tournaments.status, ['open', 'running']))).limit(1);
    if (busy.length || entered.length) throw new AppError('ACCOUNT_HAS_ACTIVE_GAMES');
    await db.transaction(async (tx) => {
      await tx.update(users).set({ status: 'deleted', displayName: 'کاربر حذف‌شده', avatarKey: 'meeple', bio: null, titleKey: null, bannerKey: null,
        favoriteGames: [], showcase: [], updatedAt: sql`now()` }).where(eq(users.id, userId));
      await tx.delete(userPrivate).where(eq(userPrivate.userId, userId));
      await tx.delete(friendships).where(or(eq(friendships.userLow, userId), eq(friendships.userHigh, userId)));
      await tx.delete(userSettings).where(eq(userSettings.userId, userId));
      await tx.update(matchmakingTickets).set({ status: 'cancelled', updatedAt: sql`now()` }).where(and(eq(matchmakingTickets.userId, userId), eq(matchmakingTickets.status, 'queued')));
      await tx.update(sessions).set({ revokedAt: sql`now()` }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
      await tx.insert(auditLog).values({ actorId: userId, action: 'account.delete', targetType: 'user', targetId: userId, metadata: {}, requestId: req.id });
    });
    reply.clearCookie(config.session.cookieName, { path: '/' });
    return reply.code(204).send(null);
  });

  r.get('/me/cosmetics', {
    schema: { tags: ['users'], summary: 'Cosmetic items this player has unlocked, coin balance and level',
      response: { 200: z.object({ unlocked: z.array(z.string()), balance: z.number().int(), level: z.number().int(),
        achievements: z.record(z.string(), z.string()), equipped: equippedCosmetics }), 401: apiErrorSchema } }
  }, async (req) => {
    const { userId } = requireUser(req, { allowSuspended: true });
    const defs = await db.select({ key: achievementDefinitions.key, titleFa: achievementDefinitions.titleFa }).from(achievementDefinitions)
      .where(inArray(achievementDefinitions.key, UNLOCK_ACHIEVEMENTS));
    return { ...(await cosmeticsFor(db, userId)), balance: await coinBalance(db, userId), achievements: Object.fromEntries(defs.map((d) => [d.key, d.titleFa])), equipped: await equippedFor(db, userId) };
  });

  r.patch('/me/cosmetics/equip', {
    schema: { tags: ['users'], summary: 'Equip (or clear with key null) one table cosmetic per kind; the item must be unlocked',
      body: equipBody, response: { 200: z.object({ equipped: equippedCosmetics }), 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema } }
  }, async (req) => ({ equipped: await equipCosmetic(db, requireUser(req).userId, req.body.kind, req.body.key) }));

  r.post('/cosmetics/buy', {
    schema: { tags: ['users'], summary: 'Buy a cosmetic with coins; the same requestId never spends twice',
      body: z.strictObject({ item: z.string().max(8), requestId: z.uuid() }),
      response: { 200: z.object({ balance: z.number().int() }), 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema } }
  }, async (req) => buyCosmetic(db, requireUser(req).userId, req.body.item, req.body.requestId));

  r.get('/users/:id', {
    schema: { tags: ['users'], summary: 'Public profile (never includes mobile)', params: z.object({ id: z.uuid() }),
      response: { 200: publicProfile, 404: apiErrorSchema } }
  }, async (req) => {
    const [u] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!u || u.status !== 'active') throw new AppError('NOT_FOUND');
    return toPublicProfile(u);
  });
}
