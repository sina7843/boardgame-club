import type { Term } from '@bg/ui';

/** Jaipur terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  diamond: { fa: 'الماس', bg: 'Diamonds' }, gold: { fa: 'طلا', bg: 'Gold' }, silver: { fa: 'نقره', bg: 'Silver' },
  cloth: { fa: 'پارچه', bg: 'Cloth' }, spice: { fa: 'ادویه', bg: 'Spice' }, leather: { fa: 'چرم', bg: 'Leather' },
  camel: { fa: 'شتر', bg: 'Camel' }, herd: { fa: 'گلهٔ', bg: 'Herd' }
,
  card: { fa: 'کارت', bg: 'Card' }, good: { fa: 'کالا', bg: 'Good' }, deck: { fa: 'دسته', bg: 'Deck' }, market: { fa: 'بازار', bg: 'Market' }, marketCamels: { fa: 'شترهای بازار', bg: 'Market Camels' },
  hand: { fa: 'دست', bg: 'Hand' }, handYour: { fa: 'دستتان', bg: 'Hand' }, round: { fa: 'دست', bg: 'Round' }, roundLbl: { fa: 'دور', bg: 'Round' }, sealLbl: { fa: 'مهر', bg: 'Seals' }, seals: { fa: 'نشان‌ها', bg: 'Seals' },
  camels: { fa: 'شترها', bg: 'Camels' }, takeOne: { fa: 'یک کالا', bg: 'Take a Good' }, takeN: { fa: 'برداشتن', bg: 'Take' }, exchange: { fa: 'معاوضه', bg: 'Exchange' }, exchangeEz: { fa: 'معاوضهٔ', bg: 'Exchange' }, sell: { fa: 'فروش', bg: 'Sell' },
  token: { fa: 'سکه', bg: 'Token' }, tokensGood: { fa: 'سکه‌های کالا', bg: 'Goods Tokens' }, bonus: { fa: 'پاداش', bg: 'Bonus' }, action: { fa: 'کار', bg: 'Action' }
} satisfies Record<string, Term>;
