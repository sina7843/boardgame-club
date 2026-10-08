import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIXTURE_CODE, nextMobile, ORIGIN, post, setup, testConfig, type TestCtx } from './helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup({ LOG_LEVEL: 'info' }); });
afterAll(async () => { await ctx.close(); });

const get = (url: string) => ctx.app.inject({ method: 'GET', url });

describe('catalog search and filters (FR-02)', () => {
  const ids = async (qs: string) => (await get(`/api/games${qs}`)).json().items.map((g: { id: string }) => g.id).sort();

  it('lists the catalog; only the engine fixtures are labelled test games', async () => {
    const items = (await get('/api/games')).json().items as { id: string; isTestGame: boolean }[];
    expect(items.map((g) => g.id)).toEqual(['unmatched', 'othello', 'amlak', 'uno', 'ticket-to-ride', 'backgammon', 'risk', 'line-three', 'chess', 'snakes-ladders', 'sealed-bids', 'ludo', 'checkers', 'catan', 'quoridor']);
    expect(items.filter((g) => g.isTestGame).map((g) => g.id)).toEqual(['line-three', 'sealed-bids']);
  });

  it('matches Persian names regardless of Arabic ي/ك and original names case-insensitively', async () => {
    expect(await ids(`?q=${encodeURIComponent('مزايده')}`)).toEqual(['sealed-bids']);
    expect(await ids(`?q=${encodeURIComponent('سه‌خطي')}`)).toEqual(['line-three']);
    expect(await ids('?q=LINE')).toEqual(['line-three']);
    expect(await ids(`?q=${encodeURIComponent('%')}`)).toEqual([]);
  });

  it('filters by players, time, difficulty, mode and access', async () => {
    expect(await ids('?players=4')).toEqual(['amlak', 'catan', 'ludo', 'quoridor', 'risk', 'sealed-bids', 'snakes-ladders', 'ticket-to-ride', 'unmatched', 'uno']);
    expect(await ids('?players=8')).toEqual(['amlak', 'uno']);
    expect(await ids('?maxMinutes=3')).toEqual(['line-three']);
    expect(await ids('?difficulty=medium')).toEqual(['amlak', 'backgammon', 'catan', 'chess', 'risk', 'sealed-bids', 'unmatched']);
    expect(await ids('?mode=turn')).toEqual(['amlak', 'backgammon', 'catan', 'checkers', 'chess', 'line-three', 'ludo', 'othello', 'quoridor', 'risk', 'sealed-bids', 'snakes-ladders', 'ticket-to-ride', 'unmatched', 'uno']);
    expect(await ids('?access=premium')).toEqual([]);
    expect((await get('/api/games?players=abc')).json().errorCode).toBe('VALIDATION_FAILED');
  });

  it('game detail exposes rules, policies and the active version before joining (FR-03)', async () => {
    const d = (await get('/api/games/sealed-bids')).json();
    expect(d).toMatchObject({ minPlayers: 2, maxPlayers: 4, access: 'free', acceptingNewTables: true,
      activeVersion: { rulesVersion: '1.0.0', stateSchemaVersion: 1 } });
    expect(d.rulesFa.length).toBeGreaterThan(0);
    expect(d.timeoutPolicyFa).toBeTruthy();
    expect((await get('/api/games/nope')).statusCode).toBe(404);
  });
});

describe('HTTP platform controls', () => {
  it('rejects state-changing requests without an allowed Origin (CSRF)', async () => {
    const none = await ctx.app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { mobile: nextMobile() } });
    expect(none.statusCode).toBe(403);
    expect(none.json().errorCode).toBe('CSRF_ORIGIN_REJECTED');
    const foreign = await post(ctx.app, '/api/auth/otp/request', { mobile: nextMobile() }, { origin: 'https://evil.example' });
    expect(foreign.statusCode).toBe(403);
  });

  it('returns safe error envelopes with a request id header', async () => {
    const res = await get('/api/does-not-exist');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ errorCode: 'NOT_FOUND', messageFa: expect.any(String), requestId: res.headers['x-request-id'] });
    const malformed = await ctx.app.inject({ method: 'POST', url: '/api/auth/otp/request',
      headers: { origin: ORIGIN, 'content-type': 'application/json' }, payload: '{bad' });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.body).not.toMatch(/at .*\.ts/);
  });

  it('health live/ready report status', async () => {
    expect((await get('/api/health/live')).json()).toEqual({ status: 'ok' });
    expect((await get('/api/health/ready')).json()).toEqual({ status: 'ok', checks: { database: 'ok', migrations: 'ok' } });
  });

  it('serves an OpenAPI document', async () => {
    const doc = (await get('/api/openapi.json')).json();
    expect(doc.openapi).toMatch(/^3\./);
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/api/auth/otp/request', '/api/games', '/api/games/{id}']));
  });

  it('never writes mobile numbers, OTP codes or session cookies to logs', async () => {
    const mobile = '09351234567';
    const r = await post(ctx.app, '/api/auth/otp/request', { mobile });
    const v = await post(ctx.app, '/api/auth/otp/verify', { challengeId: r.json().challengeId, code: FIXTURE_CODE });
    const sid = v.cookies.find((c) => c.name === 'bg_sid')!.value;
    await ctx.app.inject({ method: 'GET', url: '/api/me', headers: { cookie: `bg_sid=${sid}` } });
    const all = ctx.logs.join('\n');
    expect(all.length).toBeGreaterThan(0);
    expect(all).not.toContain(mobile);
    expect(all).not.toContain(sid);
    expect(all).not.toContain(`"${FIXTURE_CODE}"`);
  });
});

describe('configuration fails closed', () => {
  const prod = { NODE_ENV: 'production', WEB_ORIGINS: 'https://app.example', DATABASE_URL: 'postgres://u:p@db/x',
    OTP_HASH_SECRET: 'p'.repeat(40) };
  it('refuses the OTP fixture in production', () => {
    expect(() => testConfig(prod)).toThrow(/OTP_PROVIDER=fixture is development-only/);
  });
  it('a test server may opt in to the OTP fixture and the fake gateway, but not with an obvious code', () => {
    const test = { ...prod, ALLOW_TEST_PROVIDERS: 'true', PAYMENT_PROVIDER: 'fake' };
    expect(testConfig({ ...test, OTP_FIXTURE_CODE: '482917' })).toMatchObject({ isProd: true, allowTestProviders: true });
    expect(() => testConfig({ ...test, OTP_FIXTURE_CODE: '123456' })).toThrow(/private, non-obvious code/);
    expect(testConfig({ ...prod, PAYMENT_PROVIDER: 'none', OTP_PROVIDER: 'kavenegar', KAVENEGAR_API_KEY: 'k'.repeat(30), KAVENEGAR_VERIFY_TEMPLATE: 'verify' }).allowTestProviders).toBe(false);
  });
  it('refuses placeholder secrets and http origins in production', () => {
    expect(() => testConfig({ ...prod, OTP_HASH_SECRET: 'local-only-otp-hash-secret-change-me-0000', WEB_ORIGINS: 'http://x.example' }))
      .toThrow(/placeholder secrets.*https/);
  });
  it('treats empty optional values from orchestrators as unset', () => {
    expect(testConfig({ PUBLIC_WEB_URL: '', METRICS_TOKEN: '' }).metricsToken).toBeNull();
    expect(() => testConfig({ ...prod, OTP_PROVIDER: '' })).toThrow(/OTP_PROVIDER/);
  });
  it('rejects missing required settings', () => {
    expect(() => testConfig({ OTP_HASH_SECRET: 'short' })).toThrow(/OTP_HASH_SECRET/);
  });
});
