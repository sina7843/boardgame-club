// Regression tests for the independent rules audit of Ark Nova (FAQ / errata / glossary points).
import { describe, expect, it } from 'vitest';
import { ANIMAL, arkNovaModule, core, hex, restartTurn, type State } from '@bg/game-ark-nova';
import { applyAction, startGame, type EngineSnapshot } from '../src/index.ts';

const m = arkNovaModule as never;
const rng = { nextInt: () => 0 };
const st = (s: EngineSnapshot) => s.state as State;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, { kind: 'player', seat }, action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
function drafted(seed = 3): EngineSnapshot {
  let snap = startGame(m, { playerCount: 2, seed, options: {} }).snapshot;
  for (let seat = 0; seat < 2; seat++) snap = act(snap, seat, { type: 'draft', keep: st(snap).drafts[seat]!.cards.slice(0, 4) });
  return snap;
}
const head = (snap: EngineSnapshot) => st(snap).queue[0]!;
function choose(snap: EngineSnapshot, prefix: string): EngineSnapshot {
  const h = head(snap);
  if (h.k !== 'option') throw new Error(`head is ${h.k}`);
  const o = h.options.find((x) => x.value.startsWith(prefix));
  if (!o) throw new Error(`no option ${prefix} in ${h.options.map((x) => x.value).join(' ')}`);
  return act(snap, h.seat, { type: 'answer', value: o.value });
}

describe('ark nova audit regressions', () => {
  it('a Final Scoring card discarded at 10 conservation goes under the pile, so Resistance never draws it back first', () => {
    const s = st(drafted());
    const seat = s.first;
    const pl = s.players[seat]!;
    const kept = s.finalsDeck[0]!;
    const gone = pl.finals[0]!;
    core.runFx(core.ctx(s, seat, rng), 'core:finalDiscarded', null, { ids: [gone] });
    expect(s.finalsDeck.at(-1)).toBe(gone);
    expect(s.finalsDeck[0]).toBe(kept);
    expect(pl.finals).not.toContain(gone);
  });

  it('moving an animal into a new Reptile House frees the smallest enclosure that meets its water need, and needs water at the house too', () => {
    const s = st(drafted());
    const seat = s.first;
    const pl = s.players[seat]!;
    const c = core.ctx(s, seat, rng);
    const water = core.mapOf(pl).water;
    const rock = core.mapOf(pl).rock;
    const nearWater = hex.CELLS.find((x) => !core.coveredCells(pl).has(x) && !water.includes(x) && !rock.includes(x) && hex.neighbors(x).some((y) => water.includes(y)))!;
    const dry = hex.CELLS.find((x) => x !== nearWater && !core.coveredCells(pl).has(x) && !water.includes(x) && !rock.includes(x)
      && !hex.neighbors(x).some((y) => water.includes(y) || rock.includes(y)) && !hex.neighbors(x).includes(nearWater))!;
    const turtle = 484; // European Pond Turtle: 1-space enclosure next to 1 water, or Reptile House (1 space)
    expect(ANIMAL[turtle]!.water).toBe(1);
    pl.zoo = [turtle, 486];
    // The dry 1-space enclosure comes first (and is as small), so the old "smallest by size" rule freed it.
    pl.buildings.push({ id: 90, kind: 'e1', cells: [dry], full: true }, { id: 91, kind: 'e1', cells: [nearWater], full: true });
    pl.buildings.push({ id: 92, kind: 'rh', cells: [nearWater], used: 0 }); // geometry only matters for adjacency here
    core.runFx(c, 'core:moved', 'rh', { ids: [turtle] });
    expect(pl.buildings.find((b) => b.id === 91)!.full).toBe(false);
    expect(pl.buildings.find((b) => b.id === 90)!.full).toBe(true);
    expect(pl.buildings.find((b) => b.id === 92)!.used).toBe(1);

    // A house without water next to it cannot take the turtle: nothing moves.
    pl.buildings = pl.buildings.filter((b) => b.id < 90);
    pl.buildings.push({ id: 93, kind: 'e1', cells: [nearWater], full: true }, { id: 94, kind: 'rh', cells: [dry], used: 0 });
    core.runFx(c, 'core:moved', 'rh', { ids: [turtle] });
    expect(pl.buildings.find((b) => b.id === 93)!.full).toBe(true);
    expect(pl.buildings.find((b) => b.id === 94)!.used).toBe(0);
  });

  it('every Multiplier token on a card gives one repetition (2 tokens = 3 actions)', () => {
    let snap = drafted(5);
    const s = st(snap);
    const seat = s.first;
    s.players[seat]!.tok.sponsors.mult = 2;
    s.players[seat]!.x = 0;
    restartTurn(s, seat);
    const str = s.players[seat]!.slots.indexOf('sponsors') + 1;
    snap = choose(snap, 'a:sponsors:0');
    snap = choose(snap, 'break');
    expect(head(snap)).toMatchObject({ seat, fx: 'core:repeat' });
    snap = choose(snap, 'x0');
    snap = choose(snap, 'break');
    expect(head(snap)).toMatchObject({ seat, fx: 'core:repeat' });
    snap = choose(snap, 'x0');
    snap = choose(snap, 'break');
    const after = st(snap).players[seat]!;
    expect(after.money).toBe(25 + 3 * str);
    expect(after.tok.sponsors.mult).toBe(0);
    expect(st(snap).act).toBeNull();
  });

  it('the X-token action on a card with a Multiplier token takes 1 X-token per action', () => {
    let snap = drafted(6);
    const s = st(snap);
    const seat = s.first;
    s.players[seat]!.tok.cards.mult = 1;
    s.players[seat]!.x = 0;
    restartTurn(s, seat);
    snap = choose(snap, 'x:cards');
    expect(st(snap).players[seat]!.x).toBe(2);
    expect(st(snap).players[seat]!.tok.cards.mult).toBe(0);
  });

  it('an Action card upgraded during the action counts at once for card conditions (FAQ)', () => {
    const s = st(drafted());
    const seat = s.first;
    const c = core.ctx(s, seat, rng);
    const elephant = ANIMAL[426]!; // requires the upgraded Animals card
    expect(core.missing(c, elephant, false)).toBe(1);
    s.players[seat]!.up.animals = true;
    expect(core.missing(c, elephant, false)).toBe(0);
  });

  it('crossing during another player\'s turn waits for your own turn end (FAQ, Polar Bear Exhibit)', () => {
    let snap = drafted(7);
    const s = st(snap);
    const me = s.first;
    const other = 1 - me;
    Object.assign(s.players[other]!, { appeal: 100, cp: 10 });
    s.cp10 = true;
    restartTurn(s, me);
    snap = choose(snap, 'x:');
    expect(st(snap).endAt).toBeNull();
    expect(head(snap)).toMatchObject({ seat: other, fx: 'core:turn' });
    snap = choose(snap, 'x:');
    // Ended at the end of the crossing player's turn: only the other player (me) takes one more turn.
    expect(st(snap).endAt).toBe(st(snap).turnsDone + 1);
    expect(head(snap)).toMatchObject({ seat: me, fx: 'core:turn' });
    snap = choose(snap, 'x:');
    expect(st(snap).stage).toBe('over');
    expect(st(snap).outcome!.placements[0]!.seat).toBe(other);
  });

  it('the Conservation track ends at 41', () => {
    const s = st(drafted());
    const c = core.ctx(s, s.first, rng);
    s.cp10 = true;
    core.gain(c, 'cp', 60);
    expect(s.players[s.first]!.cp).toBe(41);
  });
});
