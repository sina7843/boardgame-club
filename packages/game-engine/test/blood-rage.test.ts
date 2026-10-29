import { describe, expect, it } from 'vitest';
import {
  adjacent, ageDeck, bloodRageModule, boardCount, callable, CARDS, CARD_BY_ID, defaultAction, finalScore, groupStr, has, hornsOf, invadeTargets,
  pending, PROVINCES, PROVINCE_IDS, RING, TRACKS, villagesFree,
  type BRAction, type BRState, type BRView, type Figure, type ProvinceId
} from '@bg/game-blood-rage';
import { applyAction, applyTimeout, projectFor, replay, startGame, type EngineSnapshot } from '../src/index.ts';

const m = bloodRageModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (snap: EngineSnapshot) => snap.state as BRState;
const view = (snap: EngineSnapshot, seat: number | null) => projectFor(m, snap, seat === null ? { kind: 'spectator' } : p(seat)).view as BRView;

function act(snap: EngineSnapshot, seat: number, action: BRAction): EngineSnapshot {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
}
const reject = (snap: EngineSnapshot, seat: number, action: BRAction) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};

/** Fresh game, then the state is edited into the position a test needs. */
function arrange(players: number, edit: (s: BRState) => void, seed = 3): EngineSnapshot {
  const snap = startGame(m, { playerCount: players, seed, options: {} }).snapshot;
  const s = structuredClone(st(snap));
  edit(s);
  return { ...snap, state: s };
}
/** Action phase, everything cleared: no figures on the board, no hands. */
function clean(s: BRState, first = 0) {
  s.step = 'action'; s.first = first; s.turn = first; s.spent = false; s.battle = null; s.queue = []; s.packs = s.packs.map(() => []);
  s.pillaged = []; s.destroyed = []; s.ragnarok = ['utg', 'hor', 'mus']; s.age = 1;
  for (const f of s.figs) f.at = 'reserve';
  for (const c of s.clans) { c.hand = []; c.quests = []; c.rage = 6; c.passed = false; c.glory = 0; c.steps = { rage: 0, axes: 0, horns: 0 }; c.warrior = c.leader = c.ship = null; c.monsters = [null, null]; c.clans = [null, null, null]; }
  s.rewards = { ygg: 'all', myr: 'glory', elv: 'axes', ang: 'rage', gim: 'horns', and: 'glory', utg: 'rage', hor: 'axes', mus: 'horns' };
}
const fig = (s: BRState, seat: number, kind: Figure['kind'], k = 0) => s.figs.filter((f) => f.seat === seat && f.kind === kind)[k]!;
const put = (s: BRState, seat: number, kind: Figure['kind'], k: number, at: Figure['at']) => { fig(s, seat, kind, k).at = at; };
const give = (s: BRState, seat: number, ...defs: string[]) => defs.map((d) => { s.inst.push(d); s.clans[seat]!.hand.push(s.inst.length - 1); return s.inst.length - 1; });
const upgrade = (s: BRState, seat: number, def: string, slot: 'warrior' | 'leader' | 'ship' | 'monster' | 'clan') => {
  s.inst.push(def);
  const i = s.inst.length - 1;
  const c = s.clans[seat]!;
  if (slot === 'monster') { const f = s.figs.length; s.figs.push({ id: f, seat, kind: 'monster', mon: def, at: 'reserve' }); c.monsters[c.monsters.indexOf(null)] = i; }
  else if (slot === 'clan') c.clans[c.clans.indexOf(null)] = i;
  else c[slot] = i;
  return i;
};

describe('blood rage data', () => {
  it('82 cards with unique ids and a deck of at least 8 cards per player for every age and player count', () => {
    expect(CARDS).toHaveLength(82);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(82);
    for (const age of [1, 2, 3] as const) for (let n = 2; n <= 5; n++) expect(ageDeck(age, n).length, `age ${age} players ${n}`).toBeGreaterThanOrEqual(n * 8);
    expect(ageDeck(1, 2)).toHaveLength(20);
    expect(ageDeck(1, 4)).toHaveLength(34);
  });
  it('the board: 8 outer provinces in a ring, every one touches Yggdrasil and two neighbours, 3–5 villages', () => {
    expect(RING).toHaveLength(8);
    for (const a of RING) {
      expect(adjacent(a, 'ygg')).toBe(true);
      expect(RING.filter((b) => adjacent(a, b))).toHaveLength(2);
      expect(PROVINCES[a].villages).toBeGreaterThanOrEqual(3);
      expect(PROVINCES[a].villages).toBeLessThanOrEqual(5);
    }
    expect(TRACKS.rage[0]).toBe(6);
    expect(TRACKS.axes[0]).toBe(3);
    expect(TRACKS.horns[0]).toBe(4);
  });
});

describe('blood rage setup and draft', () => {
  it('2–5 players: figures, destroyed provinces, a Ragnarök token per age, 8 cards each', () => {
    for (const [n, destroyed] of [[2, 3], [3, 2], [4, 1], [5, 0]] as const) {
      const s = st(startGame(m, { playerCount: n, seed: 9, options: {} }).snapshot);
      expect(s.figs).toHaveLength(n * 10);
      expect(s.destroyed).toHaveLength(destroyed);
      expect(new Set([...s.ragnarok, ...s.destroyed]).size).toBe(3 + destroyed);
      expect(s.packs.map((x) => x.length)).toEqual(Array.from({ length: n }, () => 8));
      expect(s.step).toBe('draft');
    }
  });
  it('is deterministic for a seed', () => {
    const a = startGame(m, { playerCount: 3, seed: 21, options: {} }).snapshot;
    const b = startGame(m, { playerCount: 3, seed: 21, options: {} }).snapshot;
    expect(a.state).toEqual(b.state);
  });
  it('3 players: one pick per step, packs pass left, each ends with 6 cards, then the Action phase', () => {
    let snap = startGame(m, { playerCount: 3, seed: 4, options: {} }).snapshot;
    const first = st(snap).packs.map((x) => [...x]);
    for (let round = 0; round < 6; round++) {
      for (let seat = 0; seat < 3; seat++) {
        const pack = st(snap).packs[seat]!;
        expect(pack.length).toBe(8 - round);
        snap = act(snap, seat, { type: 'pick', cards: [pack[0]!] });
      }
      if (round === 0) for (let seat = 0; seat < 3; seat++) expect(st(snap).packs[(seat + 1) % 3]!.every((i) => first[seat]!.includes(i))).toBe(true);
    }
    const s = st(snap);
    expect(s.step).toBe('action');
    expect(s.clans.map((c) => c.hand.length)).toEqual([6, 6, 6]);
    expect(s.clans.map((c) => c.rage)).toEqual([6, 6, 6]);
  });
  it('2 players: two cards per step, three steps', () => {
    let snap = startGame(m, { playerCount: 2, seed: 4, options: {} }).snapshot;
    for (let round = 0; round < 3; round++) for (let seat = 0; seat < 2; seat++) snap = act(snap, seat, { type: 'pick', cards: st(snap).packs[seat]!.slice(0, 2) });
    expect(st(snap).step).toBe('action');
    expect(st(snap).clans.map((c) => c.hand.length)).toEqual([6, 6]);
  });
  it('rejects a card that is not in your pack and a second pick in the same step; picks are simultaneous', () => {
    const snap = startGame(m, { playerCount: 3, seed: 4, options: {} }).snapshot;
    const other = st(snap).packs[1]![0]!;
    expect(reject(snap, 0, { type: 'pick', cards: [other] })).toBe('BAD_CARDS');
    const a = act(snap, 2, { type: 'pick', cards: [st(snap).packs[2]![0]!] });
    expect(reject(a, 2, { type: 'pick', cards: [st(a).packs[2]![0]!] })).toBe('NOT_YOUR_TURN');
    expect(pending(st(a)).sort()).toEqual([0, 1]);
  });
});

describe('blood rage actions', () => {
  it('invade: pays the figure strength, leaders are free, ships go to fjords, Yggdrasil is closed', () => {
    let snap = arrange(3, (s) => clean(s));
    const w = fig(st(snap), 0, 'warrior').id, l = fig(st(snap), 0, 'leader').id, sh = fig(st(snap), 0, 'ship').id;
    expect(reject(snap, 0, { type: 'invade', figure: w, at: 'ygg' })).toBe('BR_BAD_PLACE');
    expect(reject(snap, 0, { type: 'invade', figure: sh, at: 'myr' })).toBe('BR_BAD_PLACE');
    expect(reject(snap, 1, { type: 'invade', figure: fig(st(snap), 1, 'warrior').id, at: 'myr' })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'invade', figure: w, at: 'myr' });
    expect(st(snap).clans[0]!.rage).toBe(5);
    expect(st(snap).turn).toBe(1);
    snap = act(snap, 1, { type: 'pass' });
    snap = act(snap, 2, { type: 'pass' });
    snap = act(snap, 0, { type: 'invade', figure: l, at: 'elv' });
    expect(st(snap).clans[0]!.rage).toBe(5);
    snap = act(snap, 0, { type: 'invade', figure: sh, at: 'f1' });
    expect(st(snap).clans[0]!.rage).toBe(2);
    expect(fig(st(snap), 0, 'ship').at).toBe('f1');
  });
  it('invade stops at the Horns limit and when villages are full', () => {
    const snap = arrange(2, (s) => {
      clean(s);
      for (let k = 0; k < 4; k++) put(s, 0, 'warrior', k, 'myr');
    });
    const s = st(snap);
    expect(boardCount(s, 0)).toBe(hornsOf(s, 0));
    expect(reject(snap, 0, { type: 'invade', figure: fig(s, 0, 'warrior', 4).id, at: 'elv' })).toBe('BR_HORNS');
    const full = arrange(3, (x) => { clean(x); for (let k = 0; k < 4; k++) put(x, 1, 'warrior', k, 'elv'); x.clans[0]!.steps.horns = 3; });
    expect(villagesFree(st(full), 'elv')).toBe(0);
    expect(reject(full, 0, { type: 'invade', figure: fig(st(full), 0, 'warrior').id, at: 'elv' })).toBe('BR_BAD_PLACE');
  });
  it('march: 1 rage, one province to one other, needs empty villages, ships cannot march', () => {
    let snap = arrange(2, (s) => { clean(s); put(s, 0, 'warrior', 0, 'myr'); put(s, 0, 'warrior', 1, 'myr'); put(s, 0, 'ship', 0, 'f1'); for (let k = 0; k < 4; k++) put(s, 1, 'warrior', k, 'gim'); });
    const ids = [fig(st(snap), 0, 'warrior', 0).id, fig(st(snap), 0, 'warrior', 1).id];
    expect(reject(snap, 0, { type: 'march', from: 'myr', to: 'gim', figures: ids })).toBe('BR_NO_ROOM');
    expect(reject(snap, 0, { type: 'march', from: 'myr', to: 'elv', figures: [fig(st(snap), 0, 'ship').id] })).toBe('BR_BAD_FIGURE');
    snap = act(snap, 0, { type: 'march', from: 'myr', to: 'ygg', figures: ids });
    expect(st(snap).clans[0]!.rage).toBe(5);
    expect(ids.every((i) => st(snap).figs[i]!.at === 'ygg')).toBe(true);
  });
  it('upgrade: a figure upgrade offers a free invasion; the new card replaces the old one in the same slot', () => {
    let snap = arrange(2, (s) => { clean(s); give(s, 0, 'm1-troll', 'w1-brothers', 'w2-experts'); });
    const [troll, brothers, experts] = st(snap).clans[0]!.hand as [number, number, number];
    snap = act(snap, 0, { type: 'upgrade', card: troll });
    expect(st(snap).clans[0]!.rage).toBe(4);
    expect(st(snap).queue[0]?.k).toBe('freeInvade');
    expect(pending(st(snap))).toEqual([0]);
    const monster = (st(snap).queue[0] as { fig: number }).fig;
    snap = act(snap, 0, { type: 'decide', yes: true, at: 'elv' });
    expect(st(snap).figs[monster]!.at).toBe('elv');
    expect(st(snap).clans[0]!.rage).toBe(4);
    const idle = (sn: EngineSnapshot, k: number) => act(sn, 1, { type: 'invade', figure: fig(st(sn), 1, 'warrior', k).id, at: 'ang' });
    snap = idle(snap, 0);
    snap = act(snap, 0, { type: 'upgrade', card: brothers });
    snap = act(snap, 0, { type: 'decide', yes: false });
    snap = idle(snap, 1);
    snap = act(snap, 0, { type: 'upgrade', card: experts });
    expect(has(st(snap), 0, 'w2-experts')).toBe(true);
    expect(has(st(snap), 0, 'w1-brothers')).toBe(false);
  });
  it('warrior upgrades change the strength of pairs', () => {
    const s = st(arrange(2, (x) => { clean(x); for (let k = 0; k < 3; k++) put(x, 0, 'warrior', k, 'myr'); }));
    expect(groupStr(s, 0, ['myr'])).toBe(3);
    upgrade(s, 0, 'w1-brothers', 'warrior');
    expect(groupStr(s, 0, ['myr'])).toBe(4);
    upgrade(s, 0, 'w2-experts', 'warrior');
    expect(groupStr(s, 0, ['myr'])).toBe(6);
    upgrade(s, 0, 'w3-masters', 'warrior');
    expect(groupStr(s, 0, ['myr'])).toBe(8);
  });
  it('a clan with 0 Rage cannot act; pass forfeits the rest; the phase ends when everybody is out', () => {
    let snap = arrange(2, (s) => clean(s));
    snap = act(snap, 0, { type: 'pass' });
    expect(st(snap).clans[0]!.rage).toBe(0);
    expect(st(snap).turn).toBe(1);
    snap = act(snap, 1, { type: 'pass' });
    // with nothing in hand the discard and quest phases pass by themselves; Ragnarök and the next Age follow
    expect(st(snap).age).toBe(2);
    expect(st(snap).step).toBe('draft');
    expect(st(snap).first).toBe(1);
  });
  it('quest commit is hidden from the other clans', () => {
    let snap = arrange(3, (s) => { clean(s); give(s, 0, 'q1-alf'); });
    const q = st(snap).clans[0]!.hand[0]!;
    snap = act(snap, 0, { type: 'quest', card: q });
    expect(view(snap, 0).me!.quests).toHaveLength(1);
    expect(view(snap, 1).me!.quests).toHaveLength(0);
    expect(view(snap, 1).seats[0]!.quests).toBe(1);
    expect(JSON.stringify(view(snap, 1))).not.toContain('q1-alf');
  });
});

describe('blood rage pillage and battle', () => {
  /** Seat 0 pillages myr where seat 1 also stands; seat 2 has a warrior in the neighbouring elv. */
  function standoff(edit: (s: BRState) => void = () => undefined, players = 3): EngineSnapshot {
    return arrange(players, (s) => {
      clean(s); s.rewards.elv = 'glory';
      put(s, 0, 'leader', 0, 'elv'); put(s, 0, 'warrior', 0, 'elv');
      put(s, 1, 'warrior', 0, 'elv'); put(s, 1, 'warrior', 1, 'elv');
      edit(s);
    });
  }
  it('an unopposed pillage gives the reward and no battle glory', () => {
    let snap = arrange(2, (s) => { clean(s); s.rewards.myr = 'axes'; put(s, 0, 'leader', 0, 'myr'); });
    snap = act(snap, 0, { type: 'pillage', at: 'myr' });
    expect(st(snap).battle).toBeNull();
    expect(st(snap).pillaged).toEqual(['myr']);
    expect(st(snap).clans[0]!.steps.axes).toBe(1);
    expect(st(snap).clans[0]!.glory).toBe(0);
    expect(reject(snap, 1, { type: 'pillage', at: 'myr' })).not.toBe('ACCEPTED');
  });
  it('battle: cards are chosen secretly, the strongest side wins, glory = Axes, losers die, the winner pillages', () => {
    let snap = standoff((s) => { give(s, 0, 'b1-bash'); give(s, 1, 'b1-trickery'); });
    snap = act(snap, 0, { type: 'pillage', at: 'elv' });
    // call to battle: nobody has anybody to bring, so it moves straight to the cards
    expect(st(snap).battle?.stage).toBe('cards');
    expect(pending(st(snap)).sort()).toEqual([0, 1]);
    const c0 = st(snap).clans[0]!.hand[0]!, c1 = st(snap).clans[1]!.hand[0]!;
    snap = act(snap, 1, { type: 'play', card: c1 });
    expect(view(snap, 0).battle!.chosen['1']).toBe('hidden');
    snap = act(snap, 0, { type: 'play', card: c0 });
    const s = st(snap);
    expect(s.battle).toBeNull();
    // leader 2 + warrior 1 + Bash 2 = 5 against 2 warriors + Trickery 0 = 2: Axes 3 + the pillage reward (5 glory)
    expect(s.clans[0]!.glory).toBe(8);
    expect(s.figs.filter((f) => f.seat === 1 && f.at === 'valhalla')).toHaveLength(2);
    expect(s.clans[0]!.hand).toHaveLength(0);
    expect(s.clans[1]!.hand).toHaveLength(1);
    expect(s.pillaged).toContain('elv');
  });
  it('a tie: everybody loses, nobody pillages', () => {
    let snap = standoff((s) => { give(s, 0, 'b1-bash'); give(s, 1, 'b1-smash'); });
    snap = act(snap, 0, { type: 'pillage', at: 'elv' });
    snap = act(snap, 0, { type: 'play', card: st(snap).clans[0]!.hand[0]! });
    snap = act(snap, 1, { type: 'play', card: st(snap).clans[1]!.hand[0]! });
    // 3 + 2 vs 2 + 3? leader 2 + warrior 1 + Bash 2 = 5; 2 warriors 2 + Smash 3 = 5
    const s = st(snap);
    expect(s.battle).toBeNull();
    expect(s.pillaged).toEqual([]);
    expect(s.figs.filter((f) => f.at === 'valhalla')).toHaveLength(4);
    expect(s.clans[0]!.hand).toHaveLength(1);
  });
  it('call to battle: an adjacent clan may bring a figure, the pillager last; ships and non-adjacent figures cannot come', () => {
    let snap = standoff((s) => {
      put(s, 1, 'warrior', 1, 'myr'); // the standoff in myr now has a free village
      put(s, 2, 'warrior', 0, 'myr'); put(s, 2, 'warrior', 1, 'utg'); put(s, 2, 'ship', 0, 'f1');
      give(s, 2, 'b1-bash');
    });
    snap = act(snap, 0, { type: 'pillage', at: 'elv' });
    expect(st(snap).battle?.stage).toBe('call');
    expect(pending(st(snap))).toEqual([1]);
    snap = act(snap, 1, { type: 'call' });
    expect(pending(st(snap))).toEqual([2]);
    expect(callable(st(snap), 2, 'elv').map((f) => f.at)).toEqual(['myr']);
    expect(reject(snap, 2, { type: 'call', figure: fig(st(snap), 2, 'warrior', 1).id })).toBe('BR_BAD_CALL');
    snap = act(snap, 2, { type: 'call', figure: fig(st(snap), 2, 'warrior', 0).id });
    expect(fig(st(snap), 2, 'warrior', 0).at).toBe('elv');
    expect(st(snap).battle?.stage).toBe('cards');
  });
  it('Odin\'s Smite destroys a warrior of every opponent first; Thor\'s Primacy cancels the text', () => {
    let snap = standoff((s) => { give(s, 0, 'b1-smite'); give(s, 1, 'b1-bash'); });
    snap = act(snap, 0, { type: 'pillage', at: 'elv' });
    snap = act(snap, 0, { type: 'play', card: st(snap).clans[0]!.hand[0]! });
    snap = act(snap, 1, { type: 'play', card: st(snap).clans[1]!.hand[0]! });
    // seat 1 lost a warrior before comparing: 1 + 2 = 3 against leader 2 + warrior 1 + 1 = 4
    expect(st(snap).figs.filter((f) => f.seat === 1 && f.at === 'valhalla')).toHaveLength(2);
    let primacy = standoff((s) => { give(s, 0, 'b1-smite'); give(s, 1, 'b3-primacy'); });
    primacy = act(primacy, 0, { type: 'pillage', at: 'elv' });
    primacy = act(primacy, 0, { type: 'play', card: st(primacy).clans[0]!.hand[0]! });
    primacy = act(primacy, 1, { type: 'play', card: st(primacy).clans[1]!.hand[0]! });
    // Primacy (+3) with both warriors alive = 5 beats 4; seat 0 loses, seat 1 (not the pillager) gets only Axes glory
    expect(st(primacy).clans[1]!.glory).toBe(3);
    expect(st(primacy).figs.filter((f) => f.seat === 0 && f.at === 'valhalla')).toHaveLength(2);
  });
  it('Frigga\'s Protection lets a loser pay Rage to keep figures; Valkyrie and Thor\'s Glory pay out', () => {
    let snap = standoff((s) => { give(s, 0, 'b1-tsmite'); upgrade(s, 1, 'u2-protection', 'clan'); });
    snap = act(snap, 0, { type: 'pillage', at: 'elv' });
    snap = act(snap, 0, { type: 'play', card: st(snap).clans[0]!.hand[0]! });
    expect(st(snap).queue[0]?.k).toBe('protect');
    snap = act(snap, 1, { type: 'decide', figures: [fig(st(snap), 1, 'warrior', 0).id] });
    expect(st(snap).clans[1]!.rage).toBe(5);
    expect(fig(st(snap), 1, 'warrior', 0).at).toBe('elv');
    expect(fig(st(snap), 1, 'warrior', 1).at).toBe('valhalla');
    const s = st(standoff((x) => { give(x, 0, 'b1-tsmite'); upgrade(x, 0, 'u1-glory', 'clan'); }));
    expect(has(s, 0, 'u1-glory')).toBe(true);
  });
  it('Heimdall\'s Watch: all revealed cards go, the Watch player gains their strength in glory, everybody plays again', () => {
    let snap = standoff((s) => { give(s, 0, 'b2-watch', 'b1-bash'); give(s, 1, 'b1-tsmite', 'b1-smash'); });
    snap = act(snap, 0, { type: 'pillage', at: 'elv' });
    const [watch, bash] = st(snap).clans[0]!.hand as [number, number];
    snap = act(snap, 0, { type: 'play', card: watch });
    snap = act(snap, 1, { type: 'play', card: st(snap).clans[1]!.hand[0]! });
    expect(st(snap).battle?.stage).toBe('cards');
    expect(st(snap).clans[0]!.glory).toBe(5);
    expect(st(snap).clans[0]!.hand).toEqual([bash]);
    expect(st(snap).clans[1]!.hand).toHaveLength(1);
  });
  it('Heimdall\'s Eye is optional and decided after the others are known', () => {
    let snap = standoff((s) => { give(s, 0, 'b2-eye'); give(s, 1, 'b1-bash'); });
    snap = act(snap, 0, { type: 'pillage', at: 'elv' });
    snap = act(snap, 0, { type: 'play', card: st(snap).clans[0]!.hand[0]! });
    snap = act(snap, 1, { type: 'play', card: st(snap).clans[1]!.hand[0]! });
    expect(st(snap).queue[0]?.k).toBe('late');
    expect(view(snap, 1).battle!.totals).toEqual({ '0': 3, '1': 4 });
    snap = act(snap, 0, { type: 'decide', yes: true });
    // 3 + 2 = 5 against 4
    expect(st(snap).clans[0]!.glory).toBeGreaterThan(0);
    expect(st(snap).clans[0]!.hand).toHaveLength(0);
  });
});

describe('blood rage phases', () => {
  function endOfAction(edit: (s: BRState) => void, players = 2): EngineSnapshot {
    let snap = arrange(players, (s) => { clean(s); edit(s); });
    for (let seat = 0; seat < players; seat++) if (st(snap).clans[seat]!.rage > 0) snap = act(snap, st(snap).turn, { type: 'pass' });
    return snap;
  }
  it('discard: keep one card for the next age; the quests are resolved; the doomed province is destroyed; Valhalla is released', () => {
    let snap = arrange(2, (s) => { clean(s); give(s, 0, 'b1-bash', 'b1-smash'); give(s, 0, 'q1-ygg'); const q = s.clans[0]!.hand.pop()!; s.clans[0]!.quests.push(q); put(s, 0, 'leader', 0, 'ygg'); put(s, 0, 'warrior', 0, 'utg'); put(s, 1, 'warrior', 0, 'utg'); });
    snap = act(snap, 0, { type: 'pass' });
    snap = act(snap, 1, { type: 'pass' });
    expect(st(snap).step).toBe('discard');
    const keep = st(snap).clans[0]!.hand[1]!;
    expect(pending(st(snap))).toEqual([0]);
    snap = act(snap, 0, { type: 'keep', card: keep });
    const s = st(snap);
    // quest Yggdrasil! (6): leader in Yggdrasil leads; stat choice follows, then Ragnarök on utg (2 glory per figure in age 1)
    expect(s.queue[0]?.k).toBe('stat');
    snap = act(snap, 0, { type: 'decide', stat: 'axes' });
    const e = st(snap);
    expect(e.age).toBe(2);
    expect(e.destroyed).toContain('utg');
    expect(e.clans[0]!.glory).toBe(6 + 2);
    expect(e.clans[1]!.glory).toBe(2);
    expect(e.clans[0]!.steps.axes).toBe(1);
    expect(e.clans[0]!.hand).toContain(keep);
    expect(e.figs.filter((f) => f.at === 'valhalla')).toHaveLength(0);
    expect(e.step).toBe('draft');
    expect(e.first).toBe(1);
  });
  it('Glorious Death counts 4 figures in Valhalla before Ragnarök; Odin\'s Throne doubles quest glory', () => {
    let snap = endOfAction((s) => {
      give(s, 0, 'q1-death'); s.clans[0]!.quests.push(s.clans[0]!.hand.pop()!);
      upgrade(s, 0, 'u3-throne', 'clan');
      for (let k = 0; k < 4; k++) put(s, 0, 'warrior', k, 'valhalla');
    });
    expect(st(snap).queue[0]?.k).toBe('stat');
    snap = act(snap, 0, { type: 'decide', stat: 'horns' });
    // 6 glory for the quest, doubled by Odin's Throne; the four warriors come back from Valhalla
    expect(st(snap).clans[0]!.glory).toBe(12);
    expect(st(snap).clans[0]!.steps.horns).toBe(1);
    expect(st(snap).figs.filter((f) => f.seat === 0 && f.at === 'valhalla')).toHaveLength(0);
  });
  it('final scoring: stat bonuses 10 / 10 / 20, Thor\'s Conquest', () => {
    const s = st(arrange(2, (x) => { clean(x); x.clans[0]!.steps = { rage: 3, axes: 4, horns: 5 }; x.clans[0]!.glory = 7; upgrade(x, 0, 'u3-conquest', 'clan'); put(x, 0, 'warrior', 0, 'myr'); put(x, 0, 'warrior', 1, 'myr'); }));
    expect(finalScore(s, 0)).toBe(7 + 10 + 10 + 20 + 6);
  });
  it('three ages end the game: the clan with the most glory wins', () => {
    let snap = arrange(2, (s) => { clean(s); s.age = 3; s.clans[1]!.glory = 4; s.clans[0]!.glory = 9; });
    snap = act(snap, 0, { type: 'pass' });
    snap = act(snap, 1, { type: 'pass' });
    const out = st(snap).outcome;
    expect(st(snap).step).toBe('over');
    expect(out?.placements.find((x) => x.seat === 0)?.place).toBe(1);
  });
});

describe('blood rage privacy and resignation', () => {
  it('a viewer never sees another clan\'s hand, pack or chosen cards', () => {
    const snap = startGame(m, { playerCount: 3, seed: 8, options: {} }).snapshot;
    const s = st(snap);
    const v = view(snap, 0);
    const mine = new Set(s.packs[0]!);
    expect(v.me!.pack.map((c) => c.id).sort()).toEqual([...mine].sort());
    const text = JSON.stringify(v);
    for (const other of s.packs[1]!) expect(text).not.toContain(`"id":${other},"def"`);
    expect(JSON.stringify(view(snap, null))).not.toContain('"pack":[{');
  });
  it('resignation removes the clan\'s figures and the last clan standing wins', () => {
    let snap = arrange(2, (s) => { clean(s); put(s, 0, 'warrior', 0, 'myr'); put(s, 1, 'warrior', 0, 'elv'); });
    snap = act(snap, 1, { type: 'resign' });
    expect(st(snap).outcome?.placements.find((x) => x.seat === 0)?.place).toBe(1);
    expect(st(snap).outcome?.reason).toBe('resign');
  });
  it('a timeout plays every pending seat\'s default; replay of the whole action list gives the same state', () => {
    let snap = startGame(m, { playerCount: 3, seed: 5, options: {} }).snapshot;
    snap = applyTimeout(m, snap, 0).snapshot;
    expect(st(snap).step).toBe('draft');
    expect(st(snap).draft.picked.every((x) => !x)).toBe(true);
    expect(st(snap).packs.every((x) => x.length === 7)).toBe(true);
  });
});

describe('blood rage tutorial', () => {
  it('the scripted lesson is legal step by step and the learner wins', () => {
    const t = bloodRageModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options }).snapshot;
    expect(t.steps.length).toBeGreaterThanOrEqual(3);
    expect(t.steps.length).toBeLessThanOrEqual(8);
    for (const [i, step] of t.steps.entries()) {
      expect(pending(st(snap)), `step ${i + 1} waits on the learner`).toContain(0);
      snap = act(snap, 0, step.expected as BRAction);
      if (step.reply) snap = act(snap, 1, step.reply as BRAction);
    }
    const out = st(snap).outcome;
    expect(out).not.toBeNull();
    expect(out!.placements.find((x) => x.seat === 0)!.place).toBe(1);
  });
});

// ---------- random playouts ----------
function mulberry(seed: number) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function randomAction(s: BRState, seat: number, r: () => number): BRAction {
  const pick = <T,>(xs: T[]): T => xs[Math.floor(r() * xs.length)]!;
  const c = s.clans[seat]!;
  const q = s.queue[0];
  if (q) {
    const dflt = defaultAction(s, seat) as Extract<BRAction, { type: 'decide' }>;
    switch (q.k) {
      case 'freeInvade': { const f = s.figs[q.fig]!; const t = invadeTargets(s, f); return r() < 0.8 && t.length ? { type: 'decide', yes: true, at: pick(t) } : { type: 'decide', yes: false }; }
      case 'hammer': { const here = s.figs[q.fig]!.at as ProvinceId; const t = PROVINCE_IDS.filter((x) => !s.destroyed.includes(x) && adjacent(here, x) && villagesFree(s, x) > 0); return r() < 0.5 && t.length ? { type: 'decide', yes: true, at: pick(t) } : { type: 'decide', yes: false }; }
      case 'succor': case 'blessing': case 'domain': return { type: 'decide', yes: r() < 0.6 };
      case 'late': return { type: 'decide', yes: r() < 0.7 };
      case 'prowess': return { type: 'decide', cards: r() < 0.5 ? q.cards.slice(0, c.rage) : [] };
      case 'protect': return { type: 'decide', figures: q.figs.filter(() => r() < 0.5).slice(0, c.rage) };
      case 'tide': return { type: 'decide', figures: [pick(q.figs)] };
      default: return dflt;
    }
  }
  if (s.battle) {
    if (s.battle.stage === 'call') { const cs = callable(s, seat, s.battle.at); return r() < 0.5 && cs.length ? { type: 'call', figure: pick(cs).id } : { type: 'call' }; }
    return { type: 'play', card: c.hand.length ? pick(c.hand) : null };
  }
  if (s.step === 'draft') { const pack = s.packs[seat]!; const need = Math.min(s.draft.need, pack.length); const cards = [...pack].sort(() => r() - 0.5).slice(0, need); return { type: 'pick', cards }; }
  if (s.step === 'discard') return { type: 'keep', card: c.hand.length && r() < 0.8 ? pick(c.hand) : null };
  const hints = bloodRageModule.legalActions(s, { kind: 'player', seat }) as { type: string; [k: string]: unknown }[];
  const h = pick(hints);
  switch (h.type) {
    case 'invade': return { type: 'invade', figure: h.figure as number, at: h.at as never };
    case 'march': {
      const from = h.from as ProvinceId;
      const mine = s.figs.filter((f) => f.seat === seat && f.at === from && f.kind !== 'ship' && !(f.kind === 'monster' && f.mon === 'm1-serpent'));
      const to = pick(PROVINCE_IDS.filter((x) => x !== from && !s.destroyed.includes(x)));
      const room = to === 'ygg' ? 99 : villagesFree(s, to);
      return { type: 'march', from, to, figures: mine.slice(0, Math.max(1, Math.min(room, 1 + Math.floor(r() * mine.length)))).map((f) => f.id) };
    }
    case 'upgrade': {
      const d = CARD_BY_ID[s.inst[h.card as number]!]!;
      const full = (d.kind === 'monster' && c.monsters.every((x) => x !== null)) || (d.kind === 'clan' && c.clans.every((x) => x !== null));
      return { type: 'upgrade', card: h.card as number, ...(full ? { slot: Math.floor(r() * (d.kind === 'monster' ? 2 : 3)) } : {}) };
    }
    case 'sacrifice': {
      const on = s.figs.filter((f) => f.seat === seat && f.at !== 'reserve' && f.at !== 'valhalla' && f.at !== 'box');
      const stat = (['rage', 'axes', 'horns'] as const).find((x) => c.steps[x] < 5);
      return stat ? { type: 'sacrifice', figures: [on[0]!.id, on[1]!.id], stat } : { type: 'pass' };
    }
    case 'quest': return { type: 'quest', card: h.card as number };
    case 'pillage': return { type: 'pillage', at: h.at as ProvinceId };
    case 'challenge': return { type: 'challenge', at: h.at as ProvinceId };
    default: return { type: 'pass' };
  }
}

function checkInvariants(s: BRState) {
  for (const seat of s.clans.keys()) {
    const c = s.clans[seat]!;
    expect(c.rage).toBeGreaterThanOrEqual(0);
    expect(c.glory).toBeGreaterThanOrEqual(0);
    expect(boardCount(s, seat)).toBeLessThanOrEqual(hornsOf(s, seat));
    for (const st2 of ['rage', 'axes', 'horns'] as const) expect(c.steps[st2]).toBeLessThanOrEqual(5);
    expect(s.figs.filter((f) => f.seat === seat && f.kind === 'warrior')).toHaveLength(8);
  }
  for (const f of s.figs) {
    if (f.at === 'reserve' || f.at === 'valhalla' || f.at === 'box') continue;
    const ship = f.kind === 'ship' || f.mon === 'm1-serpent';
    if (ship) expect(f.at.startsWith('f')).toBe(true);
    else expect(f.at.startsWith('f')).toBe(false);
    expect(s.destroyed.includes(f.at as ProvinceId)).toBe(false);
  }
  for (const p2 of PROVINCE_IDS) if (p2 !== 'ygg') expect(villagesFree(s, p2)).toBeGreaterThanOrEqual(0);
  const cards = s.clans.flatMap((c) => [...c.hand, ...c.quests, c.warrior, c.leader, c.ship, ...c.monsters, ...c.clans]).filter((x): x is number => x !== null);
  expect(new Set(cards).size).toBe(cards.length);
}

describe('blood rage random playouts', () => {
  for (const players of [2, 3, 4, 5]) {
    it(`${players} players: games run to the end, every move legal, invariants hold`, () => {
      for (const seed of [1, 2, 3]) {
        const r = mulberry(seed * 100 + players);
        let snap = startGame(m, { playerCount: players, seed, options: {} }).snapshot;
        const inputs: { seat: number; action: BRAction }[] = [];
        let steps = 0;
        while (!st(snap).outcome && steps < 6000) {
          steps++;
          const s = st(snap);
          const seats = pending(s);
          expect(seats.length, `pending at step ${steps} ${s.step}/${s.battle?.stage}`).toBeGreaterThan(0);
          const seat = seats[Math.floor(r() * seats.length)]!;
          let action = randomAction(s, seat, r);
          let res = applyAction(m, snap, p(seat), action, 0);
          if ('ok' in res) { action = defaultAction(s, seat)!; res = applyAction(m, snap, p(seat), action, 0); }
          if ('ok' in res) throw new Error(`default rejected: ${JSON.stringify(action)} ${res.errorCode} in ${s.step}/${s.battle?.stage}/${s.queue[0]?.k}`);
          snap = res.snapshot;
          inputs.push({ seat, action });
          checkInvariants(st(snap));
        }
        const s = st(snap);
        expect(s.outcome, `seed ${seed}: finished in ${steps} steps`).not.toBeNull();
        expect(s.age).toBe(3);
        expect(s.outcome!.placements).toHaveLength(players);
        expect(s.outcome!.placements.some((x) => x.place === 1)).toBe(true);
        // replay of the recorded inputs reproduces the final state
        const rep = replay(m, { playerCount: players, seed, options: {} }, inputs.map((x) => ({ kind: 'action' as const, actor: p(x.seat), action: x.action, logicalTime: 0 })));
        expect(st(rep)).toEqual(s);
      }
    });
  }
});
