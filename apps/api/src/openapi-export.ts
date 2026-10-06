// Prints the OpenAPI document without a database or listening socket: `pnpm --filter @bg/api openapi > openapi.json`
import { createDefaultRegistry } from '@bg/game-engine';
import { defaultMatchConfig } from '@bg/play';
import { billingFor, buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { fixtureDelivery } from './modules/auth/delivery.ts';

const config = loadConfig({
  NODE_ENV: 'development', DATABASE_URL: 'postgres://unused@127.0.0.1/unused', WEB_ORIGINS: 'http://localhost:5173',
  OTP_HASH_SECRET: 'x'.repeat(32), OTP_PROVIDER: 'fixture', OTP_FIXTURE_CODE: '000000', LOG_LEVEL: 'silent'
});
const app = await buildApp({ config, db: null as never, delivery: fixtureDelivery('000000'), registry: createDefaultRegistry(), play: config.play, match: defaultMatchConfig, billing: billingFor(config, null as never) });
await app.ready();
process.stdout.write(JSON.stringify(app.swagger(), null, 2) + '\n');
await app.close();
