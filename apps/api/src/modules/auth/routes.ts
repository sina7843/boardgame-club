import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { apiErrorSchema, otpRequestBody, otpRequestResponse, otpVerifyBody } from '@bg/contracts';
import type { Deps } from '../../app.ts';
import { requestOtp, verifyOtp } from './otp.ts';
import { createSession, revokeSession, setSessionCookie } from './session.ts';

const tenMinutes = 10 * 60_000;

export function authRoutes(app: FastifyInstance, { db, config, delivery }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/auth/otp/request', {
    config: { rateLimit: { max: config.otp.requestsPerIpPer10Min, timeWindow: tenMinutes } },
    schema: {
      tags: ['auth'], summary: 'Request a login OTP for a mobile number',
      body: otpRequestBody,
      response: { 200: otpRequestResponse, 400: apiErrorSchema, 429: apiErrorSchema }
    }
  }, async (req) => requestOtp(db, config.otp, delivery, req.body.mobile));

  r.post('/auth/otp/verify', {
    config: { rateLimit: { max: config.otp.requestsPerIpPer10Min * 3, timeWindow: tenMinutes } },
    schema: {
      tags: ['auth'], summary: 'Verify an OTP and start a cookie session',
      body: otpVerifyBody,
      response: { 200: z.object({ isNewUser: z.boolean() }), 400: apiErrorSchema, 429: apiErrorSchema }
    }
  }, async (req, reply) => {
    const { userId, isNew } = await verifyOtp(db, config.otp, req.body.challengeId, req.body.code);
    const { token, expiresAt } = await createSession(db, userId, config.session.ttlDays);
    setSessionCookie(reply, config.session.cookieName, token, expiresAt, config.isProd);
    return { isNewUser: isNew };
  });

  r.post('/auth/logout', {
    schema: { tags: ['auth'], summary: 'End the current session', response: { 204: z.null() } }
  }, async (req, reply) => {
    if (req.auth) await revokeSession(db, req.auth.sessionId);
    reply.clearCookie(config.session.cookieName, { path: '/' });
    return reply.code(204).send(null);
  });
}
