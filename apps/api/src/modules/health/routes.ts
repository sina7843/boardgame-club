import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { healthResponse } from '@bg/contracts';
import type { Deps } from '../../app.ts';

export function healthRoutes(app: FastifyInstance, { db }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/health/live', {
    config: { rateLimit: false },
    schema: { tags: ['health'], summary: 'Process is up', response: { 200: healthResponse } }
  }, async () => ({ status: 'ok' as const }));

  r.get('/health/ready', {
    config: { rateLimit: false },
    schema: { tags: ['health'], summary: 'Database reachable and migrated', response: { 200: healthResponse, 503: healthResponse } }
  }, async (_req, reply) => {
    let database: 'ok' | 'fail' = 'fail';
    let migrations: 'ok' | 'fail' = 'fail';
    try {
      await db.execute(sql`select 1`);
      database = 'ok';
      const res = await db.execute(sql`select to_regclass('public.games') is not null as ok`);
      migrations = (res[0] as { ok?: boolean } | undefined)?.ok ? 'ok' : 'fail';
    } catch {
      // reported as fail below; details stay in server logs only
    }
    const ok = database === 'ok' && migrations === 'ok';
    return reply.code(ok ? 200 : 503).send({ status: ok ? 'ok' : 'unavailable', checks: { database, migrations } });
  });
}
