import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { hanabiModule } from '@bg/game-hanabi';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('hanabi through the platform', () => {
  it('is in the catalog for 2–5 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/hanabi')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 5, isTestGame: false });
  });

  it('each player sees every hand but their own', async () => {
    const t = await startTable(ctx, 'hanabi', 3);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = (await view(ctx, bySeat(1), t.tableId)).game.view;
    expect(v.hands[1].every((h: { card: unknown; id: number }) => h.card === null && h.id === -1)).toBe(true);
    expect(v.hands[0][0].card).not.toBeNull();
    expect(v).not.toHaveProperty('deck');
  });

  it('the interactive tutorial runs on the server to a team win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/hanabi/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of hanabiModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result).toMatchObject({ reason: 'win' });
    expect(snap.game.result.placements.every((x: { place: number }) => x.place === 1)).toBe(true);
  });
});
