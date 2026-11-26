import type { Term } from '@bg/ui';

/** Love Letter terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  guard: { fa: 'نگهبان', bg: 'Guard' }, priest: { fa: 'کشیش', bg: 'Priest' }, baron: { fa: 'بارون', bg: 'Baron' },
  handmaid: { fa: 'ندیمه', bg: 'Handmaid' }, prince: { fa: 'شاهزاده', bg: 'Prince' }, king: { fa: 'شاه', bg: 'King' },
  countess: { fa: 'کنتس', bg: 'Countess' }, princess: { fa: 'شاهزاده‌خانم', bg: 'Princess' }
,
  card: { fa: 'کارت', bg: 'Card' }, cardPos: { fa: 'کارتش', bg: 'Card' }, cardsEz: { fa: 'کارت‌های', bg: 'Cards' }, hand: { fa: 'دست', bg: 'Hand' }, handsPl: { fa: 'دست‌ها', bg: 'Hands' }, handYour: { fa: 'دست‌تان', bg: 'Hand' },
  deck: { fa: 'دسته', bg: 'Deck' }, round: { fa: 'دور', bg: 'Round' }, tokenLbl: { fa: 'توکن', bg: 'Token' }, tokenN: { fa: 'نشان', bg: 'Token' }, protectedLbl: { fa: 'محافظت‌شده', bg: 'Protected' },
  protectedV: { fa: 'در امانید', bg: 'Protected' }, protectedTitle: { fa: 'در امان', bg: 'Protected' }, target: { fa: 'هدف', bg: 'Target' }, tie: { fa: 'مساوی', bg: 'Tie' }, log: { fa: 'رویدادها', bg: 'Log' },
  guessV: { fa: 'حدس بزنید', bg: 'Guess' }, guessN: { fa: 'حدس', bg: 'Guess' }, lookV: { fa: 'ببینید', bg: 'Look' }, compareV: { fa: 'مقایسه کنید', bg: 'Compare' }, tradeV: { fa: 'عوض کنید', bg: 'Trade' },
  discardV: { fa: 'دور بیندازید', bg: 'Discard' }, playV: { fa: 'بازی کنید', bg: 'Play' }, playN: { fa: 'بازی', bg: 'Play' }, playP: { fa: 'بازی کرد', bg: 'Played' }
} satisfies Record<string, Term>;
