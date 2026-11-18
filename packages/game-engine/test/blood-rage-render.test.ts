// Blood Rage renderer smoke test: server-renders the table for real engine views (draft, action, battle, end) and
// checks the QA hooks of COMPONENTS.md §36 and that pieces are handoff images (no SVG-drawn figures).
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { bloodRageModule, contractHints, publicSummary, type BloodRageView, type BRState } from '@bg/game-blood-rage';
import { applyAction, startGame, type EngineSnapshot } from '../src/index.ts';

const req = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const { renderToStaticMarkup } = req('react-dom/server') as { renderToStaticMarkup: (el: unknown) => string };
const { createElement } = createRequire(new URL('../../../games/blood-rage/package.json', import.meta.url))('react') as { createElement: (c: unknown, p: unknown) => unknown };
// imported at runtime: this package's tsconfig has no JSX, the renderer is compiled by Vite here
const RENDERER = '@bg/game-blood-rage/renderer';
const { default: Renderer, bloodRageSeatCard } = await import(/* @vite-ignore */ RENDERER) as { default: unknown; bloodRageSeatCard: (seat: unknown, turn: boolean) => { detail?: unknown; score?: unknown } };
const m = bloodRageModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (snap: EngineSnapshot) => snap.state as BRState;
function html(snap: EngineSnapshot, seat: number | null): string {
  const s = st(snap);
  const viewer = seat === null ? { kind: 'spectator' as const } : p(seat);
  const view = bloodRageModule.project(s, viewer) as BloodRageView;
  return renderToStaticMarkup(createElement(Renderer, {
    view, legalActions: seat === null ? [] : contractHints(s, viewer) as never, mySeat: seat, seatName: (n: number) => `P${n}`, busy: false, onAction: () => undefined, expected: null
  }));
}

describe('blood rage renderer', () => {
  it('draft, action, battle and the end render with the handoff hooks and art', () => {
    let snap = startGame(m, { playerCount: 3, seed: 5, options: {} }).snapshot;
    let out = html(snap, 0);
    expect(out).toContain('data-act="keep"');
    expect(out).toContain('یک کارت نگه دارید');
    expect(out).toContain('class="bdr-map"');
    expect(out).not.toContain('<svg');
    expect(html(snap, null)).not.toContain('bdr-handzone');
    // play the game out with the first hint of every pending seat, rendering along the way
    let rendered = 0;
    for (let i = 0; i < 4000 && !st(snap).outcome; i++) {
      const s = st(snap);
      const seat = bloodRageModule.pendingSeats(s)[0]!;
      const h = contractHints(s, p(seat)).filter((x) => !x.disabled);
      const pick = h.find((x) => x.type === 'pillage') ?? h.find((x) => x.type === 'invade') ?? h[0]!;
      const { cost: _c, effects: _e, maxFigures: _m, targets, need, cards, ...rest } = pick as Record<string, unknown>;
      const action = pick.type === 'draftPick' ? { type: 'draftPick', cards: (cards as number[]).slice(0, need as number) }
        : pick.type === 'decide' && pick.kind === 'callToBattle' && typeof pick.choice === 'object' ? { ...rest, choice: { ...(pick.choice as object), to: (targets as string[])[0] } }
        : pick.type === 'decide' ? { type: 'decide', kind: pick.kind, choice: pick.choice } : rest;
      const r = applyAction(m, snap, p(seat), action as never, 0);
      if ('ok' in r) throw new Error(`${JSON.stringify(action)} ${r.errorCode}`);
      snap = r.snapshot;
      if (i % 25 === 0) { out = html(snap, seat); rendered++; expect(out).toContain('bdr-bar'); }
      if (st(snap).battle) expect(html(snap, seat)).toContain('data-province');
    }
    expect(st(snap).outcome).not.toBeNull();
    // §22: every Age logs the Ragnarök losses and the Valhalla release for the end-of-Age dialog
    expect(st(snap).log.some((e) => e.e === 'ragnarok')).toBe(true);
    // shell rail: publicSummary detail → bloodRageSeatCard (public data only)
    const seat0 = publicSummary(st(snap)).seats[0]!;
    expect(seat0.stats!.length).toBeLessThanOrEqual(4);
    expect(JSON.stringify(seat0.detail)).not.toContain('hand":[');
    const card = bloodRageSeatCard(seat0, false);
    expect(renderToStaticMarkup(card.detail)).toContain('bdr-stats');
    out = html(snap, 0);
    expect(out).toContain('پایان بازی');
    expect(out).toMatch(/data-fig="f\d+"/);
    expect(rendered).toBeGreaterThan(5);
  }, 60_000); // server-renders four full views; slow under the parallel suite
});
