import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { gaiaProjectModule } from '@bg/game-gaia-project';
import { call, command, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

type Act = { type: string; [k: string]: unknown };

/** Simple deterministic policy: decline leech / first choice, first faction/hex/booster, a mine in rounds 1–2, else pass. */
function pick(acts: Act[], round: number): Act | null {
  const a = acts.filter((x) => x.type !== 'resign');
  if (!a.length) return null;
  const decide = a.filter((x) => x.type === 'decide');
  if (decide.length) return decide.find((x) => x.choice === 'decline') ?? decide[0]!;
  const mine = a.find((x) => x.type === 'mine');
  if (mine && round <= 2) return mine;
  return a.find((x) => x.type === 'pass') ?? a.find((x) => x.type !== 'convert' && x.type !== 'burn') ?? a[0]!;
}

describe('gaia-project through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/gaia-project')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('a two-player game runs from faction choice to the final scoring; engine internals are never sent', async () => {
    const t = await startTable(ctx, 'gaia-project', 2);
    let snap = await view(ctx, t.players[0]!, t.tableId);
    for (let n = 0; n < 600 && snap.table.status !== 'finished'; n++) {
      let acted = false;
      for (const u of t.players) {
        const me = await view(ctx, u, t.tableId);
        if (me.table.status === 'finished') break;
        const v = me.game.view;
        expect(v).not.toHaveProperty('ins');
        expect(v).not.toHaveProperty('turnDone');
        expect(JSON.stringify(v)).not.toMatch(/"rng"|"seed"/);
        const action = pick(me.game.legalActions as Act[], v.round as number);
        if (!action) continue;
        const r = await command(ctx, u, t.tableId, me.game.revision, action);
        expect(r.json().status, JSON.stringify(action)).toBe('accepted');
        acted = true;
        break;
      }
      expect(acted).toBe(true);
      snap = await view(ctx, t.players[0]!, t.tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.view.round).toBe(6);
    expect(snap.game.result.placements).toHaveLength(2);
    for (const x of snap.game.result.placements as { place: number; score: number }[]) expect(x.score).toBeGreaterThan(0);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/gaia-project/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of gaiaProjectModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    const win = snap.game.result.placements.find((x: { place: number }) => x.place === 1);
    expect(win).toMatchObject({ seat: 0, score: 107 });
  });
});
