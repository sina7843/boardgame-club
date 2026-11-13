// All positions on the canvas, played through the repo engine (illegal move = build error).
import { R, playLine, legalFrom, capturedOf, material } from './lib.mjs';

const M = (s) => s.trim().split(/\s+/);
function scene(name, fen, ucis, extra = {}) {
  const { pos, hist } = playLine(fen, ucis);
  const startFen = R.fromFen(fen ?? R.START_FEN);
  const last = hist.at(-1);
  const inCheck = R.inCheck(pos);
  const kingSq = R.sqName(pos.board.indexOf(pos.turn + 'K'));
  const capsW = capturedOf(pos.board, 'b'); // black pieces White has taken
  const capsB = capturedOf(pos.board, 'w');
  const mw = material(pos.board, 'w'), mb = material(pos.board, 'b');
  return {
    name, pos, hist, startMove: startFen.fullmove, startColor: startFen.turn,
    last: last ? [last.from, last.to] : null, inCheck, check: inCheck ? kingSq : null,
    // for endgames from a FEN the "captured" list is the material missing from a full set
    capsW, capsB, leadW: mw - mb > 0 ? mw - mb : 0, leadB: mb - mw > 0 ? mb - mw : 0,
    legal: (sq) => legalFrom(pos, sq).map((m) => R.sqName(m.to)),
    ...extra
  };
}

// Main game: Italian, Giuoco Piano main line. White = you (مینا), Black = نیلوفر.
const ITALIAN = M('e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4 c5b4 c1d2 b4d2 b1d2 d7d5 e4d5 f6d5 d1b3 c6e7 e1g1 e8g8 f1e1 c7c6');
export const S = {
  main: scene('main', null, ITALIAN),
  mainB: scene('mainB', null, [...ITALIAN, 'd2e4']), // 13.Ne4, Black to move
  check: scene('check', null, ITALIAN.slice(0, 12)), // 6...Bb4+
  // Promotion: rook ending, White's e-pawn reaches e7.
  promo: scene('promo', '8/8/4P1k1/8/8/5K2/r7/8 w - - 0 50', M('e6e7 a2a3 f3g2 a3e3')),
  // Premove: Sicilian Najdorf, English attack. You are Black; White to move, your premove Nf6-h5 queued.
  pre: scene('pre', null, M('e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3 c8e6 f2f3 f8e7 d1d2 e8g8 e1c1 b8d7 g2g4 b7b5 g4g5 b5b4')),
  // Low time: rook ending, you (White) to move with 8.4 s.
  low: scene('low', '2r3k1/5pp1/7p/8/8/6PP/5PK1/3R4 w - - 0 36', M('d1d7 c8c2 d7a7 c2b2')),
  // Draw offer: equal rook ending.
  draw: scene('draw', '3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 30', M('g1f1 g8f8 f1e2 f8e7')),
  // Game over: back-rank mate.
  mate: scene('mate', '6k1/p2r1ppp/8/8/8/8/5PPP/3RR1K1 b - - 0 30', M('d7d1 e1d1 a7a6 d1d8')),
  // Threefold repetition (phone, draw result).
  ep: scene('ep', null, M('e2e4 e7e6 e2e4'.replace('e2e4 e7e6 e2e4', 'e2e4 e7e6 e4e5 d7d5'))),
  rep: scene('rep', null, M('e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 f1e1 e4d6 f3e5 f8e7 b5f1 c6e5 e1e5 e8g8 d2d4 e7f6 e5e1 f8e8 c2c3 e8e1 d1e1 d6f5 c1f4 d7d6 b1d2 c8e6 d2f3 d8d7 e1e2 a8e8 e2d2 d7c8 d2e2 c8d7 e2d2 d7c8 d2e2 c8d7')),
};
// Sanity: the repetition line really ends the game by threefold repetition under the engine module.
export function checkRepetition() {
  const st = R.chessModule.setup({ playerCount: 2, rng: { nextInt: () => 0 }, options: { firstMove: 'host' } });
  for (const h of S.rep.hist) {
    const a = { type: 'move', from: h.from, to: h.to };
    const actor = { kind: 'player', seat: st.colors[0] === st.pos.turn ? 0 : 1 };
    const v = R.chessModule.validate(st, actor, a);
    if (!v.ok) return `rejected ${h.san}: ${v.errorCode}`;
    R.chessModule.apply(st, actor, a);
  }
  return st.end;
}
if (process.argv[1]?.endsWith('scenes.mjs')) {
  for (const [k, s] of Object.entries(S)) console.log(k.padEnd(6), s.hist.map((h) => h.san).join(' '), '| check', s.check, '| lead W', s.leadW, 'B', s.leadB);
  console.log('main Qb3 →', S.main.legal('b3').join(','), '| check Bc1 →', S.check.legal('c1').join(','), '| e7 →', S.promo.legal('e7').join(','));
  console.log('rep end:', JSON.stringify(checkRepetition()));
  const mateEnd = R.legalMoves(S.mate.pos).length === 0 && S.mate.inCheck; console.log('mate is mate:', mateEnd);
}
