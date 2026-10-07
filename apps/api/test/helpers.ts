import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { createDb, schema, seed, type Db } from '@bg/db';
import { createDefaultRegistry, type GameRegistry } from '@bg/game-engine';
import { defaultMatchConfig, type BillingConfig, type MatchConfig } from '@bg/play';
import { billingFor, buildApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { fixtureDelivery } from '../src/modules/auth/delivery.ts';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
  ?? 'postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame_test';
export const ORIGIN = 'http://localhost:5173';
export const FIXTURE_CODE = '123456';

export const testConfig = (overrides: Record<string, string> = {}) => loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DATABASE_URL,
  WEB_ORIGINS: `${ORIGIN},http://127.0.0.1:5173`,
  OTP_HASH_SECRET: 'test-only-otp-hash-secret-0123456789abcdef',
  OTP_PROVIDER: 'fixture',
  OTP_FIXTURE_CODE: FIXTURE_CODE,
  LOG_LEVEL: 'silent',
  OTP_REQUESTS_PER_IP_PER_10_MIN: '1000',
  PAYMENT_PROVIDER: 'fake',
  ...overrides
});

export interface TestCtx { app: FastifyInstance; db: Db; close: () => Promise<void>; logs: string[] }

export async function setup(overrides: Record<string, string> = {}, registry: GameRegistry = createDefaultRegistry(), opts: { reset?: boolean; match?: MatchConfig; billing?: (db: Db) => BillingConfig } = {}): Promise<TestCtx> {
  const config = testConfig(overrides);
  const { db, close } = createDb(TEST_DATABASE_URL, { max: 5 });
  if (opts.reset !== false) await resetData(db);
  const logs: string[] = [];
  const app = await buildApp({ config, db, delivery: fixtureDelivery(FIXTURE_CODE), registry, play: config.play, match: opts.match ?? defaultMatchConfig, billing: opts.billing ? opts.billing(db) : billingFor(config, db) },
    { logStream: { write: (m: string) => { logs.push(m); } } });
  await app.ready();
  return { app, db, logs, close: async () => { await app.close(); await close(); } };
}

/** Wipe mutable data between files; catalog rows are re-seeded fresh. */
export async function resetData(db: Db): Promise<void> {
  await db.execute(sql`truncate audit_log, outbox_events, platform_incidents, conversations, payment_events, fake_gateway_transactions, seasons, mission_definitions, achievement_definitions, plans, sessions, otp_challenges, user_roles, user_private, users, game_versions, games restart identity cascade`);
  await seed(db);
}

export const post = (app: FastifyInstance, url: string, payload: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers: { origin: ORIGIN, ...headers } });

let mobileSeq = 1000000;
export const nextMobile = () => `0912${String(mobileSeq++).padStart(7, '0')}`;

/** Full OTP login; returns the session cookie header value. */
export async function login(app: FastifyInstance, mobile = nextMobile()): Promise<{ cookie: string; mobile: string }> {
  const req = await post(app, '/api/auth/otp/request', { mobile });
  if (req.statusCode !== 200) throw new Error(`otp request failed ${req.body}`);
  const res = await post(app, '/api/auth/otp/verify', { challengeId: req.json().challengeId, code: FIXTURE_CODE });
  if (res.statusCode !== 200) throw new Error(`otp verify failed ${res.body}`);
  const c = res.cookies.find((x) => x.name === 'bg_sid');
  if (!c) throw new Error('no session cookie');
  return { cookie: `bg_sid=${c.value}`, mobile };
}

export async function grantRole(db: Db, mobile: string, role: 'admin' | 'moderator'): Promise<void> {
  const { userPrivate, userRoles } = schema;
  const [u] = await db.select().from(userPrivate).where(sql`${userPrivate.mobile} = ${mobile}`);
  await db.insert(userRoles).values({ userId: u!.userId, role });
}
