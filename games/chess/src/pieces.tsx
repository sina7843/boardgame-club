// Piece art (design/games/chess/art/pieces): «classic» (default, WebP) and six vector sets for the settings.
// Shared by the renderer and the catalog cover. Never drawn with CSS/SVG/Unicode: images only.
import type { Color, PieceType } from './rules.ts';
import wb from './art/w-b.webp'; import wk from './art/w-k.webp'; import wn from './art/w-n.webp';
import wp from './art/w-p.webp'; import wq from './art/w-q.webp'; import wr from './art/w-r.webp';
import bb from './art/b-b.webp'; import bk from './art/b-k.webp'; import bn from './art/b-n.webp';
import bp from './art/b-p.webp'; import bq from './art/b-q.webp'; import br from './art/b-r.webp';

const SRC: Record<Color, Record<PieceType, string>> = {
  w: { K: wk, Q: wq, R: wr, B: wb, N: wn, P: wp },
  b: { K: bk, Q: bq, R: br, B: bb, N: bn, P: bp }
};
const VECTOR = import.meta.glob('./art/*/*.svg', { eager: true, query: '?url', import: 'default' });

export const PIECE_SETS = ['classic', 'flat', 'walnut', 'glass', 'clay', 'persian', 'neon'] as const;
export type PieceSet = (typeof PIECE_SETS)[number];
export const PIECE_SET_FA: Record<PieceSet, string> = {
  classic: 'کلاسیک تخت', flat: 'تخت حرفه‌ای', walnut: 'گردو', glass: 'کریستال', clay: 'خمیری', persian: 'کاشی ایرانی', neon: 'نئون'
};

export const pieceSrc = (type: PieceType, color: Color, set: PieceSet = 'classic') =>
  (set !== 'classic' ? VECTOR[`./art/${set}/${color}-${type.toLowerCase()}.svg`] : undefined) ?? SRC[color][type];
