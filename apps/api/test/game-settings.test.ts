import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { schema, seed } from '@bg/db';
import { grantRole, setup, type TestCtx } from './helpers.ts';
import { call, seatsOf, users, view, type User } from './play-helpers.ts';

let ctx: TestCtx;
let admin: User;
let host: User;
let guest: User;
beforeAll(async () => {
  ctx = await setup();
  [admin, host, guest] = (await users(ctx, 3)) as [User, User, User];
  await grantRole(ctx.db, admin!.mobile, 'admin');
});
afterAll(async () => { await ctx.close(); });

const restricted = {
  paces: ['turn'], competitions: ['friendly', 'ranked'], minPlayers: 2, maxPlayers: 2,
  liveSeconds: [60], turnSeconds: [86400],
  options: { firstMove: { allowed: ['host'], default: 'host', hostChooses: false } },
  reason: 'آزمون تنظیمات بازی'
};

describe('admin game play settings', () => {
  it('shows module bounds and current offer to admins only', async () => {
    expect((await call(ctx, 'GET', '/api/admin/games/line-three/settings', host)).statusCode).toBe(403);
    const v = (await call(ctx, 'GET', '/api/admin/games/line-three/settings', admin)).json();
    expect(v.supported.paces).toEqual(['live', 'turn']);
    expect(v.supported.options[0]).toMatchObject({ key: 'firstMove', default: 'random' });
    expect(v.current.options.firstMove).toEqual({ allowed: ['random', 'host'], default: 'random', hostChooses: true });
    expect(v.current.liveSeconds).toEqual([15, 30, 60, 120, 300]);
  });

  it('refuses settings outside what the module supports', async () => {
    for (const bad of [
      { ...restricted, liveSeconds: [7] },
      { ...restricted, maxPlayers: 3 },
      { ...restricted, options: { firstMove: { allowed: ['loser'], default: 'loser', hostChooses: true } } },
      { ...restricted, options: { unknown: { allowed: [1], default: 1, hostChooses: true } } },
      { ...restricted, options: { firstMove: { allowed: ['host'], default: 'random', hostChooses: true } } }
    ]) {
      const res = await call(ctx, 'PUT', '/api/admin/games/line-three/settings', admin, bad);
      expect(res.statusCode, JSON.stringify(bad)).toBe(400);
      expect(res.json().errorCode).toBe('GAME_SETTINGS_INVALID');
    }
  });

  it('narrows what players can create, is audited, and fixed variants reach the rules', async () => {
    const res = await call(ctx, 'PUT', '/api/admin/games/line-three/settings', admin, restricted);
    expect(res.statusCode).toBe(200);
    const detail = (await call(ctx, 'GET', '/api/games/line-three')).json();
    expect(detail).toMatchObject({ paces: ['turn'], turnSeconds: [86400], options: [{ key: 'firstMove', default: 'host', hostChooses: false, choices: [{ value: 'host' }] }] });
    const audit = (await call(ctx, 'GET', '/api/mod/audit?action=game.settings', admin)).json().items;
    expect(audit[0]).toMatchObject({ action: 'game.settings', targetId: 'line-three' });

    const create = (body: object) => call(ctx, 'POST', '/api/tables', host, { gameId: 'line-three', capacity: 2, ...body });
    expect((await create({ pace: 'live', turnSeconds: 60 })).json().errorCode).toBe('MODE_NOT_SUPPORTED');
    expect((await create({ pace: 'turn', turnSeconds: 43200 })).json().errorCode).toBe('INVALID_TIME_SETTING');
    expect((await create({ pace: 'turn', turnSeconds: 86400, options: { firstMove: 'random' } })).json().errorCode).toBe('OPTION_NOT_ALLOWED');
    expect((await create({ pace: 'turn', turnSeconds: 86400, options: { nope: 1 } })).json().errorCode).toBe('OPTION_NOT_ALLOWED');

    const created = await create({ pace: 'turn', turnSeconds: 86400 });
    expect(created.statusCode).toBe(201);
    const tableId = created.json().id as string;
    const invite = (await view(ctx, host!, tableId)).table.inviteCode;
    await call(ctx, 'POST', `/api/tables/${tableId}/join`, guest, { inviteCode: invite });
    for (const p of [host, guest]) await call(ctx, 'POST', `/api/tables/${tableId}/ready`, p, { ready: true });
    const snap = await view(ctx, host!, tableId);
    expect(snap.table.settings.options).toEqual({ firstMove: 'host' });
    // Host sits in seat 0 and must move first under the "host" variant.
    const bySeat = await seatsOf(ctx, tableId, [host!, guest!]);
    expect(bySeat(0).id).toBe(host!.id);
    expect(snap.game.legalActions.some((a: { type: string }) => a.type === 'place')).toBe(true);
  });

  it('re-seeding keeps admin choices (access, modes, play settings)', async () => {
    await call(ctx, 'PATCH', '/api/admin/games/sealed-bids/access', admin, { access: 'premium', premiumHostInvitesFree: true, reason: 'آزمون بذر' });
    await seed(ctx.db);
    const [lt] = await ctx.db.select().from(schema.games).where(eq(schema.games.id, 'line-three'));
    const [sb] = await ctx.db.select().from(schema.games).where(eq(schema.games.id, 'sealed-bids'));
    expect(sb!.access).toBe('premium');
    expect(lt!.paces).toEqual(['turn']);
    expect(lt!.playSettings.turnSeconds).toEqual([86400]);
  });
});
