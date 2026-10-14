import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { grantRole, login, ORIGIN, post, setup, type TestCtx } from './helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const get = (url: string, cookie?: string) => ctx.app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });
const idOf = async (cookie: string) => (await get('/api/me', cookie)).json().id as string;

describe('admin player management', () => {
  it('lists, searches, suspends, lifts, signs out and closes accounts; every action is audited', async () => {
    const admin = await login(ctx.app);
    await grantRole(ctx.db, admin.mobile, 'admin');
    const player = await login(ctx.app);
    const pid = await idOf(player.cookie);

    expect((await get('/api/admin/users', player.cookie)).statusCode).toBe(403);
    const all = (await get('/api/admin/users', admin.cookie)).json();
    expect(all.total).toBeGreaterThanOrEqual(2);
    const found = (await get(`/api/admin/users?q=${player.mobile.slice(-7)}`, admin.cookie)).json();
    expect(found.items).toHaveLength(1);
    expect(found.items[0]).toMatchObject({ id: pid, status: 'active', mobileMasked: expect.stringContaining('***') });
    expect(JSON.stringify(found)).not.toContain(player.mobile);

    const self = await idOf(admin.cookie);
    expect((await post(ctx.app, `/api/admin/users/${self}/suspend`, { reason: 'خودم' }, { cookie: admin.cookie })).statusCode).toBe(400);

    expect((await post(ctx.app, `/api/admin/users/${pid}/suspend`, { reason: 'تقلب', durationHours: 24 }, { cookie: admin.cookie })).statusCode).toBe(204);
    expect((await post(ctx.app, `/api/admin/users/${pid}/suspend`, { reason: 'تقلب' }, { cookie: admin.cookie })).json().errorCode).toBe('ALREADY_SUSPENDED');
    expect((await get('/api/admin/users?status=suspended', admin.cookie)).json().items.map((x: { id: string }) => x.id)).toContain(pid);
    expect((await get('/api/me/sanctions', player.cookie)).json().items[0].active).toBe(true);
    expect((await post(ctx.app, `/api/admin/users/${pid}/unsuspend`, { reason: 'اشتباه' }, { cookie: admin.cookie })).statusCode).toBe(204);
    expect((await get(`/api/admin/users/${pid}`, admin.cookie)).json()).toMatchObject({ status: 'active', activeSessions: 1 });

    expect((await post(ctx.app, `/api/admin/users/${pid}/logout`, { reason: 'نشست مشکوک' }, { cookie: admin.cookie })).statusCode).toBe(204);
    expect((await get('/api/me', player.cookie)).statusCode).toBe(401);

    expect((await post(ctx.app, `/api/admin/users/${pid}/close`, { reason: 'درخواست کاربر', confirm: 'بستن' }, { cookie: admin.cookie })).statusCode).toBe(204);
    expect((await get(`/api/admin/users/${pid}`, admin.cookie)).json()).toMatchObject({ status: 'deleted', mobileMasked: null });
    expect((await get(`/api/users/${pid}`)).statusCode).toBe(404);
    // The mobile is released for a fresh signup.
    expect(await ctx.db.select().from(schema.userPrivate).where(eq(schema.userPrivate.userId, pid))).toHaveLength(0);

    const actions = (await ctx.db.select().from(schema.auditLog).where(and(eq(schema.auditLog.targetType, 'user'), eq(schema.auditLog.targetId, pid)))).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['user.suspend', 'user.unsuspend', 'user.logout_all', 'account.close']));
  });

  it('staff accounts cannot be acted on', async () => {
    const admin = await login(ctx.app);
    await grantRole(ctx.db, admin.mobile, 'admin');
    const mod = await login(ctx.app);
    await grantRole(ctx.db, mod.mobile, 'moderator');
    const res = await ctx.app.inject({ method: 'POST', url: `/api/admin/users/${await idOf(mod.cookie)}/close`, payload: { reason: 'آزمایش', confirm: 'بستن' },
      headers: { origin: ORIGIN, cookie: admin.cookie } });
    expect(res.statusCode).toBe(403);
  });
});
