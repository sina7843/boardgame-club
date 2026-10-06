import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { ServerEvents } from '@bg/contracts';
import { createDefaultRegistry } from '@bg/game-engine';
import { attachRealtime } from '../src/realtime/socket.ts';
import { login, ORIGIN, setup, testConfig, type TestCtx } from './helpers.ts';

let ctx: TestCtx;
let url: string;
let io: Awaited<ReturnType<typeof attachRealtime>>;
beforeAll(async () => {
  ctx = await setup();
  io = await attachRealtime(ctx.app.server, testConfig(), ctx.db, createDefaultRegistry());
  await ctx.app.listen({ host: '127.0.0.1', port: 0 });
  url = `http://127.0.0.1:${(ctx.app.server.address() as AddressInfo).port}`;
});
afterAll(async () => { await io.close(); await ctx.close(); });

function open(headers: Record<string, string>): Promise<{ socket: Socket; ready?: unknown; error?: string }> {
  return new Promise((resolve) => {
    const socket = connect(url, { path: '/api/socket.io', transports: ['websocket'], extraHeaders: headers, reconnection: false });
    socket.on(ServerEvents.sessionReady, (ready) => resolve({ socket, ready }));
    socket.on('connect_error', (e) => resolve({ socket, error: e.message }));
  });
}

describe('Socket.IO identity', () => {
  it('rejects connections without a session', async () => {
    const r = await open({ origin: ORIGIN });
    expect(r.error).toBe('UNAUTHENTICATED');
    r.socket.close();
  });

  it('rejects foreign origins before the handshake', async () => {
    const u = await login(ctx.app);
    const r = await open({ origin: 'https://evil.example', cookie: u.cookie });
    expect(r.error).toBeDefined();
    expect(r.ready).toBeUndefined();
    r.socket.close();
  });

  it('pins the actor from the server session, ignoring client-claimed identity', async () => {
    const u = await login(ctx.app);
    const me = (await ctx.app.inject({ method: 'GET', url: '/api/me', headers: { cookie: u.cookie } })).json();
    const r = await open({ origin: ORIGIN, cookie: u.cookie, 'x-actor-id': '00000000-0000-4000-8000-000000000000' });
    expect(r.ready).toMatchObject({ userId: me.id });
    r.socket.close();
  });
});
