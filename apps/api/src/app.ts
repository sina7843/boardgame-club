import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Db } from '@bg/db';
import type { GameRegistry } from '@bg/game-engine';
import { fakeGateway, zarinpalGateway, type BillingConfig, type MatchConfig, type PlayConfig } from '@bg/play';
import type { Config } from './config.ts';
import { AppError, registerErrorHandling } from './http/errors.ts';
import { registerOriginGuard } from './http/origin-guard.ts';
import { renderMetrics } from './metrics.ts';
import type { OtpDelivery } from './modules/auth/delivery.ts';
import { authRoutes } from './modules/auth/routes.ts';
import { resolveSession } from './modules/auth/session.ts';
import { catalogRoutes } from './modules/catalog/routes.ts';
import { healthRoutes } from './modules/health/routes.ts';
import { tableRoutes } from './modules/tables/routes.ts';
import { matchmakingRoutes } from './modules/matchmaking/routes.ts';
import { moderationRoutes } from './modules/moderation/routes.ts';
import { chatRoutes } from './modules/social/chat.ts';
import { communityRoutes } from './modules/social/communities.ts';
import { socialRoutes } from './modules/social/routes.ts';
import { progressionRoutes } from './modules/progression/routes.ts';
import { billingRoutes } from './modules/billing/routes.ts';
import { userRoutes } from './modules/users/routes.ts';

export interface Deps {
  config: Config;
  db: Db;
  delivery: OtpDelivery;
  registry: GameRegistry;
  play: PlayConfig;
  match: MatchConfig;
  billing: BillingConfig;
}

/** Payment boundary: the fake gateway only outside production; otherwise checkout is disabled until a real
 * provider adapter, credentials and approved prices exist (recorded blocker). */
export function billingFor(config: Config, db: Db): BillingConfig {
  const web = config.payments.publicWebUrl;
  const zp = config.payments.zarinpal;
  const gateway = config.payments.provider === 'fake' && config.allowTestProviders ? fakeGateway(db, web)
    : zp ? zarinpalGateway({ ...zp, callbackUrl: `${web}/api/payments/callback/zarinpal` })
      : null;
  return {
    gateway,
    unavailableReasonFa: gateway ? null : 'درگاه پرداخت واقعی هنوز انتخاب و پیکربندی نشده است؛ خرید اشتراک غیرفعال است.',
    callbackUrl: `${web}/api/payments/callback`,
    paymentTtlMinutes: 30
  };
}

/** Paths never written to logs (NFR-01 / security): cookies, OTP codes, mobile numbers. */
export const LOG_REDACT_PATHS = [
  'req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]',
  '*.mobile', '*.code', '*.token', '*.codeHash', 'body', 'req.body'
];

export async function buildApp(deps: Deps, opts: { logStream?: { write(msg: string): void } } = {}): Promise<FastifyInstance> {
  const { config, db } = deps;
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: { paths: LOG_REDACT_PATHS, censor: '[redacted]' },
      ...(opts.logStream ? { stream: opts.logStream } : {})
    },
    genReqId: () => randomUUID(),
    requestIdHeader: false,
    bodyLimit: 64 * 1024,
    // Hop count, not "trust everything": the client address is taken N entries from the right of X-Forwarded-For,
    // so a client-supplied header cannot spoof it (1 = Caddy only; 2 = Caddy behind another proxy such as Coolify).
    trustProxy: (_addr: string, hop: number) => config.isProd && hop < config.trustProxyHops
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);

  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
    reply.header('x-content-type-options', 'nosniff');
    reply.header('cache-control', 'no-store');
  });

  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: 60_000,
    // Runs after session resolution: signed-in users get their own bucket, so many players behind one
    // carrier-grade NAT address do not throttle each other. Anonymous traffic is keyed by IP.
    hook: 'preHandler',
    keyGenerator: (req) => (req.auth ? `user:${req.auth.userId}` : `ip:${req.ip}`),
    // ponytail: in-memory buckets are per process; move to a shared store when the API runs >1 replica.
    errorResponseBuilder: (_req, ctx) => new AppError('RATE_LIMITED', { retryAfterSeconds: Math.ceil(ctx.ttl / 1000) })
  });
  await app.register(swagger, {
    openapi: {
      info: { title: 'Persian Boardgame API', version: '0.1.0', description: 'Errors: { errorCode, messageFa, requestId }' }
    },
    transform: jsonSchemaTransform
  });

  registerOriginGuard(app, config.webOrigins);
  app.decorateRequest('auth', null);
  app.addHook('onRequest', async (req) => {
    req.auth = await resolveSession(db, req.cookies[config.session.cookieName]);
  });

  await app.register(async (api) => {
    healthRoutes(api, deps);
    authRoutes(api, deps);
    userRoutes(api, deps);
    catalogRoutes(api, deps);
    tableRoutes(api, deps);
    matchmakingRoutes(api, deps);
    socialRoutes(api, deps);
    chatRoutes(api, deps);
    communityRoutes(api, deps);
    moderationRoutes(api, deps);
    progressionRoutes(api, deps);
    billingRoutes(api, deps);
    api.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
    // Operational metrics (Prometheus text). Not public: the reverse proxy does not route the path (scrape over the
    // internal network) and a token is required, compared in constant time on fixed-length digests.
    const digest = (s: string) => createHash('sha256').update(s).digest();
    api.get('/metrics', { schema: { hide: true }, config: { rateLimit: false } }, async (req, reply) => {
      const token = config.metricsToken;
      if (!token && config.isProd) throw new AppError('NOT_FOUND');
      if (token && !timingSafeEqual(digest(req.headers.authorization ?? ''), digest(`Bearer ${token}`))) throw new AppError('FORBIDDEN');
      return reply.type('text/plain; version=0.0.4').send(await renderMetrics(db));
    });
  }, { prefix: '/api' });

  return app;
}
