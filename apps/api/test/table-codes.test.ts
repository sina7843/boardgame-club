import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@bg/db';
import { setup, type TestCtx } from './helpers.ts';
import { call, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('short table codes (/t/<code>)', () => {
  it('every new table gets a unique 6-character code; a public table resolves for anyone', async () => {
    const t = await startTable(ctx, 'chess', 2);
    const code = (await view(ctx, t.players[0]!, t.tableId)).table.code as string;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    await ctx.db.update(schema.gameTables).set({ visibility: 'public' }).where(eq(schema.gameTables.id, t.tableId));
    const r = await call(ctx, 'GET', `/api/t/${code.toLowerCase()}`);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ id: t.tableId });
  });

  it('a private table resolves only for its own players', async () => {
    const t = await startTable(ctx, 'chess', 2);
    const code = (await view(ctx, t.players[0]!, t.tableId)).table.code as string;
    expect((await call(ctx, 'GET', `/api/t/${code}`)).statusCode).toBe(404);
    const [stranger] = await users(ctx, 1);
    expect((await call(ctx, 'GET', `/api/t/${code}`, stranger)).statusCode).toBe(404);
    expect((await call(ctx, 'GET', `/api/t/${code}`, t.players[1])).json()).toEqual({ id: t.tableId });
  });

  it('unknown or malformed codes are a 404 / 400', async () => {
    expect((await call(ctx, 'GET', '/api/t/ZZZZZZZ')).statusCode).toBe(404);
    expect((await call(ctx, 'GET', '/api/t/abcd')).statusCode).toBe(400);
  });
});
