import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@bg/db';
import { grantRole, setup, type TestCtx } from './helpers.ts';
import { call, startTable, users } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('game page content', () => {
  it('is empty by default, only admins replace it, and anyone reads it back', async () => {
    const empty = (await call(ctx, 'GET', '/api/games/chess/content')).json();
    expect(empty).toMatchObject({ aboutFa: [], faq: [], screenshots: [], sheet: { weight: null, designer: '' } });

    const [plain, admin] = await users(ctx, 2);
    await grantRole(ctx.db, admin!.mobile, 'admin');
    const body = { aboutFa: ['شطرنج کلاسیک.'], faq: [{ qFa: 'قلعه چطور است؟', aFa: 'شاه دو خانه می‌رود.' }],
      screenshots: [{ src: '/games/chess/table.webp', captionFa: 'میز شطرنج' }], sheet: { weight: 3.7, minAge: 8, designer: 'سنتی' } };
    expect((await call(ctx, 'PUT', '/api/admin/games/chess/content', plain, body)).statusCode).toBe(403);
    const saved = await call(ctx, 'PUT', '/api/admin/games/chess/content', admin, body);
    expect(saved.statusCode).toBe(200);
    const read = (await call(ctx, 'GET', '/api/games/chess/content')).json();
    expect(read).toMatchObject({ aboutFa: ['شطرنج کلاسیک.'], sheet: { weight: 3.7, minAge: 8, designer: 'سنتی', publisher: '' } });
    expect(read.faq).toHaveLength(1);

    // Image paths stay on this site.
    const bad = await call(ctx, 'PUT', '/api/admin/games/chess/content', admin, { screenshots: [{ src: 'https://example.com/x.png', captionFa: 'x' }] });
    expect(bad.statusCode).toBe(400);
  });
});

describe('game reviews', () => {
  it('need a finished table of the game, one per player, and moderators can hide them', async () => {
    const t = await startTable(ctx, 'chess', 2);
    const [author, other] = t.players;
    const review = { stars: 5, bodyFa: 'بازی عالی و سریع.' };
    expect((await call(ctx, 'PUT', '/api/games/chess/reviews/mine', author, review)).statusCode).toBe(403); // still playing
    await ctx.db.update(schema.gameTables).set({ status: 'finished' }).where(eq(schema.gameTables.id, t.tableId));

    const first = await call(ctx, 'PUT', '/api/games/chess/reviews/mine', author, review);
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ count: 1, average: 5, canReview: true, mine: { stars: 5 } });
    // Editing replaces the same review.
    const edited = (await call(ctx, 'PUT', '/api/games/chess/reviews/mine', author, { stars: 3, bodyFa: 'خوب بود.' })).json();
    expect(edited).toMatchObject({ count: 1, average: 3, distribution: [0, 0, 1, 0, 0] });
    await call(ctx, 'PUT', '/api/games/chess/reviews/mine', other, { stars: 4, bodyFa: 'دوستش داشتم.' });
    const pub = (await call(ctx, 'GET', '/api/games/chess/reviews')).json();
    expect(pub).toMatchObject({ count: 2, average: 3.5, mine: null, canReview: false });

    const [mod] = await users(ctx, 1);
    await grantRole(ctx.db, mod!.mobile, 'moderator');
    const id = edited.mine.id as string;
    expect((await call(ctx, 'PATCH', `/api/mod/reviews/${id}`, mod, { hidden: true, reason: 'هرزنامه' })).statusCode).toBe(204);
    expect((await call(ctx, 'GET', '/api/games/chess/reviews')).json()).toMatchObject({ count: 1, average: 4 });
  });
});
