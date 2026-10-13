import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ONBOARDING_TOURS } from '@bg/contracts';
import { schema } from '@bg/db';
import { setup, type TestCtx } from './helpers.ts';
import { call, users, type User } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const { userAchievements, rewardLedger } = schema;
const step = (u: User, tour: string, s: string) => call(ctx, 'POST', `/api/me/onboarding/${tour}/steps/${s}`, u);

describe('site onboarding', () => {
  it('verified steps need the real action; Getting Started is granted once, only after every step of every guide', async () => {
    const [a, b] = await users(ctx, 2);
    expect((await step(a!, 'nope', 'x')).statusCode).toBe(404);
    // Real-action steps cannot be claimed before doing them.
    for (const [tour, s] of [['first-table', 'table'], ['profile', 'customize'], ['social', 'request']] as const) {
      const r = await step(a!, tour, s);
      expect(r.statusCode).toBe(409);
      expect(r.json().errorCode).toBe('ONBOARDING_STEP_NOT_DONE');
    }
    // Do them for real.
    expect((await call(ctx, 'POST', '/api/tables', a, { gameId: 'line-three', pace: 'turn', capacity: 2, turnSeconds: 86400 })).statusCode).toBe(201);
    expect((await call(ctx, 'PATCH', '/api/me/profile', a, { bio: 'سلام' })).statusCode).toBe(200);
    expect((await call(ctx, 'POST', '/api/friends/requests', a, { userId: b!.id })).statusCode).toBeLessThan(300);

    const all = ONBOARDING_TOURS.flatMap((t) => t.steps.map((s) => [t.key, s.key] as const));
    for (const [tour, s] of all.slice(0, -1)) expect((await step(a!, tour, s)).statusCode).toBe(200);
    let state = (await call(ctx, 'GET', '/api/me/onboarding', a)).json();
    expect(state.achievement.grantedAt).toBeNull();
    const [lastTour, lastStep] = all.at(-1)!;
    state = (await step(a!, lastTour, lastStep)).json();
    expect(state.tours.every((t: { completed: boolean }) => t.completed)).toBe(true);
    expect(state.achievement.grantedAt).not.toBeNull();

    // Replays and repeated steps never grant twice.
    for (const [tour, s] of all) await step(a!, tour, s);
    expect(await ctx.db.select().from(userAchievements).where(eq(userAchievements.userId, a!.id))).toHaveLength(1);
    expect(await ctx.db.select().from(rewardLedger).where(sql`${rewardLedger.userId} = ${a!.id} and ${rewardLedger.ruleId} = 'achievement.getting_started'`)).toHaveLength(1);
    // Shown on the public profile.
    const profile = (await call(ctx, 'GET', `/api/users/${a!.id}/achievements`, b)).json();
    expect(profile.items.map((i: { key: string }) => i.key)).toContain('getting_started');
  });

  it('a guide can be skipped and brought back; progress is kept per user', async () => {
    const [a] = await users(ctx, 1);
    await step(a!, 'welcome', 'games');
    let state = (await call(ctx, 'PATCH', '/api/me/onboarding/welcome', a, { dismissed: true })).json();
    const welcome = () => state.tours.find((t: { key: string }) => t.key === 'welcome');
    expect(welcome()).toMatchObject({ dismissed: true, completedSteps: ['games'], completed: false });
    state = (await call(ctx, 'PATCH', '/api/me/onboarding/welcome', a, { dismissed: false })).json();
    expect(welcome().dismissed).toBe(false);
    expect((await call(ctx, 'GET', '/api/me/onboarding')).statusCode).toBe(401);
  });
});
