import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_ALERT_PREFS } from '@bg/contracts';
import { schema } from '@bg/db';
import { buildPushPayload, deliverPush, runOutbox, setPushSender, type PushSend } from '@bg/play';
import { tournamentIcs } from '../src/modules/tournaments/routes.ts';
import { setup, type TestCtx } from './helpers.ts';
import { call, users, type User } from './play-helpers.ts';

const { pushSubscriptions, notifications, userSettings, tournaments } = schema;
const KEY = 'BTestOnlyVapidPublicKey_0123456789abcdefghijklmnopqrstuvwxyz-ABCDEFGHIJ';
const sub = (n: number) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/test-${n}`, keys: { p256dh: 'BPublicKeyForTests0123456789', auth: 'authSecret12' } });

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup({ WEB_PUSH_PUBLIC_KEY: KEY }); });
afterAll(async () => { await ctx.close(); });
afterEach(() => setPushSender(null));

const subsOf = (u: User) => ctx.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, u.id));

describe('web push subscriptions', () => {
  it('serves the public key, upserts by endpoint, rejects non-push hosts and deletes by endpoint', async () => {
    expect((await call(ctx, 'GET', '/api/push/key')).json()).toEqual({ publicKey: KEY });
    const [a, b] = await users(ctx, 2);
    expect((await call(ctx, 'POST', '/api/me/push/subscriptions', undefined, sub(1))).statusCode).toBe(401);
    expect((await call(ctx, 'POST', '/api/me/push/subscriptions', a, sub(1))).statusCode).toBe(204);
    expect((await call(ctx, 'POST', '/api/me/push/subscriptions', a, sub(1))).statusCode).toBe(204);
    expect(await subsOf(a!)).toHaveLength(1);
    // SSRF guard: only browser push services, https, no port.
    for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://evil.example/x', 'https://fcm.googleapis.com:8443/x', 'https://fcm.googleapis.com.evil.example/x']) {
      expect((await call(ctx, 'POST', '/api/me/push/subscriptions', a, { ...sub(9), endpoint })).statusCode).toBe(400);
    }
    // Same browser signs in as another account: the endpoint moves.
    expect((await call(ctx, 'POST', '/api/me/push/subscriptions', b, sub(1))).statusCode).toBe(204);
    expect(await subsOf(a!)).toHaveLength(0);
    expect(await subsOf(b!)).toHaveLength(1);
    expect((await call(ctx, 'DELETE', '/api/me/push/subscriptions', a, { endpoint: sub(1).endpoint })).statusCode).toBe(204);
    expect(await subsOf(b!)).toHaveLength(1); // not a's to delete
    expect((await call(ctx, 'DELETE', '/api/me/push/subscriptions', b, { endpoint: sub(1).endpoint })).statusCode).toBe(204);
    expect(await subsOf(b!)).toHaveLength(0);
  });

  it('is 404 when no VAPID key is configured', async () => {
    const off = await setup({}, undefined, { reset: false });
    try {
      expect((await off.app.inject({ method: 'GET', url: '/api/push/key' })).statusCode).toBe(404);
    } finally { await off.close(); }
  });
});

describe('web push delivery (worker side, web-push mocked)', () => {
  it('sends the public notification text to every subscription and deletes 410 endpoints', async () => {
    const [a, b] = await users(ctx, 2);
    await call(ctx, 'POST', '/api/me/push/subscriptions', b, sub(2));
    await call(ctx, 'POST', '/api/me/push/subscriptions', b, sub(3));
    const sent: { endpoint: string; body: string }[] = [];
    const send: PushSend = async (s, body) => {
      if (s.endpoint.endsWith('test-3')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      sent.push({ endpoint: s.endpoint, body });
    };
    setPushSender(send);
    await call(ctx, 'POST', '/api/friends/requests', a, { userId: b!.id });
    const r = await runOutbox(ctx.db);
    expect(r.failed).toBe(0);
    expect(sent).toHaveLength(1);
    const payload = JSON.parse(sent[0]!.body);
    expect(payload).toMatchObject({ title: 'بردگیم‌ورس', url: '/friends' });
    expect(payload.body).toContain('درخواست دوستی');
    expect(Object.keys(payload).sort()).toEqual(['body', 'tag', 'title', 'url']);
    const left = await subsOf(b!);
    expect(left.map((s) => s.endpoint)).toEqual([sub(2).endpoint]);
    expect(left[0]!.lastSuccessAt).not.toBeNull();
  });

  it('a throwing push service never fails the outbox event', async () => {
    const [a, b] = await users(ctx, 2);
    await call(ctx, 'POST', '/api/me/push/subscriptions', b, sub(4));
    setPushSender(async () => { throw new Error('network down'); });
    await call(ctx, 'POST', '/api/friends/requests', a, { userId: b!.id });
    expect((await runOutbox(ctx.db)).failed).toBe(0);
    expect(await subsOf(b!)).toHaveLength(1); // only 404/410 delete
  });

  it('quiet hours (Tehran time) skip the push but keep the in-app row; payload builder uses the list text', async () => {
    const [u] = await users(ctx, 1);
    await call(ctx, 'POST', '/api/me/push/subscriptions', u, sub(5));
    const [n] = await ctx.db.insert(notifications).values({ userId: u!.id, kind: 'turn', payload: { tableId: '00000000-0000-4000-8000-000000000001', gameNameFa: 'شطرنج' }, dedupeKey: `t-${u!.id}` }).returning();
    expect(buildPushPayload(n!)).toEqual({ title: 'بردگیم‌ورس', body: 'نوبت شما در «شطرنج» است.', url: '/tables/00000000-0000-4000-8000-000000000001', tag: 'turn:00000000-0000-4000-8000-000000000001' });
    let calls = 0;
    setPushSender(async () => { calls++; });
    await ctx.db.insert(userSettings).values({ userId: u!.id, alerts: { ...DEFAULT_ALERT_PREFS, quietHours: { enabled: true, startHour: 23, endHour: 7 } } })
      .onConflictDoUpdate({ target: userSettings.userId, set: { alerts: { ...DEFAULT_ALERT_PREFS, quietHours: { enabled: true, startHour: 23, endHour: 7 } } } });
    // 22:00 UTC = 01:30 Tehran (quiet); 08:00 UTC = 11:30 Tehran (not quiet).
    expect(await deliverPush(ctx.db, n!, new Date('2026-11-25T22:00:00Z'))).toEqual({ sent: 0, removed: 0, skipped: 'quiet' });
    expect(calls).toBe(0);
    expect(await deliverPush(ctx.db, n!, new Date('2026-11-25T08:00:00Z'))).toEqual({ sent: 1, removed: 0 });
    expect(calls).toBe(1);
    setPushSender(null);
    expect((await deliverPush(ctx.db, n!)).skipped).toBe('disabled');
  });
});

describe('tournament calendar', () => {
  it('GET /tournaments/:id/calendar.ics returns one VEVENT at startsAt with a 15-minute alarm', async () => {
    const startsAt = new Date('2026-12-01T16:30:00Z');
    const [admin] = await users(ctx, 1);
    const [t] = await ctx.db.insert(tournaments).values({ gameId: 'chess', titleFa: 'جام آذر; ویژه, شطرنج', format: 'swiss', pace: 'live', turnSeconds: 600, tableSize: 2,
      rounds: 3, minEntrants: 2, maxEntrants: 16, startsAt, entryKind: 'free', createdBy: admin!.id }).returning({ id: tournaments.id });
    const res = await call(ctx, 'GET', `/api/tournaments/${t!.id}/calendar.ics`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    const body = res.body;
    expect(body.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(body).toContain('DTSTART:20261201T163000Z');
    expect(body).toContain('TRIGGER:-PT15M');
    expect(body).toContain(`URL:http://localhost:5173/tournaments/${t!.id}`);
    expect(body.replace(/\r\n /g, '')).toContain('SUMMARY:جام آذر\\; ویژه\\, شطرنج');
    for (const line of body.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect((await call(ctx, 'GET', '/api/tournaments/00000000-0000-4000-8000-000000000000/calendar.ics')).statusCode).toBe(404);
  });

  it('folds long Persian lines without splitting a character', () => {
    const ics = tournamentIcs({ id: 'x', titleFa: 'تورنمنت '.repeat(30), gameNameFa: 'شطرنج', startsAt: new Date(0) }, 'https://example.ir');
    const lines = ics.split('\r\n');
    for (const l of lines) expect(Buffer.byteLength(l)).toBeLessThanOrEqual(75);
    expect(lines.join('\r\n').replace(/\r\n /g, '')).toContain(`SUMMARY:${'تورنمنت '.repeat(30)}`);
  });
});
