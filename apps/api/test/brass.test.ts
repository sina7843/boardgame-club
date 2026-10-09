import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { brassModule } from '@bg/game-brass';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

type Hint = { type: string; cards?: number[]; industry?: string; loc?: string; slot?: number };

describe('brass through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/brass')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('hands, deck and the face-down card stay on the server; a 2-player table plays to a scored result', async () => {
    const t = await startTable(ctx, 'brass', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const first = (await view(ctx, t.players[0]!, t.tableId)).game.view;
    for (const k of ['deck', 'hands', 'discards', 'facedown', 'timeouts']) expect(first).not.toHaveProperty(k);
    expect(first.deckCount).toBe(40 - 2 * 8 - 2);
    expect(first.handCounts).toEqual([8, 8]);
    expect(first.hand).toHaveLength(8);
    // Not your turn → rejected; a card you do not hold → rejected.
    const cur = first.current as number;
    const other = (await view(ctx, bySeat(1 - cur), t.tableId)).game;
    expect((await command(ctx, bySeat(1 - cur), t.tableId, other.revision, { type: 'pass', card: other.view.hand[0] })).json()).toMatchObject({ status: 'rejected' });
    const mine = (await view(ctx, bySeat(cur), t.tableId)).game;
    expect((await command(ctx, bySeat(cur), t.tableId, mine.revision, { type: 'pass', card: other.view.hand[0] })).json()).toMatchObject({ status: 'rejected' });

    let snap = await view(ctx, bySeat(cur), t.tableId);
    for (let n = 0; n < 400 && snap.table.status !== 'finished'; n++) {
      const seat = snap.game.view.current as number;
      const me = await view(ctx, bySeat(seat), t.tableId);
      const build = (me.game.legalActions as Hint[]).find((h) => h.type === 'build');
      const action = build && n % 3 === 0
        ? { type: 'build', card: build.cards![0], industry: build.industry, loc: build.loc, slot: build.slot }
        : { type: 'pass', card: me.game.view.hand[0] };
      const r = await command(ctx, bySeat(seat), t.tableId, me.game.revision, action);
      expect(r.json().status, JSON.stringify(action)).toBe('accepted');
      snap = await view(ctx, bySeat(seat), t.tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.map((x: { seat: number }) => x.seat).sort()).toEqual([0, 1]);
  }, 120_000);

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/brass/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of brassModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
