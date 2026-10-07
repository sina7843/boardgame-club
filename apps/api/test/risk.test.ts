import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { riskModule } from '@bg/game-risk';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('risk through the platform', () => {
  it('is in the catalog with its variants', async () => {
    const g = (await call(ctx, 'GET', '/api/games/risk')).json();
    expect(g).toMatchObject({ minPlayers: 3, maxPlayers: 6, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['goal', 'fortify']);
  });

  it('set-up placement goes through the shared command path; card hands stay private', async () => {
    const t = await startTable(ctx, 'risk', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    let views = await Promise.all(t.players.map((u) => view(ctx, u, t.tableId)));
    const current = views[0]!.game.view.current as number;
    const cur = views.find((v) => v.table.mySeat === current)!;
    expect((await command(ctx, bySeat((current + 1) % 3), t.tableId, cur.game.revision, { type: 'endTurn' })).json().errorCode).toBe('NOT_YOUR_TURN');
    const hint = cur.game.legalActions.find((a: { type: string }) => a.type === 'place') as { available: number; territories: string[] };
    const where = hint.territories[0]!;
    const before = cur.game.view.armies as number[];
    const r = await command(ctx, bySeat(current), t.tableId, cur.game.revision, { type: 'place', armies: { [where]: hint.available } });
    expect(r.json()).toMatchObject({ status: 'accepted' });
    views = await Promise.all(t.players.map((u) => view(ctx, u, t.tableId)));
    for (const v of views) {
      const json = JSON.stringify(v.game.view);
      expect(json).not.toContain('"hands"');
      expect(json).not.toContain('"deck"');
      expect(json).not.toContain('"rng"');
      const total = (v.game.view.armies as number[]).reduce((a, n) => a + n, 0);
      expect(total).toBe(before.reduce((a, n) => a + n, 0) + hint.available);
    }
  });

  it('the interactive tutorial runs on the server and completes', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/risk/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of riskModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((p: { place: number }) => p.place === 1).seat).toBe(0);
  });
});
