import { describe, expect, it } from 'vitest';
import { mergeMetrics, type LocalMetrics } from '../src/metrics.ts';
import { testConfig } from './helpers.ts';

const worker = (over: Partial<LocalMetrics>): LocalMetrics => ({
  latency: {}, commands: {}, moduleFailures: 0, httpErrors5xx: 0, sockets: 0, rss: 0, heapUsed: 0, cpuSeconds: 0, uptimeSeconds: 100, ...over
});

describe('API cluster', () => {
  it('splits rate limits so all workers together never exceed the configured limit', () => {
    expect(testConfig().perWorker(300)).toBe(300);
    expect(testConfig({ API_WORKERS: '3' }).perWorker(300)).toBe(100);
    expect(testConfig({ API_WORKERS: '3' }).perWorker(10)).toBe(3); // 3 workers × 3 ≤ 10
    expect(testConfig({ API_WORKERS: '4' }).perWorker(2)).toBe(1); // never zero
  });

  it('sums every worker\'s metrics for one scrape', () => {
    const h = (n: number, sum: number) => ({ counts: [n, n, n, n, n, n, n, n, n], sum, n });
    const m = mergeMetrics([
      worker({ latency: { socket: h(2, 10) }, commands: { 'socket|accepted': 2 }, sockets: 5, rss: 100, cpuSeconds: 1.5, uptimeSeconds: 50 }),
      worker({ latency: { socket: h(3, 20), http: h(1, 4) }, commands: { 'socket|accepted': 3, 'http|STALE_REVISION': 1 }, sockets: 7, rss: 200, cpuSeconds: 2, moduleFailures: 1 })
    ]);
    expect(m.latency.socket).toEqual(h(5, 30));
    expect(m.latency.http).toEqual(h(1, 4));
    expect(m.commands).toEqual({ 'socket|accepted': 5, 'http|STALE_REVISION': 1 });
    expect(m).toMatchObject({ sockets: 12, rss: 300, cpuSeconds: 3.5, moduleFailures: 1, uptimeSeconds: 50 });
  });
});
