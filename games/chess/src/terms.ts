import type { Term } from '@bg/ui';

/** Chess terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  king: { fa: 'شاه', bg: 'King' }, queen: { fa: 'وزیر', bg: 'Queen' }, rook: { fa: 'رخ', bg: 'Rook' },
  bishop: { fa: 'فیل', bg: 'Bishop' }, knight: { fa: 'اسب', bg: 'Knight' }, pawn: { fa: 'سرباز', bg: 'Pawn' },
  check: { fa: 'کیش', bg: 'Check' }, checkmate: { fa: 'مات', bg: 'Checkmate' }, stalemate: { fa: 'پات', bg: 'Stalemate' },
  enPassant: { fa: 'آن‌پاسان', bg: 'En passant' }, castling: { fa: 'قلعه‌رفتن', bg: 'Castling' },
  promotion: { fa: 'ارتقا', bg: 'Promotion' }, premove: { fa: 'پری‌موو', bg: 'Premove' },
  bullet: { fa: 'بولت', bg: 'Bullet' }, blitz: { fa: 'بلیتس', bg: 'Blitz' }, rapid: { fa: 'رپید', bg: 'Rapid' }
} satisfies Record<string, Term>;
