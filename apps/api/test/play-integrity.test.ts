import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { ClientEvents, ServerEvents, type TableSnapshot } from '@bg/contracts';
import { createDb, schema } from '@bg/db';
import { lineThreeModule } from '@bg/game-line-three';
import { GameRegistry, reviewedModules } from '@bg/game-engine';
import { closeIncident, createTable, openIncident, runDueDeadlines, runOutbox } from '@bg/play';
import { attachRealtime } from '../src/realtime/socket.ts';
import { grantRole, ORIGIN, setup, testConfig, TEST_DATABASE_URL, type TestCtx } from './helpers.ts';
import { call, command, makeDue, pendingDeadline, seatsOf, startTable, users, view, type User } from './play-helpers.ts';

// Registry with an extra reviewed version of line-three, to prove version pinning and rollout.
const v110 = { ...lineThreeModule, manifest: { ...lineThreeModule.manifest, rulesVersion: '1.1.0', clientBundleRef: 'line-three@1.1.0' } };
const registry = new GameRegistry([...reviewedModules, v110 as never]);

let ctx: TestCtx;
let io: Awaited<ReturnType<typeof attachRealtime>>;
let listener: ReturnType<typeof createDb>;
let url: string;
beforeAll(async () => {
  ctx = await setup({ LOG_LEVEL: 'info' }, registry);
  listener = createDb(TEST_DATABASE_URL, { max: 1 });
  io = await attachRealtime(ctx.app.server, testConfig(), ctx.db, registry, listener.client);
  await ctx.app.listen({ host: '127.0.0.1', port: 0 });
  url = `http://127.0.0.1:${(ctx.app.server.address() as AddressInfo).port}`;
});
afterAll(async () => { await io.close(); await ctx.close(); await listener.close(); });

function socketFor(user: User): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(url, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { origin: ORIGIN, cookie: user.cookie }, reconnection: false });
    s.on(ServerEvents.sessionReady, () => resolve(s));
    s.on('connect_error', reject);
  });
}
const emit = <T>(s: Socket, event: string, payload: unknown) => new Promise<T>((resolve) => s.emit(event, payload, resolve));

describe('hidden information (NFR-01, FR-07)', () => {
  it('a sealed bid never reaches opponents or spectators over HTTP, sockets, logs or the outbox before reveal', async () => {
    const t = await startTable(ctx, 'sealed-bids', 2, { pace: 'turn' });
    const [a, b] = t.players as [User, User];
    const sa = await socketFor(a);
    const sb = await socketFor(b);
    try {
      await emit(sa, ClientEvents.tableSubscribe, { tableId: t.tableId });
      await emit(sb, ClientEvents.tableSubscribe, { tableId: t.tableId });
      const pushed = new Promise<TableSnapshot>((resolve) => sb.on(ServerEvents.tableSnapshot, (snap: TableSnapshot) => { if (snap.game?.revision === 2) resolve(snap); }));

      // Seat A bids 5 through the socket command path (same service as HTTP).
      const ack = await emit<{ ok: boolean; status: string; snapshot: TableSnapshot }>(sa, ClientEvents.tableCommand,
        { commandId: randomUUID(), tableId: t.tableId, expectedRevision: 1, action: { type: 'bid', token: 5 } });
      expect(ack).toMatchObject({ ok: true, status: 'accepted' });
      expect((ack.snapshot.game!.view as { myBid: number }).myBid).toBe(5);

      const bSnap = await pushed;
      const bView = bSnap.game!.view as { myBid: number | null; submitted: boolean[]; history: unknown[] };
      expect(bView.myBid).toBeNull();
      expect(bView.submitted.filter(Boolean)).toHaveLength(1);
      expect(bView.history).toEqual([]);
      // B's own hand (incl. 5) legitimately appears in B's legal actions; A's sealed value must not appear in B's view.
      expect(JSON.stringify(bSnap)).not.toMatch(/"pending"|"hands"|"rng"|"seed"/);
      const { myHand: _ownHand, ...publicPart } = bView as typeof bView & { myHand: number[] };
      expect(JSON.stringify(publicPart)).not.toContain('5');

      const [watcher] = await users(ctx, 1);
      expect((await call(ctx, 'GET', `/api/tables/${t.tableId}`, watcher)).statusCode).toBe(403); // private table

      expect(ctx.logs.join('\n')).not.toMatch(/"token":5|"bid"/);
      const outbox = await ctx.db.select().from(schema.outboxEvents).where(eq(schema.outboxEvents.aggregateId, t.tableId));
      expect(JSON.stringify(outbox.map((o) => o.payload))).not.toMatch(/"token"|"bid"|"pending"/);

      // Client-claimed identity is impossible on the socket path.
      const spoof = await emit<{ ok: boolean; errorCode: string }>(sb, ClientEvents.tableCommand,
        { commandId: randomUUID(), tableId: t.tableId, expectedRevision: 2, action: { type: 'bid', token: 1 }, actorId: a.id });
      expect(spoof).toMatchObject({ ok: false, errorCode: 'VALIDATION_FAILED' });

      // Reveal happens only when everyone has submitted.
      const revealed = (await command(ctx, b, t.tableId, 2, { type: 'bid', token: 2 })).json();
      expect(revealed.snapshot.game.view.history[0]).toMatchObject({ bids: [5, 2], winner: 0 });
    } finally {
      sa.close(); sb.close();
    }
  });
});

describe('outbox and notifications (FR-13)', () => {
  it('consumers are idempotent under duplicate delivery and expired leases are re-claimed', async () => {
    const t = await startTable(ctx, 'line-three', 2, { pace: 'turn' });
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    let snap = await view(ctx, t.players[0]!, t.tableId);
    for (const cell of [0, 3, 1, 4, 2]) {
      snap = (await command(ctx, bySeat(snap.game.pendingSeats[0]), t.tableId, snap.game.revision, { type: 'place', cell })).json().snapshot;
    }
    expect(snap.game.result.reason).toBe('win');
    const { outboxEvents: o, notifications: n } = schema;

    await runOutbox(ctx.db); // drain events from earlier tests
    await ctx.db.update(o).set({ processedAt: null }).where(eq(o.aggregateId, t.tableId));
    // Simulate a crashed worker holding a live lease: nothing is delivered until the lease expires.
    await ctx.db.update(o).set({ claimedUntil: sql`now() + interval '1 hour'` }).where(eq(o.aggregateId, t.tableId));
    expect((await runOutbox(ctx.db)).processed).toBe(0);
    await ctx.db.update(o).set({ claimedUntil: sql`now() - interval '1 second'` }).where(eq(o.aggregateId, t.tableId));
    await runOutbox(ctx.db);
    const count = async () => (await ctx.db.select().from(n).where(sql`${n.payload}->>'tableId' = ${t.tableId}`)).length;
    const first = await count();
    expect(first).toBeGreaterThanOrEqual(2 + 2); // turn notifications + one "finished" per player
    // Re-deliver everything (duplicate delivery): no new notifications.
    await ctx.db.update(o).set({ processedAt: null, claimedUntil: null }).where(eq(o.aggregateId, t.tableId));
    await runOutbox(ctx.db);
    expect(await count()).toBe(first);
    const mine = (await call(ctx, 'GET', '/api/me/notifications', t.players[0])).json().items;
    expect(mine.some((x: { kind: string }) => x.kind === 'finished')).toBe(true);
    expect(JSON.stringify(mine)).not.toMatch(/cell|board/);
  });
});

describe('versions (FR-16): pinned rules, rollout and suspension', () => {
  it('running tables keep their pinned version after a new version is published; suspension blocks only new tables', async () => {
    const [admin, host, guest] = await users(ctx, 3);
    await grantRole(ctx.db, admin!.mobile, 'admin');
    const old = await startTable(ctx, 'line-three', 2, { pace: 'turn', players: [host!, guest!] });

    const { gameVersions: gv } = schema;
    const [nv] = await ctx.db.insert(gv).values({ gameId: 'line-three', rulesVersion: '1.1.0', stateSchemaVersion: 1, clientBundleRef: 'line-three@1.1.0',
      assetsRef: 'line-three/1', manifest: v110.manifest, status: 'retired' }).returning();
    const [oldV] = await ctx.db.select().from(gv).where(and(eq(gv.gameId, 'line-three'), eq(gv.rulesVersion, '1.0.0')));
    expect((await call(ctx, 'PATCH', `/api/admin/game-versions/${nv!.id}`, admin, { status: 'active', reason: 'rollout' })).statusCode).toBe(204);
    expect((await call(ctx, 'PATCH', `/api/admin/game-versions/${oldV!.id}`, admin, { status: 'retired', reason: 'rollout' })).statusCode).toBe(204);

    const fresh = await startTable(ctx, 'line-three', 2, { pace: 'turn' });
    expect((await view(ctx, fresh.players[0]!, fresh.tableId)).table).toMatchObject({ rulesVersion: '1.1.0', clientBundleRef: 'line-three@1.1.0' });
    const oldSnap = await view(ctx, host!, old.tableId);
    expect(oldSnap.table).toMatchObject({ rulesVersion: '1.0.0', clientBundleRef: 'line-three@1.0.0' });
    const bySeat = await seatsOf(ctx, old.tableId, [host!, guest!]);
    expect((await command(ctx, bySeat(oldSnap.game.pendingSeats[0]), old.tableId, 1, { type: 'place', cell: 4 })).json().status).toBe('accepted');

    // A registry without 1.1.0 (e.g. rolled-back deploy) refuses new tables instead of guessing.
    const [solo] = await users(ctx, 1);
    await expect(createTable(ctx.db, new GameRegistry(reviewedModules), { turnTableLimit: 10, turnTableLimitPremium: 30 }, solo!.id,
      { gameId: 'line-three', pace: 'turn', competition: 'friendly', visibility: 'private', capacity: 2, turnSeconds: 86400, reminders: true }))
      .rejects.toMatchObject({ code: 'GAME_NOT_ACCEPTING_TABLES' });

    // Rollback: re-activate 1.0.0, retire 1.1.0 → new tables use 1.0.0 again; 1.1.0 tables continue.
    await call(ctx, 'PATCH', `/api/admin/game-versions/${oldV!.id}`, admin, { status: 'active', reason: 'rollback' });
    await call(ctx, 'PATCH', `/api/admin/game-versions/${nv!.id}`, admin, { status: 'retired', reason: 'rollback' });
    const again = await startTable(ctx, 'line-three', 2, { pace: 'turn' });
    expect((await view(ctx, again.players[0]!, again.tableId)).table.rulesVersion).toBe('1.0.0');
    expect((await view(ctx, fresh.players[0]!, fresh.tableId)).game.legalActions.length).toBeGreaterThan(0);

    // Suspending the game stops new tables but not running ones.
    await call(ctx, 'PATCH', '/api/admin/games/line-three', admin, { status: 'suspended', reason: 'bug' });
    const blocked = await call(ctx, 'POST', '/api/tables', solo, { gameId: 'line-three', pace: 'turn', capacity: 2, turnSeconds: 86400 });
    expect(blocked.json().errorCode).toBe('GAME_NOT_ACCEPTING_TABLES');
    const s2 = await view(ctx, host!, old.tableId);
    expect((await command(ctx, bySeat(s2.game.pendingSeats[0]), old.tableId, 2, { type: 'place', cell: 0 })).json().status).toBe('accepted');
    await call(ctx, 'PATCH', '/api/admin/games/line-three', admin, { status: 'active', reason: 'fixed' });
  });
});

describe('tutorials (FR-04)', () => {
  it('runs the scripted interactive tutorial server-side, guides the learner, resumes, completes and can be replayed', async () => {
    const [u] = await users(ctx, 1);
    const start = await call(ctx, 'POST', '/api/tutorials/line-three/start', u, {});
    const tableId = start.json().tableId;
    expect((await call(ctx, 'POST', '/api/tutorials/line-three/start', u, {})).json().tableId).toBe(tableId); // resume
    let s = await view(ctx, u!, tableId);
    expect(s.table).toMatchObject({ isTutorial: true, mySeat: 0 });
    expect(s.table.seats[1]).toMatchObject({ kind: 'script', user: null });
    expect(s.game.tutorial).toMatchObject({ step: 0, total: 3, expected: { type: 'place', cell: 4 } });
    expect(s.game.deadline).toBeNull();
    expect((await command(ctx, u!, tableId, s.game.revision, { type: 'place', cell: 8 })).json().errorCode).toBe('TUTORIAL_EXPECTED_OTHER');
    for (const cell of [4, 2, 6]) {
      const r = (await command(ctx, u!, tableId, s.game.revision, { type: 'place', cell })).json();
      expect(r.status).toBe('accepted');
      s = r.snapshot;
    }
    expect(s.game.view.board[0]).toBe('O'); // scripted replies were applied
    expect(s.game.result.placements[0]).toEqual({ seat: 0, place: 1 });
    expect((await call(ctx, 'GET', '/api/me/tutorials', u)).json().items).toEqual([{ gameId: 'line-three', status: 'completed', tableId }]);
    const completed = await ctx.db.select().from(schema.outboxEvents).where(and(eq(schema.outboxEvents.topic, 'tutorial.completed'), eq(schema.outboxEvents.aggregateId, tableId)));
    expect(completed).toHaveLength(1);
    const replay = (await call(ctx, 'POST', '/api/tutorials/line-three/start', u, { restart: true })).json().tableId;
    expect(replay).not.toBe(tableId);
    await call(ctx, 'POST', '/api/tutorials/line-three/skip', u, {});
    expect((await call(ctx, 'GET', '/api/me/tutorials', u)).json().items[0].status).toBe('completed'); // replay/skip never erase completion
  });

  it('skip marks the tutorial skipped', async () => {
    const [u] = await users(ctx, 1);
    await call(ctx, 'POST', '/api/tutorials/sealed-bids/start', u, {});
    expect((await call(ctx, 'POST', '/api/tutorials/sealed-bids/skip', u, {})).statusCode).toBe(204);
    expect((await call(ctx, 'GET', '/api/me/tutorials', u)).json().items).toEqual([{ gameId: 'sealed-bids', status: 'skipped', tableId: null }]);
  });
});

describe('platform incident (separate from personal disconnect)', () => {
  it('freezes deadlines while open and extends them by the incident duration when closed', async () => {
    const [admin] = await users(ctx, 1);
    await grantRole(ctx.db, admin!.mobile, 'admin');
    const t = await startTable(ctx, 'line-three', 2, { pace: 'turn' });
    const d = (await pendingDeadline(ctx, t.tableId))!;
    const incident = await openIncident(ctx.db, admin!.id, 'قطعی پایگاه داده');
    await ctx.db.update(schema.platformIncidents).set({ startedAt: sql`now() - interval '10 minutes'` }).where(eq(schema.platformIncidents.id, incident.id));
    await makeDue(ctx, d.id);
    expect(await runDueDeadlines(ctx.db, registry)).toMatchObject({ frozen: true, fired: 0 });
    expect((await view(ctx, t.players[0]!, t.tableId)).incident).toMatchObject({ reasonFa: 'قطعی پایگاه داده' });
    const before = (await pendingDeadline(ctx, t.tableId))!.dueAt.getTime();
    await closeIncident(ctx.db, admin!.id);
    const after = (await pendingDeadline(ctx, t.tableId))!.dueAt.getTime();
    expect(after - before).toBeGreaterThanOrEqual(10 * 60_000 - 1000);
    expect(await ctx.db.select().from(schema.platformIncidents).where(isNull(schema.platformIncidents.endedAt))).toHaveLength(0);
    expect((await view(ctx, t.players[0]!, t.tableId)).game.revision).toBe(1);
  });
});
