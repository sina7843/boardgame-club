// Point these two imports at games/chess/src/rules.ts and pgn.ts of the repo before running.
// FIDE rules test for the repo chess engine (copy in ./src). Run: node --experimental-strip-types rules-test.mjs
import { pathToFileURL } from 'node:url';
const R = await import(pathToFileURL('E:/AI/Claude/bgv-chess/engine/src/rules.ts'));
const P = await import(pathToFileURL('E:/AI/Claude/bgv-chess/engine/src/pgn.ts'));
const M = R.chessModule;

const results = [];
const test = (id, area, name, fn) => {
  try { const r = fn(); results.push({ id, area, name, ok: r === true || r === undefined, note: typeof r === 'string' ? r : '' }); }
  catch (e) { results.push({ id, area, name, ok: false, note: String(e && e.message || e) }); }
};
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg ?? ''} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const rng = { nextInt: () => 0 };
const W = { kind: 'player', seat: 0 }, B = { kind: 'player', seat: 1 };
/** New game: seat 0 = White. */
const game = (fen, opts = {}) => M.setup({ playerCount: 2, rng, options: { firstMove: 'host', ...(fen ? { fen } : {}), ...opts } });
const seatToMove = (s) => (s.colors[0] === s.pos.turn ? W : B);
/** Play a move string like 'e2e4' or 'e7e8q' (+ '=' for draw offer) for the side to move. Throws on rejection. */
function play(s, ...moves) {
  for (const mv of moves) {
    const offer = mv.endsWith('=');
    const m = mv.replace('=', '');
    const a = { type: 'move', from: m.slice(0, 2), to: m.slice(2, 4), ...(m[4] ? { promotion: m[4].toUpperCase() } : {}), ...(offer ? { offerDraw: true } : {}) };
    const actor = seatToMove(s);
    const v = M.validate(s, actor, a);
    if (!v.ok) throw new Error(`${mv} rejected: ${v.errorCode}`);
    M.apply(s, actor, a);
  }
  return s;
}
const tryMove = (s, m) => {
  const a = { type: 'move', from: m.slice(0, 2), to: m.slice(2, 4), ...(m[4] ? { promotion: m[4].toUpperCase() } : {}) };
  return M.validate(s, seatToMove(s), a);
};
const legal = (fen) => R.legalMoves(R.fromFen(fen)).map((m) => R.sqName(m.from) + R.sqName(m.to) + (m.promo ?? '').toLowerCase());
const lastSan = (s) => s.history.at(-1).san;

// ---------- 0. move generator (perft, standard reference numbers) ----------
const PERFT = [
  ['start', R.START_FEN, [20, 400, 8902, 197281]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['pos3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['pos4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['pos5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ['pos6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]]
];
for (const [name, fen, want] of PERFT) {
  test(`G-${name}`, 'Move generator', `perft ${name} depth 1..${want.length}`, () => {
    const pos = R.fromFen(fen);
    const got = want.map((_, i) => R.perft(pos, i + 1));
    eq(got, want, name);
  });
}

// ---------- 1. castling ----------
const CASTLE = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
test('C1', 'Castling', 'O-O and O-O-O allowed when all conditions hold; rook jumps to f1/d1', () => {
  const s = play(game(CASTLE), 'e1g1');
  eq([s.pos.board[R.sqIndex('g1')], s.pos.board[R.sqIndex('f1')], s.pos.board[R.sqIndex('h1')]], ['wK', 'wR', null]);
  eq(lastSan(s), 'O-O');
  play(s, 'e8c8');
  eq([s.pos.board[R.sqIndex('c8')], s.pos.board[R.sqIndex('d8')], s.pos.board[R.sqIndex('a8')]], ['bK', 'bR', null]);
  eq(lastSan(s), 'O-O-O');
});
test('C2', 'Castling', 'no castling after the king has moved (even if it returns)', () => {
  const s = play(game(CASTLE), 'e1f1', 'a7a6', 'f1e1', 'a6a5');
  eq(tryMove(s, 'e1g1').ok, false); eq(tryMove(s, 'e1c1').ok, false);
});
test('C3', 'Castling', 'no castling with a rook that has moved; other side still allowed', () => {
  const s = play(game(CASTLE), 'h1g1', 'a7a6', 'g1h1', 'a6a5');
  eq(tryMove(s, 'e1g1').ok, false); eq(tryMove(s, 'e1c1').ok, true);
});
test('C4', 'Castling', 'no castling out of check', () => {
  eq(legal('r3k2r/8/8/8/8/8/4q3/R3K2R w KQkq - 0 1').filter((m) => m === 'e1g1' || m === 'e1c1'), []);
  eq(legal('4k3/8/8/b7/8/8/8/R3K2R w KQ - 0 1').filter((m) => m === 'e1g1' || m === 'e1c1'), []);
});
test('C5', 'Castling', 'no castling through an attacked square (f1 / d1)', () => {
  eq(legal('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1').includes('e1g1'), false);
  eq(legal('4k3/8/8/8/8/8/3r4/R3K2R w KQ - 0 1').includes('e1c1'), false);
});
test('C6', 'Castling', 'no castling into check (g1 / c1)', () => {
  eq(legal('4k3/8/8/8/8/8/6r1/R3K2R w KQ - 0 1').includes('e1g1'), false);
  eq(legal('4k3/8/8/8/8/8/2r5/R3K2R w KQ - 0 1').includes('e1c1'), false);
});
test('C7', 'Castling', 'pieces between block; an attacked b1 does NOT block O-O-O; attacked rook does not block', () => {
  eq(legal('4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1').includes('e1c1'), false);
  eq(legal('4k3/8/8/8/8/8/1r6/R3K2R w KQ - 0 1').includes('e1c1'), true);
  eq(legal('4k3/8/8/8/8/8/7r/R3K2R w KQ - 0 1').includes('e1g1'), true);
});
test('C8', 'Castling', 'right lost when the rook is captured on its square (and stays lost)', () => {
  const s = play(game('r3k2r/8/8/8/8/8/6b1/R3K2R b KQkq - 0 1'), 'g2h1');
  eq(s.pos.castling.wK, false);
  eq(tryMove(s, 'e1g1').ok, false);
});
test('C9', 'Castling', 'castling with check is written O-O+', () => {
  const s = play(game('5k2/8/8/8/8/8/8/4K2R w K - 0 1'), 'e1g1');
  eq(lastSan(s), 'O-O+');
});

// ---------- 2. en passant ----------
test('E1', 'En passant', 'capture right after the double step; captured pawn removed; SAN exd6', () => {
  const s = play(game('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1'), 'd7d5', 'e5d6');
  eq(s.pos.board[R.sqIndex('d5')], null); eq(s.pos.board[R.sqIndex('d6')], 'wP'); eq(lastSan(s), 'exd6');
});
test('E2', 'En passant', 'not allowed one move later', () => {
  const s = play(game('4k3/3p3p/8/4P3/8/8/7P/4K3 b - - 0 1'), 'd7d5', 'h2h3', 'h7h6');
  eq(tryMove(s, 'e5d6').ok, false);
});
test('E3', 'En passant', 'not allowed if it exposes own king (horizontal pin on the 5th rank)', () => {
  const s = play(game('7k/2p5/8/KP5r/8/8/8/8 b - - 0 1'), 'c7c5');
  eq(tryMove(s, 'b5c6').ok, false);
});
test('E4', 'En passant', 'en passant that gives check is written exd6+', () => {
  const s = play(game('8/2kp4/8/4P3/8/8/8/4K3 b - - 0 1'), 'd7d5', 'e5d6');
  eq(lastSan(s), 'exd6+');
});

// ---------- 3. promotion ----------
test('P1', 'Promotion', 'moving to the last rank without choosing a piece is rejected (PROMOTION_REQUIRED)', () => {
  eq(tryMove(game('k7/4P3/8/8/8/8/8/4K3 w - - 0 1'), 'e7e8').errorCode, 'PROMOTION_REQUIRED');
});
test('P2', 'Promotion', 'player chooses Q, R, B or N; piece appears; SAN e8=N', () => {
  for (const p of ['Q', 'R', 'B', 'N']) {
    const s = play(game('k7/4P3/8/8/8/8/8/4K3 w - - 0 1'), 'e7e8' + p.toLowerCase());
    eq(s.pos.board[R.sqIndex('e8')], 'w' + p);
    if (p === 'N') eq(lastSan(s), 'e8=N');
  }
});
test('P3', 'Promotion', 'promotion by capture with check: exd8=Q+', () => {
  const s = play(game('3r4/4P3/8/8/8/8/k7/4K3 w - - 0 1'), 'e7d8q');
  eq(lastSan(s), 'exd8=Q');
  const t = play(game('3r3k/4P3/8/8/8/8/8/4K3 w - - 0 1'), 'e7d8q');
  eq(lastSan(t), 'exd8=Q+');
});
test('P4', 'Promotion', 'promotion field on a non-promoting move is rejected', () => {
  eq(tryMove(game(), 'e2e4q').errorCode, 'PROMOTION_NOT_ALLOWED');
});
test('P5', 'Promotion', 'black promotes on rank 1; promotion with mate is e1=Q#', () => {
  const s = play(game('8/8/8/8/8/8/p5PP/6RK b - - 0 1'), 'a2a1q');
  eq(s.pos.board[0], 'bQ'); eq(lastSan(s), 'a1=Q');
  const t = play(game('8/8/8/8/8/6k1/4p3/7K b - - 0 1'), 'e2e1q');
  eq(lastSan(t), 'e1=Q#'); eq(t.end, { kind: 'checkmate' });
});

// ---------- 4. check ----------
test('K1', 'Check', 'view shows check; only moves that resolve it are legal', () => {
  const s = play(game(), 'e2e4', 'f7f6', 'd1h5');
  const v = M.project(s);
  eq(v.inCheck, true); eq(lastSan(s), 'Qh5+');
  const moves = R.legalMoves(s.pos).map((m) => R.sqName(m.from) + R.sqName(m.to)).sort();
  eq(moves, ['g7g6'], 'only g6 blocks');
});
test('K2', 'Check', 'a pinned piece cannot move off the pin line; king cannot step into check', () => {
  eq(legal('4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1').some((m) => m.startsWith('e2')), false);
  eq(legal('4k3/8/8/8/8/8/3r4/4K3 w - - 0 1').includes('e1e2'), false);
});
test('K3', 'Check', 'publicSummary gives the checked seat a «کیش» badge', () => {
  const s = play(game(), 'e2e4', 'f7f6', 'd1h5');
  const ps = M.publicSummary(s);
  eq(ps.seats[1].badges[0]?.label, 'کیش');
});

// ---------- 5. checkmate ----------
test('M1', 'Checkmate', "fool's mate: game over, Black wins, SAN Qh4#", () => {
  const s = play(game(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
  eq(lastSan(s), 'Qh4#'); eq(s.end, { kind: 'checkmate' });
  eq(s.outcome.placements.find((p) => p.place === 1).seat, 1);
  eq(P.pgnResult(s), '0-1');
});
test('M2', 'Checkmate', 'no actions accepted after mate (GAME_FINISHED)', () => {
  const s = play(game(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
  eq(M.validate(s, W, { type: 'resign' }).errorCode, 'GAME_FINISHED');
  eq(M.legalActions(s, W), []);
});
test('M3', 'Checkmate', 'mate on the 100th half-move beats the 50-move rule (FIDE 9.3 / 9.6.2)', () => {
  const s = play(game('6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 80'), 'a1a8');
  eq(s.end, { kind: 'checkmate' });
});

// ---------- 6. stalemate ----------
test('S1', 'Stalemate', 'no legal move and not in check = draw (stalemate)', () => {
  const s = play(game('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1'), 'g1g6');
  eq(s.end, { kind: 'draw', draw: 'stalemate' }); eq(s.outcome.reason, 'draw'); eq(P.pgnResult(s), '1/2-1/2');
});

// ---------- 7. threefold repetition ----------
const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
test('T1', 'Threefold', 'auto mode: the same position for the 3rd time ends the game in a draw', () => {
  const s = play(game(), ...shuffle, ...shuffle);
  eq(s.end, { kind: 'draw', draw: 'repetition' });
});
test('T2', 'Threefold', 'not before the 3rd occurrence', () => {
  const s = play(game(), ...shuffle, 'g1f3', 'g8f6', 'f3g1');
  eq(s.end, null);
});
test('T3', 'Threefold', 'positions differ when castling rights differ (king walked and came back)', () => {
  const s = play(game(CASTLE), 'e1f1', 'e8f8', 'f1e1', 'f8e8', 'e1f1', 'e8f8', 'f1e1', 'f8e8');
  // start position (with rights) seen once; the no-rights position e1/e8 seen twice → no draw yet
  eq(s.end, null);
  play(s, 'e1f1', 'e8f8');
  eq(s.end, { kind: 'draw', draw: 'repetition' });
});
test('T4', 'Threefold', 'an en passant square that cannot be used does not make positions different', () => {
  const s = play(game(), 'e2e4', 'g8f6', 'g1f3', 'f6g8', 'f3g1', 'g8f6', 'g1f3', 'f6g8', 'f3g1');
  eq(s.end, { kind: 'draw', draw: 'repetition' });
});
test('T5', 'Threefold', 'FIDE mode: claim allowed on the 3rd occurrence, automatic on the 5th', () => {
  const s = play(game(null, { drawRule: 'fide' }), ...shuffle, ...shuffle);
  eq(s.end, null);
  const actor = seatToMove(s);
  eq(M.validate(s, actor, { type: 'claimDraw' }).ok, true);
  const s2 = play(game(null, { drawRule: 'fide' }), ...shuffle, ...shuffle, ...shuffle, ...shuffle);
  eq(s2.end, { kind: 'draw', draw: 'repetition' });
});
test('T6', 'Threefold', 'FIDE mode: player may claim with the move that WILL repeat (FIDE 9.2.1.1)', () => {
  const s = play(game(null, { drawRule: 'fide' }), ...shuffle, 'g1f3', 'g8f6', 'f3g1');
  // Black is to move; f6g8 would make the 3rd occurrence. FIDE lets Black write the move and claim.
  const v = M.validate(s, B, { type: 'claimDraw' });
  return v.ok ? true : 'claim with intended move not supported (only an already-standing position); ok for online play, documented in DECISIONS';
});

// ---------- 8. 50-move rule ----------
test('F1', '50-move', 'auto mode: 100 half-moves without pawn move or capture = draw', () => {
  const s = play(game('4k3/8/8/8/8/8/8/R3K3 w - - 99 80'), 'a1a2');
  eq(s.end, { kind: 'draw', draw: 'fiftyMove' });
});
test('F2', '50-move', 'a pawn move or capture resets the counter', () => {
  const s = play(game('4k3/8/8/8/8/8/P7/R3K3 w - - 98 80'), 'a2a3');
  eq(s.pos.halfmove, 0);
  const t = play(game('4k3/8/8/8/8/8/r7/R3K3 w - - 99 80'), 'a1a2');
  eq(t.pos.halfmove, 0); eq(t.end, null);
});
test('F3', '50-move', 'FIDE mode: claim at 100 half-moves, automatic at 150 (75-move rule)', () => {
  const s = play(game('4k3/8/8/8/8/8/8/R3K3 w - - 99 80', { drawRule: 'fide' }), 'a1a2');
  eq(s.end, null); eq(M.validate(s, B, { type: 'claimDraw' }).ok, true);
  const t = play(game('4k3/8/8/8/8/8/8/R3K3 w - - 149 100', { drawRule: 'fide' }), 'a1a2');
  eq(t.end, { kind: 'draw', draw: 'fiftyMove' });
});

// ---------- 9. insufficient material ----------
const capToLeave = (fen, mv) => play(game(fen), mv);
test('I1', 'Insufficient material', 'K v K (after a capture) = draw', () => {
  eq(capToLeave('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1', 'e1e2').end, { kind: 'draw', draw: 'material' });
});
test('I2', 'Insufficient material', 'K+B v K and K+N v K = draw', () => {
  eq(capToLeave('4k3/8/8/8/8/8/3Br3/4K3 w - - 0 1', 'e1e2').end, { kind: 'draw', draw: 'material' });
  eq(capToLeave('4k3/8/8/8/8/8/3Nr3/4K3 w - - 0 1', 'e1e2').end, { kind: 'draw', draw: 'material' });
});
test('I3', 'Insufficient material', 'K+B v K+B, bishops on the same colour = draw', () => {
  // white B on c1 (dark), black b on f8 (dark)
  eq(capToLeave('4kb2/8/8/8/8/8/4r3/2B1K3 w - - 0 1', 'e1e2').end, { kind: 'draw', draw: 'material' });
});
test('I4', 'Insufficient material', 'NOT a draw: K+B v K+B opposite colours, K+N v K+N, K+N+N v K, K+B v K+N, K+P v K', () => {
  for (const fen of ['4k1b1/8/8/8/8/8/4r3/2B1K3 w - - 0 1', '4kn2/8/8/8/8/8/4r3/2N1K3 w - - 0 1',
    '4k3/8/8/8/8/8/4r3/1NN1K3 w - - 0 1', '4kn2/8/8/8/8/8/4r3/2B1K3 w - - 0 1', '4k3/8/8/8/8/8/P3r3/4K3 w - - 0 1']) {
    eq(capToLeave(fen, 'e1e2').end, null, fen);
  }
});

// ---------- 10. resignation ----------
test('R1', 'Resignation', 'either player can resign at any time, also on the opponent’s turn; opponent wins', () => {
  const s = game();
  eq(M.validate(s, B, { type: 'resign' }).ok, true);
  M.apply(s, B, { type: 'resign' });
  eq(s.end, { kind: 'resign' }); eq(s.outcome.placements.find((p) => p.place === 1).seat, 0); eq(P.pgnResult(s), '1-0');
});
test('R2', 'Resignation', 'spectators cannot resign', () => {
  eq(M.validate(game(), { kind: 'spectator' }, { type: 'resign' }).ok, false);
});

// ---------- 11. draw offer ----------
test('D1', 'Draw offer', 'offer goes with a move; opponent accepts on their turn = draw by agreement', () => {
  const s = play(game(), 'e2e4=');
  eq(s.drawOffer, 0);
  eq(M.legalActions(s, B).some((a) => a.type === 'acceptDraw'), true);
  M.apply(s, B, { type: 'acceptDraw' });
  eq(s.end, { kind: 'draw', draw: 'agreement' });
});
test('D2', 'Draw offer', 'the offer lapses when the opponent moves instead', () => {
  const s = play(game(), 'e2e4=', 'e7e5');
  eq(s.drawOffer, null); eq(M.validate(s, W, { type: 'acceptDraw' }).errorCode, 'NO_DRAW_OFFER');
});
test('D3', 'Draw offer', 'the offering player cannot accept their own offer', () => {
  const s = play(game(), 'e2e4=');
  eq(M.validate(s, W, { type: 'acceptDraw' }).ok, false);
});
test('D4', 'Draw offer', 'anti-spam: one offer per 5 own moves', () => {
  const s = play(game(), 'e2e4=', 'e7e5', 'g1f3=');
  eq(s.drawOffer, null);
});
test('D5', 'Draw offer', 'minDrawMove 30: no agreement before move 30', () => {
  const s = play(game(null, { minDrawMove: '30' }), 'e2e4=');
  eq(s.drawOffer, null); eq(M.project(s).canOfferDraw, false);
});
test('D6', 'Draw offer', 'Armageddon: no offers; any draw = Black wins', () => {
  const s = play(game(null, { armageddon: true }), 'e2e4=');
  eq(s.drawOffer, null);
  const t = play(game('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', { armageddon: true }), 'g1g6');
  eq(t.end, { kind: 'draw', draw: 'stalemate' }); eq(t.outcome.placements.find((p) => p.place === 1).seat, 1);
});
test('D7', 'Draw offer', 'offer while it is the opponent’s turn (chess.com / FIDE 9.1.2.2 allow it)', () => {
  return 'not possible: an offer can only ride on your own move (UI must show «پیشنهاد تساوی» only on your turn, or queue it)';
});

// ---------- 12. flag fall ----------
const flag = (fen, opts) => { const s = game(fen, opts); M.onTimeout(s); return s; };
test('X1', 'Flag fall', 'side to move runs out of time = loss', () => {
  const s = flag(R.START_FEN);
  eq(s.end, { kind: 'timeout' }); eq(s.outcome.placements.find((p) => p.place === 1).seat, 1);
});
test('X2', 'Flag fall', 'flag vs lone king / K+B / K+N = draw (FIDE 6.9)', () => {
  for (const fen of ['4k3/8/8/8/8/8/PPPP4/4K3 w - - 0 1', '4kb2/8/8/8/8/8/PPPP4/4K3 w - - 0 1', '4kn2/8/8/8/8/8/PPPP4/4K3 w - - 0 1']) {
    eq(flag(fen).end, { kind: 'draw', draw: 'timeoutMaterial' }, fen);
  }
});
test('X3', 'Flag fall', 'flag vs K+N+N or K+P = loss (mate is possible)', () => {
  eq(flag('4k3/8/8/1nn5/8/8/PPPP4/4K3 w - - 0 1').end, { kind: 'timeout' });
  eq(flag('4k3/p7/8/8/8/8/PPPP4/4K3 w - - 0 1').end, { kind: 'timeout' });
});
test('X4', 'Flag fall', 'strict FIDE 6.9: flag vs K+N when the flagger still has pieces (helpmate possible) = loss', () => {
  const s = flag('4kn2/8/8/8/8/8/PPPP4/4K3 w - - 0 1');
  return s.end.kind === 'timeout' ? true : 'engine gives a draw (chess.com rule). Strict FIDE: a helpmate K+N v K+pawns exists, so the flagger loses. Keep chess.com rule? owner decision';
});
test('X5', 'Flag fall', 'flag vs K+B+B with all bishops on one colour (promotion) = draw', () => {
  const s = flag('4k3/8/8/2b5/3b4/8/8/4K3 w - - 0 1');
  return s.end.kind === 'draw' ? true : 'engine says loss; bishops on one colour can never mate a bare king (edge case, only after under-promotion)';
});
test('X6', 'Flag fall', 'flag in Armageddon: White flags = Black wins; Black flags vs bare king = draw → Black wins', () => {
  const s = flag(R.START_FEN, { armageddon: true });
  eq(s.outcome.placements.find((p) => p.place === 1).seat, 1);
  const t = flag('4k3/8/8/8/8/8/8/4K3 b - - 0 1', { armageddon: true });
  eq(t.outcome.placements.find((p) => p.place === 1).seat, 1);
});

// ---------- 13. notation / record ----------
test('N1', 'Notation', 'SAN disambiguation: Nbd2, R1a3, Qh4e1', () => {
  const a = play(game('4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1'), 'b1d2'); eq(lastSan(a), 'Nbd2');
  const b = play(game('4k3/8/R7/8/8/8/8/R3K3 w - - 0 1'), 'a1a3'); eq(lastSan(b), 'R1a3');
  const c = play(game('8/k7/8/8/4Q2Q/8/8/1K5Q w - - 0 1'), 'h4e1'); eq(lastSan(c), 'Qh4e1');
});
test('N2', 'Notation', 'PGN export has 7 tags, result and Termination', () => {
  const s = play(game(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
  const pgn = P.toPgn(s, { event: 'Test', site: 'boardgameverse.ir', date: '2026.11.07', players: ['A', 'B'] });
  if (!/\[Result "0-1"\]/.test(pgn) || !/1\. f3 e5 2\. g4 Qh4# 0-1/.test(pgn)) throw new Error(pgn);
});
test('N3', 'Notation', 'PGN Termination tells draws apart (stalemate / repetition / agreement)', () => {
  const s = play(game('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1'), 'g1g6');
  const pgn = P.toPgn(s, { event: 'T', site: 's', date: 'd', players: ['A', 'B'] });
  return /Termination "normal"/.test(pgn) ? 'Termination is "normal" for every non-timeout end (PGN spec allows it); add the draw reason as a comment or tag for the result screen and arbiter' : true;
});
test('N4', 'Notation', 'Armageddon draw in PGN', () => {
  const t = play(game('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', { armageddon: true }), 'g1g6');
  const r = P.pgnResult(t);
  return r === '1/2-1/2' ? true : `PGN Result is ${r} for a drawn Armageddon game; the board result was ½-½ (tie-break awards Black). Arbiters usually keep ½-½ in PGN and note the playoff rule`;
});

// ---------- report ----------
const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
let pass = 0, fail = 0, note = 0;
for (const r of results) {
  const status = r.ok && !r.note ? 'PASS' : r.ok ? 'PASS*' : (r.note.startsWith('engine') || r.note.startsWith('not ') || r.note.startsWith('claim') || r.note.startsWith('PGN') || r.note.startsWith('Termination')) ? 'GAP' : 'FAIL';
  r.status = status;
  if (status === 'PASS') pass++; else if (status === 'FAIL') fail++; else note++;
  console.log(`${pad(status, 6)} ${pad(r.id, 12)} ${pad(r.area, 22)} ${r.name}${r.note ? `\n         → ${r.note}` : ''}`);
}
console.log(`\n${pass} pass, ${note} gaps/notes, ${fail} fail, ${results.length} total`);
import('node:fs').then((fs) => fs.writeFileSync('E:/AI/Claude/bgv-chess/engine/rules-test-results.json', JSON.stringify(results, null, 2)));
