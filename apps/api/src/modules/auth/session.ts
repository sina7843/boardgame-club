import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@bg/contracts';
import { schema, type Db } from '@bg/db';
import { activeSuspension } from '@bg/play';
import { AppError } from '../../http/errors.ts';

const { sessions, users, userRoles } = schema;

/** Server-derived identity. Every actor (HTTP or socket) comes from here, never from client input. */
export interface AuthContext {
  userId: string;
  sessionId: string;
  roles: Role[];
  /** Active suspension: the session stays valid only for viewing sanctions and appealing. */
  suspended: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export async function createSession(db: Db, userId: string, ttlDays: number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function resolveSession(db: Db, token: string | undefined): Promise<AuthContext | null> {
  if (!token || token.length > 128) return null;
  const [row] = await db.select({ sessionId: sessions.id, userId: sessions.userId })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt),
      gt(sessions.expiresAt, sql`now()`), eq(users.status, 'active')));
  if (!row) return null;
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, row.userId));
  return { ...row, roles: roles.map((r) => r.role as Role), suspended: !!(await activeSuspension(db, row.userId)) };
}

export async function revokeSession(db: Db, sessionId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: sql`now()` }).where(eq(sessions.id, sessionId));
}

export function setSessionCookie(reply: FastifyReply, name: string, token: string, expiresAt: Date, secure: boolean) {
  reply.setCookie(name, token, { httpOnly: true, sameSite: 'lax', secure, path: '/', expires: expiresAt });
}

export function requireUser(req: FastifyRequest, opts: { allowSuspended?: boolean } = {}): AuthContext {
  if (!req.auth) throw new AppError('UNAUTHENTICATED');
  if (req.auth.suspended && !opts.allowSuspended) throw new AppError('ACCOUNT_SUSPENDED');
  return req.auth;
}

/** Server-side RBAC. Admin implies every role. */
export function requireRole(req: FastifyRequest, role: Role): AuthContext {
  const auth = requireUser(req);
  if (!auth.roles.includes(role) && !auth.roles.includes('admin')) throw new AppError('FORBIDDEN');
  return auth;
}
