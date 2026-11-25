// Replay of a finished game, one revision at a time. Every step is the SPECTATOR projection of the stored snapshot —
// never a player's view, not even for the player who asks or for an admin — so hidden hands stay hidden.
import { AppError, botPersona, type TableReplay } from '@bg/contracts';
import type { Db } from '@bg/db';
import { projectFor, type GameRegistry } from '@bg/game-engine';
import { loadSnapshot } from './runtime.ts';
import { clampSummary, loadTableContext, viewAccess } from './views.ts';

export async function tableReplay(db: Db, registry: GameRegistry, tableId: string, userId: string, admin: boolean, rev?: number): Promise<TableReplay> {
  const { table, version, game, seats, result } = await loadTableContext(db, tableId);
  if (table.isTutorial) throw new AppError('FORBIDDEN');
  await viewAccess(db, table, seats.find((s) => s.p.userId === userId)?.p.seat ?? null, { tableId, userId, admin });
  if (table.status !== 'finished' || table.revision < 1) throw new AppError('REPLAY_NOT_AVAILABLE');
  const revision = Math.min(Math.max(rev ?? 1, 1), table.revision);
  const module = registry.resolve(table.gameId, version.rulesVersion);
  const snap = await loadSnapshot(db, table.id, revision);
  const personas = (table.settings as { bot?: { personas?: number[] } }).bot?.personas;
  let bots = 0;
  return {
    tableId: table.id, gameId: game.id, gameNameFa: game.nameFa, gameNameOriginal: game.nameOriginal, clientBundleRef: version.clientBundleRef,
    finishedAt: table.finishedAt?.toISOString() ?? null,
    seats: seats.map(({ p, u }) => ({ seat: p.seat, name: p.kind === 'bot' ? botPersona(personas, bots++).nameFa : u?.displayName ?? 'جایگزین' })),
    // Revisions run 1 (the start) to `total` (the final position).
    revision, total: table.revision,
    view: projectFor(module, snap, { kind: 'spectator' }).view,
    publicSummary: module.publicSummary ? clampSummary(module.publicSummary(snap.state)) : null,
    result: (result as TableReplay['result']) ?? null
  };
}
