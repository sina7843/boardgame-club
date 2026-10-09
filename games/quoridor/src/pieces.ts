// Pawn and wood art: cut from a generated sheet (see DECISIONS.md). Shared by the renderer and the cover.
import red from './art/pawn-red.webp'; import blue from './art/pawn-blue.webp';
import green from './art/pawn-green.webp'; import yellow from './art/pawn-yellow.webp';
export { default as OAK } from './art/tex-oak.webp';

// Indexed by seat, matching the seat colours red, blue, green, yellow.
export const PAWN_SRC = [red, blue, green, yellow];
