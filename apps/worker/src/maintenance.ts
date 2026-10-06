import { and, isNotNull, lt, or, sql } from 'drizzle-orm';
import { schema, type Db } from '@bg/db';

const { otpChallenges, sessions } = schema;

/**
 * Idempotent retention job: OTP challenges (which hold the mobile number) are kept for one day
 * for abuse/rate-limit history; revoked or expired sessions are removed after seven days.
 * DRAGON-01 adds outbox and deadline consumers to this worker.
 */
export async function runMaintenance(db: Db): Promise<{ otpChallenges: number; sessions: number }> {
  const otp = await db.delete(otpChallenges)
    .where(lt(otpChallenges.createdAt, sql`now() - interval '1 day'`)).returning({ id: otpChallenges.id });
  const sess = await db.delete(sessions)
    .where(or(
      lt(sessions.expiresAt, sql`now() - interval '7 days'`),
      and(isNotNull(sessions.revokedAt), lt(sessions.revokedAt, sql`now() - interval '7 days'`))
    )).returning({ id: sessions.id });
  return { otpChallenges: otp.length, sessions: sess.length };
}
