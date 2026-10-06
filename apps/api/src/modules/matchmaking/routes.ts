import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { apiErrorSchema, enqueueBody, ticketView } from '@bg/contracts';
import { cancelTicket, enqueue, myTickets } from '@bg/play';
import type { Deps } from '../../app.ts';
import { requireUser } from '../auth/session.ts';

const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 403: apiErrorSchema, 404: apiErrorSchema, 409: apiErrorSchema };

export function matchmakingRoutes(app: FastifyInstance, { db, registry, play, match }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/matchmaking/tickets', {
    schema: { tags: ['matchmaking'], summary: 'Join a queue (game, mode, player count, time). One active ticket per player.', body: enqueueBody,
      response: { 201: z.object({ id: z.uuid() }), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireUser(req);
    return reply.code(201).send({ id: await enqueue(db, registry, play, match, userId, req.body) });
  });

  r.get('/me/matchmaking', {
    schema: { tags: ['matchmaking'], summary: 'My active (and just-finished) tickets with wait time, window and ready deadline',
      response: { 200: z.object({ items: z.array(ticketView) }), 401: apiErrorSchema } }
  }, async (req) => ({ items: await myTickets(db, match, requireUser(req).userId) }));

  r.delete('/matchmaking/tickets/:id', {
    schema: { tags: ['matchmaking'], summary: 'Leave the queue, or decline a proposed match (others are re-queued)', params: z.object({ id: z.uuid() }),
      response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    await cancelTicket(db, requireUser(req).userId, req.params.id);
    return reply.code(204).send(null);
  });
}
