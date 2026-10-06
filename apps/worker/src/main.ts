import { createServer } from 'node:http';
import { z } from 'zod';
import { createDb } from '@bg/db';
import { createDefaultRegistry } from '@bg/game-engine';
import { defaultMatchConfig, expireSubscriptions, fakeGateway, reconcilePayments, runDueDeadlines, runMatchmaking, runOutbox, type BillingConfig } from '@bg/play';
import { runMaintenance } from './maintenance.ts';

const env = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//),
  WORKER_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(60),
  DEADLINE_POLL_MS: z.coerce.number().int().min(200).max(10_000).default(1000),
  /** Optional liveness endpoint (GET /health) for orchestrators and E2E runs. */
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PAYMENT_PROVIDER: z.enum(['none', 'fake']).default('none'),
  WEB_ORIGINS: z.string().default('http://localhost:5173')
}).parse(process.env);

const { db, close } = createDb(env.DATABASE_URL, { max: 4 });
const registry = createDefaultRegistry();
if (env.NODE_ENV === 'production' && env.PAYMENT_PROVIDER === 'fake') {
  console.error('Refusing to start: PAYMENT_PROVIDER=fake is development-only.');
  process.exit(1);
}
const web = env.WEB_ORIGINS.split(',')[0]!.trim();
const billing: BillingConfig = {
  gateway: env.PAYMENT_PROVIDER === 'fake' ? fakeGateway(db, web) : null,
  unavailableReasonFa: null, callbackUrl: `${web}/api/payments/callback`, paymentTtlMinutes: 30
};
const log = (msg: string, data: object = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), msg, ...data }));
const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

let stopping = false;
let inFlight = 0;
/** Per-loop counters for /metrics (aggregate numbers only). */
const stats: Record<string, { runs: number; failures: number; lastMs: number; totals: Record<string, number> }> = {};

/** Run `job` every `ms`, never overlapping itself; failures are logged and retried next tick (state is in PostgreSQL). */
function loop(name: string, ms: number, job: () => Promise<object | void>) {
  const s: (typeof stats)[string] = (stats[name] = { runs: 0, failures: 0, lastMs: 0, totals: {} });
  const tick = async () => {
    if (stopping) return;
    const started = performance.now();
    inFlight++;
    try {
      const r = await job();
      s.runs++;
      s.lastMs = performance.now() - started;
      for (const [k, v] of Object.entries(r ?? {})) if (typeof v === 'number') s.totals[k] = (s.totals[k] ?? 0) + v;
      if (r && Object.values(r).some((v) => typeof v === 'number' && v > 0)) log(name, r);
    } catch (err) {
      s.failures++;
      log(`${name} failed`, { error: errText(err) });
    } finally {
      inFlight--;
    }
    lastTick = Date.now();
    if (!stopping) setTimeout(tick, ms);
  };
  void tick();
}

let lastTick = Date.now();
if (env.WORKER_HEALTH_PORT) {
  createServer((req, res) => {
    if (req.url === '/metrics') {
      const lines = Object.entries(stats).flatMap(([loop, v]) => [
        `bg_worker_runs_total{loop="${loop}"} ${v.runs}`, `bg_worker_failures_total{loop="${loop}"} ${v.failures}`,
        `bg_worker_last_run_ms{loop="${loop}"} ${v.lastMs.toFixed(1)}`,
        ...Object.entries(v.totals).map(([k, n]) => `bg_worker_${k}_total{loop="${loop}"} ${n}`)
      ]);
      lines.push(`bg_worker_resident_bytes ${process.memoryUsage().rss}`);
      res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' }).end(lines.join('\n') + '\n');
      return;
    }
    const healthy = Date.now() - lastTick < 30_000;
    res.writeHead(req.url === '/health' && healthy ? 200 : 503, { 'content-type': 'application/json' }).end(JSON.stringify({ status: healthy ? 'ok' : 'stalled' }));
  }).listen(env.WORKER_HEALTH_PORT, '127.0.0.1');
}

log('worker started', { deadlinePollMs: env.DEADLINE_POLL_MS, maintenanceSeconds: env.WORKER_INTERVAL_SECONDS });
loop('deadlines', env.DEADLINE_POLL_MS, () => runDueDeadlines(db, registry));
loop('outbox', 2000, () => runOutbox(db));
loop('matchmaking', 2000, () => runMatchmaking(db, defaultMatchConfig));
loop('payments', 30_000, () => reconcilePayments(db, billing));
loop('subscriptions', 60_000, () => expireSubscriptions(db));
loop('maintenance', env.WORKER_INTERVAL_SECONDS * 1000, () => runMaintenance(db));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    // Let running jobs finish their transaction (max 15 s); unfinished work stays in PostgreSQL and is retried.
    const deadline = Date.now() + 15_000;
    while (inFlight > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    log('worker stopped', { signal, abandonedJobs: inFlight });
    await close();
    process.exit(0);
  });
}
