import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { normalizeIranMobile } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { Config } from '../../config.ts';
import { AppError } from '../../http/errors.ts';
import type { OtpDelivery } from './delivery.ts';

const { otpChallenges, userPrivate, users } = schema;

type OtpConfig = Config['otp'];

const hashCode = (secret: string, challengeId: string, code: string) =>
  createHmac('sha256', secret).update(`${challengeId}:${code}`).digest();

/** Serialize work per mobile number inside a transaction (rate limits, account creation). */
const lockMobile = (tx: Pick<Db, 'execute'>, mobile: string) =>
  tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'otp:' + mobile}))`);

export async function requestOtp(db: Db, cfg: OtpConfig, delivery: OtpDelivery, mobileInput: string) {
  const mobile = normalizeIranMobile(mobileInput);
  if (!mobile) throw new AppError('INVALID_MOBILE');

  const challenge = await db.transaction(async (tx) => {
    await lockMobile(tx, mobile);
    const recent = await tx.select({ createdAt: otpChallenges.createdAt }).from(otpChallenges)
      .where(and(eq(otpChallenges.mobile, mobile), gt(otpChallenges.createdAt, sql`now() - interval '1 hour'`)))
      .orderBy(desc(otpChallenges.createdAt));
    const now = Date.now();
    const latest = recent[0];
    if (latest) {
      const wait = Math.ceil((latest.createdAt.getTime() + cfg.resendAfterSeconds * 1000 - now) / 1000);
      if (wait > 0) throw new AppError('OTP_RESEND_TOO_SOON', { retryAfterSeconds: wait });
    }
    if (recent.length >= cfg.maxPerMobilePerHour) {
      const oldest = recent[recent.length - 1]!;
      const wait = Math.ceil((oldest.createdAt.getTime() + 3_600_000 - now) / 1000);
      throw new AppError('RATE_LIMITED', { retryAfterSeconds: Math.max(wait, 1) });
    }
    const id = randomUUID();
    const code = delivery.issueCode(() => String(randomInt(0, 1_000_000)).padStart(6, '0'));
    const expiresAt = new Date(now + cfg.ttlSeconds * 1000);
    await tx.insert(otpChallenges).values({
      id, mobile, expiresAt, maxAttempts: cfg.maxAttempts,
      codeHash: hashCode(cfg.hashSecret, id, code).toString('hex')
    });
    return { id, code, expiresAt };
  });

  try {
    await delivery.send(mobile, challenge.code);
  } catch {
    throw new AppError('OTP_DELIVERY_FAILED');
  }
  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt.toISOString(),
    resendAfterSeconds: cfg.resendAfterSeconds,
    fixtureDelivery: delivery.isFixture
  };
}

/**
 * Verifies a code. The challenge row is locked FOR UPDATE so concurrent verifications
 * serialize: attempts are counted exactly, and a code can be consumed only once.
 */
export async function verifyOtp(db: Db, cfg: OtpConfig, challengeId: string, code: string): Promise<{ userId: string; isNew: boolean }> {
  type VerifyError = 'OTP_INVALID' | 'OTP_ALREADY_USED' | 'OTP_EXPIRED' | 'OTP_TOO_MANY_ATTEMPTS';
  const result = await db.transaction(async (tx): Promise<{ error: VerifyError } | { userId: string; isNew: boolean }> => {
    const [ch] = await tx.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId)).for('update');
    if (!ch) return { error: 'OTP_INVALID' };
    if (ch.consumedAt) return { error: 'OTP_ALREADY_USED' };
    if (ch.expiresAt.getTime() <= Date.now()) return { error: 'OTP_EXPIRED' };
    if (ch.attempts >= ch.maxAttempts) return { error: 'OTP_TOO_MANY_ATTEMPTS' };

    const expected = Buffer.from(ch.codeHash, 'hex');
    const actual = hashCode(cfg.hashSecret, ch.id, code);
    const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!ok) {
      await tx.update(otpChallenges).set({ attempts: ch.attempts + 1 }).where(eq(otpChallenges.id, ch.id));
      return { error: (ch.attempts + 1 >= ch.maxAttempts ? 'OTP_TOO_MANY_ATTEMPTS' : 'OTP_INVALID') };
    }
    await tx.update(otpChallenges).set({ attempts: ch.attempts + 1, consumedAt: sql`now()` }).where(eq(otpChallenges.id, ch.id));

    await lockMobile(tx, ch.mobile);
    const [existing] = await tx.select({ userId: userPrivate.userId }).from(userPrivate).where(eq(userPrivate.mobile, ch.mobile));
    if (existing) return { userId: existing.userId, isNew: false };
    const [user] = await tx.insert(users)
      .values({ displayName: `بازیکن ${randomInt(1000, 10000)}` })
      .returning({ id: users.id });
    await tx.insert(userPrivate).values({ userId: user!.id, mobile: ch.mobile });
    return { userId: user!.id, isNew: true };
  });
  if ('error' in result) throw new AppError(result.error);
  return result;
}
