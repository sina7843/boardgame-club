// Email address of the account owner: add (6-digit code by email) → verify → remove, notifications on/off, and the
// signed unsubscribe link from digest/reminder emails. Codes are HMAC-hashed like OTP and compared in constant time.
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { apiErrorSchema, emailBody, emailDigestBody, emailVerifyBody } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { verificationEmail, verifyUnsubscribeToken } from '@bg/play';
import type { Deps } from '../../app.ts';
import { AppError } from '../../http/errors.ts';
import { requireUser } from '../auth/session.ts';

const { emailVerifications, userPrivate } = schema;
const errors = { 400: apiErrorSchema, 401: apiErrorSchema, 409: apiErrorSchema, 429: apiErrorSchema, 502: apiErrorSchema, 503: apiErrorSchema };

const hashCode = (secret: string, id: string, code: string) => createHmac('sha256', secret).update(`email:${id}:${code}`).digest();

/** Owner's email state for GET /me: verified address, the address waiting for a code, notifications flag. */
export async function emailStateOf(db: Db, userId: string, row: { email: string | null; emailDigest: boolean }, available: boolean) {
  const [p] = await db.select({ email: emailVerifications.email }).from(emailVerifications)
    .where(and(eq(emailVerifications.userId, userId), isNull(emailVerifications.consumedAt), gt(emailVerifications.expiresAt, sql`now()`)))
    .orderBy(desc(emailVerifications.createdAt)).limit(1);
  return { address: row.email, pending: p?.email ?? null, digest: row.emailDigest, available };
}

const page = (title: string, text: string) => `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head>`
  + `<body style="font-family:Tahoma,Arial,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;text-align:right"><h1 style="font-size:20px">${title}</h1><p>${text}</p></body></html>`;

export function emailRoutes(app: FastifyInstance, { db, config, mail }: Deps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const cfg = config.email;
  const requireMail = () => { if (!mail) throw new AppError('SERVICE_UNAVAILABLE'); return mail; };

  r.post('/me/email', {
    schema: { tags: ['email'], summary: 'Send a 6-digit verification code to an email address (rate limited per account and per address)', body: emailBody, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireUser(req);
    const send = requireMail();
    const email = req.body.email;
    const [taken] = await db.select({ id: userPrivate.userId }).from(userPrivate).where(and(eq(userPrivate.email, email), ne(userPrivate.userId, userId)));
    if (taken) throw new AppError('EMAIL_TAKEN');
    const issued = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'email:' + userId}))`);
      const now = Date.now();
      const recent = await tx.select({ createdAt: emailVerifications.createdAt }).from(emailVerifications)
        .where(and(eq(emailVerifications.userId, userId), gt(emailVerifications.createdAt, sql`now() - interval '1 hour'`))).orderBy(desc(emailVerifications.createdAt));
      const wait = recent[0] ? Math.ceil((recent[0].createdAt.getTime() + cfg.resendAfterSeconds * 1000 - now) / 1000) : 0;
      if (wait > 0) throw new AppError('OTP_RESEND_TOO_SOON', { retryAfterSeconds: wait });
      const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(emailVerifications)
        .where(and(eq(emailVerifications.email, email), gt(emailVerifications.createdAt, sql`now() - interval '1 hour'`)));
      if (recent.length >= cfg.maxPerHour || n >= cfg.maxPerHour) throw new AppError('RATE_LIMITED', { retryAfterSeconds: 3600 });
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const id = randomUUID();
      await tx.insert(emailVerifications).values({ id, userId, email, codeHash: hashCode(config.otp.hashSecret, id, code).toString('hex'), expiresAt: new Date(now + cfg.ttlSeconds * 1000) });
      return { id, code };
    });
    try {
      await send(verificationEmail(email, issued.code));
    } catch {
      // Not delivered: the row stays (it counts toward the limits) but is closed, so no address shows as pending.
      await db.update(emailVerifications).set({ consumedAt: sql`now()` }).where(eq(emailVerifications.id, issued.id));
      throw new AppError('OTP_DELIVERY_FAILED');
    }
    return reply.code(204).send(null);
  });

  r.post('/me/email/verify', {
    schema: { tags: ['email'], summary: 'Confirm the emailed code; the address becomes the account email', body: emailVerifyBody, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireUser(req);
    type VerifyError = 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_TOO_MANY_ATTEMPTS' | 'EMAIL_TAKEN';
    // Errors are returned, not thrown, so the attempt counter commits.
    const error = await db.transaction(async (tx): Promise<VerifyError | null> => {
      const [v] = await tx.select().from(emailVerifications).where(and(eq(emailVerifications.userId, userId), isNull(emailVerifications.consumedAt)))
        .orderBy(desc(emailVerifications.createdAt)).limit(1).for('update');
      if (!v) return 'OTP_INVALID';
      if (v.expiresAt.getTime() <= Date.now()) return 'OTP_EXPIRED';
      if (v.attempts >= cfg.maxAttempts) return 'OTP_TOO_MANY_ATTEMPTS';
      const expected = Buffer.from(v.codeHash, 'hex');
      const actual = hashCode(config.otp.hashSecret, v.id, req.body.code);
      if (!(expected.length === actual.length && timingSafeEqual(expected, actual))) {
        await tx.update(emailVerifications).set({ attempts: v.attempts + 1 }).where(eq(emailVerifications.id, v.id));
        return v.attempts + 1 >= cfg.maxAttempts ? 'OTP_TOO_MANY_ATTEMPTS' : 'OTP_INVALID';
      }
      await tx.update(emailVerifications).set({ attempts: v.attempts + 1, consumedAt: sql`now()` }).where(eq(emailVerifications.id, v.id));
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'email-address:' + v.email}))`);
      const [taken] = await tx.select({ id: userPrivate.userId }).from(userPrivate).where(and(eq(userPrivate.email, v.email), ne(userPrivate.userId, userId)));
      if (taken) return 'EMAIL_TAKEN';
      await tx.update(userPrivate).set({ email: v.email, emailVerifiedAt: sql`now()`, emailDigestDay: null }).where(eq(userPrivate.userId, userId));
      return null;
    });
    if (error) throw new AppError(error);
    return reply.code(204).send(null);
  });

  r.delete('/me/email', {
    schema: { tags: ['email'], summary: 'Remove the account email (and any pending code)', response: { 204: z.null(), 401: apiErrorSchema } }
  }, async (req, reply) => {
    const { userId } = requireUser(req, { allowSuspended: true });
    await db.transaction(async (tx) => {
      await tx.update(userPrivate).set({ email: null, emailVerifiedAt: null, emailDigestDay: null }).where(eq(userPrivate.userId, userId));
      await tx.update(emailVerifications).set({ consumedAt: sql`now()` }).where(and(eq(emailVerifications.userId, userId), isNull(emailVerifications.consumedAt)));
    });
    return reply.code(204).send(null);
  });

  r.put('/me/email/digest', {
    schema: { tags: ['email'], summary: 'Email notifications (daily turn digest and tournament reminder) on or off', body: emailDigestBody, response: { 204: z.null(), ...errors } }
  }, async (req, reply) => {
    const { userId } = requireUser(req, { allowSuspended: true });
    await db.update(userPrivate).set({ emailDigest: req.body.digest }).where(eq(userPrivate.userId, userId));
    return reply.code(204).send(null);
  });

  // Linked from every digest/reminder email. GET so it works from any mail client; the HMAC token names the account.
  r.get('/email/unsubscribe', {
    schema: { tags: ['email'], summary: 'Signed unsubscribe link: turns email notifications off', querystring: z.object({ token: z.string().max(200) }) }
  }, async (req, reply) => {
    const userId = verifyUnsubscribeToken(config.otp.hashSecret, req.query.token);
    reply.type('text/html; charset=utf-8');
    if (!userId) return reply.code(400).send(page('لینک معتبر نیست', 'این لینک لغو اشتراک درست نیست. از بخش تنظیمات حساب هم می‌توانید ایمیل‌ها را خاموش کنید.'));
    await db.update(userPrivate).set({ emailDigest: false }).where(eq(userPrivate.userId, userId));
    return reply.send(page('ایمیل‌ها خاموش شد', 'دیگر ایمیل یادآوری نوبت و تورنمنت برایتان فرستاده نمی‌شود. هر وقت خواستید، از تنظیمات حساب دوباره روشنش کنید.'));
  });
}
