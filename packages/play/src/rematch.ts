// Rematch: after a finished table, humans vote; all «yes» within 30 s of the first vote → a new table with the same
// game, settings, seats and bots, started at once. Votes live in the finished table's settings JSON (no migration).
import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { AppError, type RematchView } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { GameRegistry } from '@bg/game-engine';
import { assertLimits, startTable, type PlayConfig } from './tables.ts';
import { lockTable } from './runtime.ts';

const { gameTables, participants } = schema;

export const REMATCH_WINDOW_MS = 30_000;

export interface RematchState { votes: Record<string, 'yes' | 'no'>; deadline: string; newTableId?: string }
type Offerable = { status: string; isTutorial: boolean; settings: unknown };

export const rematchOffered = (t: Offerable) => t.status === 'finished' && !t.isTutorial && !(t.settings as { tournament?: unknown }).tournament;

/** Projection for the table snapshot; `closed` is derived from the votes and the clock. */
export function rematchOf(t: Offerable, now = Date.now()): RematchView | null {
  if (!rematchOffered(t)) return null;
  const r = (t.settings as { rematch?: RematchState }).rematch;
  if (!r) return { votes: [], deadline: null, newTableId: null, closed: false };
  const newTableId = r.newTableId ?? null;
  return {
    votes: Object.entries(r.votes).map(([seat, vote]) => ({ seat: Number(seat), vote })).sort((a, b) => a.seat - b.seat),
    deadline: r.deadline, newTableId,
    closed: !newTableId && (Object.values(r.votes).includes('no') || Date.parse(r.deadline) <= now)
  };
}

export async function voteRematch(db: Db, registry: GameRegistry, cfg: PlayConfig, userId: string, tableId: string, vote: 'yes' | 'no'): Promise<void> {
  await db.transaction(async (tx) => {
    const locked = await lockTable(tx, registry, tableId);
    const { table, version, module } = locked;
    const seats = await tx.select().from(participants).where(eq(participants.tableId, table.id)).orderBy(participants.seat);
    const me = seats.find((s) => s.userId === userId);
    if (!me) throw new AppError('NOT_PARTICIPANT');
    if (!rematchOffered(table)) throw new AppError('REMATCH_CLOSED');
    const view = rematchOf(table)!;
    if (view.closed || view.newTableId) throw new AppError('REMATCH_CLOSED');

    const prev = (table.settings as { rematch?: RematchState }).rematch;
    const state: RematchState = prev ?? { votes: {}, deadline: new Date(Date.now() + REMATCH_WINDOW_MS).toISOString() };
    state.votes[String(me.seat)] = vote;
    const humans = seats.filter((s) => s.kind === 'human');

    if (vote === 'yes' && humans.every((s) => state.votes[String(s.seat)] === 'yes')) {
      // Same seats: players sit where they sat, bots keep their level and personas (both live in settings).
      const { rematch: _r, eligibility: _e, ...settings } = table.settings as Record<string, unknown>;
      for (const h of humans) await assertLimits(tx, h.userId!, table.pace as 'live' | 'turn', cfg);
      const [t] = await tx.insert(gameTables).values({
        gameId: table.gameId, gameVersionId: table.gameVersionId, pace: table.pace, competition: table.competition,
        visibility: table.visibility, status: 'open', hostId: table.hostId, capacity: table.capacity, settings,
        inviteCode: table.visibility === 'private' ? randomBytes(12).toString('base64url') : null
      }).returning();
      await tx.insert(participants).values(seats.map((s) => ({ tableId: t!.id, seat: s.seat, userId: s.userId, kind: s.kind, ready: true })));
      await startTable(tx, { table: t!, version, module });
      state.newTableId = t!.id;
    }
    await tx.update(gameTables).set({ settings: { ...(table.settings as object), rematch: state } }).where(and(eq(gameTables.id, table.id)));
    await tx.execute(sql`select pg_notify('table_changed', ${table.id})`);
  });
}
