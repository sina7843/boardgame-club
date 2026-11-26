import type { Term } from '@bg/ui';

/** High Society terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  prestige: { fa: 'افتخار', bg: 'Prestige' }, passe: { fa: 'از مد افتاده', bg: 'Passé' }, scandal: { fa: 'رسوایی', bg: 'Scandal' },
  faux: { fa: 'گاف', bg: 'Faux Pas' }, disgrace: { fa: 'رسوایی', bg: 'Disgrace' }, bid: { fa: 'پیشنهاد', bg: 'Bid' }
,
  status: { fa: 'منزلت', bg: 'Status' }, moneyCards: { fa: 'کارت پول', bg: 'Money Cards' }, fauxBadge: { fa: 'اشتباه', bg: 'Faux Pas' }, deck: { fa: 'دسته', bg: 'Deck' }, redCardLbl: { fa: 'کارت قرمز', bg: 'Red Card' },
  card: { fa: 'کارت', bg: 'Card' }, money: { fa: 'پول', bg: 'Money' }, moneyPos: { fa: 'پولش', bg: 'Money' }, moneyPosPl: { fa: 'پولشان', bg: 'Money' }, auction: { fa: 'مزایده', bg: 'Auction' },
  note: { fa: 'اسکناس', bg: 'Money card' }, notes: { fa: 'اسکناس‌ها', bg: 'Money cards' }, notesEz: { fa: 'اسکناس‌های', bg: 'Money cards' },
  bidYour: { fa: 'پیشنهادتان', bg: 'Bid' }, highest: { fa: 'بالاترین', bg: 'Highest' }, redCard: { fa: 'کارت قاب‌قرمز', bg: 'red-bordered card' }, redFrame: { fa: 'قاب قرمز', bg: 'Red border' },
  poorest: { fa: 'کم‌پول‌ترین', bg: 'Poorest' }, passPol: { fa: 'کنار بکشید', bg: 'Pass' }, passIf: { fa: 'کنار بکشد', bg: 'Pass' }, passMe: { fa: 'کنار می‌کشم', bg: 'Pass' }, passed: { fa: 'کنار کشید', bg: 'Passed' }
} satisfies Record<string, Term>;
