import type { Term } from '@bg/ui';

/** Quoridor terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  wall: { fa: 'دیوار', bg: 'Wall' }, walls: { fa: 'دیوارهای', bg: 'Walls' }, wallH: { fa: 'دیوار افقی', bg: 'Horizontal wall' },
  wallV: { fa: 'دیوار عمودی', bg: 'Vertical wall' }, wallTwo: { fa: 'دیوار دوخانه‌ای', bg: 'Wall' },
  pawn: { fa: 'مهره', bg: 'Pawn' }, pawnEz: { fa: 'مهرهٔ', bg: 'Pawn' }, jump: { fa: 'می‌پرید', bg: 'Jump' },
  goal: { fa: 'هدف', bg: 'Goal' }, row: { fa: 'ردیف', bg: 'Row' }, column: { fa: 'ستون', bg: 'Column' },
  distance: { fa: 'فاصله', bg: 'Distance' }
} satisfies Record<string, Term>;
