import type { Term } from '@bg/ui';

/** Citadels terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Character / district names use the official English names. */
export const terms = {
  crown: { fa: 'تاج', bg: 'Crown' }, district: { fa: 'محله', bg: 'District' }, districtAny: { fa: 'محله‌ای', bg: 'District' },
  character: { fa: 'شخصیت', bg: 'Character' }, characters: { fa: 'شخصیت‌ها', bg: 'Characters' },
  ability: { fa: 'توانایی', bg: 'Ability' },
  gold: { fa: 'طلا', bg: 'Gold' }, card: { fa: 'کارت', bg: 'Card' }, round: { fa: 'دور', bg: 'Round' }, deck: { fa: 'دسته', bg: 'Deck' }, hand: { fa: 'دست', bg: 'Hand' },
  city: { fa: 'شهر', bg: 'City' }, cities: { fa: 'شهرها', bg: 'Cities' }, rank: { fa: 'رتبه', bg: 'Rank' },
  keepImp: { fa: 'نگه دارید', bg: 'Keep' }, buildImp: { fa: 'بسازید', bg: 'Build' }, build: { fa: 'ساختن', bg: 'Build' },
  kill: { fa: 'کشتن', bg: 'Assassinate' }, rob: { fa: 'دزدی از', bg: 'Rob' }, robbed: { fa: 'دزدیده', bg: 'Robbed' },
  swapHand: { fa: 'عوض کردن دست با', bg: 'Swap hand with' }, redraw: { fa: 'کشیدن دوبارهٔ', bg: 'Redraw' }, destroy: { fa: 'تخریب', bg: 'Destroy' },
  draft: { fa: 'انتخاب شخصیت‌ها', bg: 'Character draft' }, endTurn: { fa: 'پایان نوبت', bg: 'End turn' },
  // Characters 1–8 (index = rank).
  assassin: { fa: 'آدم‌کش', bg: 'Assassin' }, thief: { fa: 'دزد', bg: 'Thief' }, magician: { fa: 'شعبده‌باز', bg: 'Magician' }, king: { fa: 'شاه', bg: 'King' },
  bishop: { fa: 'اسقف', bg: 'Bishop' }, merchant: { fa: 'بازرگان', bg: 'Merchant' }, architect: { fa: 'معمار', bg: 'Architect' }, warlord: { fa: 'سردار', bg: 'Warlord' }
} satisfies Record<string, Term>;

const blank: Term = { fa: '', bg: '' };
/** Character names by rank (index 0 unused). */
export const CHAR_T: Term[] = [blank, terms.assassin, terms.thief, terms.magician, terms.king, terms.bishop, terms.merchant, terms.architect, terms.warlord];

const d = (fa: string, bg: string): Term => ({ fa, bg });
/** District names keyed by the Persian name from the rules data. */
export const DISTRICT_T: Record<string, Term> = {
  'عمارت': d('عمارت', 'Manor'), 'قصر کوچک': d('قصر کوچک', 'Castle'), 'کاخ': d('کاخ', 'Palace'),
  'معبد': d('معبد', 'Temple'), 'کلیسا': d('کلیسا', 'Church'), 'صومعه': d('صومعه', 'Monastery'), 'جامع': d('جامع', 'Cathedral'),
  'کاروانسرا': d('کاروانسرا', 'Tavern'), 'بازارچه': d('بازارچه', 'Market'), 'تیمچه': d('تیمچه', 'Trading Post'), 'اسکله': d('اسکله', 'Docks'),
  'بندر': d('بندر', 'Harbor'), 'دارالحکومه': d('دارالحکومه', 'Town Hall'),
  'برج دیده‌بانی': d('برج دیده‌بانی', 'Watchtower'), 'زندان': d('زندان', 'Prison'), 'میدان نبرد': d('میدان نبرد', 'Battlefield'), 'دژ': d('دژ', 'Fortress')
};
