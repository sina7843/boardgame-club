// Read models. Game data leaves the server only through module.project()/legalActions() for one viewer.
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { AppError, botPersona, type TurnStartedEvent, type LiveTableItem, type MyTableItem, type NotificationItem, type TableLobby, type TableSnapshot } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { projectFor, type GameRegistry } from '@bg/game-engine';
import type { BotLevel, Viewer } from '@bg/game-sdk';
import { loadSnapshot } from './runtime.ts';
import { rematchOf } from './rematch.ts';
import { seatCosmeticsOf } from './cosmetics.ts';

const { games, gameVersions, gameTables, participants, users, scheduledDeadlines, gameResults, platformIncidents, notifications, tableInvites, tournaments, tournamentTables, ratingHistory } = schema;

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

/**
 * Every move builds the table context twice: for the mover's reply and for the realtime push (NOTIFY carries the
 * revision). Both read the same committed revision, so the second reuses the first's load instead of re-querying.
 * The context is at least `revision` (never older), which every consumer accepts.
 */
// ponytail: per-process memo for a few seconds; fine while the API runs one process.
const recentContexts = new Map<string, { revision: number; ctx: Promise<TableContext> }>();
export function tableContextAt(db: Db, tableId: string, revision: number): Promise<TableContext> {
  const hit = recentContexts.get(tableId);
  if (hit?.revision === revision) return hit.ctx;
  const ctx = loadTableContext(db, tableId);
  recentContexts.set(tableId, { revision, ctx });
  const forget = () => { if (recentContexts.get(tableId)?.ctx === ctx) recentContexts.delete(tableId); };
  ctx.catch(forget);
  setTimeout(forget, 5000).unref();
  return ctx;
}

/** `turn.started` for a freshly persisted move: who must act and until when (null when no clock runs). */
export function turnStartedEvent(registry: GameRegistry, ctx: TableContext, revision: number): TurnStartedEvent | null {
  const { table, version, snap, turnDue } = ctx;
  if (table.status !== 'active' || table.isTutorial || !turnDue || !snap || table.revision !== revision) return null;
  const seats = registry.resolve(table.gameId, version.rulesVersion).pendingSeats(snap.state);
  if (!seats.length) return null;
  return { tableId: table.id, revision, seats, dueAt: turnDue.toISOString(), turnSeconds: (table.settings as { turnSeconds: number }).turnSeconds,
    pace: table.pace as 'live' | 'turn', serverTime: new Date().toISOString() };
}

/** Builds the authorized snapshot for one viewer, enforcing table access (private, tutorial, invite). */
export async function buildTableSnapshot(db: Db, registry: GameRegistry, req: ViewRequest, ctx?: TableContext): Promise<TableSnapshot> {
  const { table, version, game, seats, incident, snap, readyDue, turnDue, result } = ctx ?? await loadTableContext(db, req.tableId);
  const mine = seats.find((s) => s.p.userId === req.userId);
  const mySeat = mine ? mine.p.seat : null;

  let lobbyOnly = false;
  if (mySeat === null) {
    if (table.isTutorial) throw new AppError('FORBIDDEN');
    // Tournament tables are private (nobody can join) but open to spectators: a tournament is meant to be watched.
    const isTournament = !!(table.settings as { tournament?: unknown }).tournament;
    if (table.visibility === 'private' && !isTournament) {
      // A private table is visible only to its members — or, before start, to holders of the invite link.
      const [invited] = await db.select().from(tableInvites).where(and(eq(tableInvites.tableId, table.id), eq(tableInvites.userId, req.userId)));
      if (table.status === 'open' && (invited || (req.inviteCode && req.inviteCode === table.inviteCode))) lobbyOnly = true;
      else throw new AppError('FORBIDDEN');
    }
  }

  const botCfg = (table.settings as { bot?: { level: BotLevel; personas?: number[] } }).bot;
  const botSeat = (seat: number) => {
    const { nameFa, avatarKey, style } = botPersona(botCfg?.personas, seats.filter((x) => x.p.kind === 'bot' && x.p.seat < seat).length);
    return { level: botCfg!.level, nameFa, avatarKey, style };
  };
  const lobby: TableLobby = {
    id: table.id, gameId: game.id, gameNameFa: game.nameFa, gameNameOriginal: game.nameOriginal,
    status: table.status as TableLobby['status'], pace: table.pace as TableLobby['pace'],
    competition: table.competition as TableLobby['competition'], visibility: table.visibility as TableLobby['visibility'],
    capacity: table.capacity, settings: (({ rematch: _r, ...rest }) => rest)(table.settings as Record<string, unknown>) as TableLobby['settings'],
    rulesVersion: version.rulesVersion, stateSchemaVersion: version.stateSchemaVersion, clientBundleRef: version.clientBundleRef,
    isTutorial: table.isTutorial, isMatchmade: table.isMatchmade, readyDeadline: null, hostId: table.hostId,
    seats: seats.map(({ p, u }) => ({
      seat: p.seat, kind: p.kind as 'human' | 'script' | 'bot', ready: p.ready,
      user: u ? { id: u.id, displayName: u.displayName, avatarKey: u.avatarKey as never, joinedAt: u.createdAt.toISOString() } : null,
      // equipped comes with the seats' users row (no extra query on the move path).
      ...(u && seatCosmeticsOf(u.equipped) ? { cosmetics: seatCosmeticsOf(u.equipped)! } : {}),
      ...(p.kind === 'bot' && botCfg ? { bot: botSeat(p.seat) } : {})
    })),
    mySeat,
    inviteCode: mySeat !== null && table.visibility === 'private' && !table.isTutorial ? table.inviteCode : null,
    policies: {
      timeoutFa: game.timeoutPolicyFa, resignFa: game.resignPolicyFa,
      disconnectFa: `${table.isTutorial ? DISCONNECT_FA.tutorial : DISCONNECT_FA[table.pace as 'live' | 'turn']} ${table.isTutorial ? '' : INCIDENT_FA}`.trim()
    },
    variants: describeVariants(registry, table, version.rulesVersion),
    createdAt: table.createdAt.toISOString(),
    rematch: rematchOf(table)
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
      summary: module.publicSummary ? module.publicSummary(snap.state) : null,
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
  const seated = ids.length ? await db.select({ tableId: participants.tableId, seat: participants.seat, kind: participants.kind, settings: gameTables.settings,
    name: users.displayName, avatarKey: users.avatarKey }).from(participants).innerJoin(gameTables, eq(gameTables.id, participants.tableId))
    .leftJoin(users, eq(users.id, participants.userId)).where(inArray(participants.tableId, ids)).orderBy(participants.seat) : [];
  const results = ids.length ? await db.select({ tableId: gameResults.tableId, id: gameResults.id, outcome: gameResults.outcome }).from(gameResults).where(inArray(gameResults.tableId, ids)) : [];
  const deltas = results.length ? await db.select({ resultId: ratingHistory.resultId, before: ratingHistory.muBefore, after: ratingHistory.muAfter }).from(ratingHistory)
    .where(and(eq(ratingHistory.userId, userId), inArray(ratingHistory.resultId, results.map((r) => r.id)))) : [];
  const deadlines = ids.length ? await db.select({ tableId: scheduledDeadlines.tableId, dueAt: scheduledDeadlines.dueAt }).from(scheduledDeadlines)
    .where(and(inArray(scheduledDeadlines.tableId, ids), eq(scheduledDeadlines.deadlineKey, 'turn'), eq(scheduledDeadlines.status, 'pending'))) : [];
  const out: MyTableItem[] = [];
  for (const { table, version, game, seat } of rows) {
    let turnSeats: number[] = [];
    if (table.status === 'active') {
      const module = registry.resolve(table.gameId, version.rulesVersion);
      turnSeats = module.pendingSeats((await loadSnapshot(db, table.id, table.revision)).state);
    }
    const isMyTurn = turnSeats.includes(seat);
    const mine = seated.filter((x) => x.tableId === table.id);
    let bots = 0;
    const seats = mine.map((x) => {
      if (x.kind !== 'bot') return { seat: x.seat, name: x.name ?? 'جایگزین', avatarKey: x.avatarKey ?? 'meeple', kind: x.kind as 'human' | 'script' };
      const p = botPersona((x.settings as { bot?: { personas?: number[] } }).bot?.personas, bots++);
      return { seat: x.seat, name: p.nameFa, avatarKey: p.avatarKey, kind: 'bot' as const };
    });
    const res = results.find((r) => r.tableId === table.id);
    const place = (res?.outcome as { placements?: { seat: number; place: number }[] } | undefined)?.placements?.find((x) => x.seat === seat)?.place;
    const delta = res && deltas.find((d) => d.resultId === res.id);
    out.push({
      id: table.id, gameId: game.id, gameNameFa: game.nameFa, status: table.status as MyTableItem['status'],
      pace: table.pace as MyTableItem['pace'], isTutorial: table.isTutorial, isMyTurn,
      deadline: deadlines.find((d) => d.tableId === table.id)?.dueAt.toISOString() ?? null,
      players: mine.length, capacity: table.capacity, updatedRevision: table.revision,
      mySeat: seat, seats, turnSeats,
      result: place !== undefined ? { place, fieldSize: mine.length, ratingDelta: delta ? Math.round(60 * (delta.after - delta.before)) : null } : null,
      finishedAt: table.finishedAt?.toISOString() ?? null
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
  const open = rows.filter((r) => r.players < r.table.capacity);
  const seated = open.length ? await db.select({ tableId: participants.tableId, name: users.displayName, avatarKey: users.avatarKey }).from(participants)
    .innerJoin(users, eq(users.id, participants.userId)).where(inArray(participants.tableId, open.map((r) => r.table.id))).orderBy(participants.seat) : [];
  return open.map(({ table, game, host, players }) => ({
    id: table.id, gameId: game.id, gameNameFa: game.nameFa, pace: table.pace as 'live' | 'turn', players, capacity: table.capacity,
    turnSeconds: (table.settings as { turnSeconds: number }).turnSeconds,
    host: { id: host.id, displayName: host.displayName, avatarKey: host.avatarKey as never, joinedAt: host.createdAt.toISOString() },
    seated: seated.filter((x) => x.tableId === table.id).map((x) => ({ name: x.name, avatarKey: x.avatarKey }))
  }));
}

/** Games in progress that anyone signed in may watch: public tables and tournament tables. Players' names only, never state. */
export async function listLiveTables(db: Db, gameId?: string): Promise<LiveTableItem[]> {
  const rows = await db.select({ table: gameTables, game: games, tournamentId: tournaments.id, tournamentTitleFa: tournaments.titleFa, round: tournamentTables.round })
    .from(gameTables).innerJoin(games, eq(games.id, gameTables.gameId))
    .leftJoin(tournamentTables, eq(tournamentTables.tableId, gameTables.id)).leftJoin(tournaments, eq(tournaments.id, tournamentTables.tournamentId))
    .where(and(eq(gameTables.status, 'active'), eq(gameTables.isTutorial, false), eq(games.status, 'active'),
      sql`(${gameTables.visibility} = 'public' or ${tournamentTables.tableId} is not null)`, gameId ? eq(gameTables.gameId, gameId) : undefined))
    // Tournament tables first, then the most recently started.
    .orderBy(sql`${tournamentTables.tableId} is null`, desc(gameTables.startedAt)).limit(50);
  const ids = rows.map((r) => r.table.id);
  const seats = ids.length ? await db.select({ tableId: participants.tableId, seat: participants.seat, kind: participants.kind, name: users.displayName })
    .from(participants).leftJoin(users, eq(users.id, participants.userId)).where(inArray(participants.tableId, ids)).orderBy(participants.seat) : [];
  return rows.map(({ table, game, tournamentId, tournamentTitleFa, round }) => ({
    id: table.id, gameId: game.id, gameNameFa: game.nameFa, pace: table.pace as LiveTableItem['pace'],
    startedAt: table.startedAt?.toISOString() ?? null,
    players: seats.filter((x) => x.tableId === table.id).map((x) => x.name ?? (x.kind === 'bot' ? 'ربات' : 'جایگزین')),
    tournament: tournamentId ? { id: tournamentId, titleFa: tournamentTitleFa!, round: round! } : null
  }));
}

// ---------- In-app notifications (FR-13). Text never includes hidden game information. ----------

export async function listNotifications(db: Db, userId: string): Promise<NotificationItem[]> {
  const rows = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(30);
  return rows.map(toNotificationItem);
}

/** Payload holds only public, non-game-secret fields; the text is rendered here so clients never get raw data. */
export function toNotificationItem(n: typeof notifications.$inferSelect): NotificationItem {
  const p = n.payload as { tableId?: string; gameNameFa?: string; actorName?: string; conversationId?: string; clubSlug?: string; clubName?: string;
    tournamentId?: string; titleFa?: string; round?: number; rank?: number; cancelled?: boolean };
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
    mention: `${actor} شما را در یک گفتگو نام برد.`,
    friend_request: `${actor} برای شما درخواست دوستی فرستاد.`,
    club: `درخواست تازه در باشگاه «${p.clubName ?? ''}».`,
    tournament: p.cancelled ? `تورنمنت «${p.titleFa}» لغو شد؛ ورودی شما برمی‌گردد.`
      : p.rank ? `تورنمنت «${p.titleFa}» تمام شد؛ رتبهٔ شما: ${p.rank.toLocaleString('fa-IR')}.`
        : `دور ${(p.round ?? 1).toLocaleString('fa-IR')} تورنمنت «${p.titleFa}» شروع شد؛ سر میز بیایید.`
  }[kind] ?? 'اعلان تازه';
  const href = p.tableId ? `/tables/${p.tableId}` : p.conversationId ? `/messages/${p.conversationId}`
    : p.clubSlug ? `/clubs/${p.clubSlug}` : p.tournamentId ? `/tournaments/${p.tournamentId}` : kind === 'friend_request' ? '/friends' : '/';
  return { id: n.id, kind, href, tableId: p.tableId ?? null, textFa: text, createdAt: n.createdAt.toISOString(), read: !!n.readAt };
}

export async function markNotificationsRead(db: Db, userId: string, id?: string): Promise<void> {
  await db.update(notifications).set({ readAt: sql`now()` })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), id ? eq(notifications.id, id) : undefined));
}
