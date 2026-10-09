import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { heatModule } from '@bg/game-heat';
import { call, command, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

type Hint = { type: string; gears?: { gear: number; cost: number }[]; playable?: number[] };

describe('heat through the platform', () => {
  it('is in the catalog for 2–6 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/heat')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 6, isTestGame: false });
  });

  it('a two-player race runs to a result; hands, decks and plans stay private', async () => {
    const t = await startTable(ctx, 'heat', 2);
    let snap = await view(ctx, t.players[0]!, t.tableId);
    for (let n = 0; n < 400 && snap.table.status !== 'finished'; n++) {
      let acted = false;
      for (const u of t.players) {
        const me = await view(ctx, u, t.tableId);
        if (me.table.status === 'finished') break;
        const v = me.game.view;
        expect(JSON.stringify(v)).not.toMatch(/"(deck|engine|supply|rng|plan)":\[/);
        const other = v.racers.findIndex((_: unknown, i: number) => i !== v.me.seat);
        expect(v.racers[other].hand).toBeTypeOf('number');
        const acts = me.game.legalActions as Hint[];
        const plan = acts.find((a) => a.type === 'plan');
        let action: object | null = null;
        if (plan) {
          const free = plan.gears!.filter((o) => o.cost === 0);
          const gear = Math.max(...free.map((o) => o.gear), plan.gears![0]!.gear);
          action = { type: 'plan', gear, cards: plan.playable!.slice(0, gear).sort((a, b) => a - b) };
        } else if (acts.some((a) => a.type === 'react')) action = { type: 'react', adrenaline: false, slipstream: false, discard: [] };
        if (!action) continue;
        const r = await command(ctx, u, t.tableId, me.game.revision, action);
        expect(r.json().status, JSON.stringify(action)).toBe('accepted');
        acted = true;
      }
      expect(acted || snap.table.status === 'finished').toBe(true);
      snap = await view(ctx, t.players[0]!, t.tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements).toHaveLength(2);
    expect(snap.game.result.placements.map((x: { place: number }) => x.place).sort()).toEqual([1, 2]);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/heat/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of heatModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
