import { and, desc, eq, exists, gt, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  apiErrorSchema, avatarItemKeys, COSMETICS, equipBody, equippedCosmetics, loadout, maskMobile, meResponse, parseAvatar, publicProfile, updateProfileBody,
  type ProfileExtras, type PublicProfile
} from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { activeSuspension, assertUnlocked, buyBundle, buyCosmetic, giftCosmetic, loadoutFor, setLoadout, coinBalance, cosmeticsFor, equipCosmetic, equippedFor } from '@bg/play';
import type { Deps } from '../../app.ts';
import { AppError } from '../../http/errors.ts';
import { requireRole, requireUser } from '../auth/session.ts';
import { termsVersion } from '../site/routes.ts';

const { users, userPrivate, games, userAchievements, achievementDefinitions, sessions, userRoles, friendships, userSettings, participants, gameTables, auditLog, matchmakingTickets, tournamentEntries, tournaments, userSanctions } = schema;

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

/**
 * Close an account: profile anonymised, mobile released, sessions ended; game history kept without identity.
 * Used by self-delete and by an admin closing a player's account.
 */
export async function closeAccount(db: Db, userId: string, actorId: string, action: string, metadata: Record<string, unknown>, requestId: string): Promise<void> {
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
    await tx.insert(auditLog).values({ actorId, action, targetType: 'user', targetId: userId, metadata, requestId });
  });
}

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
    await closeAccount(db, userId, userId, 'account.delete', {}, req.id);
    reply.clearCookie(config.session.cookieName, { path: '/' });
    return reply.code(204).send(null);
  });

  r.get('/me/cosmetics', {
    schema: { tags: ['users'], summary: 'Cosmetic items this player has unlocked, coin balance and level',
      response: { 200: z.object({ unlocked: z.array(z.string()), balance: z.number().int(), level: z.number().int(),
        achievements: z.record(z.string(), z.string()), equipped: equippedCosmetics, loadout }), 401: apiErrorSchema } }
  }, async (req) => {
    const { userId } = requireUser(req, { allowSuspended: true });
    const defs = await db.select({ key: achievementDefinitions.key, titleFa: achievementDefinitions.titleFa }).from(achievementDefinitions)
      .where(inArray(achievementDefinitions.key, UNLOCK_ACHIEVEMENTS));
    return { ...(await cosmeticsFor(db, userId)), balance: await coinBalance(db, userId), achievements: Object.fromEntries(defs.map((d) => [d.key, d.titleFa])), equipped: await equippedFor(db, userId), loadout: await loadoutFor(db, userId) };
  });

  r.put('/me/cosmetics/loadout', {
    schema: { tags: ['users'], summary: 'Emote slots (up to 6 owned emotes) and preferred seat colour', body: loadout,
      response: { 200: loadout, 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema } }
  }, async (req) => setLoadout(db, requireUser(req).userId, req.body));

  r.patch('/me/cosmetics/equip', {
    schema: { tags: ['users'], summary: 'Equip (or clear with key null) one table cosmetic per kind; the item must be unlocked',
      body: equipBody, response: { 200: z.object({ equipped: equippedCosmetics }), 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema } }
  }, async (req) => ({ equipped: await equipCosmetic(db, requireUser(req).userId, req.body.kind, req.body.key) }));

  r.post('/cosmetics/buy', {
    schema: { tags: ['users'], summary: 'Buy a cosmetic with coins; the same requestId never spends twice',
      body: z.strictObject({ item: z.string().max(8), requestId: z.uuid() }),
      response: { 200: z.object({ balance: z.number().int() }), 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema } }
  }, async (req) => buyCosmetic(db, requireUser(req).userId, req.body.item, req.body.requestId));

  r.post('/cosmetics/bundles/buy', {
    schema: { tags: ['users'], summary: 'Buy a seasonal bundle with coins (owned items are not charged); the same requestId never spends twice',
      body: z.strictObject({ bundle: z.string().max(16), requestId: z.uuid() }),
      response: { 200: z.object({ balance: z.number().int() }), 401: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema } }
  }, async (req) => buyBundle(db, requireUser(req).userId, req.body.bundle, req.body.requestId));

  r.post('/cosmetics/gift', {
    schema: { tags: ['users'], summary: 'Gift a coin item to a friend; the sender pays and the friend is notified',
      body: z.strictObject({ item: z.string().max(8), userId: z.uuid(), requestId: z.uuid() }),
      response: { 200: z.object({ balance: z.number().int() }), 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema } }
  }, async (req) => {
    const { userId } = requireUser(req);
    if (req.body.userId === userId) throw new AppError('CANNOT_TARGET_SELF');
    const [low, high] = userId < req.body.userId ? [userId, req.body.userId] : [req.body.userId, userId];
    const [f] = await db.select().from(friendships).where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high), eq(friendships.status, 'accepted')));
    if (!f) throw new AppError('FORBIDDEN');
    return giftCosmetic(db, userId, req.body.userId, req.body.item, req.body.requestId);
  });

  r.get('/users/:id', {
    schema: { tags: ['users'], summary: 'Public profile (never includes mobile)', params: z.object({ id: z.uuid() }),
      response: { 200: publicProfile, 404: apiErrorSchema } }
  }, async (req) => {
    const [u] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!u || u.status !== 'active') throw new AppError('NOT_FOUND');
    return toPublicProfile(u);
  });
  // ---------- Player management (admin) ----------
  const playerStatus = z.enum(['active', 'suspended', 'deleted']);
  const adminPlayer = z.object({ id: z.uuid(), displayName: z.string(), avatarKey: z.string(), mobileMasked: z.string().nullable(), status: playerStatus,
    roles: z.array(z.string()), joinedAt: z.iso.datetime(), lastSeenAt: z.iso.datetime().nullable() });
  const reasonBody = z.strictObject({ reason: z.string().trim().min(3).max(300) });
  const errs = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema };
  const suspendedNow = exists(db.select({ x: sql`1` }).from(userSanctions).where(and(eq(userSanctions.userId, users.id), eq(userSanctions.kind, 'suspended'),
    isNull(userSanctions.revokedAt), or(isNull(userSanctions.endsAt), gt(userSanctions.endsAt, sql`now()`)))));
  const playerCols = { user: users, mobile: userPrivate.mobile, suspended: sql<boolean>`${suspendedNow}`,
    lastSeen: sql<string | null>`(select max(${sessions.lastSeenAt}) from ${sessions} where ${sessions.userId} = ${users.id})` };
  type PlayerRow = { user: typeof users.$inferSelect; mobile: string | null; suspended: boolean; lastSeen: string | null };
  const toPlayer = (x: PlayerRow, roles: string[]): z.infer<typeof adminPlayer> => ({
    ...toPublicProfile(x.user), mobileMasked: x.mobile ? maskMobile(x.mobile) : null, roles,
    status: x.user.status === 'deleted' ? 'deleted' : x.suspended ? 'suspended' : 'active', lastSeenAt: x.lastSeen ? new Date(x.lastSeen).toISOString() : null });
  const rolesOf = async (ids: string[]) => {
    const rows = ids.length ? await db.select().from(userRoles).where(inArray(userRoles.userId, ids)) : [];
    return (id: string) => rows.filter((x) => x.userId === id).map((x) => x.role);
  };
  /** Admin acts on someone else, and never on another staff account (roles are managed out of band). */
  const loadTarget = async (adminId: string, id: string) => {
    if (id === adminId) throw new AppError('CANNOT_TARGET_SELF');
    const [u] = await db.select().from(users).where(eq(users.id, id));
    if (!u || u.status === 'deleted') throw new AppError('NOT_FOUND');
    if ((await db.select({ r: userRoles.role }).from(userRoles).where(eq(userRoles.userId, id)).limit(1)).length) throw new AppError('FORBIDDEN');
    return u;
  };
  const audit = (actorId: string, action: string, targetId: string, metadata: Record<string, unknown>, requestId: string) =>
    db.insert(auditLog).values({ actorId, action, targetType: 'user', targetId, metadata, requestId });
  const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;

  r.get('/admin/users', {
    schema: { tags: ['admin'], summary: 'All players with search (name or mobile digits) and status filter; mobile is masked',
      querystring: z.object({ q: z.string().trim().max(64).optional(), status: z.enum(['all', 'active', 'suspended', 'deleted']).default('all'), offset: z.coerce.number().int().min(0).default(0) }),
      response: { 200: z.object({ items: z.array(adminPlayer), total: z.number().int(), hasMore: z.boolean() }), ...errs } }
  }, async (req) => {
    requireRole(req, 'admin');
    const { q, status, offset } = req.query;
    const digits = (q ?? '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[\s-]/g, '').replace(/^\+98/, '0');
    const text = !q ? undefined : /^\d{3,}$/.test(digits) ? ilike(userPrivate.mobile, `%${digits}%`) : ilike(users.displayName, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const where = and(text,
      status === 'deleted' ? eq(users.status, 'deleted') : status === 'all' ? undefined : eq(users.status, 'active'),
      status === 'suspended' ? suspendedNow : status === 'active' ? sql`not ${suspendedNow}` : undefined);
    const rows = await db.select(playerCols).from(users).leftJoin(userPrivate, eq(userPrivate.userId, users.id)).where(where)
      .orderBy(desc(users.createdAt), desc(users.id)).limit(51).offset(offset);
    const total = await count(db.select({ n: sql<number>`count(*)::int` }).from(users).leftJoin(userPrivate, eq(userPrivate.userId, users.id)).where(where));
    const page = rows.slice(0, 50);
    const roles = await rolesOf(page.map((x) => x.user.id));
    return { items: page.map((x) => toPlayer(x, roles(x.user.id))), total, hasMore: rows.length > 50 };
  });

  r.get('/admin/users/:id', {
    schema: { tags: ['admin'], summary: 'One player: status, coins, tables, sessions and sanction history', params: z.object({ id: z.uuid() }),
      response: { 200: adminPlayer.extend({ coins: z.number().int(), tablesPlayed: z.number().int(), activeSessions: z.number().int(),
        sanctions: z.array(z.object({ id: z.uuid(), kind: z.string(), reason: z.string(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime().nullable(), active: z.boolean() })) }), ...errs } }
  }, async (req) => {
    requireRole(req, 'admin');
    const id = req.params.id;
    const [x] = await db.select(playerCols).from(users).leftJoin(userPrivate, eq(userPrivate.userId, users.id)).where(eq(users.id, id));
    if (!x) throw new AppError('NOT_FOUND');
    const sanctions = await db.select().from(userSanctions).where(eq(userSanctions.userId, id)).orderBy(desc(userSanctions.startsAt));
    return { ...toPlayer(x, (await rolesOf([id]))(id)), coins: await coinBalance(db, id),
      tablesPlayed: await count(db.select({ n: sql<number>`count(*)::int` }).from(participants).where(eq(participants.userId, id))),
      activeSessions: await count(db.select({ n: sql<number>`count(*)::int` }).from(sessions).where(and(eq(sessions.userId, id), isNull(sessions.revokedAt), gt(sessions.expiresAt, sql`now()`)))),
      sanctions: sanctions.map((v) => ({ id: v.id, kind: v.kind, reason: v.reason, startsAt: v.startsAt.toISOString(), endsAt: v.endsAt?.toISOString() ?? null,
        active: !v.revokedAt && (!v.endsAt || v.endsAt.getTime() > Date.now()) })) };
  });

  r.post('/admin/users/:id/suspend', {
    schema: { tags: ['admin'], summary: 'Suspend a player (optionally for N hours); sessions stay only for viewing sanctions and appealing',
      params: z.object({ id: z.uuid() }), body: reasonBody.extend({ durationHours: z.number().int().min(1).max(24 * 365).optional() }), response: { 204: z.null(), ...errs } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const u = await loadTarget(userId, req.params.id);
    if (await activeSuspension(db, u.id)) throw new AppError('ALREADY_SUSPENDED');
    const h = req.body.durationHours;
    await db.insert(userSanctions).values({ userId: u.id, kind: 'suspended', reason: req.body.reason, createdBy: userId,
      endsAt: h ? sql`now() + make_interval(hours => ${h})` : null });
    await audit(userId, 'user.suspend', u.id, { reason: req.body.reason, durationHours: h ?? null }, req.id);
    return reply.code(204).send(null);
  });

  r.post('/admin/users/:id/unsuspend', {
    schema: { tags: ['admin'], summary: 'Lift every active suspension of a player', params: z.object({ id: z.uuid() }), body: reasonBody, response: { 204: z.null(), ...errs } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const u = await loadTarget(userId, req.params.id);
    const lifted = await db.update(userSanctions).set({ revokedAt: sql`now()`, revokedBy: userId })
      .where(and(eq(userSanctions.userId, u.id), eq(userSanctions.kind, 'suspended'), isNull(userSanctions.revokedAt))).returning({ id: userSanctions.id });
    if (!lifted.length) throw new AppError('NOT_FOUND');
    await audit(userId, 'user.unsuspend', u.id, { reason: req.body.reason }, req.id);
    return reply.code(204).send(null);
  });

  r.post('/admin/users/:id/logout', {
    schema: { tags: ['admin'], summary: 'End every session of a player (sign out on all devices)', params: z.object({ id: z.uuid() }), body: reasonBody, response: { 204: z.null(), ...errs } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const u = await loadTarget(userId, req.params.id);
    await db.update(sessions).set({ revokedAt: sql`now()` }).where(and(eq(sessions.userId, u.id), isNull(sessions.revokedAt)));
    await audit(userId, 'user.logout_all', u.id, { reason: req.body.reason }, req.id);
    return reply.code(204).send(null);
  });

  r.post('/admin/users/:id/close', {
    schema: { tags: ['admin'], summary: 'Close a player account (same anonymisation as self-delete); refused while the player has running games',
      params: z.object({ id: z.uuid() }), body: reasonBody.extend({ confirm: z.literal('بستن') }), response: { 204: z.null(), ...errs } }
  }, async (req, reply) => {
    const { userId } = requireRole(req, 'admin');
    const u = await loadTarget(userId, req.params.id);
    await closeAccount(db, u.id, userId, 'account.close', { reason: req.body.reason }, req.id);
    return reply.code(204).send(null);
  });
}
