// Minimal Prometheus-format metrics without a dependency. Values are aggregate counts only — never user ids,
// table contents or anything that could reveal hidden game state.
import { sql } from 'drizzle-orm';
import type { Db } from '@bg/db';

const BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500];

/** Histogram state as plain data, so worker processes can send it to each other and be summed. */
interface HistogramData { counts: number[]; sum: number; n: number }
const emptyHistogram = (): HistogramData => ({ counts: BUCKETS_MS.map(() => 0), sum: 0, n: 0 });

function renderHistogram(h: HistogramData, name: string, help: string, labels = '') {
  const l = labels ? `${labels},` : '';
  return [
    `# HELP ${name} ${help}`, `# TYPE ${name} histogram`,
    ...BUCKETS_MS.map((b, i) => `${name}_bucket{${l}le="${b}"} ${h.counts[i]}`),
    `${name}_bucket{${l}le="+Inf"} ${h.n}`, `${name}_sum{${labels}} ${h.sum.toFixed(3)}`, `${name}_count{${labels}} ${h.n}`
  ].join('\n');
}

/** Process-local metrics (one API process). Counters reset on restart, as usual for Prometheus scraping. */
export const metrics = {
  commandLatency: new Map<string, HistogramData>(),
  commands: new Map<string, number>(),
  moduleFailures: 0,
  httpErrors5xx: 0,
  socketConnections: () => 0,
  startedAt: Date.now(),

  /** Server-side processing time of one command (excludes network and client time). */
  recordCommand(transport: 'http' | 'socket', outcome: string, ms: number) {
    const h = this.commandLatency.get(transport) ?? emptyHistogram();
    this.commandLatency.set(transport, h);
    h.n++;
    h.sum += ms;
    BUCKETS_MS.forEach((b, i) => { if (ms <= b) h.counts[i]!++; });
    const c = `${transport}|${outcome}`;
    this.commands.set(c, (this.commands.get(c) ?? 0) + 1);
  }
};

/** This process's metrics as plain data (what each API worker reports for an aggregated scrape). */
export function localMetrics() {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  return {
    latency: Object.fromEntries(metrics.commandLatency), commands: Object.fromEntries(metrics.commands),
    moduleFailures: metrics.moduleFailures, httpErrors5xx: metrics.httpErrors5xx, sockets: metrics.socketConnections(),
    rss: mem.rss, heapUsed: mem.heapUsed, cpuSeconds: (cpu.user + cpu.system) / 1e6, uptimeSeconds: (Date.now() - metrics.startedAt) / 1000
  };
}
export type LocalMetrics = ReturnType<typeof localMetrics>;

/** Sum of several workers' metrics: counters, gauges and process totals add up; uptime is the youngest worker's. */
export function mergeMetrics(all: LocalMetrics[]): LocalMetrics {
  const out = { ...localMetricsZero(), uptimeSeconds: Math.min(...all.map((m) => m.uptimeSeconds)) };
  for (const m of all) {
    for (const [t, h] of Object.entries(m.latency)) {
      const acc = out.latency[t] ??= emptyHistogram();
      acc.n += h.n; acc.sum += h.sum; h.counts.forEach((c, i) => { acc.counts[i]! += c; });
    }
    for (const [k, v] of Object.entries(m.commands)) out.commands[k] = (out.commands[k] ?? 0) + v;
    out.moduleFailures += m.moduleFailures; out.httpErrors5xx += m.httpErrors5xx; out.sockets += m.sockets;
    out.rss += m.rss; out.heapUsed += m.heapUsed; out.cpuSeconds += m.cpuSeconds;
  }
  return out;
}
const localMetricsZero = (): LocalMetrics => ({
  latency: {}, commands: {}, moduleFailures: 0, httpErrors5xx: 0, sockets: 0, rss: 0, heapUsed: 0, cpuSeconds: 0, uptimeSeconds: 0
});

/** `local` = this process alone, or every API worker's metrics when the API runs as a cluster. */
export async function renderMetrics(db: Db, local: LocalMetrics[] = [localMetrics()]): Promise<string> {
  const m = mergeMetrics(local);
  const lines: string[] = [];
  for (const [transport, h] of Object.entries(m.latency)) lines.push(renderHistogram(h, 'bg_command_duration_ms', 'Server-side command processing time', `transport="${transport}"`));
  lines.push('# HELP bg_commands_total Commands by transport and outcome (accepted, duplicate, or rejection code)', '# TYPE bg_commands_total counter');
  for (const [k, v] of Object.entries(m.commands)) { const [t, o] = k.split('|'); lines.push(`bg_commands_total{transport="${t}",outcome="${o}"} ${v}`); }
  lines.push('# TYPE bg_module_failures_total counter', `bg_module_failures_total ${m.moduleFailures}`);
  lines.push('# TYPE bg_http_5xx_total counter', `bg_http_5xx_total ${m.httpErrors5xx}`);
  lines.push('# TYPE bg_socket_connections gauge', `bg_socket_connections ${m.sockets}`);
  lines.push('# TYPE bg_api_workers gauge', `bg_api_workers ${local.length}`);
  const [row] = await db.execute(sql`
    select
      (select count(*) from game_tables where status = 'active')::int as active_tables,
      (select count(*) from game_tables where status = 'open')::int as open_tables,
      (select count(*) from command_receipts where created_at > now() - interval '60 seconds' and status = 'accepted')::int as moves_last_minute,
      (select count(*) from outbox_events where processed_at is null)::int as outbox_backlog,
      coalesce((select extract(epoch from now() - min(created_at)) from outbox_events where processed_at is null), 0)::float as outbox_oldest_seconds,
      (select count(*) from scheduled_deadlines where status = 'pending' and due_at < now() - interval '5 seconds')::int as deadlines_overdue,
      (select count(*) from matchmaking_tickets where status = 'queued')::int as queued_tickets,
      (select count(*) from payments where status = 'pending')::int as payments_pending,
      (select count(*) from payments where status = 'failed' and updated_at > now() - interval '1 hour')::int as payments_failed_last_hour`) as unknown as Record<string, number>[];
  for (const [k, v] of Object.entries(row ?? {})) lines.push(`# TYPE bg_${k} gauge`, `bg_${k} ${v}`);
  lines.push('# TYPE bg_process_resident_bytes gauge', `bg_process_resident_bytes ${m.rss}`,
    '# TYPE bg_process_heap_used_bytes gauge', `bg_process_heap_used_bytes ${m.heapUsed}`,
    '# TYPE bg_process_cpu_seconds_total counter', `bg_process_cpu_seconds_total ${m.cpuSeconds.toFixed(3)}`,
    '# TYPE bg_process_uptime_seconds gauge', `bg_process_uptime_seconds ${m.uptimeSeconds.toFixed(0)}`);
  return lines.join('\n') + '\n';
}
