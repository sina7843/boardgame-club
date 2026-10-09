import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { unoModule } from '@bg/game-uno';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('uno through the platform', () => {
  it('is in the catalog with its rule variants', async () => {
    const g = (await call(ctx, 'GET', '/api/games/uno')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 10, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['matchLength', 'unoPenalty']);
  });

  it('each player receives only their own hand; commands go through the shared command path', async () => {
    const t = await startTable(ctx, 'uno', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const views = await Promise.all(t.players.map((u) => view(ctx, u, t.tableId)));
    for (const v of views) {
      const g = v.game;
      expect(g.view.myHand.length).toBe(g.view.handCounts[v.table.mySeat]);
      const json = JSON.stringify(g.view);
      expect(json).not.toContain('"hands"');
      expect(json).not.toContain('"draw":');
      // No card from another player's hand appears in this player's payload.
      for (const other of views) {
        if (other === v) continue;
        for (const c of other.game.view.myHand) if (c.id !== g.view.top.id) expect(json).not.toContain(`"${c.id}"`);
      }
    }
    const current = views[0]!.game.view.current as number;
    const cur = views.find((v) => v.table.mySeat === current)!;
    const idle = bySeat((current + 1) % 3);
    expect((await command(ctx, idle, t.tableId, cur.game.revision, { type: 'draw' })).json().errorCode).toBe('NOT_YOUR_TURN');
    const hint = cur.game.legalActions.find((a: { type: string }) => a.type === 'play' || a.type === 'draw' || a.type === 'chooseColor');
    const action = hint.type === 'play' ? { type: 'play', card: hint.card, ...(hint.needsColor ? { color: 'b' } : {}) } : { ...hint };
    const r = await command(ctx, bySeat(current), t.tableId, cur.game.revision, action);
    expect(r.json()).toMatchObject({ status: 'accepted' });
  });

  it('the interactive tutorial runs on the server with its teaching deal and completes', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/uno/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    expect(snap.game.view.myHand.map((c: { id: string }) => c.id).sort()).toEqual(['gd2a', 'r7a', 'r8a', 'wild1', 'y8a']);
    for (const step of unoModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((p: { place: number }) => p.place === 1).seat).toBe(0);
  });
});
