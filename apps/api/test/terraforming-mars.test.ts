import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { terraformingMarsModule } from '@bg/game-terraforming-mars';
import { call, command, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

type Hint = { type: string; corps?: string[]; cards?: string[]; options?: (string | number)[]; optional?: boolean; kind?: string; project?: string; cost?: number };

/** A plain terraforming policy through the public API only: first corporation, no cards, raise parameters, else pass. */
function policy(acts: Hint[], prompt: { kind: string; min?: number; cards?: string[] } | null): object | null {
  const h = (t: string) => acts.find((a) => a.type === t);
  const corp = h('corp');
  if (corp) return { type: 'corp', corp: corp.corps![0], cards: [] };
  if (h('draft')) return { type: 'draft', card: h('draft')!.cards![0] };
  if (h('research')) return { type: 'research', cards: [] };
  const r = h('respond');
  if (r) {
    if (r.optional) return { type: 'respond', skip: true };
    const o = r.options![0];
    switch (r.kind) {
      case 'space': return { type: 'respond', space: o };
      case 'player': return { type: 'respond', seat: o };
      case 'card': return { type: 'respond', card: o };
      case 'choice': return { type: 'respond', index: o };
      case 'cards': return { type: 'respond', cards: (prompt?.cards ?? []).slice(0, prompt?.min ?? 0) };
      case 'amount': return { type: 'respond', amount: o };
    }
  }
  if (h('firstAction')) return { type: 'firstAction' };
  if (h('convertHeat')) return { type: 'convertHeat' };
  if (h('convertPlants')) return { type: 'convertPlants' };
  for (const pr of ['asteroid', 'aquifer', 'greenery']) if (acts.some((a) => a.type === 'project' && a.project === pr)) return { type: 'project', project: pr };
  if (h('pass')) return { type: 'pass' };
  return null;
}

describe('terraforming-mars through the platform', () => {
  it('is in the catalog for 2–5 players with the Corporate Era and draft options', async () => {
    const g = (await call(ctx, 'GET', '/api/games/terraforming-mars')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 5, isTestGame: false });
  });

  it('a two-player game runs to a scored result; hands, offers and the deck stay private', async () => {
    const t = await startTable(ctx, 'terraforming-mars', 2);
    let snap = await view(ctx, t.players[0]!, t.tableId);
    // Secret corporation choice: the opponent's offer is never in my view.
    const v0 = snap.game.view;
    expect(v0.deck).toBeTypeOf('number');
    expect(v0.me.corpOffer).toHaveLength(2);
    expect(v0.me.offer).toHaveLength(10);
    const theirs = (await view(ctx, t.players[1]!, t.tableId)).game.view.me;
    const own = [...v0.me.corpOffer, ...v0.me.offer];
    for (const id of [...theirs.corpOffer, ...theirs.offer]) if (!own.includes(id)) expect(JSON.stringify(v0)).not.toContain(`"${id}"`);

    for (let n = 0; n < 3000 && snap.table.status !== 'finished'; n++) {
      let acted = false;
      for (const u of t.players) {
        const me = await view(ctx, u, t.tableId);
        if (me.table.status === 'finished') break;
        expect(JSON.stringify(me.game.view)).not.toMatch(/"(queue|timeouts|rng)"/);
        for (const p of me.game.view.players) expect(p.hand).toBeTypeOf('number');
        const action = policy(me.game.legalActions as Hint[], me.game.view.prompt);
        if (!action) continue;
        const r = await command(ctx, u, t.tableId, me.game.revision, action);
        expect(r.json().status, JSON.stringify(action)).toBe('accepted');
        acted = true;
      }
      snap = await view(ctx, t.players[0]!, t.tableId);
      expect(acted || snap.table.status === 'finished').toBe(true);
    }
    expect(snap.table.status).toBe('finished');
    const v = snap.game.view;
    expect([v.temperature, v.oxygen, v.oceans]).toEqual([8, 14, 9]);
    expect(snap.game.result.placements).toHaveLength(2);
    for (const pl of snap.game.result.placements) expect(pl.score).toBe(v.players[pl.seat].score.total);
  }, 600_000);

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/terraforming-mars/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of terraformingMarsModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
    expect(snap.game.result.placements.find((x: { seat: number }) => x.seat === 0).score).toBe(39);
  });
});
