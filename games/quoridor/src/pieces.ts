// Board, pawn and wall art: design/games/group-a/art/quoridor, copied as-is. Shared by the renderer and the cover.
import red from './art/quoridor-pawn-red.png'; import gold from './art/quoridor-pawn-gold.png';
import brown from './art/quoridor-pawn-brown.png'; import green from './art/quoridor-pawn-green.png';
export { default as BOARD } from './art/quoridor-board.png';
export { default as WALL_H } from './art/quoridor-wall-h.png';
export { default as WALL_V } from './art/quoridor-wall-v.png';

// Indexed by seat: red, gold, brown, green (the design's pawn colours and goal sides).
export const PAWN_SRC = [red, gold, brown, green];
