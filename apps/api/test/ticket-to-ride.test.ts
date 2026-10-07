import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { ttrModule } from '@bg/game-ticket-to-ride';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('ticket to ride through the platform', () => {
  it('is in the catalog with its map choice', async () => {
    const g = (await call(ctx, 'GET', '/api/games/ticket-to-ride')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 5, isTestGame: false });
    expect(g.options.map((o: { key: string }) => o.key)).toEqual(['map']);
  });

  it('simultaneous ticket choice, then card draws through the shared command path; hands and tickets stay private', async () => {
    const t = await startTable(ctx, 'ticket-to-ride', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    let views = await Promise.all(t.players.map((u) => view(ctx, u, t.tableId)));
    for (const v of views) expect(v.game.view.myOffer).toHaveLength(3);
    // Everyone keeps two tickets, in any order.
    for (const seat of [2, 0, 1]) {
      const v = views.find((x) => x.table.mySeat === seat)!;
      const latest = await view(ctx, bySeat(seat), t.tableId);
      const r = await command(ctx, bySeat(seat), t.tableId, latest.game.revision, { type: 'keep', keep: v.game.view.myOffer.slice(0, 2) });
      expect(r.json(), `seat ${seat}`).toMatchObject({ status: 'accepted' });
    }
    views = await Promise.all(t.players.map((u) => view(ctx, u, t.tableId)));
    const current = views[0]!.game.view.current as number;
    expect(views[0]!.game.view.phase).toBe('play');
    const cur = views.find((v) => v.table.mySeat === current)!;
    expect((await command(ctx, bySeat((current + 1) % 3), t.tableId, cur.game.revision, { type: 'drawDeck' })).json().errorCode).toBe('NOT_YOUR_TURN');
    expect((await command(ctx, bySeat(current), t.tableId, cur.game.revision, { type: 'drawDeck' })).json()).toMatchObject({ status: 'accepted' });
    views = await Promise.all(t.players.map((u) => view(ctx, u, t.tableId)));
    for (const v of views) {
      const json = JSON.stringify(v.game.view);
      for (const k of ['"hands":', '"deck":', '"tickets":', '"offer":', '"ticketDeck":', '"rng"']) expect(json).not.toContain(k);
      expect(v.game.view.handCounts[current]).toBe(5);
      expect(v.game.view.myTickets).toHaveLength(2);
    }
  });

  it('the interactive tutorial runs on the server with its scripted opponent and completes', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/ticket-to-ride/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    expect(snap.game.view.map).toBe('iran');
    for (const step of ttrModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((p: { place: number }) => p.place === 1).seat).toBe(0);
  });
});
