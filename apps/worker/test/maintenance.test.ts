import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createDb, runMigrations, schema } from '@bg/db';
import { runMaintenance } from '../src/maintenance.ts';

const url = process.env.TEST_DATABASE_URL
  ?? 'postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame_test';
const { db, close } = createDb(url, { max: 2 });
beforeAll(async () => { await runMigrations(url); });
afterAll(async () => { await close(); });

it('purges only old OTP challenges and long-dead sessions', async () => {
  const { otpChallenges, sessions, users } = schema;
  const [u] = await db.insert(users).values({ displayName: 'worker-test' }).returning();
  const [oldOtp, freshOtp] = await db.insert(otpChallenges).values([
    { mobile: '09990000001', codeHash: 'x', expiresAt: new Date(), maxAttempts: 5, createdAt: sql`now() - interval '2 days'` },
    { mobile: '09990000002', codeHash: 'x', expiresAt: new Date(), maxAttempts: 5 }
  ]).returning();
  const [deadSess, liveSess] = await db.insert(sessions).values([
    { userId: u!.id, tokenHash: `dead-${u!.id}`, expiresAt: sql`now() - interval '8 days'` },
    { userId: u!.id, tokenHash: `live-${u!.id}`, expiresAt: sql`now() + interval '1 day'` }
  ]).returning();

  await runMaintenance(db);
  const has = async (t: typeof otpChallenges | typeof sessions, id: string) =>
    (await db.select({ id: t.id }).from(t).where(eq(t.id, id))).length === 1;
  expect(await has(otpChallenges, oldOtp!.id)).toBe(false);
  expect(await has(otpChallenges, freshOtp!.id)).toBe(true);
  expect(await has(sessions, deadSess!.id)).toBe(false);
  expect(await has(sessions, liveSess!.id)).toBe(true);
  await db.delete(users).where(eq(users.id, u!.id));
});
