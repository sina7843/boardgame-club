import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { catanModule } from '@bg/game-catan';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('catan through the platform', () => {
  it('is in the catalog with its map variant', async () => {
    const g = (await call(ctx, 'GET', '/api/games/catan')).json();
    expect(g).toMatchObject({ minPlayers: 3, maxPlayers: 4, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['board']);
  });

  it('set-up placements go through the shared command path; hands and development cards stay private', async () => {
    const t = await startTable(ctx, 'catan', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    let views = await Promise.all(t.players.map((u) => view(ctx, u, t.tableId)));
    const current = views[0]!.game.view.current as number;
    const cur = views.find((v) => v.table.mySeat === current)!;
    expect((await command(ctx, bySeat((current + 1) % 3), t.tableId, cur.game.revision, { type: 'roll' })).json().errorCode).toBe('NOT_YOUR_TURN');
    const spot = cur.game.legalActions.find((a: { type: string }) => a.type === 'buildSettlement');
    expect((await command(ctx, bySeat(current), t.tableId, cur.game.revision, spot)).json()).toMatchObject({ status: 'accepted' });
    views = await Promise.all(t.players.map((u) => view(ctx, u, t.tableId)));
    for (const v of views) {
      const json = JSON.stringify(v.game.view);
      expect(json).not.toContain('"hands"');
      expect(json).not.toContain('"devDeck"');
      expect(json).not.toContain('"devs"');
      expect(v.game.view.buildings[spot.vertex]).toEqual({ seat: current, city: false });
    }
  });

  it('the interactive tutorial runs on the server and completes', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/catan/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    expect(snap.game.view.myVp).toBe(8);
    for (const step of catanModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((p: { place: number }) => p.place === 1).seat).toBe(0);
  });
});
