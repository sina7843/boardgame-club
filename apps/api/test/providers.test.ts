import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema } from '@bg/db';
import { zarinpalGateway } from '@bg/play';
import { kavenegarDelivery, toKavenegarReceptor } from '../src/modules/auth/kavenegar.ts';
import { grantRole, setup, testConfig, type TestCtx } from './helpers.ts';
import { call, users, type User } from './play-helpers.ts';

// Real providers (Kavenegar SMS, Zarinpal) against a scripted stand-in for the network: no real requests are made.
const KEY = 'TEST-KAVENEGAR-KEY-0123456789abcdef';
const MERCHANT = '11111111-2222-3333-4444-555555555555';
type Call = { url: string; init?: RequestInit };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Kavenegar OTP delivery', () => {
  it('sends the code through the approved Verify Lookup template', async () => {
    const calls: Call[] = [];
    const d = kavenegarDelivery({ apiKey: KEY, template: 'verify', fetchImpl: (async (url: string, init?: RequestInit) => { calls.push({ url, init }); return json(200, { return: { status: 200, message: 'تایید شد' }, entries: [] }); }) as typeof fetch });
    expect(d.isFixture).toBe(false);
    expect(d.issueCode(() => '482913')).toBe('482913'); // real codes come from the server's generator
    await d.send('09121234567', '482913');
    const u = new URL(calls[0]!.url);
    expect(u.origin + u.pathname).toBe(`https://api.kavenegar.com/v1/${KEY}/verify/lookup.json`);
    expect(Object.fromEntries(u.searchParams)).toEqual({ receptor: '09121234567', token: '482913', template: 'verify' });
  });

  it('logical errors with HTTP 200 fail, and errors never contain the API key', async () => {
    const d = kavenegarDelivery({ apiKey: KEY, template: 'verify', fetchImpl: (async () => json(200, { return: { status: 411, message: 'template not found' } })) as typeof fetch });
    const err = await d.send('09121234567', '111111').catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('411');
    expect((err as Error).message).not.toContain(KEY);
  });

  it('normalizes receptors', () => {
    expect(toKavenegarReceptor('989121234567')).toBe('09121234567');
    expect(toKavenegarReceptor('09121234567')).toBe('09121234567');
    expect(() => toKavenegarReceptor('12345')).toThrow();
  });
});

describe('Zarinpal gateway', () => {
  const gw = (respond: (url: string, body: Record<string, unknown>) => Response, sandbox = true, calls: Call[] = []) =>
    zarinpalGateway({ merchantId: MERCHANT, sandbox, callbackUrl: 'https://play.example/api/payments/callback/zarinpal',
      fetchImpl: (async (url: string, init?: RequestInit) => { calls.push({ url, init }); return respond(url, JSON.parse(String(init?.body))); }) as typeof fetch });

  it('creates a payment in Rial and returns the StartPay URL (sandbox and production hosts)', async () => {
    const calls: Call[] = [];
    const r = await gw(() => json(200, { data: { code: 100, authority: 'A0000000000000000000000000000012345' }, errors: [] }), true, calls)
      .create({ orderId: 'O1', amount: 4_900_000, currency: 'IRR', callbackUrl: 'ignored', description: 'پریمیوم ماهانه' });
    expect(calls[0]!.url).toBe('https://sandbox.zarinpal.com/pg/v4/payment/request.json');
    expect(JSON.parse(String(calls[0]!.init!.body))).toMatchObject({ merchant_id: MERCHANT, amount: 4_900_000, currency: 'IRR', callback_url: 'https://play.example/api/payments/callback/zarinpal' });
    expect(r.redirectUrl).toBe('https://sandbox.zarinpal.com/pg/StartPay/A0000000000000000000000000000012345');
    const prod = await gw(() => json(200, { data: { code: 100, authority: 'A1' }, errors: [] }), false).create({ orderId: 'O2', amount: 10, currency: 'IRR', callbackUrl: '', description: 'x' });
    expect(prod.redirectUrl).toBe('https://www.zarinpal.com/pg/StartPay/A1');
  });

  it('a rejected request throws without exposing the merchant id', async () => {
    const err = await gw(() => json(400, { data: [], errors: { code: -9, message: 'validation error' } })).create({ orderId: 'O', amount: 1, currency: 'IRR', callbackUrl: '', description: 'x' }).catch((e: Error) => e);
    expect((err as Error).message).toContain('-9');
    expect((err as Error).message).not.toContain(MERCHANT);
  });

  it('maps verify codes: 100/101 paid, -50/-54 failed, -51 and network errors stay pending', async () => {
    const verify = (resp: () => Response) => gw(resp).verify({ authority: 'A1', amount: 500 });
    expect(await verify(() => json(200, { data: { code: 100, ref_id: 201 }, errors: [] }))).toEqual({ status: 'paid', refId: '201', paidAmount: 500 });
    expect(await verify(() => json(200, { data: { code: 101, ref_id: 201 }, errors: [] }))).toEqual({ status: 'paid', refId: '201', paidAmount: 500 });
    expect(await verify(() => json(400, { data: [], errors: { code: -50 } }))).toEqual({ status: 'failed', reason: 'AMOUNT_MISMATCH' });
    expect(await verify(() => json(400, { data: [], errors: { code: -54 } }))).toEqual({ status: 'failed', reason: 'UNKNOWN_AUTHORITY' });
    expect(await verify(() => json(400, { data: [], errors: { code: -51 } }))).toEqual({ status: 'pending' });
    expect(await gw(() => { throw new Error('ECONNRESET'); }).verify({ authority: 'A1', amount: 500 })).toEqual({ status: 'pending' });
  });
});

describe('provider configuration', () => {
  const prod = { NODE_ENV: 'production', WEB_ORIGINS: 'https://play.example', DATABASE_URL: 'postgres://u:p@db/x', OTP_HASH_SECRET: 'p'.repeat(40) };
  it('production starts with real providers and refuses the Zarinpal sandbox', () => {
    const c = testConfig({ ...prod, OTP_PROVIDER: 'kavenegar', KAVENEGAR_API_KEY: KEY, KAVENEGAR_VERIFY_TEMPLATE: 'verify', PAYMENT_PROVIDER: 'zarinpal', ZARINPAL_MERCHANT_ID: MERCHANT });
    expect(c.isProd).toBe(true);
    expect(c.payments.zarinpal).toEqual({ merchantId: MERCHANT, sandbox: false });
    expect(() => testConfig({ ...prod, OTP_PROVIDER: 'kavenegar', KAVENEGAR_API_KEY: KEY, KAVENEGAR_VERIFY_TEMPLATE: 'verify', PAYMENT_PROVIDER: 'zarinpal', ZARINPAL_MERCHANT_ID: MERCHANT, ZARINPAL_SANDBOX: 'true' }))
      .toThrow(/ZARINPAL_SANDBOX=true/);
  });
  it('credentials are required for the chosen provider', () => {
    expect(() => testConfig({ OTP_PROVIDER: 'kavenegar' })).toThrow(/KAVENEGAR_API_KEY/);
    expect(() => testConfig({ PAYMENT_PROVIDER: 'zarinpal' })).toThrow(/ZARINPAL_MERCHANT_ID/);
  });
});

// End to end through the API: checkout → Zarinpal redirect → buyer returns → server verify → subscription.
describe('Zarinpal through the platform', () => {
  let ctx: TestCtx;
  let admin: User;
  let monthly: string;
  const verifyCode = new Map<string, number>(); // authority → code Zarinpal will answer
  let seq = 0;
  beforeAll(async () => {
    ctx = await setup({}, undefined, {
      billing: () => ({
        gateway: zarinpalGateway({ merchantId: MERCHANT, sandbox: true, callbackUrl: 'http://localhost:5173/api/payments/callback/zarinpal',
          fetchImpl: (async (url: string, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body)) as { authority?: string };
            if (url.endsWith('/request.json')) return json(200, { data: { code: 100, authority: `A${String(++seq).padStart(35, '0')}` }, errors: [] });
            const code = verifyCode.get(body.authority!) ?? -51;
            return code === 100 || code === 101 ? json(200, { data: { code, ref_id: 7000 + seq }, errors: [] }) : json(400, { data: [], errors: { code } });
          }) as typeof fetch }),
        unavailableReasonFa: null, callbackUrl: 'http://localhost:5173/api/payments/callback', paymentTtlMinutes: 30
      })
    });
    [admin] = (await users(ctx, 1)) as [User];
    await grantRole(ctx.db, admin.mobile, 'admin');
    monthly = (await ctx.db.select().from(schema.plans).where(eq(schema.plans.key, 'premium-monthly')))[0]!.id;
    await call(ctx, 'PATCH', `/api/admin/plans/${monthly}`, admin, { priceAmount: 4_900_000, active: true, reason: 'قیمت آزمایشی' });
  });
  afterAll(async () => { await ctx.close(); });

  const checkout = async (u: User) => {
    const r = await call(ctx, 'POST', '/api/subscriptions/checkout', u, { planId: monthly });
    expect(r.statusCode).toBe(200);
    const { orderId, redirectUrl } = r.json();
    expect(redirectUrl).toMatch(/^https:\/\/sandbox\.zarinpal\.com\/pg\/StartPay\/A\d{35}$/);
    return { orderId: orderId as string, authority: redirectUrl.split('/').pop() as string };
  };
  const back = (authority: string, status: 'OK' | 'NOK') => ctx.app.inject({ method: 'GET', url: `/api/payments/callback/zarinpal?Authority=${authority}&Status=${status}` });
  const sub = async (u: User) => (await call(ctx, 'GET', '/api/me/subscription', u)).json();

  it('Status=OK + verify 100 activates once; a repeated callback (101) changes nothing', async () => {
    const [u] = await users(ctx, 1);
    const { orderId, authority } = await checkout(u!);
    verifyCode.set(authority, 100);
    expect((await back(authority, 'OK')).headers.location).toContain(`order=${orderId}`);
    verifyCode.set(authority, 101);
    await back(authority, 'OK');
    const s = await sub(u!);
    expect(s.premium).toBe(true);
    expect(s.subscriptions).toHaveLength(1);
    expect(s.payments[0]).toMatchObject({ orderId, status: 'verified' });
  });

  it('Status=NOK fails the payment without access; an unfinished payment stays pending', async () => {
    const [u, w] = await users(ctx, 2);
    const a = await checkout(u!);
    await back(a.authority, 'NOK');
    expect((await sub(u!)).premium).toBe(false);
    expect((await call(ctx, 'GET', `/api/payments/${a.orderId}`, u)).json()).toMatchObject({ status: 'failed', failureReason: 'CANCELLED_BY_PAYER' });
    const b = await checkout(w!); // buyer still on Zarinpal: verify answers -51
    expect((await call(ctx, 'POST', `/api/payments/${b.orderId}/verify`, w)).json().status).toBe('pending');
  });
});
