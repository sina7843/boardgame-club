import type { Term } from '@bg/ui';

/** Dominion terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Card names come from the rules data and stay Persian. */
export const terms = {
  action: { fa: 'کنش', bg: 'Action' }, buy: { fa: 'خرید', bg: 'Buy' }, actions: { fa: 'کنش', bg: 'Actions' }, buys: { fa: 'خرید', bg: 'Buys' },
  coins: { fa: 'سکه', bg: 'Coins' }, treasures: { fa: 'گنج‌ها', bg: 'Treasures' }, deck: { fa: 'دسته', bg: 'Deck' },
  hand: { fa: 'دست', bg: 'Hand' }, discard: { fa: 'دورریز', bg: 'Discard' }, discarded: { fa: 'دورریخته', bg: 'Discard' },
  supply: { fa: 'بازار', bg: 'Supply' }, inPlay: { fa: 'در بازی', bg: 'In Play' }
} satisfies Record<string, Term>;
