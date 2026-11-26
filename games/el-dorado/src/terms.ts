import type { Term } from '@bg/ui';

/** El Dorado terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Terrain names (jungle, water, village, mountain) stay Persian. */
export const terms = {
  machete: { fa: 'قمه', bg: 'Machete' }, paddle: { fa: 'پارو', bg: 'Paddle' }, coin: { fa: 'سکه', bg: 'Coin' }, coins: { fa: 'سکه', bg: 'Coins' },
  joker: { fa: 'همه‌کاره', bg: 'Joker' }, rubble: { fa: 'آوار', bg: 'Rubble' }, camp: { fa: 'اردوگاه', bg: 'Base Camp' },
  deck: { fa: 'دسته', bg: 'Deck' }, discard: { fa: 'دورریز', bg: 'Discard' }, market: { fa: 'بازار', bg: 'Market' }
} satisfies Record<string, Term>;
