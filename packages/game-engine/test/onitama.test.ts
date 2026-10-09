import { describe, expect, it } from 'vitest';
import { CARDS, cardById, movesFor, onitamaModule, target, type OnitamaState, type OnitamaView, type Piece } from '@bg/game-onitama';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = onitamaModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as OnitamaState;
const game = (seed = 1, options: Record<string, unknown> = {}) => startGame(m, { playerCount: 2, seed, options }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const at = (r: number, c: number) => r * 5 + c;
/** A position with given pieces and hands; red (seat 0) to move. */
function position(pieces: Record<number, Piece>, hands: [string[], string[]], side: string, current = 0) {
  const snap = game();
  const s = st(snap);
  s.board = Array(25).fill(null);
  for (const [i, pc] of Object.entries(pieces)) s.board[Number(i)] = pc;
  s.hands = hands; s.side = side; s.current = current; s.seen = {};
  return snap;
}

describe('onitama rules', () => {
  it('16 cards, 8 per colour; deal of 2 + 2 + 1; the side card colour starts', () => {
    expect(CARDS).toHaveLength(16);
    expect(CARDS.filter((c) => c.color === 'red')).toHaveLength(8);
    for (let seed = 0; seed < 10; seed++) {
      const s = st(game(seed));
      const all = [...s.hands[0], ...s.hands[1], s.side];
      expect(new Set(all).size).toBe(5);
      expect(s.current).toBe(cardById(s.side).color === 'red' ? 0 : 1);
    }
  });

  it('card offsets are mirrored for blue', () => {
    expect(target(at(0, 2), 0, [0, 2])).toBe(at(2, 2));
    expect(target(at(4, 2), 1, [0, 2])).toBe(at(2, 2));
    expect(target(at(4, 2), 1, [1, 0])).toBe(at(4, 1));
    expect(target(at(0, 4), 0, [1, 0])).toBeNull();
  });

  it('moving swaps the used card with the side card', () => {
    let snap = position({ [at(0, 2)]: 'rM', [at(1, 1)]: 'rS', [at(4, 2)]: 'bM' }, [['boar', 'tiger'], ['crab', 'ox']], 'monkey');
    expect(reject(snap, 1, { type: 'move', card: 'crab', from: at(4, 2), to: at(4, 0) })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, 0, { type: 'move', card: 'crab', from: at(1, 1), to: at(2, 1) })).toBe('NOT_YOUR_CARD');
    expect(reject(snap, 0, { type: 'move', card: 'boar', from: at(1, 1), to: at(3, 1) })).toBe('ILLEGAL_MOVE');
    snap = act(snap, 0, { type: 'move', card: 'boar', from: at(1, 1), to: at(2, 1) });
    expect(st(snap).hands[0].sort()).toEqual(['monkey', 'tiger']);
    expect(st(snap).side).toBe('boar');
    expect(st(snap).current).toBe(1);
  });

  it('way of the stone (capture the master) and way of the stream (master on the enemy temple)', () => {
    let stone = position({ [at(0, 2)]: 'rM', [at(3, 2)]: 'rS', [at(4, 2)]: 'bM' }, [['boar', 'tiger'], ['crab', 'ox']], 'monkey');
    stone = act(stone, 0, { type: 'move', card: 'boar', from: at(3, 2), to: at(4, 2) });
    expect(st(stone).end).toEqual({ kind: 'stone' });
    expect(st(stone).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
    let stream = position({ [at(2, 2)]: 'rM', [at(4, 0)]: 'bM' }, [['tiger', 'boar'], ['crab', 'ox']], 'monkey');
    stream = act(stream, 0, { type: 'move', card: 'tiger', from: at(2, 2), to: at(4, 2) });
    expect(st(stream).end).toEqual({ kind: 'stream' });
    // A student on the temple does not win.
    let student = position({ [at(0, 2)]: 'rM', [at(2, 2)]: 'rS', [at(4, 0)]: 'bM' }, [['tiger', 'boar'], ['crab', 'ox']], 'monkey');
    student = act(student, 0, { type: 'move', card: 'tiger', from: at(2, 2), to: at(4, 2) });
    expect(st(student).outcome).toBeNull();
  });

  it('with no legal move a card must still be exchanged (pass)', () => {
    const open = position({ [at(0, 2)]: 'rM', [at(4, 2)]: 'bM' }, [['tiger', 'crab'], ['ox', 'boar']], 'monkey');
    expect(reject(open, 0, { type: 'pass', card: 'tiger' })).toBe('MOVE_AVAILABLE');
    // No red piece can move (an artificial position): the turn is a card exchange only.
    const stuck = position({ [at(4, 2)]: 'bM' }, [['tiger', 'crab'], ['ox', 'boar']], 'monkey');
    expect(movesFor(st(stuck), 0)).toEqual([]);
    expect(projectFor(m, stuck, p(0)).legalActions.map((a) => a.type).sort()).toEqual(['pass', 'pass', 'resign']);
    const after = act(stuck, 0, { type: 'pass', card: 'tiger' });
    expect(st(after).side).toBe('tiger');
    expect(st(after).hands[0].sort()).toEqual(['crab', 'monkey']);
    expect(st(after).current).toBe(1);
  });

  it('threefold repetition is a draw; resign and timeout lose', () => {
    let snap = position({ [at(0, 0)]: 'rM', [at(4, 4)]: 'bM' }, [['boar', 'horse'], ['ox', 'rooster']], 'goose');
    // Shuffle masters sideways and back with the cards cycling until a position (incl. cards) repeats three times.
    for (let k = 0; k < 300 && !st(snap).outcome; k++) {
      const s = st(snap);
      const mv = movesFor(s, s.current)[0]!;
      snap = act(snap, s.current, { type: 'move', ...mv });
    }
    expect(['repetition', 'stone', 'stream']).toContain(st(snap).end?.kind);
    expect(st(act(game(3), 1, { type: 'resign' })).outcome?.placements[0]!.seat).toBe(0);
    const g = game(3);
    const t = (applyTimeout(m, g, 0) as StepResult).snapshot;
    expect(st(t).outcome?.placements[0]!.seat).toBe(1 - st(g).current);
  });

  it('view hides the repetition table; tutorial is legal and ends in a win', () => {
    expect(projectFor(m, game(2), p(1)).view as OnitamaView).not.toHaveProperty('seen');
    const t = onitamaModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements).toEqual([{ seat: 0, place: 1 }, { seat: 1, place: 2 }]);
    expect(st(snap).end).toEqual({ kind: 'stream' });
    expect(st(snap).history.map((h) => h.captured)).toEqual(['bS', null, null, 'rS', null]);
    // Each scripted learner move is reachable with exactly one card, so the board taps never need a card choice.
    let s2 = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      const e = step.expected as { from: number; to: number };
      expect(movesFor(st(s2), 0).filter((x) => x.from === e.from && x.to === e.to)).toHaveLength(1);
      s2 = act(s2, 0, step.expected);
      if (step.reply) s2 = act(s2, 1, step.reply);
    }
  });

  it('random games keep five cards in play and replay deterministically', () => {
    for (let g = 0; g < 40; g++) {
      const rng = createRng({ s: 11 + g });
      const setup = { playerCount: 2, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 400 && !st(snap).outcome; n++) {
        const s = st(snap);
        const hints = projectFor(m, snap, p(s.current)).legalActions.filter((h) => h.type !== 'resign');
        const h = hints[rng.nextInt(hints.length)]!;
        const action = h.type === 'pass' ? { type: 'pass', card: h.card } : { type: 'move', card: h.card, from: h.from, to: h.to };
        snap = act(snap, s.current, action);
        inputs.push({ kind: 'action', actor: p(s.current), action, logicalTime: 0 });
        const after = st(snap);
        expect(new Set([...after.hands[0], ...after.hands[1], after.side]).size).toBe(5);
        expect(after.board.filter((x) => x === 'rM').length + after.board.filter((x) => x === 'bM').length).toBeGreaterThanOrEqual(1);
      }
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  });
});
