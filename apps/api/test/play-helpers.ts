import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { schema } from '@bg/db';
import { login, ORIGIN, type TestCtx } from './helpers.ts';

export type User = { cookie: string; mobile: string; id: string };

export async function users(ctx: TestCtx, n: number): Promise<User[]> {
  const out: User[] = [];
  for (let i = 0; i < n; i++) {
    const u = await login(ctx.app);
    const me = (await ctx.app.inject({ method: 'GET', url: '/api/me', headers: { cookie: u.cookie } })).json();
    out.push({ ...u, id: me.id });
  }
  return out;
}

export const call = (ctx: TestCtx, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, user?: User, payload?: unknown) =>
  ctx.app.inject({ method, url, payload: payload as object, headers: { origin: ORIGIN, ...(user ? { cookie: user.cookie } : {}) } });

export interface Started { tableId: string; players: User[]; revision: number }

/** Create a private friendly table, have everyone join with the invite and ready up → game starts. */
export async function startTable(ctx: TestCtx, gameId: string, n: number, opts: { pace?: 'live' | 'turn'; turnSeconds?: number; players?: User[] } = {}): Promise<Started> {
  const players = opts.players ?? await users(ctx, n);
  const pace = opts.pace ?? 'live';
  const created = await call(ctx, 'POST', '/api/tables', players[0], {
    gameId, pace, capacity: n, turnSeconds: opts.turnSeconds ?? (pace === 'live' ? 60 : 86400)
  });
  if (created.statusCode !== 201) throw new Error(`create failed ${created.body}`);
  const tableId = created.json().id as string;
  const invite = (await call(ctx, 'GET', `/api/tables/${tableId}`, players[0])).json().table.inviteCode;
  for (const p of players.slice(1)) {
    const j = await call(ctx, 'POST', `/api/tables/${tableId}/join`, p, { inviteCode: invite });
    if (j.statusCode !== 200) throw new Error(`join failed ${j.body}`);
  }
  let snap;
  for (const p of players) snap = (await call(ctx, 'POST', `/api/tables/${tableId}/ready`, p, { ready: true })).json();
  return { tableId, players, revision: snap.game.revision };
}

export const command = (ctx: TestCtx, user: User, tableId: string, expectedRevision: number, action: unknown, commandId: string = randomUUID()) =>
  call(ctx, 'POST', `/api/tables/${tableId}/commands`, user, { commandId, expectedRevision, action });

export const view = async (ctx: TestCtx, user: User, tableId: string) => (await call(ctx, 'GET', `/api/tables/${tableId}`, user)).json();

/** Seat → user for a started table. */
export async function seatsOf(ctx: TestCtx, tableId: string, players: User[]) {
  const s = (await view(ctx, players[0]!, tableId)).table.seats as { seat: number; user: { id: string } }[];
  return (seat: number) => players.find((p) => p.id === s.find((x) => x.seat === seat)!.user.id)!;
}

export async function pendingDeadline(ctx: TestCtx, tableId: string, key: 'turn' | 'reminder' | 'ready' = 'turn') {
  const { scheduledDeadlines: d } = schema;
  const [row] = await ctx.db.select().from(d).where(and(eq(d.tableId, tableId), eq(d.status, 'pending'), eq(d.deadlineKey, key)));
  return row;
}

export async function makeDue(ctx: TestCtx, deadlineId: string) {
  const { scheduledDeadlines: d } = schema;
  await ctx.db.update(d).set({ dueAt: sql`now() - interval '1 second'` }).where(eq(d.id, deadlineId));
}
