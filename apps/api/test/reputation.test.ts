import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { grantRole, setup, type TestCtx } from './helpers.ts';
import { call, users, view, type User } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const { gameTables, participants, behaviorSignals } = schema;
const turnTable = (u: User, body: object = {}) => call(ctx, 'POST', '/api/tables', u, { gameId: 'line-three', pace: 'turn', capacity: 2, turnSeconds: 86400, visibility: 'public', ...body });

/** A bare table row (copies game/version of an existing one) with the user seated; used for history and signals. */
async function pastTable(userId: string, status: 'finished' | 'cancelled' = 'finished', humans = 1) {
  const [ref] = await ctx.db.select().from(gameTables).limit(1);
  const [t] = await ctx.db.insert(gameTables).values({ gameId: ref!.gameId, gameVersionId: ref!.gameVersionId, pace: 'turn', competition: 'friendly',
    visibility: 'private', status, hostId: userId, capacity: Math.max(2, humans), settings: { turnSeconds: 86400, reminders: false }, finishedAt: sql`now()` }).returning();
  await ctx.db.insert(participants).values({ tableId: t!.id, seat: 0, userId, kind: 'human' });
  for (let i = 1; i < humans; i++) {
    const [o] = await users(ctx, 1);
    await ctx.db.insert(participants).values({ tableId: t!.id, seat: i, userId: o!.id, kind: 'human' });
  }
  return t!.id;
}
const finishGames = async (u: User, n: number) => { for (let i = 0; i < n; i++) await pastTable(u.id); };
const signal = async (u: User, kind: string, humans = 1) =>
  ctx.db.insert(behaviorSignals).values({ userId: u.id, tableId: await pastTable(u.id, 'cancelled', humans), kind });

describe('reputation «اعتبار» (phase C)', () => {
  it('«حداقل اعتبار» is only for public turn-based tables', async () => {
    const [h] = await users(ctx, 1);
    expect((await turnTable(h!, { minReputation: 70, visibility: 'private' })).statusCode).toBe(400);
    expect((await turnTable(h!, { minReputation: 70, pace: 'live', turnSeconds: 60 })).statusCode).toBe(400);
    expect((await turnTable(h!, { minReputation: 80 })).statusCode).toBe(400);
  });

  it('join is refused below the minimum; newcomers meet 70 but not 90; lobby seats carry the band', async () => {
    const [h1, h2, h3, fresh, low] = await users(ctx, 5);
    const t90 = (await turnTable(h1!, { minReputation: 90 })).json().id;
    const t70 = (await turnTable(h2!, { minReputation: 70 })).json().id;
    const r = await call(ctx, 'POST', `/api/tables/${t90}/join`, fresh, {});
    expect(r.statusCode).toBe(403);
    expect(r.json()).toMatchObject({ errorCode: 'REPUTATION_TOO_LOW', messageFa: 'اعتبار شما برای این میز کافی نیست' });
    // 100 + 5 recent games − 7 timeout losses × 5 − 1 ready no-show × 2 = 68 (below 70).
    await finishGames(low!, 5);
    for (let i = 0; i < 7; i++) await signal(low!, 'timeout_loss');
    await signal(low!, 'ready_no_show');
    const t70b = (await turnTable(h3!, { minReputation: 70 })).json().id;
    expect((await call(ctx, 'POST', `/api/tables/${t70b}/join`, low, {})).json().errorCode).toBe('REPUTATION_TOO_LOW');
    expect((await call(ctx, 'POST', `/api/tables/${t70}/join`, fresh, {})).statusCode).toBe(200);
    // Joining filled and started t70; the lobby view of t90 shows the host's band without a number.
    const lobby = await view(ctx, fresh!, t90);
    expect(lobby.table.settings.minReputation).toBe(90);
    expect(lobby.table.seats[0].reputation).toEqual({ band: 'newcomer', score: null });
    const open = (await call(ctx, 'GET', '/api/tables?gameId=line-three', fresh)).json().items.find((x: { id: string }) => x.id === t90);
    expect(open).toMatchObject({ minReputation: 90, seated: [{ reputation: { band: 'newcomer', score: null } }] });
  });

  it('profile: band for everyone (even with stats hidden), the number only for the owner and moderators', async () => {
    const [p, other, mod] = await users(ctx, 3);
    await grantRole(ctx.db, mod!.mobile, 'moderator');
    await finishGames(p!, 5);
    await signal(p!, 'timeout_loss');
    await signal(p!, 'resigned', 2); // 2 human seats: ignored
    await signal(p!, 'resigned', 3); // 3 human seats: −5
    // 100 − 5 − 5 + 5 recent games = 95
    expect((await call(ctx, 'PUT', '/api/me/profile-privacy', p, { showStats: false, showRatings: false, showRecent: false })).statusCode).toBe(200);
    const own = (await call(ctx, 'GET', `/api/users/${p!.id}/card`, p)).json();
    expect(own.reputation).toEqual({ band: 'reliable', score: 95 });
    const seen = (await call(ctx, 'GET', `/api/users/${p!.id}/card`, other)).json();
    expect(seen.reputation).toEqual({ band: 'reliable', score: null });
    expect((await call(ctx, 'GET', `/api/users/${p!.id}/card`, mod)).json().reputation).toEqual({ band: 'reliable', score: 95 });
  });

  it('turn quick match: a ticket with a minimum is not paired with a player below it', async () => {
    const [picky, fresh, vet] = await users(ctx, 3);
    await finishGames(vet!, 5);
    const q = (u: User, body: object = {}) => call(ctx, 'POST', '/api/matchmaking/tickets', u, { gameId: 'line-three', pace: 'turn', playerCount: 2, turnSeconds: 43200, ...body });
    expect((await call(ctx, 'POST', '/api/matchmaking/tickets', picky, { gameId: 'line-three', pace: 'live', playerCount: 2, turnSeconds: 60, minReputation: 70 })).statusCode).toBe(400);
    expect((await q(picky!, { minReputation: 90 })).statusCode).toBe(201);
    await q(fresh!);
    const status = async (u: User) => (await call(ctx, 'GET', '/api/me/matchmaking', u)).json().items[0];
    expect((await status(picky!)).status).toBe('queued');
    expect((await status(fresh!)).status).toBe('queued');
    await q(vet!);
    const a = await status(picky!);
    expect(a.status).toBe('matched');
    expect((await status(vet!)).matchedTableId).toBe(a.matchedTableId);
    expect((await status(fresh!)).status).toBe('queued');
    const [row] = await ctx.db.select({ m: schema.matchmakingTickets.minReputation }).from(schema.matchmakingTickets).where(eq(schema.matchmakingTickets.userId, picky!.id));
    expect(row!.m).toBe(90);
  });
});
