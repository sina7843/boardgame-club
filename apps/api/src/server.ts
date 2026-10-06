import { createDb } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { defaultMatchConfig } from '@bg/play';
import { billingFor, buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createDelivery } from './modules/auth/delivery.ts';
import { attachRealtime } from './realtime/socket.ts';

const config = loadConfig();
const { db, client, close } = createDb(config.databaseUrl);
const registry = createDefaultRegistry();
const app = await buildApp({ config, db, delivery: createDelivery(config), registry, play: config.play, match: defaultMatchConfig, billing: billingFor(config, db) });
const io = await attachRealtime(app.server, config, db, registry, client, app.log);

await app.listen({ host: config.host, port: config.port });

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    app.log.info({ signal }, 'shutting down');
    await io.close();
    await app.close();
    await close();
    process.exit(0);
  });
}
