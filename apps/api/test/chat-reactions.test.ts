import type { AddressInfo } from 'node:net';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { ClientEvents, ServerEvents, type MessageItem } from '@bg/contracts';
import { createDb, schema } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { runOutbox } from '@bg/play';
import { attachRealtime } from '../src/realtime/socket.ts';
import { ORIGIN, setup, testConfig, TEST_DATABASE_URL, type TestCtx } from './helpers.ts';
import { call, startTable, users, type User } from './play-helpers.ts';

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

const socketFor = (user: User): Promise<Socket> => new Promise((resolve, reject) => {
  const s = connect(url, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: { origin: ORIGIN, cookie: user.cookie }, reconnection: false });
  s.on(ServerEvents.sessionReady, () => resolve(s));
  s.on('connect_error', reject);
});
const nameOf = async (u: User, displayName: string) => { await ctx.db.update(schema.users).set({ displayName }).where(eq(schema.users.id, u.id)); };
const chat = (u: User, tableId: string) => call(ctx, 'GET', `/api/tables/${tableId}/chat`, u);
const post = (u: User, tableId: string, body: string) => call(ctx, 'POST', `/api/tables/${tableId}/chat`, u, { body });
const notes = async (u: User) => (await call(ctx, 'GET', '/api/me/notifications', u)).json().items as { kind: string; href: string }[];
const makePublic = (tableId: string) => ctx.db.update(schema.gameTables).set({ visibility: 'public' }).where(eq(schema.gameTables.id, tableId));

describe('chat reactions, mentions, spectators and mute', () => {
  it('reactions toggle per user, aggregate with mine, use a fixed emoji set and follow read access', async () => {
    const t = await startTable(ctx, 'line-three', 2, { pace: 'turn' });
    const [a, b] = t.players as [User, User];
    const [outsider] = await users(ctx, 1);
    const m = (await post(a, t.tableId, 'سلام')).json() as MessageItem;
    expect(m.reactions).toEqual([]);
    const react = (u: User, emoji: string) => call(ctx, 'POST', `/api/messages/${m.id}/reactions`, u, { emoji });
    expect((await react(a, '👍')).json().reactions).toEqual([{ emoji: '👍', count: 1, mine: true }]);
    expect((await react(b, '👍')).json().reactions).toEqual([{ emoji: '👍', count: 2, mine: true }]);
    expect((await react(b, '🔥')).json().reactions).toEqual([{ emoji: '👍', count: 2, mine: true }, { emoji: '🔥', count: 1, mine: true }]);
    const seen = (await chat(a, t.tableId)).json().items[0] as MessageItem;
    expect(seen.reactions).toEqual([{ emoji: '👍', count: 2, mine: true }, { emoji: '🔥', count: 1, mine: false }]);
    expect((await react(b, '👍')).json().reactions).toEqual([{ emoji: '👍', count: 1, mine: false }, { emoji: '🔥', count: 1, mine: true }]);
    expect((await react(a, '💩')).statusCode).toBe(400);
    expect((await react(outsider!, '👍')).statusCode).toBe(403);
    expect((await call(ctx, 'POST', `/api/messages/${crypto.randomUUID()}/reactions`, a, { emoji: '👍' })).statusCode).toBe(404);
  });

  it('a reaction is pushed to members with their own mine flag', async () => {
    const t = await startTable(ctx, 'line-three', 2, { pace: 'turn' });
    const [a, b] = t.players as [User, User];
    const m = (await post(a, t.tableId, 'سلام')).json() as MessageItem;
    const sa = await socketFor(a);
    const sb = await socketFor(b);
    const got = (s: Socket) => new Promise<MessageItem>((resolve) => s.on(ServerEvents.messageCreated, (x: MessageItem) => { if (x.id === m.id && x.reactions.length) resolve(x); }));
    const pa = got(sa);
    const pb = got(sb);
    await call(ctx, 'POST', `/api/messages/${m.id}/reactions`, a, { emoji: '😂' });
    expect((await pa).reactions).toEqual([{ emoji: '😂', count: 1, mine: true }]);
    expect((await pb).reactions).toEqual([{ emoji: '😂', count: 1, mine: false }]);
    sa.close(); sb.close();
  });

  it('@displayName mentions members (not the sender), notify once, and respect conversation mute and user mute', async () => {
    const t = await startTable(ctx, 'line-three', 2, { pace: 'turn' });
    const [a, b] = t.players as [User, User];
    await nameOf(a, 'علیرضا');
    await nameOf(b, 'سارا');
    const m = (await post(a, t.tableId, 'سلام @سارا و @علیرضا و @ناشناس')).json() as MessageItem;
    expect(m.mentions).toEqual([b.id]);
    await runOutbox(ctx.db);
    expect((await notes(b)).filter((n) => n.kind === 'mention')).toHaveLength(1);
    expect((await notes(a)).filter((n) => n.kind === 'mention')).toHaveLength(0);
    // a longer name is not a mention of the shorter one
    expect(((await post(a, t.tableId, 'سلام @ساراجان')).json() as MessageItem).mentions).toEqual([]);
    // muting the conversation silences mention notifications
    expect((await call(ctx, 'PUT', `/api/conversations/${m.conversationId}/mute`, b, { muted: true })).statusCode).toBe(204);
    await post(a, t.tableId, 'دوباره @سارا');
    await runOutbox(ctx.db);
    expect((await notes(b)).filter((n) => n.kind === 'mention')).toHaveLength(1);
    // muting the sender silences them too
    await call(ctx, 'PUT', `/api/conversations/${m.conversationId}/mute`, b, { muted: false });
    await call(ctx, 'POST', '/api/mutes', b, { userId: a.id });
    await post(a, t.tableId, 'سوم @سارا');
    await runOutbox(ctx.db);
    expect((await notes(b)).filter((n) => n.kind === 'mention')).toHaveLength(1);
  });

  it('conversation mute is stored per user and returned in the page meta', async () => {
    const t = await startTable(ctx, 'line-three', 2, { pace: 'turn' });
    const [a, b] = t.players as [User, User];
    const id = (await chat(a, t.tableId)).json().conversationId as string;
    expect((await chat(a, t.tableId)).json().muted).toBe(false);
    expect((await call(ctx, 'PUT', `/api/conversations/${id}/mute`, a, { muted: true })).statusCode).toBe(204);
    expect((await chat(a, t.tableId)).json().muted).toBe(true);
    expect((await chat(b, t.tableId)).json().muted).toBe(false);
    expect((await call(ctx, 'PUT', `/api/conversations/${id}/mute`, a, { muted: 'x' })).statusCode).toBe(400);
    const [outsider] = await users(ctx, 1);
    expect((await call(ctx, 'PUT', `/api/conversations/${id}/mute`, outsider, { muted: true })).statusCode).toBe(403);
    expect((await call(ctx, 'PUT', `/api/conversations/${id}/mute`, a, { muted: false })).statusCode).toBe(204);
    expect((await chat(a, t.tableId)).json().muted).toBe(false);
  });

  it('spectators of a public table read table chat (canPost false), get pushes, cannot post; private tables stay closed', async () => {
    const t = await startTable(ctx, 'line-three', 2, { pace: 'turn' });
    const [a] = t.players as [User, User];
    const [spec] = await users(ctx, 1);
    await post(a, t.tableId, 'سلام تماشاگر');
    expect((await chat(spec!, t.tableId)).statusCode).toBe(403); // private table
    await makePublic(t.tableId);
    const res = (await chat(spec!, t.tableId)).json();
    expect(res.items.map((x: MessageItem) => x.body)).toEqual(['سلام تماشاگر']);
    expect(res.canPost).toBe(false);
    expect((await chat(a, t.tableId)).json().canPost).toBe(true);
    expect((await post(spec!, t.tableId, 'من هم')).json().errorCode).toBe('NOT_PARTICIPANT');
    expect((await call(ctx, 'POST', `/api/conversations/${res.conversationId}/messages`, spec, { body: 'x' })).statusCode).toBe(403);
    expect((await call(ctx, 'GET', `/api/conversations/${res.conversationId}/messages`, spec)).json().canPost).toBe(false);
    expect((await call(ctx, 'POST', `/api/messages/${res.items[0].id}/reactions`, spec, { emoji: '👏' })).statusCode).toBe(200);
    // socket delivery only to a subscribed spectator
    const sub = await socketFor(spec!);
    const [other] = await users(ctx, 1);
    const unsub = await socketFor(other!);
    const ack = await new Promise<{ ok: boolean }>((r) => sub.emit(ClientEvents.tableSubscribe, { tableId: t.tableId }, r));
    expect(ack.ok).toBe(true);
    const push = new Promise<MessageItem>((r) => sub.on(ServerEvents.messageCreated, (x: MessageItem) => { if (x.body === 'زنده') r(x); }));
    let leaked = false;
    unsub.on(ServerEvents.messageCreated, () => { leaked = true; });
    await post(a, t.tableId, 'زنده');
    expect((await push).body).toBe('زنده');
    await new Promise((r) => setTimeout(r, 200));
    expect(leaked).toBe(false);
    sub.close(); unsub.close();
  });
});
