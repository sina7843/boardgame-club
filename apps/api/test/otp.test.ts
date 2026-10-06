import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { FIXTURE_CODE, nextMobile, post, setup, type TestCtx } from './helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const requestCode = async (mobile = nextMobile()) => {
  const res = await post(ctx.app, '/api/auth/otp/request', { mobile });
  expect(res.statusCode).toBe(200);
  return res.json() as { challengeId: string; fixtureDelivery: boolean };
};
const verify = (challengeId: string, code: string) => post(ctx.app, '/api/auth/otp/verify', { challengeId, code });

describe('OTP login', () => {
  it('logs in with a valid code, sets an HttpOnly session cookie and stores only a hash', async () => {
    const { challengeId, fixtureDelivery } = await requestCode();
    expect(fixtureDelivery).toBe(true);
    const [row] = await ctx.db.select().from(schema.otpChallenges).where(eq(schema.otpChallenges.id, challengeId));
    expect(row!.codeHash).not.toContain(FIXTURE_CODE);
    expect(row!.codeHash).toMatch(/^[0-9a-f]{64}$/);

    const res = await verify(challengeId, FIXTURE_CODE);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ isNewUser: true });
    const cookie = res.cookies.find((c) => c.name === 'bg_sid');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
  });

  it('rejects a reused code', async () => {
    const { challengeId } = await requestCode();
    expect((await verify(challengeId, FIXTURE_CODE)).statusCode).toBe(200);
    const again = await verify(challengeId, FIXTURE_CODE);
    expect(again.statusCode).toBe(400);
    expect(again.json().errorCode).toBe('OTP_ALREADY_USED');
  });

  it('rejects an expired code', async () => {
    const { challengeId } = await requestCode();
    await ctx.db.update(schema.otpChallenges).set({ expiresAt: sql`now() - interval '1 second'` })
      .where(eq(schema.otpChallenges.id, challengeId));
    const res = await verify(challengeId, FIXTURE_CODE);
    expect(res.statusCode).toBe(400);
    expect(res.json().errorCode).toBe('OTP_EXPIRED');
  });

  it('rejects an invalid code and an unknown challenge', async () => {
    const { challengeId } = await requestCode();
    const bad = await verify(challengeId, '000000');
    expect(bad.json()).toMatchObject({ errorCode: 'OTP_INVALID', messageFa: expect.any(String), requestId: expect.any(String) });
    const unknown = await verify('6b1f8f3e-0000-4000-8000-000000000000', FIXTURE_CODE);
    expect(unknown.json().errorCode).toBe('OTP_INVALID');
  });

  it('locks the challenge after the attempt limit, even for the right code', async () => {
    const { challengeId } = await requestCode();
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await verify(challengeId, '000000')).json().errorCode);
    expect(codes).toEqual(['OTP_INVALID', 'OTP_INVALID', 'OTP_INVALID', 'OTP_INVALID', 'OTP_TOO_MANY_ATTEMPTS']);
    const right = await verify(challengeId, FIXTURE_CODE);
    expect(right.statusCode).toBe(429);
    expect(right.json().errorCode).toBe('OTP_TOO_MANY_ATTEMPTS');
  });

  it('consumes a code exactly once under concurrent verification', async () => {
    const { challengeId } = await requestCode();
    const results = await Promise.all(Array.from({ length: 5 }, () => verify(challengeId, FIXTURE_CODE)));
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(results.filter((r) => r.json().errorCode === 'OTP_ALREADY_USED')).toHaveLength(4);
  });

  it('enforces resend delay and hourly per-mobile limit', async () => {
    const mobile = nextMobile();
    await requestCode(mobile);
    const tooSoon = await post(ctx.app, '/api/auth/otp/request', { mobile });
    expect(tooSoon.statusCode).toBe(429);
    expect(tooSoon.json().errorCode).toBe('OTP_RESEND_TOO_SOON');
    expect(Number(tooSoon.headers['retry-after'])).toBeGreaterThan(0);

    // Age existing challenges past the resend window, then fill the hourly quota (5).
    for (let i = 0; i < 4; i++) {
      await ctx.db.update(schema.otpChallenges).set({ createdAt: sql`created_at - interval '2 minutes'` })
        .where(eq(schema.otpChallenges.mobile, mobile));
      await requestCode(mobile);
    }
    await ctx.db.update(schema.otpChallenges).set({ createdAt: sql`created_at - interval '2 minutes'` })
      .where(eq(schema.otpChallenges.mobile, mobile));
    const limited = await post(ctx.app, '/api/auth/otp/request', { mobile });
    expect(limited.json().errorCode).toBe('RATE_LIMITED');
  });

  it('normalizes equivalent mobile formats to one account and rejects invalid numbers', async () => {
    const a = await requestCode('+989130000001');
    expect((await verify(a.challengeId, FIXTURE_CODE)).json()).toEqual({ isNewUser: true });
    await ctx.db.update(schema.otpChallenges).set({ createdAt: sql`created_at - interval '2 minutes'` })
      .where(eq(schema.otpChallenges.id, a.challengeId));
    const b = await requestCode('۰۹۱۳۰۰۰۰۰۰۱');
    expect((await verify(b.challengeId, FIXTURE_CODE)).json()).toEqual({ isNewUser: false });
    const bad = await post(ctx.app, '/api/auth/otp/request', { mobile: '0212345678' });
    expect(bad.json().errorCode).toBe('INVALID_MOBILE');
  });

  it('rate-limits OTP requests per IP (default 10 per 10 minutes)', async () => {
    const limited = await setup({ OTP_REQUESTS_PER_IP_PER_10_MIN: '10' });
    try {
      const statuses = [];
      for (let i = 0; i < 11; i++) statuses.push((await post(limited.app, '/api/auth/otp/request', { mobile: nextMobile() })).statusCode);
      expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
      expect(statuses[10]).toBe(429);
    } finally {
      await limited.close();
    }
  });
});
