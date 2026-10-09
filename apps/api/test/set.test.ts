import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { findSet, isSet, setModule } from '@bg/game-set';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

const sorted = (c: number[]) => [...c].sort((a, b) => a - b);

describe('set through the platform', () => {
  it('is in the catalog for 2–8 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/set')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 8, isTestGame: false });
  });

  it('three players race on one table to a result; the deck order is never sent; stale claims are refused', async () => {
    const t = await startTable(ctx, 'set', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    let v = await view(ctx, t.players[0]!, t.tableId);
    expect(v.game.view).not.toHaveProperty('deck');
    expect(v.game.view.deckCount).toBe(81 - v.game.view.table.length);

    // A wrong claim costs a point and keeps the cards.
    const table = v.game.view.table as number[];
    let miss: number[] | null = null;
    for (let i = 0; i < table.length && !miss; i++) for (let j = i + 1; j < table.length && !miss; j++) for (let k = j + 1; k < table.length && !miss; k++)
      if (!isSet(table[i]!, table[j]!, table[k]!)) miss = [table[i]!, table[j]!, table[k]!];
    expect((await command(ctx, bySeat(1), t.tableId, v.game.revision, { type: 'claim', cards: sorted(miss!) })).json()).toMatchObject({ status: 'accepted' });
    v = await view(ctx, t.players[0]!, t.tableId);
    expect(v.game.view.scores[1]).toBe(-1);

    // Two players see the same set; the first claim wins, the second (old revision) is refused.
    const found = sorted(findSet(v.game.view.table)!);
    const rev = v.game.revision;
    expect((await command(ctx, bySeat(0), t.tableId, rev, { type: 'claim', cards: found })).json()).toMatchObject({ status: 'accepted' });
    expect((await command(ctx, bySeat(2), t.tableId, rev, { type: 'claim', cards: found })).json()).toMatchObject({ status: 'rejected', errorCode: 'STALE_REVISION' });

    for (let n = 0; n < 60; n++) {
      v = await view(ctx, t.players[0]!, t.tableId);
      if (v.table.status === 'finished') break;
      const r = await command(ctx, bySeat(n % 3), t.tableId, v.game.revision, { type: 'claim', cards: sorted(findSet(v.game.view.table)!) });
      expect(r.json().status).toBe('accepted');
    }
    expect(v.table.status).toBe('finished');
    expect(v.game.result.placements).toHaveLength(3);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/set/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of setModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
    expect(snap.game.view.scores).toEqual([3, 0]);
  });
});
