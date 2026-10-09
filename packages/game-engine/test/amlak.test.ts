import { describe, expect, it } from 'vitest';
import { amlakModule, BOARD, CHANCE, CHEST, HOUSES, HOTELS, netWorth, rentFor, type AmlakState } from '@bg/game-amlak';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = amlakModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as AmlakState;
function act(snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
}
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
/** A game with seat 0 to move; patch state fields; `dice` are the next rolls. */
function game(players = 2, patch: (s: AmlakState) => void = () => {}, options: Record<string, unknown> = {}): EngineSnapshot {
  const snap = startGame(m, { playerCount: players, seed: 1, options }).snapshot;
  const s = structuredClone(st(snap));
  s.order = Array.from({ length: players }, (_, i) => i);
  s.current = 0;
  patch(s);
  return { ...snap, state: s };
}
const own = (s: AmlakState, seat: number, ...sqs: number[]) => { for (const i of sqs) s.owner[i] = seat; };

describe('amlak board', () => {
  it('40 squares, 28 properties, 16 + 16 cards', () => {
    expect(BOARD).toHaveLength(40);
    expect(BOARD.filter((b) => ['street', 'station', 'utility'].includes(b.kind))).toHaveLength(28);
    expect(CHANCE).toHaveLength(16);
    expect(CHEST).toHaveLength(16);
    const s = st(game());
    expect(s.p.every((x) => x.cash === 1500 && x.pos === 0)).toBe(true);
    // Deck order stays on the server.
    const v = projectFor(m, game(), { kind: 'spectator' }).view as Record<string, unknown>;
    expect(v.chance).toBeUndefined();
    expect(v.deckCounts).toEqual({ chance: 16, chest: 16 });
  });
});

describe('amlak turns', () => {
  it('roll, land on an unowned property, buy it, end the turn', () => {
    let snap = game(2, (s) => { s.script = [[2, 4]]; });
    expect(reject(snap, 1, { type: 'roll' })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'roll' });
    expect(st(snap)).toMatchObject({ phase: 'buy' });
    expect(st(snap).p[0]!.pos).toBe(6);
    snap = act(snap, 0, { type: 'buy' });
    expect(st(snap).owner[6]).toBe(0);
    expect(st(snap).p[0]!.cash).toBe(1400);
    expect(st(snap).phase).toBe('end');
    snap = act(snap, 0, { type: 'endTurn' });
    expect(st(snap)).toMatchObject({ current: 1, phase: 'roll' });
  });

  it('doubles roll again; a third double sends you to jail; passing Go pays the salary', () => {
    let snap = game(2, (s) => { s.script = [[1, 1], [2, 2], [3, 3]]; own(s, 1, 2 + 0); });
    snap = act(snap, 0, { type: 'roll' }); // 2: chest
    snap = { ...snap, state: { ...st(snap), debts: [] } };
    while (st(snap).phase !== 'roll') snap = act(snap, 0, st(snap).phase === 'buy' ? { type: 'decline' } : st(snap).phase === 'auction' ? { type: 'pass' } : { type: 'endTurn' });
    snap = act(snap, 0, { type: 'roll' });
    while (st(snap).phase !== 'roll') snap = act(snap, st(snap).phase === 'auction' ? st(snap).auction!.turn : 0, st(snap).phase === 'buy' ? { type: 'decline' } : { type: 'pass' });
    snap = act(snap, 0, { type: 'roll' });
    expect(st(snap).p[0]).toMatchObject({ pos: 10, inJail: true });
    expect(st(snap).phase).toBe('end');
    const go = act(game(2, (s) => { s.p[0]!.pos = 38; s.script = [[1, 3]]; }), 0, { type: 'roll' }); // 38 → 2 (chest)
    expect(st(go).log.some((e) => e.t === 'move' && e.salary === 200)).toBe(true);
  });

  it('rent: base, doubled for a full colour group, by houses; stations and utilities', () => {
    const s = st(game(2, (x) => { own(x, 1, 1, 3, 5, 15, 12); }));
    expect(rentFor(s, 1, 7)).toBe(4); // full brown group: 2 × 2
    s.houses[1] = 3;
    expect(rentFor(s, 1, 7)).toBe(90);
    expect(rentFor(s, 5, 7)).toBe(50); // two stations
    expect(rentFor(s, 5, 7, 'station2')).toBe(100);
    expect(rentFor(s, 12, 7)).toBe(28); // one utility: 4 × dice
    s.owner[28] = 1;
    expect(rentFor(s, 12, 7)).toBe(70);
    let snap = game(2, (x) => { own(x, 1, 6); x.script = [[2, 4]]; });
    snap = act(snap, 0, { type: 'roll' });
    expect(st(snap).p[0]!.cash).toBe(1494);
    expect(st(snap).p[1]!.cash).toBe(1506);
    // Mortgaged property collects no rent.
    snap = act(game(2, (x) => { own(x, 1, 6); x.mortgaged[6] = true; x.script = [[2, 4]]; }), 0, { type: 'roll' });
    expect(st(snap).p[0]!.cash).toBe(1500);
  });

  it('declining starts an auction; the highest bid wins; without the auction option the bank keeps it', () => {
    let snap = game(3, (s) => { s.script = [[2, 4]]; });
    snap = act(snap, 0, { type: 'roll' });
    snap = act(snap, 0, { type: 'decline' });
    expect(st(snap).auction).toMatchObject({ sq: 6, seats: [0, 1, 2], turn: 0 });
    snap = act(snap, 0, { type: 'bid', amount: 20 });
    expect(reject(snap, 1, { type: 'bid', amount: 20 })).toBe('BID_TOO_LOW');
    snap = act(snap, 1, { type: 'bid', amount: 50 });
    snap = act(snap, 2, { type: 'pass' });
    snap = act(snap, 0, { type: 'pass' });
    expect(st(snap).owner[6]).toBe(1);
    expect(st(snap).p[1]!.cash).toBe(1450);
    expect(st(snap)).toMatchObject({ phase: 'end', current: 0, auction: null });
    let none = game(2, (s) => { s.script = [[2, 4]]; }, { auction: false });
    none = { ...none, state: { ...st(none), rules: { ...st(none).rules, auction: false } } };
    none = act(act(none, 0, { type: 'roll' }), 0, { type: 'decline' });
    expect(st(none)).toMatchObject({ phase: 'end', auction: null });
    expect(st(none).owner[6]).toBeNull();
  });

  it('building needs the full group, goes evenly, uses the bank supply; hotels; selling evenly; mortgages', () => {
    let snap = game(2, (s) => { own(s, 0, 1); });
    expect(reject(snap, 0, { type: 'build', sq: 1 })).toBe('NEED_FULL_GROUP');
    snap = game(2, (s) => { own(s, 0, 1, 3); });
    snap = act(snap, 0, { type: 'build', sq: 1 });
    expect(reject(snap, 0, { type: 'build', sq: 1 })).toBe('BUILD_EVENLY');
    for (let k = 0; k < 9; k++) snap = act(snap, 0, { type: 'build', sq: k % 2 ? 1 : 3 });
    expect(st(snap).houses.slice(0, 4)).toEqual([0, 5, 0, 5]);
    expect(st(snap).housesLeft).toBe(HOUSES);
    expect(st(snap).hotelsLeft).toBe(HOTELS - 2);
    expect(st(snap).p[0]!.cash).toBe(1500 - 10 * 50);
    expect(reject(snap, 0, { type: 'mortgage', sq: 1 })).toBe('SELL_BUILDINGS_FIRST');
    snap = act(snap, 0, { type: 'sell', sq: 1 });
    expect(reject(snap, 0, { type: 'sell', sq: 1 })).toBe('SELL_EVENLY');
    expect(st(snap).housesLeft).toBe(HOUSES - 4);
    snap = game(2, (s) => { own(s, 0, 5); });
    snap = act(snap, 0, { type: 'mortgage', sq: 5 });
    expect(st(snap).p[0]!.cash).toBe(1600);
    snap = act(snap, 0, { type: 'unmortgage', sq: 5 });
    expect(st(snap).p[0]!.cash).toBe(1490); // 100 + 10% interest
  });

  it('jail: bail, card, or three failed rolls then pay and move', () => {
    const jailed = (patch: (s: AmlakState) => void = () => {}) => game(2, (s) => { s.p[0]!.pos = 10; s.p[0]!.inJail = true; patch(s); });
    let snap = act(jailed(), 0, { type: 'payBail' });
    expect(st(snap).p[0]).toMatchObject({ inJail: false, cash: 1450 });
    snap = act(jailed((s) => { s.p[0]!.jailCards = ['ch-free']; s.chance = s.chance.filter((c) => c !== 'ch-free'); }), 0, { type: 'useCard' });
    expect(st(snap).p[0]!.inJail).toBe(false);
    expect(st(snap).chance.at(-1)).toBe('ch-free');
    snap = jailed((s) => { s.script = [[1, 2], [1, 3], [1, 4]]; });
    snap = act(snap, 0, { type: 'roll' });
    expect(st(snap)).toMatchObject({ phase: 'end' });
    snap = { ...snap, state: { ...st(snap), current: 0, phase: 'roll' } };
    snap = act(snap, 0, { type: 'roll' });
    snap = { ...snap, state: { ...st(snap), current: 0, phase: 'roll' } };
    snap = act(snap, 0, { type: 'roll' });
    expect(st(snap).p[0]).toMatchObject({ inJail: false, pos: 15 });
    expect(st(snap).p[0]!.cash).toBeLessThanOrEqual(1450);
  });

  it('cards: nearest station pays double rent; birthday collects from everyone; repairs', () => {
    let snap = game(3, (s) => { s.p[0]!.pos = 4; s.script = [[1, 2]]; s.chance = ['ch-station1', ...s.chance.filter((c) => c !== 'ch-station1')]; own(s, 1, 15); });
    snap = act(snap, 0, { type: 'roll' }); // 7: Chance → station 15 owned by seat 1 → 2 × 25
    expect(st(snap).p[0]!.pos).toBe(15);
    expect(st(snap).p[1]!.cash).toBe(1550);
    snap = act(game(3, (s) => { s.script = [[1, 1]]; s.chest = ['cc-birthday', ...s.chest.filter((c) => c !== 'cc-birthday')]; }), 0, { type: 'roll' });
    expect(st(snap).p.map((x) => x.cash)).toEqual([1520, 1490, 1490]);
    snap = act(game(2, (s) => { s.p[0]!.pos = 4; s.script = [[1, 2]]; own(s, 0, 1, 3); s.houses[1] = 2; s.houses[3] = 5; s.chance = ['ch-repairs', ...s.chance.filter((c) => c !== 'ch-repairs')]; }), 0, { type: 'roll' });
    expect(st(snap).p[0]!.cash).toBe(1500 - (2 * 25 + 100));
  });

  it('debts: mortgage to pay; automatic bankruptcy when everything would not cover it; assets go to the creditor', () => {
    let snap = game(2, (s) => { s.p[0]!.cash = 3; own(s, 0, 5); own(s, 1, 6); s.script = [[2, 4]]; });
    snap = act(snap, 0, { type: 'roll' });
    expect(st(snap)).toMatchObject({ phase: 'debt' });
    expect(projectFor(m, snap, p(0)).legalActions.some((h) => h.type === 'mortgage' && h.sq === 5)).toBe(true);
    snap = act(snap, 0, { type: 'mortgage', sq: 5 });
    expect(st(snap)).toMatchObject({ phase: 'end', debts: [] });
    expect(st(snap).p[0]!.cash).toBe(3 + 100 - 6);
    let broke = game(2, (s) => { s.p[0]!.cash = 5; own(s, 0, 1); s.mortgaged[1] = true; s.p[0]!.jailCards = ['cc-free']; own(s, 1, 6); s.script = [[2, 4]]; });
    broke = act(broke, 0, { type: 'roll' });
    expect(st(broke).p[0]!.bankrupt).toBe(true);
    expect(st(broke).owner[1]).toBe(1);
    expect(st(broke).mortgaged[1]).toBe(true);
    expect(st(broke).p[1]!.jailCards).toEqual(['cc-free']);
    expect(st(broke).outcome).toEqual({ reason: 'win', placements: [{ seat: 1, place: 1 }, { seat: 0, place: 2 }] });
  });

  it('trades: offer, accept (10% interest on mortgaged property), reject, and no buildings in traded groups', () => {
    let snap = game(2, (s) => { own(s, 0, 6); own(s, 1, 39); s.mortgaged[39] = true; });
    const offer = { type: 'offer', to: 1, give: { cash: 100, props: [6], cards: [] }, get: { cash: 0, props: [39], cards: [] } };
    snap = act(snap, 0, offer);
    expect(reject(snap, 0, { type: 'roll' })).toBe('TRADE_PENDING');
    expect(projectFor(m, snap, p(1)).legalActions.map((h) => h.type)).toContain('acceptTrade');
    snap = act(snap, 1, { type: 'acceptTrade' });
    expect(st(snap).owner[6]).toBe(1);
    expect(st(snap).owner[39]).toBe(0);
    expect(st(snap).p[0]!.cash).toBe(1500 - 100 - 20);
    expect(st(snap).p[1]!.cash).toBe(1600);
    const rej = act(act(game(2, (s) => { own(s, 0, 6); }), 0, { ...offer, get: { cash: 50, props: [], cards: [] } }), 1, { type: 'rejectTrade' });
    expect(st(rej).owner[6]).toBe(0);
    const built = game(2, (s) => { own(s, 0, 1, 3); s.houses[3] = 1; });
    expect(reject(built, 0, { type: 'offer', to: 1, give: { cash: 0, props: [1], cards: [] }, get: { cash: 10, props: [], cards: [] } })).toBe('PROPERTY_NOT_TRADABLE');
  });

  it('house rules: Free Parking jackpot and double salary on Go', () => {
    let snap = game(2, (s) => { s.p[0]!.pos = 2; s.script = [[1, 1], [6, 6]]; s.rules.freeParking = true; });
    snap = act(snap, 0, { type: 'roll' }); // 4: income tax → pot
    expect(st(snap).pot).toBe(200);
    const pk = act(game(2, (s) => { s.p[0]!.pos = 14; s.pot = 300; s.script = [[2, 4]]; s.rules.freeParking = true; }), 0, { type: 'roll' });
    expect(st(pk).p[0]!.cash).toBe(1800);
    const go = act(game(2, (s) => { s.p[0]!.pos = 34; s.script = [[2, 4]]; s.rules.doubleGo = true; }), 0, { type: 'roll' });
    expect(st(go).p[0]!.cash).toBe(1900);
  });

  it('round limit ends the game by net worth; resign and timeouts', () => {
    let snap = game(2, (s) => { s.rules.rounds = 1; own(s, 1, 39); s.phase = 'end'; s.current = 1; });
    snap = act(snap, 1, { type: 'endTurn' });
    expect(st(snap).outcome).toEqual({ reason: 'score', placements: [{ seat: 0, place: 2 }, { seat: 1, place: 1 }] });
    expect(netWorth(st(snap), 1)).toBe(1900);
    const r = act(game(3), 1, { type: 'resign' });
    expect(st(r).p[1]!.bankrupt).toBe(true);
    expect(st(r).outcome).toBeNull();
    let t = game(2);
    for (let i = 0; i < 30 && !st(t).outcome; i++) t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).outcome?.reason).toBe('win');
  });

  it('tutorial: auction, trade for the full group, even building, rent bankrupts the opponent', () => {
    const tut = amlakModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tut.seed, options: tut.options }).snapshot;
    for (const step of tut.steps) { snap = act(snap, 0, step.expected); if (step.reply) snap = act(snap, 1, step.reply); }
    const s = st(snap);
    expect(s.outcome?.placements).toEqual([{ seat: 0, place: 1 }, { seat: 1, place: 2 }]);
    expect(s.owner[1]).toBe(0); expect(s.owner[3]).toBe(0); expect(s.owner[5]).toBe(0);
    expect([s.houses[1], s.houses[3]]).toEqual([1, 2]);
    expect(s.p[0]!.cash).toBe(500 - 1 - 50 - 150 + 55);
    expect(s.p[1]!.bankrupt).toBe(true);
  });

  it('random games keep money and buildings consistent and replay deterministically', () => {
    let finished = 0;
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 900 + g });
      const players = 2 + (g % 5);
      const setup = { playerCount: players, seed: g, options: { gameLength: 'rounds20', freeParking: g % 2 === 1, doubleGo: g % 3 === 0 } };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 8000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.trade ? s.trade.to : s.phase === 'auction' ? s.auction!.turn : s.phase === 'debt' ? s.debts[0]!.seat : s.current;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        let h = hints[rng.nextInt(hints.length)]!;
        // Keep games moving: prefer the main flow most of the time.
        const main = hints.filter((x) => ['roll', 'buy', 'endTurn', 'pass', 'acceptTrade', 'rejectTrade', 'payBail'].includes(x.type));
        if (main.length && rng.nextInt(4)) h = main[rng.nextInt(main.length)]!;
        let action: Record<string, unknown> = { type: h.type, ...(h.sq !== undefined ? { sq: h.sq } : {}) };
        if (h.type === 'bid') action = { type: 'bid', amount: Math.min(h.max as number, (h.min as number) + rng.nextInt(30)) };
        if (h.type === 'offer') {
          const mine = s.owner.map((o, i) => (o === seat && !s.houses[i] ? i : -1)).filter((i) => i >= 0);
          action = { type: 'offer', to: h.to, give: { cash: 0, props: mine.slice(0, 1), cards: [] }, get: { cash: Math.min(10, s.p[h.to as number]!.cash), props: [], cards: [] } };
          if (!mine.length) action = { type: 'endTurn' };
        }
        if (h.type === 'bid' && (action.amount as number) < (h.min as number)) action = { type: 'pass' };
        const r = applyAction(m, snap, p(seat), action, 0);
        if ('ok' in r) continue; // e.g. an endTurn substitute that is not legal now
        snap = r.snapshot;
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const after = st(snap);
        expect(after.p.every((x) => x.cash >= 0)).toBe(true);
        const houses = after.houses.reduce((a, h2) => a + (h2 === 5 ? 0 : h2), 0);
        const hotels = after.houses.filter((h2) => h2 === 5).length;
        expect(after.housesLeft + houses).toBe(HOUSES);
        expect(after.hotelsLeft + hotels).toBe(HOTELS);
        expect(after.chance.length + after.chest.length + after.p.reduce((a, x) => a + x.jailCards.length, 0)).toBe(32);
      }
      if (st(snap).outcome) finished++;
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
    expect(finished).toBe(30);
  }, 300_000);
});
