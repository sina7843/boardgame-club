import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { grantRole, login, setup, type TestCtx } from './helpers.ts';
import { startTable } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const get = (url: string, cookie?: string) => ctx.app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });

describe('admin tables', () => {
  it('lists every table with status, seats and counts; admins only; filters by status, game and player; no game state', async () => {
    const admin = await login(ctx.app);
    await grantRole(ctx.db, admin.mobile, 'admin');
    const t = await startTable(ctx, 'chess', 2);
    const player = await login(ctx.app);

    expect((await get('/api/admin/tables', player.cookie)).statusCode).toBe(403);
    const all = (await get('/api/admin/tables', admin.cookie)).json();
    const row = all.items.find((x: { id: string }) => x.id === t.tableId);
    expect(row).toMatchObject({ gameId: 'chess', status: 'active', kind: 'normal', pace: 'live', capacity: 2 });
    expect(row.seats).toHaveLength(2);
    expect(all.counts.active).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(all)).not.toMatch(/"state"|"rng"|inviteCode/);

    expect((await get('/api/admin/tables?status=finished', admin.cookie)).json().items.some((x: { id: string }) => x.id === t.tableId)).toBe(false);
    expect((await get('/api/admin/tables?gameId=chess', admin.cookie)).json().items.every((x: { gameId: string }) => x.gameId === 'chess')).toBe(true);
    const byName = (await get(`/api/admin/tables?q=${encodeURIComponent(row.seats[0].name)}`, admin.cookie)).json();
    expect(byName.items.some((x: { id: string }) => x.id === t.tableId)).toBe(true);
  });
});

describe('admin watching', () => {
  it('an admin can open any table (private too) as a spectator; other players cannot', async () => {
    const admin = await login(ctx.app);
    await grantRole(ctx.db, admin.mobile, 'admin');
    const t = await startTable(ctx, 'chess', 2); // private by default
    const outsider = await login(ctx.app);
    expect((await get(`/api/tables/${t.tableId}`, outsider.cookie)).statusCode).toBe(403);
    const seen = await get(`/api/tables/${t.tableId}`, admin.cookie);
    expect(seen.statusCode).toBe(200);
    const snap = seen.json();
    expect(snap.table.mySeat).toBeNull();
    expect(snap.game.legalActions).toEqual([]);
    // REST viewing writes no watcher row: players still see nobody watching.
    const own = (await ctx.app.inject({ method: 'GET', url: `/api/tables/${t.tableId}`, headers: { cookie: t.players[0]!.cookie } })).json();
    expect(own.table.spectators).toBe(0);
  });
});

describe('admin tables: deleted accounts', () => {
  it('hides tables with a deleted player unless deleted=true', async () => {
    const admin = await login(ctx.app);
    await grantRole(ctx.db, admin.mobile, 'admin');
    const t = await startTable(ctx, 'chess', 2);
    await ctx.db.execute(sql`update users set status = 'deleted' where id = ${t.players[1]!.id}`);
    const ids = async (url: string) => (await get(url, admin.cookie)).json().items.map((x: { id: string }) => x.id) as string[];
    expect(await ids('/api/admin/tables')).not.toContain(t.tableId);
    expect(await ids('/api/admin/tables?deleted=true')).toContain(t.tableId);
  });
});
