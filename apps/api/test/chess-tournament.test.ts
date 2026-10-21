// Chess-focused tournament features: time-class ratings, lag compensation and move times, crosstable / TPR / featured
// boards, fair-play review, and the Armageddon playoff.
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clockClass, ratingModeOf } from '@bg/contracts';
import { schema } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { fairPlayFlags, hiddenTime, moveStats, performanceRating, ratingDifference, runTournaments } from '@bg/play';
import { grantRole, setup, type TestCtx } from './helpers.ts';
import { call, command, users, view, type User } from './play-helpers.ts';

let ctx: TestCtx;
let admin: User;
const registry = createDefaultRegistry();
const { tournaments, tournamentTables, moveTimes, gameTables } = schema;

beforeAll(async () => {
  ctx = await setup();
  [admin] = await users(ctx, 1) as [User];
  await grantRole(ctx.db, admin.mobile, 'admin');
});
afterAll(async () => { await ctx.close(); });

const soon = () => new Date(Date.now() + 3600_000).toISOString();
const base = { gameId: 'chess', titleFa: 'جام شطرنج', format: 'swiss', pace: 'live', turnSeconds: 60, tableSize: 2, rounds: 1, minEntrants: 2, maxEntrants: 8, entryKind: 'free', entryAmount: 0, prizes: [{ place: 1, coins: 100, premiumDays: 0 }] };
async function create(over: Record<string, unknown> = {}) {
  const r = await call(ctx, 'POST', '/api/admin/tournaments', admin, { ...base, startsAt: soon(), ...over });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().id as string;
}
const startNow = async (id: string) => {
  await ctx.db.update(tournaments).set({ startsAt: sql`now() - interval '1 second'` }).where(eq(tournaments.id, id));
  return runTournaments(ctx.db, registry);
};
const detail = async (id: string, u?: User) => (await call(ctx, 'GET', `/api/tournaments/${id}`, u)).json();
const tablesOf = (id: string) => ctx.db.select().from(tournamentTables).where(eq(tournamentTables.tournamentId, id));
async function twoPlayers(id: string) {
  const ps = await users(ctx, 2);
  for (const p of ps) await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
  return ps;
}
/** Start the first round, both players ready; returns the table, white (seat 0) and black. */
async function startRound(id: string, ps: User[]) {
  await startNow(id);
  const [t] = (await tablesOf(id)).filter((x) => !x.playoff);
  for (const p of ps) await call(ctx, 'POST', `/api/tables/${t!.tableId}/ready`, p, { ready: true });
  const white = ps.find((p) => p.id === t!.seats[0]!.userId)!;
  return { t: t!, white, black: ps.find((p) => p !== white)! };
}

describe('rating modes', () => {
  it('a chess clock puts the game in a time class (FIDE estimate: base + 60 x increment)', () => {
    expect(clockClass('1+0')).toBe('bullet');
    expect(clockClass('3+2')).toBe('blitz');
    expect(clockClass('5/4+0')).toBe('blitz');
    expect(clockClass('10+0')).toBe('rapid');
    expect(clockClass('15+10')).toBe('rapid');
    expect(clockClass('90+30')).toBe('classical');
    expect(clockClass('none')).toBeNull();
    expect(ratingModeOf('live', { clock: '3+2' })).toBe('blitz');
    expect(ratingModeOf('live', { clock: 'none' })).toBe('live');
    expect(ratingModeOf('turn', { clock: '3+2' })).toBe('turn');
  });

  it('the tournament seeds and tie-breaks with the rating of its time class', async () => {
    const id = await create({ options: { clock: '3+2' } });
    const ps = await users(ctx, 2);
    for (const [i, p] of ps.entries()) {
      await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
      // A live (no clock) rating must not be used; the blitz rating is.
      await call(ctx, 'POST', '/api/admin/ratings', admin, { userId: p.id, gameId: 'chess', mode: 'live', rating: 2900, reason: 'x y z' });
      expect((await call(ctx, 'POST', '/api/admin/ratings', admin, { userId: p.id, gameId: 'chess', mode: 'blitz', rating: 1400 + 100 * i, reason: 'سید' })).statusCode).toBe(200);
    }
    await startNow(id);
    const d = await detail(id);
    expect(d.standings.map((s: { startRating: number }) => s.startRating).sort()).toEqual([1400, 1500]);
  });
});

describe('clock: lag compensation and move times', () => {
  it('a reported lag is credited within the quota; every move is timed; PGN carries the clocks', async () => {
    const id = await create({ options: { clock: '10+0' } });
    const ps = await twoPlayers(id);
    const { t, white, black } = await startRound(id, ps);
    let s = await view(ctx, white, t.tableId);
    await new Promise((r) => setTimeout(r, 60));
    const mv = (u: User, rev: number, action: object, lagMs?: number) =>
      call(ctx, 'POST', `/api/tables/${t.tableId}/commands`, u, { commandId: randomUUID(), expectedRevision: rev, action, ...(lagMs !== undefined ? { lagMs } : {}) });
    s = (await mv(white, s.game.revision, { type: 'move', from: 'e2', to: 'e4' }, 1000)).json().snapshot;
    await new Promise((r) => setTimeout(r, 60));
    s = (await mv(black, s.game.revision, { type: 'move', from: 'e7', to: 'e5' })).json().snapshot; // no lag reported: charged in full
    const rows = await ctx.db.select().from(moveTimes).where(eq(moveTimes.tableId, t.tableId)).orderBy(moveTimes.revision);
    expect(rows).toHaveLength(2);
    // White: the whole 60+ ms is forgiven (quota 1500), so the clock still shows the full bank.
    expect(rows[0]).toMatchObject({ seat: 0, actionType: 'move', leftMs: 600_000 });
    expect(rows[0]!.lagMs).toBe(rows[0]!.spentMs);
    expect(rows[1]).toMatchObject({ seat: 1, lagMs: 0 });
    expect(rows[1]!.leftMs!).toBeLessThan(600_000);
    expect(rows[1]!.spentMs).toBeGreaterThanOrEqual(50);
    // The credit is capped by the quota: 5000 reported ms never gives back more than the time used.
    await mv(white, s.game.revision, { type: 'resign' });
    const pgn = (await call(ctx, 'GET', `/api/tables/${t.tableId}/record`, black)).body as string;
    expect(pgn).toMatch(/1\. e4 \{\[%clk 0:10:00\]\} 1\.\.\. e5 \{\[%clk 0:09:\d\d\]\}/);
  });
});

describe('cross-table, performance rating and featured boards', () => {
  it('conversion of a score to a rating difference follows the FIDE table', () => {
    expect(ratingDifference(0.5)).toBe(0);
    expect(Math.abs(ratingDifference(0.76) - 200)).toBeLessThanOrEqual(4);
    expect(Math.abs(ratingDifference(0.9) - 366)).toBeLessThanOrEqual(6);
    expect(ratingDifference(1)).toBe(800);
    expect(ratingDifference(0)).toBe(-800);
    expect(performanceRating(1600, 3, 4)).toBe(1600 + ratingDifference(0.75));
  });

  it('shows the live top boards, then each player\'s results by round and the TPR', async () => {
    const id = await create();
    const ps = await users(ctx, 2);
    for (const [i, p] of ps.entries()) {
      await call(ctx, 'POST', `/api/tournaments/${id}/register`, p);
      await call(ctx, 'POST', '/api/admin/ratings', admin, { userId: p.id, gameId: 'chess', mode: 'live', rating: 1500 + 100 * i, reason: 'سید' });
    }
    const { t, white, black } = await startRound(id, ps);
    const running = await detail(id);
    expect(running.featured).toHaveLength(1);
    expect(running.featured[0].players).toHaveLength(2);
    const s = await view(ctx, white, t.tableId);
    await command(ctx, black, t.tableId, s.game.revision, { type: 'resign' }).catch(() => undefined);
    const s2 = await view(ctx, white, t.tableId);
    if (s2.table.status !== 'finished') await command(ctx, white, t.tableId, s2.game.revision, { type: 'move', from: 'e2', to: 'e4' });
    const s3 = await view(ctx, black, t.tableId);
    if (s3.table.status !== 'finished') await command(ctx, black, t.tableId, s3.game.revision, { type: 'resign' });
    await runTournaments(ctx.db, registry);
    const d = await detail(id);
    expect(d.status).toBe('finished');
    expect(d.featured).toEqual([]);
    const w = d.standings.find((x: { player: { id: string } }) => x.player.id === white.id);
    expect(w.results).toEqual([{ round: 1, opponentId: black.id, result: 1, kind: 'played', side: 'first' }]);
    // White scored 1/1 against the other rating: TPR = ARO + 800.
    expect(w.tpr).toBe(w.aro + 800);
  });
});

describe('fair play', () => {
  it('statistics, hidden time and indicator flags', () => {
    const even = moveStats(Array.from({ length: 30 }, () => 5000));
    expect(even).toMatchObject({ moves: 30, meanSec: 5, medianSec: 5, cv: 0, under2s: 0 });
    expect(moveStats([])).toMatchObject({ moves: 0 });
    expect(fairPlayFlags(even, { times: 0, seconds: 0 }).map((f) => f.code)).toEqual(['even_timing']);
    const fast = moveStats(Array.from({ length: 30 }, (_, i) => (i % 2 ? 900 : 1200)));
    expect(fairPlayFlags(fast, { times: 0, seconds: 0 }).map((f) => f.code)).toContain('fast_moves');
    expect(fairPlayFlags(moveStats([1000, 9000]), { times: 6, seconds: 10 }).map((f) => f.code)).toEqual(['tab_switching']); // too few moves for timing flags
    const at = (s: number) => new Date(1_000_000 + s * 1000);
    expect(hiddenTime([{ hidden: true, at: at(0) }, { hidden: false, at: at(30) }, { hidden: true, at: at(100) }], at(160))).toEqual({ times: 2, seconds: 90 });
  });

  it('reports, focus signals and the arbiter review', async () => {
    const id = await create({ options: { clock: '10+0' } });
    const ps = await twoPlayers(id);
    const { t, white, black } = await startRound(id, ps);
    const [outsider] = await users(ctx, 1);
    const report = (u: User | undefined, body: object) => call(ctx, 'POST', `/api/tables/${t.tableId}/report`, u, body);
    expect((await report(outsider, { accusedId: white.id })).statusCode).toBe(403);
    expect((await report(white, { accusedId: white.id })).statusCode).toBe(400);
    expect((await report(white, { accusedId: black.id, note: 'حرکت‌ها مشکوک بود' })).statusCode).toBe(204);
    expect((await report(white, { accusedId: black.id })).statusCode).toBe(204); // repeated: ignored

    // Focus signals: a seated player's hide/show is stored once per change; outsiders are ignored.
    const focus = (u: User, hidden: boolean) => call(ctx, 'POST', `/api/tables/${t.tableId}/focus`, u, { hidden });
    for (const [u, h] of [[black, true], [black, true], [black, false], [outsider!, true]] as const) expect((await focus(u, h)).statusCode).toBe(204);
    expect((await ctx.db.select().from(schema.tableFocusEvents).where(eq(schema.tableFocusEvents.tableId, t.tableId)))).toHaveLength(2);

    expect((await call(ctx, 'GET', '/api/admin/fair-play/reports', white)).statusCode).toBe(403);
    const list = (await call(ctx, 'GET', '/api/admin/fair-play/reports?status=open', admin)).json().items;
    const mine = list.find((x: { tableId: string }) => x.tableId === t.tableId);
    expect(mine).toMatchObject({ accusedId: black.id, note: 'حرکت‌ها مشکوک بود' });
    const rv = (await call(ctx, 'GET', `/api/admin/fair-play/tables/${t.tableId}`, admin)).json();
    const b = rv.players.find((p: { userId: string }) => p.userId === black.id);
    expect(b.hidden.times).toBe(1);
    expect(rv.players).toHaveLength(2);
    expect((await call(ctx, 'POST', `/api/admin/fair-play/reports/${mine.id}`, admin, { status: 'dismissed', note: 'تحلیل موتور: مشکلی نیست' })).statusCode).toBe(204);
    expect((await call(ctx, 'POST', `/api/admin/fair-play/reports/${mine.id}`, admin, { status: 'actioned', note: 'دوباره' })).statusCode).toBe(404); // already closed
  });
});

describe('Armageddon playoff', () => {
  it('two players level on everything play one decisive game; draws favour Black; the winner takes first place and the prize', async () => {
    const id = await create({ playoff: 'armageddon', prizes: [{ place: 1, coins: 100, premiumDays: 0 }, { place: 2, coins: 40, premiumDays: 0 }] });
    const ps = await twoPlayers(id);
    await startNow(id);
    const [t1] = await tablesOf(id);
    // The arbiter records a draw in round 1: both on ½, identical in every tie-break.
    const draw = [{ userId: ps[0]!.id, place: 1 }, { userId: ps[1]!.id, place: 1 }];
    expect((await call(ctx, 'POST', `/api/admin/tournaments/${id}/tables/${t1!.tableId}/result`, admin, { placements: draw, reason: 'تساوی با توافق' })).statusCode).toBe(204);
    await runTournaments(ctx.db, registry);
    let d = await detail(id);
    expect(d.status).toBe('running'); // not finished: the playoff is next
    const po = (await tablesOf(id)).find((x) => x.playoff)!;
    expect(po).toBeTruthy();
    const [game] = await ctx.db.select().from(gameTables).where(eq(gameTables.id, po.tableId));
    expect(game!.settings).toMatchObject({ options: { clock: '5/4+0', firstMove: 'host', armageddon: true } });
    expect(d.roundsPlayed[0].tables[0].playoff).toBe(true); // the current round is the playoff
    expect((await detail(`${id}?round=1`)).roundsPlayed[0].tables[0].playoff).toBe(false);
    expect(d.standings.map((s: { points: number }) => s.points)).toEqual([0.5, 0.5]); // the playoff does not touch the standings

    for (const p of ps) await call(ctx, 'POST', `/api/tables/${po.tableId}/ready`, p, { ready: true });
    const white = ps.find((p) => p.id === po.seats[0]!.userId)!, black = ps.find((p) => p !== white)!;
    const s = await view(ctx, white, po.tableId);
    expect(s.game.clocks.left).toEqual([300_000, 240_000]);
    await command(ctx, black, po.tableId, s.game.revision, { type: 'resign' });
    await runTournaments(ctx.db, registry);
    d = await detail(id);
    expect(d.status).toBe('finished');
    expect(d.standings.find((x: { player: { id: string } }) => x.player.id === black.id).finalRank).toBe(2);
    expect(d.standings.find((x: { player: { id: string } }) => x.player.id === white.id).finalRank).toBe(1);
    const paid = async (u: User) => (await ctx.db.select().from(schema.coinLedger).where(eq(schema.coinLedger.sourceKey, `tournament-prize:${id}:${u.id}`)))[0]?.amount;
    expect(await paid(white)).toBe(100);
    expect(await paid(black)).toBe(40);
  });

  it('is only offered where it makes sense', async () => {
    const r = await call(ctx, 'POST', '/api/admin/tournaments', admin, { ...base, gameId: 'sealed-bids', playoff: 'armageddon', startsAt: soon() });
    expect(r.json().errorCode).toBe('TOURNAMENT_SETTINGS_INVALID'); // no host-first-move option: colours cannot be fixed
    const k = await call(ctx, 'POST', '/api/admin/tournaments', admin, { ...base, format: 'knockout', rounds: undefined, advance: 1, playoff: 'armageddon', startsAt: soon() });
    expect(k.json().errorCode).toBe('TOURNAMENT_SETTINGS_INVALID');
  });
});
