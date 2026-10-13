import { eq, or } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { grantRole, login, setup, type TestCtx } from './helpers.ts';
import { call, users, type User } from './play-helpers.ts';

let ctx: TestCtx;
let admin: User;
let user: User;
beforeAll(async () => {
  ctx = await setup();
  [admin, user] = await users(ctx, 2) as [User, User];
  await grantRole(ctx.db, admin.mobile, 'admin');
});
afterAll(async () => { await ctx.close(); });

describe('site pages and contact details (admin-editable)', () => {
  it('serves default copy, lets only admins edit, and resets to default', async () => {
    const terms = (await call(ctx, 'GET', '/api/site/pages/terms')).json();
    expect(terms.titleFa).toBe('قوانین و مقررات');
    expect(terms.updatedAt).toBeNull();
    expect((await call(ctx, 'GET', '/api/site/pages/nope')).statusCode).toBe(400);

    const body = { titleFa: 'قوانین تازه', bodyFa: 'متن تازهٔ قوانین سایت.' };
    expect((await call(ctx, 'PUT', '/api/admin/site/pages/terms', user, body)).statusCode).toBe(403);
    expect((await call(ctx, 'PUT', '/api/admin/site/pages/terms', admin, body)).statusCode).toBe(204);
    const edited = (await call(ctx, 'GET', '/api/site/pages/terms')).json();
    expect(edited).toMatchObject(body);
    expect(edited.updatedAt).not.toBeNull();

    expect((await call(ctx, 'DELETE', '/api/admin/site/pages/terms', admin)).statusCode).toBe(204);
    expect((await call(ctx, 'GET', '/api/site/pages/terms')).json().titleFa).toBe('قوانین و مقررات');
  });

  it('contact details default to the email and save admin-filled fields', async () => {
    expect((await call(ctx, 'GET', '/api/site/info')).json()).toMatchObject({ email: 'Twelvethemythmaker@gmail.com', phone: '', address: '' });
    const info = { ownerName: 'باشگاه بردگیم', email: 'a@b.co', phone: '021-12345678', address: 'تهران', postalCode: '1234567890', hours: '۹ تا ۱۷' };
    expect((await call(ctx, 'PUT', '/api/admin/site/info', admin, { ...info, email: 'bad' })).statusCode).toBe(400);
    expect((await call(ctx, 'PUT', '/api/admin/site/info', admin, info)).statusCode).toBe(204);
    expect((await call(ctx, 'GET', '/api/site/info')).json()).toEqual(info);
  });

  it('terms acceptance is stored per version and re-asked only when the admin requires it', async () => {
    const [u] = await users(ctx, 1) as [User];
    const me = async () => (await call(ctx, 'GET', '/api/me', u)).json();
    expect((await me()).termsAccepted).toBe(false);
    const accepted = await call(ctx, 'POST', '/api/me/terms', u);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().termsAccepted).toBe(true);
    const page = { titleFa: 'حریم خصوصی', bodyFa: 'متن تازهٔ حریم خصوصی.' };
    // A plain edit (typo fix) keeps everyone's acceptance; a flagged one asks again. The flag is ignored for other pages.
    expect((await call(ctx, 'PUT', '/api/admin/site/pages/privacy', admin, page)).statusCode).toBe(204);
    expect((await call(ctx, 'PUT', '/api/admin/site/pages/about', admin, { ...page, requireReaccept: true })).statusCode).toBe(204);
    expect((await me()).termsAccepted).toBe(true);
    expect((await call(ctx, 'PUT', '/api/admin/site/pages/privacy', admin, { ...page, requireReaccept: true })).statusCode).toBe(204);
    expect((await me()).termsAccepted).toBe(false);
    await call(ctx, 'POST', '/api/me/terms', u);
    expect((await me()).termsAccepted).toBe(true);
  });
});

describe('account deletion', () => {
  it('needs the typed confirmation, is refused for staff and players in open tables, then anonymises and frees the mobile', async () => {
    const [u, friend] = await users(ctx, 2) as [User, User];
    expect((await call(ctx, 'DELETE', '/api/me', u, { confirm: 'x' })).statusCode).toBe(400);
    expect((await call(ctx, 'DELETE', '/api/me', admin, { confirm: 'حذف' })).json().errorCode).toBe('ACCOUNT_DELETE_ADMIN');

    const table = await call(ctx, 'POST', '/api/tables', u, { gameId: 'line-three', pace: 'turn', capacity: 2, turnSeconds: 86400 });
    expect(table.statusCode).toBe(201);
    expect((await call(ctx, 'DELETE', '/api/me', u, { confirm: 'حذف' })).json().errorCode).toBe('ACCOUNT_HAS_ACTIVE_GAMES');
    expect((await call(ctx, 'POST', `/api/tables/${table.json().id}/leave`, u)).statusCode).toBeLessThan(300);

    expect((await call(ctx, 'POST', '/api/friends/requests', u, { userId: friend.id })).statusCode).toBeLessThan(300);
    const del = await call(ctx, 'DELETE', '/api/me', u, { confirm: 'حذف' });
    expect(del.statusCode).toBe(204);
    expect((await call(ctx, 'GET', '/api/me', u)).statusCode).toBe(401);
    expect((await call(ctx, 'GET', `/api/users/${u.id}`)).statusCode).toBe(404);
    const [row] = await ctx.db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(row).toMatchObject({ status: 'deleted', displayName: 'کاربر حذف‌شده', bio: null });
    expect(await ctx.db.select().from(schema.friendships).where(or(eq(schema.friendships.userLow, u.id), eq(schema.friendships.userHigh, u.id)))).toEqual([]);

    // Same mobile again = a brand-new empty account.
    await ctx.db.delete(schema.otpChallenges).where(eq(schema.otpChallenges.mobile, u.mobile)); // skip the 60 s resend wait
    const again = await login(ctx.app, u.mobile);
    const fresh = (await ctx.app.inject({ method: 'GET', url: '/api/me', headers: { cookie: again.cookie } })).json();
    expect(fresh.id).not.toBe(u.id);
    expect(fresh.profileCompleted).toBe(false);
  });
});
