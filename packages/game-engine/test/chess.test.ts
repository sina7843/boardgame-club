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

  it('exports the finished game as PGN: seven tags, numbered SAN moves, result token', () => {
    const snap = play(game(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
    const rec = chessModule.exportRecord!(st(snap), { event: 'جام "ملی"', site: 'boardgameverse.ir', date: '2026.10.21', round: '3', players: ['علی', 'Sara'], timeControl: '600+5' });
    expect(rec).toMatchObject({ extension: 'pgn' });
    expect(rec!.text).toBe([
      '[Event "جام \\"ملی\\""]', '[Site "boardgameverse.ir"]', '[Date "2026.10.21"]', '[Round "3"]', '[White "علی"]', '[Black "Sara"]', '[Result "0-1"]',
      '[TimeControl "600+5"]', '[Termination "normal"]', '', '1. f3 e5 2. g4 Qh4# 0-1', ''
    ].join('\n'));
    expect(chessModule.exportRecord!(st(game()), { event: 'x', site: 'x', date: 'x', round: null, players: [], timeControl: null })).toBeNull(); // no moves yet
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

describe('chess publicSummary', () => {
  it('material, pieces, check badge, strikes', () => {
    let sum = chessModule.publicSummary!(st(game()));
    expect(sum.seats.map((x) => x.primary!.value)).toEqual([39, 39]);
    expect(sum.seats[0]!.stats![0]!.value).toBe(16);
    expect(sum.strikesMax).toBe(1);
    sum = chessModule.publicSummary!(st(play(game(), 'e2e4', 'f7f6', 'd1h5')));
    expect(sum.seats[1]!.badges!.map((b) => b.label)).toEqual(['کیش']);
    expect(sum.seats[0]!.badges).toEqual([]);
  });
});

describe('chess table rules: draw offers, FIDE claims, Armageddon', () => {
  const gameWith = (options: Record<string, unknown>, fen?: string) =>
    startGame(m, { playerCount: 2, seed: 1, options: { firstMove: 'host', ...options, ...(fen ? { fen } : {}) } }).snapshot;
  const move = (snap: EngineSnapshot, mv: string, offerDraw = false) => {
    const seat = st(snap).colors.indexOf(st(snap).pos.turn);
    const r = applyAction(m, snap, p(seat), { type: 'move', from: mv.slice(0, 2), to: mv.slice(2, 4), ...(offerDraw ? { offerDraw: true } : {}) }, 0);
    if ('ok' in r) throw new Error(`${mv}: ${r.errorCode}`);
    return r.snapshot;
  };
  const view = (snap: EngineSnapshot) => projectFor(m, snap, { kind: 'spectator' }).view as ChessView;
  const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];

  it('a draw offer goes with a move, at most once per five of the offerer\'s moves', () => {
    let s = game();
    expect(view(s).canOfferDraw).toBe(true);
    s = move(s, 'e2e4', true);
    expect(st(s).drawOffer).toBe(0);
    s = move(s, 'e7e5'); // moving instead of accepting declines
    expect(st(s).drawOffer).toBeNull();
    expect(view(s).canOfferDraw).toBe(false); // white offered just now
    s = move(s, 'g1f3', true);
    expect(st(s).drawOffer).toBeNull(); // too soon: the offer flag is ignored
    for (const mv of ['b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7', 'f1e1']) s = move(s, mv);
    expect(view(s).canOfferDraw).toBe(true); // ten plies after the first offer
  });

  it('draws by agreement can be barred until a move (minDrawMove)', () => {
    let s = gameWith({ minDrawMove: '20' });
    expect(view(s).canOfferDraw).toBe(false);
    s = move(s, 'e2e4', true);
    expect(st(s).drawOffer).toBeNull();
    expect(gameWith({ minDrawMove: 'none' })).toBeTruthy();
    expect(view(gameWith({ minDrawMove: 'none' })).canOfferDraw).toBe(true);
  });

  it('automatic rules: the third repetition draws at once', () => {
    let s = game();
    for (const mv of [...shuffle, ...shuffle]) s = move(s, mv);
    expect(st(s).end).toEqual({ kind: 'draw', draw: 'repetition' });
  });

  it('FIDE claims: threefold repetition must be claimed; five-fold is automatic', () => {
    let s = gameWith({ drawRule: 'fide' });
    for (const mv of shuffle) s = move(s, mv);
    expect(reject(s, 0, { type: 'claimDraw' })).toBe('DRAW_CLAIM_NOT_ALLOWED'); // second occurrence only
    for (const mv of shuffle) s = move(s, mv);
    expect(st(s).outcome).toBeNull(); // third occurrence: the game goes on
    expect(legal(s, 0).some((a) => a.type === 'claimDraw')).toBe(true);
    expect(legal(s, 1).some((a) => a.type === 'claimDraw')).toBe(false); // only the side to move
    const claimed = applyAction(m, s, p(0), { type: 'claimDraw' }, 0);
    expect('ok' in claimed).toBe(false);
    if (!('ok' in claimed)) {
      expect(st(claimed.snapshot).end).toEqual({ kind: 'draw', draw: 'repetition' });
      expect(st(claimed.snapshot).outcome).toMatchObject({ reason: 'draw' });
    }
    for (const mv of [...shuffle, ...shuffle]) s = move(s, mv);
    expect(st(s).end).toEqual({ kind: 'draw', draw: 'repetition' }); // fifth occurrence
  });

  it('Armageddon: a draw of any kind is a win for Black, and nobody can agree one', () => {
    const s0 = gameWith({ armageddon: true }, '4k3/8/8/8/8/8/8/4KN2 w - - 0 1');
    expect(view(s0).canOfferDraw).toBe(false);
    const s = move(s0, 'e1d1'); // king and knight against king: insufficient material
    expect(st(s).end).toEqual({ kind: 'draw', draw: 'material' });
    expect(st(s).outcome).toEqual({ reason: 'win', placements: [{ seat: 1, place: 1 }, { seat: 0, place: 2 }] });
    expect(chessModule.exportRecord!(st(s), { event: 'e', site: 's', date: 'd', round: null, players: ['a', 'b'], timeControl: null })!.text).toContain('[Result "0-1"]');
  });
});
