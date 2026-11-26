import type { Term } from '@bg/ui';

/** Coup terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  duke: { fa: 'دوک', bg: 'Duke' }, assassin: { fa: 'آدم‌کش', bg: 'Assassin' }, captain: { fa: 'کاپیتان', bg: 'Captain' },
  ambassador: { fa: 'سفیر', bg: 'Ambassador' }, contessa: { fa: 'کنتس', bg: 'Contessa' },
  income: { fa: 'درآمد', bg: 'Income' }, foreignAid: { fa: 'کمک خارجی', bg: 'Foreign Aid' }, coup: { fa: 'کودتا', bg: 'Coup' },
  tax: { fa: 'مالیات', bg: 'Tax' }, assassinate: { fa: 'ترور', bg: 'Assassinate' }, steal: { fa: 'دزدی', bg: 'Steal' },
  exchange: { fa: 'مبادله', bg: 'Exchange' }, challenge: { fa: 'چالش', bg: 'Challenge' }, block: { fa: 'جلوگیری', bg: 'Block' },
  influence: { fa: 'نفوذ', bg: 'Influence' }
,
  coin: { fa: 'سکه', bg: 'Coin' }, treasury: { fa: 'خزانه', bg: 'Treasury' }, treasuryCoin: { fa: 'سکهٔ خزانه', bg: 'Treasury Coins' }, card: { fa: 'کارت', bg: 'Card' }, cardYi: { fa: 'کارتی', bg: 'a Card' },
  cards: { fa: 'کارت‌ها', bg: 'Cards' }, cardsEz: { fa: 'کارت‌های', bg: 'Cards' }, cardsPos: { fa: 'کارت‌هایش', bg: 'Cards' }, facedown: { fa: 'پشت‌ورو', bg: 'Face-down' },
  deck: { fa: 'دسته', bg: 'Deck' }, court: { fa: 'دربار', bg: 'Court' }, hand: { fa: 'دست', bg: 'Hand' }, action: { fa: 'کار', bg: 'Action' }, actions: { fa: 'کارها', bg: 'Actions' },
  target: { fa: 'هدف', bg: 'Target' }, keep: { fa: 'نگه دارید', bg: 'Keep' }, keepN: { fa: 'نگه داشتن', bg: 'Keep' }, allow: { fa: 'قبول', bg: 'Allow' }, allowQ: { fa: 'قبول می‌کنید', bg: 'Allow' },
  loseV: { fa: 'از دست می‌دهید', bg: 'Lose' }, loseN: { fa: 'از دست دادن', bg: 'Lose' }, revealV: { fa: 'رو می‌شود', bg: 'Reveal' }, revealImp: { fa: 'رو کن', bg: 'Reveal' },
  claim: { fa: 'ادعا', bg: 'Claim' }, claimEz: { fa: 'ادعای', bg: 'Claim' }, blockedIt: { fa: 'جلویش را گرفت', bg: 'Blocked' }, liar: { fa: 'دروغ می‌گویی', bg: 'You lie' },
  truth: { fa: 'راست', bg: 'True' }, bluff: { fa: 'بلوف', bg: 'Bluff' }, response: { fa: 'پاسخ', bg: 'Response' }, log: { fa: 'رویدادها', bg: 'Log' }
} satisfies Record<string, Term>;
