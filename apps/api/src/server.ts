import cluster from 'node:cluster';
import { runPrimary } from './cluster.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
if (config.workers > 1 && cluster.isPrimary) runPrimary(config.workers);
else await startWorker();

/** The app itself; imported lazily so a cluster primary (supervision only) never loads the games or the database. */
async function startWorker() {
  const [{ createDb }, { createDefaultRegistry }, { defaultMatchConfig }, { billingFor, buildApp }, { clusterMetrics }, { localMetrics }, { createDelivery }, { attachRealtime }] = await Promise.all([
    import('@bg/db'), import('@bg/game-engine'), import('@bg/play'), import('./app.ts'), import('./cluster.ts'),
    import('./metrics.ts'), import('./modules/auth/delivery.ts'), import('./realtime/socket.ts')
  ]);
  const { db, client, close } = createDb(config.databaseUrl);
  const registry = createDefaultRegistry();
  const app = await buildApp({ config, db, delivery: createDelivery(config), registry, play: config.play, match: defaultMatchConfig, billing: billingFor(config, db), collectMetrics: clusterMetrics(localMetrics) });
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
}
