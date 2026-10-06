// Read models. Game data leaves the server only through module.project()/legalActions() for one viewer.
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { AppError, type MyTableItem, type NotificationItem, type TableLobby, type TableSnapshot } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { projectFor, type GameRegistry } from '@bg/game-engine';
import type { Viewer } from '@bg/game-sdk';
import { loadSnapshot } from './runtime.ts';

const { games, gameVersions, gameTables, participants, users, scheduledDeadlines, gameResults, platformIncidents, notifications, tableInvites } = schema;

type GameView = NonNullable<TableSnapshot['game']>;

const DISCONNECT_FA = {
  live: 'قطع اتصال شخصی ساعت نوبت را متوقف نمی‌کند؛ پس از اتصال دوباره، بازی از آخرین وضعیت ثبت‌شده ادامه می‌یابد.',
  turn: 'موعد هر نوبت روی سرور ثبت است و با بستن مرورگر متوقف نمی‌شود.',
  tutorial: 'آموزش زمان‌بندی ندارد و هر وقت برگردید از همان مرحله ادامه می‌یابد.'
};
const INCIDENT_FA = 'اگر سرویس به‌طور سراسری متوقف شود، موعدها منجمد و پس از رفع مشکل به اندازه مدت توقف تمدید می‌شوند.';

export async function currentIncident(db: Db) {
  const [i] = await db.select().from(platformIncidents).where(isNull(platformIncidents.endedAt)).limit(1);
  return i ? { reasonFa: i.reasonFa, startedAt: i.startedAt.toISOString() } : null;
}

/** Labels of the table's rule variants; options not chosen yet (matchmade, before start) show the module default. */
function describeVariants(registry: GameRegistry, table: { gameId: string; isTutorial: boolean; settings: unknown }, rulesVersion: string) {
  if (table.isTutorial || !registry.has(table.gameId, rulesVersion)) return [];
  const chosen = (table.settings as { options?: Record<string, unknown> }).options ?? {};
  return registry.resolve(table.gameId, rulesVersion).manifest.options.map((o) => {
    const value = o.key in chosen ? chosen[o.key] : o.default;
    return { labelFa: o.labelFa, valueFa: o.choices.find((c) => c.value === value)?.labelFa ?? String(value) };
  });
}

export interface ViewRequest { tableId: string; userId: string; inviteCode?: string | undefined }

/**
 * Everything about a table that does not depend on the viewer, read once (independent reads in parallel).
 * Realtime pushes load this once per change and project it for each subscriber.
 */
export async function loadTableContext(db: Db, tableId: string) {
  const [row] = await db.select({ table: gameTables, version: gameVersions, game: games }).from(gameTables)
    .innerJoin(gameVersions, eq(gameVersions.id, gameTables.gameVersionId))
    .innerJoin(games, eq(games.id, gameTables.gameId))
    .where(eq(gameTables.id, tableId));
  if (!row) throw new AppError('NOT_FOUND');
  const { table } = row;
  const pendingAt = (key: 'ready' | 'turn') => db.select({ dueAt: scheduledDeadlines.dueAt }).from(scheduledDeadlines)
    .where(and(eq(scheduledDeadlines.tableId, table.id), eq(scheduledDeadlines.deadlineKey, key), eq(scheduledDeadlines.status, 'pending')));
  const [seats, incident, readyDue, turnDue, results, snap] = await Promise.all([
    db.select({ p: participants, u: users }).from(participants)
      .leftJoin(users, eq(users.id, participants.userId)).where(eq(participants.tableId, table.id)).orderBy(participants.seat),
    currentIncident(db),
    table.isMatchmade && table.status === 'open' ? pendingAt('ready') : [],
    table.status === 'active' && table.revision > 0 ? pendingAt('turn') : [],
    table.revision > 0 ? db.select({ outcome: gameResults.outcome }).from(gameResults).where(eq(gameResults.tableId, table.id)) : [],
    table.revision > 0 ? loadSnapshot(db, table.id, table.revision) : null
  ]);
  return { ...row, seats, incident, readyDue: readyDue[0]?.dueAt ?? null, turnDue: turnDue[0]?.dueAt ?? null, result: results[0]?.outcome ?? null, snap };
}
export type TableContext = Awaited<ReturnType<typeof loadTableContext>>;

/** Builds the authorized snapshot for one viewer, enforcing table access (private, tutorial, invite). */
export async function buildTableSnapshot(db: Db, registry: GameRegistry, req: ViewRequest, ctx?: TableContext): Promise<TableSnapshot> {
  const { table, version, game, seats, incident, snap, readyDue, turnDue, result } = ctx ?? await loadTableContext(db, req.tableId);
  const mine = seats.find((s) => s.p.userId === req.userId);
  const mySeat = mine ? mine.p.seat : null;

  let lobbyOnly = false;
  if (mySeat === null) {
    if (table.isTutorial) throw new AppError('FORBIDDEN');
    if (table.visibility === 'private') {
      // A private table is visible only to its members — or, before start, to holders of the invite link.
      const [invited] = await db.select().from(tableInvites).where(and(eq(tableInvites.tableId, table.id), eq(tableInvites.userId, req.userId)));
      if (table.status === 'open' && (invited || (req.inviteCode && req.inviteCode === table.inviteCode))) lobbyOnly = true;
      else throw new AppError('FORBIDDEN');
    }
  }

  const lobby: TableLobby = {
    id: table.id, gameId: game.id, gameNameFa: game.nameFa, gameNameOriginal: game.nameOriginal,
    status: table.status as TableLobby['status'], pace: table.pace as TableLobby['pace'],
    competition: table.competition as TableLobby['competition'], visibility: table.visibility as TableLobby['visibility'],
    capacity: table.capacity, settings: table.settings as TableLobby['settings'],
    rulesVersion: version.rulesVersion, stateSchemaVersion: version.stateSchemaVersion, clientBundleRef: version.clientBundleRef,
    isTutorial: table.isTutorial, isMatchmade: table.isMatchmade, readyDeadline: null, hostId: table.hostId,
    seats: seats.map(({ p, u }) => ({
      seat: p.seat, kind: p.kind as 'human' | 'script', ready: p.ready,
      user: u ? { id: u.id, displayName: u.displayName, avatarKey: u.avatarKey as never, joinedAt: u.createdAt.toISOString() } : null
    })),
    mySeat,
    inviteCode: mySeat !== null && table.visibility === 'private' && !table.isTutorial ? table.inviteCode : null,
    policies: {
      timeoutFa: game.timeoutPolicyFa, resignFa: game.resignPolicyFa,
      disconnectFa: `${table.isTutorial ? DISCONNECT_FA.tutorial : DISCONNECT_FA[table.pace as 'live' | 'turn']} ${table.isTutorial ? '' : INCIDENT_FA}`.trim()
    },
    variants: describeVariants(registry, table, version.rulesVersion),
    createdAt: table.createdAt.toISOString()
  };

  if (table.isMatchmade && table.status === 'open') lobby.readyDeadline = readyDue?.toISOString() ?? null;
  let gameView: TableSnapshot['game'] = null;
  if (!lobbyOnly && snap) {
    const module = registry.resolve(table.gameId, version.rulesVersion);
    const viewer: Viewer = mySeat === null ? { kind: 'spectator' } : { kind: 'player', seat: mySeat };
    const { view, legalActions } = projectFor(module, snap, viewer);
    const t = module.tutorial;
    gameView = {
      revision: table.revision,
      view,
      legalActions: table.status === 'active' ? legalActions : [],
      pendingSeats: table.status === 'active' ? module.pendingSeats(snap.state) : [],
      deadline: turnDue ? { dueAt: turnDue.toISOString(), frozen: !!incident } : null,
      result: (result as GameView['result'] | null) ?? null,
      tutorial: table.isTutorial ? {
        step: table.tutorialStep, total: t.steps.length, introFa: t.introFa,
        instructionFa: t.steps[table.tutorialStep]?.instructionFa ?? t.completedFa,
        expected: (t.steps[table.tutorialStep]?.expected as { type: string } | null | undefined) ?? null
      } : null
    };
  }
  return { table: lobby, game: gameView, incident, serverTime: new Date().toISOString() };
}

export async function listMyTables(db: Db, registry: GameRegistry, userId: string): Promise<MyTableItem[]> {
  const rows = await db.select({ table: gameTables, version: gameVersions, game: games, seat: participants.seat }).from(participants)
    .innerJoin(gameTables, eq(gameTables.id, participants.tableId))
    .innerJoin(gameVersions, eq(gameVersions.id, gameTables.gameVersionId))
    .innerJoin(games, eq(games.id, gameTables.gameId))
    .where(and(eq(participants.userId, userId), sql`(${gameTables.status} in ('open','active') or (${gameTables.status} = 'finished' and ${gameTables.finishedAt} > now() - interval '3 days'))`))
    .orderBy(desc(gameTables.createdAt)).limit(50);
  const ids = rows.map((r) => r.table.id);
  const counts = ids.length ? await db.select({ tableId: participants.tableId, n: sql<number>`count(*)::int` }).from(participants)
    .where(inArray(participants.tableId, ids)).groupBy(participants.tableId) : [];
  const deadlines = ids.length ? await db.select({ tableId: scheduledDeadlines.tableId, dueAt: scheduledDeadlines.dueAt }).from(scheduledDeadlines)
    .where(and(inArray(scheduledDeadlines.tableId, ids), eq(scheduledDeadlines.deadlineKey, 'turn'), eq(scheduledDeadlines.status, 'pending'))) : [];
  const out: MyTableItem[] = [];
  for (const { table, version, game, seat } of rows) {
    let isMyTurn = false;
    if (table.status === 'active') {
      const module = registry.resolve(table.gameId, version.rulesVersion);
      isMyTurn = module.pendingSeats((await loadSnapshot(db, table.id, table.revision)).state).includes(seat);
    }
    out.push({
      id: table.id, gameId: game.id, gameNameFa: game.nameFa, status: table.status as MyTableItem['status'],
      pace: table.pace as MyTableItem['pace'], isTutorial: table.isTutorial, isMyTurn,
      deadline: deadlines.find((d) => d.tableId === table.id)?.dueAt.toISOString() ?? null,
      players: counts.find((c) => c.tableId === table.id)?.n ?? 0, capacity: table.capacity, updatedRevision: table.revision
    });
  }
  return out;
}

export async function listOpenTables(db: Db, gameId?: string) {
  const rows = await db.select({ table: gameTables, game: games, host: users, players: sql<number>`(select count(*)::int from participants p where p.table_id = ${gameTables.id})` })
    .from(gameTables).innerJoin(games, eq(games.id, gameTables.gameId)).innerJoin(users, eq(users.id, gameTables.hostId))
    .where(and(eq(gameTables.status, 'open'), eq(gameTables.visibility, 'public'), eq(gameTables.isTutorial, false),
      eq(games.status, 'active'), gameId ? eq(gameTables.gameId, gameId) : undefined))
    .orderBy(desc(gameTables.createdAt)).limit(50);
  return rows.filter((r) => r.players < r.table.capacity).map(({ table, game, host, players }) => ({
    id: table.id, gameId: game.id, gameNameFa: game.nameFa, pace: table.pace as 'live' | 'turn', players, capacity: table.capacity,
    turnSeconds: (table.settings as { turnSeconds: number }).turnSeconds,
    host: { id: host.id, displayName: host.displayName, avatarKey: host.avatarKey as never, joinedAt: host.createdAt.toISOString() }
  }));
}

// ---------- In-app notifications (FR-13). Text never includes hidden game information. ----------

export async function listNotifications(db: Db, userId: string): Promise<NotificationItem[]> {
  const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(30);
  return rows.map(toNotificationItem);
}

/** Payload holds only public, non-game-secret fields; the text is rendered here so clients never get raw data. */
export function toNotificationItem(n: typeof notifications.$inferSelect): NotificationItem {
  const p = n.payload as { tableId?: string; gameNameFa?: string; actorName?: string; conversationId?: string; clubSlug?: string; clubName?: string };
  const game = p.gameNameFa ?? 'بازی';
  const actor = p.actorName ?? 'یک بازیکن';
  const kind = n.kind as NotificationItem['kind'];
  const text = {
    turn: `نوبت شما در «${game}» است.`,
    reminder: `موعد نوبت شما در «${game}» نزدیک است.`,
    finished: `بازی «${game}» تمام شد؛ نتیجه را ببینید.`,
    invite: `${actor} شما را به میز «${game}» دعوت کرد.`,
    match: `حریف پیدا شد: «${game}». آمادگی خود را اعلام کنید.`,
    message: `پیام تازه از ${actor}.`,
    friend_request: `${actor} برای شما درخواست دوستی فرستاد.`,
    club: `درخواست تازه در باشگاه «${p.clubName ?? ''}».`
  }[kind] ?? 'اعلان تازه';
  const href = p.tableId ? `/tables/${p.tableId}` : p.conversationId ? `/messages/${p.conversationId}`
    : p.clubSlug ? `/clubs/${p.clubSlug}` : kind === 'friend_request' ? '/friends' : '/';
  return { id: n.id, kind, href, tableId: p.tableId ?? null, textFa: text, createdAt: n.createdAt.toISOString(), read: !!n.readAt };
}

export async function markNotificationsRead(db: Db, userId: string, id?: string): Promise<void> {
  await db.update(notifications).set({ readAt: sql`now()` })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), id ? eq(notifications.id, id) : undefined));
}
