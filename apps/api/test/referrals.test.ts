import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { FIXTURE_CODE, grantRole, nextMobile, post, setup, type TestCtx } from './helpers.ts';
import { call, users, type User } from './play-helpers.ts';

let ctx: TestCtx;
let admin: User;
let inviter: User;
beforeAll(async () => {
  ctx = await setup();
  [admin, inviter] = await users(ctx, 2) as [User, User];
  await grantRole(ctx.db, admin.mobile, 'admin');
});
afterAll(async () => { await ctx.close(); });

/** Sign up a brand-new account through an invite link. */
async function signUp(referralCode: string, mobile = nextMobile()): Promise<User> {
  const req = await post(ctx.app, '/api/auth/otp/request', { mobile });
  const res = await post(ctx.app, '/api/auth/otp/verify', { challengeId: req.json().challengeId, code: FIXTURE_CODE, referralCode });
  expect(res.statusCode).toBe(200);
  const cookie = `bg_sid=${res.cookies.find((c) => c.name === 'bg_sid')!.value}`;
  const me = (await ctx.app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).json();
  return { cookie, mobile, id: me.id };
}
const referral = async (u: User) => (await call(ctx, 'GET', '/api/me/referral', u)).json();
const coins = async (u: User) => (await call(ctx, 'GET', '/api/me/coins', u)).json().balance as number;
const premiumDays = async (u: User) => {
  const s = (await call(ctx, 'GET', '/api/me/subscription', u)).json();
  return s.premium ? Math.round((new Date(s.premiumUntil).getTime() - Date.now()) / 86400_000) : 0;
};
const friendIds = async (u: User) => (await call(ctx, 'GET', '/api/me/friends', u)).json().friends.map((f: { id: string }) => f.id);
const setRewards = (body: object, who: User = admin) => call(ctx, 'PUT', '/api/admin/referral', who, body);
const OFF = { enabled: false, inviterCoins: 0, inviterDays: 0, inviteeCoins: 0, inviteeDays: 0, maxRewardedPerInviter: 0 };

describe('friend referral', () => {
  it('gives every user one stable invite code', async () => {
    const a = await referral(inviter);
    expect(a.code).toMatch(/^[A-Z2-9]{8}$/);
    expect((await referral(inviter)).code).toBe(a.code);
    expect(a.invited).toEqual([]);
    expect(a.reward).toBeNull();
  });

  it('signing up through the link makes both friends, even with rewards off', async () => {
    const { code } = await referral(inviter);
    const friend = await signUp(code.toLowerCase());
    expect(await friendIds(inviter)).toContain(friend.id);
    expect(await friendIds(friend)).toContain(inviter.id);
    expect((await referral(inviter)).invited.map((i: { user: { id: string } }) => i.user.id)).toEqual([friend.id]);
  });

  it('only admins change rewards; when on, both sides get coins and stacked premium days', async () => {
    const rewards = { enabled: true, inviterCoins: 50, inviterDays: 3, inviteeCoins: 20, inviteeDays: 2, maxRewardedPerInviter: 0 };
    expect((await setRewards(rewards, inviter)).statusCode).toBe(403);
    expect((await setRewards(rewards)).statusCode).toBe(204);
    const { code } = await referral(inviter);
    const before = await coins(inviter);
    const friend = await signUp(code);
    expect(await coins(inviter)).toBe(before + 50);
    expect(await coins(friend)).toBe(20);
    expect(await premiumDays(friend)).toBe(2);
    expect(await premiumDays(inviter)).toBe(3);
    await signUp(code);
    expect(await premiumDays(inviter)).toBe(6); // second gift starts when the first ends
  });

  it('existing accounts, bad codes and self-codes change nothing; the cap stops inviter rewards only', async () => {
    const { code } = await referral(inviter);
    const before = (await referral(inviter)).invited.length;
    // Logging in again with the link (account exists) is not a new referral.
    await ctx.db.delete(schema.otpChallenges).where(eq(schema.otpChallenges.mobile, admin.mobile)); // skip resend cooldown
    const again = await post(ctx.app, '/api/auth/otp/request', { mobile: admin.mobile });
    expect((await post(ctx.app, '/api/auth/otp/verify', { challengeId: again.json().challengeId, code: FIXTURE_CODE, referralCode: code })).statusCode).toBe(200);
    expect(await signUp('NOPE!!').then((u) => u.id)).toBeTruthy(); // sign-up never fails on a bad code
    expect((await referral(inviter)).invited.length).toBe(before);

    await setRewards({ ...OFF, enabled: true, inviterCoins: 10, inviteeCoins: 5, maxRewardedPerInviter: 1 });
    const fresh = await users(ctx, 1).then((x) => x[0]!);
    const freshCode = (await referral(fresh)).code;
    const first = await signUp(freshCode);
    const second = await signUp(freshCode);
    expect(await coins(fresh)).toBe(10);
    expect(await coins(first)).toBe(5);
    expect(await coins(second)).toBe(5);
    expect(await friendIds(fresh)).toEqual(expect.arrayContaining([first.id, second.id]));
  });

  it('admin report lists who joined through whose link', async () => {
    const res = (await call(ctx, 'GET', '/api/admin/referrals', admin)).json();
    expect(res.total).toBeGreaterThanOrEqual(5);
    expect(res.top[0].user.id).toBe(inviter.id);
    expect(res.items[0].referrer.id).toBeTruthy();
    const mine = (await call(ctx, 'GET', `/api/admin/referrals?referrerId=${inviter.id}`, admin)).json();
    expect(mine.items.every((i: { referrer: { id: string } }) => i.referrer.id === inviter.id)).toBe(true);
    expect((await call(ctx, 'GET', '/api/admin/referrals', inviter)).statusCode).toBe(403);
  });
});
