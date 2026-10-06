import { and, eq, isNull, sql } from 'drizzle-orm';
import { schema, type Db } from '@bg/db';
import type { Tx } from './runtime.ts';

const { userSanctions } = schema;

const activeOf = (userId: string, kind: 'suspended' | 'chat_restricted') => and(
  eq(userSanctions.userId, userId), eq(userSanctions.kind, kind), isNull(userSanctions.revokedAt),
  sql`(${userSanctions.endsAt} is null or ${userSanctions.endsAt} > now())`);

/** Active suspension end (null = indefinite) or undefined when not suspended. */
export async function activeSuspension(db: Db | Tx, userId: string): Promise<{ endsAt: Date | null } | undefined> {
  const [s] = await db.select({ endsAt: userSanctions.endsAt }).from(userSanctions).where(activeOf(userId, 'suspended')).limit(1);
  return s;
}

export async function isChatRestricted(db: Db | Tx, userId: string): Promise<boolean> {
  return (await db.select({ id: userSanctions.id }).from(userSanctions).where(activeOf(userId, 'chat_restricted')).limit(1)).length > 0;
}
