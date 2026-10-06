import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { apiErrorSchema, maskMobile, meResponse, publicProfile, updateProfileBody, type PublicProfile } from '@bg/contracts';
import { schema } from '@bg/db';
import type { Deps } from '../../app.ts';
import { AppError } from '../../http/errors.ts';
import { requireUser } from '../auth/session.ts';

const { users, userPrivate } = schema;

/** Public projection: an explicit allow-list so private columns can never leak by addition. */
export function toPublicProfile(u: typeof users.$inferSelect): PublicProfile {
  return {
    id: u.id,
    displayName: u.displayName,
    avatarKey: u.avatarKey as PublicProfile['avatarKey'],
    joinedAt: u.createdAt.toISOString()
  };
}

export function userRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  const loadMe = async (userId: string, roles: z.infer<typeof meResponse>['roles'], suspended = false) => {
    const [row] = await db.select({ user: users, mobile: userPrivate.mobile }).from(users)
      .innerJoin(userPrivate, eq(userPrivate.userId, users.id)).where(eq(users.id, userId));
    if (!row) throw new AppError('UNAUTHENTICATED');
    return { ...toPublicProfile(row.user), mobileMasked: maskMobile(row.mobile), roles, profileCompleted: row.user.profileCompleted, suspended };
  };

  r.get('/me', {
    schema: { tags: ['users'], summary: 'Signed-in account (private view)', response: { 200: meResponse, 401: apiErrorSchema } }
  }, async (req) => {
    const auth = requireUser(req, { allowSuspended: true });
    return loadMe(auth.userId, auth.roles, auth.suspended);
  });

  r.patch('/me/profile', {
    schema: { tags: ['users'], summary: 'Update display name and avatar', body: updateProfileBody,
      response: { 200: meResponse, 400: apiErrorSchema, 401: apiErrorSchema } }
  }, async (req) => {
    const auth = requireUser(req);
    await db.update(users).set({ ...req.body, profileCompleted: true, updatedAt: sql`now()` }).where(eq(users.id, auth.userId));
    return loadMe(auth.userId, auth.roles);
  });

  r.get('/users/:id', {
    schema: { tags: ['users'], summary: 'Public profile (never includes mobile)', params: z.object({ id: z.uuid() }),
      response: { 200: publicProfile, 404: apiErrorSchema } }
  }, async (req) => {
    const [u] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!u || u.status !== 'active') throw new AppError('NOT_FOUND');
    return toPublicProfile(u);
  });
}
