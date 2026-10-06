import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { grantRole, login, ORIGIN, setup, type TestCtx } from './helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const get = (url: string, cookie?: string) => ctx.app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });
const patch = (url: string, payload: object, cookie?: string) =>
  ctx.app.inject({ method: 'PATCH', url, payload, headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) } });

describe('RBAC', () => {
  it('admin endpoints: 401 anonymous, 403 player, 200 admin', async () => {
    expect((await get('/api/admin/games')).statusCode).toBe(401);
    const player = await login(ctx.app);
    const forbidden = await get('/api/admin/games', player.cookie);
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().errorCode).toBe('FORBIDDEN');

    const admin = await login(ctx.app);
    await grantRole(ctx.db, admin.mobile, 'admin');
    expect((await get('/api/admin/games', admin.cookie)).statusCode).toBe(200);
  });

  it('a moderator is not an admin', async () => {
    const mod = await login(ctx.app);
    await grantRole(ctx.db, mod.mobile, 'moderator');
    expect((await patch('/api/admin/games/line-three', { status: 'suspended', reason: 'test' }, mod.cookie)).statusCode).toBe(403);
  });

  it('admin suspension hides the game from the catalog, keeps detail, blocks new tables and is audited', async () => {
    const admin = await login(ctx.app);
    await grantRole(ctx.db, admin.mobile, 'admin');
    const res = await patch('/api/admin/games/sealed-bids', { status: 'suspended', reason: 'خطای قانون' }, admin.cookie);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'suspended', acceptingNewTables: false });

    const list = (await get('/api/games')).json().items.map((g: { id: string }) => g.id);
    expect(list).not.toContain('sealed-bids');
    expect((await get('/api/games/sealed-bids')).json().acceptingNewTables).toBe(false);

    const audit = await ctx.db.select().from(schema.auditLog).where(eq(schema.auditLog.targetId, 'sealed-bids'));
    expect(audit[0]).toMatchObject({ action: 'game.status', metadata: { from: 'active', to: 'suspended' } });
    await patch('/api/admin/games/sealed-bids', { status: 'active', reason: 'رفع شد' }, admin.cookie);
  });
});

describe('sessions and profile redaction', () => {
  it('/me requires a session; logout revokes it server-side', async () => {
    expect((await get('/api/me')).statusCode).toBe(401);
    const u = await login(ctx.app);
    expect((await get('/api/me', u.cookie)).statusCode).toBe(200);
    const out = await ctx.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin: ORIGIN, cookie: u.cookie } });
    expect(out.statusCode).toBe(204);
    expect((await get('/api/me', u.cookie)).statusCode).toBe(401);
  });

  it('owner sees only a masked mobile; public profile never contains it', async () => {
    const u = await login(ctx.app);
    const me = (await get('/api/me', u.cookie)).json();
    expect(me.mobileMasked).toBe(`${u.mobile.slice(0, 4)}***${u.mobile.slice(-4)}`);
    expect(JSON.stringify(me)).not.toContain(u.mobile);

    const pub = await get(`/api/users/${me.id}`);
    expect(pub.statusCode).toBe(200);
    expect(Object.keys(pub.json()).sort()).toEqual(['avatarKey', 'displayName', 'id', 'joinedAt']);
    expect(pub.body).not.toContain(u.mobile.slice(-7));
    expect(pub.body).not.toContain('mobile');
  });

  it('validates profile updates', async () => {
    const u = await login(ctx.app);
    const ok = await patch('/api/me/profile', { displayName: 'مهره‌باز', avatarKey: 'dice' }, u.cookie);
    expect(ok.json()).toMatchObject({ displayName: 'مهره‌باز', avatarKey: 'dice', profileCompleted: true });
    const bad = await patch('/api/me/profile', { displayName: '<script>', avatarKey: 'dice' }, u.cookie);
    expect(bad.statusCode).toBe(400);
    expect(bad.json().errorCode).toBe('VALIDATION_FAILED');
    const extra = await patch('/api/me/profile', { displayName: 'سارا', avatarKey: 'dice', roles: ['admin'] }, u.cookie);
    expect(extra.statusCode).toBe(400);
  });
});
