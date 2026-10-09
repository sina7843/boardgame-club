import { describe, expect, it } from 'vitest';
import { autoPlan, heatModule, finishOrder, freeSpot, gearOptions, raceOrder, trackOf, RACE_POINTS, type Card, type HeatState, type HeatView, type Racer } from '@bg/game-heat';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type ReplayInput, type StepResult } from '../src/index.ts';

const m = heatModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as HeatState;
const game = (players = 2, seed = 1, options: Record<string, unknown> = {}) => startGame(m, { playerCount: players, seed, options }).snapshot;
const view = (snap: EngineSnapshot, seat: number | null) => projectFor(m, snap, seat === null ? { kind: 'spectator' } : p(seat)).view as HeatView;
const hints = (snap: EngineSnapshot, seat: number) => projectFor(m, snap, p(seat)).legalActions;
const step = (snap: EngineSnapshot, seat: number, action: unknown): StepResult => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r;
};
const act = (snap: EngineSnapshot, seat: number, action: unknown) => step(snap, seat, action).snapshot;
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const before = JSON.stringify(snap);
  const r = applyAction(m, snap, p(seat), action, 0);
  expect(JSON.stringify(snap)).toBe(before);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
let nid = 5000;
const sp = (v: number): Card => ({ id: nid++, k: 'speed', v });
const heatCard = (): Card => ({ id: nid++, k: 'heat' });
const stress = (): Card => ({ id: nid++, k: 'stress' });
/** Put a racer in a known spot with a known hand/deck. */
function rig(s: HeatState, seat: number, o: Partial<Racer> & { hand?: Card[] }) {
  Object.assign(s.racers[seat]!, o);
}
const noReact = { type: 'react', adrenaline: false, slipstream: false, discard: [] };
const cardsOf = (r: Racer, n: number) => r.hand.filter((c) => c.k !== 'heat').slice(0, n).map((c) => c.id).sort((a, b) => a - b);
/** A two-player race on the USA track, positions/hands rigged; seat 0 ahead unless told otherwise. */
function rigged(setup: (s: HeatState) => void, players = 2, options: Record<string, unknown> = {}) {
  const snap = game(players, 3, options);
  setup(st(snap));
  return snap;
}

describe('heat setup', () => {
  it('2–6 players: 15-card decks plus track stress, engine heat, grid two per space, gear 1, 7 cards', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const s = st(game(n, 10 + n));
      expect(s.phase).toBe('plan');
      expect(s.tracks).toEqual(['usa']);
      expect([...s.grid].sort()).toEqual([...Array(n).keys()]);
      s.grid.forEach((seat, i) => {
        const r = s.racers[seat]!;
        expect(r).toMatchObject({ gear: 1, pos: -1 - Math.floor(i / 2), lane: i % 2 });
        expect(r.hand).toHaveLength(7);
        expect(r.hand.length + r.deck.length).toBe(15 + 3);
        expect(r.engine).toHaveLength(6);
        expect([...r.hand, ...r.deck].filter((c) => c.k === 'stress')).toHaveLength(3);
        expect([...r.hand, ...r.deck].filter((c) => c.k === 'heat')).toHaveLength(1);
        expect([...r.hand, ...r.deck].filter((c) => c.k === 'speed').map((c) => c.v).sort()).toEqual([0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5]);
      });
      expect(heatModule.pendingSeats(s)).toEqual([...Array(n).keys()]);
    }
    expect(() => game(1)).toThrow();
    expect(() => game(7)).toThrow();
  });

  it('track, laps and championship options; corners at the bends with their limits', () => {
    const s = st(game(3, 1, { track: 'france', laps: 3, races: 3 }));
    expect(s.track).toBe('france');
    expect(s.laps).toBe(3);
    expect(s.tracks).toEqual(['france', 'gb', 'usa']);
    expect(s.racers[0]!.engine).toHaveLength(5);
    expect([...s.racers[0]!.hand, ...s.racers[0]!.deck].filter((c) => c.k === 'stress')).toHaveLength(4);
    expect(trackOf('usa').corners).toEqual([{ at: 10, limit: 5 }, { at: 18, limit: 4 }, { at: 26, limit: 3 }, { at: 36, limit: 6 }, { at: 45, limit: 4 }]);
    expect(trackOf('italy').corners.map((c) => c.limit)).toEqual([4, 3, 6, 2, 5]);
    expect(trackOf('gb').length).toBe(60);
    // unknown option values fall back to the standard rules
    expect(st(game(2, 1, { track: 'mars', laps: 9, races: 0 }))).toMatchObject({ track: 'usa', laps: 2, tracks: ['usa'] });
  });

  it('setup is deterministic per seed', () => {
    expect(game(4, 99)).toEqual(game(4, 99));
    expect(st(game(4, 99)).grid).not.toEqual(st(game(4, 98)).grid.length ? null : []);
  });
});

describe('heat planning (simultaneous, hidden)', () => {
  it('gear shifts: ±1 free, ±2 costs one Heat, never beyond the playable card count', () => {
    const snap = rigged((s) => {
      rig(s, 0, { gear: 2, hand: [sp(1), sp(2), sp(3), sp(4), heatCard(), heatCard(), heatCard()] });
    });
    const r = st(snap).racers[0]!;
    expect(gearOptions(r)).toEqual([{ gear: 1, cost: 0 }, { gear: 2, cost: 0 }, { gear: 3, cost: 0 }, { gear: 4, cost: 1 }]);
    r.hand = [sp(1), sp(2), heatCard(), heatCard(), heatCard(), heatCard(), heatCard()];
    r.gear = 4;
    expect(gearOptions(r)).toEqual([{ gear: 2, cost: 1 }]);
    r.engine = [];
    expect(gearOptions(r)).toEqual([{ gear: 2, cost: 0 }]); // forced free downshift
    r.hand = Array.from({ length: 7 }, heatCard);
    expect(gearOptions(r)).toEqual([{ gear: 1, cost: 0 }]); // nothing playable: one card at speed 0
  });

  it('illegal plans are rejected without mutating', () => {
    const snap = game(2, 4);
    const r = st(snap).racers[0]!;
    const h = r.hand.filter((c) => c.k !== 'heat').map((c) => c.id);
    expect(reject(snap, 0, { type: 'plan', gear: 2, cards: [h[0]] })).toBe('WRONG_CARD_COUNT');
    expect(reject(snap, 0, { type: 'plan', gear: 4, cards: h.slice(0, 4) })).toBe('GEAR_NOT_ALLOWED'); // 1 → 4
    expect(reject(snap, 0, { type: 'plan', gear: 1, cards: [99999] })).toBe('NO_SUCH_CARD');
    expect(reject(snap, 0, { type: 'plan', gear: 2, cards: [h[0], h[0]] })).toBe('NO_SUCH_CARD');
    expect(reject(snap, 0, { type: 'plan', gear: 1, cards: [st(snap).racers[1]!.hand[0]!.id] })).toBe('NO_SUCH_CARD');
    expect(reject(snap, 0, { type: 'plan', gear: 5, cards: [] })).toBe('INVALID_ACTION');
    expect(reject(snap, 0, { type: 'boost' })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, 0, noReact)).toBe('NOT_YOUR_TURN');
    expect(reject(snap, 0, { type: 'pick', card: 1 })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, 2, { type: 'plan', gear: 1, cards: [h[0]] })).toBe('NOT_A_PLAYER');
    const withHeat = rigged((s) => rig(s, 0, { hand: [sp(1), sp(2), heatCard(), sp(3), sp(4), sp(1), sp(2)] }));
    const hc = st(withHeat).racers[0]!.hand[2]!.id;
    expect(reject(withHeat, 0, { type: 'plan', gear: 1, cards: [hc] })).toBe('HEAT_NOT_PLAYABLE');
    const once = act(snap, 0, { type: 'plan', gear: 1, cards: [h[0]] });
    expect(reject(once, 0, { type: 'plan', gear: 1, cards: [h[1]] })).toBe('ALREADY_COMMITTED');
  });

  it('a plan stays secret (from opponents, spectators, legal hints) until the car is revealed', () => {
    const snap0 = game(3, 5);
    const s0 = st(snap0);
    const mine = cardsOf(s0.racers[0]!, 2);
    const r = step(snap0, 0, { type: 'plan', gear: 2, cards: mine });
    expect(r.scheduleChanges).toEqual([]);
    expect(heatModule.pendingSeats(st(r.snapshot))).toEqual([1, 2]);
    expect(view(r.snapshot, 0).me!.plan).toEqual({ gear: 2, cards: mine });
    for (const who of [1, 2, null]) {
      const v = view(r.snapshot, who);
      expect(v.racers[0]!.planned).toBe(true);
      expect(v.racers[0]!.gear).toBe(1); // the new gear is part of the secret plan
      expect(v.racers[0]!.played).toEqual([]);
      const json = JSON.stringify(v) + JSON.stringify(who === null ? [] : hints(r.snapshot, who));
      for (const id of s0.racers[0]!.hand.map((c) => c.id)) expect(json).not.toContain(`"id":${id},`);
      for (const c of s0.racers[0]!.deck) expect(json).not.toContain(`"id":${c.id},`);
      expect(json).not.toMatch(/"(deck|engine|supply|rng|plan)":\[/);
    }
    expect(view(r.snapshot, null).me).toBeNull();
    expect(view(r.snapshot, 1).me!.hand.map((c) => c.id)).toEqual(s0.racers[1]!.hand.map((c) => c.id));
  });
});

describe('heat resolution', () => {
  it('race order, reveal and move, two cars per space, stress flips, gear-2 shift heat', () => {
    let snap = rigged((s) => {
      rig(s, 0, { pos: 5, lane: 0, gear: 1, hand: [sp(2), stress(), sp(1), sp(1), sp(1), sp(1), sp(1)], deck: [heatCard(), sp(3), sp(4), sp(4), sp(4), sp(4)] });
      rig(s, 1, { pos: 4, lane: 0, gear: 2, hand: [sp(4), sp(3), sp(1), sp(1), sp(1), sp(1), sp(1)] });
    });
    const s = st(snap);
    const [a0, a1] = [s.racers[0]!.hand.map((c) => c.id), s.racers[1]!.hand.map((c) => c.id)];
    expect(raceOrder(s)).toEqual([0, 1]);
    snap = act(snap, 0, { type: 'plan', gear: 3, cards: [a0[0], a0[1], a0[2]].sort((x, y) => x! - y!) }); // 1 → 3 costs one Heat
    snap = act(snap, 1, { type: 'plan', gear: 2, cards: [a1[0], a1[1]].sort((x, y) => x! - y!) });
    let t = st(snap);
    expect(t.phase).toBe('react');
    expect(heatModule.pendingSeats(t)).toEqual([0]);
    const r0 = t.racers[0]!;
    expect(r0.engine).toHaveLength(5);
    expect(r0.discard.filter((c) => c.k === 'heat')).toHaveLength(2); // shift heat + the heat flipped by stress
    expect(r0.speed).toBe(2 + 3 + 1); // stress flipped heat (skipped) then a 3
    expect(r0.pos).toBe(11);
    const v = view(snap, 1);
    expect(v.racers[0]!.played.map((c) => c.k)).toEqual(['speed', 'stress', 'speed']);
    expect(v.racers[0]!.flips.map((c) => c.k)).toEqual(['heat', 'speed']);
    expect(v.racers[1]!.played).toEqual([]); // not revealed yet
    expect(v.current).toBe(0);
    snap = act(snap, 0, noReact);
    t = st(snap);
    expect(t.racers[1]!.pos).toBe(11); // 4 + 7 → shares space 11 on the outside lane
    expect(t.racers[1]!.lane).toBe(1);
    expect(t.racers[0]!.hand).toHaveLength(7);
    expect(t.racers[0]!.gear).toBe(3);
    // a third car aiming at a full space stops on the first free space behind it
    expect(freeSpot(t, 2, 11)).toEqual({ pos: 10, lane: 0 });
  });

  it('corners: speed above the limit costs Heat; without enough Heat the car spins out', () => {
    // USA corner at space 10 has limit 5.
    let snap = rigged((s) => {
      rig(s, 0, { pos: 6, lane: 0, gear: 2, hand: [sp(4), sp(4), sp(1), sp(1), sp(1), sp(1), sp(1)] });
      rig(s, 1, { pos: 2, lane: 0, gear: 2, hand: [sp(4), sp(4), sp(1), sp(1), sp(1), sp(1), sp(1)] });
    });
    const s = st(snap);
    snap = act(snap, 0, { type: 'plan', gear: 2, cards: s.racers[0]!.hand.slice(0, 2).map((c) => c.id) });
    snap = act(snap, 1, { type: 'plan', gear: 2, cards: s.racers[1]!.hand.slice(0, 2).map((c) => c.id) });
    snap = act(snap, 0, noReact);
    let t = st(snap);
    expect(t.racers[0]!.pos).toBe(14);
    expect(t.racers[0]!.engine).toHaveLength(3); // 8 − 5 = 3 Heat paid
    expect(t.log.some((e) => e.e === 'corner' && e.seat === 0 && e.n === 3)).toBe(true);
    // seat 1 has only 2 Heat left: 8 at a limit-5 corner spins out
    t.racers[1]!.engine = t.racers[1]!.engine.slice(0, 2);
    snap = act(snap, 1, noReact);
    t = st(snap);
    const r1 = t.racers[1]!;
    expect(r1.pos).toBe(9);
    expect(r1.gear).toBe(1);
    expect(r1.engine).toHaveLength(2); // nothing paid
    expect(r1.hand.filter((c) => c.k === 'stress').length).toBeGreaterThanOrEqual(1);
    expect(t.log.some((e) => e.e === 'spin' && e.seat === 1 && e.n === 1)).toBe(true);
  });

  it('spin-out in gear 3–4 adds two Stress', () => {
    let snap = rigged((s) => {
      rig(s, 0, { pos: 2, lane: 0, gear: 3, engine: [], hand: [sp(4), sp(4), sp(4), sp(1), sp(1), sp(1), sp(1)] });
      rig(s, 1, { pos: -5, lane: 0, gear: 1 });
    });
    const s = st(snap);
    snap = act(snap, 0, { type: 'plan', gear: 3, cards: s.racers[0]!.hand.slice(0, 3).map((c) => c.id) });
    snap = act(snap, 1, { type: 'plan', gear: 1, cards: cardsOf(s.racers[1]!, 1) });
    const before = st(snap).racers[0]!.hand.length;
    snap = act(snap, 0, noReact);
    const r = st(snap).racers[0]!;
    expect(r.pos).toBe(9);
    expect(r.gear).toBe(1);
    expect(st(snap).log.find((e) => e.e === 'spin')!.n).toBe(2);
    expect(before).toBe(4);
  });

  it('boost (1 Heat, flip to a speed card) counts for corners; adrenaline goes to the last car; slipstream +2 does not count', () => {
    let snap = rigged((s) => {
      rig(s, 0, { pos: 20, lane: 0, gear: 2, hand: [sp(1), sp(1), sp(1), sp(1), sp(1), sp(1), sp(1)], deck: [stress(), sp(3), sp(1), sp(1), sp(1), sp(1)] });
      rig(s, 1, { pos: 14, lane: 0, gear: 2, hand: [sp(2), sp(1), sp(1), sp(1), sp(1), sp(1), heatCard()] });
    });
    const s = st(snap);
    snap = act(snap, 0, { type: 'plan', gear: 2, cards: s.racers[0]!.hand.slice(0, 2).map((c) => c.id) });
    snap = act(snap, 1, { type: 'plan', gear: 2, cards: s.racers[1]!.hand.slice(0, 2).map((c) => c.id).sort((a, b) => a - b) });
    expect(st(snap).racers[1]!.adrenaline).toBe(true);
    expect(st(snap).racers[0]!.adrenaline).toBe(false);
    expect(reject(snap, 0, { type: 'react', adrenaline: true, slipstream: false, discard: [] })).toBe('NO_ADRENALINE');
    snap = act(snap, 0, { type: 'boost' });
    let t = st(snap);
    expect(t.racers[0]!).toMatchObject({ pos: 25, speed: 5, boosted: true });
    expect(t.racers[0]!.engine).toHaveLength(5);
    expect(reject(snap, 0, { type: 'boost' })).toBe('ALREADY_BOOSTED');
    // speed 5 across the corner at 26 (limit 3)? not reached yet (pos 25)
    snap = act(snap, 0, noReact);
    t = st(snap);
    expect(t.racers[0]!.pos).toBe(25);
    // seat 1: 14 + 3 = 17; adrenaline → 18; there is no car at 18/19, so no slipstream
    expect(hints(snap, 1).find((h) => h.type === 'react')).toMatchObject({ adrenaline: true, slip: false, slipAdrenaline: false, cooldown: 2 });
    expect(reject(snap, 1, { type: 'react', adrenaline: true, slipstream: true, discard: [] })).toBe('NO_SLIPSTREAM');
    snap = act(snap, 1, { type: 'react', adrenaline: true, slipstream: false, discard: [] });
    t = st(snap);
    // corner at 18 (limit 4): speed 3 + 1 adrenaline = 4 → free; cooldown 1 (gear 2) + 1 (adrenaline) returned the heat card
    expect(t.racers[1]!.pos).toBe(18);
    expect(t.racers[1]!.engine).toHaveLength(7);
    expect(t.log.some((e) => e.e === 'cool' && e.seat === 1 && e.n === 1)).toBe(true);
  });

  it('slipstream: sharing a space or directly behind gives +2 (not counted for corners)', () => {
    let snap = rigged((s) => {
      rig(s, 0, { pos: 30, lane: 0, gear: 1, hand: [sp(1), sp(1), sp(1), sp(1), sp(1), sp(1), sp(1)] });
      rig(s, 1, { pos: 28, lane: 0, gear: 2, hand: [sp(3), sp(3), sp(1), sp(1), sp(1), sp(1), sp(1)] });
    });
    const s = st(snap);
    snap = act(snap, 0, { type: 'plan', gear: 1, cards: [s.racers[0]!.hand[0]!.id] });
    snap = act(snap, 1, { type: 'plan', gear: 2, cards: s.racers[1]!.hand.slice(0, 2).map((c) => c.id) });
    snap = act(snap, 0, noReact); // 31
    // seat 1: 28 + 6 = 34 — no car near; rig: put it right behind seat 0 instead
    let t = st(snap);
    t.racers[1]!.pos = 30; t.racers[1]!.speed = 6; t.racers[1]!.start = 28;
    expect(hints(snap, 1).find((h) => h.type === 'react')).toMatchObject({ slip: true });
    snap = act(snap, 1, { type: 'react', adrenaline: false, slipstream: true, discard: [] });
    t = st(snap);
    expect(t.racers[1]!.pos).toBe(32);
    expect(t.log.some((e) => e.e === 'slip' && e.n === 2)).toBe(true);
  });

  it('discarding: any cards but Heat and Stress, then refill to 7', () => {
    let snap = rigged((s) => {
      rig(s, 0, { pos: 30, lane: 0, gear: 1, hand: [sp(1), sp(2), sp(3), stress(), heatCard(), sp(4), sp(4)] });
      rig(s, 1, { pos: 20, lane: 0, gear: 1 });
    });
    const s = st(snap);
    const h = s.racers[0]!.hand;
    snap = act(snap, 0, { type: 'plan', gear: 1, cards: [h[0]!.id] });
    snap = act(snap, 1, { type: 'plan', gear: 1, cards: cardsOf(s.racers[1]!, 1) });
    expect(reject(snap, 0, { type: 'react', adrenaline: false, slipstream: false, discard: [h[3]!.id] })).toBe('CANNOT_DISCARD');
    expect(reject(snap, 0, { type: 'react', adrenaline: false, slipstream: false, discard: [h[0]!.id] })).toBe('NO_SUCH_CARD');
    snap = act(snap, 0, { type: 'react', adrenaline: false, slipstream: false, discard: [h[1]!.id, h[2]!.id] });
    const r = st(snap).racers[0]!;
    expect(r.hand).toHaveLength(7);
    expect(r.discard.map((c) => c.id)).toEqual(expect.arrayContaining([h[0]!.id, h[1]!.id, h[2]!.id]));
    // gear 1 cooldown 3: the heat card went back to the engine
    expect(r.hand.some((c) => c.id === h[4]!.id)).toBe(false);
    expect(r.engine.some((c) => c.id === h[4]!.id)).toBe(true);
  });
});

describe('heat race end, championship, weather and garage', () => {
  it('finishing order: round, then distance beyond the line, then move order; points 9/6/…', () => {
    let snap = rigged((s) => {
      s.laps = 1;
      rig(s, 0, { pos: 52, lane: 0, gear: 2, hand: [sp(2), sp(1), sp(1), sp(1), sp(1), sp(1), sp(1)] });
      rig(s, 1, { pos: 51, lane: 0, gear: 2, hand: [sp(4), sp(4), sp(1), sp(1), sp(1), sp(1), sp(1)] });
      rig(s, 2, { pos: 40, lane: 0, gear: 1 });
    }, 3);
    const s = st(snap);
    snap = act(snap, 0, { type: 'plan', gear: 1, cards: [s.racers[0]!.hand[0]!.id] });
    snap = act(snap, 1, { type: 'plan', gear: 2, cards: s.racers[1]!.hand.slice(0, 2).map((c) => c.id) });
    snap = act(snap, 2, { type: 'plan', gear: 1, cards: cardsOf(s.racers[2]!, 1) });
    snap = act(snap, 0, noReact); // 54: on the line = finished, 0 beyond
    snap = act(snap, 1, noReact); // 59: 5 beyond → ahead of seat 0
    expect(st(snap).racers[0]!.finished).toMatchObject({ round: 1, over: 0 });
    expect(st(snap).racers[1]!.finished).toMatchObject({ round: 1, over: 5 });
    snap = act(snap, 2, noReact);
    expect(st(snap).outcome).toBeNull();
    expect(heatModule.pendingSeats(st(snap))).toEqual([2]); // only the car still racing plans
    expect(finishOrder(st(snap)).slice(0, 2)).toEqual([1, 0]);
    // let seat 2 crawl home by timeouts
    let guard = 0;
    while (!st(snap).outcome && guard++ < 200) snap = applyTimeout(m, snap, 0).snapshot;
    const out = st(snap).outcome!;
    expect(out.reason).toBe('score');
    expect(out.placements).toEqual([{ seat: 1, place: 1, score: 9 }, { seat: 0, place: 2, score: 6 }, { seat: 2, place: 3, score: 4 }]);
    expect(RACE_POINTS).toEqual([9, 6, 4, 3, 2, 1]);
  });

  it('championship: races on consecutive tracks, points add up, leader starts at the back, ties by last race', () => {
    let snap = game(2, 8, { races: 2, laps: 1, track: 'gb' });
    const s = st(snap);
    // seat 0 wins race 1 instantly
    s.racers[0]!.pos = 59; s.racers[1]!.pos = 10;
    let guard = 0;
    while (st(snap).race === 0 && guard++ < 300) snap = applyTimeout(m, snap, 0).snapshot;
    let t = st(snap);
    expect(t.race).toBe(1);
    expect(t.track).toBe('usa');
    expect(t.history[0]!.order[0]).toBe(0);
    expect(t.racers.map((r) => r.points)).toEqual([9, 6]);
    expect(t.grid).toEqual([1, 0]); // leader at the back
    expect(t.racers[0]!.hand).toHaveLength(7);
    expect(t.racers[0]!.pos).toBe(-1);
    t.racers[1]!.pos = 53; t.racers[0]!.pos = 5;
    guard = 0;
    while (!st(snap).outcome && guard++ < 300) snap = applyTimeout(m, snap, 0).snapshot;
    t = st(snap);
    // 9 + 6 = 15 each: tie broken by the last race (seat 1 won it)
    expect(t.outcome!.placements).toEqual([{ seat: 1, place: 1, score: 15 }, { seat: 0, place: 2, score: 15 }]);
  });

  it('weather and road conditions change setup and the turn', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      const s = st(game(2, seed, { weather: true }));
      seen.add(s.weather!);
      expect(s.road).toHaveLength(5);
      expect(s.road.every((x) => ['up', 'down', 'overheat', 'slip'].includes(x!))).toBe(true);
      const r = s.racers[0]!;
      const all = [...r.hand, ...r.deck];
      if (s.weather === 'sun') expect(r.engine).toHaveLength(7);
      if (s.weather === 'cold') expect(r.engine).toHaveLength(5);
      if (s.weather === 'rain') expect(all.filter((c) => c.k === 'stress')).toHaveLength(4);
      if (s.weather === 'heatwave') expect(all.filter((c) => c.k === 'heat')).toHaveLength(2);
    }
    expect(seen.size).toBe(5);
    // fog: no slipstream; road "down" lowers a limit, "overheat" adds one Heat
    let snap = rigged((s) => {
      s.weather = 'fog'; s.road = ['overheat', null, null, null, null];
      rig(s, 0, { pos: 6, lane: 0, gear: 2, hand: [sp(4), sp(3), sp(1), sp(1), sp(1), sp(1), sp(1)] });
      rig(s, 1, { pos: 5, lane: 0, gear: 2, hand: [sp(4), sp(3), sp(1), sp(1), sp(1), sp(1), sp(1)] });
    });
    const s = st(snap);
    snap = act(snap, 0, { type: 'plan', gear: 2, cards: s.racers[0]!.hand.slice(0, 2).map((c) => c.id) });
    snap = act(snap, 1, { type: 'plan', gear: 2, cards: s.racers[1]!.hand.slice(0, 2).map((c) => c.id) });
    snap = act(snap, 0, noReact); // 13: speed 7 at limit 5 → 2 + 1 overheat
    expect(st(snap).racers[0]!.engine).toHaveLength(3);
    // seat 1 lands on 12, right behind — fog forbids slipstream
    expect(hints(snap, 1).find((h) => h.type === 'react')).toMatchObject({ slip: false });
  });

  it('garage: three draft rounds of players + 3 cards in reverse grid order, picks shuffled into the deck', () => {
    let snap = game(3, 12, { garage: true });
    let s = st(snap);
    expect(s.phase).toBe('draft');
    expect(s.draft!.market).toHaveLength(6);
    expect(s.draft!.pickers).toEqual([...s.grid].reverse());
    expect(JSON.stringify(view(snap, null))).not.toContain('supply');
    expect(view(snap, null).racers[0]!.hand).toBe(0);
    const firstPicker = s.draft!.pickers[0]!;
    expect(reject(snap, (firstPicker + 1) % 3, { type: 'pick', card: s.draft!.market[0]!.id })).toBe('NOT_YOUR_TURN');
    for (let i = 0; i < 9; i++) {
      s = st(snap);
      const seat = s.draft!.pickers[0]!;
      const h = hints(snap, seat).find((x) => x.type === 'pick')!;
      snap = act(snap, seat, { type: 'pick', card: (h.cards as number[])[0] });
    }
    s = st(snap);
    expect(s.phase).toBe('plan');
    for (const r of s.racers) {
      expect([...r.hand, ...r.deck].filter((c) => c.k === 'garage')).toHaveLength(3);
      expect(r.hand).toHaveLength(7);
    }
  });

  it('garage cards: Heat cost, cooldown, corner limit and slipstream bonuses', () => {
    let snap = rigged((s) => {
      rig(s, 0, { pos: 4, lane: 0, gear: 2, hand: [{ id: 901, k: 'garage', g: 'turbo', v: 6 }, { id: 902, k: 'garage', g: 'brakes', v: 1 }, heatCard(), heatCard(), sp(1), sp(1), sp(1)] });
      rig(s, 1, { pos: 0, lane: 0, gear: 1 });
    });
    const s = st(snap);
    snap = act(snap, 0, { type: 'plan', gear: 2, cards: [901, 902] });
    snap = act(snap, 1, { type: 'plan', gear: 1, cards: cardsOf(s.racers[1]!, 1) });
    let t = st(snap);
    expect(t.racers[0]!.pos).toBe(11);
    expect(t.racers[0]!.engine).toHaveLength(5); // turbo: 1 Heat
    snap = act(snap, 0, noReact);
    t = st(snap);
    // speed 7 at the limit-5 corner, brakes +2 → limit 7: no Heat; gear 2 cooldown 1 returned one heat card
    expect(t.racers[0]!.engine).toHaveLength(6);
    expect(t.log.some((e) => e.e === 'corner' && e.seat === 0)).toBe(false);
  });
});

describe('heat audit regressions', () => {
  it('forced play of a garage card whose Heat the engine cannot pay moves 0 and pays nothing', () => {
    let snap = rigged((s) => {
      rig(s, 0, { pos: 20, lane: 0, gear: 2, engine: [], hand: [{ id: 911, k: 'garage', g: 'nitro', v: 8 }, heatCard(), heatCard(), heatCard(), heatCard(), heatCard(), heatCard()] });
      rig(s, 1, { pos: 0, lane: 0, gear: 1 });
    });
    const s = st(snap);
    expect(gearOptions(s.racers[0]!)).toEqual([{ gear: 1, cost: 0 }]);
    expect(hints(snap, 0).find((h) => h.type === 'plan')!.playable).toContain(911);
    snap = act(snap, 0, { type: 'plan', gear: 1, cards: [911] });
    snap = act(snap, 1, { type: 'plan', gear: 1, cards: cardsOf(s.racers[1]!, 1) });
    const r = st(snap).racers[0]!;
    expect(r.speed).toBe(0);
    expect(r.pos).toBe(20);
  });
});

describe('heat timeouts and resignation', () => {
  it('plan timeout keeps the gear and plays the slowest cards; react timeout skips options', () => {
    let snap = rigged((s) => {
      rig(s, 0, { pos: 30, lane: 0, gear: 3, hand: [sp(4), sp(1), sp(3), sp(2), heatCard(), sp(4), sp(1)] });
      rig(s, 1, { pos: 20, lane: 0, gear: 1 });
    });
    const r0 = st(snap).racers[0]!;
    expect(autoPlan(r0).gear).toBe(3);
    expect(autoPlan(r0).cards.map((id) => r0.hand.find((c) => c.id === id)!.v).sort()).toEqual([1, 1, 2]);
    snap = act(snap, 1, { type: 'plan', gear: 1, cards: cardsOf(st(snap).racers[1]!, 1) });
    const t1 = applyTimeout(m, snap, 0);
    expect(t1.internalEvents).toEqual([{ type: 'timeout', seat: 0 }]);
    expect(t1.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
    snap = t1.snapshot;
    expect(st(snap).racers[0]!.pos).toBe(34);
    expect(heatModule.pendingSeats(st(snap))).toEqual([0]);
    snap = applyTimeout(m, snap, 0).snapshot;
    expect(heatModule.pendingSeats(st(snap))).toEqual([1]);
    expect(st(snap).racers[0]!.hand).toHaveLength(7);
  });

  it('a resigned car leaves the race, ranks last; the last remaining player wins', () => {
    let snap = game(3, 2);
    snap = act(snap, 1, { type: 'resign' });
    let s = st(snap);
    expect(s.outcome).toBeNull();
    expect(heatModule.pendingSeats(s)).toEqual([0, 2]);
    expect(reject(snap, 1, { type: 'plan', gear: 1, cards: [] })).toBe('ALREADY_RESIGNED');
    expect(hints(snap, 1)).toEqual([]);
    snap = act(snap, 0, { type: 'plan', gear: 1, cards: cardsOf(s.racers[0]!, 1) });
    snap = act(snap, 2, { type: 'plan', gear: 1, cards: cardsOf(s.racers[2]!, 1) });
    s = st(snap);
    expect(s.order).not.toContain(1);
    const cur = heatModule.pendingSeats(s)[0]!;
    const fin = step(snap, cur, { type: 'resign' });
    expect(fin.outcome).toMatchObject({ reason: 'resign' });
    expect(fin.outcome!.placements.map((x) => x.seat)).toEqual([cur === 0 ? 2 : 0, cur, 1]);
    expect(fin.scheduleChanges).toEqual([{ kind: 'clear', deadlineKey: 'turn' }]);
    expect(reject(fin.snapshot, 0, { type: 'resign' })).toBe('GAME_FINISHED');
  });

  it('resigning while it is your move passes the turn on', () => {
    let snap = game(3, 6);
    const s = st(snap);
    for (const seat of [0, 1, 2]) snap = act(snap, seat, { type: 'plan', gear: 1, cards: cardsOf(s.racers[seat]!, 1) });
    const [first, second] = st(snap).order;
    snap = act(snap, first!, { type: 'resign' });
    expect(heatModule.pendingSeats(st(snap))).toEqual([second]);
  });
});

function randomGame(players: number, seed: number, options: Record<string, unknown>) {
  const rng = createRng({ s: 1000 + seed });
  const setup = { playerCount: players, seed, options };
  let snap = startGame(m, setup).snapshot;
  const inputs: ReplayInput[] = [];
  for (let n = 0; n < 6000 && !st(snap).outcome; n++) {
    const s = st(snap);
    const seat = heatModule.pendingSeats(s)[rng.nextInt(heatModule.pendingSeats(s).length)]!;
    const hs = hints(snap, seat);
    let action: Record<string, unknown>;
    if (rng.nextInt(40) === 0) { inputs.push({ kind: 'timeout', logicalTime: n }); snap = applyTimeout(m, snap, n).snapshot; continue; }
    const pick = hs.find((h) => h.type === 'pick');
    const plan = hs.find((h) => h.type === 'plan');
    const boost = hs.find((h) => h.type === 'boost');
    const react = hs.find((h) => h.type === 'react');
    if (pick) action = { type: 'pick', card: (pick.cards as number[])[rng.nextInt((pick.cards as number[]).length)] };
    else if (plan) {
      const gears = plan.gears as { gear: number }[];
      const gear = gears[rng.nextInt(gears.length)]!.gear;
      const pool = (plan.playable as number[]).slice();
      const cards: number[] = [];
      while (cards.length < gear) cards.push(pool.splice(rng.nextInt(pool.length), 1)[0]!);
      action = { type: 'plan', gear, cards: cards.sort((a, b) => a - b) };
      const tryIt = applyAction(m, snap, p(seat), action, n);
      if ('ok' in tryIt) action = { type: 'plan', ...autoPlan(s.racers[seat]!) };
    } else if (boost && rng.nextInt(4) === 0) action = { type: 'boost' };
    else {
      const adrenaline = !!react!.adrenaline && rng.nextInt(2) === 0;
      const slip = adrenaline ? react!.slipAdrenaline : react!.slip;
      const pool = (react!.discardable as number[]).filter(() => rng.nextInt(4) === 0);
      action = { type: 'react', adrenaline, slipstream: !!slip && rng.nextInt(3) > 0, discard: pool };
    }
    const r = step(snap, seat, action);
    inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: n });
    snap = r.snapshot;
    // invariant: no more than two cars per space, every racer keeps all its cards
    const t = st(snap);
    const occ = new Map<number, number>();
    t.racers.forEach((x) => { if (!x.finished && x.resigned === null) occ.set(x.pos, (occ.get(x.pos) ?? 0) + 1); });
    expect(Math.max(0, ...occ.values())).toBeLessThanOrEqual(2);
  }
  return { snap, setup, inputs };
}

describe('heat full games', () => {
  it('many seeded random games terminate with a valid outcome and replay exactly', () => {
    const variants: Record<string, unknown>[] = [{}, { laps: 1 }, { weather: true, laps: 1 }, { garage: true, laps: 1 }, { races: 2, laps: 1, weather: true, garage: true, track: 'italy' }, { track: 'france' }, { track: 'gb', laps: 1 }];
    for (let g = 0; g < 21; g++) {
      const players = 2 + (g % 5);
      const { snap, setup, inputs } = randomGame(players, g, variants[g % variants.length]!);
      const s = st(snap);
      expect(s.outcome, `game ${g}`).not.toBeNull();
      expect(s.outcome!.placements.map((x) => x.seat).sort()).toEqual([...Array(players).keys()]);
      expect(s.outcome!.placements.map((x) => x.place)).toEqual([...Array(players).keys()].map((i) => i + 1));
      expect(s.history).toHaveLength(s.tracks.length);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 240_000);

  it('tutorial script plays to the exact outcome', () => {
    const tu = heatModule.tutorial;
    expect(tu.steps.length).toBeGreaterThanOrEqual(3);
    expect(tu.steps.length).toBeLessThanOrEqual(8);
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const [i, s] of tu.steps.entries()) {
      expect(heatModule.pendingSeats(st(snap)), `step ${i + 1}`).toContain(0);
      snap = act(snap, 0, s.expected);
      if (s.reply && heatModule.pendingSeats(st(snap)).includes(1)) snap = act(snap, 1, s.reply);
      else expect(s.reply, `step ${i + 1} reply unused`).toBeNull();
    }
    const s = st(snap);
    expect(s.racers[0]!.finished).toMatchObject({ round: 3, over: 6 });
    expect(s.racers[1]!.finished).toMatchObject({ round: 3, over: 5 });
    expect(s.outcome).toEqual({ reason: 'score', placements: [{ seat: 0, place: 1, score: 9 }, { seat: 1, place: 2, score: 6 }] });
  });
});
