import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { crewModuleNine } from '@bg/game-the-crew';
import { deepSeaModule } from '@bg/game-crew-deep-sea';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe.each([['the-crew', crewModuleNine], ['crew-deep-sea', deepSeaModule]] as const)('%s through the platform', (gameId, mod) => {
  it('is in the catalog for 3–5 players', async () => {
    const g = (await call(ctx, 'GET', `/api/games/${gameId}`)).json();
    expect(g).toMatchObject({ minPlayers: 3, maxPlayers: 5, isTestGame: false });
  });

  it('hands stay on the server; drafting is validated there', async () => {
    const t = await startTable(ctx, gameId, 4);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    const v = (await view(ctx, t.players[0]!, t.tableId)).game.view;
    expect(v).not.toHaveProperty('hands');
    expect(v.handCounts).toEqual([10, 10, 10, 10]);
    const cmd = v.commander as number;
    const g = (await view(ctx, bySeat(cmd), t.tableId)).game;
    expect(g.view.hand).toContain('r4');
    expect((await command(ctx, bySeat((cmd + 1) % 4), t.tableId, g.revision, { type: 'draftTask', task: 0 })).json()).toMatchObject({ status: 'rejected' });
    expect((await command(ctx, bySeat(cmd), t.tableId, g.revision, { type: 'draftTask', task: 0 })).json()).toMatchObject({ status: 'accepted' });
    const after = (await view(ctx, bySeat((cmd + 1) % 4), t.tableId)).game.view;
    expect(after.tasks[0].owner).toBe(cmd);
  });

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', `/api/tutorials/${gameId}/start`, u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of mod.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { seat: number }) => x.seat === 0).place).toBe(1);
  });
});
