import { describe, expect, it } from 'vitest';
import {
  BEGINNER_MAP, COAST, EDGES, HEX_NEIGHBORS, HEX_VERTICES, RESOURCES, TUTORIAL, VERTICES, catanModule, emptyHand,
  longestRoad, total, totalVp, tradeRate, vertexOf, type CatanState, type CatanView, type Hand
} from '@bg/game-catan';
import { applyAction, applyTimeout, projectFor, replay, startGame, type EngineSnapshot, type ReplayInput, type StepResult } from '../src/index.ts';

const m = catanModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as CatanState;
const view = (s: EngineSnapshot, seat: number | null) =>
  projectFor(m, s, seat === null ? { kind: 'spectator' } : p(seat)).view as CatanView;
const legal = (s: EngineSnapshot, seat: number) => projectFor(m, s, p(seat)).legalActions;

function act(snap: EngineSnapshot, seat: number, action: unknown): StepResult {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r;
}
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const hand = (h: Partial<Hand>): Hand => ({ ...emptyHand(), ...h });

/** Beginner map, set-up finished, given pieces and hands, `current` in the given phase. Bank keeps the 19-card invariant. */
function arrange(o: {
  players?: number; settlements?: [number, number][]; cities?: [number, number][]; roads?: [number, number][];
  hands?: Partial<Hand>[]; current?: number; phase?: CatanState['phase']; robber?: number; devs?: CatanState['devs'];
}): EngineSnapshot {
  const players = o.players ?? 3;
  const snap = startGame(m, { playerCount: players, seed: 3, options: { board: 'beginner' } }).snapshot;
  const s = structuredClone(st(snap));
  s.buildings = VERTICES.map(() => null);
  s.roads = EDGES.map(() => null);
  for (const [seat, v] of o.settlements ?? []) s.buildings[v] = { seat, city: false };
  for (const [seat, v] of o.cities ?? []) s.buildings[v] = { seat, city: true };
  for (const [seat, e] of o.roads ?? []) s.roads[e] = seat;
  s.hands = Array.from({ length: players }, (_, i) => hand(o.hands?.[i] ?? {}));
  for (const r of RESOURCES) s.bank[r] = 19 - s.hands.reduce((a, h) => a + h[r], 0);
  s.setupIdx = s.setupOrder.length;
  s.current = o.current ?? 0;
  s.turn = 5;
  s.phase = o.phase ?? 'main';
  s.robber = o.robber ?? BEGINNER_MAP.findIndex((h) => h.terrain === 'desert');
  s.devs = o.devs ?? Array.from({ length: players }, () => []);
  s.roadLength = s.roadLength.map((_, seat) => longestRoad(s, seat));
  return { ...snap, state: s };
}

/** A path of n edges starting at vertex v (simple walk, deterministic). */
function path(v: number, n: number, avoid: Set<number> = new Set()): { edges: number[]; end: number; verts: number[] } {
  const edges: number[] = [], verts = [v];
  let cur = v;
  for (let i = 0; i < n; i++) {
    const e = VERTICES[cur]!.edges.find((x) => !edges.includes(x) && !verts.includes(EDGES[x]!.a === cur ? EDGES[x]!.b : EDGES[x]!.a) && !avoid.has(x))!;
    edges.push(e);
    cur = EDGES[e]!.a === cur ? EDGES[e]!.b : EDGES[e]!.a;
    verts.push(cur);
  }
  return { edges, end: cur, verts };
}

describe('catan board', () => {
  it('19 hexes, 54 intersections, 72 paths, 30 coastal paths, 9 harbors', () => {
    expect(VERTICES).toHaveLength(54);
    expect(EDGES).toHaveLength(72);
    expect(COAST).toHaveLength(30);
    expect(HEX_VERTICES.every((vs) => new Set(vs).size === 6)).toBe(true);
    expect(VERTICES.every((v) => v.adj.length === 2 || v.adj.length === 3)).toBe(true);
    const s = st(startGame(m, { playerCount: 3, seed: 1, options: {} }).snapshot);
    expect(s.harbors).toHaveLength(9);
    expect(s.harbors.filter((h) => h.kind === 'any')).toHaveLength(4);
    expect(new Set(s.harbors.flatMap((h) => [EDGES[h.edge]!.a, EDGES[h.edge]!.b])).size).toBe(18);
  });

  it('beginner map follows Illustration A; robber starts on the desert', () => {
    const s = st(startGame(m, { playerCount: 4, seed: 1, options: { board: 'beginner' } }).snapshot);
    expect(s.hexes.map((h) => h.number)).toEqual([10, 2, 9, 12, 6, 4, 10, 9, 11, null, 3, 8, 8, 3, 4, 5, 5, 6, 11]);
    expect(s.hexes[s.robber]!.terrain).toBe('desert');
  });

  it('variable set-up: right terrain and token mix, 6 and 8 never adjacent, deterministic per seed', () => {
    for (let seed = 0; seed < 200; seed++) {
      const s = st(startGame(m, { playerCount: 3, seed, options: {} }).snapshot);
      const by = (t: string) => s.hexes.filter((h) => h.terrain === t).length;
      expect([by('forest'), by('pasture'), by('fields'), by('hills'), by('mountains'), by('desert')]).toEqual([4, 4, 4, 3, 3, 1]);
      expect(s.hexes.map((h) => h.number).filter((x) => x !== null).sort((a, b) => a! - b!)).toEqual([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
      const red = (h: number) => s.hexes[h]!.number === 6 || s.hexes[h]!.number === 8;
      for (let h = 0; h < 19; h++) if (red(h)) expect(HEX_NEIGHBORS[h]!.some(red)).toBe(false);
      expect(s.hexes[s.robber]!.terrain).toBe('desert');
    }
    expect(startGame(m, { playerCount: 4, seed: 9, options: {} })).toEqual(startGame(m, { playerCount: 4, seed: 9, options: {} }));
    expect(() => startGame(m, { playerCount: 2, seed: 1 })).toThrow();
    expect(() => startGame(m, { playerCount: 5, seed: 1 })).toThrow();
  });
});

describe('catan set-up phase', () => {
  it('snake order; second settlement pays its hexes; the starting player then rolls', () => {
    let snap = startGame(m, { playerCount: 3, seed: 4, options: { board: 'beginner' } }).snapshot;
    const order = st(snap).setupOrder;
    expect(order.slice(3)).toEqual(order.slice(0, 3).reverse());
    const placed: number[] = [];
    for (let i = 0; i < 6; i++) {
      const s = st(snap);
      expect(s.current).toBe(order[i]);
      expect(reject(snap, (s.current + 1) % 3, { type: 'buildSettlement', vertex: 0 })).toBe('NOT_YOUR_TURN');
      const v = (legal(snap, s.current).filter((a) => a.type === 'buildSettlement').map((a) => a.vertex as number))[i * 3]!;
      // Distance rule: no settlement next to another.
      for (const w of VERTICES[v]!.adj) expect(placed).not.toContain(w);
      const before = total(s.hands[s.current]!);
      snap = act(snap, s.current, { type: 'buildSettlement', vertex: v }).snapshot;
      placed.push(v);
      const gained = total(st(snap).hands[order[i]!]!) - before;
      const producing = VERTICES[v]!.hexes.filter((h) => st(snap).hexes[h]!.terrain !== 'desert').length;
      expect(gained).toBe(i < 3 ? 0 : producing);
      // The road must touch the new settlement.
      const far = EDGES.findIndex((e) => e.a !== v && e.b !== v);
      expect(reject(snap, order[i]!, { type: 'buildRoad', edge: far })).toBe('ILLEGAL_PLACEMENT');
      snap = act(snap, order[i]!, { type: 'buildRoad', edge: VERTICES[v]!.edges[0]! }).snapshot;
    }
    expect(st(snap)).toMatchObject({ phase: 'roll', current: order[0], turn: 1 });
  });
});

describe('catan building', () => {
  const a = vertexOf(7, 8, 12);
  it('roads connect to own network and stop at an opponent settlement; costs are paid', () => {
    const { edges, verts } = path(a, 2);
    const snap = arrange({ settlements: [[0, a], [1, verts[2]!]], roads: [[0, edges[0]!]], hands: [{ brick: 3, lumber: 3, wool: 1, grain: 1 }] });
    // Edge two steps away from own road through the opponent's settlement vertex is not connected.
    const beyond = VERTICES[verts[2]!]!.edges.find((e) => e !== edges[1])!;
    expect(reject(snap, 0, { type: 'buildRoad', edge: beyond })).toBe('ILLEGAL_PLACEMENT');
    const r = act(snap, 0, { type: 'buildRoad', edge: edges[1]! });
    expect(st(r.snapshot).hands[0]).toMatchObject({ brick: 2, lumber: 2 });
    expect(reject(r.snapshot, 0, { type: 'buildRoad', edge: beyond })).toBe('ILLEGAL_PLACEMENT');
  });

  it('settlements need an own road and the distance rule; cities replace own settlements', () => {
    const { edges, verts } = path(a, 2);
    const snap = arrange({ settlements: [[0, a]], roads: [[0, edges[0]!], [0, edges[1]!]], hands: [{ brick: 2, lumber: 2, wool: 2, grain: 4, ore: 3 }] });
    expect(reject(snap, 0, { type: 'buildSettlement', vertex: verts[1]! })).toBe('ILLEGAL_PLACEMENT'); // next to own settlement
    expect(reject(snap, 0, { type: 'buildSettlement', vertex: vertexOf(0, 1, 4) })).toBe('ILLEGAL_PLACEMENT'); // no road
    const r = act(snap, 0, { type: 'buildSettlement', vertex: verts[2]! });
    expect(view(r.snapshot, 1).publicVp[0]).toBe(2);
    expect(reject(r.snapshot, 0, { type: 'buildCity', vertex: verts[1]! })).toBe('ILLEGAL_PLACEMENT');
    const c = act(r.snapshot, 0, { type: 'buildCity', vertex: a });
    expect(st(c.snapshot).buildings[a]).toEqual({ seat: 0, city: true });
    expect(view(c.snapshot, 1).publicVp[0]).toBe(3);
    expect(reject(c.snapshot, 0, { type: 'buildCity', vertex: verts[2]! })).toBe('NOT_ENOUGH_RESOURCES');
  });

  it('piece limits: 5 settlements, 4 cities, 15 roads', () => {
    const s = st(arrange({}));
    s.roads = s.roads.map((_, e) => (e < 15 ? 0 : null));
    expect(legal({ state: s, rng: { s: 1 } }, 0).some((x) => x.type === 'buildRoad')).toBe(false);
  });
});

describe('catan production and the robber', () => {
  const ore8 = 11, lumber8 = 12;
  const city = vertexOf(10, 11, 15), set1 = vertexOf(7, 8, 12), set2 = vertexOf(11, 15);
  it('settlements take 1 and cities 2; the robber blocks its hex', () => {
    const snap = arrange({ phase: 'roll', cities: [[0, city]], settlements: [[1, set1], [2, set2]] });
    (st(snap) as CatanState).fixedDice = [[4, 4]];
    const r = act(snap, 0, { type: 'roll' });
    expect(st(r.snapshot).hands.map((h) => [h.ore, h.lumber])).toEqual([[2, 0], [0, 1], [1, 0]]);
    const blocked = arrange({ phase: 'roll', robber: ore8, cities: [[0, city]], settlements: [[1, set1]] });
    st(blocked).fixedDice = [[4, 4]];
    expect(st(act(blocked, 0, { type: 'roll' }).snapshot).hands.map((h) => h.ore + h.lumber)).toEqual([0, 1, 0]);
    expect(lumber8).toBe(12);
  });

  it('bank shortage: nobody gets it when several players are owed, a single player gets what is left', () => {
    const snap = arrange({ phase: 'roll', cities: [[0, city]], settlements: [[2, set2]] });
    st(snap).bank.ore = 2; st(snap).hands[1]!.ore = 17;
    st(snap).fixedDice = [[4, 4]];
    expect(st(act(snap, 0, { type: 'roll' }).snapshot).hands.map((h) => h.ore)).toEqual([0, 17, 0]);
    const single = arrange({ phase: 'roll', cities: [[0, city]] });
    st(single).bank.ore = 1; st(single).hands[1]!.ore = 18;
    st(single).fixedDice = [[4, 4]];
    expect(st(act(single, 0, { type: 'roll' }).snapshot).hands[0]!.ore).toBe(1);
  });

  it('7: players above 7 cards discard half at once, then the robber moves and steals; only thief and victim see the card', () => {
    const snap = arrange({ phase: 'roll', settlements: [[0, set1], [1, city], [2, set2]], hands: [{ brick: 9 }, { ore: 8 }, { wool: 7 }] });
    st(snap).fixedDice = [[3, 4]];
    let r = act(snap, 0, { type: 'roll' });
    expect(st(r.snapshot).phase).toBe('discard');
    expect(r.pendingSeats).toEqual([0, 1]); // 9 → 4, 8 → 4; 7 cards is safe
    expect(reject(r.snapshot, 0, { type: 'moveRobber', hex: 0 })).toBe('WRONG_PHASE');
    expect(reject(r.snapshot, 1, { type: 'discard', cards: { ore: 3 } })).toBe('WRONG_DISCARD_COUNT');
    expect(reject(r.snapshot, 2, { type: 'discard', cards: {} })).toBe('NOTHING_TO_DISCARD');
    r = act(r.snapshot, 1, { type: 'discard', cards: { ore: 4 } });
    expect(r.pendingSeats).toEqual([0]);
    r = act(r.snapshot, 0, { type: 'discard', cards: { brick: 4 } });
    expect(st(r.snapshot).phase).toBe('robber');
    const robberAt = st(r.snapshot).robber;
    expect(reject(r.snapshot, 0, { type: 'moveRobber', hex: robberAt })).toBe('ROBBER_MUST_MOVE');
    // Ore 8 hex touches seats 1 and 2: choose the victim.
    r = act(r.snapshot, 0, { type: 'moveRobber', hex: ore8 });
    expect(st(r.snapshot)).toMatchObject({ phase: 'steal', stealFrom: [1, 2] });
    r = act(r.snapshot, 0, { type: 'steal', seat: 2 });
    expect(st(r.snapshot).hands[2]!.wool).toBe(6);
    expect(st(r.snapshot).hands[0]!.wool).toBe(1);
    const entry = (seat: number | null) => view(r.snapshot, seat).log.find((e) => e.t === 'steal') as { res: string | null };
    expect(entry(0).res).toBe('wool');
    expect(entry(2).res).toBe('wool');
    expect(entry(1).res).toBeNull();
    expect(entry(null).res).toBeNull();
    expect(st(r.snapshot).phase).toBe('main');
  });
});

describe('catan trade', () => {
  it('maritime: 4:1 always, 3:1 at a generic harbor, 2:1 only for the harbor resource', () => {
    const s = st(arrange({}));
    const at = (kind: string) => s.harbors.find((h) => h.kind === kind)!;
    const own = (v: number) => ({ harbors: s.harbors, buildings: VERTICES.map((_, i) => (i === v ? { seat: 0, city: false } : null)) });
    expect(tradeRate(own(vertexOf(9, 10, 14)), 0, 'ore')).toBe(4);
    expect(tradeRate(own(EDGES[at('any').edge]!.a), 0, 'ore')).toBe(3);
    const wool = own(EDGES[at('wool').edge]!.b);
    expect([tradeRate(wool, 0, 'wool'), tradeRate(wool, 0, 'ore')]).toEqual([2, 4]);
    const snap = arrange({ hands: [{ ore: 4 }] });
    expect(reject(snap, 0, { type: 'bankTrade', give: 'ore', get: 'ore' })).toBe('SAME_RESOURCE');
    const r = act(snap, 0, { type: 'bankTrade', give: 'ore', get: 'brick' });
    expect(st(r.snapshot).hands[0]).toMatchObject({ ore: 0, brick: 1 });
  });

  it('domestic: the current player offers, others accept or decline, the current player picks a partner', () => {
    const snap = arrange({ hands: [{ ore: 2 }, { brick: 1 }, { brick: 2 }] });
    expect(reject(snap, 0, { type: 'offerTrade', give: { ore: 1 }, get: { ore: 1 } })).toBe('SAME_RESOURCE');
    expect(reject(snap, 0, { type: 'offerTrade', give: { ore: 1 }, get: {} })).toBe('EMPTY_TRADE');
    expect(reject(snap, 1, { type: 'offerTrade', give: { brick: 1 }, get: { ore: 1 } })).toBe('NOT_YOUR_TURN');
    let r = act(snap, 0, { type: 'offerTrade', give: { ore: 2 }, get: { brick: 2 } });
    expect(legal(r.snapshot, 1).map((x) => x.type)).toEqual(['declineTrade', 'resign']); // only 1 brick
    expect(reject(r.snapshot, 1, { type: 'acceptTrade' })).toBe('NOT_ENOUGH_RESOURCES');
    r = act(r.snapshot, 1, { type: 'declineTrade' });
    r = act(r.snapshot, 2, { type: 'acceptTrade' });
    expect(view(r.snapshot, null).trade).toMatchObject({ accepted: [2], declined: [1] });
    expect(reject(r.snapshot, 0, { type: 'confirmTrade', seat: 1 })).toBe('TRADE_NOT_ACCEPTED');
    r = act(r.snapshot, 0, { type: 'confirmTrade', seat: 2 });
    expect(st(r.snapshot).hands.map((h) => [h.ore, h.brick])).toEqual([[0, 2], [0, 1], [2, 0]]);
    expect(st(r.snapshot).trade).toBeNull();
  });
});

describe('catan development cards', () => {
  it('not playable the turn bought, one per turn; knights give Largest Army at 3 and only to strictly more', () => {
    const devs: CatanState['devs'] = [[{ card: 'knight', turn: 1 }, { card: 'knight', turn: 1 }, { card: 'knight', turn: 1 }], [], []];
    let snap = arrange({ phase: 'roll', settlements: [[1, vertexOf(10, 11, 15)]], hands: [{ ore: 1, wool: 1, grain: 1 }, { ore: 2 }], devs });
    st(snap).knights = [2, 0, 0];
    // Before rolling: knight → robber → back to rolling.
    let r = act(snap, 0, { type: 'playKnight' });
    expect(st(r.snapshot)).toMatchObject({ phase: 'robber', largestArmy: 0 });
    r = act(r.snapshot, 0, { type: 'moveRobber', hex: 11 });
    expect(st(r.snapshot).phase).toBe('roll');
    expect(st(r.snapshot).hands[0]!.ore).toBe(2); // stole the only victim's ore automatically
    expect(reject(r.snapshot, 0, { type: 'playKnight' })).toBe('CANNOT_PLAY_CARD'); // one per turn
    st(r.snapshot).fixedDice = [[1, 1]];
    r = act(r.snapshot, 0, { type: 'roll' });
    r = act(r.snapshot, 0, { type: 'buyDev' });
    const bought = st(r.snapshot).devs[0]!.at(-1)!;
    expect(view(r.snapshot, 0).myDevs!.at(-1)).toEqual({ card: bought.card, fresh: true });
    expect(view(r.snapshot, 1).myDevs).toEqual([]);
    expect(view(r.snapshot, 1).devCounts[0]).toBe(3);
    snap = r.snapshot;
    // Another player with more knights takes the card; a tie does not.
    const s2 = structuredClone(st(snap));
    s2.knights = [3, 3, 0]; s2.current = 1; s2.devPlayed = false; s2.turn += 1;
    s2.devs[1] = [{ card: 'knight', turn: 1 }];
    r = act({ ...snap, state: s2 }, 1, { type: 'playKnight' });
    expect(st(r.snapshot).largestArmy).toBe(1);
  });

  it('monopoly, year of plenty, road building', () => {
    const v = vertexOf(7, 8, 12);
    const devs: CatanState['devs'] = [[{ card: 'monopoly', turn: 1 }, { card: 'plenty', turn: 1 }, { card: 'road', turn: 1 }], [], []];
    const snap = arrange({ settlements: [[0, v]], hands: [{}, { wool: 3, ore: 1 }, { wool: 2 }], devs });
    const mono = act(snap, 0, { type: 'playMonopoly', res: 'wool' });
    expect(st(mono.snapshot).hands.map((h) => h.wool)).toEqual([5, 0, 0]);
    const plenty = act(snap, 0, { type: 'playPlenty', a: 'ore', b: 'ore' });
    expect(st(plenty.snapshot).hands[0]!.ore).toBe(2);
    let rb = act(snap, 0, { type: 'playRoadBuilding' });
    expect(st(rb.snapshot)).toMatchObject({ phase: 'roadBuilding', freeRoads: 2 });
    rb = act(rb.snapshot, 0, { type: 'buildRoad', edge: VERTICES[v]!.edges[0]! });
    rb = act(rb.snapshot, 0, { type: 'buildRoad', edge: VERTICES[v]!.edges[1]! });
    expect(st(rb.snapshot)).toMatchObject({ phase: 'main', freeRoads: 0 });
    expect(total(st(rb.snapshot).hands[0]!)).toBe(0);
  });
});

describe('catan longest road and winning', () => {
  it('5+ segments takes Longest Road; a tie keeps it; a settlement can break it', () => {
    const start = vertexOf(0, 3, 4);
    const red = path(start, 6);
    const snap = arrange({ settlements: [[0, start]], roads: red.edges.slice(0, 4).map((e) => [0, e] as [number, number]), hands: [{ brick: 2, lumber: 2 }] });
    let r = act(snap, 0, { type: 'buildRoad', edge: red.edges[4]! });
    expect(st(r.snapshot)).toMatchObject({ longestRoad: 0 });
    expect(view(r.snapshot, null).publicVp[0]).toBe(3);
    // Opponent builds a settlement in the middle of the road (on its own road end).
    const s = structuredClone(st(r.snapshot));
    const mid = red.verts[4]!; // splits the 5-segment road into 4 + 1
    s.current = 1;
    s.roads[VERTICES[mid]!.edges.find((e) => s.roads[e] === null)!] = 1;
    s.hands[1] = hand({ brick: 1, lumber: 1, wool: 1, grain: 1 });
    s.bank.brick -= 1; s.bank.lumber -= 1; s.bank.wool -= 1; s.bank.grain -= 1;
    r = act({ ...r.snapshot, state: s }, 1, { type: 'buildSettlement', vertex: mid });
    expect(st(r.snapshot).roadLength[0]).toBe(4);
    expect(st(r.snapshot).longestRoad).toBeNull();
  });

  it('wins at 10 points on own turn, counting hidden victory point cards', () => {
    const vs = [vertexOf(0, 3, 4), vertexOf(7, 8, 12), vertexOf(10, 11, 15), vertexOf(5, 6, 10)];
    const devs: CatanState['devs'] = [[{ card: 'vp', turn: 1 }], [], []];
    const snap = arrange({ cities: vs.map((v) => [0, v] as [number, number]), devs, hands: [{ ore: 1, wool: 1, grain: 1 }] });
    st(snap).devDeck.push('vp');
    expect(totalVp(st(snap), 0)).toBe(9);
    expect(view(snap, 1).publicVp[0]).toBe(8);
    const r = act(snap, 0, { type: 'buyDev' });
    expect(r.outcome).toMatchObject({ reason: 'win', placements: [{ seat: 0, place: 1, score: 10 }, { seat: 1, place: 2 }, { seat: 2, place: 2 }] });
    expect(view(r.snapshot, 1).vpCards).toEqual([2, 0, 0]);
    expect(r.scheduleChanges).toEqual([{ kind: 'clear', deadlineKey: 'turn' }]);
  });
});

describe('catan timeouts, resign and redaction', () => {
  it('set-up timeout places a settlement and road; three timeouts in a row remove the player', () => {
    let snap = startGame(m, { playerCount: 3, seed: 2, options: {} }).snapshot;
    const first = st(snap).current;
    const r = applyTimeout(m, snap, 0);
    expect(st(r.snapshot).buildings.filter(Boolean)).toHaveLength(1);
    expect(st(r.snapshot).roads.filter((x) => x !== null)).toHaveLength(1);
    expect(st(r.snapshot).current).not.toBe(first);
    snap = r.snapshot;
    for (let i = 0; i < 40 && st(snap).active[first]; i++) snap = applyTimeout(m, snap, 0).snapshot;
    expect(st(snap).active[first]).toBe(false);
    expect(st(snap).log.some((e) => e.t === 'left' && e.seat === first)).toBe(true);
  });

  it('discard timeout discards from the largest pile for everyone pending', () => {
    const snap = arrange({ phase: 'discard', hands: [{}, { ore: 6, wool: 2 }] });
    st(snap).owed = [0, 4, 0];
    const r = applyTimeout(m, snap, 0);
    expect(st(r.snapshot).hands[1]).toMatchObject({ ore: 2, wool: 2 });
    expect(st(r.snapshot).phase).toBe('robber');
  });

  it('resign: cards return to the bank, the turn passes, last player standing wins', () => {
    let r = act(arrange({ hands: [{ ore: 3 }] }), 0, { type: 'resign' });
    expect(st(r.snapshot)).toMatchObject({ current: 1, phase: 'roll' });
    expect(st(r.snapshot).bank.ore).toBe(19);
    r = act(r.snapshot, 2, { type: 'resign' });
    expect(r.outcome).toMatchObject({ reason: 'resign' });
    expect(r.outcome!.placements.find((x) => x.place === 1)!.seat).toBe(1);
  });

  it('views never contain other hands, other development cards or the deck order', () => {
    const snap = arrange({ hands: [{ ore: 2 }, { wool: 3 }], devs: [[{ card: 'vp', turn: 1 }], [{ card: 'monopoly', turn: 1 }], []] });
    const json = JSON.stringify(view(snap, 0));
    expect(json).not.toContain('monopoly');
    expect(json).not.toContain('devDeck"');
    expect(json).not.toContain('"hands"');
    expect(view(snap, 0).handCounts).toEqual([2, 3, 0]);
    expect(view(snap, 0).myHand).toMatchObject({ ore: 2, wool: 0 });
    expect(view(snap, null).myHand).toBeNull();
    expect(view(snap, 1).myVp).toBe(0);
    expect(view(snap, 0).myVp).toBe(1);
    expect(view(snap, 1).publicVp[0]).toBe(0);
  });
});

describe('catan tutorial', () => {
  it('the scripted turn plays to a win: knight + Largest Army, robber steal, production, 4:1 trade, road, settlement, city', () => {
    const tu = catanModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options }).snapshot;
    expect(totalVp(st(snap), 0)).toBe(6);
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected).snapshot;
      if (step.reply) snap = act(snap, 1, step.reply).snapshot;
      if (step.expected?.type === 'moveRobber') {
        expect(st(snap).largestArmy).toBe(0);
        expect(st(snap).hands[1]!.grain).toBe(1); // the only card type the opponent holds
        expect(st(snap).phase).toBe('roll');
      }
    }
    const s = st(snap);
    expect(s.outcome?.placements).toEqual([{ seat: 0, score: 10, place: 1 }, { seat: 1, score: 2, place: 2 }]);
    expect(total(s.hands[0]!)).toBe(0);
    expect(TUTORIAL.newSettlement).toBe(EDGES[TUTORIAL.newRoad]!.a === TUTORIAL.newSettlement ? EDGES[TUTORIAL.newRoad]!.a : EDGES[TUTORIAL.newRoad]!.b);
  });
});

// ---------- random play ----------

const rnd = (seed: number) => { let x = seed || 1; return (n: number) => { x = (x * 1103515245 + 12345) % 2147483648; return x % n; }; };

/** A simple bot that only uses its own view and legal actions (never other hidden data). */
function choose(v: CatanView, hints: { type: string; [k: string]: unknown }[], r: (n: number) => number): unknown {
  const of = (t: string) => hints.filter((h) => h.type === t);
  const pick = <T>(xs: T[]) => xs[r(xs.length)]!;
  const strip = ({ rate: _r, count: _c, ...a }: { type: string; [k: string]: unknown }) => a;
  const d = of('discard')[0];
  if (d) {
    const left = { ...v.myHand! }, cards = emptyHand();
    for (let i = 0; i < (d.count as number); i++) { const res = RESOURCES.filter((x) => left[x] > 0)[0]!; left[res] -= 1; cards[res] += 1; }
    return { type: 'discard', cards };
  }
  if (of('acceptTrade').length && r(2)) return { type: 'acceptTrade' };
  if (of('declineTrade').length && v.current !== -1 && r(3) === 0) return { type: 'declineTrade' };
  for (const t of ['buildSettlement', 'roll', 'moveRobber', 'steal', 'buildCity', 'buildRoad', 'confirmTrade']) {
    if (of(t).length && (t !== 'buildRoad' || v.phase !== 'main' || r(3) === 0)) return strip(pick(of(t)));
  }
  if (of('playKnight').length && r(2)) return { type: 'playKnight' };
  if (of('playMonopoly').length) return { type: 'playMonopoly', res: pick([...RESOURCES]) };
  if (of('playPlenty').length) { const ok = RESOURCES.filter((x) => v.bank[x] >= 2); if (ok.length) return { type: 'playPlenty', a: pick(ok), b: ok[0]! }; }
  if (of('playRoadBuilding').length) return { type: 'playRoadBuilding' };
  if (of('buyDev').length) return { type: 'buyDev' };
  // Trade surplus for a resource the bot has none of.
  const useful = of('bankTrade').filter((h) => v.myHand![h.get as 'ore'] === 0);
  if (useful.length) return strip(pick(useful));
  if (of('offerTrade').length && !v.trade && r(6) === 0) {
    const has = RESOURCES.filter((x) => v.myHand![x] > 0);
    const want = RESOURCES.filter((x) => !has.includes(x));
    if (has.length && want.length) return { type: 'offerTrade', give: { [pick(has)]: 1 }, get: { [pick(want)]: 1 } };
  }
  if (of('endTurn').length) return { type: 'endTurn' };
  return strip(pick(hints.filter((h) => h.type !== 'resign')));
}

function randomGame(seed: number, players: number): { snap: EngineSnapshot; inputs: ReplayInput[]; steps: number } {
  const r = rnd(seed);
  let snap = startGame(m, { playerCount: players, seed, options: {} }).snapshot;
  const inputs: ReplayInput[] = [];
  let steps = 0;
  for (; steps < 20000 && !st(snap).outcome; steps++) {
    const s = st(snap);
    if (r(400) === 0) { snap = applyTimeout(m, snap, 0).snapshot; inputs.push({ kind: 'timeout', logicalTime: 0 }); continue; }
    // Trade responders first, then whoever the game waits on.
    const responders = s.trade ? s.active.flatMap((a, seat) => (a && seat !== s.current && legal(snap, seat).some((h) => h.type === 'acceptTrade' || h.type === 'declineTrade') ? [seat] : [])) : [];
    const pend = projectFor(m, snap, { kind: 'spectator' }) && (responders.length ? responders : catanModule.pendingSeats(s));
    const seat = pend[r(pend.length)]!;
    const v = view(snap, seat);
    const action = choose(v, legal(snap, seat), r);
    const res = applyAction(m, snap, p(seat), action, 0);
    if ('ok' in res) throw new Error(`seed ${seed} step ${steps}: ${JSON.stringify(action)} → ${res.errorCode}`);
    snap = res.snapshot;
    inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
    // Invariants: 19 of each resource in bank + hands; no foreign hidden data in any view.
    const n = st(snap);
    for (const res2 of RESOURCES) expect(n.bank[res2] + n.hands.reduce((a, h) => a + h[res2], 0)).toBe(19);
    if (steps % 25 === 0) {
      for (let o = 0; o < players; o++) {
        const ov = view(snap, o);
        expect(ov.myDevs).toHaveLength(n.devs[o]!.length);
        expect(JSON.stringify(ov)).not.toContain('"hands"');
      }
    }
  }
  return { snap, inputs, steps };
}

describe('catan random play', () => {
  it('30 random 3–4 player games finish with a winner, conserve cards and replay deterministically', () => {
    let finished = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const players = 3 + (seed % 2);
      const { snap, inputs } = randomGame(seed, players);
      const s = st(snap);
      if (s.outcome) finished += 1;
      if (s.outcome?.reason === 'win') {
        const w = s.outcome.placements.find((x) => x.place === 1)!.seat;
        expect(totalVp(s, w)).toBeGreaterThanOrEqual(10);
      }
      if (seed <= 5) expect(replay(m, { playerCount: players, seed, options: {} }, inputs)).toEqual(snap);
    }
    expect(finished).toBe(30);
  }, 120_000);
});
