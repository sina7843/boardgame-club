// Game records (chess: PGN) for arbiters and analysis. A record is public information, but it is only handed out once
// the game is over, so nobody can feed a running game to an engine. Admins (arbiters) may fetch a running one.
import { and, asc, eq } from 'drizzle-orm';
import { AppError } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import type { GameRegistry } from '@bg/game-engine';
import type { RecordMeta } from '@bg/game-sdk';
import { clockControl } from './runtime.ts';
import { loadTableContext, type TableContext } from './views.ts';

const { tournaments, tournamentTables } = schema;

export interface GameRecord { filename: string; mimeType: string; text: string }

const utcDate = (d: Date) => `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;

async function recordOf(db: Db, registry: GameRegistry, ctx: TableContext): Promise<GameRecord | null> {
  const { table, version, game, seats, snap } = ctx;
  if (!snap) return null;
  const module = registry.resolve(table.gameId, version.rulesVersion);
  if (!module.exportRecord) return null;
  const tour = (table.settings as { tournament?: { id: string; round: number } }).tournament;
  const [t] = tour ? await db.select({ titleFa: tournaments.titleFa }).from(tournaments).where(eq(tournaments.id, tour.id)) : [];
  const ctl = clockControl(table);
  const times = await db.select({ seat: schema.moveTimes.seat, actionType: schema.moveTimes.actionType, spentMs: schema.moveTimes.spentMs, leftMs: schema.moveTimes.leftMs })
    .from(schema.moveTimes).where(eq(schema.moveTimes.tableId, table.id)).orderBy(asc(schema.moveTimes.revision));
  const meta: RecordMeta = {
    moveTimes: times,
    event: t?.titleFa ?? game.nameFa, site: 'boardgameverse.ir', date: utcDate(table.finishedAt ?? table.createdAt),
    round: tour ? String(tour.round) : null,
    players: seats.map(({ p, u }) => u?.displayName ?? (p.kind === 'bot' ? 'ربات' : '?')),
    timeControl: ctl ? `${ctl.initialMs / 1000}${ctl.guestInitialMs !== ctl.initialMs ? `:${ctl.guestInitialMs / 1000}` : ''}+${ctl.incrementMs / 1000}` : null
  };
  const rec = module.exportRecord(snap.state, meta);
  return rec ? { filename: `${game.id}-${table.id.slice(0, 8)}.${rec.extension}`, mimeType: rec.mimeType, text: rec.text } : null;
}

/** One table's record. Finished tables only (admins: any), and only for people who may see the table. */
export async function tableRecord(db: Db, registry: GameRegistry, tableId: string, userId: string, isAdmin: boolean): Promise<GameRecord> {
  const ctx = await loadTableContext(db, tableId);
  const { table, seats } = ctx;
  const mine = seats.some((s) => s.p.userId === userId);
  const viewable = mine || table.visibility === 'public' || !!(table.settings as { tournament?: unknown }).tournament;
  if (table.isTutorial || (!isAdmin && !viewable)) throw new AppError('FORBIDDEN');
  if (!isAdmin && table.status !== 'finished') throw new AppError('FORBIDDEN');
  const rec = await recordOf(db, registry, ctx);
  if (!rec) throw new AppError('NOT_FOUND');
  return rec;
}

/** Every finished game of a tournament in one file (arbiter use: engine analysis, appeals). Admin only; the route checks the role. */
export async function tournamentRecords(db: Db, registry: GameRegistry, tournamentId: string): Promise<GameRecord> {
  const [t] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!t) throw new AppError('NOT_FOUND');
  const rows = await db.select({ tableId: tournamentTables.tableId }).from(tournamentTables)
    .innerJoin(schema.gameTables, eq(schema.gameTables.id, tournamentTables.tableId))
    .where(and(eq(tournamentTables.tournamentId, tournamentId), eq(schema.gameTables.status, 'finished'))).orderBy(asc(tournamentTables.round));
  const texts: string[] = [];
  let ext = 'pgn', mime = 'application/x-chess-pgn';
  for (const { tableId } of rows) {
    const rec = await recordOf(db, registry, await loadTableContext(db, tableId));
    if (rec) { texts.push(rec.text); ext = rec.filename.split('.').pop() ?? ext; mime = rec.mimeType; }
  }
  if (!texts.length) throw new AppError('NOT_FOUND');
  return { filename: `tournament-${tournamentId.slice(0, 8)}.${ext}`, mimeType: mime, text: texts.join('\n') };
}
