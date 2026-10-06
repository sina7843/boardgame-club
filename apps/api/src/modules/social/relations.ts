import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { AppError, type PublicProfile } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { toPublicProfile } from '../users/routes.ts';

const { friendships, blocks, userMutes, users, memberships, userSettings } = schema;

export const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export async function isBlockedEither(db: Db, a: string, b: string): Promise<boolean> {
  const rows = await db.select().from(blocks).where(or(
    and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)), and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))));
  return rows.length > 0;
}

export async function areFriends(db: Db, a: string, b: string): Promise<boolean> {
  const [low, high] = pair(a, b);
  const [f] = await db.select().from(friendships).where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high), eq(friendships.status, 'accepted')));
  return !!f;
}

/** Relationship as seen by `me`. Being blocked BY someone is never revealed (shown as "none"). */
export async function relationship(db: Db, me: string, other: string) {
  if (me === other) return { relationship: 'self' as const, muted: false };
  const [iBlocked] = await db.select().from(blocks).where(and(eq(blocks.blockerId, me), eq(blocks.blockedId, other)));
  const [muted] = await db.select().from(userMutes).where(and(eq(userMutes.muterId, me), eq(userMutes.mutedId, other)));
  if (iBlocked) return { relationship: 'blocked' as const, muted: !!muted };
  const [low, high] = pair(me, other);
  const [f] = await db.select().from(friendships).where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)));
  const rel = !f ? 'none' : f.status === 'accepted' ? 'friends' : f.requestedBy === me ? 'outgoing' : 'incoming';
  return { relationship: rel as 'none' | 'friends' | 'outgoing' | 'incoming', muted: !!muted };
}

export async function requireActiveUser(db: Db, userId: string): Promise<PublicProfile> {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || u.status !== 'active') throw new AppError('NOT_FOUND');
  return toPublicProfile(u);
}

export async function profiles(db: Db, ids: string[]): Promise<Map<string, PublicProfile>> {
  if (!ids.length) return new Map();
  const rows = await db.select().from(users).where(inArray(users.id, [...new Set(ids)]));
  return new Map(rows.map((u) => [u.id, toPublicProfile(u)]));
}

/** Co-members of any active group/club: used to allow table invites beyond friends. */
export async function shareCommunity(db: Db, a: string, b: string): Promise<boolean> {
  const rows = await db.execute(sql`
    select 1 from memberships m1 join memberships m2 on m1.scope_type = m2.scope_type and m1.scope_id = m2.scope_id
    where m1.user_id = ${a} and m2.user_id = ${b} and m1.status = 'active' and m2.status = 'active' limit 1`);
  return (rows as unknown as unknown[]).length > 0;
}

export async function dmPolicy(db: Db, userId: string): Promise<'friends' | 'nobody'> {
  const [s] = await db.select({ dmPolicy: userSettings.dmPolicy }).from(userSettings).where(eq(userSettings.userId, userId));
  return (s?.dmPolicy as 'friends' | 'nobody' | undefined) ?? 'friends';
}

/** Throws unless `from` may start or continue a private conversation with `to`. Friends-only by default. */
export async function assertCanDirectMessage(db: Db, from: string, to: string): Promise<void> {
  if (from === to) throw new AppError('CANNOT_TARGET_SELF');
  if (await isBlockedEither(db, from, to)) throw new AppError('BLOCKED');
  const policy = await dmPolicy(db, to);
  if (policy === 'nobody' || !(await areFriends(db, from, to))) throw new AppError('DM_NOT_ALLOWED');
}

export async function membershipOf(db: Db, scopeType: 'group' | 'club', scopeId: string, userId: string) {
  const [m] = await db.select().from(memberships).where(and(eq(memberships.scopeType, scopeType), eq(memberships.scopeId, scopeId), eq(memberships.userId, userId)));
  return m;
}
