import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError, ERRORS, type ApiError, type ErrorCode } from '@bg/contracts';
import { metrics } from '../metrics.ts';

export { AppError };

export function errorBody(code: ErrorCode, requestId: string, extra: Partial<ApiError> = {}): ApiError {
  return { errorCode: code, messageFa: ERRORS[code], requestId, ...extra };
}

/** Every error leaves as { errorCode, messageFa, requestId }; stacks never reach clients. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send(errorBody('NOT_FOUND', req.id));
  });

  app.setErrorHandler((err: FastifyError | AppError, req, reply) => {
    if (err instanceof AppError) {
      if (err.retryAfterSeconds) reply.header('retry-after', String(err.retryAfterSeconds));
      return reply.code(err.statusCode).send(errorBody(err.code, req.id,
        err.retryAfterSeconds ? { retryAfterSeconds: err.retryAfterSeconds } : {}));
    }
    if (hasZodFastifySchemaValidationErrors(err)) {
      const details = err.validation.map((v) => ({ path: v.instancePath || '/', message: v.message ?? 'invalid' }));
      return reply.code(400).send(errorBody('VALIDATION_FAILED', req.id, { details }));
    }
    if (err.statusCode === 429) return reply.code(429).send(errorBody('RATE_LIMITED', req.id));
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      // Malformed JSON, unsupported media type, body too large, etc.
      return reply.code(err.statusCode).send(errorBody('VALIDATION_FAILED', req.id));
    }
    metrics.httpErrors5xx++;
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send(errorBody('INTERNAL_ERROR', req.id));
  });
}
