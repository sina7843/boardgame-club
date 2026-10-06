import type { AddressInfo } from 'node:net';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { ClientEvents, ServerEvents, type MessageItem } from '@bg/contracts';
import { createDb, schema } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { runOutbox } from '@bg/play';
import { attachRealtime } from '../src/realtime/socket.ts';
import { grantRole, ORIGIN, setup, testConfig, TEST_DATABASE_URL, type TestCtx } from './helpers.ts';
import { call, startTable, users, view, type User } from './play-helpers.ts';

let ctx: TestCtx;
let io: Awaited<ReturnType<typeof attachRealtime>>;
let listener: ReturnType<typeof createDb>;
let url: string;
beforeAll(async () => {
  ctx = await setup({ LOG_LEVEL: 'info' });
  listener = createDb(TEST_DATABASE_URL, { max: 1 });
  io = await attachRealtime(ctx.app.server, testConfig(), ctx.db, createDefaultRegistry(), listener.client);
  await ctx.app.listen({ host: '127.0.0.1', port: 0 });
  url = `http://127.0.0.1:${(ctx.app.server.address() as AddressInfo).port}`;
});
afterAll(async () => { await io.close(); await ctx.close(); await listener.close(); });

const befriend = async (a: User, b: User) => {
  await call(ctx, 'POST', '/api/friends/requests', a, { userId: b.id });
  await call(ctx, 'POST', `/api/friends/requests/${a.id}/accept`, b);
};
const dm = async (a: User, b: User) => (await call(ctx, 'POST', '/api/conversations/direct', a, { userId: b.id }));
const send = (u: User, conversationId: string, body: string) => call(ctx, 'POST', `/api/conversations/${conversationId}/messages`, u, { body });
const notifications = async (u: User) => (await call(ctx, 'GET', '/api/me/notifications', u)).json().items as { kind: string; href: string; textFa: string }[];
function socketFor(user: User): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(url, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { origin: ORIGIN, cookie: user.cookie }, reconnection: false });
    s.on(ServerEvents.sessionReady, () => resolve(s));
    s.on('connect_error', reject);
  });
}

describe('friends and private messages (FR-11)', () => {
  it('request/accept/remove; DMs are friends-only by default and respect the nobody setting', async () => {
    const [a, b, c] = await users(ctx, 3);
    expect((await dm(a!, b!)).json().errorCode).toBe('DM_NOT_ALLOWED');
    expect((await call(ctx, 'POST', '/api/friends/requests', a, { userId: b!.id })).json().relationship).toBe('outgoing');
    expect((await call(ctx, 'GET', `/api/users/${a!.id}/card`, b)).json().relationship).toBe('incoming');
    expect((await call(ctx, 'POST', `/api/friends/requests/${a!.id}/accept`, b)).json().relationship).toBe('friends');
    expect((await call(ctx, 'POST', '/api/friends/requests', a, { userId: b!.id })).json().errorCode).toBe('ALREADY_FRIENDS');
    const conv = (await dm(a!, b!)).json().id;
    expect((await send(a!, conv, 'سلام!')).statusCode).toBe(201);
    await call(ctx, 'PUT', '/api/me/settings', b, { dmPolicy: 'nobody', notify: { turn: true, invite: true, message: true, result: true, social: true } });
    expect((await send(a!, conv, 'هنوز هستی؟')).json().errorCode).toBe('DM_NOT_ALLOWED');
    await call(ctx, 'PUT', '/api/me/settings', b, { dmPolicy: 'friends', notify: { turn: true, invite: true, message: true, result: true, social: true } });
    expect((await call(ctx, 'GET', `/api/conversations/${conv}/messages`, c)).statusCode).toBe(403);
    expect((await call(ctx, 'DELETE', `/api/friends/${b!.id}`, a)).statusCode).toBe(204);
    expect((await send(a!, conv, 'و حالا؟')).json().errorCode).toBe('DM_NOT_ALLOWED');
  });

  it('blocking ends friendship and prevents any new contact: request, message, invite, joining their table', async () => {
    const [a, b] = await users(ctx, 2);
    await befriend(a!, b!);
    const conv = (await dm(a!, b!)).json().id;
    expect((await call(ctx, 'POST', '/api/blocks', b, { userId: a!.id })).statusCode).toBe(204);
    expect((await call(ctx, 'GET', `/api/users/${b!.id}/card`, a)).json().relationship).toBe('none'); // being blocked is not revealed
    expect((await call(ctx, 'POST', '/api/friends/requests', a, { userId: b!.id })).json().errorCode).toBe('BLOCKED');
    expect((await send(a!, conv, 'لطفاً')).json().errorCode).toBe('BLOCKED');
    expect((await dm(a!, b!)).json().errorCode).toBe('BLOCKED');
    const table = (await call(ctx, 'POST', '/api/tables', a, { gameId: 'line-three', pace: 'turn', capacity: 2, turnSeconds: 86400, visibility: 'public' })).json().id;
    expect((await call(ctx, 'POST', `/api/tables/${table}/invites`, a, { userId: b!.id })).json().errorCode).toBe('BLOCKED');
    expect((await call(ctx, 'POST', `/api/tables/${table}/join`, b, {})).json().errorCode).toBe('BLOCKED');
  });

  it('messages are sanitized, paginated, pushed only to members, and hidden for muters', async () => {
    const [a, b, outsider] = await users(ctx, 3);
    await befriend(a!, b!);
    const conv = (await dm(a!, b!)).json().id;
    const sb = await socketFor(b!);
    const so = await socketFor(outsider!);
    const received: MessageItem[] = [];
    const leaked: MessageItem[] = [];
    sb.on(ServerEvents.messageCreated, (m: MessageItem) => received.push(m));
    so.on(ServerEvents.messageCreated, (m: MessageItem) => leaked.push(m));
    const RLO = String.fromCharCode(0x202e);
    const NUL = String.fromCharCode(0);
    const clean = (await send(a!, conv, `  <b>سلام</b>${RLO}${NUL}\n\n\n\nخوبی؟  `)).json();
    expect(clean.body).toBe('<b>سلام</b>\n\nخوبی؟'); // stored as plain text; the UI renders it as text, never HTML
    for (let i = 0; i < 34; i++) await send(a!, conv, `پیام ${i}`);
    await new Promise((r) => setTimeout(r, 300));
    expect(received.length).toBeGreaterThanOrEqual(30);
    expect(leaked).toHaveLength(0);
    const p1 = (await call(ctx, 'GET', `/api/conversations/${conv}/messages`, b)).json();
    expect(p1.items).toHaveLength(30);
    const p2 = (await call(ctx, 'GET', `/api/conversations/${conv}/messages?before=${encodeURIComponent(p1.nextBefore)}`, b)).json();
    expect(p2.items).toHaveLength(5);
    expect(p2.nextBefore).toBeNull();
    await call(ctx, 'POST', '/api/mutes', b, { userId: a!.id });
    expect((await call(ctx, 'GET', `/api/conversations/${conv}/messages`, b)).json().items).toHaveLength(0);
    sb.close(); so.close();
  });

  it('DM notifications: one per message even if the outbox delivers twice; preferences respected; payload has no content', async () => {
    const [a, b, c] = await users(ctx, 3);
    await befriend(a!, b!);
    await befriend(a!, c!);
    await call(ctx, 'PUT', '/api/me/settings', c, { dmPolicy: 'friends', notify: { turn: true, invite: true, message: false, result: true, social: true } });
    const ab = (await dm(a!, b!)).json().id;
    const ac = (await dm(a!, c!)).json().id;
    await send(a!, ab, 'متن خصوصی ۱۲۳');
    await send(a!, ac, 'متن خصوصی ۴۵۶');
    await runOutbox(ctx.db);
    await ctx.db.update(schema.outboxEvents).set({ processedAt: null }).where(eq(schema.outboxEvents.topic, 'message.created'));
    await runOutbox(ctx.db);
    const nb = (await notifications(b!)).filter((n) => n.kind === 'message');
    expect(nb).toHaveLength(1);
    expect(nb[0]!.href).toBe(`/messages/${ab}`);
    expect(JSON.stringify(nb)).not.toContain('۱۲۳');
    expect((await notifications(c!)).filter((n) => n.kind === 'message')).toHaveLength(0);
  });
});

describe('invitations and table chat (FR-05, FR-13)', () => {
  it('a friend invited to a private table gets a notification that leads to the authorized lobby and can join', async () => {
    const [host, friend, stranger] = await users(ctx, 3);
    await befriend(host!, friend!);
    const table = (await call(ctx, 'POST', '/api/tables', host, { gameId: 'line-three', pace: 'turn', capacity: 2, turnSeconds: 86400 })).json().id;
    expect((await call(ctx, 'POST', `/api/tables/${table}/invites`, host, { userId: stranger!.id })).json().errorCode).toBe('FORBIDDEN');
    expect((await call(ctx, 'GET', `/api/tables/${table}`, friend)).statusCode).toBe(403);
    expect((await call(ctx, 'POST', `/api/tables/${table}/invites`, host, { userId: friend!.id })).json()).toEqual({ invited: 1 });
    await runOutbox(ctx.db);
    const n = (await notifications(friend!)).find((x) => x.kind === 'invite')!;
    expect(n.href).toBe(`/tables/${table}`);
    const lobby = await view(ctx, friend!, table);
    expect(lobby.table.inviteCode).toBeNull();
    expect((await call(ctx, 'POST', `/api/tables/${table}/join`, friend, {})).statusCode).toBe(200);
    expect((await call(ctx, 'GET', `/api/tables/${table}`, stranger)).statusCode).toBe(403);
    // A private-table socket subscription is denied to non-members too.
    const s = await socketFor(stranger!);
    const ack = await new Promise<{ ok: boolean; errorCode: string }>((resolve) => s.emit(ClientEvents.tableSubscribe, { tableId: table }, resolve));
    expect(ack).toMatchObject({ ok: false, errorCode: 'FORBIDDEN' });
    s.close();
  });

  it('table chat is for participants only', async () => {
    const t = await startTable(ctx, 'line-three', 2, { pace: 'turn' });
    const [outsider] = await users(ctx, 1);
    expect((await call(ctx, 'POST', `/api/tables/${t.tableId}/chat`, t.players[0], { body: 'بازی خوبی باشد' })).statusCode).toBe(201);
    const chat = (await call(ctx, 'GET', `/api/tables/${t.tableId}/chat`, t.players[1])).json();
    expect(chat.items.map((m: MessageItem) => m.body)).toEqual(['بازی خوبی باشد']);
    expect((await call(ctx, 'GET', `/api/tables/${t.tableId}/chat`, outsider)).statusCode).toBe(403);
    expect((await call(ctx, 'GET', `/api/conversations/${chat.conversationId}/messages`, outsider)).statusCode).toBe(403);
  });
});

describe('groups and clubs (FR-12)', () => {
  it('group: invite friends, accept, chat, and quick-invite the whole group to a table', async () => {
    const [owner, f1, f2, stranger] = await users(ctx, 4);
    await befriend(owner!, f1!);
    await befriend(owner!, f2!);
    const g = (await call(ctx, 'POST', '/api/groups', owner, { name: 'جمع پنجشنبه' })).json();
    expect((await call(ctx, 'POST', `/api/groups/${g.id}/invites`, owner, { userId: stranger!.id })).json().errorCode).toBe('FORBIDDEN');
    for (const f of [f1!, f2!]) {
      await call(ctx, 'POST', `/api/groups/${g.id}/invites`, owner, { userId: f.id });
      expect((await call(ctx, 'POST', `/api/groups/${g.id}/accept`, f)).json().myStatus).toBe('active');
    }
    expect((await call(ctx, 'GET', `/api/groups/${g.id}`, stranger)).statusCode).toBe(403);
    expect((await call(ctx, 'POST', `/api/groups/${g.id}/invites`, f1, { userId: f2!.id })).json().errorCode).toBe('MANAGER_REQUIRED');
    const conv = (await call(ctx, 'GET', `/api/groups/${g.id}`, f1)).json().conversationId;
    expect((await send(f2!, conv, 'ساعت هشت؟')).statusCode).toBe(201);
    const table = (await call(ctx, 'POST', '/api/tables', owner, { gameId: 'sealed-bids', pace: 'turn', capacity: 3, turnSeconds: 86400 })).json().id;
    expect((await call(ctx, 'POST', `/api/tables/${table}/invites`, owner, { groupId: g.id })).json()).toEqual({ invited: 2 });
    expect((await call(ctx, 'POST', `/api/tables/${table}/join`, f2, {})).statusCode).toBe(200);
  });

  it('club roles and membership policies are enforced; managers moderate club chat (audited)', async () => {
    const [owner, manager, member, joiner, outsider] = await users(ctx, 5);
    const club = (await call(ctx, 'POST', '/api/clubs', owner, { slug: 'tehran-meeples', name: 'میپل‌های تهران', joinPolicy: 'open' })).json();
    expect(club.myMembership).toEqual({ role: 'owner', status: 'active' });
    expect((await call(ctx, 'POST', '/api/clubs', joiner, { slug: 'tehran-meeples', name: 'x y', joinPolicy: 'open' })).json().errorCode).toBe('SLUG_TAKEN');
    for (const u of [manager!, member!]) await call(ctx, 'POST', '/api/clubs/tehran-meeples/join', u);
    expect((await call(ctx, 'PATCH', `/api/clubs/tehran-meeples/members/${manager!.id}`, member, { role: 'manager' })).json().errorCode).toBe('OWNER_REQUIRED');
    expect((await call(ctx, 'PATCH', `/api/clubs/tehran-meeples/members/${manager!.id}`, owner, { role: 'manager' })).json().members.find((m: { user: { id: string } }) => m.user.id === manager!.id).role).toBe('manager');
    expect((await call(ctx, 'PATCH', '/api/clubs/tehran-meeples', member, { description: 'هک' })).json().errorCode).toBe('MANAGER_REQUIRED');
    expect((await call(ctx, 'PATCH', '/api/clubs/tehran-meeples', manager, { joinPolicy: 'request', description: 'شب‌های بازی' })).json().joinPolicy).toBe('request');
    expect((await call(ctx, 'PATCH', `/api/clubs/tehran-meeples/members/${member!.id}`, manager, { role: 'manager' })).json().errorCode).toBe('OWNER_REQUIRED');

    // request policy: requested → approved by a manager; pending list visible only to managers
    expect((await call(ctx, 'POST', '/api/clubs/tehran-meeples/join', joiner)).json().myMembership.status).toBe('requested');
    expect((await call(ctx, 'GET', '/api/clubs/tehran-meeples', member)).json().pending).toEqual([]);
    expect((await call(ctx, 'GET', '/api/clubs/tehran-meeples', manager)).json().pending).toHaveLength(1);
    expect((await call(ctx, 'POST', `/api/clubs/tehran-meeples/requests/${joiner!.id}/approve`, member)).json().errorCode).toBe('MANAGER_REQUIRED');
    expect((await call(ctx, 'POST', `/api/clubs/tehran-meeples/requests/${joiner!.id}/approve`, manager)).json().memberCount).toBe(4);

    // invite policy
    await call(ctx, 'PATCH', '/api/clubs/tehran-meeples', owner, { joinPolicy: 'invite' });
    expect((await call(ctx, 'POST', '/api/clubs/tehran-meeples/join', outsider)).json().errorCode).toBe('INVITE_ONLY');
    await call(ctx, 'POST', '/api/clubs/tehran-meeples/invites', manager, { userId: outsider!.id });
    expect((await call(ctx, 'POST', '/api/clubs/tehran-meeples/join', outsider)).json().myMembership.status).toBe('active');

    // scoped chat moderation
    const conv = (await call(ctx, 'GET', '/api/clubs/tehran-meeples', member)).json().conversationId;
    const msg = (await send(member!, conv, 'پیام نامناسب')).json();
    expect((await call(ctx, 'DELETE', `/api/messages/${msg.id}`, joiner)).statusCode).toBe(403);
    expect((await call(ctx, 'DELETE', `/api/messages/${msg.id}`, manager)).statusCode).toBe(204);
    const audit = await ctx.db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'message.remove'), eq(schema.auditLog.targetId, msg.id)));
    expect(audit).toHaveLength(1);
    // managers cannot remove other managers or the owner
    expect((await call(ctx, 'DELETE', `/api/clubs/tehran-meeples/members/${owner!.id}`, manager)).statusCode).toBe(403);
    expect((await call(ctx, 'DELETE', `/api/clubs/tehran-meeples/members/${member!.id}`, manager)).statusCode).toBe(204);
  });
});

describe('reports, sanctions and appeals (FR-01, FR-16)', () => {
  it('report → moderator review → suspension enforced on server → appeal decided by another moderator', async () => {
    const [a, b, mod1, mod2] = await users(ctx, 4);
    await grantRole(ctx.db, mod1!.mobile, 'moderator');
    await grantRole(ctx.db, mod2!.mobile, 'moderator');
    await befriend(a!, b!);
    const conv = (await dm(a!, b!)).json().id;
    const msg = (await send(b!, conv, 'توهین آشکار')).json();
    const [outsider] = await users(ctx, 1);
    expect((await call(ctx, 'POST', '/api/reports', outsider, { targetType: 'message', targetId: msg.id, reasonCode: 'abuse', reason: 'گزارش بی‌ربط' })).statusCode).toBe(403);
    const rep = (await call(ctx, 'POST', '/api/reports', a, { targetType: 'message', targetId: msg.id, reasonCode: 'abuse', reason: 'پیام توهین‌آمیز', evidenceRef: 'screenshot-1' })).json();
    expect(rep.status).toBe('open');
    expect((await call(ctx, 'GET', '/api/mod/reports', a)).statusCode).toBe(403);
    const detail = (await call(ctx, 'GET', `/api/mod/reports/${rep.id}`, mod1)).json();
    expect(detail.subject.id).toBe(b!.id);
    expect(detail.evidence.messages.map((m: { body: string }) => m.body)).toContain('توهین آشکار');
    expect(JSON.stringify(detail)).not.toMatch(/mobile|09\d{9}/);

    expect((await call(ctx, 'POST', `/api/mod/reports/${rep.id}/resolve`, mod1, { decision: 'suspended', durationHours: 24, note: 'توهین' })).json().status).toBe('resolved');
    expect((await call(ctx, 'GET', '/api/me/friends', b)).json().errorCode).toBe('ACCOUNT_SUSPENDED');
    expect((await call(ctx, 'GET', '/api/me', b)).json().suspended).toBe(true);
    await expect(socketFor(b!)).rejects.toThrow(/ACCOUNT_SUSPENDED/);
    const sanction = (await call(ctx, 'GET', '/api/me/sanctions', b)).json().items[0];
    expect(sanction).toMatchObject({ kind: 'suspended', active: true });

    const appeal = await call(ctx, 'POST', '/api/appeals', b, { sanctionId: sanction.id, text: 'سوءتفاهم بود و عذرخواهی کردم.' });
    expect(appeal.statusCode).toBe(201);
    expect((await call(ctx, 'POST', '/api/appeals', b, { sanctionId: sanction.id, text: 'دوباره اعتراض می‌کنم.' })).json().errorCode).toBe('APPEAL_EXISTS');
    const appealId = appeal.json().id;
    expect((await call(ctx, 'POST', `/api/mod/appeals/${appealId}/decide`, mod1, { decision: 'revoked', note: 'خودم' })).statusCode).toBe(403);
    expect((await call(ctx, 'POST', `/api/mod/appeals/${appealId}/decide`, mod2, { decision: 'revoked', note: 'پذیرفته شد' })).statusCode).toBe(204);
    expect((await call(ctx, 'GET', '/api/me/friends', b)).statusCode).toBe(200);
    expect((await call(ctx, 'GET', '/api/me/sanctions', b)).json().items[0]).toMatchObject({ active: false, appeal: { status: 'revoked' } });
    const audit = (await call(ctx, 'GET', '/api/mod/audit', mod2)).json().items.map((x: { action: string }) => x.action);
    expect(audit).toEqual(expect.arrayContaining(['report.view', 'report.resolve', 'appeal.decide']));
  });

  it('chat restriction blocks sending everywhere; display names and tables can be reported', async () => {
    const [a, b, mod] = await users(ctx, 3);
    await grantRole(ctx.db, mod!.mobile, 'moderator');
    await befriend(a!, b!);
    const conv = (await dm(a!, b!)).json().id;
    const rep = (await call(ctx, 'POST', '/api/reports', a, { targetType: 'display_name', targetId: b!.id, reasonCode: 'inappropriate_name', reason: 'نام نامناسب' })).json();
    await call(ctx, 'POST', `/api/mod/reports/${rep.id}/resolve`, mod, { decision: 'chat_restricted', durationHours: 2, note: 'محدودیت گفت‌وگو' });
    expect((await send(b!, conv, 'سلام')).json().errorCode).toBe('CHAT_RESTRICTED');
    expect((await call(ctx, 'GET', '/api/me/friends', b)).statusCode).toBe(200); // not suspended
    expect((await call(ctx, 'POST', '/api/reports', a, { targetType: 'user', targetId: a!.id, reasonCode: 'other', reason: 'خودم' })).json().errorCode).toBe('CANNOT_TARGET_SELF');
    const t = await startTable(ctx, 'line-three', 2, { pace: 'turn' });
    expect((await call(ctx, 'POST', '/api/reports', t.players[0], { targetType: 'table', targetId: t.tableId, reasonCode: 'cheating', reason: 'مشکوک' })).statusCode).toBe(201);
  });

  it('records a timeout behaviour signal from the result without any automatic sanction', async () => {
    const t = await startTable(ctx, 'line-three', 2, { pace: 'turn' });
    const loserSeat = (await view(ctx, t.players[0]!, t.tableId)).game.pendingSeats[0];
    await ctx.db.update(schema.scheduledDeadlines).set({ dueAt: sql`now() - interval '1 second'` })
      .where(and(eq(schema.scheduledDeadlines.tableId, t.tableId), eq(schema.scheduledDeadlines.deadlineKey, 'turn')));
    const { runDueDeadlines } = await import('@bg/play');
    await runDueDeadlines(ctx.db, createDefaultRegistry());
    await runOutbox(ctx.db);
    const seats = (await view(ctx, t.players[0]!, t.tableId)).table.seats as { seat: number; user: { id: string } }[];
    const loser = seats.find((s) => s.seat === loserSeat)!.user.id;
    const sig = await ctx.db.select().from(schema.behaviorSignals).where(eq(schema.behaviorSignals.tableId, t.tableId));
    expect(sig.map((s) => [s.userId, s.kind])).toEqual([[loser, 'timeout_loss']]);
    expect(await ctx.db.select().from(schema.userSanctions).where(eq(schema.userSanctions.userId, loser))).toHaveLength(0);
  });
});
