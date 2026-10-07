import { describe, expect, it } from 'vitest';
import {
  BOARDS, COLORS, LOCO, MAP_IDS, ROUTE_POINTS, TRAINS, TUTORIAL, connected, longestPath, routesOf, ttrModule,
  type MapId, type TtrState, type TtrView
} from '@bg/game-ticket-to-ride';
import { applyAction, applyTimeout, projectFor, replay, startGame, type EngineSnapshot, type ReplayInput, type StepResult } from '../src/index.ts';

const m = ttrModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as TtrState;
const view = (s: EngineSnapshot, seat: number | null) =>
  projectFor(m, s, seat === null ? { kind: 'spectator' } : p(seat)).view as TtrView;
const legal = (s: EngineSnapshot, seat: number) => projectFor(m, s, p(seat)).legalActions;
const C = Object.fromEntries(COLORS.map((c, i) => [c, i])) as Record<(typeof COLORS)[number], number>;
const hand = (h: Partial<Record<(typeof COLORS)[number] | 'loco', number>>) => [...COLORS.map((c) => h[c] ?? 0), h.loco ?? 0];
const routeIx = (map: MapId, a: string, b: string, color?: string) => {
  const B = BOARDS[map], ia = B.cities.findIndex((c) => c.id === a), ib = B.cities.findIndex((c) => c.id === b);
  return B.routes.findIndex((r) => ((r.a === ia && r.b === ib) || (r.a === ib && r.b === ia)) && (!color || r.color === color));
};

function act(snap: EngineSnapshot, seat: number, action: unknown): StepResult {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r;
}
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};

const cardTotal = (s: TtrState) =>
  s.deck.length + s.discard.length + s.market.filter((c) => c !== null).length + s.hands.reduce((a, h) => a + h.reduce((x, y) => x + y, 0), 0);

/** A started game past the ticket choice: everybody kept their first two tickets; then the given overrides. */
function arrange(o: { players?: number; map?: MapId; hands?: number[][]; current?: number; trains?: number[]; owner?: Record<number, number> } = {}): EngineSnapshot {
  const players = o.players ?? 3;
  let snap = startGame(m, { playerCount: players, seed: 4, options: { map: o.map ?? 'usa' } }).snapshot;
  for (let seat = 0; seat < players; seat++) snap = act(snap, seat, { type: 'keep', keep: st(snap).offer[seat]!.slice(0, 2) }).snapshot;
  const s = structuredClone(st(snap));
  if (o.hands) {
    // Keep cards conserved: hands come out of the deck.
    s.hands.forEach((h) => h.forEach((k, c) => s.deck.push(...Array<number>(k).fill(c))));
    s.hands = o.hands.map((h) => [...h]);
    for (const h of s.hands) h.forEach((k, c) => { for (let i = 0; i < k; i++) s.deck.splice(s.deck.indexOf(c), 1); });
  }
  if (o.current !== undefined) s.current = o.current;
  if (o.trains) s.trains = [...o.trains];
  for (const [r, seat] of Object.entries(o.owner ?? {})) s.owner[Number(r)] = seat;
  return { ...snap, state: s };
}

describe('ticket to ride maps', () => {
  it.each(MAP_IDS)('%s: connected network, valid double routes, Persian names, ticket values from the network', (id) => {
    const B = BOARDS[id];
    expect(B.cities.length).toBeGreaterThanOrEqual(30);
    expect(new Set(B.cities.map((c) => c.id)).size).toBe(B.cities.length);
    expect(B.cities.every((c) => /[؀-ۿ]/.test(c.fa))).toBe(true);
    const all = B.routes.map((_, r) => r);
    expect(B.cities.every((_, c) => connected(B, all, 0, c))).toBe(true);
    B.routes.forEach((r, i) => {
      expect(r.len).toBeGreaterThanOrEqual(1);
      expect(ROUTE_POINTS[r.len]).toBeGreaterThan(0);
      if (r.sib !== null) { expect(B.routes[r.sib]!.sib).toBe(i); expect([B.routes[r.sib]!.a, B.routes[r.sib]!.b]).toEqual([r.a, r.b]); }
    });
    expect(B.tickets.length).toBeGreaterThanOrEqual(30);
    expect(B.tickets.every((t) => t.points >= 2 && t.points <= 30 && t.a !== t.b)).toBe(true);
  });

  it('longest path follows each route once and may revisit a city', () => {
    const B = BOARDS.usa;
    // A triangle with a tail: Kansas City–Omaha (1), Omaha–Denver (4), Denver–Kansas City (4), Kansas City–Saint Louis (2).
    const routes = [routeIx('usa', 'kansasCity', 'omaha'), routeIx('usa', 'omaha', 'denver'), routeIx('usa', 'denver', 'kansasCity'), routeIx('usa', 'kansasCity', 'saintLouis')];
    expect(longestPath(B, routes)).toBe(11);
    expect(longestPath(B, [])).toBe(0);
  });
});

describe('ticket to ride setup and tickets', () => {
  it('deals 4 cards, 5 face-up, 3 tickets each; 110 cards conserved; deterministic', () => {
    const a = startGame(m, { playerCount: 4, seed: 9, options: { map: 'europe' } }).snapshot;
    const s = st(a);
    expect(s.map).toBe('europe');
    expect(s.hands.map((h) => h.reduce((x, y) => x + y, 0))).toEqual([4, 4, 4, 4]);
    expect(s.market.filter((c) => c !== null)).toHaveLength(5);
    expect(s.market.filter((c) => c === LOCO).length).toBeLessThan(3);
    expect(s.offer.map((o) => o!.length)).toEqual([3, 3, 3, 3]);
    expect(cardTotal(s)).toBe(110);
    expect(s.trains).toEqual([TRAINS, TRAINS, TRAINS, TRAINS]);
    expect(startGame(m, { playerCount: 4, seed: 9, options: { map: 'europe' } }).snapshot).toEqual(a);
    expect(ttrModule.pendingSeats(s)).toEqual([0, 1, 2, 3]);
    expect(st(startGame(m, { playerCount: 2, seed: 1, options: {} }).snapshot).map).toBe('usa');
  });

  it('initial choice is simultaneous: keep at least 2; the game starts when all chose; returned tickets go under the pile', () => {
    let snap = startGame(m, { playerCount: 2, seed: 3, options: { map: 'iran' } }).snapshot;
    const offer = st(snap).offer[1]!;
    expect(reject(snap, 1, { type: 'keep', keep: [offer[0]] })).toBe('KEEP_MORE_TICKETS');
    expect(reject(snap, 1, { type: 'keep', keep: [offer[0], offer[0]] })).toBe('INVALID_TICKETS');
    expect(reject(snap, 1, { type: 'drawDeck' })).toBe('WRONG_PHASE');
    snap = act(snap, 1, { type: 'keep', keep: [offer[0], offer[1]] }).snapshot;
    expect(st(snap).ticketDeck.at(-1)).toBe(offer[2]);
    expect(st(snap).phase).toBe('tickets');
    expect(ttrModule.pendingSeats(st(snap))).toEqual([0]);
    const r = act(snap, 0, { type: 'keep', keep: st(snap).offer[0]! });
    expect(st(r.snapshot)).toMatchObject({ phase: 'play', current: st(r.snapshot).first, turn: 1 });
    expect(st(r.snapshot).tickets.map((t) => t.length)).toEqual([3, 2]);
    expect(r.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
  });

  it('drawing tickets in a turn: keep at least 1, then the turn ends', () => {
    const snap = arrange({ current: 0 });
    const before = st(snap).ticketDeck.length;
    const r = act(snap, 0, { type: 'drawTickets' });
    expect(st(r.snapshot).offer[0]).toHaveLength(3);
    expect(reject(r.snapshot, 0, { type: 'drawDeck' })).toBe('CHOOSE_TICKETS');
    expect(legal(r.snapshot, 0).map((h) => h.type)).toEqual(['keep', 'resign']);
    const k = act(r.snapshot, 0, { type: 'keep', keep: [st(r.snapshot).offer[0]![2]!] });
    expect(st(k.snapshot)).toMatchObject({ current: 1 });
    expect(st(k.snapshot).tickets[0]).toHaveLength(3);
    expect(st(k.snapshot).ticketDeck.length).toBe(before - 1);
  });
});

describe('ticket to ride drawing cards', () => {
  it('two cards per turn; a face-up locomotive first ends the turn; not allowed as the second card', () => {
    const snap = arrange({ current: 0 });
    const s = st(snap);
    s.market = [C.red, LOCO, C.blue, C.green, C.white];
    let r = act(snap, 0, { type: 'drawMarket', slot: 0 });
    expect(st(r.snapshot)).toMatchObject({ current: 0, drew: 1 });
    expect(st(r.snapshot).hands[0]![C.red]).toBe(s.hands[0]![C.red]! + 1);
    st(r.snapshot).market[1] = LOCO;
    expect(reject(r.snapshot, 0, { type: 'drawMarket', slot: 1 })).toBe('LOCO_SECOND');
    expect(reject(r.snapshot, 0, { type: 'drawTickets' })).toBe('WRONG_PHASE');
    expect(reject(r.snapshot, 0, { type: 'claim', route: 0, color: 0, locos: 0 })).toBe('WRONG_PHASE');
    r = act(r.snapshot, 0, { type: 'drawDeck' });
    expect(st(r.snapshot)).toMatchObject({ current: 1, drew: 0 });

    const loco = arrange({ current: 0 });
    st(loco).market = [LOCO, C.red, C.blue, C.green, C.white];
    expect(st(act(loco, 0, { type: 'drawMarket', slot: 0 }).snapshot)).toMatchObject({ current: 1, drew: 0 });
    expect(cardTotal(st(r.snapshot))).toBe(110);
  });

  it('three face-up locomotives are discarded and replaced', () => {
    const snap = arrange({ current: 0 });
    const s = st(snap);
    s.market = [C.red, LOCO, LOCO, C.green, C.white];
    // The refill turns up a third locomotive.
    const i = s.deck.indexOf(LOCO);
    [s.deck[i], s.deck[s.deck.length - 1]] = [s.deck[s.deck.length - 1]!, s.deck[i]!];
    const r = act(snap, 0, { type: 'drawMarket', slot: 0 });
    const t = st(r.snapshot);
    expect(t.log.some((e) => e.t === 'redeal')).toBe(true);
    expect(t.discard.filter((c) => c === LOCO).length).toBeGreaterThanOrEqual(3);
    expect(cardTotal(t)).toBe(110);
  });

  it('the discard pile is reshuffled when the deck runs out', () => {
    const snap = arrange({ current: 0 });
    const s = st(snap);
    s.discard = s.deck.splice(0);
    const r = act(snap, 0, { type: 'drawDeck' });
    expect(st(r.snapshot).discard).toEqual([]);
    expect(cardTotal(st(r.snapshot))).toBe(110);
  });
});

describe('ticket to ride claiming routes', () => {
  const sfla = routeIx('usa', 'sanFrancisco', 'losAngeles', 'yellow'); // 3, double with pink
  const lalv = routeIx('usa', 'losAngeles', 'lasVegas'); // 2 gray

  it('pays the route colour (locomotives wild), scores, uses trains; gray takes any one colour', () => {
    const snap = arrange({ current: 0, hands: [hand({ yellow: 2, red: 2, loco: 1 }), hand({}), hand({})] });
    expect(reject(snap, 0, { type: 'claim', route: sfla, color: C.red, locos: 1 })).toBe('WRONG_COLOR');
    expect(reject(snap, 0, { type: 'claim', route: sfla, color: C.yellow, locos: 0 })).toBe('NOT_ENOUGH_CARDS');
    expect(reject(snap, 0, { type: 'claim', route: sfla, color: C.yellow, locos: 2 })).toBe('NOT_ENOUGH_CARDS');
    const claim = legal(snap, 0).find((h) => h.type === 'claim' && h.route === sfla);
    expect(claim).toMatchObject({ pay: [{ color: C.yellow, minLocos: 1, maxLocos: 1 }] });
    const r = act(snap, 0, { type: 'claim', route: sfla, color: C.yellow, locos: 1 });
    const s = st(r.snapshot);
    expect(s.owner[sfla]).toBe(0);
    expect(s.trains[0]).toBe(TRAINS - 3);
    expect(s.routePoints[0]).toBe(4);
    expect(s.hands[0]).toEqual(hand({ red: 2 }));
    expect(s.current).toBe(1);
    expect(cardTotal(s)).toBe(110);
    const g = act(arrange({ current: 0, hands: [hand({ red: 2 }), hand({}), hand({})] }), 0, { type: 'claim', route: lalv, color: C.red, locos: 0 });
    expect(st(g.snapshot).routePoints[0]).toBe(2);
    expect(reject(snap, 0, { type: 'claim', route: 9999, color: 0, locos: 0 })).toBe('INVALID_ACTION');
  });

  it('taken routes, not enough trains', () => {
    const snap = arrange({ current: 0, hands: [hand({ red: 6 }), hand({}), hand({})], owner: { [lalv]: 1 }, trains: [2, TRAINS, TRAINS] });
    expect(reject(snap, 0, { type: 'claim', route: lalv, color: C.red, locos: 0 })).toBe('ROUTE_TAKEN');
    expect(reject(snap, 0, { type: 'claim', route: routeIx('usa', 'losAngeles', 'phoenix'), color: C.red, locos: 0 })).toBe('NOT_ENOUGH_TRAINS');
  });

  it('double routes: never both for one player; with 2–3 players the second is closed', () => {
    const pink = routeIx('usa', 'sanFrancisco', 'losAngeles', 'pink');
    const h = hand({ pink: 3, yellow: 3 });
    const three = arrange({ players: 3, current: 0, hands: [h, h, hand({})], owner: { [sfla]: 1 } });
    expect(reject(three, 0, { type: 'claim', route: pink, color: C.pink, locos: 0 })).toBe('DOUBLE_CLOSED');
    const four = arrange({ players: 4, current: 0, hands: [h, h, hand({}), hand({})], owner: { [sfla]: 1 } });
    expect(reject(four, 0, { type: 'claim', route: pink, color: C.pink, locos: 0 })).toBe('ACCEPTED');
    const own = arrange({ players: 4, current: 0, hands: [h, h, hand({}), hand({})], owner: { [sfla]: 0 } });
    expect(reject(own, 0, { type: 'claim', route: pink, color: C.pink, locos: 0 })).toBe('OWN_DOUBLE');
  });
});

describe('ticket to ride end of game', () => {
  it('2 or fewer trains start the last round: everyone, the trigger included, plays once more; then scoring', () => {
    const lalv = routeIx('usa', 'losAngeles', 'lasVegas');
    let snap = arrange({ current: 0, trains: [4, TRAINS, TRAINS], hands: [hand({ red: 2 }), hand({}), hand({})] });
    const B = BOARDS.usa;
    snap = act(snap, 0, { type: 'claim', route: lalv, color: C.red, locos: 0 }).snapshot;
    expect(st(snap).finalLeft).toEqual([0, 1, 2]);
    expect(st(snap).log.some((e) => e.t === 'final' && e.seat === 0)).toBe(true);
    snap = act(act(snap, 1, { type: 'drawDeck' }).snapshot, 1, { type: 'drawDeck' }).snapshot;
    snap = act(act(snap, 2, { type: 'drawDeck' }).snapshot, 2, { type: 'drawDeck' }).snapshot;
    expect(st(snap)).toMatchObject({ current: 0, finalLeft: [0] });
    const r = act(act(snap, 0, { type: 'drawDeck' }).snapshot, 0, { type: 'drawDeck' });
    const s = st(r.snapshot);
    expect(r.outcome).not.toBeNull();
    expect(r.scheduleChanges).toEqual([{ kind: 'clear', deadlineKey: 'turn' }]);
    const f = s.final!;
    // Longest path: only seat 0 has a route → +10; tickets of the others are not connected → negative.
    expect(f[0]).toMatchObject({ routePoints: 2, longest: 2, bonus: true });
    expect(f[0]!.total).toBe(2 + f[0]!.ticketPoints + 10);
    for (const seat of [1, 2]) {
      expect(f[seat]!.ticketPoints).toBe(-s.tickets[seat]!.reduce((a, t) => a + B.tickets[t]!.points, 0));
      expect(f[seat]!.bonus).toBe(false);
    }
    expect(r.outcome!.placements[0]).toMatchObject({ seat: 0, place: 1 });
    // At the end everybody sees all tickets with their result.
    expect(view(r.snapshot, 1).final![0]!.tickets).toEqual(f[0]!.tickets);
  });

  it('ties share the longest bonus; equal totals break on completed tickets', () => {
    const snap = arrange({ players: 2, current: 0 });
    const s = st(snap);
    s.tickets = [[], []];
    s.owner[routeIx('usa', 'losAngeles', 'lasVegas')] = 0;
    s.owner[routeIx('usa', 'pittsburgh', 'washington')] = 1;
    s.routePoints = [2, 2];
    s.trains = [1, 1];
    s.finalLeft = [0];
    const r = act(act(snap, 0, { type: 'drawDeck' }).snapshot, 0, { type: 'drawDeck' });
    expect(st(r.snapshot).final!.map((x) => [x.bonus, x.total])).toEqual([[true, 12], [true, 12]]);
    expect(r.outcome!.placements.map((x) => x.place)).toEqual([1, 1]);
  });
});

describe('ticket to ride timeouts, resign and redaction', () => {
  it('ticket choice timeout keeps the cheapest tickets for every seat still choosing', () => {
    const snap = startGame(m, { playerCount: 3, seed: 6, options: {} }).snapshot;
    const offers = st(snap).offer.map((o) => o!.slice());
    const r = applyTimeout(m, snap, 0);
    const s = st(r.snapshot);
    expect(s.phase).toBe('play');
    s.tickets.forEach((t, seat) => {
      const pts = (id: number) => BOARDS.usa.tickets[id]!.points;
      expect(t).toHaveLength(2);
      expect(Math.max(...t.map(pts))).toBeLessThanOrEqual(Math.max(...offers[seat]!.filter((x) => !t.includes(x)).map(pts)));
    });
    expect(s.timeouts).toEqual([1, 1, 1]);
  });

  it('turn timeout draws two blind cards; three in a row remove the player; their routes stay', () => {
    const lalv = routeIx('usa', 'losAngeles', 'lasVegas');
    let snap = arrange({ current: 0, owner: { [lalv]: 0 } });
    const before = st(snap).hands[0]!.reduce((a, b) => a + b, 0);
    const r = applyTimeout(m, snap, 0);
    expect(st(r.snapshot).hands[0]!.reduce((a, b) => a + b, 0)).toBe(before + 2);
    expect(st(r.snapshot).current).toBe(1);
    snap = r.snapshot;
    for (let i = 0; i < 12 && st(snap).status[0] === 'active'; i++) {
      snap = st(snap).current === 0 ? applyTimeout(m, snap, 0).snapshot : act(act(snap, st(snap).current, { type: 'drawDeck' }).snapshot, st(snap).current, { type: 'drawDeck' }).snapshot;
    }
    const s = st(snap);
    expect(s.status[0]).toBe('abandoned');
    expect(s.hands[0]!.every((k) => k === 0)).toBe(true);
    expect(s.owner[lalv]).toBe(0);
    expect(cardTotal(s)).toBe(110);
    expect(reject(snap, 0, { type: 'drawDeck' })).toBe('NOT_IN_GAME');
  });

  it('resign passes the turn; the last active player wins', () => {
    let r = act(arrange({ current: 0 }), 0, { type: 'resign' });
    expect(st(r.snapshot)).toMatchObject({ current: 1 });
    expect(r.outcome).toBeNull();
    r = act(r.snapshot, 2, { type: 'resign' });
    expect(r.outcome).toMatchObject({ reason: 'resign', placements: [{ seat: 1, place: 1 }, { seat: 2, place: 2 }, { seat: 0, place: 3 }] });
  });

  it('views never contain other hands, tickets, offers, the deck order or the RNG', () => {
    let snap = arrange({ current: 0 });
    snap = act(snap, 0, { type: 'drawTickets' }).snapshot;
    const s = st(snap);
    for (const seat of [1, 2, null]) {
      const v = view(snap, seat);
      const json = JSON.stringify(v);
      for (const k of ['"hands":', '"deck":', '"discard":', '"tickets":', '"offer":', '"ticketDeck":', 'rng']) expect(json).not.toContain(k);
      expect(v.choosing).toEqual([true, false, false]);
      expect(v.handCounts).toEqual(s.hands.map((h) => h.reduce((a, b) => a + b, 0)));
      expect(v.ticketCounts).toEqual([2, 2, 2]);
    }
    expect(view(snap, 0).myOffer).toEqual(s.offer[0]);
    expect(view(snap, 1).myOffer).toBeNull();
    expect(view(snap, null).myHand).toBeNull();
    expect(view(snap, 1).myTickets!.map((t) => t.id)).toEqual(s.tickets[1]);
    expect(legal(snap, 1).map((h) => h.type)).toEqual(['resign']);
    // Blind draws are logged without the colour (only the internal event has it).
    const d = act(arrange({ current: 0 }), 0, { type: 'drawDeck' });
    expect(Object.keys(view(d.snapshot, 1).log.at(-1)!).sort()).toEqual(['seat', 'seq', 't']);
    expect(d.internalEvents[0]).toMatchObject({ type: 'card', seat: 0 });
  });
});

describe('ticket to ride tutorial', () => {
  it('the scripted game plays to a win for the learner', () => {
    let snap = startGame(m, { playerCount: 2, seed: ttrModule.tutorial.seed, options: ttrModule.tutorial.options }).snapshot;
    expect(st(snap)).toMatchObject({ map: 'iran', trains: [TUTORIAL.learnerTrains, TRAINS] });
    expect(cardTotal(st(snap))).toBe(110);
    for (const step of ttrModule.tutorial.steps) {
      snap = act(snap, 0, step.expected).snapshot;
      if (step.reply && ttrModule.pendingSeats(st(snap)).includes(1)) snap = act(snap, 1, step.reply).snapshot;
    }
    const s = st(snap);
    expect(s.outcome?.placements.find((x) => x.place === 1)?.seat).toBe(0);
    expect(s.final![0]!.tickets.every((t) => t.done)).toBe(true);
    expect(routesOf(s, 1)).toHaveLength(4);
  });
});

// ---------- random play ----------

const rnd = (seed: number) => { let x = seed || 1; return (n: number) => { x = (x * 1103515245 + 12345) % 2147483648; return Math.floor((x / 2147483648) * n); }; };
type Hint = { type: string; [k: string]: unknown };

/** A simple bot that only uses its own view and legal actions: claims when it can, else draws. */
function choose(hints: Hint[], r: (n: number) => number): unknown {
  const of = (t: string) => hints.filter((h) => h.type === t);
  const pick = <X>(xs: X[]) => xs[r(xs.length)]!;
  const keep = of('keep')[0];
  if (keep) { const offer = keep.offer as number[]; return { type: 'keep', keep: offer.slice(0, Math.max(keep.min as number, 1 + r(offer.length))) }; }
  const claims = of('claim');
  if (claims.length && r(3)) { const c = pick(claims); const pay = pick(c.pay as { color: number; minLocos: number; maxLocos: number }[]); return { type: 'claim', route: c.route, color: pay.color, locos: pay.minLocos }; }
  if (of('drawTickets').length && r(25) === 0) return { type: 'drawTickets' };
  const market = of('drawMarket')[0];
  if (market && r(2)) return { type: 'drawMarket', slot: pick(market.slots as number[]) };
  if (of('drawDeck').length) return { type: 'drawDeck' };
  if (market) return { type: 'drawMarket', slot: pick(market.slots as number[]) };
  if (claims.length) { const c = claims[0]!; const pay = (c.pay as { color: number; minLocos: number }[])[0]!; return { type: 'claim', route: c.route, color: pay.color, locos: pay.minLocos }; }
  if (of('drawTickets').length) return { type: 'drawTickets' };
  if (of('pass').length) return { type: 'pass' };
  throw new Error(`bot has nothing to do: ${JSON.stringify(hints)}`);
}

function randomGame(seed: number, players: number, map: MapId): { snap: EngineSnapshot; inputs: ReplayInput[] } {
  const r = rnd(seed);
  let snap = startGame(m, { playerCount: players, seed, options: { map } }).snapshot;
  const inputs: ReplayInput[] = [];
  for (let steps = 0; steps < 5000 && !st(snap).outcome; steps++) {
    if (r(200) === 0) { snap = applyTimeout(m, snap, 0).snapshot; inputs.push({ kind: 'timeout', logicalTime: 0 }); }
    else {
      const seat = ttrModule.pendingSeats(st(snap))[0]!;
      const action = choose(legal(snap, seat), r);
      const res = applyAction(m, snap, p(seat), action, 0);
      if ('ok' in res) throw new Error(`seed ${seed} step ${steps}: ${JSON.stringify(action)} → ${res.errorCode}`);
      snap = res.snapshot;
      inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
    }
    const s = st(snap);
    expect(cardTotal(s)).toBe(110);
    expect(s.hands.every((h) => h.every((k) => k >= 0))).toBe(true);
    s.trains.forEach((t, seat) => expect(t + routesOf(s, seat).reduce((a, x) => a + BOARDS[map].routes[x]!.len, 0)).toBe(TRAINS));
  }
  return { snap, inputs };
}

describe('ticket to ride random play', () => {
  it('15 random 2–5 player games on all maps finish, keep the invariants and replay deterministically', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const players = 2 + (seed % 4);
      const map = MAP_IDS[seed % 3]!;
      const { snap, inputs } = randomGame(seed, players, map);
      const s = st(snap);
      expect(s.outcome, `seed ${seed} did not finish`).not.toBeNull();
      expect(s.outcome!.placements).toHaveLength(players);
      if (s.outcome!.reason === 'score') expect(s.final!.every((f) => f.total === f.routePoints + f.ticketPoints + (f.bonus ? 10 : 0))).toBe(true);
      if (seed <= 3) expect(replay(m, { playerCount: players, seed, options: { map } }, inputs)).toEqual(snap);
    }
  }, 180_000);
});
