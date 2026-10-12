import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BOT_PERSONAS } from '@bg/contracts';
import { schema } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { defaultMatchConfig, fireDeadline, runMatchmaking, runOutbox } from '@bg/play';
import { setup, type TestCtx } from './helpers.ts';
import { call, command, makeDue, users, view, type User } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const { scheduledDeadlines: d, rewardLedger, ratingHistory, matchmakingTickets, participants, gameTables } = schema;
const botTable = (u: User, body: object) => call(ctx, 'POST', '/api/tables/bot', u, body);

/** Fire the table's pending bot deadline as the worker would. */
async function botMove(tableId: string): Promise<boolean> {
  const [row] = await ctx.db.select().from(d).where(and(eq(d.tableId, tableId), eq(d.status, 'pending'), eq(d.deadlineKey, 'bot')));
  if (!row) return false;
  await makeDue(ctx, row.id);
  expect(await fireDeadline(ctx.db, createDefaultRegistry(), row.id)).toBe('fired');
  return true;
}

type Snap = Awaited<ReturnType<typeof view>>;
const firstLegal = (s: Snap) => s.game.legalActions.find((a: { type: string }) => a.type !== 'resign');

/** Human plays `choose` (default: first legal non-resign action); bots answer through their deadline. Returns the final snapshot. */
async function playToEnd(u: User, tableId: string, choose: (s: Snap) => unknown = firstLegal) {
  for (let i = 0; i < 600; i++) {
    const s = await view(ctx, u, tableId);
    if (s.table.status !== 'active') return s;
    if (s.game.pendingSeats.includes(s.table.mySeat)) {
      const action = choose(s);
      expect((await command(ctx, u, tableId, s.game.revision, action)).json().status).toBe('accepted');
    } else {
      expect(await botMove(tableId)).toBe(true);
    }
  }
  throw new Error('game did not finish');
}

describe('play against bots', () => {
  it('catalog flags which games ship a bot', async () => {
    const flag = async (id: string) => (await call(ctx, 'GET', `/api/games/${id}`)).json().botAvailable;
    expect(await flag('chess')).toBe(true);
    expect(await flag('othello')).toBe(true);
    expect(await flag('go')).toBe(false);
    const list = (await call(ctx, 'GET', '/api/games')).json().items as { id: string; botAvailable: boolean }[];
    expect(list.every((g) => typeof g.botAvailable === 'boolean')).toBe(true);
  });

  it('starts a friendly table with a labelled bot; the bot moves through the worker; reduced XP, no rating', async () => {
    const [u] = await users(ctx, 1);
    const res = await botTable(u!, { gameId: 'line-three', level: 'hard' });
    expect(res.statusCode).toBe(201);
    const tableId = res.json().id;
    const s = await view(ctx, u!, tableId);
    expect(s.table).toMatchObject({ status: 'active', competition: 'friendly', visibility: 'private', mySeat: 0, settings: { bot: { level: 'hard' } } });
    expect(s.table.seats[1]).toMatchObject({ seat: 1, kind: 'bot', user: null, bot: { level: 'hard' } });
    expect(BOT_PERSONAS).toContainEqual({ nameFa: s.table.seats[1].bot.nameFa, avatarKey: s.table.seats[1].bot.avatarKey, style: s.table.seats[1].bot.style });

    const end = await playToEnd(u!, tableId);
    expect(end.table.status).toBe('finished');
    // A naive human (always the first free cell) never beats the hard bot.
    expect(end.game.result.placements.find((p: { seat: number }) => p.seat === 1).place).toBe(1);

    await runOutbox(ctx.db);
    const rows = await ctx.db.select().from(rewardLedger).where(eq(rewardLedger.userId, u!.id));
    expect(rows.map((r) => [r.ruleId, r.amount])).toEqual([['xp.bot_match', 6]]);
    expect(await ctx.db.select().from(ratingHistory).where(eq(ratingHistory.userId, u!.id))).toHaveLength(0);
  });

  it('first place against a bot earns the reduced win bonus too', async () => {
    const [u] = await users(ctx, 1);
    const tableId = (await botTable(u!, { gameId: 'line-three', level: 'easy' })).json().id;
    // Easy bots blunder: the human may win; regardless, only bot rule ids are ever written.
    const end = await playToEnd(u!, tableId);
    await runOutbox(ctx.db);
    const rows = await ctx.db.select().from(rewardLedger).where(eq(rewardLedger.userId, u!.id));
    const won = end.game.result.placements.find((p: { seat: number }) => p.seat === 0).place === 1
      && end.game.result.placements.some((p: { place: number }) => p.place > 1);
    expect(rows.map((r) => [r.ruleId, r.amount])).toEqual(won ? [['xp.bot_match', 6], ['xp.bot_win', 3]] : [['xp.bot_match', 6]]);
  });

  it('refuses games without a bot and cancels the player\'s queued ticket when a bot game starts', async () => {
    const [u] = await users(ctx, 1);
    expect((await botTable(u!, { gameId: 'go', level: 'easy' })).json().errorCode).toBe('BOT_NOT_AVAILABLE');
    expect((await call(ctx, 'POST', '/api/matchmaking/tickets', u, { gameId: 'chess', pace: 'live', playerCount: 2, turnSeconds: 60 })).statusCode).toBe(201);
    expect((await botTable(u!, { gameId: 'chess', level: 'medium' })).statusCode).toBe(201);
    const [t] = await ctx.db.select().from(matchmakingTickets).where(eq(matchmakingTickets.userId, u!.id));
    expect(t!.status).toBe('cancelled');
    // One live table at a time still applies.
    expect((await botTable(u!, { gameId: 'othello', level: 'easy' })).json().errorCode).toBe('ALREADY_IN_LIVE_TABLE');
  });

  it('multi-player bot tables: the human sits with several bots, each with its own persona', async () => {
    const [u] = await users(ctx, 1);
    const tableId = (await botTable(u!, { gameId: 'snakes-ladders', level: 'easy', playerCount: 4 })).json().id;
    const s = await view(ctx, u!, tableId);
    const names = s.table.seats.slice(1).map((x: { bot: { nameFa: string } }) => x.bot.nameFa);
    expect(s.table.seats.map((x: { kind: string }) => x.kind)).toEqual(['human', 'bot', 'bot', 'bot']);
    expect(new Set(names).size).toBe(3); // distinct personas at one table
    expect(s.table.settings.bot.personas).toHaveLength(3);
    expect((await playToEnd(u!, tableId)).table.status).toBe('finished');
  });

  it('friendly multi-player queues: after the wait, matched players start with bots in the empty seats', async () => {
    const [a, b] = await users(ctx, 2);
    for (const u of [a!, b!]) {
      expect((await call(ctx, 'POST', '/api/matchmaking/tickets', u, { gameId: 'snakes-ladders', pace: 'live', playerCount: 4, turnSeconds: 60 })).statusCode).toBe(201);
    }
    const ids = [a!.id, b!.id];
    const mine = sql`${matchmakingTickets.userId} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;
    expect((await ctx.db.select().from(matchmakingTickets).where(mine)).every((t) => t.status === 'queued')).toBe(true);
    await ctx.db.update(matchmakingTickets).set({ createdAt: sql`now() - interval '2 minutes'` }).where(mine);
    await runMatchmaking(ctx.db, defaultMatchConfig, createDefaultRegistry());
    const tickets = await ctx.db.select().from(matchmakingTickets).where(mine);
    expect(tickets.every((t) => t.status === 'matched')).toBe(true);
    const tableId = tickets[0]!.matchedTableId!;
    const seats = await ctx.db.select().from(participants).where(eq(participants.tableId, tableId)).orderBy(participants.seat);
    expect(seats.map((x) => x.kind)).toEqual(['human', 'human', 'bot', 'bot']);
    const [table] = await ctx.db.select().from(gameTables).where(eq(gameTables.id, tableId));
    expect(table!.settings).toMatchObject({ bot: { level: 'medium' } });
    expect((table!.settings as { bot: { personas: number[] } }).bot.personas).toHaveLength(2);
    for (const u of [a!, b!]) await call(ctx, 'POST', `/api/tables/${tableId}/ready`, u, { ready: true });
    expect((await view(ctx, a!, tableId)).table.status).toBe('active');
  });

  it('never fills ranked queues or a lone player with bots', async () => {
    const [a] = await users(ctx, 1);
    await call(ctx, 'POST', '/api/matchmaking/tickets', a, { gameId: 'snakes-ladders', pace: 'live', playerCount: 3, turnSeconds: 60 });
    await ctx.db.update(matchmakingTickets).set({ createdAt: sql`now() - interval '2 minutes'` }).where(eq(matchmakingTickets.userId, a!.id));
    await runMatchmaking(ctx.db, defaultMatchConfig, createDefaultRegistry());
    const [t] = await ctx.db.select().from(matchmakingTickets).where(eq(matchmakingTickets.userId, a!.id));
    expect(t!.status).toBe('queued');
  });

  it('battleship: the bot places its fleet alongside the human and fires from its own view', async () => {
    const [u] = await users(ctx, 1);
    const tableId = (await botTable(u!, { gameId: 'battleship', level: 'hard' })).json().id;
    const end = await playToEnd(u!, tableId, (s) => {
      if (s.game.legalActions.some((a: { type: string }) => a.type === 'placeRandom')) return { type: 'placeRandom' };
      const shots = new Set(s.game.view.seas[1 - s.table.mySeat].shots.map((x: { cell: number }) => x.cell));
      return { type: 'fire', cell: [...Array(100).keys()].find((c) => !shots.has(c)) };
    });
    expect(end.table.status).toBe('finished');
    expect(end.game.result.reason).toBe('win');
  });

  it('camel-up: one human and two bots (hidden overall bets) play to the end', async () => {
    const [u] = await users(ctx, 1);
    const tableId = (await botTable(u!, { gameId: 'camel-up', level: 'medium', playerCount: 3 })).json().id;
    const end = await playToEnd(u!, tableId, () => ({ type: 'roll' }));
    expect(end.table.status).toBe('finished');
    expect(end.game.result.reason).toBe('score');
  });

  it('6 nimmt!: bots choose cards simultaneously with the human and the game reaches a result', async () => {
    const [u] = await users(ctx, 1);
    const tableId = (await botTable(u!, { gameId: 'six-nimmt', level: 'hard', playerCount: 3 })).json().id;
    const end = await playToEnd(u!, tableId);
    expect(end.table.status).toBe('finished');
    expect(end.game.result.reason).toBe('score');
  });

  it('Love Letter: a 3-player game with targeted cards against bots reaches a result', async () => {
    const [u] = await users(ctx, 1);
    const tableId = (await botTable(u!, { gameId: 'love-letter', level: 'medium', playerCount: 3 })).json().id;
    const end = await playToEnd(u!, tableId, (s) => {
      const hint = s.game.legalActions.find((a: { type: string; card?: number }) => a.type === 'play' && a.card !== 8)
        ?? s.game.legalActions.find((a: { type: string }) => a.type === 'play');
      const target = (hint.targets as number[])[0];
      return { type: 'play', card: hint.card, ...(target !== undefined ? { target } : {}), ...(hint.card === 1 && target !== undefined ? { guess: 2 } : {}) };
    });
    expect(end.table.status).toBe('finished');
  });
});
