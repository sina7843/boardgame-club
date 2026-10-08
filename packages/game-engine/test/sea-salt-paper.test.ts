import { describe, expect, it } from 'vitest';
import { CARDS, colorBonus, duoKind, points, sspModule, type Kind, type SspState, type SspView } from '@bg/game-sea-salt-paper';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = sspModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as SspState;
const game = (players = 3, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const of = (k: Kind) => CARDS.filter((c) => c.kind === k).map((c) => c.id);
const total = (s: SspState) => s.deck.length + s.piles[0].length + s.piles[1].length + s.hands.flat().length + s.played.flat().length + s.drawn.length;

describe('sea salt & paper rules', () => {
  it('58 cards; scoring of duos, collectors, multipliers and mermaids', () => {
    expect(CARDS).toHaveLength(58);
    expect(points([...of('crab').slice(0, 3), ...of('boat').slice(0, 2)])).toBe(2);
    expect(points(of('shell').slice(0, 3))).toBe(4);
    expect(points(of('octopus').slice(0, 2))).toBe(3);
    expect(points(of('penguin'))).toBe(5);
    expect(points([...of('penguin').slice(0, 2), ...of('colony')])).toBe(3 + 4);
    expect(points([...of('sailor'), ...of('captain')])).toBe(5 + 6);
    expect(points([...of('boat').slice(0, 3), ...of('lighthouse')])).toBe(1 + 3);
    expect(duoKind(of('swimmer')[0]!, of('shark')[0]!)).toBe('shark');
    expect(duoKind(of('shell')[0]!, of('shell')[1]!)).toBeNull();
    const hand = of('crab').slice(0, 4);
    expect(points([...hand, of('mermaid')[0]!])).toBe(2 + colorBonus(hand));
  });

  it('draw two, keep one, the other fills an empty pile first; or take a pile top', () => {
    let snap = game(2, 2);
    const s = st(snap);
    s.current = 0;
    s.piles[1] = [];
    snap = act(snap, 0, { type: 'draw' });
    const [a, b] = st(snap).drawn;
    expect((projectFor(m, snap, p(1)).view as SspView).drawn).toBeNull();
    expect(reject(snap, 0, { type: 'keep', card: a, pile: 0 })).toBe('FILL_EMPTY_PILE');
    snap = act(snap, 0, { type: 'keep', card: a, pile: 1 });
    expect(st(snap).hands[0]).toEqual([a]);
    expect(st(snap).piles[1]).toEqual([b]);
    snap = act(snap, 0, { type: 'end', call: 'pass' });
    snap = act(snap, 1, { type: 'take', pile: 1 });
    expect(st(snap).hands[1]).toEqual([b]);
  });

  it('duo effects: crab searches a pile, boat gives another turn, fish draws, shark steals', () => {
    let snap = game(2, 3);
    const s = st(snap);
    s.current = 0;
    const [c1, c2] = of('crab');
    const [b1, b2] = of('boat');
    const [f1, f2] = of('fish');
    const sw = of('swimmer')[0]!, sh = of('shark')[0]!;
    s.hands[0] = [c1!, c2!, b1!, b2!, f1!, f2!, sw, sh];
    s.hands[1] = [of('shell')[0]!];
    const deep = s.piles[0][0]!;
    s.piles[0].push(of('octopus')[0]!);
    s.phase = 'act';
    snap = act(snap, 0, { type: 'duo', cards: [c1, c2], pile: 0 });
    expect((projectFor(m, snap, p(0)).view as SspView).crabCards).toContain(deep);
    snap = act(snap, 0, { type: 'crabTake', card: deep });
    expect(st(snap).hands[0]).toContain(deep);
    snap = act(snap, 0, { type: 'duo', cards: [f1, f2] });
    snap = act(snap, 0, { type: 'duo', cards: [sw, sh], target: 1 });
    expect(st(snap).hands[1]).toEqual([]);
    snap = act(snap, 0, { type: 'duo', cards: [b1, b2] });
    snap = act(snap, 0, { type: 'end', call: 'pass' });
    expect(st(snap).current).toBe(0); // boat: another turn
  });

  it('stop scores everyone; last chance favours the caller only if still ahead', () => {
    let snap = game(2, 4);
    const s = st(snap);
    s.current = 0; s.phase = 'act';
    s.hands[0] = of('shell').slice(0, 5); // 8
    s.hands[1] = of('penguin').slice(0, 2); // 3
    expect(reject(snap, 1, { type: 'end', call: 'stop' })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'end', call: 'last' });
    expect(st(snap).current).toBe(1);
    const pile = st(snap).piles[0].length ? 0 : 1;
    snap = act(snap, 1, { type: 'take', pile });
    snap = act(snap, 1, { type: 'end', call: 'pass' });
    const log = st(snap).roundLog[0]!;
    expect(log.call).toBe('last');
    expect(log.gains[0]).toBeGreaterThanOrEqual(8);
    let t = game(2, 5);
    st(t).current = 0; st(t).phase = 'act'; st(t).hands[0] = of('octopus').slice(0, 2);
    expect(reject(t, 0, { type: 'end', call: 'stop' })).toBe('NEED_SEVEN');
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).current).toBe(1);
  });

  it('four mermaids win at once; resign ends with the resigner last', () => {
    let snap = game(2, 6);
    const s = st(snap);
    s.current = 0; s.phase = 'draw';
    const mm = of('mermaid');
    s.hands[0] = mm.slice(0, 3);
    s.piles[0].push(mm[3]!);
    s.deck = s.deck.filter((x) => !mm.includes(x));
    snap = act(snap, 0, { type: 'take', pile: 0 });
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = sspModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1, score: 43 });
  });

  it('random games keep 58 cards per round and replay deterministically', () => {
    for (let g = 0; g < 20; g++) {
      const rng = createRng({ s: 61 + g });
      const players = 2 + (g % 3);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 8000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        let action: unknown;
        if (s.phase === 'draw') action = s.deck.length && (rng.nextInt(2) || (!s.piles[0].length && !s.piles[1].length)) ? { type: 'draw' } : { type: 'take', pile: s.piles[0].length ? 0 : 1 };
        else if (s.phase === 'choose') { const e = s.piles.findIndex((x) => !x.length); action = { type: 'keep', card: s.drawn[rng.nextInt(2)], pile: e < 0 ? rng.nextInt(2) : e }; }
        else if (s.phase === 'crab') action = { type: 'crabTake', card: s.piles[s.crabPile!][0] };
        else {
          const h = s.hands[seat]!;
          let duo: [number, number] | null = null;
          for (let i = 0; i < h.length && !duo; i++) for (let j = i + 1; j < h.length && !duo; j++) if (duoKind(h[i]!, h[j]!)) duo = [h[i]!, h[j]!];
          const d = duo ? duoKind(duo[0], duo[1]) : null;
          const target = (seat + 1) % s.players;
          if (duo && (d !== 'fish' || s.deck.length) && (d !== 'shark' || s.hands[target]!.length) && (d !== 'crab' || s.piles[0].length) && rng.nextInt(2)) action = { type: 'duo', cards: duo, ...(d === 'crab' ? { pile: 0 } : {}), ...(d === 'shark' ? { target } : {}) };
          else if (!s.lastChance && points([...h, ...s.played[seat]!]) >= 7) action = { type: 'end', call: rng.nextInt(2) ? 'stop' : 'last' };
          else action = { type: 'end', call: 'pass' };
        }
        const round = s.round;
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        if (st(snap).round === round && !st(snap).outcome) expect(total(st(snap))).toBe(58);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
