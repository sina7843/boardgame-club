import type { Term } from '@bg/ui';

/** Chess terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  king: { fa: 'شاه', bg: 'King' }, queen: { fa: 'وزیر', bg: 'Queen' }, rook: { fa: 'رخ', bg: 'Rook' },
  bishop: { fa: 'فیل', bg: 'Bishop' }, knight: { fa: 'اسب', bg: 'Knight' }, pawn: { fa: 'سرباز', bg: 'Pawn' },
  check: { fa: 'کیش', bg: 'Check' }, checkmate: { fa: 'مات', bg: 'Checkmate' }, stalemate: { fa: 'پات', bg: 'Stalemate' },
  enPassant: { fa: 'آن‌پاسان', bg: 'En passant' }, castling: { fa: 'قلعه‌رفتن', bg: 'Castling' },
  promotion: { fa: 'ارتقا', bg: 'Promotion' }, premove: { fa: 'پری‌موو', bg: 'Premove' },
  bullet: { fa: 'بولت', bg: 'Bullet' }, blitz: { fa: 'بلیتس', bg: 'Blitz' }, rapid: { fa: 'رپید', bg: 'Rapid' },
  resign: { fa: 'تسلیم', bg: 'Resign' }, resignQ: { fa: 'تسلیم می‌شوید؟', bg: 'Resign?' },
  draw: { fa: 'مساوی', bg: 'Draw' }, drawOffer: { fa: 'پیشنهاد مساوی', bg: 'Draw offer' },
  armageddon: { fa: 'آرماگدون', bg: 'Armageddon' }, pinned: { fa: 'میخ شده', bg: 'Pinned' },
  piece: { fa: 'مهره', bg: 'Piece' }, pieces: { fa: 'مهره‌ها', bg: 'Pieces' }, capturedPieces: { fa: 'مهره‌های زده‌شده', bg: 'Captured pieces' },
  capture: { fa: 'زدن', bg: 'Capture' }, lastRank: { fa: 'خط آخر', bg: 'last rank' },
  threefold: { fa: 'تکرار سه‌بارهٔ یک وضعیت', bg: 'Threefold repetition' }, threefoldShort: { fa: 'تکرار سه‌باره', bg: 'Threefold repetition' },
  fiftyMove: { fa: 'قانون ۵۰ حرکت', bg: 'Fifty-move rule' }, insufficient: { fa: 'مهرهٔ کافی برای مات نمانده', bg: 'Insufficient material' },
  material: { fa: 'مادی', bg: 'Material' }, clock: { fa: 'ساعت', bg: 'Clock' },
  autoQueen: { fa: 'ارتقای خودکار به وزیر', bg: 'Auto-queen' }, coords: { fa: 'مختصات', bg: 'Coordinates' }
} satisfies Record<string, Term>;
