import type { Term } from '@bg/ui';

/** Star Realms terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  trade: { fa: 'تجارت', bg: 'Trade' }, combat: { fa: 'نبرد', bg: 'Combat' }, authority: { fa: 'اعتبار', bg: 'Authority' },
  scrap: { fa: 'اسقاط', bg: 'Scrap' }, scrapPool: { fa: 'نابودی', bg: 'Scrap' }, scrapped: { fa: 'نابودشده‌ها', bg: 'Scrapped' },
  base: { fa: 'پایگاه', bg: 'Base' }, outpost: { fa: 'پاسگاه', bg: 'Outpost' }, explorer: { fa: 'کاوشگر', bg: 'Explorer' },
  tradeRow: { fa: 'ردیف بازار', bg: 'Trade Row' }, tradeDeck: { fa: 'دستهٔ تجارت', bg: 'Trade Deck' },
  deck: { fa: 'دسته', bg: 'Deck' }, discard: { fa: 'دورریز', bg: 'Discard' },
  fed: { fa: 'فدراسیون', bg: 'Trade Federation' }, blob: { fa: 'هیولاها', bg: 'Blob' }, cult: { fa: 'ماشین‌پرستان', bg: 'Machine Cult' }, emp: { fa: 'امپراتوری', bg: 'Star Empire' }
} satisfies Record<string, Term>;
