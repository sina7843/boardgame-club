import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { schema } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { coinBalance, directEncounter, fideRank, fideStats, firstMover, groupSizes, notifyCheckins, runDueDeadlines, runOutbox, runTournaments, swissPairing, tablePoints, tiebreaks, toNotificationItem, type PlayerRecord, type SwissPlayer } from '@bg/play';
import { grantRole, setup, type TestCtx } from './helpers.ts';
import { call, command, makeDue, pendingDeadline, users, view, type User } from './play-helpers.ts';

let ctx: TestCtx;
let admin: User;
const registry = createDefaultRegistry();
const { tournaments, tournamentEntries, tournamentTables, tournamentRefunds, coinLedger, entitlements, notifications } = schema;

beforeAll(async () => {
  ctx = await setup();
  [admin] = await users(ctx, 1) as [User];
  await grantRole(ctx.db, admin.mobile, 'admin');
});
afterAll(async () => { await ctx.close(); });

const soon = () => new Date(Date.now() + 3600_000).toISOString();
const base = {
  gameId: 'line-three', titleFa: 'جام سه‌خطی', format: 'swiss', pace: 'live', turnSeconds: 60, tableSize: 2, rounds: 2,
  minEntrants: 2, maxEntrants: 8, entryKind: 'free', entryAmount: 0, prizes: [{ place: 1, coins: 100, premiumDays: 3 }]
};
async function create(over: Record<string, unknown> = {}) {
  const r = await call(ctx, 'POST', '/api/admin/tournaments', admin, { ...base, startsAt: soon(), ...over });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().id as string;
}
const startNow = async (id: string) => {
  await ctx.db.update(tournaments).set({ startsAt: sql`now() - interval '1 second'` }).where(eq(tournaments.id, id));
  return runTournaments(ctx.db, registry);
};
const give = (userId: string, amount: number) => ctx.db.insert(coinLedger).values({ userId, amount, ruleId: 'test', reason: 'test', sourceKey: `test:${randomUUID()}` });
const detail = async (id: string, u?: User) => (await call(ctx, 'GET', `/api/tournaments/${id}`, u)).json();
const roundTables = (id: string, round: number) => ctx.db.select().from(tournamentTables).where(sql`${tournamentTables.tournamentId} = ${id} and ${tournamentTables.round} = ${round}`);

/** Everyone at the table readies (the table starts), then the first player to move wins line-three. */
async function playOut(tableId: string, ps: User[]) {
  for (const p of ps) await call(ctx, 'POST', `/api/tables/${tableId}/ready`, p, { ready: true });
  let s = await view(ctx, ps[0]!, tableId);
  const seatUser = (seat: number) => ps.find((p) => p.id === s.table.seats.find((x: { seat: number; user: { id: string } }) => x.seat === seat).user.id)!;
  for (const cell of [0, 3, 1, 4, 2]) s = (await command(ctx, seatUser(s.game.pendingSeats[0]), tableId, s.game.revision, { type: 'place', cell })).json().snapshot;
  expect(s.game.status ?? 'finished').toBeTruthy();
}

describe('pure helpers', () => {
  it('groups players evenly, never below the game minimum, with byes only when unavoidable', () => {
    expect(groupSizes(8, 4, 2)).toEqual({ sizes: [4, 4], byes: 0 });
    expect(groupSizes(7, 4, 3)).toEqual({ sizes: [4, 3], byes: 0 });
    expect(groupSizes(5, 2, 2)).toEqual({ sizes: [2, 2], byes: 1 });
    expect(groupSizes(5, 4, 4)).toEqual({ sizes: [4], byes: 1 });
    expect(groupSizes(1, 2, 2)).toEqual({ sizes: [], byes: 1 });
  });
  it('scores beaten + half tied over opponents; absent players score 0', () => {
    const s = tablePoints([{ userId: 'a', place: 1 }, { userId: 'b', place: 2 }, { userId: 'c', place: 2 }, { userId: 'd', place: 4 }], ['d']);
    expect(s.get('a')).toEqual({ points: 1, won: true, rank: 1 });
    expect(s.get('b')!.points).toBeCloseTo(0.5);
    expect(s.get('d')!.points).toBe(0);
    const draw = tablePoints([{ userId: 'a', place: 1 }, { userId: 'b', place: 1 }], []);
    expect(draw.get('a')).toEqual({ points: 0.5, won: false, rank: 1 });
  });
});

const sp = (id: string, points: number, over: Partial<SwissPlayer> = {}): SwissPlayer => ({ id, points, opponents: new Set(), byes: 0, first: 0, second: 0, ...over });

describe('swiss pairing', () => {
  it('pairs equal scores, top half against bottom half', () => {
    const { pairs, bye } = swissPairing([sp('a', 1), sp('b', 1), sp('c', 1), sp('d', 1), sp('e', 0), sp('f', 0)]);
    expect(bye).toBeNull();
    expect(pairs.map(([x, y]) => [x.id, y.id])).toEqual([['a', 'c'], ['b', 'd'], ['e', 'f']]);
  });
  it('never repeats a pairing when another exists, even if that means leaving the score group', () => {
    const { pairs } = swissPairing([sp('a', 1, { opponents: new Set(['b']) }), sp('b', 1, { opponents: new Set(['a']) }), sp('c', 0), sp('d', 0)]);
    expect(pairs.map(([x, y]) => [x.id, y.id].sort().join(''))).toEqual(['ac', 'bd']);
  });
  it('gives the bye to the lowest player who has none, and moves it up to avoid a rematch', () => {
    expect(swissPairing([sp('a', 2), sp('b', 1), sp('c', 0)]).bye!.id).toBe('c');
    expect(swissPairing([sp('a', 2), sp('b', 1), sp('c', 0, { byes: 1 })]).bye!.id).toBe('b');
    const r = swissPairing([sp('a', 2, { opponents: new Set(['b']) }), sp('b', 1, { opponents: new Set(['a']) }), sp('c', 0)]);
    expect(r.bye!.id).not.toBe('c'); // c is last, but a and b have met: one of them sits out instead
  });
  it('is complete even when only rematches are left', () => {
    const { pairs } = swissPairing([sp('a', 1, { opponents: new Set(['b']) }), sp('b', 1, { opponents: new Set(['a']) })]);
    expect(pairs).toHaveLength(1);
  });
  it('first move goes to whoever has had it less', () => {
    expect(firstMover(sp('a', 0, { first: 2 }), sp('b', 0, { second: 1 }))[0].id).toBe('b');
    expect(firstMover(sp('a', 0, { second: 1 }), sp('b', 0, { first: 1 }))[0].id).toBe('a');
  });
  it('Buchholz sums opponents points, Sonneborn-Berger weights them by the result', () => {
    const pts = new Map([['a', 2], ['b', 1], ['c', 0]]);
    const tb = tiebreaks([
      { placements: [{ userId: 'a', place: 1 }, { userId: 'b', place: 2 }] },
      { placements: [{ userId: 'a', place: 1 }, { userId: 'c', place: 1 }] }
    ], pts);
    expect(tb.get('a')).toEqual({ buchholz: 1, sonnebornBerger: 1 });
    expect(tb.get('b')).toEqual({ buchholz: 2, sonnebornBerger: 0 });
    expect(tb.get('c')).toEqual({ buchholz: 2, sonnebornBerger: 1 });
  });
});

describe('FIDE ranking (Tie-Break Regulations C.07)', () => {
  const g = (id: string, ...rounds: [number, 'played' | 'bye' | 'forfeitWin' | 'forfeitLoss' | 'requestedBye', number, string | null, ('first' | 'second')?][]): PlayerRecord =>
    ({ id, rounds: rounds.map(([round, kind, result, opponent, side]) => ({ round, kind, result, opponent, side: side ?? null })) });

  it('equal points: Buchholz Cut-1 first (lowest opponent dropped), then Buchholz, Sonneborn-Berger', () => {
    const players = [
      g('u', [1, 'bye', 1, null], [2, 'bye', 1, null], [3, 'bye', 1, null]), // 3 points
      g('s', [1, 'bye', 1, null], [2, 'bye', 1, null]), // 2
      g('p', [1, 'played', 1, 'u'], [2, 'played', 0, 'z']), // 1 point, opponents 3 and 0: BH 3, cut-1 3
      g('q', [1, 'played', 1, 's'], [2, 'played', 0, 't']), // 1 point, opponents 2 and 1: BH 3, cut-1 2
      g('t', [1, 'bye', 1, null]), // 1 point
      g('z')
    ];
    const st = fideStats(players, 3);
    expect(st.get('p')).toMatchObject({ points: 1, buchholz: 3, buchholzCut1: 3 });
    expect(st.get('q')).toMatchObject({ points: 1, buchholz: 3, buchholzCut1: 2 });
    expect(fideRank(players, 3)).toEqual([['u'], ['s'], ['p'], ['q'], ['t'], ['z']]);
  });

  it('a cycle of wins gives no direct-encounter split: the players share the rank', () => {
    const players = [
      g('a', [1, 'played', 1, 'c'], [2, 'played', 1, 'd'], [3, 'played', 0, 'b']),
      g('b', [1, 'played', 1, 'd'], [2, 'played', 0, 'c'], [3, 'played', 1, 'a']),
      g('c', [1, 'played', 0, 'a'], [2, 'played', 1, 'b'], [3, 'played', 1, 'd']),
      g('d', [1, 'played', 0, 'b'], [2, 'played', 0, 'a'], [3, 'played', 0, 'c'])
    ];
    const groups = fideRank(players, 3);
    expect(groups).toHaveLength(2);
    expect([...groups[0]!].sort()).toEqual(['a', 'b', 'c']);
    expect(groups[1]).toEqual(['d']);
  });

  it('direct encounter ranks the tied players who met; forfeits and unmet pairs are not counted', () => {
    const map = (...ps: PlayerRecord[]) => new Map(ps.map((p) => [p.id, p]));
    expect(directEncounter(['x', 'y'], map(g('x', [1, 'played', 1, 'y']), g('y', [1, 'played', 0, 'x'])))).toEqual([['x'], ['y']]);
    expect(directEncounter(['x', 'y'], map(g('x', [1, 'forfeitWin', 1, 'y']), g('y', [1, 'forfeitLoss', 0, 'x'])))).toEqual([['x', 'y']]);
    expect(directEncounter(['x', 'y'], map(g('x'), g('y')))).toEqual([['x', 'y']]);
  });

  it('ARO (rating of the opponents actually played) comes after Buchholz, and only when every player has a rating', () => {
    const players = [
      g('p', [1, 'played', 1, 'a']), g('q', [1, 'played', 1, 'b']),
      g('a', [1, 'played', 0, 'p']), g('b', [1, 'played', 0, 'q'])
    ];
    const rated = new Map([['p', 1500], ['q', 1500], ['a', 1000], ['b', 1801]]);
    expect(fideStats(players, 1, rated).get('q')!.aro).toBe(1801);
    expect(fideRank(players, 1, rated).slice(0, 2)).toEqual([['q'], ['p']]);
    expect(fideRank(players, 1).slice(0, 1)).toEqual([['p', 'q']]); // no ratings: tied
    const partial = new Map([['p', 1500], ['q', 1500], ['a', 1000]]); // b unrated: criterion dropped for everyone
    expect(fideStats(players, 1, partial).get('q')!.aro).toBeNull();
    expect(fideRank(players, 1, partial).slice(0, 1)).toEqual([['p', 'q']]);
    // rounded half up
    expect(fideStats([g('x', [1, 'played', 1, 'y'], [2, 'played', 1, 'z']), g('y'), g('z')], 2, new Map([['x', 0], ['y', 1000], ['z', 1001]])).get('x')!.aro).toBe(1001);
  });

  it('wins with Black are the last criterion; players still tied share the group', () => {
    const same = [
      g('m', [1, 'played', 1, 'n', 'second'], [2, 'played', 0, 'n', 'first']),
      g('n', [1, 'played', 0, 'm', 'first'], [2, 'played', 1, 'm', 'second'])
    ];
    expect(fideStats(same, 2).get('m')).toMatchObject({ wins: 1, blackWins: 1 });
    expect(fideRank(same, 2)).toEqual([['m', 'n']]);
    const black = [
      g('b', [1, 'played', 1, 'w', 'second'], [2, 'played', 0, 'w', 'first']),
      g('w', [1, 'played', 0, 'b', 'first'], [2, 'played', 1, 'b', 'second'])
    ];
    expect(fideStats(black, 2).get('b')!.blackWins).toBe(1);
  });
});

describe('admin rating', () => {
  it('sets a rating for a game the player never played; keeps certainty; audited', async () => {
    const [u] = await users(ctx, 1);
    const set = (body: object, who = admin) => call(ctx, 'POST', '/api/admin/ratings', who, { userId: u!.id, gameId: 'chess', mode: 'live', reason: 'سید مسابقه', ...body });
    expect((await set({ rating: 1800 }, u!)).statusCode).toBe(403);
    expect((await set({ rating: 5000 })).statusCode).toBe(400);
    expect((await set({ rating: 1800, gameId: 'no-such-game' })).json().errorCode).toBe('NOT_FOUND');
    expect((await set({ rating: 1800 })).json()).toEqual({ before: null, after: 1800 });
    expect((await set({ rating: 1650 })).json()).toEqual({ before: 1800, after: 1650 });
    const rows = (await call(ctx, 'GET', `/api/admin/users/${u!.id}/ratings`, admin)).json().items;
    expect(rows).toEqual([expect.objectContaining({ gameId: 'chess', mode: 'live', rating: 1650, sigma: 5, gamesPlayed: 0 })]);
    expect((await call(ctx, 'GET', `/api/admin/users/${u!.id}/ratings`, u)).statusCode).toBe(403);
    const log = await ctx.db.select().from(schema.auditLog).where(sql`${schema.auditLog.action} = 'rating.set' and ${schema.auditLog.targetId} = ${u!.id}`);
    expect(log).toHaveLength(2);
  });
});

describe('admin', () => {
  it('only admins create; settings are checked against the game', async () => {
    const [u] = await users(ctx, 1);
    expect((await call(ctx, 'POST', '/api/admin/tournaments', u, { ...base, startsAt: soon() })).statusCode).toBe(403);
    const bad = async (over: object) => (await call(ctx, 'POST', '/api/admin/tournaments', admin, { ...base, startsAt: soon(), ...over })).json().errorCode;
    expect(await bad({ tableSize: 3 })).toBe('TOURNAMENT_SETTINGS_INVALID'); // line-three is two-player
    expect(await bad({ format: 'knockout', advance: 2 })).toBe('TOURNAMENT_SETTINGS_INVALID');
    expect(await bad({ entryKind: 'coins', entryAmount: 0 })).toBe('TOURNAMENT_SETTINGS_INVALID');
    expect(await bad({ startsAt: new Date(Date.now() - 1000).toISOString() })).toBe('TOURNAMENT_SETTINGS_INVALID');
    expect(await bad({ turnSeconds: 7 })).toBe('INVALID_TIME_SETTING');
  });
});

describe('swiss', () => {
  it('runs rounds from finished tables, ranks by points and pays the prize once', async () => {
    const id = await create();
    const ps = await users(ctx, 4);
    for (const p of ps) expect((await call(ctx, 'POST', `/api/tournaments/${id}/register`, p)).statusCode).toBe(204);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/register`, ps[0])).json().errorCode).toBe('ALREADY_REGISTERED');
    expect((await detail(id, ps[0])).me.registered).toBe(true);

    expect(await startNow(id)).toMatchObject({ started: 1 });
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/register`, admin)).json().errorCode).toBe('TOURNAMENT_NOT_OPEN');
    for (const round of [1, 2]) {
      const tables = await roundTables(id, round);
      expect(tables).toHaveLength(2);
      for (const t of tables) await playOut(t.tableId, t.seats.map((s) => ps.find((p) => p.id === s.userId)!));
      await runTournaments(ctx.db, registry);
    }
    const d = await detail(id);
    expect(d.status).toBe('finished');
    expect(d.roundCount).toBe(2);
    expect(d.roundsPlayed).toHaveLength(1); // one round at a time (?round=)
    expect((await detail(`${id}?round=1`)).roundsPlayed[0].round).toBe(1);
    expect(d.standings.reduce((s: number, x: { points: number }) => s + x.points, 0)).toBe(4); // one point per table
    const champs = d.standings.filter((x: { finalRank: number }) => x.finalRank === 1);
    expect(champs.length).toBeGreaterThanOrEqual(1);
    for (const c of champs) {
      expect(c.points).toBe(2);
      const prize = await ctx.db.select().from(coinLedger).where(eq(coinLedger.sourceKey, `tournament-prize:${id}:${c.player.id}`));
      expect(prize[0]?.amount).toBe(100);
      expect((await ctx.db.select().from(entitlements).where(eq(entitlements.userId, c.player.id))).map((e) => e.source)).toEqual(['tournament']);
    }
    expect(await runTournaments(ctx.db, registry)).toMatchObject({ finished: 0 }); // nothing runs twice
    await runOutbox(ctx.db);
    const n = await ctx.db.select().from(notifications).where(eq(notifications.userId, ps[0]!.id));
    expect(n.some((x) => x.kind === 'tournament')).toBe(true);
  });
});

describe('spectators', () => {
  it('anyone signed in can watch a tournament table (spectator projection, no join) and find it in the live list', async () => {
    const id = await create();
    const ps = await users(ctx, 2);
    for (const p of ps) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    const [tt] = await roundTables(id, 1);
    const [watcher] = await users(ctx, 1);
    for (const p of ps) await call(ctx, 'POST', `/api/tables/${tt!.tableId}/ready`, p, { ready: true });
    const s = await view(ctx, watcher!, tt!.tableId);
    expect(s.table.mySeat).toBeNull();
    expect(s.game.legalActions).toEqual([]);
    expect(s.table.inviteCode).toBeNull();
    expect((await call(ctx, 'POST', `/api/tables/${tt!.tableId}/join`, watcher, {})).json().errorCode).toBe('INVITE_REQUIRED');
    // Spectators read the table chat but cannot post.
    const chat = await call(ctx, 'GET', `/api/tables/${tt!.tableId}/chat`, watcher);
    expect(chat.statusCode).toBe(200);
    expect(chat.json().canPost).toBe(false);
    const live = (await call(ctx, 'GET', '/api/tables/live', watcher)).json().items;
    expect(live.find((t: { id: string }) => t.id === tt!.tableId)).toMatchObject({ tournament: { id, round: 1 }, players: expect.any(Array) });
  });
});

describe('absence', () => {
  it('a no-show is replaced by a bot (0 points) and knocked out', async () => {
    const id = await create({ format: 'knockout', rounds: undefined, advance: 1 });
    const [a, b] = await users(ctx, 2);
    for (const p of [a!, b!]) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    const [t] = await roundTables(id, 1);
    await call(ctx, 'POST', `/api/tables/${t!.tableId}/ready`, a, { ready: true }); // b never comes
    expect((await call(ctx, 'POST', `/api/tables/${t!.tableId}/leave`, a)).statusCode).toBe(403);
    await makeDue(ctx, (await pendingDeadline(ctx, t!.tableId, 'ready'))!.id);
    await runDueDeadlines(ctx.db, registry);
    const [row] = await ctx.db.select().from(tournamentTables).where(eq(tournamentTables.tableId, t!.tableId));
    expect(row!.absent).toEqual([b!.id]);
    expect(row!.placements).toEqual([{ userId: a!.id, place: 1 }, { userId: b!.id, place: 2 }]); // forfeit, no bot to beat
    await runTournaments(ctx.db, registry);
    const d = await detail(id);
    expect(d.status).toBe('finished');
    expect(d.standings.find((x: { player: { id: string } }) => x.player.id === b!.id).noShows).toBe(1);
    expect(d.standings.find((x: { player: { id: string } }) => x.player.id === a!.id)).toMatchObject({ finalRank: 1, points: 1 });
  });

  it('head-to-head: a move clock that runs out is the game own timeout, not a bot takeover', async () => {
    const id = await create({ rounds: 1 });
    const [a, b] = await users(ctx, 2);
    for (const p of [a!, b!]) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    const [t] = await roundTables(id, 1);
    for (const p of [a!, b!]) await call(ctx, 'POST', `/api/tables/${t!.tableId}/ready`, p, { ready: true });
    await makeDue(ctx, (await pendingDeadline(ctx, t!.tableId, 'turn'))!.id);
    await runDueDeadlines(ctx.db, registry);
    const [row] = await ctx.db.select().from(tournamentTables).where(eq(tournamentTables.tableId, t!.tableId));
    expect(row!.absent).toEqual([]);
    const s = await view(ctx, a!, t!.tableId);
    expect(s.table.seats.filter((x: { kind: string }) => x.kind === 'bot')).toHaveLength(0);
  });

  it('without a bot, the player who came wins by forfeit', async () => {
    const id = await create({ gameId: 'sealed-bids', rounds: 1 });
    const [a, b] = await users(ctx, 2);
    for (const p of [a!, b!]) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    const [t] = await roundTables(id, 1);
    await call(ctx, 'POST', `/api/tables/${t!.tableId}/ready`, b, { ready: true });
    await makeDue(ctx, (await pendingDeadline(ctx, t!.tableId, 'ready'))!.id);
    await runDueDeadlines(ctx.db, registry);
    await runTournaments(ctx.db, registry);
    const d = await detail(id);
    expect(d.status).toBe('finished');
    expect(d.standings[0]).toMatchObject({ player: { id: b!.id }, points: 1, finalRank: 1 });
    expect(d.roundsPlayed[0].tables[0].players.find((x: { player: { id: string } }) => x.player.id === a!.id).absent).toBe(true);
  });
});

describe('entry fees', () => {
  it('coins: checked, debited once, returned on withdrawal and on a cancelled start', async () => {
    const id = await create({ entryKind: 'coins', entryAmount: 50, minEntrants: 3 });
    const [a, b] = await users(ctx, 2);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/register`, a)).json().errorCode).toBe('INSUFFICIENT_COINS');
    await give(a!.id, 120);
    await give(b!.id, 50);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/register`, a)).statusCode).toBe(204);
    expect(await coinBalance(ctx.db, a!.id)).toBe(70);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/withdraw`, a)).statusCode).toBe(204);
    expect(await coinBalance(ctx.db, a!.id)).toBe(120);
    await call(ctx, 'POST', `/api/tournaments/${id}/register`, a);
    await call(ctx, 'POST', `/api/tournaments/${id}/register`, b);
    expect(await coinBalance(ctx.db, b!.id)).toBe(0);
    expect(await startNow(id)).toMatchObject({ cancelled: 1 }); // 2 of 3 needed
    expect(await coinBalance(ctx.db, a!.id)).toBe(120);
    expect(await coinBalance(ctx.db, b!.id)).toBe(50);
    expect((await detail(id)).status).toBe('cancelled');
  });

  it('Toman: registers only after the verified payment; a gone seat goes to the refund queue an admin settles', async () => {
    const id = await create({ entryKind: 'toman', entryAmount: 500_000, maxEntrants: 2, rounds: 1 });
    const [a, b, c] = await users(ctx, 3);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/register`, a)).json().errorCode).toBe('TOURNAMENT_PAY_ONLINE');
    const pay = async (u: User) => {
      const r = await call(ctx, 'POST', `/api/tournaments/${id}/checkout`, u);
      expect(r.statusCode, r.body).toBe(200);
      const authority = new URL(r.json().redirectUrl).searchParams.get('authority')!;
      return async () => {
        await call(ctx, 'POST', `/api/payments/fake/${authority}/decision`, u, { decision: 'paid' });
        await ctx.app.inject({ method: 'GET', url: `/api/payments/callback?provider=fake&authority=${encodeURIComponent(authority)}` });
        return r.json().orderId as string;
      };
    };
    const payA = await pay(a!), payB = await pay(b!), payC = await pay(c!);
    expect((await detail(id, a)).me.registered).toBe(false);
    const orderA = await payA();
    expect((await call(ctx, 'GET', `/api/payments/${orderA}`, a)).json()).toMatchObject({ status: 'verified', kind: 'tournament', planTitleFa: 'جام سه‌خطی' });
    expect((await detail(id, a)).me.registered).toBe(true);
    await payB();
    await payC(); // full by now: paid, not registered, refund queued
    expect((await detail(id, c)).me).toMatchObject({ registered: false, refundStatus: 'pending' });
    const q = (await call(ctx, 'GET', '/api/admin/tournament-refunds?status=pending', admin)).json().items;
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ userId: c!.id, amount: 500_000 });
    expect((await call(ctx, 'GET', '/api/admin/tournament-refunds', c)).statusCode).toBe(403);
    expect((await call(ctx, 'POST', `/api/admin/tournament-refunds/${q[0].id}/paid`, admin, { note: 'کارت‌به‌کارت ۱۲۳' })).statusCode).toBe(204);
    expect((await detail(id, c)).me.refundStatus).toBe('paid');
    // Admin cancel: both paid entries queue for refund.
    expect((await call(ctx, 'POST', `/api/admin/tournaments/${id}/cancel`, admin, { reason: 'آزمایش لغو' })).statusCode).toBe(204);
    expect((await ctx.db.select().from(tournamentRefunds).where(eq(tournamentRefunds.tournamentId, id)))).toHaveLength(3);
    expect((await ctx.db.select().from(tournamentEntries).where(eq(tournamentEntries.tournamentId, id)))).toHaveLength(2);
  });
});

describe('swiss rounds', () => {
  it('all-play-all in 3 rounds: nobody meets twice, colours alternate for chess, options reach the tables', async () => {
    const id = await create({ gameId: 'chess', rounds: 3, options: { clock: '10+0' }, turnSeconds: 60, pace: 'live' });
    expect((await detail(id)).options).toMatchObject({ clock: '10+0', firstMove: 'host', minDrawMove: 'none', drawRule: 'auto' });
    const ps = await users(ctx, 4);
    for (const p of ps) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    const met = new Set<string>();
    const first = new Map<string, number>();
    for (const round of [1, 2, 3]) {
      const tables = await roundTables(id, round);
      expect(tables).toHaveLength(2);
      for (const t of tables) {
        const [a, b] = t.seats.map((s) => s.userId).sort();
        expect(met.has(`${a}${b}`)).toBe(false);
        met.add(`${a}${b}`);
        first.set(t.seats[0]!.userId, (first.get(t.seats[0]!.userId) ?? 0) + 1);
        const [gt] = await ctx.db.select().from(schema.gameTables).where(eq(schema.gameTables.id, t.tableId));
        expect(gt!.settings).toMatchObject({ options: { clock: '10+0', firstMove: 'host' } });
        // Shortcut: record the result directly (the chess rules have their own tests).
        await ctx.db.update(tournamentTables).set({ placements: [{ userId: t.seats[0]!.userId, place: 1 }, { userId: t.seats[1]!.userId, place: 2 }] }).where(eq(tournamentTables.tableId, t.tableId));
        await ctx.db.update(schema.gameTables).set({ status: 'cancelled' }).where(eq(schema.gameTables.id, t.tableId));
      }
      await runTournaments(ctx.db, registry);
    }
    expect(met.size).toBe(6);
    const d = await detail(id);
    expect(d.status).toBe('finished');
    expect([...first.values()].every((n) => n <= 2)).toBe(true); // nobody had the first move in all three rounds
    expect(d.standings.every((x: { buchholz: number }) => typeof x.buchholz === 'number')).toBe(true);
  });

  it('a requested bye sits the round out for half a point', async () => {
    const id = await create({ rounds: 3 });
    const ps = await users(ctx, 4);
    for (const p of ps) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/bye`, ps[0], { round: 9, requested: true })).json().errorCode).toBe('TOURNAMENT_BYE_INVALID');
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/bye`, ps[0], { round: 2, requested: true })).statusCode).toBe(204);
    expect((await detail(id, ps[0])).me.requestedByes).toEqual([2]);
    await startNow(id);
    for (const t of await roundTables(id, 1)) await playOut(t.tableId, t.seats.map((s) => ps.find((p) => p.id === s.userId)!));
    await runTournaments(ctx.db, registry);
    const tables = await roundTables(id, 2);
    expect(tables.flatMap((t) => t.seats.map((s) => s.userId))).not.toContain(ps[0]!.id);
    const mine = (await detail(id)).standings.find((x: { player: { id: string } }) => x.player.id === ps[0]!.id);
    expect(mine.points).toBeGreaterThanOrEqual(0.5);
  });

  it('a break between rounds delays the next round', async () => {
    const id = await create({ rounds: 2, roundGapSeconds: 600 });
    const ps = await users(ctx, 4);
    for (const p of ps) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    for (const t of await roundTables(id, 1)) await playOut(t.tableId, t.seats.map((s) => ps.find((p) => p.id === s.userId)!));
    await runTournaments(ctx.db, registry);
    expect((await detail(id)).nextRoundAt).not.toBeNull();
    expect(await roundTables(id, 2)).toHaveLength(0);
    await ctx.db.update(tournaments).set({ nextRoundAt: sql`now() - interval '1 second'` }).where(eq(tournaments.id, id));
    await runTournaments(ctx.db, registry);
    expect(await roundTables(id, 2)).toHaveLength(2);
  });
});

describe('check-in', () => {
  it('opens before the start; players who did not confirm are withdrawn at the start', async () => {
    const id = await create({ checkinMinutes: 30, minEntrants: 2 });
    const ps = await users(ctx, 3);
    for (const p of ps) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/checkin`, ps[0])).json().errorCode).toBe('TOURNAMENT_CHECKIN_CLOSED');
    await ctx.db.update(tournaments).set({ startsAt: sql`now() + interval '10 minutes'` }).where(eq(tournaments.id, id));
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/checkin`, ps[0])).statusCode).toBe(204);
    expect((await call(ctx, 'POST', `/api/tournaments/${id}/checkin`, ps[1])).statusCode).toBe(204);
    expect((await detail(id, ps[0])).me.checkedIn).toBe(true);
    expect(await startNow(id)).toMatchObject({ started: 1 });
    expect((await detail(id)).entrants).toBe(2);
    expect((await detail(id, ps[2])).me.registered).toBe(false);
  });
});

describe('check-in notices', () => {
  it('tells unconfirmed players when the window opens and once more shortly before the start, never twice', async () => {
    const id = await create({ checkinMinutes: 30, minEntrants: 2 });
    const ps = await users(ctx, 3);
    for (const p of ps) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    const setStart = (minutes: number) => ctx.db.update(tournaments).set({ startsAt: sql`now() + make_interval(mins => ${minutes})` }).where(eq(tournaments.id, id));
    const mine = async (u: User) => (await ctx.db.select().from(notifications).where(eq(notifications.userId, u.id))).filter((n) => (n.payload as { tournamentId?: string }).tournamentId === id);

    expect(await notifyCheckins(ctx.db)).toBe(0); // window not open yet (60 minutes to go)
    await setStart(20);
    expect(await notifyCheckins(ctx.db)).toBe(3);
    expect(await notifyCheckins(ctx.db)).toBe(0); // already told
    await call(ctx, 'POST', `/api/tournaments/${id}/checkin`, ps[0]);
    await setStart(4);
    expect(await notifyCheckins(ctx.db)).toBe(2); // the reminder skips the player who confirmed
    expect(await notifyCheckins(ctx.db)).toBe(0);
    await runOutbox(ctx.db);

    const a = await mine(ps[0]!), b = await mine(ps[1]!);
    expect(a).toHaveLength(1);
    expect(b.map((n) => (n.payload as { checkin?: string }).checkin).sort()).toEqual(['closing', 'open']);
    expect(toNotificationItem(b.find((n) => (n.payload as { checkin?: string }).checkin === 'open')!)).toMatchObject({ href: `/tournaments/${id}`, textFa: expect.stringContaining('تأیید حضور') });
  });
});

describe('arbiter', () => {
  it('disqualification forfeits the table, ranks nobody and pays nothing', async () => {
    const id = await create({ rounds: 1 });
    const [a, b] = await users(ctx, 2);
    for (const p of [a!, b!]) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    expect((await call(ctx, 'POST', `/api/admin/tournaments/${id}/disqualify`, a, { userId: a!.id, reason: 'تقلب' })).statusCode).toBe(403);
    expect((await call(ctx, 'POST', `/api/admin/tournaments/${id}/disqualify`, admin, { userId: a!.id, reason: 'استفاده از موتور' })).statusCode).toBe(204);
    expect((await call(ctx, 'POST', `/api/admin/tournaments/${id}/disqualify`, admin, { userId: a!.id, reason: 'دوباره' })).json().errorCode).toBe('PLAYER_DISQUALIFIED');
    await runTournaments(ctx.db, registry);
    const d = await detail(id);
    expect(d.status).toBe('finished');
    expect(d.standings.find((x: { player: { id: string } }) => x.player.id === a!.id)).toMatchObject({ disqualified: true, finalRank: null });
    expect(d.standings[0]).toMatchObject({ player: { id: b!.id }, finalRank: 1, points: 1 });
    expect((await ctx.db.select().from(coinLedger).where(eq(coinLedger.sourceKey, `tournament-prize:${id}:${a!.id}`)))).toHaveLength(0);
  });

  it('an arbiter result replaces the table result; points follow and tied players split the prize', async () => {
    const id = await create({ rounds: 1 });
    const [a, b] = await users(ctx, 2);
    for (const p of [a!, b!]) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    const [t] = await roundTables(id, 1);
    const url = `/api/admin/tournaments/${id}/tables/${t!.tableId}/result`;
    expect((await call(ctx, 'POST', url, admin, { placements: [{ userId: a!.id, place: 1 }], reason: 'ناقص' })).statusCode).toBe(400);
    expect((await call(ctx, 'POST', url, admin, { placements: [{ userId: a!.id, place: 1 }, { userId: b!.id, place: 1 }], reason: 'تساوی با توافق' })).statusCode).toBe(204);
    await runTournaments(ctx.db, registry);
    const d = await detail(id);
    expect(d.status).toBe('finished');
    expect(d.standings.map((x: { points: number }) => x.points)).toEqual([0.5, 0.5]);
    expect(d.roundsPlayed[0].tables[0].overridden).toBe(true);
    expect(d.standings.map((x: { finalRank: number }) => x.finalRank)).toEqual([1, 1]);
    for (const p of [a!, b!]) expect((await ctx.db.select().from(coinLedger).where(eq(coinLedger.sourceKey, `tournament-prize:${id}:${p.id}`)))[0]?.amount).toBe(50);
  });
});

describe('ARO in a tournament', () => {
  const run = async (rated: boolean[]) => {
    const id = await create({ gameId: 'chess', rounds: 1, pace: 'live', turnSeconds: 60, maxEntrants: 8 });
    const ps = await users(ctx, rated.length);
    for (const [i, p] of ps.entries()) {
      await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
      if (rated[i]) expect((await call(ctx, 'POST', '/api/admin/ratings', admin, { userId: p.id, gameId: 'chess', mode: 'live', rating: 1200 + 300 * i, reason: 'سید' })).statusCode).toBe(200);
    }
    await startNow(id);
    for (const t of await roundTables(id, 1)) {
      await ctx.db.update(tournamentTables).set({ placements: [{ userId: t.seats[0]!.userId, place: 1 }, { userId: t.seats[1]!.userId, place: 2 }] }).where(eq(tournamentTables.tableId, t.tableId));
      await ctx.db.update(schema.gameTables).set({ status: 'cancelled' }).where(eq(schema.gameTables.id, t.tableId));
    }
    await runTournaments(ctx.db, registry);
    return { ps, d: await detail(id) };
  };

  it('uses ratings fixed at the start when everyone has one', async () => {
    const { ps, d } = await run([true, true]);
    const of = (u: User) => d.standings.find((x: { player: { id: string } }) => x.player.id === u.id);
    expect(of(ps[0]!)).toMatchObject({ startRating: 1200, aro: 1500 });
    expect(of(ps[1]!)).toMatchObject({ startRating: 1500, aro: 1200 });
  });

  it('is not used when someone is unrated', async () => {
    const { d } = await run([true, false]);
    expect(d.standings.map((x: { aro: number | null }) => x.aro)).toEqual([null, null]);
  });
});

describe('round-1 seeding', () => {
  it('top half of the rating list meets the bottom half; unrated players count as 1500', async () => {
    const id = await create({ gameId: 'chess', rounds: 2, pace: 'live', turnSeconds: 60, maxEntrants: 8 });
    const ps = await users(ctx, 4);
    for (const [i, p] of ps.entries()) {
      await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
      if (i !== 1) await call(ctx, 'POST', '/api/admin/ratings', admin, { userId: p.id, gameId: 'chess', mode: 'live', rating: [1200, 0, 1800, 2100][i], reason: 'سید' });
    }
    await startNow(id); // ranking: 2100 (p3), 1800 (p2), unrated 1500 (p1), 1200 (p0)
    const pairs = (await roundTables(id, 1)).map((t) => t.seats.map((s) => ps.findIndex((p) => p.id === s.userId)).sort().join(''));
    expect(pairs.sort()).toEqual(['02', '13']);
  });
});

describe('game record (PGN)', () => {
  it('only after the game is over (arbiters any time); the tournament bundle is admin only', async () => {
    const id = await create({ gameId: 'chess', rounds: 1, pace: 'live', turnSeconds: 60, options: { clock: '10+0' } });
    const ps = await users(ctx, 2);
    for (const p of ps) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
    await startNow(id);
    const [t] = await roundTables(id, 1);
    for (const p of ps) await call(ctx, 'POST', `/api/tables/${t!.tableId}/ready`, p, { ready: true });
    const white = ps.find((p) => p.id === t!.seats[0]!.userId)!, black = ps.find((p) => p !== white)!;
    const rec = `/api/tables/${t!.tableId}/record`;
    let s = await view(ctx, white, t!.tableId);
    s = (await command(ctx, white, t!.tableId, s.game.revision, { type: 'move', from: 'e2', to: 'e4' })).json().snapshot;
    expect((await call(ctx, 'GET', rec, white)).statusCode).toBe(403); // a running game is not handed out
    expect((await call(ctx, 'GET', rec, admin)).statusCode).toBe(200);
    await command(ctx, black, t!.tableId, s.game.revision, { type: 'resign' });
    const r = await call(ctx, 'GET', rec, black);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.headers['content-disposition']).toContain('.pgn');
    expect(r.body).toContain('[Result "1-0"]');
    expect(r.body).toContain('[TimeControl "600+0"]');
    expect(r.body).toMatch(/1\. e4 \{\[%clk 0:\d\d:\d\d\]\} 1-0/); // the mover's clock after the move
    expect((await call(ctx, 'GET', `/api/admin/tournaments/${id}/games`, white)).statusCode).toBe(403);
    expect((await call(ctx, 'GET', `/api/admin/tournaments/${id}/games`, admin)).body).toContain('1. e4 {[%clk');
  });
});

describe('export', () => {
  it('standings as CSV', async () => {
    const id = await create();
    const [a] = await users(ctx, 1);
    await call(ctx, 'POST', `/api/tournaments/${id}/register`, a);
    const r = await call(ctx, 'GET', `/api/tournaments/${id}/standings.csv`);
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.body).toContain('امتیاز');
  });
});
