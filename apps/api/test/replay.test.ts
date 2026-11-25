import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { schema } from '@bg/db';
import { loveLetterModule } from '@bg/game-love-letter';
import { grantRole, login, setup, type TestCtx } from './helpers.ts';
import { call, command, startTable, users, view, type User } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const replay = (tableId: string, user: User | { cookie: string }, rev?: number) =>
  ctx.app.inject({ method: 'GET', url: `/api/tables/${tableId}/replay${rev ? `?rev=${rev}` : ''}`, headers: { cookie: user.cookie } });

/** Two-player Love Letter: hands dealt at revision 1, then a player resigns → finished. */
async function finishedLoveLetter() {
  const t = await startTable(ctx, 'love-letter', 2);
  expect((await command(ctx, t.players[0]!, t.tableId, t.revision, { type: 'resign' })).json().status).toBe('accepted');
  const v = await view(ctx, t.players[0]!, t.tableId);
  expect(v.table.status).toBe('finished');
  return { ...t, final: v.game.revision as number };
}

async function storedState(tableId: string, revision: number) {
  const { gameSnapshots: g } = schema;
  const [row] = await ctx.db.select({ state: g.state }).from(g).where(and(eq(g.tableId, tableId), eq(g.revision, revision)));
  return row!.state as Parameters<typeof loveLetterModule.project>[0];
}

describe('replay of a finished game', () => {
  it('is refused while the game runs', async () => {
    const t = await startTable(ctx, 'love-letter', 2);
    const r = await replay(t.tableId, t.players[0]!);
    expect(r.statusCode).toBe(409);
    expect(r.json().errorCode).toBe('REPLAY_NOT_AVAILABLE');
  });

  it('every revision is exactly the spectator projection, even for a player: no hand of any seat', async () => {
    const t = await finishedLoveLetter();
    const first = await replay(t.tableId, t.players[0]!);
    expect(first.statusCode).toBe(200);
    expect(first.headers['cache-control']).toBe('private, max-age=86400');
    const body = first.json();
    expect(body).toMatchObject({ revision: 1, total: t.final, gameId: 'love-letter', gameNameFa: expect.any(String) });
    expect(body.seats).toHaveLength(2);
    expect(body.result.placements).toHaveLength(2);
    for (let rev = 1; rev <= t.final; rev++) {
      const step = (await replay(t.tableId, t.players[0]!, rev)).json();
      const state = await storedState(t.tableId, rev);
      expect(step.view).toEqual(JSON.parse(JSON.stringify(loveLetterModule.project(state, { kind: 'spectator' }))));
      expect(step.view.hand).toBeNull();
      expect(step.view.seen).toBeNull();
      expect(step.view.hands).toBeUndefined();
      expect(step.view.deck).toBeUndefined();
      // The requesting player's own hand at that revision never leaks into the replay.
      const serialized = JSON.stringify(step);
      expect(serialized).not.toContain('"hands"');
    }
    // Out-of-range revisions are clamped to the last one.
    expect((await replay(t.tableId, t.players[1]!, 999)).json().revision).toBe(t.final);
  });

  it('admins get the spectator projection too', async () => {
    const t = await finishedLoveLetter();
    const admin = await login(ctx.app);
    await grantRole(ctx.db, admin.mobile, 'admin');
    const step = (await replay(t.tableId, admin, 1)).json();
    expect(step.view).toEqual(JSON.parse(JSON.stringify(loveLetterModule.project(await storedState(t.tableId, 1), { kind: 'spectator' }))));
  });

  it('follows table visibility: private = members only, public = any signed-in user, guests need login', async () => {
    const t = await finishedLoveLetter();
    const [outsider] = await users(ctx, 1);
    expect((await replay(t.tableId, outsider!)).statusCode).toBe(403);
    expect((await call(ctx, 'GET', `/api/tables/${t.tableId}/replay`)).statusCode).toBe(401);
    await ctx.db.update(schema.gameTables).set({ visibility: 'public' }).where(eq(schema.gameTables.id, t.tableId));
    expect((await replay(t.tableId, outsider!)).statusCode).toBe(200);
  });

  it('tutorial tables have no replay, even for their owner', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/love-letter/start', u, { restart: false })).json();
    await ctx.db.update(schema.gameTables).set({ status: 'finished' }).where(eq(schema.gameTables.id, tableId));
    expect((await replay(tableId, u!)).statusCode).toBe(403);
  });
});
