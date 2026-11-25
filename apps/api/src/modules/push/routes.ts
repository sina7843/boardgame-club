// Web Push subscriptions. The API stores endpoints; the worker sends (it alone holds the VAPID private key).
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { apiErrorSchema, pushSubscriptionBody, pushUnsubscribeBody } from '@bg/contracts';
import { schema } from '@bg/db';
import type { Deps } from '../../app.ts';
import { AppError } from '../../http/errors.ts';
import { requireUser } from '../auth/session.ts';

const { pushSubscriptions } = schema;
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 404: apiErrorSchema };
/** Browsers per account; the oldest is dropped beyond this. */
const MAX_PER_USER = 10;

export function pushRoutes(app: FastifyInstance, { db, config }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/push/key', { schema: { tags: ['push'], summary: 'VAPID public key (404 when Web Push is disabled)', response: { 200: z.object({ publicKey: z.string() }), 404: apiErrorSchema } } },
    async () => {
      if (!config.webPushPublicKey) throw new AppError('NOT_FOUND');
      return { publicKey: config.webPushPublicKey };
    });

  r.post('/me/push/subscriptions', { schema: { tags: ['push'], summary: 'Save this browser\'s push subscription (upsert by endpoint)', body: pushSubscriptionBody, response: { 204: z.null(), ...errors } } },
    async (req, reply) => {
      const { userId } = requireUser(req);
      if (!config.webPushPublicKey) throw new AppError('NOT_FOUND');
      const { endpoint, keys } = req.body;
      const userAgent = req.headers['user-agent']?.slice(0, 200) ?? null;
      // A shared browser that signs in as someone else moves the endpoint to the new account.
      await db.insert(pushSubscriptions).values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent })
        .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent } });
      await db.execute(sql`delete from push_subscriptions where user_id = ${userId} and id not in (
        select id from push_subscriptions where user_id = ${userId} order by created_at desc limit ${MAX_PER_USER})`);
      return reply.code(204).send(null);
    });

  r.delete('/me/push/subscriptions', { schema: { tags: ['push'], summary: 'Remove this browser\'s push subscription', body: pushUnsubscribeBody, response: { 204: z.null(), ...errors } } },
    async (req, reply) => {
      const { userId } = requireUser(req, { allowSuspended: true });
      await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, req.body.endpoint)));
      return reply.code(204).send(null);
    });
}
