import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { inDigestWindow, runEmailDigest, runTournamentReminders, unsubscribeToken, verifyUnsubscribeToken, type Mail, type MailSend } from '@bg/play';
import { loadConfig } from '../src/config.ts';
import { setup, testConfig, type TestCtx } from './helpers.ts';
import { call, seatsOf, startTable, users, view, type User } from './play-helpers.ts';

const { userPrivate, emailVerifications, tournaments, tournamentEntries, userSettings } = schema;
const SECRET = 'test-only-otp-hash-secret-0123456789abcdef';
const SMTP = { SMTP_HOST: 'smtp.test.invalid', SMTP_FROM: 'no-reply@test.invalid' };
const WEB = 'http://localhost:5173';

let outbox: Mail[] = [];
let failNext = false;
const send: MailSend = async (m) => { if (failNext) { failNext = false; throw new Error('smtp down'); } outbox.push(m); };
const job = { send, secret: SECRET, webUrl: WEB };

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(SMTP, undefined, { mail: send }); });
afterAll(async () => { await ctx.close(); });
beforeEach(() => { outbox = []; failNext = false; });

const codeOf = (m: Mail) => /(\d{6})/.exec(m.text)![1]!;
const me = async (u: User) => (await call(ctx, 'GET', '/api/me', u)).json();
/** Move the latest verification row back so the 60 s resend gap is over. */
const ageCodes = (u: User) => ctx.db.update(emailVerifications).set({ createdAt: sql`created_at - interval '61 seconds'` }).where(eq(emailVerifications.userId, u.id));
const verifyEmail = (u: User, email: string) => ctx.db.update(userPrivate).set({ email, emailVerifiedAt: sql`now()` }).where(eq(userPrivate.userId, u.id));

describe('email verification (phase I)', () => {
  it('sends a 6-digit code, verifies it, shows it on /me, and removes the address', async () => {
    const [u] = await users(ctx, 1);
    expect((await me(u!)).email).toEqual({ address: null, pending: null, digest: true, available: true });
    expect((await call(ctx, 'POST', '/api/me/email', u, { email: ' Player@Example.COM ' })).statusCode).toBe(204);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe('player@example.com');
    expect(outbox[0]!.html).toContain('dir="rtl"');
    const [row] = await ctx.db.select().from(emailVerifications).where(eq(emailVerifications.userId, u!.id));
    expect(row!.codeHash).not.toContain(codeOf(outbox[0]!)); // stored hashed only
    expect((await me(u!)).email.pending).toBe('player@example.com');
    expect((await call(ctx, 'POST', '/api/me/email/verify', u, { code: codeOf(outbox[0]!) })).statusCode).toBe(204);
    expect((await me(u!)).email).toEqual({ address: 'player@example.com', pending: null, digest: true, available: true });
    // The same code cannot be used again.
    expect((await call(ctx, 'POST', '/api/me/email/verify', u, { code: codeOf(outbox[0]!) })).json().errorCode).toBe('OTP_INVALID');
    expect((await call(ctx, 'PUT', '/api/me/email/digest', u, { digest: false })).statusCode).toBe(204);
    expect((await me(u!)).email.digest).toBe(false);
    expect((await call(ctx, 'DELETE', '/api/me/email', u)).statusCode).toBe(204);
    expect((await me(u!)).email.address).toBeNull();
  });

  it('rejects bad input, an address verified by someone else, and wrong codes up to the attempt limit', async () => {
    const [a, b] = await users(ctx, 2);
    expect((await call(ctx, 'POST', '/api/me/email', a, { email: 'not-an-email' })).statusCode).toBe(400);
    expect((await call(ctx, 'POST', '/api/me/email', undefined, { email: 'x@example.com' })).statusCode).toBe(401);
    await verifyEmail(a!, 'taken@example.com');
    expect((await call(ctx, 'POST', '/api/me/email', b, { email: 'taken@example.com' })).json().errorCode).toBe('EMAIL_TAKEN');
    expect((await call(ctx, 'POST', '/api/me/email', b, { email: 'b@example.com' })).statusCode).toBe(204);
    const good = codeOf(outbox.at(-1)!);
    const wrong = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) expect((await call(ctx, 'POST', '/api/me/email/verify', b, { code: wrong })).json().errorCode).toBe('OTP_INVALID');
    expect((await call(ctx, 'POST', '/api/me/email/verify', b, { code: wrong })).json().errorCode).toBe('OTP_TOO_MANY_ATTEMPTS');
    // Locked: even the right code is refused now.
    expect((await call(ctx, 'POST', '/api/me/email/verify', b, { code: good })).json().errorCode).toBe('OTP_TOO_MANY_ATTEMPTS');
    expect((await me(b!)).email.address).toBeNull();
  });

  it('expired codes fail; resend waits 60 s; at most 5 codes per hour per account and per address', async () => {
    const [u, v] = await users(ctx, 2);
    expect((await call(ctx, 'POST', '/api/me/email', u, { email: 'limit@example.com' })).statusCode).toBe(204);
    await ctx.db.update(emailVerifications).set({ expiresAt: sql`now() - interval '1 second'` }).where(eq(emailVerifications.userId, u!.id));
    expect((await call(ctx, 'POST', '/api/me/email/verify', u, { code: codeOf(outbox[0]!) })).json().errorCode).toBe('OTP_EXPIRED');
    const again = await call(ctx, 'POST', '/api/me/email', u, { email: 'limit@example.com' });
    expect(again.json()).toMatchObject({ errorCode: 'OTP_RESEND_TOO_SOON' });
    for (let i = 0; i < 4; i++) { await ageCodes(u!); expect((await call(ctx, 'POST', '/api/me/email', u, { email: `limit${i}@example.com` })).statusCode).toBe(204); }
    await ageCodes(u!);
    expect((await call(ctx, 'POST', '/api/me/email', u, { email: 'limit9@example.com' })).json().errorCode).toBe('RATE_LIMITED');
    // Per address: four codes already went to shared@example.com this hour; the fifth is sent, the sixth refused.
    await ctx.db.insert(emailVerifications).values(Array.from({ length: 4 }, () => ({ userId: u!.id, email: 'shared@example.com', codeHash: 'x', expiresAt: new Date(Date.now() + 60_000) })));
    expect((await call(ctx, 'POST', '/api/me/email', v, { email: 'shared@example.com' })).statusCode).toBe(204);
    await ageCodes(v!);
    expect((await call(ctx, 'POST', '/api/me/email', v, { email: 'shared@example.com' })).json().errorCode).toBe('RATE_LIMITED');
  });

  it('a failed SMTP send is reported and leaves no pending address', async () => {
    const [u] = await users(ctx, 1);
    failNext = true;
    expect((await call(ctx, 'POST', '/api/me/email', u, { email: 'down@example.com' })).json().errorCode).toBe('OTP_DELIVERY_FAILED');
    expect((await me(u!)).email.pending).toBeNull();
  });
});

describe('unsubscribe link', () => {
  it('a valid signed token turns email notifications off; a forged one is refused', async () => {
    const [u] = await users(ctx, 1);
    await verifyEmail(u!, 'unsub@example.com');
    const token = unsubscribeToken(SECRET, u!.id);
    expect(verifyUnsubscribeToken(SECRET, token)).toBe(u!.id);
    expect(verifyUnsubscribeToken('another-secret-0123456789abcdef0123', token)).toBeNull();
    const forged = `${u!.id}.${'A'.repeat(32)}`;
    const bad = await call(ctx, 'GET', `/api/email/unsubscribe?token=${encodeURIComponent(forged)}`);
    expect(bad.statusCode).toBe(400);
    expect((await me(u!)).email.digest).toBe(true);
    const ok = await call(ctx, 'GET', `/api/email/unsubscribe?token=${encodeURIComponent(token)}`);
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-type']).toContain('text/html');
    expect(ok.body).toContain('ایمیل‌ها خاموش شد');
    expect((await me(u!)).email.digest).toBe(false);
  });
});

describe('daily turn digest (worker side)', () => {
  // 05:35 UTC = 09:05 Tehran.
  const morning = () => { const d = new Date(); d.setUTCHours(5, 35, 0, 0); return d; };

  it('window is 09:00 to 11:59 Tehran', () => {
    expect(inDigestWindow(new Date('2026-11-25T05:29:00Z'))).toBe(false); // 08:59
    expect(inDigestWindow(new Date('2026-11-25T05:30:00Z'))).toBe(true); // 09:00
    expect(inDigestWindow(new Date('2026-11-25T08:29:00Z'))).toBe(true); // 11:59
    expect(inDigestWindow(new Date('2026-11-25T08:30:00Z'))).toBe(false); // 12:00
  });

  it('emails verified players whose turn it is, once per Tehran day, with public text and links only', async () => {
    const registry = createDefaultRegistry();
    const t = await startTable(ctx, 'line-three', 2, { pace: 'turn', turnSeconds: 86400 });
    const s = await view(ctx, t.players[0]!, t.tableId);
    const mover = (await seatsOf(ctx, t.tableId, t.players))(s.game.pendingSeats[0]);
    const waiting = t.players.find((p) => p.id !== mover.id)!;
    await verifyEmail(mover, 'mover@example.com');
    await verifyEmail(waiting, 'waiting@example.com');
    const [off] = await users(ctx, 1); // verified but notifications off: never selected
    await verifyEmail(off!, 'off@example.com');
    await ctx.db.update(userPrivate).set({ emailDigest: false }).where(eq(userPrivate.userId, off!.id));

    expect((await runEmailDigest(ctx.db, registry, job, new Date(morning().getTime() - 3_600_000))).sent).toBe(0); // 08:05
    failNext = true; // SMTP failure releases the day: retried next tick
    expect(await runEmailDigest(ctx.db, registry, job, morning())).toMatchObject({ sent: 0, failed: 1 });
    expect(await runEmailDigest(ctx.db, registry, job, morning())).toMatchObject({ sent: 1, failed: 0 });
    expect(outbox.map((m) => m.to)).toEqual(['mover@example.com']);
    const m = outbox[0]!;
    expect(m.subject).toContain('نوبت شما');
    expect(m.html).toContain(`${WEB}/tables/${t.tableId}`);
    expect(m.html).toContain('ساعت مانده');
    expect(m.headers?.['List-Unsubscribe']).toContain('/api/email/unsubscribe?token=');
    expect(m.text).not.toMatch(/state|board|hand/i);
    // Same Tehran day: nothing more.
    expect((await runEmailDigest(ctx.db, registry, job, new Date(morning().getTime() + 3_600_000))).sent).toBe(0);
    // Next day it is sent again; the in-app «turn» preference off also stops it.
    const tomorrow = new Date(morning().getTime() + 86_400_000);
    await ctx.db.insert(userSettings).values({ userId: mover.id, notify: { turn: false, invite: true, message: true, result: true, social: true } });
    expect((await runEmailDigest(ctx.db, registry, job, tomorrow)).sent).toBe(0);
    await ctx.db.update(userSettings).set({ notify: { turn: true, invite: true, message: true, result: true, social: true } }).where(eq(userSettings.userId, mover.id));
    expect((await runEmailDigest(ctx.db, registry, job, tomorrow)).sent).toBe(1);
  });
});

describe('tournament reminder (worker side)', () => {
  it('reminds verified registrants once, one hour before the start', async () => {
    const [admin, a, b] = await users(ctx, 3);
    await verifyEmail(a!, 'ta@example.com');
    const mk = async (minutes: number) => (await ctx.db.insert(tournaments).values({ gameId: 'chess', titleFa: 'جام آذر', format: 'swiss', pace: 'live', turnSeconds: 600, tableSize: 2,
      rounds: 3, minEntrants: 2, maxEntrants: 16, startsAt: new Date(Date.now() + minutes * 60_000), entryKind: 'free', createdBy: admin!.id }).returning({ id: tournaments.id }))[0]!.id;
    const soon = await mk(30), later = await mk(120);
    await ctx.db.insert(tournamentEntries).values([{ tournamentId: soon, userId: a!.id }, { tournamentId: soon, userId: b!.id }, { tournamentId: later, userId: a!.id }]);
    expect((await runTournamentReminders(ctx.db, job)).sent).toBe(1);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.to).toBe('ta@example.com');
    expect(outbox[0]!.subject).toContain('جام آذر');
    expect(outbox[0]!.html).toContain(`${WEB}/tournaments/${soon}`);
    expect((await runTournamentReminders(ctx.db, job)).sent).toBe(0);
  });
});

describe('without SMTP', () => {
  it('config needs host and from together; email off hides the card, refuses codes and reports disabled', async () => {
    expect(() => testConfig({ SMTP_HOST: 'smtp.test.invalid' })).toThrow(/SMTP_FROM/);
    expect(loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgres://x', WEB_ORIGINS: WEB, OTP_HASH_SECRET: SECRET, OTP_PROVIDER: 'fixture', OTP_FIXTURE_CODE: '123456' }).smtp).toBeNull();
    const off = await setup({}, undefined, { reset: false });
    try {
      const [u] = await users(off, 1);
      expect((await call(off, 'GET', '/api/me', u)).json().email.available).toBe(false);
      expect((await call(off, 'POST', '/api/me/email', u, { email: 'x@example.com' })).json().errorCode).toBe('SERVICE_UNAVAILABLE');
      expect((await off.app.inject({ method: 'GET', url: '/api/health/ready' })).json().checks.email).toBe('disabled');
    } finally { await off.close(); }
    expect((await ctx.app.inject({ method: 'GET', url: '/api/health/ready' })).json().checks.email).toBe('ok');
  });
});
