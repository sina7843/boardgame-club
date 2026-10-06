import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { grantRole, setup, type TestCtx } from './helpers.ts';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup({ METRICS_TOKEN: 'test-metrics-token-0123456789abcdef' }); });
afterAll(async () => { await ctx.close(); });

describe('operations', () => {
  it('metrics require the token and expose aggregate numbers only', async () => {
    const t = await startTable(ctx, 'sealed-bids', 2, { pace: 'turn' });
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const s = await view(ctx, t.players[0]!, t.tableId);
    await command(ctx, bySeat(0), t.tableId, s.game.revision, { type: 'bid', token: 4 });
    await command(ctx, bySeat(1), t.tableId, 0, { type: 'bid', token: 1 }); // stale
    expect((await ctx.app.inject({ method: 'GET', url: '/api/metrics' })).statusCode).toBe(403);
    const res = await ctx.app.inject({ method: 'GET', url: '/api/metrics', headers: { authorization: 'Bearer test-metrics-token-0123456789abcdef' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(/bg_command_duration_ms_count\{transport="http"\} \d+/);
    expect(res.body).toMatch(/bg_commands_total\{transport="http",outcome="STALE_REVISION"\} 1/);
    expect(res.body).toMatch(/bg_active_tables \d+/);
    expect(res.body).toMatch(/bg_outbox_backlog \d+/);
    // No identifiers or game content.
    expect(res.body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(res.body).not.toContain('token');
  });

  it('admin can toggle missions (audited) and filter the audit history', async () => {
    const [admin, player] = await users(ctx, 2);
    await grantRole(ctx.db, admin!.mobile, 'admin');
    expect((await call(ctx, 'GET', '/api/admin/missions', player)).statusCode).toBe(403);
    const m = (await call(ctx, 'GET', '/api/admin/missions', admin)).json().items[0];
    expect((await call(ctx, 'PATCH', `/api/admin/missions/${m.id}`, admin, { active: false, reason: 'آزمون' })).statusCode).toBe(204);
    const filtered = (await call(ctx, 'GET', '/api/mod/audit?targetType=mission', admin)).json().items;
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.every((x: { targetType: string }) => x.targetType === 'mission')).toBe(true);
    expect((await call(ctx, 'GET', '/api/mod/audit?action=mission.', admin)).json().items[0].action).toBe('mission.active');
    await call(ctx, 'PATCH', `/api/admin/missions/${m.id}`, admin, { active: true, reason: 'بازگشت' });
    // Subscriptions support view: admin only, shows a manual grant for the requested user.
    expect((await call(ctx, 'POST', '/api/admin/entitlements', admin, { userId: player!.id, days: 7, reason: 'جبران قطعی سرویس' })).statusCode).toBeLessThan(300);
    expect((await call(ctx, 'GET', '/api/admin/subscriptions', player)).statusCode).toBe(403);
    const subs = (await call(ctx, 'GET', `/api/admin/subscriptions?userId=${player!.id}`, admin)).json().items;
    expect(subs).toMatchObject([{ kind: 'manual', userId: player!.id, status: 'active' }]);
  });
});
