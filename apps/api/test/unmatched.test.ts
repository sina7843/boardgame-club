import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { unmatchedModule } from '@bg/game-unmatched';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('unmatched through the platform', () => {
  it('is in the catalog with the battlefield option', async () => {
    const g = (await call(ctx, 'GET', '/api/games/unmatched')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['map']);
  });

  it('heroes are picked through the command path and each player receives only their own hand', async () => {
    const t = await startTable(ctx, 'unmatched', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const heroes = ['arthur', 'medusa', 'sinbad'];
    for (let i = 0; i < 3; i++) {
      const v = await view(ctx, t.players[0]!, t.tableId);
      const seat = v.game.view.prompt.seat as number;
      expect(v.game.view.prompt.kind).toBe('pickHero');
      const other = bySeat((seat + 1) % 3);
      expect((await command(ctx, other, t.tableId, v.game.revision, { type: 'pickHero', hero: heroes[i] })).json().errorCode).toBe('NOT_YOUR_TURN');
      expect((await command(ctx, bySeat(seat), t.tableId, v.game.revision, { type: 'pickHero', hero: heroes[i] })).json()).toMatchObject({ status: 'accepted' });
    }
    const views = await Promise.all(t.players.map((u) => view(ctx, u, t.tableId)));
    for (const v of views) {
      const g = v.game.view;
      expect(g.myHand.length).toBe(g.handCounts[v.table.mySeat]);
      const json = JSON.stringify(g);
      expect(json).not.toContain('"decks"');
      expect(json).not.toContain('"hands"');
      for (const other of views) {
        if (other === v) continue;
        for (const c of other.game.view.myHand) expect(json).not.toContain(`"${c.id}"`);
      }
    }
  });

  it('the interactive tutorial runs on the server and completes with a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/unmatched/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    expect(snap.game.view.myHand.map((c: { id: string }) => c.id)).toContain('0.excalibur.1');
    for (const step of unmatchedModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((p: { place: number }) => p.place === 1).seat).toBe(0);
  });
});
