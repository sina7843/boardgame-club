import type { Term } from '@bg/ui';

/** Azul terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Colour names stay Persian. */
export const terms = {
  factory: { fa: 'کارگاه', bg: 'Factory' }, factories: { fa: 'کارگاه‌ها', bg: 'Factories' },
  floor: { fa: 'کف', bg: 'Floor' }, wall: { fa: 'دیوار', bg: 'Wall' },
  patternLines: { fa: 'ردیف‌های الگو', bg: 'Pattern lines' }, bag: { fa: 'کیسه', bg: 'Bag' },
  tile: { fa: 'کاشی', bg: 'Tile' }, tilesPl: { fa: 'کاشی‌های', bg: 'Tiles' }, round: { fa: 'دور', bg: 'Round' },
  roundEnd: { fa: 'پایان دور', bg: 'Round end' }, lid: { fa: 'جعبه', bg: 'Lid' },
  line: { fa: 'ردیف', bg: 'Line' }, row: { fa: 'ردیف', bg: 'Row' }, column: { fa: 'ستون', bg: 'Column' }, color: { fa: 'رنگ', bg: 'Color' },
  fullLine: { fa: 'ردیف پر', bg: 'Full lines' }, center: { fa: 'وسط', bg: 'Center' }, centerTable: { fa: 'وسط میز', bg: 'Center' },
  boards: { fa: 'تخته‌ها', bg: 'Boards' }, boardEz: { fa: 'تختهٔ', bg: 'Board' }, scoreTrack: { fa: 'مسیر امتیاز', bg: 'Score track' },
  endBonus: { fa: 'امتیاز پایان بازی', bg: 'End-game bonus' }
} satisfies Record<string, Term>;
