import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { yahtzeeModule } from '@bg/game-yahtzee';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('yahtzee through the platform', () => {
  it('is in the catalog for 2–6 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/yahtzee')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 6, isTestGame: false });
  });

  it('a two-player table plays 13 rounds to a scored result', async () => {
    const t = await startTable(ctx, 'yahtzee', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    let snap = await view(ctx, t.players[0]!, t.tableId);
    expect(snap.game.view).not.toHaveProperty('script');
    for (let n = 0; n < 60 && snap.table.status !== 'finished'; n++) {
      const cur = snap.game.view.current as number;
      const me = await view(ctx, bySeat(cur), t.tableId);
      const acts = me.game.legalActions as { type: string; cat?: string }[];
      const sc = acts.find((a) => a.type === 'score');
      const action = sc ? { type: 'score', cat: sc.cat } : { type: 'roll', keep: [false, false, false, false, false] };
      const r = await command(ctx, bySeat(cur), t.tableId, me.game.revision, action);
      expect(r.json().status, JSON.stringify(action)).toBe('accepted');
      snap = await view(ctx, t.players[0]!, t.tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements).toHaveLength(2);
    expect(snap.game.view.sheets.every((s: object) => Object.keys(s).length === 13)).toBe(true);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/yahtzee/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of yahtzeeModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
