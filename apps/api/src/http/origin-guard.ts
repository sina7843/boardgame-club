import type { FastifyInstance } from 'fastify';
import { AppError } from './errors.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isAllowedOrigin(origin: string | undefined, allowed: readonly string[]): boolean {
  return !!origin && allowed.includes(origin);
}

/**
 * CSRF defence for cookie sessions: every state-changing request must carry an Origin
 * (or, as a fallback, Referer) from the allow-list, in addition to SameSite=Lax cookies
 * and JSON-only bodies (which force a CORS preflight from foreign origins).
 */
export function registerOriginGuard(app: FastifyInstance, allowed: readonly string[]): void {
  app.addHook('onRequest', async (req) => {
    if (SAFE_METHODS.has(req.method)) return;
    let origin = req.headers.origin;
    if (!origin && req.headers.referer) {
      try { origin = new URL(req.headers.referer).origin; } catch { origin = undefined; }
    }
    if (!isAllowedOrigin(origin, allowed)) throw new AppError('CSRF_ORIGIN_REJECTED');
  });
}
