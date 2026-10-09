import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, type TestCtx } from './helpers.ts';
import { arkNovaModule } from '@bg/game-ark-nova';
import { call, command, seatsOf, startTable, users, view } from './play-helpers.ts';

let ctx: TestCtx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx.close(); });

describe('ark-nova through the platform', () => {
  it('is in the catalog for 2–4 players', async () => {
    const g = (await call(ctx, 'GET', '/api/games/ark-nova')).json();
    expect(g).toMatchObject({ minPlayers: 2, maxPlayers: 4, isTestGame: false });
  });

  it('a table is played to a result: simultaneous draft, hidden hands, then a resignation ends it', async () => {
    const t = await startTable(ctx, 'ark-nova', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    let v0 = (await view(ctx, bySeat(0), t.tableId)).game;
    // Both players draft at the same time; each sees only their own 8 cards and the display stays face down.
    expect(v0.view.stage).toBe('draft');
    expect(v0.view).not.toHaveProperty('deck');
    expect(v0.view.display.every((x: unknown) => x === null)).toBe(true);
    const draft0 = v0.view.me.draft.cards as number[];
    expect(draft0).toHaveLength(8);
    const v1 = (await view(ctx, bySeat(1), t.tableId)).game;
    const draft1 = v1.view.me.draft.cards as number[];
    for (const id of draft1) expect(JSON.stringify(v0.view.me)).not.toContain(`${id},`);
    let r = await command(ctx, bySeat(0), t.tableId, v0.revision, { type: 'draft', keep: draft0.slice(0, 4) });
    expect(r.json()).toMatchObject({ status: 'accepted' });
    v0 = (await view(ctx, bySeat(1), t.tableId)).game;
    r = await command(ctx, bySeat(1), t.tableId, v0.revision, { type: 'draft', keep: draft1.slice(4) });
    expect(r.json()).toMatchObject({ status: 'accepted' });

    // Play: the waiting seat takes the X-token action (always legal) a few times; the opponent only sees counts.
    for (let i = 0; i < 4; i++) {
      const any = (await view(ctx, bySeat(0), t.tableId)).game;
      const seat = any.view.prompt.seat as number;
      const mine = (await view(ctx, bySeat(seat), t.tableId)).game;
      const x = (mine.view.prompt.options as { value: string }[]).find((o) => o.value.startsWith('x:'))!;
      expect((await command(ctx, bySeat(seat), t.tableId, mine.revision, { type: 'answer', value: x.value })).json()).toMatchObject({ status: 'accepted' });
      const other = (await view(ctx, bySeat(1 - seat), t.tableId)).game.view;
      expect(other.players[seat].x).toBe(Math.floor(i / 2) + 1);
      expect(other.players[seat]).not.toHaveProperty('hand');
    }
    const last = (await view(ctx, bySeat(0), t.tableId)).game;
    expect((await command(ctx, bySeat(0), t.tableId, last.revision, { type: 'resign' })).json()).toMatchObject({ status: 'accepted' });
    const end = await view(ctx, bySeat(1), t.tableId);
    expect(end.table.status).toBe('finished');
    expect(end.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(1);
  });

  it('a full two-player game is played through the commands endpoint to a scored result', async () => {
    type Hint = Record<string, unknown>;
    // Same policy as the engine test and the e2e driver: decision n takes the (7n mod k)-th non-X choice,
    // the minimum card picks, and skips optional prompts every 3rd time.
    const policy = (hs: Hint[], n: number): Hint => {
      const list = hs.filter((h) => h.type !== 'resign');
      if (list[0]!.type === 'draft') return { type: 'draft', keep: (list[0]!.cards as number[]).slice(0, 4) };
      const skip = list.find((h) => h.skip);
      const real = list.filter((h) => !h.skip && !(typeof h.value === 'string' && h.value.startsWith('x:')));
      if (skip && (n % 3 === 0 || !real.length)) return skip;
      const h = real.length ? real[(7 * n) % real.length]! : list[0]!;
      return h.pick ? { type: 'answer', ids: (h.pick as number[]).slice(0, h.min as number) } : h;
    };
    const t = await startTable(ctx, 'ark-nova', 2);
    const bySeat = await seatsOf(ctx, t.tableId, t.players);
    let finished = false;
    for (let n = 0; n < 4000 && !finished; n++) {
      let acted = false;
      for (const seat of [0, 1]) {
        const me = await view(ctx, bySeat(seat), t.tableId);
        if (me.table.status === 'finished') { finished = true; break; }
        const hs = (me.game.legalActions as Hint[]).filter((h) => h.type !== 'resign');
        if (!hs.length) continue;
        let r = await command(ctx, bySeat(seat), t.tableId, me.game.revision, policy(hs, n));
        // A full Ark Nova game is hundreds of decisions; wait out the per-user rate limit as a real client would.
        while (r.statusCode === 429) {
          await new Promise((ok) => setTimeout(ok, (r.json().retryAfterSeconds + 1) * 1000));
          r = await command(ctx, bySeat(seat), t.tableId, me.game.revision, policy(hs, n));
        }
        expect(r.json().status).toBe('accepted');
        acted = true;
        break;
      }
      expect(acted || finished).toBe(true);
    }
    const end = await view(ctx, bySeat(0), t.tableId);
    expect(end.table.status).toBe('finished');
    expect(end.game.result.reason).toBe('score');
    expect(end.game.view.final).toHaveLength(2);
  }, 900_000);

  it('the interactive tutorial runs on the server to a win', async () => {
    const [u] = await users(ctx, 1);
    const { tableId } = (await call(ctx, 'POST', '/api/tutorials/ark-nova/start', u, { restart: false })).json();
    let snap = await view(ctx, u!, tableId);
    for (const step of arkNovaModule.tutorial.steps) {
      const r = await command(ctx, u!, tableId, snap.game.revision, step.expected);
      expect(r.json().status, JSON.stringify(step.expected)).toBe('accepted');
      snap = await view(ctx, u!, tableId);
    }
    expect(snap.table.status).toBe('finished');
    expect(snap.game.result.placements.find((x: { place: number }) => x.place === 1).seat).toBe(0);
  });
});
