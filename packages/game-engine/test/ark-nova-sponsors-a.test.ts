import { describe, expect, it } from 'vitest';
import { arkNovaModule, core, flow, restartTurn, type AnimalData, type Answer, type State } from '@bg/game-ark-nova';
import { applyAction, startGame, type EngineSnapshot } from '../src/index.ts';

const m = arkNovaModule as never;
const rng = { nextInt: () => 0 };

/** A 2-player game after the draft, with seat 0 reset to an empty zoo (Map A presets kept) and on turn. */
function fresh(): State {
  let snap: EngineSnapshot = startGame(m, { playerCount: 2, seed: 3, options: {} }).snapshot;
  for (let seat = 0; seat < 2; seat++) {
    const d = (snap.state as State).drafts[seat]!;
    const r = applyAction(m, snap, { kind: 'player', seat }, { type: 'draft', keep: d.cards.slice(0, 4) }, 0);
    if ('ok' in r) throw new Error(r.errorCode);
    snap = r.snapshot;
  }
  const s = snap.state as State;
  for (const p of s.players) Object.assign(p, { hand: [], zoo: [], money: 50, appeal: 10, cp: 0, rep: 1, x: 0, partners: [], unis: [] });
  restartTurn(s, 0);
  return s;
}
const P0 = (s: State) => s.players[0]!;
const c0 = (s: State) => core.ctx(s, 0, rng);
function play(s: State, id: number, seat = 0) { core.playSponsor(core.ctx(s, seat, rng), id); flow.settle(s, rng); }
const answer = (s: State, a: Answer) => flow.answer(s, rng, a);
const head = (s: State) => s.queue[0]!;
const card = (id: number) => core.REG.cards.get(id)!;
const endgame = (s: State, id: number) => card(id).endgame!({ ...c0(s), card: id });
const income = (s: State, id: number) => { card(id).income!({ ...c0(s), card: id }); flow.settle(s, rng); };
const animal = (f: (a: AnimalData) => boolean) => Object.values(core.ANIMAL).find(f)!;
// Animals without conditions whose abilities never prompt: Dingo (pack), Llama (flock), Secretary Bird (none).
const smallA = core.ANIMAL[424]!;
const smallB = core.ANIMAL[439]!;
const largeA = core.ANIMAL[495]!;

describe('ark nova sponsors 203-228, 230-232', () => {
  it('203 Veterinarian: 2/5/10 money for universities, project task needs strength 4, 3 universities score 1 CP', () => {
    const s = fresh();
    P0(s).unis = ['science', 'rep'];
    play(s, 203);
    expect(P0(s).money).toBe(55);
    expect(flow.taskValue(c0(s), 'project')).toBe(4);
    endgame(s, 203);
    expect(P0(s).cp).toBe(0);
    P0(s).unis.push('hand');
    endgame(s, 203);
    expect(P0(s).cp).toBe(1);
  });

  it('204 Science Museum: 2 money per research icon, 1 CP per research icon played (itself included)', () => {
    const s = fresh();
    P0(s).zoo = [223];
    play(s, 204);
    expect(P0(s).money).toBe(56);
    expect(P0(s).cp).toBe(1);
    play(s, 223);
    expect(P0(s).cp).toBe(3);
  });

  it('205 Gorilla Field Research: printed 2 reputation and 1 CP only', () => {
    const s = fresh();
    play(s, 205);
    expect([P0(s).rep, P0(s).cp, P0(s).money, P0(s).appeal]).toEqual([3, 1, 50, 10]);
  });

  it('206 Medical Breakthrough: 2 appeal per project supported, 1 CP each income', () => {
    const s = fresh();
    P0(s).supported = 3;
    play(s, 206);
    expect(P0(s).appeal).toBe(16);
    income(s, 206);
    expect(P0(s).cp).toBe(1);
  });

  it('207 Basic Research: 1 CP per 2 different category/continent icons, others 2 money per CP', () => {
    const s = fresh();
    P0(s).partners = ['africa', 'asia', 'europe', 'americas'];
    P0(s).zoo = [smallA.id];
    const n = core.categoriesIn(s, 0) + core.continentsIn(s, 0);
    play(s, 207);
    expect(P0(s).cp).toBe(Math.floor(n / 2));
    expect(P0(s).cp).toBeGreaterThanOrEqual(2);
    expect(s.players[1]!.money).toBe(50 + 2 * P0(s).cp);
  });

  it('208 Science Library: appeal per research icon, 2 money per research icon in any zoo, 5 categories score', () => {
    const s = fresh();
    P0(s).zoo = [223];
    play(s, 208);
    expect(P0(s).appeal).toBe(13);
    expect(P0(s).money).toBe(52);
    play(s, 223, 1);
    expect(P0(s).money).toBe(56);
    endgame(s, 208);
    expect(P0(s).cp).toBe(0);
    const cats = ['bird', 'herbivore', 'predator', 'primate', 'reptile'] as const;
    P0(s).zoo.push(...cats.map((k) => animal((a) => a.icons.includes(k)).id));
    endgame(s, 208);
    expect(P0(s).cp).toBe(1);
  });

  it('209 Technology Institute: 1 X on play and each income, 3 universities score', () => {
    const s = fresh();
    play(s, 209);
    expect(P0(s).x).toBe(1);
    income(s, 209);
    expect(P0(s).x).toBe(2);
    P0(s).unis = ['science', 'rep', 'hand'];
    endgame(s, 209);
    expect(P0(s).cp).toBe(1);
  });

  it('210 Expert on the Americas: appeal per Americas icon, free kiosk per Americas icon, 5 kiosks score', () => {
    const s = fresh();
    // Map A's printed kiosk blocks every kiosk space next to the printed buildings (distance rule): add an enclosure.
    P0(s).buildings.push({ id: 80, kind: 'e2', cells: ['4_3', '4_5'] });
    play(s, 210);
    expect(P0(s).appeal).toBe(11);
    const q = head(s);
    expect(q).toMatchObject({ k: 'place', kinds: ['kiosk'], free: true, optional: true, seat: 0 });
    const o = flow.placeOptions(c0(s), q as never)[0]!;
    answer(s, { kind: o.kind, cells: o.cells });
    expect(P0(s).buildings.filter((b) => b.kind === 'kiosk')).toHaveLength(2);
    const bonus = core.mapOf(P0(s)).bonuses[o.cells[0]!];
    expect(P0(s).money).toBe(50 + (bonus?.k === 'money' ? bonus.n! : 0)); // free: no 2 money paid
    endgame(s, 210);
    expect(P0(s).cp).toBe(0);
    for (let i = 0; i < 3; i++) P0(s).buildings.push({ id: 90 + i, kind: 'kiosk', cells: [] });
    endgame(s, 210);
    expect(P0(s).cp).toBe(1);
  });

  it('211 Expert on Europe: free 1-space enclosure per Europe icon, 5 occupied 1-space enclosures score', () => {
    const s = fresh();
    play(s, 211);
    expect(P0(s).appeal).toBe(11);
    const q = head(s);
    expect(q).toMatchObject({ k: 'place', kinds: ['e1'], free: true, optional: true });
    const o = flow.placeOptions(c0(s), q as never)[0]!;
    answer(s, { kind: o.kind, cells: o.cells });
    expect(P0(s).buildings.filter((b) => b.kind === 'e1')).toHaveLength(1);
    for (let i = 0; i < 4; i++) P0(s).buildings.push({ id: 90 + i, kind: 'e1', cells: [], full: true });
    endgame(s, 211);
    expect(P0(s).cp).toBe(0);
    P0(s).buildings.find((b) => b.kind === 'e1' && !b.full)!.full = true;
    endgame(s, 211);
    expect(P0(s).cp).toBe(1);
  });

  it('212 Expert on Australia: tuck a hand card under it for 2 appeal per Australia icon', () => {
    const s = fresh();
    P0(s).hand = [smallA.id, smallB.id];
    play(s, 212);
    expect(head(s)).toMatchObject({ k: 'pick', fx: 's212:tuck', optional: true, ids: [smallA.id, smallB.id] });
    answer(s, { ids: [smallB.id] });
    expect(P0(s).under[212]).toEqual([smallB.id]);
    expect(P0(s).hand).toEqual([smallA.id]);
    expect(P0(s).appeal).toBe(13);
  });

  it('213 Expert on Asia: a free pavilion per Asia icon (pavilion gives 1 appeal)', () => {
    const s = fresh();
    play(s, 213);
    const q = head(s);
    expect(q).toMatchObject({ k: 'place', kinds: ['pavilion'], free: true });
    const o = flow.placeOptions(c0(s), q as never)[0]!;
    answer(s, { kind: o.kind, cells: o.cells });
    expect(P0(s).appeal).toBe(12);
    expect(P0(s).money).toBe(50);
  });

  it('214 Expert on Africa: after the Sponsors action, move any Action card to slot 1; end: 1 appeal per X-token', () => {
    const s = fresh();
    const p = P0(s);
    p.hand = [214];
    p.slots = ['animals', 'cards', 'build', 'association', 'sponsors'];
    restartTurn(s, 0);
    answer(s, { value: 'a:sponsors:0' });
    answer(s, { value: 'sp:214:0' });
    expect(p.appeal).toBe(11);
    expect(head(s)).toMatchObject({ fx: 'core:clevered' });
    expect(p.slots[0]).toBe('sponsors');
    answer(s, { value: 'association' });
    expect(p.slots[0]).toBe('association');
    p.x = 3;
    endgame(s, 214);
    expect(p.appeal).toBe(14);
  });

  it('215 / 218 Breeding programs: one token per support counts as a wild icon for a BASE project; 5 supports score', () => {
    const s = fresh();
    const p = P0(s);
    p.partners = ['africa', 'asia'];
    play(s, 215);
    expect(p.data[215]).toMatchObject({ wild: 2 });
    // A base project whose lowest level needs 2 icons of a kind we have once.
    s.baseProjects = [103]; s.ptoks = { 103: [null, null, null] };
    p.partners = ['africa', 'asia'];
    const opts = core.projectOptions(c0(s), false);
    const wild = opts.find((o) => o.project === 103 && o.wild === 215)!;
    expect(wild).toBeTruthy();
    expect(opts.some((o) => o.project === 103 && core.PROJECT[103]!.slots[o.slot]!.need! > 2)).toBe(false);
    core.supportProject(c0(s), wild);
    flow.settle(s, rng);
    expect(p.data[215]).toMatchObject({ wild: 1 });
    expect(s.ptoks[103]).toContain(0);
    endgame(s, 215);
    expect(p.cp).toBe(2);
    p.supported = 5;
    endgame(s, 215);
    expect(p.cp).toBe(3);
    p.zoo.push(223);
    play(s, 218);
    expect(p.data[218]).toMatchObject({ wild: 2 });
    endgame(s, 218);
    expect(p.cp).toBe(4);
  });

  it('216 Talented Communicator: hires a worker at once; 9 reputation scores', () => {
    const s = fresh();
    const p = P0(s);
    const [w, h] = [p.workers, p.hired];
    play(s, 216);
    expect([p.workers, p.hired]).toEqual([w + 1, h + 1]);
    p.rep = 9;
    endgame(s, 216);
    expect(p.cp).toBe(1);
  });

  it('217 Engineer: may build one more copy in the Build action; full map scores 5 appeal', () => {
    const s = fresh();
    const p = P0(s);
    expect(flow.buildKinds(c0(s), 5, false, ['e1'], false, false)).not.toContain('e1');
    play(s, 217);
    expect(flow.buildKinds(c0(s), 5, false, ['e1'], false, false)).toContain('e1');
    expect(flow.buildKinds(c0(s), 5, false, ['e1'], false, true)).not.toContain('e1');
    endgame(s, 217);
    expect(p.appeal).toBe(10);
    p.buildings.push({ id: 99, kind: 'e5', cells: core.buildingSpaces(p) });
    endgame(s, 217);
    expect(p.appeal).toBe(15);
  });

  it('219 Diversity Researcher: 2 money per water/rock icon, may cover terrain, 2 appeal per water+rock set (max 3)', () => {
    const s = fresh();
    const p = P0(s);
    const wet = animal((a) => a.water >= 1 && a.rock === 0);
    const dry = animal((a) => a.rock >= 1 && a.water === 0);
    p.zoo = [wet.id, dry.id];
    const terr = wet.water + dry.rock;
    play(s, 219);
    expect(p.money).toBe(50 + 2 * terr);
    expect(core.qany(c0(s), 'coverTerrain')).toBe(true);
    const sets = Math.min(3, core.count(s, 0, 'water'), core.count(s, 0, 'rock'));
    expect(sets).toBeGreaterThanOrEqual(1);
    endgame(s, 219);
    expect(p.appeal).toBe(10 + 2 * sets);
  });

  it('220 Federal Grants: 3 money on play and each income; 9 reputation scores', () => {
    const s = fresh();
    play(s, 220);
    expect(P0(s).money).toBe(53);
    income(s, 220);
    expect(P0(s).money).toBe(56);
    endgame(s, 220);
    expect(P0(s).cp).toBe(0);
  });

  it('221 Archaeologist: a border placement bonus grants another uncovered bonus; all border spaces covered score', () => {
    const s = fresh();
    const p = P0(s);
    p.zoo = [221];
    core.build(c0(s), 'e1', ['0_1'], true); // border space with 2 reputation
    flow.settle(s, rng);
    expect(p.rep).toBe(3);
    const q = head(s);
    expect(q).toMatchObject({ k: 'option', fx: 's221:gain' });
    if (q.k !== 'option') throw new Error('option');
    expect(q.options.map((o) => o.value)).not.toContain('0_1');
    answer(s, { value: '8_5' });
    expect(p.money).toBe(60);
    expect(p.taken).not.toContain('8_5');
    core.build(c0(s), 'e1', ['3_2'], true); // interior space: no extra bonus
    flow.settle(s, rng);
    expect(head(s).fx).not.toBe('s221:gain');
    endgame(s, 221);
    expect(p.cp).toBe(0);
    p.buildings.push({ id: 99, kind: 'e5', cells: core.buildingSpaces(p) });
    endgame(s, 221);
    expect(p.cp).toBe(1);
  });

  it('222 Release of Patents: 1 CP per research icon (max 3), others 2 money per CP', () => {
    const s = fresh();
    P0(s).zoo = [223, 204];
    play(s, 222);
    expect(P0(s).cp).toBe(3);
    expect(s.players[1]!.money).toBe(56);
  });

  it('223 Science Institute: only its 2 research icons', () => {
    const s = fresh();
    play(s, 223);
    expect(core.count(s, 0, 'science')).toBe(2);
    expect([P0(s).money, P0(s).appeal, P0(s).cp]).toEqual([50, 10, 0]);
  });

  it('224 Migration Recording: 1 X, repeat release projects, +1 CP per release project support', () => {
    const s = fresh();
    play(s, 224);
    expect(P0(s).x).toBe(1);
    expect(core.qany(c0(s), 'repeatRelease')).toBe(true);
    core.emit(s, rng, { t: 'project', seat: 0, project: 113, slot: 0 });
    expect(P0(s).cp).toBe(1);
    core.emit(s, rng, { t: 'project', seat: 0, project: 103, slot: 0 });
    core.emit(s, rng, { t: 'project', seat: 1, project: 113, slot: 1 });
    expect(P0(s).cp).toBe(1);
  });

  it('225 Quarantine Lab / 226 Foreign Institute: X-token, immunity, 2 reputation; all 5 continents score', () => {
    const s = fresh();
    const p = P0(s);
    play(s, 225);
    expect(p.x).toBe(1);
    expect(core.qany(c0(s), 'immune')).toBe(true);
    play(s, 226);
    expect(p.rep).toBe(3);
    endgame(s, 225); endgame(s, 226);
    expect(p.cp).toBe(0);
    p.partners = ['africa', 'americas', 'asia', 'australia', 'europe'];
    endgame(s, 225); endgame(s, 226);
    expect(p.cp).toBe(2);
  });

  it('227 WAZA Special Assignment: reveal until a chosen-type animal, forbid the other type, +2 appeal per small animal', () => {
    const s = fresh();
    const p = P0(s);
    s.deck = [smallB.id, largeA.id, 223];
    s.discard = [];
    play(s, 227);
    answer(s, { value: 'small' });
    expect(p.hand).toEqual([smallB.id]);
    expect(s.discard).toEqual([223, largeA.id]);
    expect(core.animalError(c0(s), largeA, true)).toBe('ANIMAL_FORBIDDEN');
    expect(core.animalError(c0(s), smallB, true)).not.toBe('ANIMAL_FORBIDDEN');
    p.buildings.push({ id: 80, kind: 'e2', cells: ['4_3', '4_5'] });
    const o = core.animalOptions(c0(s), true, false).find((x) => x.card === smallB.id)!;
    const before = p.appeal;
    core.playAnimal(c0(s), o);
    expect(p.appeal).toBe(before + smallB.appeal + 2);
  });

  it('227 WAZA Special Assignment (large): +4 appeal per large animal, small animals forbidden', () => {
    const s = fresh();
    const p = P0(s);
    s.deck = [largeA.id, smallA.id];
    play(s, 227);
    answer(s, { value: 'large' });
    expect(p.hand).toEqual([largeA.id]);
    expect(core.animalError(c0(s), smallA, true)).toBe('ANIMAL_FORBIDDEN');
    p.buildings.push({ id: 80, kind: 'e5', cells: ['4_3', '4_5', '5_4', '5_6', '4_7'] });
    p.money = 100;
    const o = core.animalOptions(c0(s), true, false).find((x) => x.card === largeA.id)!;
    const before = p.appeal;
    core.playAnimal(c0(s), o);
    expect(p.appeal).toBe(before + largeA.appeal + 4);
  });

  it('228 WAZA Small Animal Program: money per small animal; after an all-small Animals action play 1 more and take 1 from the display', () => {
    const s = fresh();
    const p = P0(s);
    p.zoo = [smallA.id];
    play(s, 228);
    expect(p.money).toBe(52);
    const third = core.ANIMAL[405]!;
    p.money = 100;
    p.hand = [smallA.id, smallB.id];
    p.zoo = [228];
    p.slots = ['cards', 'animals', 'build', 'association', 'sponsors'];
    p.buildings.push({ id: 80, kind: 'e2', cells: ['4_3', '4_5'] });
    s.display[3] = third.id;
    restartTurn(s, 0);
    answer(s, { value: 'a:animals:0' });
    const first = head(s);
    if (first.k !== 'option') throw new Error('option');
    answer(s, { value: first.options.find((o) => o.value.startsWith(`${smallA.id}@`))!.value });
    // Strength 2 allows a single animal: the WAZA bonus play follows after the action.
    const extra = head(s);
    expect(extra).toMatchObject({ fx: 's228:play', optional: true });
    if (extra.k !== 'option') throw new Error('option');
    answer(s, { value: extra.options.find((o) => o.value.startsWith(`${smallB.id}@`))!.value });
    expect(p.zoo).toContain(smallB.id);
    const take = head(s);
    expect(take).toMatchObject({ fx: 's228:taken' });
    if (take.k !== 'option') throw new Error('option');
    expect(take.options.map((o) => o.value)).toContain('4');
    answer(s, { value: '4' });
    expect(p.hand).toContain(third.id);
  });

  it('228 WAZA Small Animal Program: a large animal in the action gives no bonus', () => {
    const s = fresh();
    const p = P0(s);
    p.money = 100; p.zoo = [228]; p.hand = [largeA.id, smallA.id];
    p.slots = ['cards', 'animals', 'build', 'association', 'sponsors'];
    p.buildings.push({ id: 80, kind: 'e5', cells: ['4_3', '4_5', '5_4', '5_6', '4_7'] });
    restartTurn(s, 0);
    answer(s, { value: 'a:animals:0' });
    const first = head(s);
    if (first.k !== 'option') throw new Error('option');
    answer(s, { value: first.options.find((o) => o.value.startsWith(`${largeA.id}@`))!.value });
    expect(s.queue.some((q) => q.fx === 's228:play' || q.fx === 's228:taken')).toBe(false);
  });

  it('230 Expert in Large Animals: 2 appeal per large animal, large animals 4 money cheaper', () => {
    const s = fresh();
    P0(s).zoo = [largeA.id];
    const cost = core.animalCost(c0(s), largeA);
    play(s, 230);
    expect(P0(s).appeal).toBe(12);
    expect(core.animalCost(c0(s), largeA)).toBe(Math.max(0, cost - 4));
    expect(core.animalCost(c0(s), smallA)).toBe(smallA.cost);
  });

  it.each([[231, 'primate'], [232, 'reptile']] as const)('%i Sponsorship: appeal per icon; income 3/6/9 money for 1-2/3-4/5+ icons', (id, icon) => {
    const s = fresh();
    const p = P0(s);
    const a = animal((x) => x.icons.filter((i) => i === icon).length === 1);
    p.zoo = [a.id];
    play(s, id);
    expect(p.appeal).toBe(11);
    const incomeFor = (n: number) => { p.zoo = [id, ...Array<number>(n).fill(a.id)]; const m0 = p.money; income(s, id); return p.money - m0; };
    expect([0, 1, 2, 3, 4, 5, 7].map(incomeFor)).toEqual([0, 3, 3, 6, 6, 9, 9]);
  });

  it('every sponsor of the chunk is registered with Persian name and text', () => {
    for (const id of [...Array.from({ length: 26 }, (_, i) => 203 + i), 230, 231, 232]) {
      expect(card(id).nameFa, String(id)).toBeTruthy();
      expect(card(id).textFa, String(id)).toBeTruthy();
    }
  });
});
