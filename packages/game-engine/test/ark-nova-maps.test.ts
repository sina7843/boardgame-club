import { describe, expect, it } from 'vitest';
import { ANIMAL, REG, SPONSOR, arkNovaModule, core, flow, hex, restartTurn, type State } from '@bg/game-ark-nova';
import { applyAction, createRng, replay, projectFor, startGame, type EngineSnapshot } from '../src/index.ts';

const m = arkNovaModule as never;
const rng = { nextInt: () => 0 };
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as State;
const MAP_IDS = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];
const mapDef = (id: string) => REG.maps.get(id)!;

function act(snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
}
function drafted(snap: EngineSnapshot): EngineSnapshot {
  for (let seat = 0; seat < st(snap).n; seat++) {
    const d = st(snap).drafts[seat];
    if (d) snap = act(snap, seat, { type: 'draft', keep: d.cards.slice(0, 4), ...(d.maps.length ? { map: d.maps[0] } : {}) });
  }
  return snap;
}
/** A drafted 2-player game on `map`; seat 0 has an empty zoo, 50 money and no turn in progress. */
function onMap(map: string): State {
  const s = st(drafted(startGame(m, { playerCount: 2, seed: 3, options: { map } }).snapshot));
  for (const pl of s.players) { pl.buildings = []; pl.zoo = []; pl.partners = []; pl.unis = []; pl.taken = []; pl.money = 50; }
  s.queue = []; s.act = null; s.inTurn = false;
  core.resetBuffer();
  return s;
}
const c0 = (s: State) => core.ctx(s, 0, rng);
const put = (s: State, kind: string, cells: string[], seat = 0) => {
  const pl = s.players[seat]!;
  const b = { id: pl.nextId++, kind, cells: [...cells].sort() };
  pl.buildings.push(b);
  return b;
};
/** A plain animal: standard enclosure of size <= max, no rock/water, no abilities (conditions are not checked by playAnimal/homesFor). */
const plain = (min: number, max = min) =>
  Object.values(ANIMAL).find((a) => a.std && a.size >= min && a.size <= max && !a.rock && !a.water && !a.ab.length)!;

describe('ark nova maps: registration and geometry', () => {
  it('maps 0-8 are registered with Persian names and text', () => {
    for (const id of MAP_IDS) {
      const d = mapDef(id);
      expect(d, id).toBeDefined();
      expect(d.nameFa).toMatch(/[؀-ۿ]/);
      expect(d.textFa!.length).toBeGreaterThan(10);
    }
    expect(['برج دیدبانی', 'محوطه‌های روباز', 'دریاچهٔ نقره‌ای', 'بندر تجاری', 'رستوران پارک', 'پژوهشکده', 'بستنی‌فروشی‌ها', 'تپه‌های هالیوود'])
      .toEqual(['1', '2', '3', '4', '5', '6', '7', '8'].map((id) => mapDef(id).nameFa));
  });

  it.each(MAP_IDS)('map %s: terrain/upgrade/bonus spaces are on the grid and disjoint; 7 left bonuses; fx bonuses registered', (id) => {
    const d = mapDef(id);
    const all = [...d.water, ...d.rock, ...(d.blocked ?? [])];
    for (const x of [...all, ...d.upgrade, ...Object.keys(d.bonuses), ...Object.keys(d.marks ?? {})]) expect(hex.CELLS, `${id} ${x}`).toContain(x);
    expect(new Set(all).size).toBe(all.length);
    for (const x of [...d.upgrade, ...Object.keys(d.bonuses)]) expect(all, `${id} ${x}`).not.toContain(x);
    expect(d.left).toHaveLength(7);
    expect(d.left.slice(0, 3).every((l) => l.income)).toBe(true);
    expect(d.left.slice(4).every((l) => !l.income)).toBe(true);
    const bonuses = [...Object.values(d.bonuses), ...d.left.map((l) => l.b), ...Object.values(d.partner), ...Object.values(d.uni), ...Object.values(d.worker)];
    for (const b of bonuses) if (b.k === 'fx') { expect(REG.fx[b.fx!], b.fx).toBeDefined(); expect(b.labelFa).toBeTruthy(); }
    expect(d.preset ?? []).toEqual([]);
  });

  it('printed data spot checks: map 0 left bonus 4 is 1 conservation income, map 3 lake money spaces, map 7 kiosk spaces', () => {
    expect(mapDef('0').left[3]).toEqual({ b: { k: 'cp', n: 1 }, income: true });
    expect(mapDef('0').bonuses['4_5']).toEqual({ k: 'money', n: 10 });
    expect(Object.values(mapDef('3').bonuses).filter((b) => b.k === 'money' && b.n === 2)).toHaveLength(11);
    expect(Object.entries(mapDef('7').bonuses).filter(([, b]) => b.k === 'kiosk').map(([x]) => x).sort()).toEqual(['1_2', '5_10', '5_4']);
    expect(mapDef('2').partner).toEqual({ 2: { k: 'upgrade' }, 3: { k: 'worker' } });
    expect(mapDef('5').uni).toEqual({ 2: { k: 'upgrade' } });
  });

  it.each(MAP_IDS)('setup with map option %s puts that map on every player', (id) => {
    const s = st(drafted(startGame(m, { playerCount: 3, seed: 11, options: { map: id } }).snapshot));
    expect(s.players.map((x) => x.map)).toEqual([id, id, id]);
    expect(s.stage).toBe('play');
  });

  it('advanced option drafts 2 distinct maps from 1-8 per player', () => {
    const s = st(startGame(m, { playerCount: 4, seed: 5, options: { map: 'advanced' } }).snapshot);
    const all = s.drafts.flatMap((d) => d!.maps);
    expect(all).toHaveLength(8);
    expect(new Set(all)).toEqual(new Set(['1', '2', '3', '4', '5', '6', '7', '8']));
  });
});

describe('ark nova maps: placement bonuses', () => {
  it.each(MAP_IDS)('map %s: a money/X/reputation placement bonus is paid once on cover', (id) => {
    const s = onMap(id);
    const pl = s.players[0]!;
    const [cell, b] = Object.entries(mapDef(id).bonuses).find(([, x]) => x.k === 'money' || x.k === 'x' || x.k === 'rep')!;
    const key = b.k as 'money' | 'x' | 'rep';
    const before = pl[key];
    const bld = core.build(c0(s), 'e1', [cell], false);
    core.flush(s);
    expect(pl[key]).toBe(before + b.n!);
    expect(pl.taken).toContain(cell);
    pl.buildings = pl.buildings.filter((x) => x.id !== bld.id);
    core.build(c0(s), 'e1', [cell], false);
    expect(pl[key]).toBe(before + b.n!);
  });

  it('map 7: a kiosk placement bonus asks for a free kiosk', () => {
    const s = onMap('7');
    core.build(c0(s), 'e1', ['1_2'], false);
    core.flush(s);
    expect(s.queue[0]).toMatchObject({ k: 'place', kinds: ['kiosk'], free: true, optional: true });
  });
});

describe('ark nova maps: special abilities', () => {
  it('map 1 Observation Tower: +2 appeal when an adjacent standard enclosure is occupied, again after release; not elsewhere', () => {
    const s = onMap('1');
    const pl = s.players[0]!;
    const a = plain(1, 2);
    expect(hex.neighbors('1_6')).toContain('2_5');
    const near = put(s, `e${a.size}`, a.size === 1 ? ['2_5'] : ['2_5', '2_7']);
    const far = put(s, `e${a.size}`, a.size === 1 ? ['7_2'] : ['7_2', '7_4']);
    const c = c0(s);
    const play = (home: number) => { pl.hand.push(a.id); const ap = pl.appeal; core.playAnimal(c, { card: a.id, home, cost: 0, folder: 0 }); core.flush(s); return pl.appeal - ap; };
    expect(play(near.id)).toBe(a.appeal + 2);
    core.releaseAnimal(c, a.id);
    expect((near as { full?: boolean }).full).toBe(false);
    expect(play(near.id)).toBe(a.appeal + 2);
    core.releaseAnimal(c, a.id);
    expect(play(far.id)).toBe(a.appeal);
    // another player's occupied enclosure next to their own tower does not pay seat 0
    const s2 = onMap('1');
    const b2 = put(s2, 'e1', ['2_5'], 1);
    const [ap0, ap1] = [s2.players[0]!.appeal, s2.players[1]!.appeal];
    core.emit(s2, rng, { t: 'occupied', seat: 1, building: b2 });
    expect(s2.players[0]!.appeal).toBe(ap0);
    expect(s2.players[1]!.appeal).toBe(ap1 + 2);
  });

  it('map 2 Outdoor Areas: standard enclosures adjacent to the gate have +2 capacity', () => {
    const s = onMap('2');
    const c = c0(s);
    const near = put(s, 'e1', ['6_7']);
    const far = put(s, 'e1', ['1_2']);
    const pz = put(s, 'pz', ['4_7', '4_5', '5_4']);
    expect(core.capacity(c, near)).toBe(3);
    expect(core.capacity(c, far)).toBe(1);
    expect(core.capacity(c, pz)).toBe(3);
    const a3 = plain(3);
    expect(core.homesFor(c, a3)).toEqual([near.id]);
  });

  it('map 3 Silver Lake: the Determination left bonus grants an extra action after the current one', () => {
    const s = onMap('3');
    restartTurn(s, 0);
    const b = mapDef('3').left[3]!.b;
    expect(b).toMatchObject({ k: 'fx', fx: 'm3:determination' });
    core.gainBonus(c0(s), b);
    flow.settle(s, rng);
    const h = s.queue[0]!;
    expect(h.k).toBe('option');
    expect((h as { optional?: boolean }).optional).toBe(true);
    expect((h as { label: string }).label).toContain('اراده');
    // during an action the extra action waits until the action finished
    const s2 = onMap('3');
    s2.act = { seat: 0, card: 'association', owner: 0, strength: 2, base: 2, up: false, count: 0, kinds: [], tasks: [], donated: false, levels: 0, extraUsed: false, small: true, mult: 0, after: [] };
    core.gainBonus(c0(s2), b);
    core.flush(s2);
    expect(s2.act.after.map((x) => x.fx)).toEqual(['m3:extra']);
    expect(s2.queue).toEqual([]);
  });

  it('map 4 Commercial Harbor: offered once per turn only when the adjacent space is built; discards 1 card for 3 money', () => {
    const s = onMap('4');
    const pl = s.players[0]!;
    restartTurn(s, 0);
    const opts = () => (s.queue[0] as { options: { value: string }[] }).options.map((o) => o.value);
    expect(opts()).not.toContain('ability');
    put(s, 'e1', ['0_11']);
    restartTurn(s, 0);
    expect(opts()).toContain('ability');
    const card = pl.hand[0]!;
    const money = pl.money;
    const hand = pl.hand.length;
    flow.answer(s, rng, { value: 'ability' });
    expect(s.queue[0]).toMatchObject({ k: 'pick', min: 1, max: 1, fx: 'm4:sell' });
    flow.answer(s, rng, { ids: [card] });
    expect(pl.money).toBe(money + 3);
    expect(pl.hand).toHaveLength(hand - 1);
    expect(s.discard).toContain(card);
    expect(s.turnUsed).toContain('m4');
    expect(opts()).not.toContain('ability');
    // an empty hand: not offered
    pl.hand = [];
    s.turnUsed = [];
    restartTurn(s, 0);
    expect(opts()).not.toContain('ability');
  });

  it('map 5 Park Restaurant: blocked feature; income 1 per covered adjacent space', () => {
    const s = onMap('5');
    const c = c0(s);
    expect(mapDef('5').blocked).toEqual(['4_5']);
    expect(mapDef('5').rock).not.toContain('4_5');
    put(s, 'e1', ['4_7']);
    expect(core.placeError(c, 'kiosk', ['4_5'], true)).toBe('CELL_BLOCKED');
    put(s, 'e2', ['3_4', '3_6']);
    put(s, 'e1', ['8_1']);
    const money = s.players[0]!.money;
    mapDef('5').income!(c);
    expect(s.players[0]!.money).toBe(money + 3);
  });

  it('map 5: the special-enclosure left bonus builds a free Reptile House or Large Bird Aviary', () => {
    const s = onMap('5');
    const pl = s.players[0]!;
    restartTurn(s, 0);
    core.gainBonus(c0(s), mapDef('5').left[3]!.b);
    flow.settle(s, rng);
    const q = s.queue[0]!;
    expect(q).toMatchObject({ k: 'place', kinds: ['rh', 'ba'], free: true });
    const [opt] = flow.placeOptions(c0(s), q as never);
    const money = pl.money;
    flow.answer(s, rng, { kind: opt!.kind, cells: opt!.cells });
    expect(pl.buildings.map((b) => b.kind)).toEqual([opt!.kind]);
    expect(pl.money).toBe(money);
  });

  it('map 6 Research Institute: once connected, Animal cards may miss 1 condition (not sponsors)', () => {
    const s = onMap('6');
    const c = c0(s);
    const a = Object.values(ANIMAL).find((x) => x.std && x.size <= 2 && !x.rock && !x.water && core.missing(c, x, false) === 1)!;
    const sp = Object.values(SPONSOR)[0]!;
    expect(core.animalError(c, a, false)).toBe('CONDITIONS');
    put(s, 'e1', ['0_11']);
    expect(core.qsum(c, 'ignoreConditions', a)).toBe(1);
    expect(core.qsum(c, 'ignoreConditions', sp)).toBe(0);
    expect(core.animalError(c, a, false)).not.toBe('CONDITIONS');
  });

  it('map 6: the 2x Clever left bonus moves two Action cards to slot 1', () => {
    const s = onMap('6');
    core.gainBonus(c0(s), mapDef('6').left[3]!.b);
    core.flush(s);
    expect(s.queue.map((q) => q.fx)).toEqual(['core:clever', 'core:clever']);
  });

  it('map 7 Ice Cream Parlors: +1 income per kiosk once all 3 kiosk bonus spaces are covered', () => {
    const s = onMap('7');
    const c = c0(s);
    const pl = s.players[0]!;
    put(s, 'kiosk', ['1_2']); put(s, 'kiosk', ['5_4']); put(s, 'kiosk', ['8_7']);
    let money = pl.money;
    mapDef('7').income!(c);
    expect(pl.money).toBe(money);
    put(s, 'e1', ['5_10']);
    money = pl.money;
    mapDef('7').income!(c);
    expect(pl.money).toBe(money + 3);
  });

  it('map 7: the Pouch left bonus tucks up to 2 hand cards under the map for 2 appeal each, hidden from others', () => {
    const s = onMap('7');
    const pl = s.players[0]!;
    pl.hand = [401, 402, 403];
    restartTurn(s, 0);
    core.gainBonus(c0(s), mapDef('7').left[3]!.b);
    core.flush(s);
    expect(s.queue[0]).toMatchObject({ k: 'pick', min: 0, max: 2, optional: true });
    const appeal = pl.appeal;
    flow.answer(s, rng, { ids: [401, 403] });
    expect(pl.appeal).toBe(appeal + 4);
    expect(pl.hand).toEqual([402]);
    expect(pl.under.map).toEqual([401, 403]);
    const snap = { ...startGame(m, { playerCount: 2, seed: 3, options: { map: '7' } }).snapshot, state: s } as EngineSnapshot;
    const seen = JSON.stringify(projectFor(m, snap, p(1)).view);
    expect(seen).not.toContain('[401,403]');
  });

  it('map 8 Hollywood Hills: covering a Hollywood space reveals until a Sponsor; all 3 covered lowers sponsor levels by 1', () => {
    const s = onMap('8');
    const c = c0(s);
    const pl = s.players[0]!;
    const sp = Object.values(SPONSOR).find((x) => x.level >= 2)!;
    const animals = Object.keys(ANIMAL).map(Number).slice(0, 2);
    pl.hand = [];
    s.deck = [sp.id, ...animals];
    s.discard = [];
    const level = core.sponsorLevel(c, sp.id);
    expect(level).toBe(sp.level);
    core.build(c, 'e1', ['1_10'], false);
    core.flush(s);
    expect(pl.hand).toEqual([sp.id]);
    expect(s.discard.sort()).toEqual([...animals].sort());
    expect(s.deck).toEqual([]);
    // no sponsor anywhere: the search stops
    core.build(c, 'e1', ['4_11'], false);
    expect(pl.hand).toEqual([sp.id]);
    expect(core.sponsorLevel(c, sp.id)).toBe(level);
    put(s, 'e1', ['6_9']);
    expect(core.sponsorLevel(c, sp.id)).toBe(level - 1);
    // a non-Hollywood space reveals nothing
    s.deck = [sp.id];
    core.build(c, 'e1', ['3_2'], false);
    expect(s.deck).toEqual([sp.id]);
  });
});

describe('ark nova maps: full games', () => {
  function randomAction(snap: EngineSnapshot, r: { nextInt(n: number): number }): { seat: number; action: unknown } {
    const s = st(snap);
    const seat = s.stage === 'draft' ? s.drafts.findIndex((d) => d) : s.queue[0]!.seat;
    const hs = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
    const real = hs.filter((h) => !(typeof h.value === 'string' && h.value.startsWith('x:')) && !h.skip);
    const pool = real.length && r.nextInt(5) ? real : hs;
    const h = pool[r.nextInt(pool.length)]!;
    if (h.type === 'draft') {
      const maps = h.maps as string[];
      return { seat, action: { type: 'draft', keep: (h.cards as number[]).slice(0, 4), ...(maps.length ? { map: maps[r.nextInt(maps.length)] } : {}) } };
    }
    if (h.pick) {
      const ids = [...(h.pick as number[])];
      const n = (h.min as number) + r.nextInt((h.max as number) - (h.min as number) + 1);
      const out: number[] = [];
      for (let i = 0; i < n; i++) out.push(ids.splice(r.nextInt(ids.length), 1)[0]!);
      return { seat, action: { type: 'answer', ids: out } };
    }
    return { seat, action: h };
  }
  const play = (options: Record<string, unknown>, players: number, seed: number) => {
    const r = createRng({ s: seed });
    const setup = { playerCount: players, seed, options };
    let snap = startGame(m, setup).snapshot;
    const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
    for (let i = 0; i < 20000 && !st(snap).outcome; i++) {
      const { seat, action } = randomAction(snap, r);
      snap = act(snap, seat, action);
      inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
    }
    const s = st(snap);
    expect(s.outcome).not.toBeNull();
    expect(s.outcome!.placements).toHaveLength(players);
    for (const pl of s.players) { expect(pl.money).toBeGreaterThanOrEqual(0); expect(pl.appeal).toBeLessThanOrEqual(113); }
    return { s, snap, setup, inputs };
  };

  it('advanced maps: seeded random games terminate and replay deterministically', () => {
    const used = new Set<string>();
    for (let g = 0; g < 3; g++) {
      const { s, snap, setup, inputs } = play({ map: 'advanced' }, 2 + g, 900 + g);
      for (const pl of s.players) used.add(pl.map);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
    expect([...used].every((x) => ['1', '2', '3', '4', '5', '6', '7', '8'].includes(x))).toBe(true);
  }, 600_000);

  it.each(MAP_IDS)('fixed map %s: a seeded random game terminates', (id) => {
    const { s } = play({ map: id }, 2, 700 + Number(id));
    expect(s.players.every((x) => x.map === id)).toBe(true);
  }, 600_000);
});
