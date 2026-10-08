import { describe, expect, it } from 'vitest';
import { checkersModule, legalMoves, startBoard, type CheckersState, type CheckersView, type Piece } from '@bg/game-checkers';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = checkersModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as CheckersState;
const game = (options: Record<string, unknown> = {}, seed = 1) => startGame(m, { playerCount: 2, seed, options: { firstMove: 'host', ...options } }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
/** Algebraic square (a1 = 0) → index. */
const sq = (n: string) => (Number(n[1]) - 1) * 8 + (n.charCodeAt(0) - 97);
const board = (pieces: Record<string, Piece>) => {
  const b: (Piece | null)[] = Array(64).fill(null);
  for (const [k, v] of Object.entries(pieces)) b[sq(k)] = v;
  return b;
};
const paths = (b: (Piece | null)[], turn: 'd' | 'l', variant: 'english' | 'brazilian' = 'english') => legalMoves(b, turn, variant).map((mv) => mv.path).sort();

describe('checkers rules', () => {
  it('start: 12 men each on dark squares; dark moves first with 7 moves', () => {
    const b = startBoard();
    expect(b.filter((x) => x === 'd')).toHaveLength(12);
    expect(b.filter((x) => x === 'l')).toHaveLength(12);
    expect(legalMoves(b, 'd', 'english')).toHaveLength(7);
    const snap = game();
    expect(st(snap).colors).toEqual(['d', 'l']);
    expect(reject(snap, 1, { type: 'move', path: [sq('b6'), sq('a5')] })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, 0, { type: 'move', path: [sq('c3'), sq('c4')] })).toBe('ILLEGAL_MOVE');
    expect(reject(snap, 0, { type: 'move', path: [sq('b6'), sq('a5')] })).toBe('NOT_YOUR_PIECE');
  });

  it('captures are compulsory and multi-jumps continue; English men capture forward only', () => {
    const b = board({ c3: 'd', d4: 'l', f6: 'l', h2: 'l' });
    expect(paths(b, 'd')).toEqual([[sq('c3'), sq('e5'), sq('g7')]]);
    // A man behind cannot be captured backwards in English rules.
    const back = board({ d4: 'd', c3: 'l', h8: 'l' });
    expect(legalMoves(back, 'd', 'english').every((mv) => mv.captured.length === 0)).toBe(true);
    let snap = game();
    Object.assign(st(snap), { board: b });
    expect(reject(snap, 0, { type: 'move', path: [sq('c3'), sq('d4')] })).toBe('CAPTURE_REQUIRED');
    snap = act(snap, 0, { type: 'move', path: [sq('c3'), sq('e5'), sq('g7')] });
    expect(st(snap).board[sq('d4')]).toBeNull();
    expect(st(snap).board[sq('f6')]).toBeNull();
  });

  it('crowning ends an English move; kings move and capture backwards one square', () => {
    const b = board({ f6: 'd', g7: 'l', e7: 'l', a1: 'l' });
    // f6 jumps g7 → h8 and is crowned; the move ends there although e7 might be reachable later.
    const caps = legalMoves(b, 'd', 'english');
    expect(caps.map((c) => c.path)).toEqual([[sq('f6'), sq('h8')], [sq('f6'), sq('d8')]]);
    expect(caps.every((c) => c.crowned)).toBe(true);
    const king = board({ e5: 'D', d4: 'l', h8: 'l' });
    expect(paths(king, 'd')).toEqual([[sq('e5'), sq('c3')]]);
  });

  it('Brazilian: men capture backwards, flying kings, the longest capture is compulsory', () => {
    const back = board({ d4: 'd', c3: 'l', h8: 'l' });
    expect(paths(back, 'd', 'brazilian')).toEqual([[sq('d4'), sq('b2')]]);
    const flying = board({ a1: 'D', d4: 'l', h8: 'l' });
    expect(paths(flying, 'd', 'brazilian')).toEqual([[sq('a1'), sq('e5')], [sq('a1'), sq('f6')], [sq('a1'), sq('g7')]]);
    // Two capture options: one piece vs two pieces → only the double capture is legal.
    const most = board({ c3: 'd', b4: 'l', d4: 'l', f6: 'l', h8: 'l' });
    const ms = legalMoves(most, 'd', 'brazilian');
    expect(ms.every((x) => x.captured.length === 2)).toBe(true);
  });

  it('a side with no pieces or no moves loses; repetition and 40 quiet moves each are draws', () => {
    let snap = game();
    Object.assign(st(snap), { board: board({ c3: 'd', d4: 'l' }) });
    snap = act(snap, 0, { type: 'move', path: [sq('c3'), sq('e5')] });
    expect(st(snap).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
    expect(st(snap).end?.kind).toBe('win');
    // Blocked: light's only man on h8 can neither step to g7 nor jump it (f6 is taken).
    let blocked = game();
    Object.assign(st(blocked), { board: board({ g7: 'd', f6: 'd', g1: 'd', h8: 'l' }) });
    blocked = act(blocked, 0, { type: 'move', path: [sq('g1'), sq('h2')] });
    expect(st(blocked).end?.kind).toBe('blocked');
    // Kings shuffling: threefold repetition.
    let rep = game();
    Object.assign(st(rep), { board: board({ a1: 'D', h8: 'L' }) });
    const shuffle = [[sq('a1'), sq('b2')], [sq('h8'), sq('g7')], [sq('b2'), sq('a1')], [sq('g7'), sq('h8')]];
    for (let k = 0; k < 16 && !st(rep).outcome; k++) rep = act(rep, k % 2, { type: 'move', path: shuffle[k % 4] });
    expect(st(rep).end).toEqual({ kind: 'draw', draw: 'repetition' });
  });

  it('draw offers, resign and timeouts', () => {
    let snap = game();
    snap = act(snap, 0, { type: 'move', path: [sq('c3'), sq('d4')], offerDraw: true });
    expect(projectFor(m, snap, p(1)).legalActions.some((a) => a.type === 'acceptDraw')).toBe(true);
    const drawn = act(snap, 1, { type: 'acceptDraw' });
    expect(st(drawn).outcome?.reason).toBe('draw');
    expect(st(act(game(), 1, { type: 'resign' })).outcome?.placements[0]!.seat).toBe(0);
    const t = (applyTimeout(m, game(), 0) as StepResult).snapshot;
    expect(st(t).outcome?.reason).toBe('timeout');
    expect(st(t).outcome?.placements[0]!.seat).toBe(1);
  });

  it('view carries the board, counts and the last move', () => {
    const snap = act(game(), 0, { type: 'move', path: [sq('c3'), sq('d4')] });
    const v = projectFor(m, snap, p(1)).view as CheckersView;
    expect(v.counts).toEqual({ d: 12, l: 12, D: 0, L: 0 });
    expect(v.last?.path).toEqual([sq('c3'), sq('d4')]);
    expect(v).not.toHaveProperty('seen');
  });

  it('tutorial script is legal and ends in a win', () => {
    const t = checkersModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
  });

  it('random games in both variants finish and replay deterministically', () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 50 + g });
      const setup = { playerCount: 2, seed: g, options: { variant: g % 2 ? 'brazilian' : 'english' } };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 3000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.colors.indexOf(s.turn);
        const moves = legalMoves(s.board, s.turn, s.variant);
        const action = { type: 'move', path: moves[rng.nextInt(moves.length)]!.path };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(st(snap).board.filter(Boolean).length).toBeLessThanOrEqual(24);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
