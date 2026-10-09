import { describe, expect, it } from 'vitest';
import { ANIMAL, arkNovaModule, core, flow, restartTurn, type State } from '@bg/game-ark-nova';
import { applyAction, startGame, type EngineSnapshot } from '../src/index.ts';

const m = arkNovaModule as never;
const rng0 = { nextInt: () => 0 };
type Ans = { ids?: number[]; value?: string; skip?: boolean; kind?: string; cells?: string[] };

/** A drafted game with a clean, quiet position: no pending prompts, empty zoos and hands, milestones taken. */
function fresh(n = 2, seed = 3): State {
  let snap: EngineSnapshot = startGame(m, { playerCount: n, seed, options: {} }).snapshot;
  for (let seat = 0; seat < n; seat++) {
    const d = (snap.state as State).drafts[seat]!;
    const r = applyAction(m, snap, { kind: 'player', seat }, { type: 'draft', keep: d.cards.slice(0, 4), ...(d.maps.length ? { map: d.maps[0] } : {}) }, 0);
    if ('ok' in r) throw new Error(r.errorCode);
    snap = r.snapshot;
  }
  const s = snap.state as State;
  core.resetBuffer();
  s.queue = []; s.act = null; s.inTurn = false;
  for (const p of s.players) {
    Object.assign(p, { appeal: 0, cp: 0, money: 25, x: 0, rep: 1, hand: [], zoo: [], partners: [], unis: [], hired: 0, workers: 1 });
    p.slots = ['animals', 'build', 'cards', 'association', 'sponsors'];
    p.marks = ['c2', 'c5', 'c8', ...Array.from({ length: 15 }, (_, i) => `r${i + 1}`)];
  }
  return s;
}
/** Play an animal for free outside any action (its "after finishing" effects then run right away). */
function play(s: State, seat: number, id: number) {
  core.playAnimal(core.ctx(s, seat, rng0), { card: id, home: null, cost: 0, folder: 0 });
  flow.settle(s, rng0);
}
const head = (s: State) => s.queue[0];
const answer = (s: State, a: Ans) => flow.answer(s, rng0, a);
const view = (s: State, seat: number | null) => arkNovaModule.project(s, seat === null ? { kind: 'spectator' } : { kind: 'player', seat });
const appealOf = (id: number) => ANIMAL[id]!.appeal;

describe('ark nova abilities: cards', () => {
  it('Hunter 4 (Leopard): reveals 4, keeps 1 animal, discards the rest; the revealed ids stay hidden from others', () => {
    const s = fresh();
    s.deck = [405, 201, 404, 202]; s.discard = [];
    play(s, 0, 403);
    const h = head(s)!;
    expect(h).toMatchObject({ k: 'pick', seat: 0, min: 1, max: 1 });
    expect((h as { ids: number[] }).ids.sort()).toEqual([404, 405]);
    expect(s.deck).toEqual([]);
    expect((view(s, 1) as { prompt: Record<string, unknown> }).prompt.ids).toBeUndefined();
    expect((view(s, null) as { prompt: Record<string, unknown> }).prompt.ids).toBeUndefined();
    answer(s, { ids: [405] });
    expect(s.players[0]!.hand).toEqual([405]);
    expect(s.discard.sort()).toEqual([201, 202, 404]);
  });
  it('Hunter 2 (Caracal): no animal among the revealed cards -> all are discarded', () => {
    const s = fresh();
    s.deck = [201, 202]; s.discard = [];
    play(s, 0, 404);
    expect(s.queue).toHaveLength(0);
    expect(s.players[0]!.hand).toEqual([]);
    expect(s.discard.sort()).toEqual([201, 202]);
  });
  it('Hunter is reusable by a sponsor through the registry', () => {
    const s = fresh();
    s.deck = [404]; s.discard = [];
    core.REG.abilities.hunter!.now!(core.ctx(s, 0, rng0, 252), 1);
    flow.settle(s, rng0);
    answer(s, { ids: [404] });
    expect(s.players[0]!.hand).toEqual([404]);
  });

  it('Sunbathing 3: sells up to 3 hand cards for 4 money each', () => {
    const s = fresh();
    s.players[0]!.hand = [201, 202, 203, 204];
    s.discard = [];
    play(s, 0, 422);
    const h = head(s)!;
    expect(h).toMatchObject({ k: 'pick', min: 0, max: 3, optional: true });
    expect(flow.answerError(core.ctx(s, 0, rng0), h as never, { ids: [201, 202, 203, 204] })).toBe('BAD_COUNT');
    answer(s, { ids: [201, 202, 203] });
    expect(s.players[0]!.money).toBe(25 + 12);
    expect(s.players[0]!.hand).toEqual([204]);
    expect(s.discard).toEqual([201, 202, 203]);
  });

  it('Pouch 1: tucks a hand card under the animal for 2 appeal; others only see the count', () => {
    const s = fresh();
    s.players[0]!.hand = [201, 202];
    play(s, 0, 425);
    answer(s, { ids: [202] });
    const p = s.players[0]!;
    expect(p.under[425]).toEqual([202]);
    expect(p.hand).toEqual([201]);
    expect(p.appeal).toBe(2 + appealOf(425));
    const ov = view(s, 1) as { players: { underCount: Record<string, number> }[]; me: { under: Record<string, number[]> } };
    expect(ov.players[0]!.underCount).toEqual({ 425: 1 });
    expect(JSON.stringify(ov.me.under)).not.toContain('202');
    expect(JSON.stringify(view(s, null))).not.toContain('"under":');
    const own = view(s, 0) as { me: { under: Record<string, number[]> } };
    expect(own.me.under[425]).toEqual([202]);
    // Releasing the animal discards the tucked cards.
    core.releaseAnimal(core.ctx(s, 0, rng0), 425);
    expect(s.discard).toEqual(expect.arrayContaining([425, 202]));
    expect(p.under[425]).toBeUndefined();
  });

  it('Resistance: draw 2 Final Scoring cards, keep 1, return the other', () => {
    const s = fresh();
    const [a, b] = s.finalsDeck.slice(0, 2) as [number, number];
    const deckLen = s.finalsDeck.length;
    play(s, 0, 426);
    expect(head(s)).toMatchObject({ k: 'pick', min: 1, max: 1 });
    answer(s, { ids: [b] });
    expect(s.players[0]!.finals).toHaveLength(3);
    expect(s.players[0]!.finals).toContain(b);
    expect(s.finalsDeck).toHaveLength(deckLen - 1);
    expect(s.finalsDeck).toContain(a);
  });

  it('Assertion: take any unused base project from the face-down pile into the hand', () => {
    const s = fresh();
    const want = s.baseDeck[s.baseDeck.length - 1]!;
    play(s, 0, 427);
    expect((head(s) as { ids: number[] }).ids.sort()).toEqual([...s.baseDeck].sort());
    answer(s, { ids: [want] });
    expect(s.players[0]!.hand).toEqual([want]);
    expect(s.baseDeck).not.toContain(want);
  });

  it('Dominance: takes the Primates base project (108) unless it is already in play', () => {
    const s = fresh();
    if (!s.baseDeck.includes(108)) { s.baseProjects = s.baseProjects.filter((x) => x !== 108); s.baseDeck.push(108); }
    play(s, 0, 451);
    answer(s, { value: 'take' });
    expect(s.players[0]!.hand).toEqual([108]);
    expect(s.baseDeck).not.toContain(108);
    const t = fresh();
    t.baseDeck = t.baseDeck.filter((x) => x !== 108);
    play(t, 0, 451);
    expect(t.queue).toHaveLength(0);
    expect(t.players[0]!.hand).toEqual([]);
  });

  it('Digging 3: discard from the display (slides down, new card in folder 6) or cycle a hand card, up to 3 times', () => {
    const s = fresh();
    s.display = [11, 12, 13, 14, 15, 16].map((x) => 200 + x);
    s.deck = [301, 302, 303]; s.discard = [];
    s.players[0]!.hand = [201];
    play(s, 0, 435);
    answer(s, { value: 'f2' });
    expect(s.display).toEqual([211, 213, 214, 215, 216, 303]);
    expect(s.discard).toEqual([212]);
    answer(s, { value: 'hand' });
    answer(s, { ids: [201] });
    expect(s.players[0]!.hand).toEqual([302]);
    expect(s.discard).toEqual([212, 201]);
    expect(head(s)).toMatchObject({ k: 'option', fx: 'a:dug', optional: true });
    answer(s, { skip: true });
    expect(s.queue).toHaveLength(0);
  });

  it('Sponsor Magnet: takes every Sponsor card from the display regardless of reputation', () => {
    const s = fresh();
    s.players[0]!.rep = 0;
    s.display = [401, 225, 402, 201, 101, 210];
    play(s, 0, 437);
    expect(s.players[0]!.hand.sort()).toEqual([201, 210, 225]);
    expect(s.display).toEqual([401, null, 402, null, 101, null]);
  });

  it('Snapping 2: takes 2 display cards, with an optional refill in between', () => {
    const s = fresh();
    s.display = [401, 402, 403, 404, 405, 406];
    s.deck = [407];
    play(s, 0, 469);
    expect(head(s)).toMatchObject({ k: 'option', fx: 'core:snapped' });
    answer(s, { value: '6' });
    expect(head(s)).toMatchObject({ k: 'option', fx: 'a:snapRefill', optional: true });
    answer(s, { value: 'refill' });
    expect(s.display).toEqual([401, 402, 403, 404, 405, 407]);
    answer(s, { value: '1' });
    expect(s.players[0]!.hand).toEqual([406, 401]);
    expect(s.queue).toHaveLength(0);
  });

  it('Scavenging 2: shuffles the discard pile, draws 2, keeps 1 and discards the other', () => {
    const s = fresh();
    s.discard = [201, 202, 203];
    play(s, 0, 490);
    const ids = (head(s) as { ids: number[] }).ids;
    expect(ids).toHaveLength(2);
    answer(s, { ids: [ids[0]!] });
    expect(s.players[0]!.hand).toEqual([ids[0]]);
    expect(s.discard).toHaveLength(2);
    expect([...s.discard, ids[0]].sort()).toEqual([201, 202, 203]);
  });

  it('Perception 4: draws 4 from the deck, keeps half (2), discards the rest', () => {
    const s = fresh();
    s.deck = [201, 202, 203, 204, 205]; s.discard = [];
    play(s, 0, 503);
    expect(head(s)).toMatchObject({ k: 'pick', min: 2, max: 2 });
    answer(s, { ids: [205, 203] });
    expect(s.players[0]!.hand).toEqual([205, 203]);
    expect(s.discard.sort()).toEqual([202, 204]);
    expect(s.deck).toEqual([201]);
  });
});

describe('ark nova abilities: action cards and tokens', () => {
  it('Boost (Sloth Bear): after finishing, the Association card goes to slot 5 or slot 1', () => {
    const s = fresh();
    play(s, 0, 408);
    expect(head(s)).toMatchObject({ k: 'option', optional: true });
    answer(s, { value: '5' });
    expect(s.players[0]!.slots).toEqual(['animals', 'build', 'cards', 'sponsors', 'association']);
    const t = fresh();
    play(t, 0, 408);
    answer(t, { value: '1' });
    expect(t.players[0]!.slots).toEqual(['association', 'animals', 'build', 'cards', 'sponsors']);
  });

  it('Boost runs only after the Animals action finished (card already in slot 1)', () => {
    const s = fresh();
    const p = s.players[0]!;
    p.slots = ['build', 'cards', 'association', 'sponsors', 'animals'];
    p.hand = [408];
    p.buildings.push({ id: 90, kind: 'e4', cells: ['1_6', '2_7', '1_8', '2_5'] });
    restartTurn(s, 0);
    const o = (head(s) as { options: { value: string }[] }).options.find((x) => x.value.startsWith('a:animals:0'))!;
    answer(s, { value: o.value });
    const play408 = (head(s) as { options: { value: string }[] }).options.find((x) => x.value.startsWith('408@'))!;
    answer(s, { value: play408.value });
    // Animals strength 5 allows a second animal: decline it.
    if (head(s)?.fx === 'core:animal') answer(s, { skip: true });
    expect(head(s)).toMatchObject({ fx: 'a:boost' });
    expect(p.slots[0]).toBe('animals');
    answer(s, { value: '5' });
    expect(p.slots).toEqual(['animals', 'build', 'cards', 'sponsors', 'association']);
  });

  it('Action (Sun Bear): an extra Association action with the strength of its slot, then it moves to slot 1', () => {
    const s = fresh();
    const p = s.players[0]!;
    play(s, 0, 409);
    const opts = (head(s) as { options: { value: string }[] }).options.map((x) => x.value);
    // Only the Association card (the engine also lists its X-token alternative for that card).
    expect(opts.every((v) => v.startsWith('a:association:'))).toBe(true);
    expect(opts).toContain('a:association:0');
    expect(head(s)).toMatchObject({ optional: true });
    answer(s, { value: 'a:association:0' });
    answer(s, { value: 'rep' });
    expect(p.rep).toBe(3);
    expect(p.slots[0]).toBe('association');
  });

  it('Inventive: 1 X-token (Coati); Bear counts bear icons in all zoos up to 3 (Grizzly, also Full-throated); Primates ladder 1/3/5', () => {
    const s = fresh();
    play(s, 0, 414);
    expect(s.players[0]!.x).toBe(1);

    const t = fresh();
    t.players[1]!.zoo = [414];
    play(t, 0, 411);
    expect(t.players[0]!.x).toBe(2);
    expect(t.players[0]!.hired).toBe(1);
    expect(t.players[0]!.workers).toBe(2);
    const u = fresh();
    u.players[1]!.zoo = [414, 408, 409];
    play(u, 0, 411);
    expect(u.players[0]!.x).toBe(3);

    const v = fresh();
    play(v, 0, 459);
    expect(v.players[0]!.x).toBe(1);
    const w = fresh();
    w.players[0]!.zoo = [456, 458];
    play(w, 0, 459);
    expect(core.count(w, 0, 'primate')).toBe(3);
    expect(w.players[0]!.x).toBe(2);
    const y = fresh();
    y.players[0]!.zoo = [456, 458, 451, 464];
    play(y, 0, 459);
    expect(y.players[0]!.x).toBe(3);
  });

  it('Full-throated has no effect once all workers are hired; Multiplier puts a token on the named card', () => {
    const s = fresh();
    s.players[0]!.hired = 3; s.players[0]!.workers = 4;
    play(s, 0, 416);
    expect(s.players[0]!.hired).toBe(3);
    expect(s.players[0]!.workers).toBe(4);
    expect(s.players[0]!.tok.association.mult).toBe(1);
  });

  it('Iconic Animal (Eurasian Lynx): 1 appeal per Europe icon in all zoos, at most 8', () => {
    const s = fresh();
    s.players[1]!.zoo = [416];
    s.players[1]!.partners = ['europe'];
    play(s, 0, 418);
    expect(s.players[0]!.appeal).toBe(3 + appealOf(418));
    const t = fresh();
    t.players[1]!.zoo = Array(12).fill(416);
    play(t, 0, 418);
    expect(t.players[0]!.appeal).toBe(8 + appealOf(418));
  });

  it('Venom 2 (Mamba): players with more appeal (at least 5) get tokens on slots 1-2; 225 is immune; duplicates are ignored', () => {
    const s = fresh(4);
    const [me, hi, low, imm] = [0, 1, 2, 3];
    s.players[me]!.appeal = 6;
    s.players[hi]!.appeal = 10;
    s.players[hi]!.tok.animals.venom = 1;
    s.players[low]!.appeal = 4;
    s.players[imm]!.appeal = 20; s.players[imm]!.zoo = [225];
    play(s, me, 470);
    const ven = (k: number) => s.players[k]!.slots.map((c) => s.players[k]!.tok[c].venom);
    expect(ven(hi)).toEqual([1, 1, 0, 0, 0]);
    expect(ven(low)).toEqual([0, 0, 0, 0, 0]);
    expect(ven(imm)).toEqual([0, 0, 0, 0, 0]);
    expect(ven(me)).toEqual([0, 0, 0, 0, 0]);
  });

  it('Venom: the new animal\'s own appeal does not count (Platypus 1)', () => {
    const s = fresh();
    s.players[0]!.appeal = 4; s.players[1]!.appeal = 5;
    play(s, 0, 449);
    expect(s.players[0]!.appeal).toBeGreaterThan(5);
    expect(s.players[1]!.tok[s.players[1]!.slots[0]!].venom).toBe(1);
  });

  it('Venom penalty: 2 money at the end of a turn that did not use a poisoned card; using one removes the token', () => {
    const s = fresh();
    s.players[0]!.appeal = 0; s.players[1]!.appeal = 10;
    play(s, 0, 470);
    const v = s.players[1]!;
    restartTurn(s, 1);
    answer(s, { value: 'x:sponsors' });
    expect(v.money).toBe(23);
    expect(v.tok.animals.venom).toBe(1);
    v.money = 25;
    restartTurn(s, 1);
    answer(s, { value: 'x:animals' });
    expect(v.tok.animals.venom).toBe(0);
    expect(v.money).toBe(25);
  });

  it('Constriction: one token per track a player is ahead of you, on slot 5 then 4; 225 immune; -2 strength', () => {
    const s = fresh(4);
    s.players[0]!.appeal = 6; s.players[0]!.cp = 1;
    s.players[1]!.appeal = 10; s.players[1]!.cp = 3; // ahead on both
    s.players[2]!.appeal = 5; s.players[2]!.cp = 2; // ahead on conservation only
    s.players[3]!.appeal = 30; s.players[3]!.cp = 9; s.players[3]!.zoo = [225];
    play(s, 0, 474);
    const con = (k: number) => s.players[k]!.slots.map((c) => s.players[k]!.tok[c].con);
    expect(con(1)).toEqual([0, 0, 0, 1, 1]);
    expect(con(2)).toEqual([0, 0, 0, 0, 1]);
    expect(con(3)).toEqual([0, 0, 0, 0, 0]);
    expect(core.strengthOf(s.players[1]!, 'sponsors')).toBe(3);
    expect(core.strengthOf(s.players[1]!, 'association')).toBe(2);
  });

  it('Constriction: players below 5 appeal are never affected', () => {
    const s = fresh();
    s.players[0]!.appeal = 0; s.players[1]!.appeal = 4; s.players[1]!.cp = 5;
    play(s, 0, 474);
    expect(s.players[1]!.tok.sponsors.con).toBe(0);
  });
});

describe('ark nova abilities: pilfering and hypnosis', () => {
  it('Pilfering 1: among tied leaders you choose; the victim gives 5 money', () => {
    const s = fresh(3);
    s.players[1]!.appeal = 10; s.players[2]!.appeal = 10;
    s.players[2]!.hand = [201];
    play(s, 0, 456);
    expect(head(s)).toMatchObject({ k: 'option', seat: 0, fx: 'a:victim:chosen' });
    answer(s, { value: '2' });
    expect(head(s)).toMatchObject({ k: 'option', seat: 2, fx: 'a:pilfered' });
    answer(s, { value: 'money' });
    expect(s.players[0]!.money).toBe(30);
    expect(s.players[2]!.money).toBe(20);
  });

  it('Pilfering: the victim may let you draw a random hand card instead', () => {
    const s = fresh();
    s.players[1]!.appeal = 9; s.players[1]!.hand = [210, 211];
    play(s, 0, 456);
    answer(s, { value: 'card' });
    expect(s.players[0]!.hand).toEqual([210]);
    expect(s.players[1]!.hand).toEqual([211]);
    expect(s.players[0]!.money).toBe(25);
  });

  it('Pilfering fallbacks: no hand -> 5 money; under 5 money -> card; neither -> all their money; leader alone = no effect', () => {
    const a = fresh();
    a.players[1]!.appeal = 9;
    play(a, 0, 456);
    expect(a.queue).toHaveLength(0);
    expect(a.players[0]!.money).toBe(30);
    const b = fresh();
    b.players[1]!.appeal = 9; b.players[1]!.money = 4; b.players[1]!.hand = [220];
    play(b, 0, 456);
    expect(b.players[0]!.hand).toEqual([220]);
    expect(b.players[1]!.money).toBe(4);
    const c = fresh();
    c.players[1]!.appeal = 9; c.players[1]!.money = 3;
    play(c, 0, 456);
    expect(c.players[0]!.money).toBe(28);
    expect(c.players[1]!.money).toBe(0);
    const d = fresh();
    d.players[0]!.appeal = 12; d.players[1]!.appeal = 9;
    play(d, 0, 456);
    expect(d.players[0]!.money).toBe(25);
    expect(d.players[1]!.money).toBe(25);
  });

  it('Pilfering 2: the appeal leader and the conservation leader (1+), one after the other; 225 passes it on', () => {
    const s = fresh(4);
    s.players[1]!.appeal = 20; s.players[1]!.zoo = [225]; s.players[1]!.cp = 9; // immune: ignored
    s.players[2]!.appeal = 12; s.players[2]!.cp = 1;
    s.players[3]!.appeal = 6; s.players[3]!.cp = 4;
    play(s, 0, 458);
    expect(s.players[0]!.money).toBe(35);
    expect(s.players[1]!.money).toBe(25);
    expect(s.players[2]!.money).toBe(20);
    expect(s.players[3]!.money).toBe(20);
  });

  it('Pilfering 2 on the same player twice resolves one after the other', () => {
    const s = fresh();
    s.players[1]!.appeal = 12; s.players[1]!.cp = 2; s.players[1]!.hand = [230];
    play(s, 0, 458);
    answer(s, { value: 'card' });
    // Second pilfering: hand is now empty -> forced 5 money.
    expect(s.players[0]!.hand).toEqual([230]);
    expect(s.players[0]!.money).toBe(30);
    expect(s.players[1]!.money).toBe(20);
  });

  it('Hypnosis 3: an action with the target\'s card in slots 1-3, on the target\'s side; their card moves to their slot 1', () => {
    const s = fresh();
    const me = s.players[0]!;
    const o = s.players[1]!;
    o.appeal = 10;
    o.slots = ['animals', 'sponsors', 'build', 'cards', 'association'];
    o.up.sponsors = true;
    play(s, 0, 475);
    const opts = (head(s) as { options: { value: string }[] }).options.map((x) => x.value);
    expect(opts.some((v) => v.startsWith('a:cards'))).toBe(false);
    expect(opts.some((v) => v.startsWith('x:'))).toBe(false);
    answer(s, { value: 'a:sponsors:0' });
    answer(s, { value: 'break' });
    expect(me.money).toBe(25 + 4); // upgraded side: 2 x strength 2
    expect(s.brk).toBe(2);
    expect(o.slots).toEqual(['sponsors', 'animals', 'build', 'cards', 'association']);
    expect(me.slots).toEqual(['animals', 'build', 'cards', 'association', 'sponsors']);
  });

  it('Hypnosis: no effect if you lead alone, below 5 appeal, or the leader is immune (passes to the next)', () => {
    const s = fresh();
    s.players[0]!.appeal = 12; s.players[1]!.appeal = 10;
    play(s, 0, 485);
    expect(s.queue).toHaveLength(0);
    const t = fresh(3);
    t.players[1]!.appeal = 30; t.players[1]!.zoo = [225];
    t.players[2]!.appeal = 7;
    t.players[2]!.slots = ['cards', 'animals', 'build', 'association', 'sponsors'];
    play(t, 0, 475);
    expect(head(t)).toMatchObject({ seat: 0, fx: 'core:turn', optional: true });
    const opts = (head(t) as { options: { value: string }[] }).options.map((x) => x.value);
    expect(opts.length).toBeGreaterThan(0);
    for (const v of opts) expect(['a:cards', 'a:animals', 'a:build'].some((k) => v.startsWith(k))).toBe(true);
    answer(t, { skip: true });
    expect(t.queue).toHaveLength(0);
  });
});

describe('ark nova abilities: buildings', () => {
  it('Posturing 2: up to 2 free kiosks/pavilions, one after the other', () => {
    const s = fresh();
    play(s, 0, 501);
    const c = core.ctx(s, 0, rng0);
    const q = head(s) as Parameters<typeof flow.placeOptions>[1];
    expect(q).toMatchObject({ k: 'place', free: true, optional: true, kinds: ['kiosk', 'pavilion'] });
    const bonus = core.mapOf(s.players[0]!).bonuses;
    const pav = flow.placeOptions(c, q).find((x) => x.kind === 'pavilion' && x.cells.every((y) => !bonus[y]))!;
    const appeal = s.players[0]!.appeal;
    answer(s, { kind: pav.kind, cells: pav.cells });
    expect(s.players[0]!.money).toBe(25);
    expect(s.players[0]!.appeal).toBe(appeal + 1);
    expect(head(s)).toMatchObject({ k: 'place', fx: 'a:posturing' });
    answer(s, { skip: true });
    expect(s.players[0]!.buildings.filter((b) => b.kind === 'pavilion')).toHaveLength(1);
    expect(s.queue).toHaveLength(0);
  });

  it('Peacocking (Emu): a free Large Bird Aviary without Build II; impossible when you already have one', () => {
    const s = fresh();
    expect(s.players[0]!.up.build).toBe(false);
    play(s, 0, 514);
    const q = head(s) as Parameters<typeof flow.placeOptions>[1];
    expect(q).toMatchObject({ k: 'place', kinds: ['ba'], free: true });
    const bonus = core.mapOf(s.players[0]!).bonuses;
    const o = flow.placeOptions(core.ctx(s, 0, rng0), q)[0]!;
    const money = s.players[0]!.money + o.cells.reduce((n, y) => n + (bonus[y]?.k === 'money' ? bonus[y]!.n! : 0), 0);
    answer(s, { kind: 'ba', cells: o.cells });
    expect(s.players[0]!.buildings.some((b) => b.kind === 'ba')).toBe(true);
    expect(s.players[0]!.money).toBe(money); // free: only placement-bonus money
    s.queue = [];
    play(s, 0, 514);
    expect(s.queue).toHaveLength(0);
  });
});
