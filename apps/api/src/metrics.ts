// Minimal Prometheus-format metrics without a dependency. Values are aggregate counts only — never user ids,
// table contents or anything that could reveal hidden game state.
import { sql } from 'drizzle-orm';
import type { Db } from '@bg/db';

const BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500];

class Histogram {
  private counts = BUCKETS_MS.map(() => 0);
  private sum = 0;
  private n = 0;
  observe(ms: number) {
    this.n++;
    this.sum += ms;
    BUCKETS_MS.forEach((b, i) => { if (ms <= b) this.counts[i]!++; });
  }
  render(name: string, help: string, labels = '') {
    const l = labels ? `${labels},` : '';
    return [
      `# HELP ${name} ${help}`, `# TYPE ${name} histogram`,
      ...BUCKETS_MS.map((b, i) => `${name}_bucket{${l}le="${b}"} ${this.counts[i]}`),
      `${name}_bucket{${l}le="+Inf"} ${this.n}`, `${name}_sum{${labels}} ${this.sum.toFixed(3)}`, `${name}_count{${labels}} ${this.n}`
    ].join('\n');
  }
}

/** Process-local metrics (one API process). Counters reset on restart, as usual for Prometheus scraping. */
export const metrics = {
  commandLatency: new Map<string, Histogram>(),
  commands: new Map<string, number>(),
  moduleFailures: 0,
  httpErrors5xx: 0,
  socketConnections: () => 0,
  startedAt: Date.now(),

  /** Server-side processing time of one command (excludes network and client time). */
  recordCommand(transport: 'http' | 'socket', outcome: string, ms: number) {
    const key = `${transport}`;
    if (!this.commandLatency.has(key)) this.commandLatency.set(key, new Histogram());
    this.commandLatency.get(key)!.observe(ms);
    const c = `${transport}|${outcome}`;
    this.commands.set(c, (this.commands.get(c) ?? 0) + 1);
  }
};

export async function renderMetrics(db: Db): Promise<string> {
  const lines: string[] = [];
  for (const [transport, h] of metrics.commandLatency) lines.push(h.render('bg_command_duration_ms', 'Server-side command processing time', `transport="${transport}"`));
  lines.push('# HELP bg_commands_total Commands by transport and outcome (accepted, duplicate, or rejection code)', '# TYPE bg_commands_total counter');
  for (const [k, v] of metrics.commands) { const [t, o] = k.split('|'); lines.push(`bg_commands_total{transport="${t}",outcome="${o}"} ${v}`); }
  lines.push('# TYPE bg_module_failures_total counter', `bg_module_failures_total ${metrics.moduleFailures}`);
  lines.push('# TYPE bg_http_5xx_total counter', `bg_http_5xx_total ${metrics.httpErrors5xx}`);
  lines.push('# TYPE bg_socket_connections gauge', `bg_socket_connections ${metrics.socketConnections()}`);
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
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  lines.push('# TYPE bg_process_resident_bytes gauge', `bg_process_resident_bytes ${mem.rss}`,
    '# TYPE bg_process_heap_used_bytes gauge', `bg_process_heap_used_bytes ${mem.heapUsed}`,
    '# TYPE bg_process_cpu_seconds_total counter', `bg_process_cpu_seconds_total ${((cpu.user + cpu.system) / 1e6).toFixed(3)}`,
    '# TYPE bg_process_uptime_seconds gauge', `bg_process_uptime_seconds ${((Date.now() - metrics.startedAt) / 1000).toFixed(0)}`);
  return lines.join('\n') + '\n';
}
