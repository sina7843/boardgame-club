// Painted Staunton pieces: transparent 160x160 cut-outs from a generated sheet (see DECISIONS.md).
// Shared by the renderer and the catalog cover.
import type { Color, PieceType } from './rules.ts';
import wb from './art/w-b.webp'; import wk from './art/w-k.webp'; import wn from './art/w-n.webp';
import wp from './art/w-p.webp'; import wq from './art/w-q.webp'; import wr from './art/w-r.webp';
import bb from './art/b-b.webp'; import bk from './art/b-k.webp'; import bn from './art/b-n.webp';
import bp from './art/b-p.webp'; import bq from './art/b-q.webp'; import br from './art/b-r.webp';

const SRC: Record<Color, Record<PieceType, string>> = {
  w: { K: wk, Q: wq, R: wr, B: wb, N: wn, P: wp },
  b: { K: bk, Q: bq, R: br, B: bb, N: bn, P: bp }
};

export const pieceSrc = (type: PieceType, color: Color) => SRC[color][type];
