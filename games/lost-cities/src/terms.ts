import type { Term } from '@bg/ui';

/** Lost Cities terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  expedition: { fa: 'سفر', bg: 'Expedition' }, wager: { fa: 'شرط', bg: 'Wager' }
,
  expeditionEz: { fa: 'سفرِ', bg: 'Expedition' }, expeditions: { fa: 'سفرها', bg: 'Expeditions' }, card: { fa: 'کارت', bg: 'Card' }, cardsEz: { fa: 'کارت‌های', bg: 'Cards' },
  deck: { fa: 'دسته', bg: 'Deck' }, piles: { fa: 'کپه‌ها', bg: 'Piles' }, pileEz: { fa: 'کپهٔ', bg: 'Pile' }, discardPileEz: { fa: 'کپهٔ دور ریختهٔ', bg: 'Discard Pile' },
  hand: { fa: 'دست', bg: 'Hand' }, handYour: { fa: 'دستتان', bg: 'Hand' }, round: { fa: 'دست', bg: 'Round' }, roundLbl: { fa: 'دور', bg: 'Round' }, bonus: { fa: 'جایزه', bg: 'Bonus' },
  playV: { fa: 'بگذارید', bg: 'Play' }, discardV: { fa: 'دور بیندازید', bg: 'Discard' }, discardImp: { fa: 'دور بینداز', bg: 'Discard' }, discardP: { fa: 'دور انداخت', bg: 'Discarded' },
  drawV: { fa: 'بردارید', bg: 'Draw' }, drawN: { fa: 'برداشتن', bg: 'Draw' }
} satisfies Record<string, Term>;
