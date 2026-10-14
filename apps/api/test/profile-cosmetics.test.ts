import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { setup, type TestCtx } from './helpers.ts';
import { call, startTable, users, type User } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const { gameTables, gameResults, coinLedger } = schema;
const give = (userId: string, amount: number) => ctx.db.insert(coinLedger).values({ userId, amount, ruleId: 'test', reason: 'test', sourceKey: `test:${randomUUID()}` });
const card = (viewer: User, id: string) => call(ctx, 'GET', `/api/users/${id}/card`, viewer);
const equip = (u: User | undefined, kind: string, key: string | null) => call(ctx, 'PATCH', '/api/me/cosmetics/equip', u, { kind, key });

/** A table that really started (so seats exist), then marked finished with host first, guest second. */
async function finished(host: User, guest: User, visibility: 'public' | 'private') {
  const { tableId } = await startTable(ctx, 'chess', 2, { players: [host, guest] });
  await ctx.db.insert(gameResults).values({ tableId, reason: 'win', outcome: { reason: 'win', placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }] } });
  await ctx.db.update(gameTables).set({ status: 'finished', visibility, finishedAt: new Date() }).where(eq(gameTables.id, tableId));
}

describe('public profile record', () => {
  it('shows stats, level and recent PUBLIC games only; private tables are counted but never listed', async () => {
    const [a, b, viewer] = await users(ctx, 3) as [User, User, User];
    await finished(a, b, 'public');
    await finished(a, b, 'private');
    const c = (await card(viewer, a.id)).json();
    expect(c.stats).toEqual({ gamesPlayed: 2, wins: 2, winRate: 100 });
    expect(c.level).toBeGreaterThanOrEqual(1);
    expect(c.recent).toHaveLength(1);
    expect(c.recent[0]).toMatchObject({ gameId: 'chess', place: 1, fieldSize: 2 });
    expect(JSON.stringify(c)).not.toContain('tableId');
    expect((await card(viewer, b.id)).json().stats).toMatchObject({ gamesPlayed: 2, wins: 0, winRate: 0 });
  });

  it('hides what the owner hides from others but not from the owner', async () => {
    const [a, b, viewer] = await users(ctx, 3) as [User, User, User];
    await finished(a, b, 'public');
    expect((await call(ctx, 'PUT', '/api/me/profile-privacy', a, { showStats: false, showRatings: true, showRecent: false })).statusCode).toBe(200);
    const c = (await card(viewer, a.id)).json();
    expect(c.stats).toBeNull();
    expect(c.mastery).toBeNull();
    expect(c.recent).toBeNull();
    expect(c.ratings).toEqual([]);
    const own = (await card(a, a.id)).json();
    expect(own.stats.gamesPlayed).toBe(1);
    expect(own.recent).toHaveLength(1);
  });

  it('returns nothing extra in either direction of a block', async () => {
    const [a, b] = await users(ctx, 2) as [User, User];
    await finished(a, b, 'public');
    await call(ctx, 'POST', '/api/blocks', { ...b }, { userId: a.id });
    for (const [viewer, target] of [[b, a], [a, b]] as const) {
      const c = (await card(viewer, target.id)).json();
      expect([c.stats, c.level, c.bestLeague, c.ratings, c.recent, c.mastery]).toEqual([null, null, null, null, null, null]);
    }
  });
});

describe('table cosmetics', () => {
  it('equips free items per kind, rejects locked, wrong-kind and unknown ones, and clears with null', async () => {
    const [u] = await users(ctx, 1) as [User];
    expect((await equip(u, 'seatRing', 'sr.0')).json().equipped).toEqual({ seatRing: 'sr.0' });
    expect((await equip(u, 'seatRing', 'sr.2')).json().errorCode).toBe('COSMETIC_LOCKED'); // 220 coins, not owned
    expect((await equip(u, 'seatRing', 'sr.4')).json().errorCode).toBe('COSMETIC_LOCKED'); // premium, not subscribed
    expect((await equip(u, 'emote', 'sr.0')).statusCode).toBe(400); // wrong kind
    expect((await equip(u, 'emote', 'em.99')).statusCode).toBe(400);
    expect((await equip(u, 'nonsense', 'em.0')).statusCode).toBe(400);
    expect((await equip(u, 'emote', 'em.0')).json().equipped).toEqual({ seatRing: 'sr.0', emote: 'em.0' });
    expect((await call(ctx, 'GET', '/api/me/cosmetics', u)).json().equipped).toEqual({ seatRing: 'sr.0', emote: 'em.0' });
    expect((await equip(u, 'seatRing', null)).json().equipped).toEqual({ emote: 'em.0' });
    expect((await equip(undefined, 'emote', null)).statusCode).toBe(401);
  });

  it('buys a card back with coins, then equips it; a premium item is not for sale', async () => {
    const [u] = await users(ctx, 1) as [User];
    await give(u.id, 130);
    const bought = await call(ctx, 'POST', '/api/cosmetics/buy', u, { item: 'cb.1', requestId: randomUUID() });
    expect(bought.json().balance).toBe(10);
    expect((await equip(u, 'cardBack', 'cb.1')).json().equipped).toEqual({ cardBack: 'cb.1' });
    expect((await call(ctx, 'POST', '/api/cosmetics/buy', u, { item: 'cb.4', requestId: randomUUID() })).json().errorCode).toBe('NOT_FOR_SALE');
  });

  it('puts equipped seatRing/chatBubble/emote on the table seat', async () => {
    const [a, b] = await users(ctx, 2) as [User, User];
    await equip(a, 'seatRing', 'sr.1').catch(() => null);
    await give(a.id, 100);
    await call(ctx, 'POST', '/api/cosmetics/buy', a, { item: 'sr.1', requestId: randomUUID() });
    await equip(a, 'seatRing', 'sr.1');
    await equip(a, 'cardBack', 'cb.0');
    const { tableId } = await startTable(ctx, 'chess', 2, { players: [a, b] });
    const t = (await call(ctx, 'GET', `/api/tables/${tableId}`, b)).json().table;
    const seatOf = (id: string) => t.seats.find((s: { user: { id: string } | null }) => s.user?.id === id);
    expect(seatOf(a.id).cosmetics).toEqual({ seatRing: 'sr.1' }); // cardBack is not table-visible data
    expect(seatOf(b.id).cosmetics).toBeUndefined();
  });
});
