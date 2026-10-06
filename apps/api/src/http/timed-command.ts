import type { FastifyBaseLogger } from 'fastify';
import { AppError } from '@bg/contracts';
import type { CommandOutcome } from '@bg/play';
import { metrics } from '../metrics.ts';

/**
 * Wrap the shared command service with server-side timing (network excluded) and structured, non-sensitive logs:
 * only table id, revision, outcome and duration — never the action payload or any game state.
 */
export async function timedCommand(transport: 'http' | 'socket', log: FastifyBaseLogger, tableId: string, run: () => Promise<CommandOutcome>): Promise<CommandOutcome> {
  const started = performance.now();
  try {
    const r = await run();
    const ms = performance.now() - started;
    const outcome = r.duplicate ? 'duplicate' : r.status === 'accepted' ? 'accepted' : (r.errorCode ?? 'rejected');
    metrics.recordCommand(transport, outcome, ms);
    if (ms > 250) log.warn({ tableId, revision: r.revision, outcome, ms: Math.round(ms), transport }, 'slow command');
    return r;
  } catch (err) {
    const ms = performance.now() - started;
    if (err instanceof AppError) metrics.recordCommand(transport, err.code, ms);
    else {
      metrics.moduleFailures++;
      metrics.recordCommand(transport, 'error', ms);
      log.error({ tableId, transport, err: { name: (err as Error).name, message: (err as Error).message } }, 'command failed');
    }
    throw err;
  }
}
