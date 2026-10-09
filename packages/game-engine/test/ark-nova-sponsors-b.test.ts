import { describe, expect, it } from 'vitest';
import { arkNovaModule, CATEGORIES, CONTINENTS, core, flow, hex, restartTurn, type AbilityKey, type Icon, type State } from '@bg/game-ark-nova';
import { applyAction, startGame, type EngineSnapshot } from '../src/index.ts';

const m = arkNovaModule as never;
const rng0 = { nextInt: () => 0 };
const CATS: string[] = [...CATEGORIES, ...CONTINENTS];
const st = (s: EngineSnapshot) => s.state as State;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
function drafted(seed: number): EngineSnapshot {
  let snap = startGame(m, { playerCount: 2, seed, options: {} }).snapshot;
  for (let seat = 0; seat < 2; seat++) {
    const d = st(snap).drafts[seat]!;
    snap = act(snap, seat, { type: 'draft', keep: d.cards.slice(0, 4), ...(d.maps.length ? { map: d.maps[0] } : {}) });
  }
  return snap;
}
/** A drafted 2-player state with an empty queue, both players rich and well reputed, no cards in the zoos. */
function fresh(seed = 1): State {
  const s = st(drafted(seed));
  s.queue = []; s.act = null; s.inTurn = false;
  core.resetBuffer();
  for (const pl of s.players) { pl.money = 50; pl.rep = 9; pl.appeal = 0; pl.hand = []; pl.zoo = []; }
  return s;
}
const C = (s: State, seat = 0) => core.ctx(s, seat, rng0);
const play = (s: State, id: number, seat = 0) => { core.playSponsor(C(s, seat), id); flow.settle(s, rng0); };
const head = (s: State) => s.queue[0]!;
/** Plain animals (no ability) whose icons contain `i` exactly `k` times. */
const animalsWith = (i: Icon, k = 1) =>
  Object.values(core.ANIMAL).filter((a) => !a.ab.length && a.icons.filter((x) => x === i).length === k).map((a) => a.id);
/** Play a card's icons into a zoo (the card joins the zoo first, as the engine does). */
function playIcons(s: State, seat: number, id: number) {
  s.players[seat]!.zoo.push(id);
  core.emit(s, rng0, { t: 'icons', seat, card: id, icons: core.cardIcons(id), source: 'animal' });
  flow.settle(s, rng0);
}
const emitIcons = (s: State, seat: number, icons: Partial<Record<Icon, number>>) => {
  core.emit(s, rng0, { t: 'icons', seat, card: null, icons, source: 'animal' });
  flow.settle(s, rng0);
};
/** Replace an ability with a recorder (abilities live in another chunk). */
function stub(k: AbilityKey) {
  const prev = core.REG.abilities[k];
  const calls: unknown[] = [];
  core.REG.abilities[k] = { nameFa: k, textFa: () => '', now: (_c, v) => { calls.push(v); } };
  return { calls, restore: () => { if (prev) core.REG.abilities[k] = prev; else delete core.REG.abilities[k]; } };
}
/** Cover every building space except `keep` with one dummy building. */
function coverAllBut(s: State, keep: string[], seat = 0) {
  const pl = s.players[seat]!;
  pl.buildings = [{ id: 90, kind: 'e1', cells: core.buildingSpaces(pl).filter((x) => !keep.includes(x)) }];
}
/** First `n` cells of a breadth-first walk over empty building spaces (always contiguous). */
function blob(s: State, start: string, n: number): string[] {
  const ok = new Set(core.buildingSpaces(s.players[0]!));
  const out = [start];
  for (let i = 0; i < out.length && out.length < n; i++) for (const y of hex.neighbors(out[i]!)) if (ok.has(y) && !out.includes(y) && out.length < n) out.push(y);
  return out;
}

describe('ark nova sponsors-b: sponsorships 233-235', () => {
  it.each([[233, 'bird'], [234, 'predator'], [235, 'herbivore']] as const)('%i: 1 appeal per %s icon now; income 3/6/9', (id, icon) => {
    const s = fresh();
    const pl = s.players[0]!;
    pl.zoo = [{ bird: 238, predator: 239, herbivore: 240 }[icon], { bird: 238, predator: 239, herbivore: 240 }[icon]];
    expect(core.sponsorError(C(s), id, false)).toBeNull();
    play(s, id);
    expect(pl.appeal).toBe(2);
    // Expert sponsors 238/239/240 carry exactly 1 bird/predator/herbivore icon each.
    const one = { bird: 238, predator: 239, herbivore: 240 }[icon];
    const inc = (k: number) => { pl.zoo = [...Array<number>(k).fill(one), id]; const before = pl.money; core.REG.cards.get(id)!.income!({ ...C(s), card: id }); return pl.money - before; };
    expect(inc(0)).toBe(0);
    expect(inc(1)).toBe(3);
    expect(inc(2)).toBe(3);
    expect(inc(3)).toBe(6);
    expect(inc(4)).toBe(6);
    expect(inc(5)).toBe(9);
    expect(inc(8)).toBe(9);
    pl.zoo = [];
    expect(core.sponsorError(C(s), id, false)).toBe('CONDITIONS');
  });
});

describe('ark nova sponsors-b: experts 236-240 (any zoo)', () => {
  it.each([[236, 'primate'], [237, 'reptile'], [238, 'bird'], [239, 'predator'], [240, 'herbivore']] as const)('%i: 3 money per %s icon played into any zoo', (id, icon) => {
    const s = fresh();
    const owner = s.players[1]!;
    play(s, id, 1);
    expect(owner.money).toBe(53); // its own icon
    emitIcons(s, 0, { [icon]: 2 }); // another player plays two icons
    expect(owner.money).toBe(59);
    emitIcons(s, 1, { [icon]: 1 });
    expect(owner.money).toBe(62);
    emitIcons(s, 0, { science: 1 });
    expect(owner.money).toBe(62);
    expect(s.players[0]!.money).toBe(50);
  });
});

describe('ark nova sponsors-b: hydrologist 241 and geologist 242', () => {
  it('241: appeal per water icon; 1 money per covered space next to water; end CP if all water is connected', () => {
    const s = fresh();
    const pl = s.players[0]!;
    pl.zoo = [256]; // 1 water requirement icon
    play(s, 241);
    expect(pl.appeal).toBe(2);
    core.build(C(s), 'e2', ['4_3', '4_5'], true); // 4_3 touches water 4_1; 4_5 does not
    expect(pl.money).toBe(51);
    core.build(C(s), 'e1', ['5_6'], true); // next to two water spaces: still 1
    expect(pl.money).toBe(52);
    core.build(C(s, 1), 'e1', ['4_3'], true);
    expect(pl.money).toBe(52); // another player's building
    const end = () => { const before = pl.cp; core.REG.cards.get(241)!.endgame!({ ...C(s), card: 241 }); return pl.cp - before; };
    expect(end()).toBe(0);
    const water = core.mapOf(pl).water;
    pl.buildings.push({ id: 91, kind: 'e1', cells: hex.around(water).filter((x) => core.buildingSpaces(pl).includes(x)) });
    expect(end()).toBe(1);
  });

  it('242: 3 appeal per 2 rock icons; 1 money per covered space next to rock; end CP if all rock is connected', () => {
    const s = fresh();
    const pl = s.players[0]!;
    pl.zoo = [255]; // 1 rock requirement icon
    play(s, 242);
    expect(pl.appeal).toBe(3);
    core.build(C(s), 'e2', ['4_3', '4_5'], true); // both touch rock 5_4
    expect(pl.money).toBe(52);
    core.build(C(s), 'e1', ['3_6'], true);
    expect(pl.money).toBe(52);
    const end = () => { const before = pl.cp; core.REG.cards.get(242)!.endgame!({ ...C(s), card: 242 }); return pl.cp - before; };
    expect(end()).toBe(0);
    pl.buildings.push({ id: 91, kind: 'e1', cells: hex.around(core.mapOf(pl).rock).filter((x) => core.buildingSpaces(pl).includes(x)) });
    expect(end()).toBe(1);
    // 3 rock icons -> still 3 appeal (per complete pair)
    const t = fresh();
    t.players[0]!.zoo = [255, 252];
    play(t, 242);
    expect(t.players[0]!.appeal).toBe(3);
  });
});

describe('ark nova sponsors-b: unique buildings', () => {
  const cases: [number, string | null][] = [
    [244, 'NEEDS_WATER'], [245, 'NEEDS_WATER'], [246, 'NEEDS_ROCK'], [247, 'NEEDS_ROCK'], [248, null], [249, null], [250, 'NEEDS_WATER'],
    [251, 'NEEDS_WATER'], [252, 'NEEDS_ROCK'], [253, null], [254, 'NEEDS_BORDER'], [255, 'NEEDS_ROCK'], [256, 'NEEDS_WATER'], [257, 'NEEDS_BORDER']
  ];
  const sizes: Record<number, number> = { 244: 4, 245: 4, 246: 4, 247: 4, 248: 4, 249: 3, 250: 4, 251: 4, 252: 4, 253: 4, 254: 3, 255: 2, 256: 2, 257: 2 };
  it.each(cases)('%i: place prompt u<id>, illegal spot refused with %s, legal spot built', (id, err) => {
    // Their icon triggers (Perception / Sunbathing / Hunter) belong to the abilities chunk: record them instead.
    const stubs = (['perception', 'sunbathing', 'hunter'] as const).map(stub);
    try { placeCase(id, err); } finally { stubs.forEach((x) => x.restore()); }
  });
  const placeCase = (id: number, err: string | null) => {
    const s = fresh();
    const kind = `u${id}`;
    const shape = core.REG.cards.get(id)!.building!.shape;
    expect(shape).toHaveLength(sizes[id]!);
    play(s, id);
    const q = head(s);
    expect(q).toMatchObject({ k: 'place', kinds: [kind], optional: false, seat: 0 });
    const c = C(s);
    if (err) {
      const bad = hex.placementsOf(kind, shape).find((cells) => core.placeError(c, kind, cells, false) === err)!;
      expect(bad).toBeDefined();
      expect(flow.answerError(c, q as never, { kind, cells: bad })).toBe(err);
    }
    const opts = flow.placeOptions(c, q as never);
    expect(opts.length).toBeGreaterThan(0);
    flow.answer(s, rng0, opts[0]!);
    expect(s.players[0]!.buildings.some((b) => b.kind === kind)).toBe(true);
    expect(core.sponsorError(C(s), id, true)).not.toBeNull(); // only one copy of a unique building (card left the hand anyway)
  };

  it('a unique building whose card has no legal spot is refused with NO_ROOM', () => {
    const s = fresh();
    const pl = s.players[0]!;
    const c = C(s);
    const spaces = new Set(core.buildingSpaces(pl));
    const dry = hex.placementsOf('u256', core.REG.cards.get(256)!.building!.shape)
      .find((cells) => cells.every((x) => spaces.has(x)) && core.adjacentTerrain(pl, cells, 'water') === 0)!;
    coverAllBut(s, dry);
    expect(core.sponsorError(c, 256, false)).toBe('NO_ROOM');
    expect(core.sponsorError(c, 261, false)).toBeNull();
    pl.hand = [256, 261];
    expect(flow.sponsorOptions(c, 5, false).map((o) => o.value)).toEqual(['sp:261:0']);
  });

  it('255 through a real Sponsors action: printed 4 appeal, then the playground is placed next to rock', () => {
    const snap = drafted(3);
    const s = st(snap);
    const f = s.first;
    const pl = s.players[f]!;
    pl.hand = [255]; pl.appeal = 0;
    pl.slots = ['animals', 'build', 'cards', 'association', 'sponsors'];
    restartTurn(s, f);
    let q = head(s);
    expect(q.k).toBe('option');
    let next = act(snap, f, { type: 'answer', value: 'a:sponsors:0' });
    q = st(next).queue[0]!;
    expect(q.k === 'option' && q.options.map((o) => o.value)).toContain('sp:255:0');
    next = act(next, f, { type: 'answer', value: 'sp:255:0' });
    const t = st(next);
    expect(t.players[f]!.appeal).toBe(4);
    expect(t.players[f]!.zoo).toContain(255);
    expect(t.queue[0]).toMatchObject({ k: 'place', kinds: ['u255'] });
  });
});

describe('ark nova sponsors-b: 244-247 two appeal per icon', () => {
  it.each([[244, 'bird'], [245, 'water'], [246, 'rock'], [247, 'primate']] as const)('%i: 2 appeal per own %s icon; end 1 CP for 6+', (id, icon) => {
    const s = fresh();
    const pl = s.players[0]!;
    const own = core.cardIcons(id)[icon] ?? 0;
    play(s, id);
    expect(pl.appeal).toBe(2 * own);
    emitIcons(s, 0, { [icon]: 2 });
    expect(pl.appeal).toBe(2 * own + 4);
    emitIcons(s, 1, { [icon]: 3 }); // other zoos do not count
    expect(pl.appeal).toBe(2 * own + 4);
    const end = (extra: number) => {
      pl.zoo = [id]; pl.cp = 0;
      // 6+ icons: pad with cards carrying the icon (requirement icons for rock/water)
      const pad = { water: 256, rock: 255, bird: 244, primate: 247 }[icon]; // cards carrying exactly 1 such icon
      for (let k = 0; k < 10 && core.count(s, 0, icon) < extra; k++) pl.zoo.push(pad);
      core.REG.cards.get(id)!.endgame!({ ...C(s), card: id });
      return pl.cp;
    };
    expect(end(5)).toBe(0);
    expect(end(6)).toBe(1);
  });
});

describe('ark nova sponsors-b: 248-253 icon triggers', () => {
  it('248: 1 X-token per own primate icon (max 5)', () => {
    const s = fresh();
    const pl = s.players[0]!;
    play(s, 248);
    expect(pl.x).toBe(1);
    emitIcons(s, 0, { primate: 2 });
    expect(pl.x).toBe(3);
    emitIcons(s, 1, { primate: 1 });
    expect(pl.x).toBe(3);
    emitIcons(s, 0, { primate: 4 });
    expect(pl.x).toBe(5);
  });

  it('249: Perception 2 per own bird icon; 250: Sunbathing 2 per own reptile icon', () => {
    const per = stub('perception');
    const sun = stub('sunbathing');
    try {
      const s = fresh();
      play(s, 249);
      expect(per.calls).toEqual([2]);
      emitIcons(s, 0, { bird: 2 });
      expect(per.calls).toEqual([2, 2, 2]);
      emitIcons(s, 1, { bird: 1 });
      expect(per.calls).toHaveLength(3);
      play(s, 250);
      expect(sun.calls).toEqual([2]);
      emitIcons(s, 0, { reptile: 1 });
      expect(sun.calls).toEqual([2, 2]);
    } finally { per.restore(); sun.restore(); }
  });

  it('251: 2 appeal per bear icon in ANY zoo; end 1 CP for 3-5 bears, 2 for 6+', () => {
    const s = fresh();
    const pl = s.players[0]!;
    play(s, 251);
    expect(pl.appeal).toBe(2);
    emitIcons(s, 1, { bear: 1 });
    expect(pl.appeal).toBe(4);
    const end = (bears: number) => {
      pl.zoo = Array<number>(bears).fill(251); pl.cp = 0; // each copy carries 1 bear icon
      core.REG.cards.get(251)!.endgame!({ ...C(s), card: 251 });
      return pl.cp;
    };
    expect(end(2)).toBe(0);
    expect(end(3)).toBe(1);
    expect(end(5)).toBe(1);
    expect(end(6)).toBe(2);
  });

  it('252: Hunter X per own predator icon, X = predator icons in the zoo; a double icon hunts twice', () => {
    const h = stub('hunter');
    try {
      const s = fresh();
      play(s, 252);
      expect(h.calls).toEqual([1]);
      const dbl = animalsWith('predator', 2)[0] ?? 401;
      playIcons(s, 0, dbl);
      expect(h.calls).toEqual([1, 3, 3]);
      emitIcons(s, 1, { predator: 1 });
      expect(h.calls).toHaveLength(3);
    } finally { h.restore(); }
  });

  it('253: 3 tokens; per herbivore icon, discard a token to play a hand Sponsor paying its level (3 uses)', () => {
    const s = fresh();
    const pl = s.players[0]!;
    pl.money = 10; pl.hand = [261, 255];
    play(s, 253);
    // Printed order: the Okapi Stable is placed first, then its own herbivore icon makes the offer.
    let q = head(s);
    expect(q).toMatchObject({ k: 'place', kinds: ['u253'] });
    flow.answer(s, rng0, flow.placeOptions(C(s), q as never)[0]!);
    s.queue = s.queue.filter((x) => x.fx.startsWith('s253:')); // drop any placement-bonus prompts
    flow.settle(s, rng0);
    q = head(s);
    expect(q).toMatchObject({ k: 'option', fx: 's253:play', optional: true });
    expect(q.k === 'option' && q.options.map((o) => o.value)).toEqual(['261', '255']);
    const money = pl.money;
    flow.answer(s, rng0, { value: '261' });
    expect(pl.money).toBe(money - 3);
    expect(pl.zoo).toContain(261);
    expect(pl.cp).toBe(1);
    expect(pl.data[253]).toEqual({ tok: 2 });
    s.queue = [];
    // Declining keeps the token.
    emitIcons(s, 0, { herbivore: 1 });
    expect(head(s)).toMatchObject({ fx: 's253:play' });
    flow.answer(s, rng0, { skip: true });
    expect(pl.data[253]).toEqual({ tok: 2 });
    // Another zoo's herbivore does nothing; no tokens left -> no offer.
    emitIcons(s, 1, { herbivore: 1 });
    expect(s.queue).toHaveLength(0);
    pl.data[253] = { tok: 0 };
    pl.hand = [261];
    emitIcons(s, 0, { herbivore: 1 });
    expect(s.queue).toHaveLength(0);
  });
});

describe('ark nova sponsors-b: 254-257', () => {
  it('254: printed 1 reputation + 1 CP, a building on 2+ border spaces, then 1 card from range or deck', () => {
    const s = fresh();
    const pl = s.players[0]!;
    pl.rep = 1; pl.cp = 0;
    play(s, 254);
    expect(pl.rep).toBe(2);
    expect(pl.cp).toBe(1);
    const q = head(s);
    expect(q).toMatchObject({ k: 'place', kinds: ['u254'] });
    const opts = flow.placeOptions(C(s), q as never);
    expect(opts.every((o) => o.cells.filter(hex.isBorder).length >= 2)).toBe(true);
    flow.answer(s, rng0, opts[0]!);
    expect(head(s)).toMatchObject({ k: 'option', fx: 'core:card1ed' });
    const hand = pl.hand.length;
    flow.answer(s, rng0, { value: 'deck' });
    expect(pl.hand.length).toBe(hand + 1);
  });

  it('255/256: printed 4 appeal', () => {
    for (const id of [255, 256]) {
      const s = fresh();
      play(s, id);
      expect(s.players[0]!.appeal).toBe(4);
    }
  });

  it('257: on 2 border spaces anywhere; later buildings may touch it; income 2 per adjacent non-empty building; 5 appeal if full', () => {
    const s = fresh();
    const pl = s.players[0]!;
    play(s, 257);
    const q = head(s);
    const c = C(s);
    const cov = core.coveredCells(pl);
    const far = flow.placeOptions(c, q as never).find((o) => !hex.around(o.cells).some((x) => cov.has(x)))!;
    expect(far).toBeDefined();
    expect(far.cells.every(hex.isBorder)).toBe(true);
    flow.answer(s, rng0, far);
    const side = pl.buildings.find((b) => b.kind === 'u257')!;
    // A building touching only the Side Entrance is legal.
    const spaces = new Set(core.buildingSpaces(pl));
    const nb = hex.around(side.cells).filter((x) => spaces.has(x) && !core.coveredCells(pl).has(x) && !hex.around([x]).some((y) => core.coveredCells(pl).has(y) && !side.cells.includes(y)));
    expect(nb.length).toBeGreaterThan(0);
    expect(core.placeError(c, 'e1', [nb[0]!], true)).toBeNull();
    // Income: empty enclosure 0, occupied enclosure 2, kiosk 2.
    const adj = hex.around(side.cells).filter((x) => spaces.has(x) && !core.coveredCells(pl).has(x));
    expect(adj.length).toBeGreaterThanOrEqual(3);
    pl.buildings.push({ id: 81, kind: 'e1', cells: [adj[0]!] }, { id: 82, kind: 'e1', cells: [adj[1]!], full: true }, { id: 83, kind: 'kiosk', cells: [adj[2]!] });
    const before = pl.money;
    core.REG.cards.get(257)!.income!({ ...c, card: 257 });
    expect(pl.money).toBe(before + 4);
    const end = () => { const a = pl.appeal; core.REG.cards.get(257)!.endgame!({ ...c, card: 257 }); return pl.appeal - a; };
    expect(end()).toBe(0);
    pl.buildings.push({ id: 84, kind: 'e1', cells: core.buildingSpaces(pl) });
    expect(end()).toBe(5);
  });
});

describe('ark nova sponsors-b: native species 258-260 and 264 (map A with its printed buildings)', () => {
  // Map A preset: kiosk 0_7 and enclosure 0_9/0_11/1_10 -> water 2_11 and rock 1_12 are connected.
  it('258: 1 appeal per connected water space; end 1 CP per 2 isolated water spaces; needs appeal <= 25', () => {
    const s = fresh();
    const pl = s.players[0]!;
    play(s, 258);
    expect(pl.appeal).toBe(1);
    pl.cp = 0;
    core.REG.cards.get(258)!.endgame!({ ...C(s), card: 258 });
    expect(pl.cp).toBe(4); // 8 isolated
    pl.appeal = 26;
    expect(core.sponsorError(C(s), 258, false)).toBe('CONDITIONS');
  });

  it('259: 1 appeal per connected rock space; end 1 CP per 2 isolated rock spaces', () => {
    const s = fresh();
    const pl = s.players[0]!;
    play(s, 259);
    expect(pl.appeal).toBe(1);
    pl.cp = 0;
    core.REG.cards.get(259)!.endgame!({ ...C(s), card: 259 });
    expect(pl.cp).toBe(3); // 6 isolated
  });

  it('260: 1 appeal per connected uncovered border building space; end 1 CP per 6 empty spaces in each contiguous group', () => {
    const s = fresh();
    const pl = s.players[0]!;
    play(s, 260);
    expect(pl.appeal).toBe(1); // only 0_5
    const end = () => { pl.cp = 0; core.REG.cards.get(260)!.endgame!({ ...C(s), card: 260 }); return pl.cp; };
    coverAllBut(s, blob(s, '4_5', 12));
    expect(end()).toBe(2);
    coverAllBut(s, blob(s, '4_5', 11));
    expect(end()).toBe(1);
    const a = blob(s, '0_1', 5);
    const b = blob(s, '8_9', 5);
    expect(hex.around(a).some((x) => b.includes(x))).toBe(false);
    coverAllBut(s, [...a, ...b]);
    expect(end()).toBe(0); // 10 empty spaces, but two groups of 5
    // Build-II spaces count too.
    const up = blob(s, '7_12', 6);
    expect(up).toEqual(expect.arrayContaining(['7_12', '8_11']));
    coverAllBut(s, up);
    expect(core.mapOf(pl).upgrade.every((x) => !core.coveredCells(pl).has(x))).toBe(true);
    expect(end()).toBe(1);
  });

  it('264: 1 appeal per connected placement-bonus space; end 1 CP per 2 isolated ones', () => {
    const s = fresh();
    const pl = s.players[0]!;
    play(s, 264);
    expect(pl.appeal).toBe(1); // 2_9
    pl.cp = 0;
    core.REG.cards.get(264)!.endgame!({ ...C(s), card: 264 });
    expect(pl.cp).toBe(5); // 11 isolated
  });
});

describe('ark nova sponsors-b: 261-263', () => {
  it('261: printed 1 appeal + 1 CP; end 1 CP for 5+ animal category icons', () => {
    const s = fresh();
    const pl = s.players[0]!;
    pl.cp = 0;
    play(s, 261);
    expect(pl.appeal).toBe(1);
    expect(pl.cp).toBe(1);
    const end = (zoo: number[]) => { pl.zoo = [261, ...zoo]; pl.cp = 0; core.REG.cards.get(261)!.endgame!({ ...C(s), card: 261 }); return pl.cp; };
    expect(end([244, 251, 239])).toBe(0); // bird + predator/bear + predator = 4 category icons
    expect(end([244, 251, 239, 240])).toBe(1); // 5 (bear counts)
  });

  it('262: 2 money per different continent/category icon; 1 appeal + 2 money for each new icon type', () => {
    const s = fresh();
    const pl = s.players[0]!;
    pl.zoo = [244, 244, 239]; // bird x2, predator: 2 different icon types (239 also pays 3 per predator icon)
    pl.money = 0;
    play(s, 262);
    expect(pl.money).toBe(4);
    // Cheetah: predator x2 (already there) + Africa (new) -> once.
    playIcons(s, 0, 401);
    expect(pl.appeal).toBe(1);
    expect(pl.money).toBe(4 + 2 + 6); // Explorer +2, Expert in Predators +6
    // Polar Bear Exhibit: predator (known) + bear (new).
    playIcons(s, 0, 251);
    expect(pl.appeal).toBe(4); // +1 Explorer, +2 its own bear trigger (251 is now in the zoo)
    expect(pl.money).toBe(12 + 2 + 3);
    playIcons(s, 0, 401); // nothing new for Explorer
    expect(pl.money).toBe(17 + 6);
    expect(pl.appeal).toBe(4);
    playIcons(s, 1, 247); // another zoo
    expect(pl.money).toBe(23);
    const z = s.zoosAvail.find((x) => core.count(s, 0, x) === 0)!;
    core.takePartner(C(s), z); // a partner zoo adds a new continent icon
    flow.settle(s, rng0);
    expect(pl.money).toBe(25);
    expect(pl.appeal).toBe(5);
    expect(CATS).toContain(z);
  });

  it('263: optional free 5-space enclosure; large animals may miss one condition', () => {
    const s = fresh();
    const pl = s.players[0]!;
    pl.up.sponsors = true; pl.rep = 6;
    expect(core.sponsorError(C(s), 263, true)).toBeNull();
    // The condition is the upgraded Sponsors card itself (it counts at once, FAQ), not the side of the running action.
    expect(core.sponsorError(C(s), 263, false)).toBeNull();
    pl.up.sponsors = false;
    expect(core.sponsorError(C(s), 263, false)).toBe('CONDITIONS');
    pl.up.sponsors = true;
    play(s, 263);
    const q = head(s);
    expect(q).toMatchObject({ k: 'place', kinds: ['e5'], free: true, optional: true });
    flow.answer(s, rng0, flow.placeOptions(C(s), q as never)[0]!);
    expect(pl.buildings.some((b) => b.kind === 'e5')).toBe(true);
    const big = Object.values(core.ANIMAL).find((a) => a.std && a.size >= 4)!;
    const small = Object.values(core.ANIMAL).find((a) => a.std && a.size <= 3)!;
    expect(core.qsum(C(s), 'ignoreConditions', big)).toBe(1);
    expect(core.qsum(C(s), 'ignoreConditions', small)).toBe(0);
  });
});
