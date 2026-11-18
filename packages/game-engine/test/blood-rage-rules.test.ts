// Blood Rage: RULES.md «تفاوت موتور با دفترچه» (E1–E16) and content.json numbers, one test per item.
import { describe, expect, it } from 'vitest';
import {
  ageDeck, bloodRageCore, callable, content, finalScore, FJORDS, PROVINCES, RING, invadeTargets, pending, publicSummary, TRACKS,
  type BRAction, type BRState, type Figure
} from '@bg/game-blood-rage';
import { applyAction, applyTimeout, startGame, type EngineSnapshot } from '../src/index.ts';

const m = bloodRageCore as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (snap: EngineSnapshot) => snap.state as BRState;
function act(snap: EngineSnapshot, seat: number, action: BRAction): EngineSnapshot {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
}
const reject = (snap: EngineSnapshot, seat: number, action: BRAction) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
function arrange(players: number, edit: (s: BRState) => void, options: Record<string, unknown> = {}): EngineSnapshot {
  const snap = startGame(m, { playerCount: players, seed: 3, options }).snapshot;
  const s = structuredClone(st(snap));
  edit(s);
  return { ...snap, state: s };
}
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
const upgrade = (s: BRState, seat: number, def: string, slot: 'warrior' | 'leader' | 'ship' | 'clan') => {
  s.inst.push(def);
  const i = s.inst.length - 1;
  const c = s.clans[seat]!;
  if (slot === 'clan') c.clans[c.clans.indexOf(null)] = i; else c[slot] = i;
  return i;
};
const hand0 = (snap: EngineSnapshot, seat: number) => st(snap).clans[seat]!.hand[0]!;

describe('blood rage content.json numbers', () => {
  it('the engine board and decks match content.json (villages, fjords, copies per player count)', () => {
    content.PROVINCES.slice(1).forEach((cp, i) => expect(PROVINCES[RING[i]!].villages).toBe(cp.villages!.length));
    content.FJORDS.forEach((cf, i) => expect(FJORDS[`f${i + 1}` as keyof typeof FJORDS]).toEqual(cf.supports.map((n) => RING[n - 1])));
    for (const n of [2, 3, 4, 5]) for (const age of [1, 2, 3] as const) {
      const fromContent = content.CARDS.filter((c) => c.age === age && c.minPlayers <= n).map((c) => c.def).sort();
      expect(ageDeck(age, n).sort()).toEqual(fromContent);
    }
  });
  it('stat tracks, base strength and pillage tokens follow content.json', () => {
    expect(TRACKS).toEqual({ rage: [6, 7, 8, 9, 12, 12], axes: [3, 4, 5, 6, 8, 8], horns: [4, 5, 6, 7, 10, 10] });
    const s = st(startGame(m, { playerCount: 4, seed: 9, options: {} }).snapshot);
    const outer = Object.entries(s.rewards).filter(([p]) => p !== 'ygg').map(([, r]) => r).sort();
    expect(outer).toEqual(['axes', 'axes', 'glory', 'horns', 'horns', 'rage', 'rage', 'rage']);
  });
});

describe('blood rage RULES.md engine differences', () => {
  it('E1: the pillage axe reward counts for the battle glory (axes 3→4, then 4 glory)', () => {
    let snap = arrange(2, (s) => {
      clean(s); s.rewards.elv = 'axes';
      put(s, 0, 'leader', 0, 'elv'); put(s, 1, 'warrior', 0, 'elv');
      give(s, 0, 'b1-bash'); give(s, 1, 'b1-trickery');
    });
    snap = act(snap, 0, { type: 'pillage', at: 'elv' });
    snap = act(snap, 0, { type: 'play', card: hand0(snap, 0) });
    snap = act(snap, 1, { type: 'play', card: hand0(snap, 1) });
    expect(st(snap).clans[0]!.steps.axes).toBe(1);
    expect(st(snap).clans[0]!.glory).toBe(4);
  });

  it('E2: Ragnarök kills the fjord figures but the fjord keeps supporting its other province; ships need a living province', () => {
    let snap = arrange(2, (s) => {
      clean(s); s.ragnarok = ['elv', 'hor', 'mus'];
      put(s, 0, 'ship', 0, 'f1'); // f1 supports elv + ang
    });
    snap = act(snap, 0, { type: 'pass' });
    snap = act(snap, 1, { type: 'pass' });
    const s = st(snap);
    expect(s.destroyed).toContain('elv');
    expect(fig(s, 0, 'ship').at).not.toBe('f1');
    // f1 still supports ang: a ship may invade it
    expect(invadeTargets(s, fig(s, 0, 'ship'))).toContain('f1');
    const both = { ...s, destroyed: ['elv', 'ang'] as BRState['destroyed'] };
    expect(invadeTargets(both, fig(s, 0, 'ship'))).not.toContain('f1');
  });

  it('E3: no march into a destroyed province, and no calling from or into one', () => {
    const snap = arrange(2, (s) => { clean(s); s.destroyed = ['elv']; put(s, 0, 'warrior', 0, 'myr'); });
    expect(reject(snap, 0, { type: 'march', from: 'myr', to: 'elv', figures: [fig(st(snap), 0, 'warrior').id] })).toBe('BR_BAD_PLACE');
    expect(reject(snap, 0, { type: 'pillage', at: 'elv' })).toBe('BR_BAD_PLACE');
    // a battle next door never calls a figure through the destroyed province
    expect(bloodRageCore.legalActions(st(snap), p(0)).some((h) => h.type === 'march' && (h as { from?: string }).from === 'elv')).toBe(false);
  });

  it('E4: a battle card is mandatory, an empty hand is not asked, a timed-out card is a random card from the hand', () => {
    let snap = arrange(3, (s) => {
      clean(s);
      put(s, 0, 'leader', 0, 'elv'); put(s, 1, 'warrior', 0, 'elv'); put(s, 2, 'warrior', 0, 'elv');
      give(s, 0, 'b1-bash'); give(s, 1, 'b1-smash', 'q1-man');
    });
    snap = act(snap, 0, { type: 'pillage', at: 'elv' });
    expect(st(snap).battle?.stage).toBe('cards');
    expect(pending(st(snap)).sort()).toEqual([0, 1]);
    expect(reject(snap, 0, { type: 'play', card: null })).toBe('BR_MUST_PLAY');
    snap = act(snap, 0, { type: 'play', card: hand0(snap, 0) });
    const before = [...st(snap).clans[1]!.hand];
    snap = applyTimeout(m, snap, 0).snapshot;
    const b = st(snap);
    // seat 1 played one of its own cards (lost: it went back to the hand), seat 2 fought without a card
    expect(b.battle).toBeNull();
    expect(b.clans[1]!.hand.sort()).toEqual(before.sort());
    expect(b.timeouts?.[1]).toBe(1);
  });

  it('E5: «pass for this whole battle» only with 2 or more callable figures, and it skips the seat for the rest of the battle', () => {
    let snap = arrange(3, (s) => {
      clean(s);
      put(s, 0, 'leader', 0, 'elv'); put(s, 1, 'warrior', 0, 'elv');
      put(s, 1, 'warrior', 1, 'myr'); put(s, 1, 'warrior', 2, 'myr');
      put(s, 2, 'warrior', 0, 'ang');
      give(s, 0, 'b1-bash');
    });
    snap = act(snap, 0, { type: 'pillage', at: 'elv' });
    expect(pending(st(snap))).toEqual([1]);
    const hints = bloodRageCore.legalActions(st(snap), p(1));
    expect(hints).toContainEqual({ type: 'call', all: true });
    snap = act(snap, 1, { type: 'call', all: true });
    expect(pending(st(snap))).toEqual([2]);
    expect(bloodRageCore.legalActions(st(snap), p(2))).not.toContainEqual({ type: 'call', all: true });
    expect(reject(snap, 2, { type: 'call', all: true })).toBe('BR_BAD_CALL');
    snap = act(snap, 2, { type: 'call', figure: fig(st(snap), 2, 'warrior').id });
    // round 2: seat 1 is out for this battle; seat 0 has nothing to call → straight to the cards
    expect(st(snap).battle?.stage).toBe('cards');
    expect(fig(st(snap), 1, 'warrior', 1).at).toBe('myr');
  });

  it('E7: a clan whose figures all died before the comparison is still in the battle and can win with its card', () => {
    let snap = arrange(2, (s) => {
      clean(s);
      put(s, 0, 'leader', 0, 'elv'); put(s, 1, 'warrior', 0, 'elv');
      give(s, 0, 'b1-smite'); give(s, 1, 'b1-tsmite');
    });
    snap = act(snap, 0, { type: 'pillage', at: 'elv' });
    snap = act(snap, 0, { type: 'play', card: hand0(snap, 0) });
    snap = act(snap, 1, { type: 'play', card: hand0(snap, 1) });
    // seat 1's only warrior died to Smite: 0 + 5 = 5 beats leader 3 + Smite 1 = 4
    const s = st(snap);
    expect(s.clans[1]!.glory).toBe(3);
    expect(fig(s, 0, 'leader').at).toBe('valhalla');
    expect(s.pillaged).toEqual([]);
  });

  it('E8: a rage pillage reward raises the stat, not this phase\'s rage', () => {
    let snap = arrange(2, (s) => { clean(s); s.rewards.myr = 'rage'; put(s, 0, 'leader', 0, 'myr'); });
    snap = act(snap, 0, { type: 'pillage', at: 'myr' });
    expect(st(snap).clans[0]!.steps.rage).toBe(1);
    expect(st(snap).clans[0]!.rage).toBe(6);
  });

  it('E9: two upgrades of the same kind in different slots both count (Loki\'s Domain + Eminence = 3 per figure)', () => {
    let snap = arrange(2, (s) => {
      clean(s);
      upgrade(s, 0, 'u1-lokidomain', 'clan'); upgrade(s, 0, 'u2-eminence', 'clan');
      put(s, 0, 'warrior', 0, 'valhalla'); put(s, 0, 'warrior', 1, 'valhalla');
    });
    snap = act(snap, 0, { type: 'pass' });
    snap = act(snap, 1, { type: 'pass' });
    expect(st(snap).clans[0]!.glory).toBe(6);
  });

  it('E10: raising a stat at the last step is refused', () => {
    const snap = arrange(2, (s) => { clean(s); s.clans[0]!.steps.rage = 5; s.queue = [{ k: 'stat', seat: 0 }]; });
    expect(reject(snap, 0, { type: 'decide', stat: 'rage' })).toBe('BR_STAT_MAX');
    expect(reject(snap, 0, { type: 'decide', stat: 'axes' })).toBe('ACCEPTED');
  });

  it('E12: every seat gets a different clan 1–5', () => {
    for (const n of [2, 3, 4, 5]) {
      const ids = st(startGame(m, { playerCount: n, seed: n, options: {} }).snapshot).clans.map((c) => c.clan);
      expect(new Set(ids).size).toBe(n);
      expect(ids.every((x) => x >= 1 && x <= 5)).toBe(true);
    }
  });

  it('E13: draftMode noDraft deals 6 cards in every Age and starts the Action phase', () => {
    const s = st(startGame(m, { playerCount: 3, seed: 4, options: { draftMode: 'noDraft' } }).snapshot);
    expect(s.step).toBe('action');
    expect(s.clans.map((c) => c.hand.length)).toEqual([6, 6, 6]);
    expect(st(startGame(m, { playerCount: 3, seed: 4, options: {} }).snapshot).step).toBe('draft');
  });

  it('E14: invading costs the current STR (Experts in Arms: 2) and the free invasion keeps the Horns limit', () => {
    let snap = arrange(2, (s) => { clean(s); upgrade(s, 0, 'w2-experts', 'warrior'); });
    snap = act(snap, 0, { type: 'invade', figure: fig(st(snap), 0, 'warrior').id, at: 'myr' });
    expect(st(snap).clans[0]!.rage).toBe(4);
    // 4 figures on the map = Horns 4: an upgrade gives no free invasion
    let full = arrange(2, (s) => {
      clean(s);
      for (let k = 0; k < 4; k++) put(s, 0, 'warrior', k, 'gim');
      give(s, 0, 'l1-hammers');
    });
    full = act(full, 0, { type: 'upgrade', card: hand0(full, 0) });
    expect(st(full).queue).toEqual([]);
  });

  it('E15: a resigned clan in a 3-player game stays on the map, is never called and loses its battles', () => {
    let snap = arrange(3, (s) => {
      clean(s);
      put(s, 0, 'warrior', 0, 'elv'); put(s, 1, 'leader', 0, 'elv'); put(s, 1, 'warrior', 0, 'elv');
      put(s, 1, 'warrior', 1, 'myr');
    });
    snap = act(snap, 1, { type: 'resign' });
    expect(st(snap).outcome).toBeNull();
    expect(fig(st(snap), 1, 'leader').at).toBe('elv');
    expect(callable(st(snap), 1, 'elv')).toEqual([]);
    snap = act(snap, 0, { type: 'pillage', at: 'elv' });
    const s = st(snap);
    // seat 1 (STR 4) cannot win against seat 0 (STR 1): it is destroyed, seat 0 pillages
    expect(fig(s, 1, 'leader').at).toBe('valhalla');
    expect(s.pillaged).toContain('elv');
  });

  it('E16: an action timeout skips the turn, keeps the rage, counts a strike; the third strike removes the clan', () => {
    let snap = arrange(3, (s) => clean(s));
    snap = applyTimeout(m, snap, 0).snapshot;
    expect(st(snap).turn).toBe(1);
    expect(st(snap).clans[0]!.rage).toBe(6);
    expect(st(snap).clans[0]!.passed).toBe(false);
    expect(publicSummary(st(snap)).seats[0]!.strikes).toBe(1);
    const s = structuredClone(st(snap));
    s.timeouts = [2, 0, 0]; s.turn = 0;
    snap = applyTimeout(m, { ...snap, state: s }, 0).snapshot;
    expect(st(snap).clans[0]!.resigned).not.toBeNull();
  });

  it('publicSummary: ENGINE §9 stats (rage, cards, map, quests) and phase/doom', () => {
    const s = st(arrange(2, (x) => { clean(x); put(x, 0, 'warrior', 0, 'myr'); }));
    const seat0 = publicSummary(s).seats[0]!;
    expect(seat0.stats!.map((x) => x.key)).toEqual(['rage', 'cards', 'map', 'quests']);
    expect(seat0.stats![2]!.value).toBe('1/4');
    expect(publicSummary(s).shared!.map((x) => x.key)).toEqual(['age', 'phase', 'doom']);
    expect(finalScore(s, 0)).toBe(0);
  });
});
