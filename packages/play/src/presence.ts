// Online status from the session heartbeat (sessions.last_seen_at is bumped by HTTP and by a live socket every minute),
// so every API process sees the same answer without sharing socket rooms.
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Presence } from '@bg/contracts';
import { schema, type Db } from '@bg/db';

const { sessions, participants, gameTables, games, friendships } = schema;
/** A socket heartbeat lands every 60 s; two missed beats means offline. */
export const ONLINE_WINDOW_SECONDS = 150;

export async function presenceOf(db: Db, ids: string[]): Promise<Map<string, Presence>> {
  const out = new Map<string, Presence>();
  if (!ids.length) return out;
  const seen = await db.select({ userId: sessions.userId, at: sql<string>`max(${sessions.lastSeenAt})`,
    online: sql<boolean>`max(${sessions.lastSeenAt}) > now() - make_interval(secs => ${ONLINE_WINDOW_SECONDS})` })
    .from(sessions).where(inArray(sessions.userId, ids)).groupBy(sessions.userId);
  const playing = await db.select({ userId: participants.userId, tableId: gameTables.id, gameNameFa: games.nameFa }).from(participants)
    .innerJoin(gameTables, eq(gameTables.id, participants.tableId)).innerJoin(games, eq(games.id, gameTables.gameId))
    .where(and(inArray(participants.userId, ids), isNull(participants.leftAt), eq(gameTables.status, 'active'), eq(gameTables.pace, 'live'), eq(gameTables.isTutorial, false)));
  for (const id of ids) {
    const s = seen.find((x) => x.userId === id);
    const p = playing.find((x) => x.userId === id);
    const online = !!s?.online;
    out.set(id, { online, lastSeenAt: s?.at ? new Date(s.at).toISOString() : null, playing: online && p ? { tableId: p.tableId, gameNameFa: p.gameNameFa } : null });
  }
  return out;
}

/** Who may see whose status: yourself, your friends, and the players seated with you at an open or running table. */
export async function presenceAudience(db: Db, viewerId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const friends = await db.select({ low: friendships.userLow, high: friendships.userHigh }).from(friendships)
    .where(and(eq(friendships.status, 'accepted'), or(eq(friendships.userLow, viewerId), eq(friendships.userHigh, viewerId))));
  const mates = await db.select({ userId: participants.userId }).from(participants)
    .innerJoin(gameTables, eq(gameTables.id, participants.tableId))
    .where(and(inArray(participants.userId, ids), inArray(gameTables.status, ['open', 'active', 'paused']),
      sql`${participants.tableId} in (select table_id from participants where user_id = ${viewerId} and left_at is null)`));
  const allowed = new Set([viewerId, ...friends.map((f) => (f.low === viewerId ? f.high : f.low)), ...mates.map((m) => m.userId!)]);
  return ids.filter((id) => allowed.has(id));
}
