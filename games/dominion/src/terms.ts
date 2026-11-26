import type { Term } from '@bg/ui';

/** Dominion terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Card names: see CARD_EN (the Persian names live in the rules data). */
export const terms = {
  action: { fa: 'کنش', bg: 'Action' }, buy: { fa: 'خرید', bg: 'Buy' }, actions: { fa: 'کنش', bg: 'Actions' }, buys: { fa: 'خرید', bg: 'Buys' },
  coins: { fa: 'سکه', bg: 'Coins' }, treasures: { fa: 'گنج‌ها', bg: 'Treasures' },
  pile: { fa: 'دسته', bg: 'Pile' }, pileEz: { fa: 'دستهٔ', bg: 'Pile' }, deck: { fa: 'دسته', bg: 'Deck' },
  hand: { fa: 'دست', bg: 'Hand' }, handYour: { fa: 'دستتان', bg: 'hand' }, discard: { fa: 'دورریز', bg: 'Discard' }, discarded: { fa: 'دورریخته', bg: 'Discard' }, discardHud: { fa: 'کنار', bg: 'Discard' },
  supply: { fa: 'بازار', bg: 'Supply' }, inPlay: { fa: 'در بازی', bg: 'In Play' },
  card: { fa: 'کارت', bg: 'Card' }, cardOne: { fa: 'کارتی', bg: 'Card' }, cardsEz: { fa: 'کارت‌های', bg: 'Cards' }, cardsYi: { fa: 'کارت‌هایی', bg: 'Cards' },
  cost: { fa: 'قیمت', bg: 'Cost' }, province: { fa: 'ایالت', bg: 'Province' }, trash: { fa: 'نابودی', bg: 'Trash' },
  discardImp: { fa: 'دور بریزید', bg: 'Discard' }, discardPl: { fa: 'دور می‌ریزند', bg: 'discard' }, discardV: { fa: 'دور ریختن', bg: 'Discard' },
  playV: { fa: 'بازی', bg: 'Play' }, playImp: { fa: 'بازی کنید', bg: 'Play' }, endTurn: { fa: 'پایان نوبت', bg: 'End turn' }
} satisfies Record<string, Term>;

/** English card names by card id (the Persian name stays in the rules data). */
export const CARD_EN: Record<string, string> = {
  copper: 'Copper', silver: 'Silver', gold: 'Gold', estate: 'Estate', duchy: 'Duchy', province: 'Province',
  cellar: 'Cellar', moat: 'Moat', merchant: 'Merchant', village: 'Village', workshop: 'Workshop', militia: 'Militia',
  remodel: 'Remodel', smithy: 'Smithy', market: 'Market', mine: 'Mine'
};
