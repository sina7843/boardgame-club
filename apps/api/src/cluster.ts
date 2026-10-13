// API cluster (API_WORKERS > 1): the primary forks workers that share the listening port; Linux hands connections to
// them round-robin. Workers hold no shared state in memory: realtime fans out through PostgreSQL NOTIFY (every worker
// pushes to its own sockets), rate-limit buckets are split per worker (config.perWorker), and the table-context memo
// is only a cache. The primary does no request work: it supervises workers and sums their metrics for a scrape.
import cluster, { type Worker } from 'node:cluster';
import type { LocalMetrics } from './metrics.ts';

type ToPrimary = { t: 'collect'; id: number } | { t: 'report'; key: string; m: LocalMetrics };
type ToWorker = { t: 'scrape'; key: string } | { t: 'collected'; id: number; all: LocalMetrics[] };

const log = (msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ level: 30, time: Date.now(), pid: process.pid, role: 'api-primary', msg, ...extra }));

export function runPrimary(workers: number): void {
  let stopping = false;
  const startedAt = new Map<number, number>();
  const fork = () => { const w = cluster.fork(); startedAt.set(w.id, Date.now()); };
  for (let i = 0; i < workers; i++) fork();
  log('api cluster started', { workers });

  cluster.on('exit', (w, code, signal) => {
    if (stopping) {
      if (!Object.keys(cluster.workers ?? {}).length) process.exit(0);
      return;
    }
    // A worker that dies right after starting (bad config, unreachable database) would only crash-loop: stop the
    // whole container instead and let the orchestrator restart it with backoff.
    if (Date.now() - (startedAt.get(w.id) ?? 0) < 10_000) {
      log('api worker failed during startup; exiting', { code, signal });
      process.exit(code || 1);
    }
    log('api worker exited; replacing it', { code, signal });
    fork();
  });

  // Metrics fan-in: a worker asks for everyone's numbers, the primary gathers them (1 s budget) and answers.
  const pending = new Map<string, { from: Worker; id: number; want: number; got: LocalMetrics[]; timer: NodeJS.Timeout }>();
  const finish = (key: string) => {
    const p = pending.get(key);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(key);
    if (p.from.isConnected()) p.from.send({ t: 'collected', id: p.id, all: p.got } satisfies ToWorker);
  };
  cluster.on('message', (from, msg: ToPrimary) => {
    if (msg.t === 'collect') {
      const live = Object.values(cluster.workers ?? {}).filter((w): w is Worker => !!w && w.isConnected());
      const key = `${from.id}:${msg.id}`;
      pending.set(key, { from, id: msg.id, want: live.length, got: [], timer: setTimeout(() => finish(key), 1000) });
      for (const w of live) w.send({ t: 'scrape', key } satisfies ToWorker);
    } else if (msg.t === 'report') {
      const p = pending.get(msg.key);
      if (!p) return;
      p.got.push(msg.m);
      if (p.got.length >= p.want) finish(msg.key);
    }
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      if (stopping) return;
      stopping = true;
      log('shutting down api cluster', { signal });
      for (const w of Object.values(cluster.workers ?? {})) w?.process.kill('SIGTERM');
      setTimeout(() => process.exit(0), 18_000).unref(); // inside the container's stop grace period
    });
  }
}

/** In a cluster worker: every worker's metrics (falls back to this worker's own if the primary does not answer). */
export function clusterMetrics(local: () => LocalMetrics): (() => Promise<LocalMetrics[]>) | undefined {
  if (!cluster.isWorker) return undefined;
  let seq = 0;
  const waiting = new Map<number, (all: LocalMetrics[]) => void>();
  process.on('message', (msg: ToWorker) => {
    if (msg.t === 'scrape') process.send!({ t: 'report', key: msg.key, m: local() } satisfies ToPrimary);
    else if (msg.t === 'collected') { waiting.get(msg.id)?.(msg.all); waiting.delete(msg.id); }
  });
  return () => new Promise((resolve) => {
    const id = ++seq;
    waiting.set(id, resolve);
    process.send!({ t: 'collect', id } satisfies ToPrimary);
    setTimeout(() => { if (waiting.delete(id)) resolve([local()]); }, 2000).unref();
  });
}
