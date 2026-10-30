import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@bg/db';
import { setup, type TestCtx } from './helpers.ts';
import { call, startTable } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('home overview', () => {
  it('is public, lists a running public table with its seats and whose turn it is, and never sends game state', async () => {
    const t = await startTable(ctx, 'chess', 2);
    await ctx.db.update(schema.gameTables).set({ visibility: 'public' }).where(eq(schema.gameTables.id, t.tableId));

    const r = await call(ctx, 'GET', '/api/home');
    expect(r.statusCode).toBe(200);
    const home = r.json();
    expect(home.liveTables).toBeGreaterThanOrEqual(1);
    expect(home.playingNow).toBeGreaterThanOrEqual(2);
    const live = home.live.find((x: { id: string }) => x.id === t.tableId);
    expect(live).toMatchObject({ gameId: 'chess', competition: 'friendly', pace: 'live', turnSeconds: 60, spectators: 0 });
    expect(live.seats).toHaveLength(2);
    expect(typeof live.turnName).toBe('string'); // chess: exactly one seat to move
    expect(JSON.stringify(home)).not.toMatch(/"state"|"rng"|"inviteCode"/);
    expect(home.weekly.me).toBeNull(); // guest
    expect(Array.isArray(home.popular)).toBe(true);
    expect(home.popular).toContain('chess');
  });

  it('private tables are never listed', async () => {
    const t = await startTable(ctx, 'chess', 2);
    const home = (await call(ctx, 'GET', '/api/home')).json();
    expect(home.live.some((x: { id: string }) => x.id === t.tableId)).toBe(false);
  });

  it('a signed-in viewer gets their own weekly place', async () => {
    const t = await startTable(ctx, 'chess', 2);
    const home = (await call(ctx, 'GET', '/api/home', t.players[0])).json();
    expect(home.weekly.me).toMatchObject({ points: expect.any(Number) });
  });
});
