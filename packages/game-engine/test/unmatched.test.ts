import { describe, expect, it } from 'vitest';
import { BOARDS, HEROES, adjacency, unmatchedModule, type UnmatchedState, type UnmatchedView } from '@bg/game-unmatched';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = unmatchedModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as UnmatchedState;
const view = (s: EngineSnapshot, seat: number | null) => projectFor(m, s, seat === null ? { kind: 'spectator' } : p(seat)).view as UnmatchedView;
const legal = (s: EngineSnapshot, seat: number) => projectFor(m, s, p(seat)).legalActions;
const cid = (seat: number, slug: string, k = 1) => `${seat}.${slug}.${k}`;

function act(snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)} → ${r.errorCode}`);
  return r.snapshot;
}
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const promptOf = (snap: EngineSnapshot) => st(snap).prompt!;

/** Start a game where seat i picks heroes[i]; deploy sidekicks on their first legal space; Alice starts `size`. */
function game(heroes: string[], o: { seed?: number; map?: string; size?: 'big' | 'small' } = {}): EngineSnapshot {
  let snap = startGame(m, { playerCount: heroes.length, seed: o.seed ?? 3, options: { map: o.map ?? 'marmoreal' } }).snapshot;
  for (let guard = 0; guard < 40; guard++) {
    const pr = promptOf(snap);
    if (pr.kind === 'action') return snap;
    if (pr.kind === 'pickHero') snap = act(snap, pr.seat, { type: 'pickHero', hero: heroes[pr.seat] });
    else if (pr.kind === 'place') snap = act(snap, pr.seat, { type: 'choose', ids: [String(pr.spaces![0])] });
    else if (pr.kind === 'size') snap = act(snap, pr.seat, { type: 'size', size: o.size ?? 'big' });
    else if (pr.kind === 'space') snap = act(snap, pr.seat, { type: 'choose', ids: [String(pr.spaces![0])] }); // fog deployment
    else if (pr.kind === 'option') snap = act(snap, pr.seat, { type: 'choose', ids: [pr.options![0]!] }); // Jekyll: stay
    else if (pr.kind === 'fighter' && pr.may) snap = act(snap, pr.seat, { type: 'done' }); // start-of-turn abilities
    else throw new Error(`unexpected prompt ${pr.kind}`);
  }
  throw new Error('setup did not finish');
}

/** Rewrite a started game: whose turn, positions, hands (card slugs) and health. */
function arrange(snap: EngineSnapshot, o: { current: number; at?: Record<string, number | null>; hands?: Record<number, string[]>; hp?: Record<string, number>; deck?: Record<number, string[]> }): EngineSnapshot {
  const s = structuredClone(st(snap));
  for (const f of s.fighters) if (o.at && f.id in o.at) f.space = o.at[f.id]!;
  for (const [fid, hp] of Object.entries(o.hp ?? {})) s.fighters.find((f) => f.id === fid)!.hp = hp;
  for (const [seatStr, slugs] of Object.entries(o.hands ?? {})) {
    const seat = Number(seatStr);
    const pool = [...s.decks[seat]!, ...s.hands[seat]!, ...s.discards[seat]!];
    const used = new Set<string>();
    // Lowest copy number first, so tests can name cards as cid(seat, slug) / cid(seat, slug, 2).
    const picked = slugs.map((slug) => { let k = 1; while (used.has(cid(seat, slug, k))) k++; const c = cid(seat, slug, k); if (!pool.includes(c)) throw new Error(c); used.add(c); return c; });
    s.hands[seat] = picked;
    s.discards[seat] = [];
    s.decks[seat] = pool.filter((c) => !used.has(c));
    if (o.deck?.[seat]) s.decks[seat] = o.deck[seat]!.map((slug) => { const c = s.decks[seat]!.find((x) => x.split('.')[1] === slug)!; return c; }).reverse();
  }
  s.current = o.current;
  s.actionsLeft = 2;
  s.actionNo = 0;
  s.tookTurn = s.tookTurn.map(() => true);
  s.turnStart = Object.fromEntries(s.fighters.map((f) => [f.id, f.space]));
  s.stack = [{ kind: 'turn', seat: o.current, step: 1 }];
  s.prompt = { kind: 'action', seat: o.current, why: 'action' };
  s.combat = null;
  return { ...snap, state: s };
}
const hp = (snap: EngineSnapshot, fid: string) => st(snap).fighters.find((f) => f.id === fid)!.hp;
const at = (snap: EngineSnapshot, fid: string) => st(snap).fighters.find((f) => f.id === fid)!.space;

describe('unmatched data', () => {
  it('each Volume One hero has a 30-card deck, and both battlefields are connected with four start spaces', () => {
    for (const h of Object.values(HEROES)) expect(h.cards.reduce((a, c) => a + c.count, 0)).toBe(30);
    for (const b of Object.values(BOARDS)) {
      expect(new Set(b.starts).size).toBe(4);
      const adj = adjacency(b);
      const seen = new Set([0]);
      const q = [0];
      while (q.length) for (const n of adj[q.shift()!]!) if (!seen.has(n)) { seen.add(n); q.push(n); }
      expect(seen.size).toBe(b.spaces.length);
    }
    expect(BOARDS.marmoreal!.spaces).toHaveLength(31);
    expect(BOARDS.sarpedon!.spaces).toHaveLength(38);
  });
});

describe('unmatched setup', () => {
  it('heroes are picked in turn order without duplicates, then deployed on start spaces with sidekicks in the zone', () => {
    let snap = startGame(m, { playerCount: 2, seed: 4, options: { map: 'sarpedon' } }).snapshot;
    const first = st(snap).order[0]!;
    expect(promptOf(snap)).toMatchObject({ kind: 'pickHero', seat: first });
    snap = act(snap, first, { type: 'pickHero', hero: 'medusa' });
    expect(reject(snap, 1 - first, { type: 'pickHero', hero: 'medusa' })).toBe('HERO_TAKEN');
    snap = game(['medusa', 'alice'], { seed: 4, map: 'sarpedon', size: 'small' });
    const s = st(snap);
    const board = BOARDS.sarpedon!;
    s.order.forEach((seat, i) => expect(s.fighters.find((f) => f.id === `${seat}h`)!.space).toBe(board.starts[i]));
    const medusa = s.fighters.find((f) => f.id === '0h')!;
    for (const h of s.fighters.filter((f) => f.seat === 0 && !f.hero)) {
      expect(board.spaces[h.space!]!.zones.some((z) => board.spaces[medusa.space!]!.zones.includes(z))).toBe(true);
    }
    expect(s.hands.map((h) => h.length)).toEqual([5, 5]);
    expect(s.decks.map((d) => d.length)).toEqual([25, 25]);
    expect(s.size[1]).toBe('small');
    expect(promptOf(snap)).toMatchObject({ kind: 'action', seat: first });
    expect(game(['arthur', 'sinbad'], { seed: 9 })).toEqual(game(['arthur', 'sinbad'], { seed: 9 }));
  });
});

describe('unmatched maneuver', () => {
  it('draws, boosts, moves through friends but not through opponents, and ends on empty spaces', () => {
    // Arthur 15, Merlin 7 (friendly, on the way), Medusa blocks 20.
    let snap = arrange(game(['arthur', 'medusa']), { current: 0, at: { '0h': 15, '0s0': 7, '1h': 20, '1s0': 27, '1s1': 29, '1s2': 28 }, hands: { 0: ['excalibur', 'regroup'] } });
    snap = act(snap, 0, { type: 'maneuver' });
    expect(st(snap).hands[0]).toHaveLength(3);
    expect(promptOf(snap)).toMatchObject({ kind: 'boost', seat: 0 });
    snap = act(snap, 0, { type: 'choose', ids: [cid(0, 'excalibur')] }); // boost 3 → move 5
    const moves = legal(snap, 0).find((h) => h.type === 'move' && h.fighter === '0h') as unknown as { to: number[] };
    expect(moves.to).toContain(8); // 15 → 7 (Merlin, friendly) → 8
    expect(moves.to).not.toContain(7); // occupied
    expect(moves.to).not.toContain(27); // only reachable through Medusa on 20
    expect(reject(snap, 0, { type: 'move', fighter: '0h', to: 27 })).toBe('ILLEGAL_MOVE');
    snap = act(snap, 0, { type: 'move', fighter: '0h', to: 12 }); // 15-7-8-10-12
    expect(at(snap, '0h')).toBe(12);
    snap = act(snap, 0, { type: 'done' });
    expect(promptOf(snap)).toMatchObject({ kind: 'action', seat: 0 });
    expect(st(snap).actionsLeft).toBe(1);
  });

  it('Sinbad moves +1 per VOYAGE card in the discard pile; an empty deck exhausts every fighter for 2', () => {
    let snap = arrange(game(['sinbad', 'alice']), { current: 0, at: { '0h': 15, '0s0': 20, '1h': 26, '1s0': 30 }, hands: { 0: ['exploit'] } });
    const s = structuredClone(st(snap));
    s.discards[0] = [cid(0, 'voyage-home'), cid(0, 'voyage-to-the-island-that-was-a-whale')];
    snap = act({ ...snap, state: s }, 0, { type: 'maneuver' });
    snap = act(snap, 0, { type: 'choose', ids: [] });
    expect(st(snap).stack.at(-1)!.max).toBe(4);

    let ex = arrange(game(['sinbad', 'alice']), { current: 0, at: { '0h': 15, '0s0': 20, '1h': 26, '1s0': 30 }, hands: { 0: ['exploit'] } });
    const e = structuredClone(st(ex));
    e.decks[0] = [];
    ex = act({ ...ex, state: e }, 0, { type: 'maneuver' });
    expect(hp(ex, '0h')).toBe(13);
    expect(hp(ex, '0s0')).toBe(4);
  });
});

/** Arthur (seat 0) on 14 next to Medusa (seat 1) on 17. */
const duel = (hands: Record<number, string[]>, extra: Partial<Parameters<typeof arrange>[1]> = {}) =>
  arrange(game(['arthur', 'medusa']), { current: 0, at: { '0h': 14, '0s0': 8, '1h': 17, '1s0': 26, '1s1': 23, '1s2': 19 }, hands, ...extra });

describe('unmatched combat', () => {
  it('melee needs adjacency, ranged needs a shared zone; cards stay hidden until both are chosen', () => {
    let snap = duel({ 0: ['excalibur', 'skirmish'], 1: ['hiss-and-slither', 'second-shot'] });
    const attacks = legal(snap, 0).filter((h) => h.type === 'attack');
    expect(attacks.some((h) => h.fighter === '0h' && h.target === '1h')).toBe(true);
    expect(attacks.some((h) => h.target === '1s0')).toBe(false); // harpy far away
    expect(reject(snap, 0, { type: 'attack', fighter: '0h', target: '1s0', card: cid(0, 'excalibur') })).toBe('ILLEGAL_ATTACK');
    // Merlin (ranged) on 8 shares the green zone with Medusa on 17 although not adjacent; he may use ANY cards, not Arthur's.
    expect(attacks.some((h) => h.fighter === '0s0' && h.target === '1h' && h.card === cid(0, 'skirmish'))).toBe(true);
    expect(attacks.some((h) => h.fighter === '0s0' && h.card === cid(0, 'excalibur'))).toBe(false);

    snap = act(snap, 0, { type: 'attack', fighter: '0h', target: '1h', card: cid(0, 'excalibur') });
    expect(promptOf(snap)).toMatchObject({ kind: 'defend', seat: 1 });
    expect(view(snap, 1).combat!.aCard).toBeNull();
    expect(view(snap, null).combat!.aCard).toBeNull();
    expect(view(snap, 0).combat!.aCard!.slug).toBe('excalibur');
    expect(JSON.stringify(view(snap, 0))).not.toContain(cid(1, 'hiss-and-slither'));
    expect(reject(snap, 1, { type: 'defend', card: cid(1, 'second-shot') })).toBe('ILLEGAL_DEFENSE');
    snap = act(snap, 1, { type: 'defend', card: cid(1, 'hiss-and-slither') });
    // 6 − 4 = 2 combat damage; Hiss and Slither: Arthur's player discards 1 (only one card left → automatic).
    expect(hp(snap, '1h')).toBe(14);
    expect(st(snap).hands[0]).toEqual([]);
    expect(st(snap).discards[0]).toEqual([cid(0, 'skirmish'), cid(0, 'excalibur')]);
    expect(view(snap, 1).log.some((e) => e.t === 'reveal' && e.damage === 2)).toBe(true);
  });

  it('ranged fighters attack anywhere in a shared zone', () => {
    const snap = arrange(game(['medusa', 'sinbad']), { current: 0, at: { '0h': 8, '0s0': 26, '0s1': 23, '0s2': 19, '1h': 17, '1s0': 30 }, hands: { 0: ['snipe'] } });
    expect(legal(snap, 0).some((h) => h.type === 'attack' && h.fighter === '0h' && h.target === '1h')).toBe(true);
  });

  it('Feint cancels effects; Arthur loses his boost only if an effect on his card was cancelled', () => {
    // Swift Strike has an effect → cancelled → boost discarded without effect: 3 − 2 = 1.
    let snap = duel({ 0: ['swift-strike', 'excalibur'], 1: ['feint'] });
    snap = act(snap, 0, { type: 'attack', fighter: '0h', target: '1h', card: cid(0, 'swift-strike'), boost: cid(0, 'excalibur') });
    expect(view(snap, 1).combat!.hasBoost).toBe(true);
    expect(view(snap, 1).combat!.boost).toBeNull();
    snap = act(snap, 1, { type: 'defend', card: cid(1, 'feint') });
    expect(hp(snap, '1h')).toBe(15);
    expect(st(snap).prompt).toMatchObject({ kind: 'action', seat: 0 }); // no Swift Strike move offered
    // Excalibur has no effect to cancel → the boost (Swift Strike, 2) counts: 6 + 2 − 2 = 6.
    snap = duel({ 0: ['excalibur', 'swift-strike'], 1: ['feint'] });
    snap = act(snap, 0, { type: 'attack', fighter: '0h', target: '1h', card: cid(0, 'excalibur'), boost: cid(0, 'swift-strike') });
    snap = act(snap, 1, { type: 'defend', card: cid(1, 'feint') });
    expect(hp(snap, '1h')).toBe(10);
  });

  it('rulebook example: Jaws That Bite vs Skirmish — no damage, the defender resolves first, then Jaws hits Alice', () => {
    let snap = arrange(game(['alice', 'arthur']), { current: 0, at: { '0h': 8, '0s0': 10, '1h': 12, '1s0': 27 }, hands: { 0: ['jaws-that-bite'], 1: ['skirmish'] } });
    snap = act(snap, 0, { type: 'attack', fighter: '0s0', target: '1h', card: cid(0, 'jaws-that-bite') });
    snap = act(snap, 1, { type: 'defend', card: cid(1, 'skirmish') });
    expect(hp(snap, '1h')).toBe(18);
    expect(st(snap).combat!.won).toBe('d');
    expect(promptOf(snap)).toMatchObject({ kind: 'move', seat: 1 }); // Skirmish first (defender)
    snap = act(snap, 1, { type: 'move', fighter: '0s0', to: 14 }); // Jabberwock 10 → 14, next to Alice on 8
    expect(promptOf(snap)).toMatchObject({ kind: 'fighter', seat: 0, fighters: ['0h'], may: false });
    snap = act(snap, 0, { type: 'choose', ids: ['0h'] });
    expect(hp(snap, '0h')).toBe(11);
  });

  it('Alice: BIG adds 2 to her attacks, SMALL adds 1 to her defence', () => {
    let snap = arrange(game(['alice', 'arthur'], { size: 'big' }), { current: 0, at: { '0h': 14, '0s0': 27, '1h': 17, '1s0': 30 }, hands: { 0: ['o-frabjous-day'], 1: [] } });
    snap = act(snap, 0, { type: 'attack', fighter: '0h', target: '1h', card: cid(0, 'o-frabjous-day') });
    expect(hp(snap, '1h')).toBe(12); // 4 + 2, no defence (empty hand)
    expect(st(snap).size[0]).toBe('small'); // changed size after combat
    let d = arrange(game(['alice', 'arthur'], { size: 'small' }), { current: 1, at: { '0h': 14, '0s0': 27, '1h': 17, '1s0': 30 }, hands: { 0: ['looking-glass'], 1: ['excalibur'] } });
    d = act(d, 1, { type: 'attack', fighter: '1h', target: '0h', card: cid(1, 'excalibur') });
    d = act(d, 0, { type: 'defend', card: cid(0, 'looking-glass') });
    expect(hp(d, '0h')).toBe(10); // 6 − (2 + 1)
    expect(promptOf(d)).toMatchObject({ kind: 'option', seat: 0, min: 2, max: 2 });
    expect(reject(d, 0, { type: 'choose', ids: ['draw'] })).toBe('INVALID_CHOICE');
    d = act(d, 0, { type: 'choose', ids: ['heal', 'draw'] });
    expect(hp(d, '0h')).toBe(13);
    expect(st(d).hands[0]).toHaveLength(2);
  });

  it('Momentous Shift is 5 after moving; Bewilderment prevents all damage', () => {
    let snap = duel({ 0: ['momentous-shift', 'regroup'], 1: [] }, { at: { '0h': 8, '0s0': 7, '1h': 17, '1s0': 26, '1s1': 23, '1s2': 19 } });
    snap = act(snap, 0, { type: 'maneuver' });
    snap = act(snap, 0, { type: 'choose', ids: [] });
    snap = act(snap, 0, { type: 'move', fighter: '0h', to: 14 });
    snap = act(snap, 0, { type: 'done' });
    snap = act(snap, 0, { type: 'attack', fighter: '0h', target: '1h', card: cid(0, 'momentous-shift') });
    expect(hp(snap, '1h')).toBe(11);

    let b = arrange(game(['medusa', 'arthur']), { current: 0, at: { '0h': 14, '0s0': 26, '0s1': 23, '0s2': 19, '1h': 30, '1s0': 17 }, hands: { 0: ['second-shot', 'gaze-of-stone'], 1: ['bewilderment'] } });
    b = act(b, 0, { type: 'attack', fighter: '0h', target: '1s0', card: cid(0, 'second-shot') });
    b = act(b, 1, { type: 'defend', card: cid(1, 'bewilderment') });
    expect(promptOf(b)).toMatchObject({ kind: 'boost', seat: 0, why: 'boostAttack' }); // Second Shot: may BOOST
    b = act(b, 0, { type: 'choose', ids: [cid(0, 'gaze-of-stone')] }); // 3 + 4 — still prevented
    expect(hp(b, '1s0')).toBe(7);
    expect(promptOf(b)).toMatchObject({ kind: 'place', seat: 1, may: true, why: 'bewilderment' });
    b = act(b, 1, { type: 'choose', ids: ['0'] });
    expect(at(b, '1s0')).toBe(0);
  });

  it('Gaze of Stone wins the game; a defeated hero ends the duel at the end of the action', () => {
    let snap = arrange(game(['medusa', 'arthur']), { current: 0, at: { '0h': 14, '0s0': 26, '0s1': 23, '0s2': 19, '1h': 17, '1s0': 30 }, hands: { 0: ['gaze-of-stone'], 1: [] }, hp: { '1h': 9 } });
    snap = act(snap, 0, { type: 'attack', fighter: '0h', target: '1h', card: cid(0, 'gaze-of-stone') });
    expect(st(snap).outcome).toEqual({ reason: 'win', placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }] });
  });

  it('end of turn: discard down to 7', () => {
    let snap = duel({ 0: ['regroup', 'feint', 'skirmish', 'swift-strike', 'momentous-shift', 'noble-sacrifice', 'excalibur', 'prophecy'], 1: ['dash'] });
    snap = act(snap, 0, { type: 'maneuver' });
    snap = act(snap, 0, { type: 'choose', ids: [] });
    snap = act(snap, 0, { type: 'done' });
    snap = act(snap, 0, { type: 'maneuver' });
    snap = act(snap, 0, { type: 'choose', ids: [] });
    snap = act(snap, 0, { type: 'done' });
    expect(promptOf(snap)).toMatchObject({ kind: 'cards', seat: 0, why: 'handLimit', min: 3, max: 3 });
    expect(view(snap, 1).prompt!.cards).toBeUndefined();
    const hand = st(snap).hands[0]!;
    snap = act(snap, 0, { type: 'choose', ids: hand.slice(0, 3) });
    expect(st(snap).hands[0]).toHaveLength(7);
    expect(promptOf(snap).seat).toBe(1);
  });

  it('Prophecy shows the top 4 only to its player', () => {
    let snap = duel({ 0: ['prophecy'], 1: [] });
    snap = act(snap, 0, { type: 'scheme', card: cid(0, 'prophecy'), fighter: '0s0' });
    const top4 = promptOf(snap).cards!;
    expect(top4).toHaveLength(4);
    expect(view(snap, 1).prompt!.cards).toBeUndefined();
    expect(JSON.stringify(view(snap, 1))).not.toContain(top4[0]);
    snap = act(snap, 0, { type: 'choose', ids: [top4[2]!, top4[3]!, top4[1]!] });
    expect(st(snap).hands[0]).toEqual([top4[2], top4[3]]);
    expect(st(snap).decks[0]!.slice(-2)).toEqual([top4[0], top4[1]]); // top4[1] chosen to be on top
  });
});

describe('unmatched free-for-all, resign and timeouts', () => {
  it('first turn may only attack the next player; resigning removes a player and the last hero wins', () => {
    let snap = game(['arthur', 'medusa', 'sinbad'], { seed: 5 });
    const s = structuredClone(st(snap));
    s.order = [0, 1, 2];
    s.tookTurn = [false, false, false];
    s.current = 0; s.stack = [{ kind: 'turn', seat: 0, step: 1 }]; s.prompt = { kind: 'action', seat: 0, why: 'action' };
    const put: Record<string, number> = { '0h': 14, '0s0': 7, '1h': 17, '1s0': 26, '1s1': 23, '1s2': 19, '2h': 10, '2s0': 30 };
    for (const f of s.fighters) f.space = put[f.id] ?? f.space;
    s.hands[0] = [cid(0, 'excalibur')];
    snap = { ...snap, state: s };
    const targets = legal(snap, 0).filter((h) => h.type === 'attack').map((h) => h.target);
    expect(targets).toContain('1h'); // next player
    expect(targets).not.toContain('2h'); // third player has not played yet
    snap = act(snap, 1, { type: 'resign' });
    expect(st(snap).alive).toEqual([true, false, true]);
    expect(st(snap).outcome).toBeNull();
    expect(st(snap).fighters.filter((f) => f.seat === 1).every((f) => f.space === null)).toBe(true);
    snap = act(snap, 2, { type: 'resign' });
    expect(st(snap).outcome).toEqual({ reason: 'resign', placements: [{ seat: 0, place: 1 }, { seat: 2, place: 2 }, { seat: 1, place: 3 }] });
  });

  it('timeouts take the passive choice (maneuver without moving); three in a row remove the player', () => {
    let snap = duel({ 0: ['regroup'], 1: ['dash'] });
    const step = (x: EngineSnapshot) => (applyTimeout(m, x, 0) as StepResult).snapshot;
    snap = step(snap);
    expect(st(snap).current).toBe(1);
    expect(st(snap).hands[0]).toHaveLength(3); // drew twice
    expect(at(snap, '0h')).toBe(14);
    snap = step(snap); // seat 1
    snap = step(snap); // seat 0 (2nd)
    snap = step(snap); // seat 1
    snap = step(snap); // seat 0 (3rd) → removed
    expect(st(snap).outcome).toMatchObject({ reason: 'resign', placements: [{ seat: 1, place: 1 }, { seat: 0, place: 2 }] });
  });
});

describe('unmatched tutorial and replay', () => {
  it('the tutorial script plays to a win', () => {
    const t = unmatchedModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options }).snapshot;
    for (const stepDef of t.steps) {
      snap = act(snap, 0, stepDef.expected);
      if (stepDef.reply) snap = act(snap, 1, stepDef.reply);
    }
    expect(st(snap).outcome!.placements[0]).toEqual({ seat: 0, place: 1 });
  });

  it('random legal play never throws, never leaks hidden cards and replays deterministically', () => {
    let finished = 0;
    for (let g = 0; g < 160; g++) {
      const players = 2 + (g % 3);
      const rng = createRng({ s: 1000 + g });
      const setup = { playerCount: players, seed: g, options: { map: ['marmoreal', 'sarpedon', 'soho', 'baskerville-manor'][g % 4] } };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 1500 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.prompt!.seat;
        const hints = legal(snap, seat).filter((h) => h.type !== 'resign');
        // Prefer attacking so games end.
        const attacks = hints.filter((h) => h.type === 'attack');
        const h = attacks.length && rng.nextInt(3) ? attacks[rng.nextInt(attacks.length)]! : hints[rng.nextInt(hints.length)]!;
        let action: Record<string, unknown>;
        if (h.type === 'move') { const to = h.to as number[]; action = { type: 'move', fighter: h.fighter, to: to[rng.nextInt(to.length)] }; }
        else if (h.type === 'choose' && 'from' in h) {
          const from = (h.from as string[]).slice();
          const k = (h.min as number) + rng.nextInt((h.max as number) - (h.min as number) + 1);
          const ids: string[] = [];
          for (let i = 0; i < k; i++) ids.push(from.splice(rng.nextInt(from.length), 1)[0]!);
          action = { type: 'choose', ids };
        } else if (h.type === 'attack') action = { type: 'attack', fighter: h.fighter, target: h.target, card: h.card };
        else action = { ...h };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        // Redaction: no viewer sees another player's hand.
        const after = st(snap);
        for (let v = 0; v < players; v++) {
          const json = JSON.stringify(view(snap, v));
          for (let o = 0; o < players; o++) {
            if (o === v || after.reveal?.to === v) continue;
            // Exempt: cards the prompt shows this viewer, and an attack card returned to hand after its public reveal (Do My Bidding).
            for (const c of after.hands[o]!) if (!(after.prompt?.seat === v && after.prompt.cards?.includes(c)) && c !== after.combat?.aCard && json.includes(`"${c}"`)) throw new Error(`leak ${c} to ${v}: prompt=${JSON.stringify(after.prompt)} combat=${JSON.stringify(after.combat)} last=${JSON.stringify(after.log.slice(-3))}`);
          }
        }
      }
      if (st(snap).outcome) finished++;
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
    expect(finished).toBeGreaterThan(110);
  }, 120_000);
});

describe('unmatched Cobble & Fog', () => {
  const timeout = (x: EngineSnapshot) => (applyTimeout(m, x, 0) as StepResult).snapshot;
  /** Dracula (seat 0) on 14 next to Holmes (seat 1) on 17. */
  const dvh = (hands: Record<number, string[]>, current = 0) =>
    arrange(game(['dracula', 'holmes']), { current, at: { '0h': 14, '0s0': 26, '0s1': 23, '0s2': 19, '1h': 17, '1s0': 27 }, hands });

  it('Holmes: Feint cannot cancel HOLMES cards — Counterpunch still hits', () => {
    let snap = dvh({ 0: ['feint'], 1: ['counterpunch'] });
    snap = act(snap, 0, { type: 'attack', fighter: '0h', target: '1h', card: cid(0, 'feint') });
    snap = act(snap, 1, { type: 'defend', card: cid(1, 'counterpunch') });
    expect(st(snap).log.some((e) => e.t === 'reveal' && !e.cancelD)).toBe(true);
    expect(hp(snap, '0h')).toBe(11); // Counterpunch: 2 damage to the adjacent attacker
    expect(hp(snap, '1h')).toBe(16);
  });

  it('Elementary is played face up; a correct prediction ignores the attack and cancels its effects', () => {
    let snap = dvh({ 0: ['exploit'], 1: ['elementary'] });
    snap = act(snap, 0, { type: 'attack', fighter: '0h', target: '1h', card: cid(0, 'exploit') });
    expect(reject(snap, 1, { type: 'defend', card: cid(1, 'elementary') })).toBe('PREDICTION_REQUIRED');
    snap = act(snap, 1, { type: 'defend', card: cid(1, 'elementary'), predict: 4 });
    expect(hp(snap, '1h')).toBe(16);
    expect(st(snap).hands[0]).toHaveLength(0); // Exploit's draw was cancelled
    let wrong = dvh({ 0: ['exploit'], 1: ['elementary'] });
    wrong = act(wrong, 0, { type: 'attack', fighter: '0h', target: '1h', card: cid(0, 'exploit') });
    wrong = act(wrong, 1, { type: 'defend', card: cid(1, 'elementary'), predict: 3 });
    expect(hp(wrong, '1h')).toBe(15); // 4 − 3
  });

  it('Do My Bidding: the defender looks at the attacker hand and chooses the attack card', () => {
    let snap = dvh({ 0: ['do-my-bidding'], 1: ['the-game-is-afoot', 'feint'] }, 1);
    snap = act(snap, 1, { type: 'attack', fighter: '1h', target: '0h', card: cid(1, 'the-game-is-afoot') });
    snap = act(snap, 0, { type: 'defend', card: cid(0, 'do-my-bidding') });
    expect(promptOf(snap)).toMatchObject({ kind: 'cards', seat: 0, why: 'bidding' });
    expect(promptOf(snap).cards!.slice().sort()).toEqual([cid(1, 'feint'), cid(1, 'the-game-is-afoot')]);
    snap = act(snap, 0, { type: 'choose', ids: [cid(1, 'feint')] });
    expect(hp(snap, '0h')).toBe(13); // Feint 2 vs defence 3
    expect(st(snap).hands[1]).toEqual([cid(1, 'the-game-is-afoot')]);
  });

  it('Dracula: Bloodthirsty at the start of the turn deals 1 and draws; Mistform gains an action', () => {
    let snap = dvh({ 0: ['mistform'], 1: [] }, 1);
    snap = timeout(snap); // Holmes idles: two maneuvers without moving
    expect(promptOf(snap)).toMatchObject({ kind: 'fighter', seat: 0, why: 'bloodthirsty', may: true });
    const hand = st(snap).hands[0]!.length;
    snap = act(snap, 0, { type: 'choose', ids: ['1h'] });
    expect(hp(snap, '1h')).toBe(15);
    expect(st(snap).hands[0]).toHaveLength(hand + 1);
    snap = act(snap, 0, { type: 'scheme', card: cid(0, 'mistform'), fighter: '0h' });
    snap = act(snap, 0, { type: 'choose', ids: ['0'] });
    expect(at(snap, '0h')).toBe(0);
    expect(st(snap).actionsLeft).toBe(2);
  });

  it('Jekyll & Hyde: Hyde cards need Hyde; Hyde takes 1 damage after a maneuver', () => {
    let snap = arrange(game(['jekyll', 'medusa']), { current: 0, at: { '0h': 14, '1h': 17, '1s0': 26, '1s1': 23, '1s2': 19 }, hands: { 0: ['recoiling-blow', 'skirmish'] } });
    expect(legal(snap, 0).some((h) => h.type === 'attack' && h.card === cid(0, 'recoiling-blow'))).toBe(false);
    const s = structuredClone(st(snap));
    s.form[0] = 'hyde';
    snap = { ...snap, state: s };
    expect(legal(snap, 0).some((h) => h.type === 'attack' && h.card === cid(0, 'recoiling-blow'))).toBe(true);
    snap = act(snap, 0, { type: 'maneuver' });
    snap = act(snap, 0, { type: 'choose', ids: [] });
    snap = act(snap, 0, { type: 'done' });
    expect(hp(snap, '0h')).toBe(15);
  });

  it('Invisible Man: +1 defence on fog, fog spaces link movement, Vanish as first action ends the turn and he returns next turn', () => {
    let snap = arrange(game(['invisible', 'dracula']), { current: 1, at: { '0h': 14, '1h': 17, '1s0': 26, '1s1': 23, '1s2': 19 }, hands: { 0: ['lurking'], 1: ['exploit'] } });
    const s = structuredClone(st(snap));
    s.fog = [14, 2, 30];
    snap = { ...snap, state: s };
    snap = act(snap, 1, { type: 'attack', fighter: '1h', target: '0h', card: cid(1, 'exploit') });
    snap = act(snap, 0, { type: 'defend', card: cid(0, 'lurking') });
    expect(hp(snap, '0h')).toBe(14); // 4 − (2 + 1)

    // Movement between fog spaces as if adjacent (14 → 2 in one step).
    let mv = arrange(snap, { current: 0, at: { '0h': 14 }, hands: { 0: ['vanish'] } });
    const m2 = structuredClone(st(mv));
    m2.fog = [14, 2, 30];
    mv = { ...mv, state: m2 };
    mv = act(mv, 0, { type: 'maneuver' });
    mv = act(mv, 0, { type: 'choose', ids: [] });
    expect((legal(mv, 0).find((h) => h.type === 'move' && h.fighter === '0h') as unknown as { to: number[] }).to).toContain(2);

    // Vanish as the first action.
    let v = arrange(snap, { current: 0, at: { '0h': 14 }, hands: { 0: ['vanish'] } });
    v = act(v, 0, { type: 'scheme', card: cid(0, 'vanish'), fighter: '0h' });
    expect(at(v, '0h')).toBeNull();
    expect(st(v).current).toBe(1);
    expect(st(v).outcome).toBeNull();
    expect(legal(v, 1).some((h) => h.type === 'attack' && h.target === '0h')).toBe(false);
    for (let i = 0; i < 5 && st(v).current === 1; i++) v = timeout(v);
    expect(promptOf(v)).toMatchObject({ kind: 'place', seat: 0, why: 'vanishReturn', may: false });
  });

  it('Invisible Man deploys three fog tokens in his zone; everyone sees them', () => {
    const snap = game(['invisible', 'arthur'], { map: 'soho' });
    const s = st(snap);
    const board = BOARDS.soho!;
    const im = s.fighters.find((f) => f.id === `${s.heroes.indexOf('invisible')}h`)!.space!;
    expect(s.fog).toHaveLength(3);
    expect(new Set(s.fog).size).toBe(3);
    for (const sp of s.fog) expect(board.spaces[sp]!.zones.some((z) => board.spaces[im]!.zones.includes(z))).toBe(true);
    expect(view(snap, null).fog).toEqual(s.fog);
  });

  it('Baskerville Manor: secret passages connect for movement, not for attacks', () => {
    let snap = arrange(game(['sinbad', 'alice'], { map: 'baskerville-manor' }), { current: 0, at: { '0h': 4, '0s0': 10, '1h': 5, '1s0': 3 }, hands: { 0: ['exploit'], 1: [] } });
    expect(legal(snap, 0).some((h) => h.type === 'attack' && h.target === '1h')).toBe(false);
    snap = act(snap, 0, { type: 'maneuver' });
    snap = act(snap, 0, { type: 'choose', ids: [] });
    const to = (legal(snap, 0).find((h) => h.type === 'move' && h.fighter === '0h') as unknown as { to: number[] }).to;
    expect(to).toEqual(expect.arrayContaining([14, 27]));
  });
});
