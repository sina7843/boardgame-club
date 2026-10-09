import { describe, expect, it } from 'vitest';
import { chessModule, fromFen, legalMoves, perft, san, sqIndex, type ChessState, type ChessView } from '@bg/game-chess';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = chessModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as ChessState;
const legal = (s: EngineSnapshot, seat: number) => projectFor(m, s, p(seat)).legalActions;

/** Start a game (seat 0 = White) from a FEN. */
const game = (fen?: string) => startGame(m, { playerCount: 2, seed: 1, options: { firstMove: 'host', ...(fen ? { fen } : {}) } }).snapshot;
function play(snap: EngineSnapshot, ...moves: string[]): EngineSnapshot {
  for (const mv of moves) {
    const seat = st(snap).colors.indexOf(st(snap).pos.turn);
    const [from, to, promotion] = [mv.slice(0, 2), mv.slice(2, 4), mv[4]?.toUpperCase()];
    const r = applyAction(m, snap, p(seat), { type: 'move', from, to, ...(promotion ? { promotion } : {}) }, 0);
    if ('ok' in r) throw new Error(`${mv}: ${r.errorCode}`);
    snap = r.snapshot;
  }
  return snap;
}
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};

describe('chess move generation (perft)', () => {
  // Reference counts from the Chess Programming Wiki perft results.
  it.each([
    ['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]],
    ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
    ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
    ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]]
  ])('%s', (_name, fen, counts) => {
    const pos = fromFen(fen as string);
    (counts as number[]).forEach((n, i) => expect(perft(pos, i + 1)).toBe(n));
  }, 60_000);

  it('standard algebraic notation with disambiguation, castling, promotion and mate', () => {
    const pos = fromFen('r3k2r/8/8/8/8/8/1N3N2/R3K2R w KQkq - 0 1');
    const find = (from: string, to: string, promo?: string) => legalMoves(pos).find((x) => x.from === sqIndex(from) && x.to === sqIndex(to) && x.promo === promo)!;
    expect(san(pos, find('e1', 'g1'))).toBe('O-O');
    expect(san(pos, find('e1', 'c1'))).toBe('O-O-O');
    expect(san(pos, find('b2', 'd3'))).toBe('Nbd3');
    expect(san(pos, find('a1', 'a8'))).toBe('Rxa8+');
    const promo = fromFen('7k/P7/8/8/8/8/8/K7 w - - 0 1');
    expect(san(promo, legalMoves(promo).find((x) => x.promo === 'Q')!)).toBe('a8=Q+');
  });
});

describe('chess games', () => {
  it('seat colours: random by default, host = White on request; White moves first', () => {
    const colors = new Set([0, 1, 2, 3, 4, 5].map((seed) => (startGame(m, { playerCount: 2, seed, options: {} }).snapshot.state as ChessState).colors[0]));
    expect(colors).toEqual(new Set(['w', 'b']));
    const snap = game();
    expect(st(snap).colors).toEqual(['w', 'b']);
    expect(reject(snap, 1, { type: 'move', from: 'e7', to: 'e5' })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, 0, { type: 'move', from: 'e2', to: 'e5' })).toBe('ILLEGAL_MOVE');
    expect(reject(snap, 0, { type: 'move', from: 'e7', to: 'e5' })).toBe('NOT_YOUR_PIECE');
    expect(legal(snap, 0).filter((h) => h.type === 'move')).toHaveLength(20);
    expect(legal(snap, 1).filter((h) => h.type === 'move')).toHaveLength(0);
  });

  it("fool's mate ends the game for Black; the view is public and shows check and history", () => {
    const snap = play(game(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(st(snap).outcome).toEqual({ reason: 'win', placements: [{ seat: 1, place: 1 }, { seat: 0, place: 2 }] });
    const v = projectFor(m, snap, { kind: 'spectator' }).view as ChessView;
    expect(v.inCheck).toBe(true);
    expect(v.history.map((h) => h.san)).toEqual(['f3', 'e5', 'g4', 'Qh4#']);
    expect(v.end).toEqual({ kind: 'checkmate' });
    expect(JSON.stringify(v)).not.toContain('seen');
  });

  it('castling rights, en passant and promotion through the module', () => {
    let snap = game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    snap = play(snap, 'a1a2', 'a8b8'); // White's a-rook moved: queen-side castling gone
    expect(reject(snap, 0, { type: 'move', from: 'e1', to: 'c1' })).toBe('ILLEGAL_MOVE');
    expect(legal(snap, 0).some((h) => h.from === 'e1' && h.to === 'g1')).toBe(true);
    let ep = play(game('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1'), 'd7d5', 'e5d6');
    expect(st(ep).pos.board[sqIndex('d5')]).toBeNull();
    expect(st(ep).history.at(-1)!.san).toBe('exd6');
    ep = game('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    expect(reject(ep, 0, { type: 'move', from: 'a7', to: 'a8' })).toBe('PROMOTION_REQUIRED');
    ep = play(ep, 'a7a8n');
    expect(st(ep).pos.board[sqIndex('a8')]).toBe('wN');
  });

  it('draws: stalemate, insufficient material, threefold repetition, fifty-move rule, agreement', () => {
    const stale = play(game('7k/8/6K1/8/8/8/8/5Q2 w - - 0 1'), 'f1f7');
    expect(st(stale).end).toEqual({ kind: 'draw', draw: 'stalemate' });
    expect(st(stale).outcome!.placements.every((x) => x.place === 1)).toBe(true);
    expect(st(play(game('4k3/8/8/8/8/8/3r4/4K3 w - - 0 1'), 'e1d2')).end).toEqual({ kind: 'draw', draw: 'material' });
    const rep = play(game(), 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    expect(st(rep).end).toEqual({ kind: 'draw', draw: 'repetition' });
    expect(st(play(game('4k3/8/8/8/8/8/8/R3K3 w - - 99 80'), 'a1a2')).end).toEqual({ kind: 'draw', draw: 'fiftyMove' });
    let offer = applyAction(m, game(), p(0), { type: 'move', from: 'e2', to: 'e4', offerDraw: true }, 0) as StepResult;
    expect(st(offer.snapshot).drawOffer).toBe(0);
    expect(reject(offer.snapshot, 0, { type: 'acceptDraw' })).toBe('NOT_YOUR_TURN');
    offer = applyAction(m, offer.snapshot, p(1), { type: 'acceptDraw' }, 0) as StepResult;
    expect(st(offer.snapshot).end).toEqual({ kind: 'draw', draw: 'agreement' });
    // An offer lapses when the receiver moves instead.
    const lapsed = play((applyAction(m, game(), p(0), { type: 'move', from: 'e2', to: 'e4', offerDraw: true }, 0) as StepResult).snapshot, 'e7e5');
    expect(st(lapsed).drawOffer).toBeNull();
  });

  it('timeout: the side to move loses, unless the opponent cannot mate (draw); resign loses', () => {
    const t = (applyTimeout(m, game(), 0) as StepResult).snapshot;
    expect(st(t).outcome).toEqual({ reason: 'timeout', placements: [{ seat: 1, place: 1 }, { seat: 0, place: 2 }] });
    const bare = (applyTimeout(m, game('4k3/8/8/8/8/8/8/R3K3 b - - 0 1'), 0) as StepResult).snapshot; // Black to move; White has a rook
    expect(st(bare).outcome!.reason).toBe('timeout');
    const noMate = (applyTimeout(m, game('4k3/8/8/8/8/8/8/N3K3 b - - 0 1'), 0) as StepResult).snapshot; // White: K+N only
    expect(st(noMate).end).toEqual({ kind: 'draw', draw: 'timeoutMaterial' });
    const r = (applyAction(m, game(), p(1), { type: 'resign' }, 0) as StepResult).snapshot;
    expect(st(r).outcome).toEqual({ reason: 'resign', placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }] });
  });

  it('tutorial script is legal and ends in checkmate for the learner', () => {
    const t = chessModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options }).snapshot;
    for (const step of t.steps) {
      expect(st(snap).outcome).toBeNull();
      const [e, r] = [step.expected, step.reply] as { from: string; to: string; promotion?: string }[];
      snap = play(snap, `${e!.from}${e!.to}${e!.promotion ?? ''}`);
      if (r) snap = play(snap, `${r.from}${r.to}`);
    }
    expect(st(snap).history.map((h) => h.san)).toEqual(['O-O', 'a6', 'Bc4+', 'd5', 'exd6+', 'Kh8', 'd7', 'a5', 'd8=Q#']);
    expect(st(snap).end).toEqual({ kind: 'checkmate' });
    expect(st(snap).outcome).toEqual({ reason: 'win', placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }] });
  });

  it('random legal games always end within the move limits and replay deterministically', () => {
    let finished = 0;
    for (let g = 0; g < 40; g++) {
      const rng = createRng({ s: 77 + g });
      const setup = { playerCount: 2, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 1200 && !st(snap).outcome; n++) {
        const seat = st(snap).colors.indexOf(st(snap).pos.turn);
        const moves = legal(snap, seat).filter((h) => h.type === 'move');
        const action = { ...moves[rng.nextInt(moves.length)]! };
        const r = applyAction(m, snap, p(seat), action, 0);
        if ('ok' in r) throw new Error(r.errorCode);
        snap = r.snapshot;
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
      }
      if (st(snap).outcome) finished++;
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
    // The fifty-move rule bounds every random game.
    expect(finished).toBe(40);
  }, 120_000);
});
