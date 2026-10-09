import { describe, expect, it } from 'vitest';
import { arkNovaModule, appealIncome, core, flow, restartTurn, target, type ArkView, type State } from '@bg/game-ark-nova';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = arkNovaModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as State;
const game = (players = 2, seed = 1, options: Record<string, unknown> = {}) => startGame(m, { playerCount: players, seed, options }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const hints = (snap: EngineSnapshot, seat: number) => projectFor(m, snap, p(seat)).legalActions;
const view = (snap: EngineSnapshot, seat: number | null) => projectFor(m, snap, seat === null ? { kind: 'spectator' } : p(seat)).view as ArkView;
/** Every seat keeps its first 4 draft cards. */
function drafted(snap: EngineSnapshot): EngineSnapshot {
  for (let seat = 0; seat < st(snap).n; seat++) {
    const d = st(snap).drafts[seat];
    if (!d) continue;
    snap = act(snap, seat, { type: 'draft', keep: d.cards.slice(0, 4), ...(d.maps.length ? { map: d.maps[0] } : {}) });
  }
  return snap;
}
const head = (snap: EngineSnapshot) => st(snap).queue[0]!;
/** Answer the head prompt with the option whose value starts with `prefix`. */
function choose(snap: EngineSnapshot, prefix: string): EngineSnapshot {
  const h = head(snap);
  if (h.k !== 'option') throw new Error(`head is ${h.k}`);
  const o = h.options.find((x) => x.value.startsWith(prefix));
  if (!o) throw new Error(`no option ${prefix} in ${h.options.map((x) => x.value).join(' ')}`);
  return act(snap, h.seat, { type: 'answer', value: o.value });
}
/** A random legal action of the waiting seat. */
function randomAction(snap: EngineSnapshot, rng: { nextInt(n: number): number }): { seat: number; action: unknown } {
  const s = st(snap);
  const seat = s.stage === 'draft' ? s.drafts.findIndex((d) => d) : s.queue[0]!.seat;
  const hs = hints(snap, seat).filter((h) => h.type !== 'resign');
  // Prefer real actions over the X-token action and skipping, so games progress.
  const real = hs.filter((h) => !(typeof h.value === 'string' && h.value.startsWith('x:')) && !h.skip);
  const pool = real.length && rng.nextInt(5) ? real : hs;
  const h = pool[rng.nextInt(pool.length)]!;
  if (h.type === 'draft') {
    const cards = h.cards as number[];
    const maps = h.maps as string[];
    return { seat, action: { type: 'draft', keep: cards.slice(0, 4), ...(maps.length ? { map: maps[0] } : {}) } };
  }
  if (h.pick) {
    const ids = [...(h.pick as number[])];
    const n = (h.min as number) + rng.nextInt((h.max as number) - (h.min as number) + 1);
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(ids.splice(rng.nextInt(ids.length), 1)[0]!);
    return { seat, action: { type: 'answer', ids: out } };
  }
  return { seat, action: h };
}

describe('ark nova setup', () => {
  it.each([2, 3, 4])('deals %i players: 25 money, staggered appeal, Animals in slot 1, 8 draft cards, 2 final scoring cards', (n) => {
    const s = st(game(n, 7));
    expect(s.stage).toBe('draft');
    expect(s.players).toHaveLength(n);
    expect(s.brkMax).toBe({ 2: 15, 3: 12, 4: 10 }[n]);
    expect(s.baseProjects).toHaveLength(n === 4 ? 4 : 3);
    expect(s.bonusTiles[5]).toHaveLength(2);
    expect(s.bonusTiles[8]).toHaveLength(2);
    const appeals = s.players.map((x) => x.appeal);
    expect(appeals[s.first]).toBe(0);
    expect([...appeals].sort()).toEqual(Array.from({ length: n }, (_, i) => i));
    for (const pl of s.players) {
      expect(pl.money).toBe(25);
      expect(pl.rep).toBe(1);
      expect(pl.slots[0]).toBe('animals');
      expect(new Set(pl.slots).size).toBe(5);
      expect(pl.finals).toHaveLength(2);
      expect(pl.map).toBe('A');
      expect(pl.buildings.map((b) => b.kind).sort()).toEqual(['e3', 'kiosk']);
    }
    for (const d of s.drafts) expect(d!.cards).toHaveLength(8);
    // 2 players: one level of each base project and the left donation column are blocked.
    if (n === 2) s.baseProjects.forEach((id, i) => expect(s.ptoks[id]![i]).toBe(-1));
    const cards = s.deck.length + s.display.length + s.drafts.reduce((a, d) => a + d!.cards.length, 0);
    expect(cards).toBe(128 + 64 + 20);
  });

  it('draft: keep exactly 4 of your 8, simultaneous, then the start player gets the turn prompt', () => {
    let snap = game(3, 2);
    const d0 = st(snap).drafts[0]!;
    expect(reject(snap, 0, { type: 'draft', keep: d0.cards.slice(0, 3).concat(d0.cards[0]!) })).toBe('BAD_DRAFT');
    expect(reject(snap, 0, { type: 'draft', keep: st(snap).drafts[1]!.cards.slice(0, 4) })).toBe('BAD_DRAFT');
    expect(reject(snap, 0, { type: 'draft', keep: d0.cards.slice(0, 4), map: '3' })).toBe('BAD_MAP');
    expect(reject(snap, 0, { type: 'answer', value: 'x' })).toBe('NO_PROMPT');
    expect(arkNovaModule.pendingSeats(st(snap))).toEqual([0, 1, 2]);
    snap = act(snap, 1, { type: 'draft', keep: st(snap).drafts[1]!.cards.slice(4) });
    expect(reject(snap, 1, { type: 'draft', keep: st(snap).players[1]!.hand })).toBe('NOT_DRAFTING');
    expect(arkNovaModule.pendingSeats(st(snap))).toEqual([0, 2]);
    snap = drafted(snap);
    const s = st(snap);
    expect(s.stage).toBe('play');
    expect(s.players.every((x) => x.hand.length === 4)).toBe(true);
    expect(s.discard).toHaveLength(12);
    expect(head(snap)).toMatchObject({ seat: s.first, k: 'option', fx: 'core:turn' });
  });

  it('advanced maps: each player chooses one of two distinct maps', () => {
    const s = st(game(4, 3, { map: 'advanced' }));
    const all = s.drafts.flatMap((d) => d!.maps);
    expect(all).toHaveLength(8);
    expect(new Set(all).size).toBe(8);
    expect(s.players.every((x) => x.map === '')).toBe(true);
  });
});

describe('ark nova actions', () => {
  const ready = (seed = 4) => {
    const snap = drafted(game(2, seed));
    // Make seat 0 the start player with a known position.
    const s = st(snap);
    return { snap, first: s.first };
  };

  it('tracks: appeal income table and target numbers', () => {
    expect(appealIncome(0)).toBe(5);
    expect(appealIncome(7)).toBe(11);
    expect(appealIncome(113)).toBe(38);
    expect(target(0)).toBe(114);
    expect(target(10)).toBe(94);
    expect(target(16)).toBe(76);
    expect(target(18)).toBe(70);
  });

  it('X-token action: card to slot 1, +1 X; wrong seat and bad choices are rejected without mutation', () => {
    const { snap, first } = ready();
    const other = 1 - first;
    expect(reject(snap, other, { type: 'answer', value: 'x:build' })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, first, { type: 'answer', value: 'a:build:9' })).toBe('BAD_CHOICE');
    expect(reject(snap, first, { type: 'answer', skip: true })).toBe('NOT_OPTIONAL');
    const before = JSON.stringify(st(snap));
    const next = choose(snap, 'x:sponsors');
    expect(JSON.stringify(st(snap))).toBe(before);
    const pl = st(next).players[first]!;
    expect(pl.x).toBe(1);
    expect(pl.slots[0]).toBe('sponsors');
    expect(st(next).current).toBe(other);
    expect(head(next)).toMatchObject({ seat: other, fx: 'core:turn' });
  });

  it('Sponsors I alternative: advance the break and take money equal to the strength', () => {
    const { snap, first } = ready(5);
    const pl = st(snap).players[first]!;
    const str = pl.slots.indexOf('sponsors') + 1;
    let next = choose(snap, 'a:sponsors:0');
    next = choose(next, 'break');
    const s = st(next);
    expect(s.players[first]!.money).toBe(25 + str);
    expect(s.brk).toBe(str);
    expect(s.players[first]!.slots[0]).toBe('sponsors');
  });

  it('Build I: one building of size up to the strength, 2 money per space, placement rules enforced', () => {
    const { snap, first } = ready(6);
    const pl = st(snap).players[first]!;
    let next = choose(snap, 'a:build:0');
    const h = head(next);
    expect(h.k).toBe('place');
    const str = pl.slots.indexOf('build') + 1;
    expect(reject(next, first, { type: 'answer', kind: 'e1', cells: ['4_5'] })).toBe('BUILD_NOT_ADJACENT');
    expect(reject(next, first, { type: 'answer', kind: 'e1', cells: ['1_0'] })).toBe('CELL_TERRAIN');
    expect(reject(next, first, { type: 'answer', kind: 'e1', cells: ['0_9'] })).toBe('CELL_COVERED');
    const opts = hints(next, first).filter((x) => x.kind === 'e1');
    expect(opts.length).toBeGreaterThan(0);
    // Every offered kind fits the strength.
    for (const x of hints(next, first)) if (x.kind) expect(Number(String(x.kind).replace(/\D/g, '') || 1)).toBeLessThanOrEqual(Math.max(str, 3));
    next = act(next, first, opts[0]!);
    const after = st(next).players[first]!;
    expect(after.buildings).toHaveLength(3);
    expect(after.money).toBeGreaterThanOrEqual(23);
    expect(after.slots[0]).toBe('build');
  });

  it('a kiosk must be 3+ spaces from another kiosk', () => {
    const { snap, first } = ready(6);
    const next = choose(snap, 'a:build:0');
    if (st(next).players[first]!.slots.indexOf('build') < 0) return;
    expect(reject(next, first, { type: 'answer', kind: 'kiosk', cells: ['1_8'] })).toMatch(/KIOSK_DISTANCE|BAD_BUILDING/);
  });

  it('Cards I: advances the break 2 and draws per the table', () => {
    const { snap, first } = ready(8);
    const str = st(snap).players[first]!.slots.indexOf('cards') + 1;
    let next = choose(snap, 'a:cards:0');
    expect(st(next).brk).toBe(2);
    next = choose(next, 'deck');
    const table = [[1, 1], [1, 0], [2, 1], [2, 0], [3, 1]][str - 1]!;
    let hand = st(next).players[first]!.hand.length;
    expect(hand).toBe(4 + table[0]!);
    if (table[1]) {
      const h = head(next);
      expect(h).toMatchObject({ k: 'pick', min: 1, max: 1 });
      next = act(next, first, { type: 'answer', ids: [st(next).players[first]!.hand[0]] });
      hand -= 1;
    }
    expect(st(next).players[first]!.hand).toHaveLength(hand);
  });

  it('Association I: gain 2 reputation (strength 2+) with one worker', () => {
    const { snap, first } = ready(9);
    const s = st(snap);
    const pl = s.players[first]!;
    pl.slots = ['animals', 'build', 'association', 'cards', 'sponsors'];
    restartTurn(s, first);
    let next = choose(snap, 'a:association:0');
    next = choose(next, 'rep');
    expect(st(next).players[first]!.rep).toBe(3);
    expect(st(next).players[first]!.workers).toBe(0);
    expect(st(next).assoc.rep).toEqual([first]);
  });

  it('Animals: plays an animal into a fitting enclosure, pays, gains appeal and icons', () => {
    const { snap, first } = ready(10);
    const s = st(snap);
    const pl = s.players[first]!;
    pl.slots = ['build', 'cards', 'association', 'sponsors', 'animals'];
    pl.hand = [404]; // Caracal: 9 money, size 2, predator + africa, 4 appeal, Hunter 2
    pl.buildings.push({ id: 99, kind: 'e2', cells: ['1_6', '2_7'] });
    restartTurn(s, first);
    let next = choose(snap, 'a:animals:0');
    next = choose(next, '404@');
    const a = st(next).players[first]!;
    expect(a.zoo).toContain(404);
    expect(a.money).toBe(25 - 9);
    expect(a.buildings.find((b) => b.kind === 'e2' && b.cells.includes('1_6'))?.full ?? a.buildings.find((b) => b.kind === 'e3')?.full).toBe(true);
    expect(a.appeal).toBeGreaterThanOrEqual(4);
  });

  it('timeout: takes the X-token action with the slot-1 card; resign puts the resigner last', () => {
    const { snap, first } = ready(11);
    const t = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(t).players[first]!.x).toBe(1);
    expect(st(t).players[first]!.timeouts).toBe(1);
    expect(st(t).current).toBe(1 - first);
    const r = act(snap, first, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: first, place: 2 });
    expect(st(r).outcome?.reason).toBe('resign');
    expect(reject(r, 1 - first, { type: 'resign' })).toBe('GAME_FINISHED');
  });

  it('draft timeout keeps the first 4 cards of every pending seat', () => {
    const snap = game(3, 12);
    const t = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(t).stage).toBe('play');
    st(t).players.forEach((pl, i) => expect(pl.hand).toEqual(st(snap).drafts[i]!.cards.slice(0, 4)));
  });

  it('projection hides hands, final scoring cards, drafts, the deck and other prompts', () => {
    let snap = game(2, 13);
    const sv = view(snap, null);
    expect(sv.me).toBeNull();
    expect(sv.display.every((x) => x === null)).toBe(true); // face down during the draft
    snap = drafted(snap);
    const s = st(snap);
    const turn = s.queue[0]!.seat;
    const other = 1 - turn;
    const ov = view(snap, other);
    const json = JSON.stringify(ov);
    expect(ov.me!.hand).toEqual(s.players[other]!.hand);
    expect(ov.players[turn]!.handCount).toBe(4);
    expect(ov.prompt).toMatchObject({ seat: turn, k: 'option' });
    expect(ov.prompt!.options).toBeUndefined();
    expect(json).not.toContain('"deck"');
    expect(json).not.toContain('finalsDeck');
    expect(json).not.toContain('"queue"');
    for (const id of s.players[turn]!.finals) expect(ov.me!.finals).not.toContain(id);
    const spec = view(snap, null);
    expect(spec.me).toBeNull();
    expect(spec.prompt!.options).toBeUndefined();
    // Card ids appear only as array elements; plain numeric fields (e.g. "target":114) are not cards.
    for (const pl of s.players) for (const id of pl.hand) expect(JSON.stringify(spec)).not.toMatch(new RegExp(String.raw`[\[,]${id}[\],]`));
    expect(hints(snap, other).map((h) => h.type)).toEqual(['resign']);
    expect(projectFor(m, snap, { kind: 'spectator' }).legalActions).toEqual([]);
  });
});


describe('ark nova break, end and scoring', () => {
  const rng0 = { nextInt: () => 0 };

  it('a break: hand limit, tokens and workers reset, folders 1-2 discarded, appeal + kiosk income', () => {
    let snap = drafted(game(2, 21));
    const s = st(snap);
    const f = s.first;
    s.brk = s.brkMax - 1;
    s.players[f]!.slots = ['animals', 'build', 'association', 'sponsors', 'cards'];
    s.players[f]!.tok.build.venom = 1;
    s.players[1 - f]!.workers = 0;
    restartTurn(s, f);
    const folders12 = [s.display[0], s.display[1]];
    snap = choose(snap, 'a:cards:0');
    expect(st(snap).breakDue).toBe(f);
    expect(st(snap).players[f]!.x).toBe(1);
    snap = choose(snap, 'deck'); // strength 5: draw 3, discard 1
    snap = act(snap, f, { type: 'answer', ids: [st(snap).players[f]!.hand[0]] });
    // End of turn -> break: both players are over the hand limit of 3.
    const moneyBefore = st(snap).players.map((x) => x.money);
    for (let k = 0; k < 2; k++) {
      const h = head(snap);
      expect(h).toMatchObject({ k: 'pick', fx: 'core:discard' });
      snap = act(snap, h.seat, { type: 'answer', ids: st(snap).players[h.seat]!.hand.slice(0, (h as { min: number }).min) });
    }
    const t = st(snap);
    expect(t.players.every((x) => x.hand.length <= 3)).toBe(true);
    expect(t.players[f]!.tok.build.venom).toBe(0);
    expect(t.players[1 - f]!.workers).toBe(1);
    expect(t.brk).toBe(0);
    expect(t.breakDue).toBeNull();
    expect(t.discard).toEqual(expect.arrayContaining(folders12 as number[]));
    // Map A's kiosk is next to the empty 3-space enclosure only, so no kiosk income yet.
    t.players.forEach((x, i) => expect(x.money).toBe(moneyBefore[i]! + appealIncome(x.appeal)));
    expect(t.current).toBe(1 - f);
  });

  it('kiosk income counts adjacent occupied enclosures, pavilions, special and unique buildings', () => {
    const s = st(drafted(game(2, 22)));
    const pl = s.players[0]!;
    expect(flow.kioskIncome(pl)).toBe(0);
    pl.buildings.find((b) => b.kind === 'e3')!.full = true;
    pl.buildings.push({ id: 50, kind: 'pavilion', cells: ['1_6'] });
    expect(flow.kioskIncome(pl)).toBe(2);
  });

  it('end of game: crossing triggers one more turn for the others, final cards, VP and the projects tie-break', () => {
    let snap = drafted(game(2, 23));
    const s = st(snap);
    const f = s.first;
    const o = 1 - f;
    s.players[f]!.appeal = 100; s.players[f]!.cp = 10; // target 94 -> crossed
    s.players[o]!.appeal = 40; s.players[o]!.cp = 3;
    restartTurn(s, f);
    snap = choose(snap, 'x:');
    expect(st(snap).endAt).toBe(st(snap).turnsDone + 1);
    expect(head(snap).seat).toBe(o);
    snap = choose(snap, 'x:');
    // Nobody reached 10 conservation points by playing: each discards one of 2 Final Scoring cards first.
    for (let k = 0; k < 2; k++) { const h = head(snap); snap = act(snap, h.seat, { type: 'answer', ids: [st(snap).players[h.seat]!.finals[0]] }); }
    const t = st(snap);
    expect(t.outcome?.reason).toBe('score');
    expect(t.players.every((x) => x.finals.length === 1)).toBe(true);
    expect(t.final!.find((x) => x.seat === f)!.vp).toBe(t.players[f]!.appeal - target(t.players[f]!.cp));
    expect(t.outcome!.placements[0]).toMatchObject({ seat: f, place: 1 });
    // Tie-break: equal VP -> more supported projects wins; still equal -> shared place.
    const u = structuredClone(t);
    u.players.forEach((x) => { x.appeal = 50; x.cp = 0; x.supported = 0; });
    expect(flow.rank(u, [0, 1]).map((x) => x.place)).toEqual([1, 1]);
    u.players[1]!.supported = 2;
    expect(flow.rank(u, [0, 1])).toMatchObject([{ seat: 1, place: 1 }, { seat: 0, place: 2 }]);
  });

  it('example content: Spokesperson counts its own research icon, Science Lab scores 3+ research, Small Animal expert discount, Meerkat Den needs a rock', () => {
    const s = st(drafted(game(2, 24)));
    const c = core.ctx(s, 0, rng0);
    const pl = s.players[0]!;
    pl.rep = 1;
    core.playSponsor(c, 202);
    flow.settle(s, rng0);
    expect(pl.rep).toBe(2);
    core.playSponsor(c, 201);
    expect(pl.rep).toBe(3);
    expect(core.animalCost(c, core.ANIMAL[404]!)).toBe(9);
    core.playSponsor(c, 229);
    expect(core.animalCost(c, core.ANIMAL[404]!)).toBe(6);
    expect(core.count(s, 0, 'science')).toBe(2);
    const p = s.players[0]!;
    expect(core.placements(c, 'u243', false).length).toBeGreaterThan(0);
    for (const cells of core.placements(c, 'u243', false)) expect(core.adjacentTerrain(p, cells, 'rock')).toBeGreaterThanOrEqual(1);
  });

  it('Map A: covering a placement bonus pays it once; a pavilion gives 1 appeal', () => {
    const s = st(drafted(game(2, 25)));
    const c = core.ctx(s, 0, rng0);
    const pl = s.players[0]!;
    const money = pl.money;
    pl.buildings.push({ id: 60, kind: 'e2', cells: ['1_4', '1_6'] }, { id: 61, kind: 'e1', cells: ['2_5'] });
    pl.taken.push('2_5');
    core.build(c, 'e1', ['3_2'], true); // adjacent to... direct build skips validation
    expect(pl.money).toBe(money + 5);
    const appeal = pl.appeal;
    core.build(c, 'pavilion', ['3_4'], true);
    expect(pl.appeal).toBe(appeal + 1);
  });

  it('reputation milestones: 5 upgrades an Action card, cap 9 until Cards is upgraded', () => {
    const s = st(drafted(game(2, 26)));
    const c = core.ctx(s, 0, rng0);
    const pl = s.players[0]!;
    core.gain(c, 'rep', 20);
    expect(pl.rep).toBe(9);
    core.flush(s);
    expect(s.queue[0]).toMatchObject({ k: 'sys', fx: 'core:upgrade' });
  });
});

describe('ark nova full games', () => {
  it('seeded random games terminate with a valid outcome and replay deterministically', () => {
    for (let g = 0; g < 9; g++) {
      const rng = createRng({ s: 101 + g });
      const players = 2 + (g % 3);
      const setup = { playerCount: players, seed: 500 + g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      let steps = 0;
      for (; steps < 20000 && !st(snap).outcome; steps++) {
        const { seat, action } = randomAction(snap, rng);
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const s = st(snap);
        if (!s.outcome) expect(arkNovaModule.pendingSeats(s).length).toBeGreaterThan(0);
      }
      const s = st(snap);
      expect(s.outcome, `game ${g} after ${steps} steps`).not.toBeNull();
      expect(s.outcome!.placements).toHaveLength(players);
      expect(s.final).toHaveLength(players);
      for (const pl of s.players) {
        expect(pl.money).toBeGreaterThanOrEqual(0);
        expect(pl.x).toBeLessThanOrEqual(5);
        expect(pl.appeal).toBeLessThanOrEqual(113);
      }
      const best = s.outcome!.placements.filter((x) => x.place === 1);
      expect(best.length).toBeGreaterThan(0);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 600_000);

  it('timeouts keep a game moving (every timeout ends the waiting turn)', () => {
    let snap = drafted(game(3, 77));
    for (let i = 0; i < 15; i++) {
      const before = st(snap).turnsDone;
      snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
      expect(st(snap).turnsDone).toBe(before + 1); // the X-token action, no break yet
    }
    expect(st(snap).players.every((x) => x.x === 5)).toBe(true);
    for (let i = 0; i < 300 && !st(snap).outcome; i++) snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(snap).turnsDone).toBeGreaterThan(100);
  }, 120_000);
});

describe('ark nova tutorial', () => {
  it('the scripted lesson is legal step by step and ends with the learner winning 4 to -40', () => {
    const tu = arkNovaModule.tutorial;
    expect(tu.steps.length).toBeGreaterThanOrEqual(3);
    expect(tu.steps.length).toBeLessThanOrEqual(8);
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    expect(arkNovaModule.pendingSeats(st(snap))).toEqual([0]);
    for (const [i, step] of tu.steps.entries()) {
      expect(st(snap).outcome, `step ${i}`).toBeNull();
      expect(arkNovaModule.pendingSeats(st(snap)), `step ${i}`).toEqual([0]);
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    const s = st(snap);
    const me = s.players[0]!;
    expect(me.appeal).toBe(92);
    expect(me.cp).toBe(12); // 8 + 2 (Reptiles) + 1 (left-edge token) + 1 (Climbing Park)
    expect(me.money).toBe(20 - 2 + 5 - 9);
    expect(s.final).toEqual([
      { seat: 0, vp: 4, appeal: 92, cp: 12, target: 88 },
      { seat: 1, vp: -40, appeal: 60, cp: 7, target: 100 }
    ]);
    expect(s.outcome).toEqual({ placements: [{ seat: 0, place: 1, score: 4 }, { seat: 1, place: 2, score: -40 }], reason: 'score' });
  });

  it('the tutorial deal never leaks the opponent hand', () => {
    const tu = arkNovaModule.tutorial;
    const snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    const v = view(snap, 0);
    expect(v.me!.hand).toEqual([484, 401]);
    expect(v.players[1]!.handCount).toBe(2);
    expect(JSON.stringify(v)).not.toContain('432');
  });
});

describe('ark nova content registry', () => {
  it('every base-game item exists exactly once: 128 animals, 64 sponsors, 32 projects, 11 final scoring cards, maps 0-8 + A, 30 abilities, 9 bonus tiles', () => {
    const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    const num = (o: object) => Object.keys(o).map(Number).sort((a, b) => a - b);
    const animals = num(core.ANIMAL);
    const sponsors = num(core.SPONSOR);
    const projects = num(core.PROJECT);
    expect(animals).toEqual(range(401, 528));
    expect(sponsors).toEqual(range(201, 264));
    expect(projects).toEqual(range(101, 132));
    // 128 + 64 + 32 + 11 = 235 cards, plus the 20 Action cards (5 per player colour) = the 255 cards of the base game.
    expect(animals.length + sponsors.length + projects.length + 11 + 5 * 4).toBe(255);
    expect(projects.filter((id) => core.PROJECT[id]!.base)).toEqual(range(101, 112));
    for (const id of [...animals, ...sponsors]) {
      const d = core.REG.cards.get(id);
      expect(d, `card ${id}`).toBeDefined();
      expect(d!.nameFa, `card ${id}`).toMatch(/[؀-ۿ]/);
    }
    for (const id of sponsors) expect(core.REG.cards.get(id)!.textFa, `sponsor ${id}`).toMatch(/[؀-ۿ]/);
    expect(core.REG.cards.size).toBe(128 + 64);
    for (const id of projects) expect(core.REG.projects.get(id)?.nameFa, `project ${id}`).toMatch(/[؀-ۿ]/);
    expect([...core.REG.scoring.keys()].sort((a, b) => a - b)).toEqual(range(1, 11));
    expect([...core.REG.maps.keys()].sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', 'A']);
    const keys = new Set(animals.flatMap((id) => core.ANIMAL[id]!.ab.map(([k]) => k)));
    expect(Object.keys(core.REG.abilities).sort()).toEqual([...keys].sort());
    expect(keys.size).toBe(30);
    for (const id of animals) for (const [k, v] of core.ANIMAL[id]!.ab) expect(core.REG.abilities[k]!.textFa(v, id)).toMatch(/[؀-ۿ]/);
    expect(core.REG.abilities.inventive!.textFa(0, 411)).toContain('خرس');
    expect(core.REG.abilities.inventive!.textFa(0, 459)).toContain('نخستی');
    expect(Object.keys(flow.TILES).sort()).toEqual(['card3', 'enc3', 'money10', 'mult', 'partner', 'rep2', 'sponsor', 'uni', 'x3']);
  });

  it('a fixed-card extra action (the Action ability) offers no X-token action', () => {
    const s = st(drafted(game(2, 31)));
    const rng0 = { nextInt: () => 0 };
    s.queue = []; s.act = null;
    core.grantAction(core.ctx(s, 0, rng0), { cards: ['association'], label: 't' });
    flow.settle(s, rng0);
    const h = s.queue[0] as unknown as { options: { value: string }[] };
    expect(h.options.length).toBeGreaterThan(0);
    expect(h.options.every((o) => o.value.startsWith('a:association:'))).toBe(true);
  });
});

/**
 * The e2e driver's policy (e2e/ark-nova.spec.ts mirrors it): decision number n takes the (7n mod k)-th non-X choice
 * (placements and option buttons alike), picks the minimum number of cards, and skips optional prompts every 3rd time.
 */
function policyAction(snap: EngineSnapshot, n: number): { seat: number; action: unknown } {
  const s = st(snap);
  const seat = s.stage === 'draft' ? s.drafts.findIndex((d) => d) : s.queue[0]!.seat;
  const hs = hints(snap, seat).filter((h) => h.type !== 'resign');
  if (hs[0]!.type === 'draft') return { seat, action: { type: 'draft', keep: (hs[0]!.cards as number[]).slice(0, 4) } };
  const skip = hs.find((h) => h.skip);
  const real = hs.filter((h) => !h.skip && !(typeof h.value === 'string' && h.value.startsWith('x:')));
  if (skip && (n % 3 === 0 || !real.length)) return { seat, action: skip };
  const h = real.length ? real[(7 * n) % real.length]! : hs[0]!;
  if (h.pick) return { seat, action: { type: 'answer', ids: (h.pick as number[]).slice(0, h.min as number) } };
  return { seat, action: h };
}

describe('ark nova many seeded games', () => {
  it('30 random games (2-4 players) end with a valid outcome; projections never carry hidden state', () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 900 + g });
      const players = 2 + (g % 3);
      let snap = startGame(m, { playerCount: players, seed: 7000 + g, options: {} }).snapshot;
      for (let steps = 0; steps < 20000 && !st(snap).outcome; steps++) {
        const { seat, action } = randomAction(snap, rng);
        snap = act(snap, seat, action);
        if (steps % 97 === 0) {
          const s = st(snap);
          const sv = view(snap, null) as unknown as Record<string, unknown>;
          expect(sv).not.toHaveProperty('deck');
          expect(sv).not.toHaveProperty('queue');
          expect(sv.me).toBeNull();
          for (const pl of sv.players as Record<string, unknown>[]) { expect(pl).not.toHaveProperty('hand'); expect(pl).not.toHaveProperty('finals'); expect(pl).not.toHaveProperty('under'); }
          const ov = view(snap, 0);
          expect(ov.me!.hand).toEqual(s.players[0]!.hand);
          if (ov.prompt && ov.prompt.seat !== 0) { expect(ov.prompt.options).toBeUndefined(); expect(ov.prompt.ids).toBeUndefined(); }
        }
      }
      const s = st(snap);
      expect(s.outcome, `game ${g}`).not.toBeNull();
      const places = s.outcome!.placements;
      expect(places.map((x) => x.seat).sort()).toEqual(Array.from({ length: players }, (_, i) => i));
      expect(places[0]!.place).toBe(1);
      for (const x of places) expect(x.score).toBe(s.players[x.seat]!.appeal - target(s.players[x.seat]!.cp));
    }
  }, 900_000);

  it('the e2e/API driver policy finishes 2-player games', () => {
    for (const seed of [4242, 1, 2, 3, 77, 909]) {
      let snap = game(2, seed);
      let steps = 0;
      for (; steps < 20000 && !st(snap).outcome; steps++) { const { seat, action } = policyAction(snap, steps); snap = act(snap, seat, action); }
      expect(st(snap).outcome?.reason, `seed ${seed}`).toBe('score');
      expect(steps, `seed ${seed}`).toBeLessThan(3000);
    }
  }, 600_000);
});
